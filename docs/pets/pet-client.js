/*
 * 宠物前端的可测试基础设施。
 * 使用 UMD 保持 MkDocs 直接加载脚本的部署方式，同时让 Vitest 可用 CommonJS 引入。
 */
(function (root, factory) {
  const client = factory();
  if (typeof module === 'object' && module.exports) module.exports = client;
  if (root) root.UJNGuidePetClient = client;
}(typeof window !== 'undefined' ? window : globalThis, function () {
  const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

  function safeHttpUrl(value) {
    const raw = String(value || '').trim();
    if (!raw) return '';
    try {
      const parsed = new URL(raw);
      return parsed.protocol === 'https:' || parsed.protocol === 'http:' ? parsed.href : '';
    } catch (_) {
      return '';
    }
  }

  function createOAuthNonce(cryptoImpl, btoaImpl) {
    // 未传参时使用浏览器全局实现；显式传入 null 表示调用方检测到能力缺失，
    // 必须拒绝而不能意外回退到测试/宿主环境的全局 crypto。
    const secureCrypto = cryptoImpl === undefined ? (typeof crypto !== 'undefined' ? crypto : null) : cryptoImpl;
    const encodeBase64 = btoaImpl === undefined ? (typeof btoa === 'function' ? btoa : null) : btoaImpl;
    if (!secureCrypto || typeof secureCrypto.getRandomValues !== 'function' || typeof encodeBase64 !== 'function') return '';
    const bytes = new Uint8Array(32);
    secureCrypto.getRandomValues(bytes);
    let binary = '';
    for (let index = 0; index < bytes.length; index++) binary += String.fromCharCode(bytes[index]);
    return encodeBase64(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }

  function createApiClient({ baseUrl = '', fetchImpl, getCsrfToken, timeoutMs = 15000 } = {}) {
    const send = fetchImpl || (typeof fetch === 'function' ? fetch.bind(globalThis) : null);
    const readCsrfToken = typeof getCsrfToken === 'function' ? getCsrfToken : () => '';
    if (typeof send !== 'function') throw new Error('当前环境不支持 fetch');

    async function request(path, opts = {}) {
      const method = String(opts.method || 'GET').toUpperCase();
      const headers = { ...(opts.headers || {}) };
      if (opts.body !== undefined && !headers['Content-Type']) headers['Content-Type'] = 'application/json';
      const csrfToken = String(readCsrfToken() || '');
      if (!SAFE_METHODS.has(method) && csrfToken && !headers['X-CSRF-Token']) headers['X-CSRF-Token'] = csrfToken;

      const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
      const timer = controller ? setTimeout(() => controller.abort(), timeoutMs) : null;
      try {
        const response = await send(baseUrl + path, {
          method,
          headers,
          body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
          credentials: 'same-origin',
          signal: controller ? controller.signal : undefined,
        });
        const data = await response.json().catch(() => ({}));
        return { ok: response.ok, status: response.status, data };
      } catch (error) {
        if (error && error.name === 'AbortError') {
          return { ok: false, status: 408, data: { message: '请求超时，请检查网络后重试' } };
        }
        return { ok: false, status: 0, data: { message: '网络错误，请稍后重试' } };
      } finally {
        if (timer) clearTimeout(timer);
      }
    }

    return { request };
  }

  function createAuthSession({ request } = {}) {
    if (typeof request !== 'function') throw new TypeError('认证会话需要 request 函数');
    let user = null;
    let csrfToken = '';

    function clear() {
      const previousUser = user;
      user = null;
      csrfToken = '';
      return previousUser;
    }

    function getUser() {
      return user;
    }

    function getCsrfToken() {
      return csrfToken;
    }

    async function requestWithSession(path, opts) {
      const result = await request(path, opts);
      if (result.status === 401 && user) {
        return { ...result, sessionExpired: true, previousUser: clear() };
      }
      return result;
    }

    async function restore() {
      const result = await request('/api/auth/me');
      if (result.ok && result.data && result.data.success && result.data.user) {
        user = result.data.user;
        csrfToken = typeof result.data.csrfToken === 'string' ? result.data.csrfToken : '';
      } else {
        clear();
      }
      return result;
    }

    async function logout() {
      const result = await request('/api/auth/logout', { method: 'POST', body: {} });
      if (result.ok || result.status === 401) clear();
      return result;
    }

    return {
      clear,
      getCsrfToken,
      getUser,
      logout,
      request: requestWithSession,
      restore,
    };
  }

  return {
    SAFE_METHODS,
    createApiClient,
    createAuthSession,
    createOAuthNonce,
    safeHttpUrl,
  };
}));
