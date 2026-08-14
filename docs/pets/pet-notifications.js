/*
 * 宠物投稿点赞通知控制器。
 * 通知与“我的投稿”分离：前者只展示互动事件，后者只展示投稿生命周期。
 */
(function (root, factory) {
  const notifications = factory();
  if (typeof module === 'object' && module.exports) module.exports = notifications;
  if (root) root.UJNGuidePetNotifications = notifications;
}(typeof window !== 'undefined' ? window : globalThis, function () {
  'use strict';

  function createPetNotifications(deps) {
    const { $, $all, document, C, esc, api, showToast, onLoginRequired, onOpenSubmission, onUnreadCountChange, getUser, safeHttpUrl, formatDateTime, PAGE_SIZE = 20 } = deps;
    let notifications = [];
    let page = 1;
    let total = 0;
    let totalPages = 1;
    let unreadCount = 0;
    let requestId = 0;

    function panel() { return $('#pet-notification-pop'); }
    function displayName(actor) {
      return actor && (actor.nickname || actor.username) || '已注销用户';
    }
    function safeProfileUrl(actor) {
      return safeHttpUrl && actor ? safeHttpUrl(actor.profileUrl) : '';
    }
    function notifyUnreadChange() {
      if (typeof onUnreadCountChange === 'function') onUnreadCountChange(unreadCount);
    }

    function notificationHtml(item) {
      const actor = item.actor;
      const actorName = esc(displayName(actor));
      const profileUrl = safeProfileUrl(actor);
      const actorHtml = profileUrl
        ? '<a href="' + esc(profileUrl) + '" target="_blank" rel="noopener noreferrer" style="color:' + C.primary + ';font-weight:700;text-decoration:none">' + actorName + '</a>'
        : '<span style="font-weight:700;color:' + C.fgDark + '">' + actorName + '</span>';
      const action = item.eventType === 'unliked' ? '取消了对你的点赞' : '点赞了你的投稿';
      const tone = item.eventType === 'unliked' ? C.muted : C.fg;
      const submission = item.submission || {};
      return '<div class="pet-notification-item" style="padding:11px 12px;border-bottom:1px solid ' + C.border + ';background:' + (item.readAt ? 'transparent' : C.soft) + '">' +
        '<div style="display:flex;align-items:flex-start;gap:8px">' +
          (actor && actor.avatarUrl ? '<img src="' + esc(actor.avatarUrl) + '" alt="" style="width:28px;height:28px;border-radius:50%;object-fit:cover;flex:none">' : '<span style="width:28px;height:28px;border-radius:50%;background:' + C.avatarBg + ';display:inline-flex;align-items:center;justify-content:center;flex:none">🐾</span>') +
          '<div style="min-width:0;flex:1;font-size:13px;line-height:1.55;color:' + C.fg + '">' +
            '<div>' + actorHtml + ' <span style="color:' + tone + '">' + action + '</span></div>' +
            '<button type="button" class="pet-notification-submission" data-submission="' + esc(submission.id || '') + '" style="padding:0;margin:2px 0 0;background:none;border:none;border-bottom:1px solid ' + C.border + ';color:' + C.fgDark + ';font-size:12px;cursor:pointer;text-align:left;max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + esc(submission.name || '未命名宠物') + '</button>' +
            '<div style="font-size:11px;color:' + C.faint + ';margin-top:2px">' + esc(formatDateTime(item.createdAt)) + '</div>' +
          '</div>' +
        '</div>' +
      '</div>';
    }

    function renderPanel() {
      const pop = panel();
      if (!pop) return;
      const body = notifications.length
        ? notifications.map(notificationHtml).join('')
        : '<p style="margin:0;padding:28px 12px;text-align:center;color:' + C.muted + ';font-size:13px">暂无互动通知</p>';
      const pager = totalPages > 1
        ? '<div style="display:flex;align-items:center;justify-content:space-between;gap:8px;padding:9px 12px;border-top:1px solid ' + C.border + '">' +
            '<button type="button" data-notification-page="' + (page - 1) + '"' + (page <= 1 ? ' disabled' : '') + ' style="padding:5px 8px;background:' + C.soft + ';border:1px solid ' + C.border + ';border-radius:6px;color:' + C.fg + ';font-size:12px;cursor:pointer">上一页</button>' +
            '<span style="font-size:11px;color:' + C.muted + '">' + page + ' / ' + totalPages + '</span>' +
            '<button type="button" data-notification-page="' + (page + 1) + '"' + (page >= totalPages ? ' disabled' : '') + ' style="padding:5px 8px;background:' + C.soft + ';border:1px solid ' + C.border + ';border-radius:6px;color:' + C.fg + ';font-size:12px;cursor:pointer">下一页</button>' +
          '</div>'
        : '';
      pop.innerHTML = '<div style="background:' + C.bg + ';border:1px solid ' + C.border + ';border-radius:8px;box-shadow:0 12px 30px rgba(0,0,0,.16);width:min(360px,calc(100vw - 16px));max-height:min(520px,calc(100vh - 96px));overflow:auto">' +
        '<div style="display:flex;align-items:center;gap:8px;padding:11px 12px;border-bottom:1px solid ' + C.border + '"><strong style="font-size:14px;color:' + C.fgDark + '">互动通知</strong><span style="font-size:11px;color:' + C.muted + '">' + total + ' 条</span><button type="button" id="pet-notification-close" title="关闭通知" aria-label="关闭通知" style="margin-left:auto;width:28px;height:28px;background:none;border:none;color:' + C.muted + ';font-size:18px;cursor:pointer">×</button></div>' +
        '<div>' + body + '</div>' + pager +
        '</div>';
      const close = $('#pet-notification-close', pop);
      if (close) close.onclick = closeNotifications;
      $all('[data-notification-page]', pop).forEach(button => {
        button.onclick = () => {
          const next = Number(button.dataset.notificationPage);
          if (button.disabled || !Number.isInteger(next) || next < 1 || next > totalPages || next === page) return;
          page = next;
          loadNotifications();
        };
      });
      $all('.pet-notification-submission', pop).forEach(button => {
        button.onclick = () => {
          if (!button.dataset.submission) return;
          closeNotifications();
          onOpenSubmission(button.dataset.submission);
        };
      });
    }

    async function markDisplayedRead(items) {
      const ids = items.filter(item => !item.readAt).map(item => item.id);
      if (!ids.length) return;
      notifications = notifications.map(item => ids.includes(item.id) ? { ...item, readAt: new Date().toISOString() } : item);
      const result = await api('/api/my/notifications/read', { method: 'POST', body: { ids } });
      if (result.ok && result.data) {
        unreadCount = Math.max(0, Number(result.data.unreadCount) || 0);
        notifyUnreadChange();
      }
    }

    async function loadNotifications() {
      if (!getUser()) return;
      const pop = panel();
      if (!pop) return;
      const currentRequestId = ++requestId;
      pop.innerHTML = '<div style="background:' + C.bg + ';border:1px solid ' + C.border + ';border-radius:8px;box-shadow:0 12px 30px rgba(0,0,0,.16);width:min(360px,calc(100vw - 16px));padding:24px 12px;text-align:center;color:' + C.muted + ';font-size:13px">正在加载通知…</div>';
      const result = await api('/api/my/notifications?page=' + page + '&pageSize=' + PAGE_SIZE);
      if (currentRequestId !== requestId || !panel()) return;
      if (!result.ok) {
        pop.innerHTML = '<div style="background:' + C.bg + ';border:1px solid ' + C.border + ';border-radius:8px;box-shadow:0 12px 30px rgba(0,0,0,.16);width:min(360px,calc(100vw - 16px));padding:24px 12px;text-align:center;color:' + C.danger + ';font-size:13px">' + esc((result.data && result.data.message) || '通知加载失败') + '</div>';
        return;
      }
      const data = result.data || {};
      notifications = Array.isArray(data.notifications) ? data.notifications : [];
      total = Math.max(0, Number(data.total) || 0);
      totalPages = Math.max(1, Number(data.totalPages) || Math.ceil(total / PAGE_SIZE) || 1);
      page = Math.max(1, Math.min(totalPages, Number(data.page) || page));
      unreadCount = Math.max(0, Number(data.unreadCount) || 0);
      await markDisplayedRead(notifications);
      if (currentRequestId !== requestId || !panel()) return;
      renderPanel();
      notifyUnreadChange();
    }

    async function refreshUnreadCount() {
      if (!getUser()) {
        unreadCount = 0;
        notifyUnreadChange();
        return;
      }
      const result = await api('/api/my/notifications?page=1&pageSize=1');
      if (!result.ok || !result.data) return;
      unreadCount = Math.max(0, Number(result.data.unreadCount) || 0);
      notifyUnreadChange();
    }

    function openNotifications(anchor) {
      if (!getUser()) {
        showToast('请先登录后查看通知', true);
        onLoginRequired();
        return;
      }
      const pop = panel();
      if (!pop || !anchor) return;
      const rect = anchor.getBoundingClientRect();
      pop.style.display = 'block';
      pop.style.position = 'fixed';
      pop.style.zIndex = '16000';
      pop.style.top = (rect.bottom + 8) + 'px';
      pop.style.left = Math.max(8, Math.min(rect.right - 360, window.innerWidth - 368)) + 'px';
      pop.setAttribute('role', 'dialog');
      pop.setAttribute('aria-label', '互动通知');
      loadNotifications();
    }

    function closeNotifications() {
      const pop = panel();
      if (pop) pop.style.display = 'none';
    }

    function toggleNotifications(anchor) {
      const pop = panel();
      if (pop && pop.style.display !== 'none') closeNotifications();
      else openNotifications(anchor);
    }

    function isOpen() {
      const pop = panel();
      return !!pop && pop.style.display !== 'none';
    }

    return { closeNotifications, isOpen, loadNotifications, refreshUnreadCount, toggleNotifications, unreadCount: () => unreadCount };
  }

  return { createPetNotifications };
}));
