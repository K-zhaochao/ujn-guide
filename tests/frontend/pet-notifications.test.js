import { createRequire } from 'node:module';
import { describe, expect, it, vi } from 'vitest';

const require = createRequire(import.meta.url);
const notifications = require('../../docs/pets/pet-notifications.js');

function setup(overrides = {}) {
  document.body.innerHTML = '<div id="pet-notification-pop" style="display:none"></div><button id="trigger">通知</button>';
  const api = vi.fn(async (path) => {
    if (path === '/api/my/notifications?page=1&pageSize=20') {
      return {
        ok: true,
        data: {
          total: 1, unreadCount: 1, page: 1, totalPages: 1,
          notifications: [{
            id: 9, eventType: 'liked', createdAt: '2026-08-14T10:00:00Z', readAt: '',
            submission: { id: 'pet_1', name: '小白' },
            actor: { username: 'alice', nickname: '阿狸', avatarUrl: '', profileUrl: 'https://github.com/alice' },
          }],
        },
      };
    }
    if (path === '/api/my/notifications/read') return { ok: true, data: { updated: 1, unreadCount: 0 } };
    return { ok: false, data: { message: '未模拟接口' } };
  });
  const onOpenSubmission = vi.fn();
  const onUnreadCountChange = vi.fn();
  const onLoginRequired = vi.fn();
  const controller = notifications.createPetNotifications({
    $: (selector, root) => (root || document).querySelector(selector),
    $all: (selector, root) => [...(root || document).querySelectorAll(selector)],
    document,
    C: { bg: '#fff', fg: '#333', fgDark: '#111', border: '#ddd', soft: '#eee', muted: '#777', faint: '#999', primary: '#06c', danger: '#d22', avatarBg: '#ddd' },
    esc: value => String(value == null ? '' : value).replace(/[&<>"]/g, ''),
    api,
    showToast: vi.fn(),
    onLoginRequired,
    onOpenSubmission,
    onUnreadCountChange,
    getUser: () => ({ username: 'owner' }),
    safeHttpUrl: value => /^https:\/\//.test(value || '') ? value : '',
    formatDateTime: () => '2026-08-14 18:00',
    PAGE_SIZE: 20,
    ...overrides,
  });
  return { api, controller, onOpenSubmission, onUnreadCountChange, onLoginRequired };
}

describe('宠物前端互动通知控制器', () => {
  it('打开通知：加载点赞事件、渲染主页链接并标记已读', async () => {
    const { api, controller, onUnreadCountChange } = setup();
    await controller.toggleNotifications(document.getElementById('trigger'));
    await new Promise(resolve => setTimeout(resolve, 0));
    const panel = document.getElementById('pet-notification-pop');
    expect(panel.textContent).toContain('阿狸');
    expect(panel.textContent).toContain('点赞了你的投稿');
    expect(panel.querySelector('a').href).toBe('https://github.com/alice');
    expect(api).toHaveBeenCalledWith('/api/my/notifications?page=1&pageSize=20');
    expect(api).toHaveBeenCalledWith('/api/my/notifications/read', { method: 'POST', body: { ids: [9] } });
    expect(controller.unreadCount()).toBe(0);
    expect(onUnreadCountChange).toHaveBeenCalled();
  });

  it('点击投稿名打开详情并收起通知面板', async () => {
    const { controller, onOpenSubmission } = setup();
    controller.toggleNotifications(document.getElementById('trigger'));
    await new Promise(resolve => setTimeout(resolve, 0));
    document.querySelector('.pet-notification-submission').click();
    expect(onOpenSubmission).toHaveBeenCalledWith('pet_1');
    expect(controller.isOpen()).toBe(false);
  });

  it('未登录：引导登录而不请求通知接口', async () => {
    const { api, controller, onLoginRequired } = setup({ getUser: () => null });
    controller.toggleNotifications(document.getElementById('trigger'));
    expect(api).not.toHaveBeenCalled();
    expect(onLoginRequired).toHaveBeenCalledOnce();
  });
});
