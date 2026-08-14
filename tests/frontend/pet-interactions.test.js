import { createRequire } from 'node:module';
import { describe, expect, it } from 'vitest';

const require = createRequire(import.meta.url);
const oauth = require('../../docs/pets/pet-oauth.js');
const modal = require('../../docs/pets/pet-modal.js');

describe('宠物 OAuth 交易', () => {
  it('只接受匹配 origin、窗口引用、nonce 和消息结构的回调', () => {
    const popup = {};
    const transaction = oauth.createOAuthTransaction({ origin: 'https://pet.example.test' });
    expect(window.UJNGuidePetOAuth).toBe(oauth);
    expect(transaction.start(popup, 'secure-nonce')).toBe(true);

    expect(transaction.consume({
      origin: 'https://attacker.example.test', source: popup,
      data: { type: 'auth-success', nonce: 'secure-nonce', user: { username: 'tester' } },
    })).toBeNull();
    expect(transaction.consume({
      origin: 'https://pet.example.test', source: {},
      data: { type: 'auth-success', nonce: 'secure-nonce', user: { username: 'tester' } },
    })).toBeNull();
    expect(transaction.consume({
      origin: 'https://pet.example.test', source: popup,
      data: { type: 'auth-success', nonce: 'wrong-nonce', user: { username: 'tester' } },
    })).toBeNull();
    expect(transaction.consume({
      origin: 'https://pet.example.test', source: popup,
      data: { type: 'auth-success', nonce: 'secure-nonce', user: null },
    })).toBeNull();
    expect(transaction.getNonce()).toBe('secure-nonce');
  });

  it('只消费一次有效成功消息，随后清空窗口与 nonce', () => {
    const popup = {};
    const transaction = oauth.createOAuthTransaction({ origin: 'https://pet.example.test' });
    transaction.start(popup, 'secure-nonce');

    expect(transaction.consume({
      origin: 'https://pet.example.test', source: popup,
      data: { type: 'auth-success', nonce: 'secure-nonce', user: { username: 'tester' } },
    })).toEqual({ type: 'auth-success', user: { username: 'tester' } });
    expect(transaction.getPopup()).toBeNull();
    expect(transaction.getNonce()).toBe('');
    expect(transaction.consume({
      origin: 'https://pet.example.test', source: popup,
      data: { type: 'auth-success', nonce: 'secure-nonce', user: { username: 'tester' } },
    })).toBeNull();
  });

  it('仅接受带字符串错误信息的失败消息，并安全解析 API origin', () => {
    const popup = {};
    const transaction = oauth.createOAuthTransaction({ origin: 'https://pet.example.test' });
    transaction.start(popup, 'secure-nonce');

    expect(transaction.consume({
      origin: 'https://pet.example.test', source: popup,
      data: { type: 'auth-error', nonce: 'secure-nonce', message: null },
    })).toBeNull();
    expect(transaction.consume({
      origin: 'https://pet.example.test', source: popup,
      data: { type: 'auth-error', nonce: 'secure-nonce', message: '用户取消授权' },
    })).toEqual({ type: 'auth-error', message: '用户取消授权' });
    expect(oauth.resolveOrigin('/api', 'https://pet.example.test')).toBe('https://pet.example.test');
    expect(oauth.resolveOrigin('not a url', '')).toBe('');
  });
});

