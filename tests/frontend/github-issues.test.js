/**
 * 站内 GitHub Issues 列表测试（docs/javascripts/github-issues.js）
 *
 * 用假的 fetch 覆盖三种情况：有 issue（含 PR 必须被过滤掉）、空列表、接口失败。
 * 另外校验页面容器与脚本的契约，避免页面结构改动后脚本静默失效。
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const source = readFileSync(resolve(process.cwd(), 'docs/javascripts/github-issues.js'), 'utf8');
const pageSource = readFileSync(resolve(process.cwd(), 'docs/contribute/index.md'), 'utf8');
const mkdocsSource = readFileSync(resolve(process.cwd(), 'mkdocs.yml'), 'utf8');

const handlers = [];
globalThis.document$ = { subscribe: fn => handlers.push(fn) };

/** 与 docs/contribute/index.md 中的容器结构保持一致 */
const CONTAINER = `
<div id="gh-issues" data-repo="K-zhaochao/ujn-guide" data-state="open">
  <div class="gh-issues__tabs" role="tablist">
    <button class="gh-issues__tab is-active" type="button" role="tab" aria-selected="true" data-state="open">开放中</button>
    <button class="gh-issues__tab" type="button" role="tab" aria-selected="false" data-state="closed">已关闭</button>
  </div>
  <p class="gh-issues__status"></p>
  <ol class="gh-issues__list"></ol>
</div>`;

const issue = (number, title, extra = {}) => Object.assign({
  number,
  title,
  state: 'open',
  created_at: new Date().toISOString(),
  comments: 2,
  user: { login: 'someone' },
  labels: [{ name: '内容纠错' }],
}, extra);

function mockFetch(handler) {
  globalThis.fetch = vi.fn((url) => handler(String(url)));
}

function boot(html = CONTAINER) {
  document.body.innerHTML = html;
  handlers.forEach(handler => handler());
}

const flush = () => new Promise(resolve => setTimeout(resolve, 0));

function status() {
  return document.querySelector('#gh-issues .gh-issues__status');
}

function rows() {
  return Array.from(document.querySelectorAll('#gh-issues .gh-issue'));
}

// 脚本在模块加载时执行一次；此时页面里没有容器，安全返回
new Function(source)();

beforeEach(() => {
  document.body.innerHTML = '';
});

describe('站内 GitHub Issues 列表', () => {
  it('渲染 issue，过滤掉 PR，并带上标签与作者信息', async () => {
    mockFetch(() => Promise.resolve({
      ok: true,
      json: async () => [
        issue(12, '食堂三楼营业时间写错了'),
        issue(13, '这是一个 PR，不该出现在列表里', { pull_request: { url: 'x' } }),
      ],
    }));
    boot();
    await flush();

    expect(rows()).toHaveLength(1);
    const row = rows()[0];
    expect(row.querySelector('.gh-issue__number').textContent).toBe('#12');
    expect(row.querySelector('.gh-issue__title').textContent).toContain('食堂三楼营业时间写错了');
    expect(row.querySelector('.gh-issue__title').getAttribute('href'))
      .toBe('https://github.com/K-zhaochao/ujn-guide/issues/12');
    expect(row.querySelector('.gh-issue__label').textContent).toBe('内容纠错');
    expect(row.querySelector('.gh-issue__meta').textContent).toContain('@someone');
    expect(row.querySelector('.gh-issue__meta').textContent).toContain('💬 2');
    expect(status().hidden).toBe(true);
    expect(globalThis.fetch.mock.calls[0][0])
      .toBe('https://api.github.com/repos/K-zhaochao/ujn-guide/issues?state=open&per_page=10&page=1&sort=updated');
  });

  it('没有 issue 时给出友好提示', async () => {
    mockFetch(() => Promise.resolve({ ok: true, json: async () => [] }));
    boot();
    await flush();

    expect(rows()).toHaveLength(0);
    expect(status().hidden).toBe(false);
    expect(status().textContent).toContain('欢迎提第一个');
  });

  it('接口失败（例如匿名限流）时提示并保留前往仓库的说明', async () => {
    mockFetch(() => Promise.resolve({ ok: false, status: 403, json: async () => ({}) }));
    boot();
    await flush();

    expect(rows()).toHaveLength(0);
    expect(status().textContent).toContain('暂时没有响应');
    expect(status().textContent).toContain('打开全部留言');
  });

  it('切换到「已关闭」会按新状态重新请求', async () => {
    const calls = [];
    mockFetch(url => {
      calls.push(url);
      return Promise.resolve({
        ok: true,
        json: async () => [issue(url.includes('closed') ? 7 : 8, url.includes('closed') ? '已修复' : '待处理')],
      });
    });
    boot();
    await flush();
    expect(rows()[0].textContent).toContain('待处理');

    document.querySelectorAll('#gh-issues .gh-issues__tab')[1].click();
    await flush();

    expect(rows()[0].textContent).toContain('已修复');
    expect(calls[1]).toContain('state=closed');
    expect(document.querySelector('#gh-issues .gh-issues__tab.is-active').textContent).toBe('已关闭');
  });

  it('页面上没有容器时不做任何请求', async () => {
    mockFetch(() => Promise.resolve({ ok: true, json: async () => [] }));
    boot('<p>普通页面</p>');
    await flush();
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });
});

