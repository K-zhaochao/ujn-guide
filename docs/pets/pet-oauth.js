/* OAuth popup transaction helpers for the pet front end. */
(function (root, factory) {
  const oauth = factory();
  if (typeof module === 'object' && module.exports) module.exports = oauth;
  if (root) root.UJNGuidePetOAuth = oauth;
}(typeof window !== 'undefined' ? window : globalThis, function () {
  function resolveOrigin(value, fallbackOrigin) {
    try {
      return new URL(value || fallbackOrigin, fallbackOrigin).origin;
    } catch (_) {
      return '';
    }
  }

  function isRecord(value) {
    return value !== null && typeof value === 'object' && !Array.isArray(value);
  }

  function createOAuthTransaction({ origin = '' } = {}) {
    let popup = null;
    let nonce = '';

    function clear() {
      popup = null;
      nonce = '';
    }

    function start(nextPopup, nextNonce) {
      if (!nextPopup || typeof nextNonce !== 'string' || !nextNonce) {
        clear();
        return false;
      }
      popup = nextPopup;
      nonce = nextNonce;
      return true;
    }

    function consume(event) {
      if (!origin || !popup || !nonce || !event || event.origin !== origin || event.source !== popup) return null;
      const data = event.data;
      if (!isRecord(data) || data.nonce !== nonce) return null;
      if (data.type === 'auth-success') {
        if (!isRecord(data.user)) return null;
        clear();
        return { type: 'auth-success', user: data.user };
      }
      if (data.type === 'auth-error') {
        if (typeof data.message !== 'string') return null;
        clear();
        return { type: 'auth-error', message: data.message };
      }
      return null;
    }

    return {
      clear,
      consume,
      getNonce: () => nonce,
      getPopup: () => popup,
      start,
    };
  }

  return { createOAuthTransaction, resolveOrigin };
}));
