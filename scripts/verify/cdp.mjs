/**
 * 无头浏览器验收用的 CDP 小工具。
 * 这些脚本靠一个开着远程调试端口的 Chrome 工作，启动方式见同目录 README.md。
 */

export async function connect({ port = 9222 } = {}) {
  const list = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
  const target = list.find(item => item.type === 'page');
  if (!target) throw new Error('没有找到可用的页面目标，Chrome 起了吗？');

  const socket = new WebSocket(target.webSocketDebuggerUrl);
  const pending = new Map();
  let nextId = 0;

  socket.addEventListener('message', event => {
    const message = JSON.parse(event.data);
    if (message.id && pending.has(message.id)) {
      pending.get(message.id)(message.result);
      pending.delete(message.id);
    }
  });
  await new Promise(resolve => socket.addEventListener('open', resolve));

  const send = (method, params = {}) => new Promise(resolve => {
    const id = (nextId += 1);
    pending.set(id, resolve);
    socket.send(JSON.stringify({ id, method, params }));
  });

  /** 求值并返回结果；抛错与「上下文被导航销毁」都折成 { error }，避免脚本中途崩掉。 */
  const evaluate = async expression => {
    const response = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
    if (!response) return { error: 'CDP 没有返回结果（多半是导航把执行上下文销毁了）' };
    if (response.exceptionDetails) {
      return { error: (response.exceptionDetails.exception?.description || '').split('\n')[0] };
    }
    return response.result.value;
  };

  await send('Page.enable');
  await send('Runtime.enable');

  return {
    send,
    evaluate,
    close: () => socket.close(),
    /** 设置视口与配色方案（配色要连 media 一起给，否则部分 Chrome 版本会忽略）。 */
    async viewport({ width, height = 950, mobile = false, scheme = 'light' }) {
      await send('Emulation.setDeviceMetricsOverride', {
        width, height, deviceScaleFactor: 1, mobile,
      });
      await send('Emulation.setEmulatedMedia', {
        media: 'screen', features: [{ name: 'prefers-color-scheme', value: scheme }],
      });
    },
    async goto(url, waitMs = 3000) {
      await send('Page.navigate', { url });
      await new Promise(resolve => setTimeout(resolve, waitMs));
    },
    async key(name, code, vk, modifiers = 0) {
      await send('Input.dispatchKeyEvent', { type: 'rawKeyDown', key: name, code, windowsVirtualKeyCode: vk, modifiers });
      await send('Input.dispatchKeyEvent', { type: 'keyUp', key: name, code, windowsVirtualKeyCode: vk, modifiers });
      await new Promise(resolve => setTimeout(resolve, 250));
    },
    /**
     * 命中检测：坐标上真正能收到点击的是哪个元素。
     *
     * 为什么必须有它：`element.click()` 会**绕过**命中检测，所以「元素被透明层挡住、
     * 用户点不到」这类 bug 用 click() 永远测不出来——「免责声明」标签点不了就是这么漏掉的
     * （真实命中结果是搜索面板里一个 opacity: 0 的 div）。
     */
    async hitTest(x, y) {
      const raw = await evaluate(`(() => {
        const el = document.elementFromPoint(${x}, ${y});
        if (!el) return null;
        const path = [];
        for (let node = el; node && path.length < 4; node = node.parentElement) {
          path.push(node.tagName.toLowerCase() + (node.id ? '#' + node.id : '')
            + (node.className ? '.' + node.className.toString().trim().split(/\\s+/).slice(0, 2).join('.') : ''));
        }
        return path.join(' < ');
      })()`);
      return typeof raw === 'string' ? raw : null;
    },
    /** 在坐标上发一次真实鼠标点击（按下 + 抬起）。 */
    async clickAt(x, y) {
      for (const type of ['mousePressed', 'mouseReleased']) {
        await send('Input.dispatchMouseEvent', { type, x, y, button: 'left', clickCount: 1 });
      }
    },
    /** 元素的中心点坐标（不可见元素返回 null）。
     *  两个细节都是踩过的坑：
     *  1. 先把元素滚进视口——否则 elementFromPoint 对屏幕外的坐标一律返回 null；
     *  2. 行内元素（尤其会换行的链接）要用**第一个行盒**的中心，
     *     用整体外接框的中心会落在两行之间的空隙里，变成误报。 */
    async centerOf(selector) {
      const raw = await evaluate(`(() => {
        const el = document.querySelector(${JSON.stringify(selector)});
        if (!el) return null;
        // 收起状态 <details> 里的元素照样有 getClientRects()，但其实看不见、也点不到——
        // 用 checkVisibility() 挡掉（「本页目录」折叠块里的链接就是这么被误报的）。
        if (typeof el.checkVisibility === 'function'
            && !el.checkVisibility({ checkVisibilityCSS: true, checkOpacity: false })) {
          return null;
        }
        el.scrollIntoView({ block: 'center', inline: 'center' });
        const rects = el.getClientRects();
        const rect = rects.length ? rects[0] : el.getBoundingClientRect();
        if (rect.width < 2 || rect.height < 2) return null;
        const x = Math.round(rect.left + rect.width / 2);
        const y = Math.round(rect.top + rect.height / 2);
        if (y < 4 || y > window.innerHeight - 4) return null; // 滚完仍在视口外就跳过
        return JSON.stringify([x, y]);
      })()`);
      return typeof raw === 'string' ? JSON.parse(raw) : null;
    },
  };
}

export const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

export const BASE_URL = process.env.UJN_BASE_URL || 'http://127.0.0.1:8100/ujn-guide';
export const OUT_DIR = process.env.UJN_OUT_DIR || process.cwd();
