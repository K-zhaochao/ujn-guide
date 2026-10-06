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
  };
}

export const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

export const BASE_URL = process.env.UJN_BASE_URL || 'http://127.0.0.1:8100/ujn-guide';
export const OUT_DIR = process.env.UJN_OUT_DIR || process.cwd();