describe('页面与脚本的契约', () => {
  it('反馈页提供容器、仓库名、两个状态页签和直达链接', () => {
    expect(pageSource).toContain('id="gh-issues"');
    expect(pageSource).toContain('data-repo="K-zhaochao/ujn-guide"');
    expect(pageSource).toContain('data-state="open"');
    expect(pageSource).toContain('data-state="closed"');
    expect(pageSource).toContain('gitee.com/Draven323/ujn-guide/issues/new');
    expect(pageSource).toContain('github.com/K-zhaochao/ujn-guide/issues/new');
    // 容器结构与脚本选择器保持一致
    ['.gh-issues__tabs', '.gh-issues__tab', '.gh-issues__status', '.gh-issues__list']
      .forEach(selector => expect(pageSource).toContain(selector.slice(1)));
  });

  it('脚本已登记在 mkdocs.yml 的 extra_javascript 中', () => {
    expect(mkdocsSource).toContain('javascripts/github-issues.js');
  });
});


describe('comment-style discussion enhancements', () => {
  it('renders body as plain text, preventing injected markup', async () => {
    mockFetch(() => Promise.resolve({ ok: true, json: async () => [issue(3, '<img onerror=alert(1)>', { body: '<script>alert(2)</script>', user: { login: '<b>user</b>', avatar_url: 'javascript:alert(3)' } })] }));
    boot(); await flush(); expect(rows()[0].querySelector('.gh-issue__body').textContent).toContain('<script>'); expect(rows()[0].querySelector('script')).toBeNull(); expect(rows()[0].querySelector('img')).toBeNull();
  });
  it('opens replies on demand, caches a loaded thread and displays reply authors', async () => {
    mockFetch(url => Promise.resolve({ ok: true, json: async () => url.includes('/comments?') ? [{ user: { login: 'maintainer' }, body_text: '已修正，谢谢反馈', created_at: new Date().toISOString() }] : [issue(4, '反馈', { body_text: '食堂信息有误' })] }));
    boot(); await flush(); expect(fetch).toHaveBeenCalledTimes(1); const expand = rows()[0].querySelector('.gh-issue__expand'); expand.click(); await flush();
    expect(rows()[0].querySelector('.gh-replies').hidden).toBe(false); expect(rows()[0].textContent).toContain('已修正，谢谢反馈'); expect(rows()[0].textContent).toContain('@maintainer');
    expand.click(); expand.click(); await flush(); expect(fetch).toHaveBeenCalledTimes(2);
  });
  it('paginates issues using GitHub next-page link, and returns to a cached page', async () => {
    const html = CONTAINER.replace('</div>', '</div>').replace('</ol>', '</ol><nav class="gh-issues__pagination" hidden></nav>');
    mockFetch(url => Promise.resolve({ ok: true, headers: { get: () => url.includes('page=1') ? '<https://api.github.com/page2>; rel="next"' : '' }, json: async () => [issue(url.includes('page=2') ? 22 : 11, '分页留言')] }));
    boot(html); await flush(); document.querySelector('.gh-issues__pagination button:last-child').click(); await flush(); expect(rows()[0].textContent).toContain('#22');
    document.querySelector('.gh-issues__pagination button:first-child').click(); await flush(); expect(rows()[0].textContent).toContain('#11'); expect(fetch).toHaveBeenCalledTimes(2);
  });
  it('does not let a late old tab response replace the current selection', async () => {
    let resolveOld; mockFetch(url => url.includes('state=open') ? new Promise(resolve => { resolveOld = resolve; }) : Promise.resolve({ ok: true, json: async () => [issue(9, '已处理')] }));
    boot(); document.querySelector('[data-state="closed"]').click(); await flush(); resolveOld({ ok: true, json: async () => [issue(8, '旧请求')] }); await flush(); expect(rows()[0].textContent).toContain('已处理');
  });
  it('composer carries draft to GitHub for final confirmation without a write API or token', async () => {
    const open = vi.spyOn(window, 'open').mockImplementation(() => null);
    mockFetch(() => Promise.resolve({ ok: true, json: async () => [] }));
    boot(CONTAINER.replace('<p class="gh-issues__status">', '<form class="gh-composer"><input name="title" required><textarea name="body" required></textarea><button type="submit">发布</button></form><p class="gh-issues__status">'));
    document.querySelector('[name=title]').value = '建议增加校历'; document.querySelector('[name=body]').value = '可在首页显示开学日期。'; document.querySelector('form').dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })); await flush();
    const url = new URL(open.mock.calls[0][0]); expect(url.pathname).toBe('/K-zhaochao/ujn-guide/issues/new'); expect(url.searchParams.get('body')).toContain('开学日期'); expect(fetch).toHaveBeenCalledTimes(1); open.mockRestore();
  });
  it('instant-navigation initialization does not duplicate handlers or requests', async () => {
    mockFetch(() => Promise.resolve({ ok: true, json: async () => [] })); boot(); await flush(); handlers.forEach(handler => handler()); await flush(); expect(fetch).toHaveBeenCalledTimes(1);
  });
});
