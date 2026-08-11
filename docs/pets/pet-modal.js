/* Accessible modal lifecycle helpers for the pet front end. */
(function (root, factory) {
  const modal = factory();
  if (typeof module === 'object' && module.exports) module.exports = modal;
  if (root) root.UJNGuidePetModal = modal;
}(typeof window !== 'undefined' ? window : globalThis, function () {
  const FOCUSABLE_SELECTOR = 'button, input, select, textarea, [tabindex]';

  function createModalController({ document: documentRef, requestAnimationFrame, registerListener, unregisterListener } = {}) {
    if (!documentRef) throw new TypeError('Modal controller requires a document');
    const states = new WeakMap();
    const schedule = typeof requestAnimationFrame === 'function'
      ? requestAnimationFrame
      : callback => setTimeout(callback, 0);
    const register = typeof registerListener === 'function'
      ? registerListener
      : (target, type, listener) => {
        target.addEventListener(type, listener);
        return { target, type, listener };
      };
    const unregister = typeof unregisterListener === 'function'
      ? unregisterListener
      : entry => {
        if (entry) entry.target.removeEventListener(entry.type, entry.listener);
      };

    function close(modal, { restoreFocus = true } = {}) {
      if (!modal) return;
      const state = states.get(modal);
      if (state) {
        unregister(state.listenerEntry);
        states.delete(modal);
      }
      modal.style.display = 'none';
      if (restoreFocus && state && state.previous && state.previous.isConnected && typeof state.previous.focus === 'function') {
        state.previous.focus();
      }
    }

    function open(modal, { label, style } = {}) {
      if (!modal) return;
      const existing = states.get(modal);
      const previous = existing ? existing.previous : documentRef.activeElement;
      if (existing) {
        unregister(existing.listenerEntry);
        states.delete(modal);
      }
      modal.setAttribute('role', 'dialog');
      modal.setAttribute('aria-modal', 'true');
      if (label) modal.setAttribute('aria-label', label);
      if (style) modal.style.cssText = style;

      const onKeyDown = event => {
        if (event.key === 'Escape') close(modal);
      };
      const listenerEntry = register(documentRef, 'keydown', onKeyDown);
      states.set(modal, { listenerEntry, previous });
      schedule(() => {
        const state = states.get(modal);
        if (!state || state.listenerEntry !== listenerEntry) return;
        const first = modal.querySelector(FOCUSABLE_SELECTOR);
        if (first && typeof first.focus === 'function') first.focus();
      });
      return modal;
    }

    return { close, open };
  }

  return { FOCUSABLE_SELECTOR, createModalController };
}));
