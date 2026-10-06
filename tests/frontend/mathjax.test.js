import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const require = createRequire(import.meta.url);
const source = readFileSync(require.resolve('../../docs/javascripts/mathjax.js'), 'utf8');

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((accept, fail) => { resolve = accept; reject = fail; });
  return { promise, resolve, reject };
}

// 只排空测试中有界的 Promise 队列，不靠定时器等待渲染。
async function flushQueue() {
  for (let index = 0; index < 20; index += 1) await Promise.resolve();
}

describe('MathJax 首次加载与即时导航', () => {
  let navigate;
  let warnings;

  function newPage(formula = '\\(x\\)') {
    const article = document.createElement('article');
    article.className = 'md-content__inner md-typeset';
    if (formula !== null) {
      const math = document.createElement('span');
      math.className = 'arithmatex';
      math.textContent = formula;
      article.appendChild(math);
    }
    document.body.replaceChildren(article);
    // Material 的 head 更新会移除下一页源码中没有的动态样式。
    document.getElementById('MJX-CHTML-styles')?.remove();
    return article;
  }

  function installEngine({ defaultReadyError } = {}) {
    const config = window.MathJax;
    const startup = deferred();
    const order = [];
    let cachedStyle;
    const engine = {
      startup: {
        promise: startup.promise,
        defaultReady: vi.fn(() => {
          if (defaultReadyError) throw defaultReadyError;
        }),
        output: {
          clearCache: vi.fn(() => { order.push('cache'); cachedStyle = null; }),
        },
      },
      typesetClear: vi.fn(() => { order.push('clear'); }),
      texReset: vi.fn(() => { order.push('reset'); }),
      typesetPromise: vi.fn(articles => {
        order.push('typeset');
        // 模拟 CHTML 对已生成样式的缓存，未 clearCache 时会复用旧字形。
        if (!cachedStyle) {
          cachedStyle = document.createElement('style');
          cachedStyle.id = 'MJX-CHTML-styles';
          cachedStyle.textContent = `/* glyphs: ${articles.map(article => article.textContent).join(' ')} */`;
        }
        document.head.appendChild(cachedStyle);
        return Promise.resolve();
      }),
    };
    window.MathJax = engine;
    config.startup.ready();
    return { engine, startup, order };
  }

  beforeEach(() => {
    vi.useFakeTimers();
    warnings = vi.spyOn(console, 'warn').mockImplementation(() => {});
    // 引擎不再由 overrides/main.html 无条件引入，而是本脚本按需注入，
    // 所以 head 里初始没有 #mathjax-script。
    document.head.replaceChildren();
    newPage();
    window.document$ = {
      subscribe: vi.fn(callback => { navigate = callback; callback(); }),
    };
    window.eval(source);
  });

  afterEach(async () => {
    await flushQueue();
    delete window.MathJax;
    delete window.document$;
    delete window.__ujnMathJaxInitialized;
    document.head.replaceChildren();
    document.body.replaceChildren();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('保留公式定界符和 arithmatex 范围，关闭初始自动排版', () => {
    expect(window.MathJax.tex).toMatchObject({
      inlineMath: [['$', '$'], ['\\(', '\\)']],
      displayMath: [['$$', '$$'], ['\\[', '\\]']],
      processEscapes: true,
      processEnvironments: true,
    });
    expect(window.MathJax.options.processHtmlClass).toBe('arithmatex');
    expect(window.MathJax.startup.typeset).toBe(false);
  });

  it('即使 typesetPromise 已存在也等待 startup.promise，只首次排版一次', async () => {
    const article = document.querySelector('article');
    const { engine, startup } = installEngine();
    navigate();
    await flushQueue();
    expect(engine.startup.defaultReady).toHaveBeenCalledTimes(1);
    expect(engine.typesetPromise).not.toHaveBeenCalled();
    startup.resolve();
    await flushQueue();
    expect(engine.typesetPromise).toHaveBeenCalledExactlyOnceWith([article]);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('引擎慢加载期间不轮询、不积压旧页面，就绪后排版最新页面', async () => {
    newPage('\\(old\\)'); navigate();
    await vi.advanceTimersByTimeAsync(60000);
    expect(vi.getTimerCount()).toBe(0);
    const { engine, startup } = installEngine();
    newPage('\\(middle\\)'); navigate();
    const latest = newPage('\\(N+M\\)'); navigate();
    startup.resolve();
    await flushQueue();
    expect(engine.typesetPromise).toHaveBeenCalledExactlyOnceWith([latest]);
    expect(warnings).not.toHaveBeenCalled();
  });

  it('导航后清理旧记录、重建样式，让新页面新增的字形可见', async () => {
    const { engine, startup, order } = installEngine();
    startup.resolve();
    await flushQueue();
    const previousStyle = document.getElementById('MJX-CHTML-styles');
    const next = newPage('\\(N+M+90\\%\\)'); navigate();
    await flushQueue();
    const style = document.getElementById('MJX-CHTML-styles');
    expect(style).not.toBe(previousStyle);
    expect(style.textContent).toContain('N+M+90');
    expect(document.querySelectorAll('#MJX-CHTML-styles')).toHaveLength(1);
    expect(order).toEqual(['cache', 'clear', 'reset', 'typeset', 'cache', 'clear', 'reset', 'typeset']);
    expect(engine.typesetPromise).toHaveBeenLastCalledWith([next]);
  });

  it('排版中快速切换时保持串行，跳过未开始的过期页面', async () => {
    const { engine, startup } = installEngine();
    const inFlight = deferred();
    engine.typesetPromise.mockImplementationOnce(() => inFlight.promise);
    const first = document.querySelector('article');
    startup.resolve();
    await flushQueue();
    newPage('\\(middle\\)'); navigate();
    const latest = newPage('\\(latest\\)'); navigate();
    await flushQueue();
    expect(engine.typesetPromise).toHaveBeenCalledExactlyOnceWith([first]);
    expect(engine.typesetClear).toHaveBeenCalledTimes(1);
    inFlight.resolve();
    await flushQueue();
    expect(engine.typesetPromise).toHaveBeenCalledTimes(2);
    expect(engine.typesetPromise).toHaveBeenLastCalledWith([latest]);
    expect(engine.typesetClear).toHaveBeenCalledTimes(2);
  });

  it('不处理已经离开文档的正文', async () => {
    const { engine, startup } = installEngine();
    startup.resolve();
    await flushQueue();
    newPage(); navigate();
    document.body.replaceChildren();
    await flushQueue();
    expect(engine.typesetPromise).toHaveBeenCalledTimes(1);
  });

  it('经过无公式页面时释放旧记录，不排版导航栏等正文以外的公式', async () => {
    const { engine, startup } = installEngine();
    startup.resolve();
    await flushQueue();
    newPage(null);
    const aside = document.createElement('aside');
    aside.innerHTML = '<span class="arithmatex">\\(outside\\)</span>';
    document.body.appendChild(aside);
    navigate();
    await flushQueue();
    expect(engine.typesetClear).toHaveBeenCalledTimes(2);
    expect(engine.typesetPromise).toHaveBeenCalledTimes(1);
    const next = newPage('\\(back\\)'); navigate();
    await flushQueue();
    expect(engine.typesetPromise).toHaveBeenLastCalledWith([next]);
  });

  it('从无公式首页首次进入公式页时无需刷新', async () => {
    newPage(null); navigate();
    const { engine, startup } = installEngine();
    startup.resolve();
    await flushQueue();
    expect(engine.typesetPromise).not.toHaveBeenCalled();
    const article = newPage('\\(GPA\\)'); navigate();
    await flushQueue();
    expect(engine.typesetPromise).toHaveBeenCalledExactlyOnceWith([article]);
  });

  it('排版 Promise 失败被捕获，下一页仍可正常排版', async () => {
    const { engine, startup } = installEngine();
    const failure = new Error('typeset failed');
    engine.typesetPromise.mockRejectedValueOnce(failure);
    startup.resolve();
    await flushQueue();
    expect(warnings).toHaveBeenCalledExactlyOnceWith('[MathJax] 公式排版未完成：', failure);
    const next = newPage(); navigate();
    await flushQueue();
    expect(engine.typesetPromise).toHaveBeenCalledTimes(2);
    expect(engine.typesetPromise).toHaveBeenLastCalledWith([next]);
  });

  it('同步清理异常也不会阻塞下一次导航', async () => {
    const { engine, startup } = installEngine();
    engine.startup.output.clearCache.mockImplementationOnce(() => { throw new Error('cache failed'); });
    startup.resolve();
    await flushQueue();
    expect(warnings).toHaveBeenCalledTimes(1);
    const next = newPage(); navigate();
    await flushQueue();
    expect(engine.typesetPromise).toHaveBeenCalledExactlyOnceWith([next]);
  });

  it('初始化失败有错误提示，不产生无界重试或未处理拒绝', async () => {
    const { engine, startup } = installEngine();
    const failure = new Error('startup failed');
    startup.reject(failure);
    await flushQueue();
    navigate();
    await vi.advanceTimersByTimeAsync(60000);
    expect(warnings).toHaveBeenCalledExactlyOnceWith('[MathJax] 公式排版未完成：', failure);
    expect(engine.typesetPromise).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
  });

  it('默认初始化同步抛错时也保留页面内容', () => {
    const failure = new Error('defaultReady failed');
    installEngine({ defaultReadyError: failure });
    expect(warnings).toHaveBeenCalledExactlyOnceWith('[MathJax] 公式排版未完成：', failure);
    expect(document.querySelector('.arithmatex').textContent).toBe('\\(x\\)');
  });

  it('引擎下载失败只报告一次，保留原文且不妨碍之后的就绪事件', async () => {
    const script = document.getElementById('mathjax-script');
    script.dispatchEvent(new Event('error'));
    script.dispatchEvent(new Event('error'));
    navigate();
    await vi.advanceTimersByTimeAsync(60000);
    expect(warnings).toHaveBeenCalledTimes(1);
    expect(warnings.mock.calls[0][1].message).toContain('脚本加载失败');
    expect(document.querySelector('.arithmatex').textContent).toBe('\\(x\\)');
    expect(vi.getTimerCount()).toBe(0);
    const { engine, startup } = installEngine();
    startup.resolve();
    await flushQueue();
    expect(engine.typesetPromise).toHaveBeenCalledTimes(1);
  });

  it('重复加载脚本和同一正文的重复通知都不会覆盖引擎或重复排版', async () => {
    const { engine, startup } = installEngine();
    window.eval(source);
    expect(window.MathJax).toBe(engine);
    expect(window.document$.subscribe).toHaveBeenCalledTimes(1);
    startup.resolve();
    await flushQueue();
    navigate(); navigate();
    await flushQueue();
    expect(engine.typesetPromise).toHaveBeenCalledTimes(1);
  });

  it('没有 Material 导航流时，仍在引擎就绪后完成首次排版', async () => {
    delete window.document$;
    delete window.__ujnMathJaxInitialized;
    document.head.replaceChildren();
    window.eval(source);
    const { engine, startup } = installEngine();
    startup.resolve();
    await flushQueue();
    expect(engine.typesetPromise).toHaveBeenCalledTimes(1);
  });

  it('没有公式的页面完全不加载引擎', async () => {
    delete window.__ujnMathJaxInitialized;
    document.head.replaceChildren();
    newPage(null);
    window.eval(source);
    navigate();
    await flushQueue();
    expect(document.querySelector('script[src*="mathjax"]')).toBeNull();
    expect(warnings).not.toHaveBeenCalled();
  });

  it('页面出现公式时按需注入带 SRI 的引擎脚本，且只注入一次', async () => {
    delete window.__ujnMathJaxInitialized;
    document.head.replaceChildren();
    newPage('\\(y\\)');
    window.eval(source);
    const injected = document.querySelectorAll('script[src*="mathjax"]');
    expect(injected).toHaveLength(1);
    expect(injected[0].getAttribute('src')).toContain('mathjax@3.2.2');
    expect(injected[0].getAttribute('src')).toContain('tex-mml-chtml.js');
    expect(injected[0].getAttribute('integrity')).toMatch(/^sha384-/);
    expect(injected[0].getAttribute('crossorigin')).toBe('anonymous');
    navigate();
    navigate();
    await flushQueue();
    expect(document.querySelectorAll('script[src*="mathjax"]')).toHaveLength(1);
  });

  it('即时导航进入有公式的页面时才加载引擎', async () => {
    delete window.__ujnMathJaxInitialized;
    document.head.replaceChildren();
    newPage(null);
    window.eval(source);
    navigate();
    await flushQueue();
    expect(document.querySelector('script[src*="mathjax"]')).toBeNull();

    newPage('\\(z\\)');
    navigate();
    expect(document.querySelectorAll('script[src*="mathjax"]')).toHaveLength(1);
  });
});
