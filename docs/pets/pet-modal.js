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
    const stack = [];
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
      const stackIndex = stack.lastIndexOf(modal);
      if (stackIndex >= 0) stack.splice(stackIndex, 1);
      modal.style.display = 'none';
      if (state && typeof state.onClose === 'function') state.onClose();
      if (restoreFocus && state && state.previous && state.previous.isConnected && typeof state.previous.focus === 'function') {
        state.previous.focus();
      }
    }

    function open(modal, { label, style, onClose } = {}) {
      if (!modal) return;
      const existing = states.get(modal);
      const previous = existing ? existing.previous : documentRef.activeElement;
      if (existing) {
        unregister(existing.listenerEntry);
        states.delete(modal);
      }
      const existingStackIndex = stack.lastIndexOf(modal);
      if (existingStackIndex >= 0) stack.splice(existingStackIndex, 1);
      modal.setAttribute('role', 'dialog');
      modal.setAttribute('aria-modal', 'true');
      if (label) modal.setAttribute('aria-label', label);
      if (style) modal.style.cssText = style;

      const onKeyDown = event => {
        // A detail dialog may open a second dialog. Only the topmost one may
        // consume Esc/Tab, otherwise Esc would close both in the same event.
        if (stack[stack.length - 1] !== modal) return;
        if (event.key === 'Escape') {
          event.preventDefault();
          close(modal);
          return;
        }
        if (event.key !== 'Tab') return;
        const focusable = Array.from(modal.querySelectorAll(FOCUSABLE_SELECTOR))
          .filter(element => !element.disabled && element.tabIndex !== -1);
        if (!focusable.length) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (event.shiftKey ? documentRef.activeElement === first : documentRef.activeElement === last) {
          event.preventDefault();
          (event.shiftKey ? last : first).focus();
        }
      };
      const listenerEntry = register(documentRef, 'keydown', onKeyDown);
      states.set(modal, { listenerEntry, previous, onClose });
      stack.push(modal);
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

  function createConfirmController({ document: documentRef, requestAnimationFrame, registerListener, unregisterListener } = {}) {
    if (!documentRef) throw new TypeError('Confirm controller requires a document');
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
    let active = null;

    function ensureDialog() {
      let dialog = documentRef.getElementById('pet-confirm-modal');
      if (dialog) return dialog;
      dialog = documentRef.createElement('div');
      dialog.id = 'pet-confirm-modal';
      dialog.setAttribute('aria-hidden', 'true');
      dialog.style.cssText = 'position:fixed;inset:0;z-index:16000;display:none;align-items:center;justify-content:center;padding:20px;background:var(--pet-overlay,rgba(0,0,0,.55))';
      documentRef.body.appendChild(dialog);
      return dialog;
    }

    function confirm(options = {}) {
      if (active) active.finish(false);
      const dialog = ensureDialog();
      const title = String(options.title || '请确认操作');
      const message = String(options.message || '此操作将立即生效。');
      const confirmText = String(options.confirmText || '确认');
      const cancelText = String(options.cancelText || '取消');
      const variant = options.variant === 'danger' ? 'danger' : 'primary';
      const previous = documentRef.activeElement;
      const titleId = 'pet-confirm-title';
      const descriptionId = 'pet-confirm-description';
      const panel = documentRef.createElement('section');
      const heading = documentRef.createElement('h2');
      const description = documentRef.createElement('p');
      const actions = documentRef.createElement('div');
      const cancelButton = documentRef.createElement('button');
      const confirmButton = documentRef.createElement('button');

      dialog.replaceChildren(panel);
      dialog.style.display = 'flex';
      dialog.setAttribute('aria-hidden', 'false');
      panel.setAttribute('role', 'alertdialog');
      panel.setAttribute('aria-modal', 'true');
      panel.setAttribute('aria-labelledby', titleId);
      panel.setAttribute('aria-describedby', descriptionId);
      panel.style.cssText = 'width:min(100%,420px);padding:24px;border:1px solid var(--pet-border,#e5e7eb);border-radius:10px;background:var(--md-default-bg-color,#fff);color:var(--md-default-fg-color,#1f2937);box-shadow:0 20px 48px rgba(0,0,0,.24)';

      heading.id = titleId;
      heading.textContent = title;
      heading.style.cssText = 'margin:0 0 8px;font-size:18px;line-height:1.4;color:var(--md-default-fg-color,#1f2937)';
      description.id = descriptionId;
      description.textContent = message;
      description.style.cssText = 'margin:0;color:var(--pet-muted,#6b7280);font-size:14px;line-height:1.7;white-space:pre-line';
      actions.style.cssText = 'display:flex;justify-content:flex-end;gap:10px;margin-top:22px;flex-wrap:wrap';

      cancelButton.type = 'button';
      cancelButton.textContent = cancelText;
      cancelButton.style.cssText = 'min-width:88px;min-height:44px;padding:9px 14px;border:1px solid var(--pet-border,#e5e7eb);border-radius:8px;background:var(--pet-soft,rgba(0,0,0,.04));color:var(--md-default-fg-color,#374151);font-size:14px;cursor:pointer';
      confirmButton.type = 'button';
      confirmButton.textContent = confirmText;
      confirmButton.style.cssText = 'min-width:108px;min-height:44px;padding:9px 14px;border:1px solid ' + (variant === 'danger' ? 'var(--pet-danger,#ef4444)' : 'var(--pet-primary,#3b82f6)') + ';border-radius:8px;background:' + (variant === 'danger' ? 'var(--pet-danger,#ef4444)' : 'var(--pet-primary,#3b82f6)') + ';color:#fff;font-size:14px;font-weight:600;cursor:pointer';
      actions.append(cancelButton, confirmButton);
      panel.append(heading, description, actions);

      let resolvePromise;
      const result = new Promise(resolve => { resolvePromise = resolve; });
      const state = { previous, listenerEntry: null, finish: null };
      const finish = accepted => {
        if (active !== state) return;
        unregister(state.listenerEntry);
        active = null;
        dialog.style.display = 'none';
        dialog.setAttribute('aria-hidden', 'true');
        dialog.replaceChildren();
        if (previous && previous.isConnected && typeof previous.focus === 'function') previous.focus();
        resolvePromise(Boolean(accepted));
      };
      state.finish = finish;

      const onKeyDown = event => {
        if (event.key === 'Escape') {
          event.preventDefault();
          finish(false);
          return;
        }
        if (event.key !== 'Tab') return;
        const focusable = Array.from(panel.querySelectorAll(FOCUSABLE_SELECTOR)).filter(element => !element.disabled && element.tabIndex !== -1);
        if (!focusable.length) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (event.shiftKey ? documentRef.activeElement === first : documentRef.activeElement === last) {
          event.preventDefault();
          (event.shiftKey ? last : first).focus();
        }
      };
      state.listenerEntry = register(documentRef, 'keydown', onKeyDown);
      active = state;
      cancelButton.onclick = () => finish(false);
      confirmButton.onclick = () => finish(true);
      dialog.onclick = event => { if (event.target === dialog) finish(false); };
      schedule(() => {
        if (active === state && typeof confirmButton.focus === 'function') confirmButton.focus();
      });
      return result;
    }

    function dispose() {
      if (active) active.finish(false);
    }

    return { confirm, dispose };
  }

  return { FOCUSABLE_SELECTOR, createModalController, createConfirmController };
}));