describe('宠物弹窗控制器', () => {
  function createController() {
    const entries = [];
    const controller = modal.createModalController({
      document,
      requestAnimationFrame: callback => callback(),
      registerListener(target, type, fn) {
        const entry = { target, type, fn };
        entries.push(entry);
        target.addEventListener(type, fn);
        return entry;
      },
      unregisterListener(entry) {
        entry.target.removeEventListener(entry.type, entry.fn);
        const index = entries.indexOf(entry);
        if (index >= 0) entries.splice(index, 1);
      },
    });
    return { controller, entries };
  }

  function createConfirmController() {
    const entries = [];
    const controller = modal.createConfirmController({
      document,
      requestAnimationFrame: callback => callback(),
      registerListener(target, type, fn) {
        const entry = { target, type, fn };
        entries.push(entry);
        target.addEventListener(type, fn);
        return entry;
      },
      unregisterListener(entry) {
        entry.target.removeEventListener(entry.type, entry.fn);
        const index = entries.indexOf(entry);
        if (index >= 0) entries.splice(index, 1);
      },
    });
    return { controller, entries };
  }

  it('设置无障碍语义、聚焦首个控件，并在 Esc 后恢复触发焦点', () => {
    document.body.innerHTML = '<button id="trigger">打开</button><div id="modal"><button id="close">关闭</button></div>';
    const trigger = document.querySelector('#trigger');
    const dialog = document.querySelector('#modal');
    const { controller, entries } = createController();
    trigger.focus();

    controller.open(dialog, { label: '宠物详情', style: 'display:flex' });
    expect(window.UJNGuidePetModal).toBe(modal);
    expect(dialog.getAttribute('role')).toBe('dialog');
    expect(dialog.getAttribute('aria-modal')).toBe('true');
    expect(dialog.getAttribute('aria-label')).toBe('宠物详情');
    expect(document.activeElement).toBe(document.querySelector('#close'));
    expect(entries).toHaveLength(1);

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    expect(dialog.style.display).toBe('none');
    expect(document.activeElement).toBe(trigger);
    expect(entries).toHaveLength(0);
  });

  it('重复打开时替换旧监听，手动关闭也会恢复焦点', () => {
    document.body.innerHTML = '<button id="trigger">打开</button><div id="modal"><button>关闭</button></div>';
    const trigger = document.querySelector('#trigger');
    const dialog = document.querySelector('#modal');
    const { controller, entries } = createController();
    trigger.focus();

    controller.open(dialog, { style: 'display:flex' });
    controller.open(dialog, { style: 'display:flex' });
    expect(entries).toHaveLength(1);
    controller.close(dialog);
    expect(dialog.style.display).toBe('none');
    expect(document.activeElement).toBe(trigger);
    expect(entries).toHaveLength(0);
  });

  it('关闭后的延迟聚焦不会夺回触发元素焦点', () => {
    document.body.innerHTML = '<button id="trigger">打开</button><div id="modal"><button>关闭</button></div>';
    const trigger = document.querySelector('#trigger');
    const dialog = document.querySelector('#modal');
    const callbacks = [];
    const controller = modal.createModalController({
      document,
      requestAnimationFrame: callback => callbacks.push(callback),
    });
    trigger.focus();

    controller.open(dialog, { style: 'display:flex' });
    controller.close(dialog);
    callbacks.forEach(callback => callback());
    expect(document.activeElement).toBe(trigger);
  });

  it('站内确认弹窗可取消、Esc 关闭并恢复触发焦点', async () => {
    document.body.innerHTML = '<button id="trigger">删除</button>';
    const trigger = document.querySelector('#trigger');
    const { controller, entries } = createConfirmController();
    trigger.focus();

    const dismissed = controller.confirm({
      title: '删除投稿？', message: '删除后可在七天内联系站长恢复。', confirmText: '删除投稿', variant: 'danger',
    });
    const dialog = document.querySelector('#pet-confirm-modal');
    const panel = dialog.querySelector('[role="alertdialog"]');
    const buttons = Array.from(dialog.querySelectorAll('button'));
    expect(panel.getAttribute('aria-modal')).toBe('true');
    expect(panel.textContent).toContain('删除投稿？');
    expect(buttons[0].style.minHeight).toBe('44px');
    expect(buttons[1].style.minHeight).toBe('44px');
    expect(document.activeElement).toBe(buttons[1]);
    expect(entries).toHaveLength(1);

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    await expect(dismissed).resolves.toBe(false);
    expect(dialog.style.display).toBe('none');
    expect(document.activeElement).toBe(trigger);
    expect(entries).toHaveLength(0);

    const accepted = controller.confirm({ title: '重新提交审核？', message: '提交后需等待审核。', confirmText: '重新提交' });
    dialog.querySelectorAll('button')[1].click();
    await expect(accepted).resolves.toBe(true);
    expect(document.activeElement).toBe(trigger);
  });
});
