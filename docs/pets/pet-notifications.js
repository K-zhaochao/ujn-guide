/*
 * 宠物页通知控制器。
 * 统一展示互动通知和站长通知；站长通知只有在内容卡片中显式点击“已读”后才解除置顶。
 */
(function (root, factory) {
  const notifications = factory();
  if (typeof module === 'object' && module.exports) module.exports = notifications;
  if (root) root.UJNGuidePetNotifications = notifications;
}(typeof window !== 'undefined' ? window : globalThis, function () {
  'use strict';

  function createPetNotifications(deps) {
    const { $, $all, document, C, esc, api, showToast, onLoginRequired, onOpenSubmission, onUnreadCountChange, getUser, safeHttpUrl, formatDateTime, PAGE_SIZE = 20, picker = null } = deps;
    let notifications = [];
    let page = 1;
    let total = 0;
    let totalPages = 1;
    let unreadCount = 0;
    let dateStart = '';
    let dateEnd = '';
    let requestId = 0;
    let refreshTimer = null;

    function panel() { return $('#pet-notification-pop'); }
    function displayName(actor) { return actor && (actor.nickname || actor.username) || '已注销用户'; }
    function safeProfileUrl(actor) { return safeHttpUrl && actor ? safeHttpUrl(actor.profileUrl) : ''; }
    function notifyUnreadChange() { if (typeof onUnreadCountChange === 'function') onUnreadCountChange(unreadCount); }
    function isSite(item) { return item && item.kind === 'site'; }
    function queryString() {
      const query = new URLSearchParams({ page: String(page), pageSize: String(PAGE_SIZE) });
      if (dateStart) query.set('start', dateStart);
      if (dateEnd) query.set('end', dateEnd);
      return query.toString();
    }

    function interactionHtml(item) {
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
          (actor && actor.avatarUrl ? '<img src="' + esc(actor.avatarUrl) + '" alt="" style="width:28px;height:28px;border-radius:50%;object-fit:cover;flex:none">' : '<span aria-hidden="true" style="width:28px;height:28px;border-radius:50%;background:' + C.avatarBg + ';display:inline-flex;align-items:center;justify-content:center;flex:none">🐾</span>') +
          '<div style="min-width:0;flex:1;font-size:13px;line-height:1.55;color:' + C.fg + '">' +
            '<div>' + actorHtml + ' <span style="color:' + tone + '">' + action + '</span></div>' +
            '<button type="button" class="pet-notification-submission" data-submission="' + esc(submission.id || '') + '" style="padding:0;margin:2px 0 0;background:none;border:none;border-bottom:1px solid ' + C.border + ';color:' + C.fgDark + ';font-size:12px;cursor:pointer;text-align:left;max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + esc(submission.name || '未命名宠物') + '</button>' +
            '<div style="display:flex;align-items:center;gap:8px;margin-top:2px"><span style="font-size:11px;color:' + C.faint + '">' + esc(formatDateTime(item.createdAt)) + '</span>' +
              (!item.readAt ? '<button type="button" class="pet-notification-read" data-notification-id="' + esc(item.id) + '" style="margin-left:auto;padding:2px 0;border:0;background:none;color:' + C.primary + ';font-size:11px;cursor:pointer">标为已读</button>' : '') +
            '</div>' +
          '</div>' +
        '</div>' +
      '</div>';
    }

    function siteHtml(item) {
      const state = item.readAt ? '已读' : '置顶';
      return '<button type="button" class="pet-site-notification" data-notification-detail="' + esc(item.id) + '" style="display:block;width:100%;padding:12px;border:0;border-bottom:1px solid ' + C.border + ';background:' + (item.readAt ? 'transparent' : C.soft) + ';color:' + C.fg + ';text-align:left;cursor:pointer">' +
        '<div style="display:flex;align-items:center;gap:8px"><span aria-hidden="true" style="display:inline-flex;width:26px;height:26px;align-items:center;justify-content:center;border-radius:7px;background:' + C.primary + ';color:#fff;font-size:13px;flex:none">🔔</span>' +
          '<strong style="min-width:0;flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:13px;color:' + C.fgDark + '">' + esc(item.title || '站长通知') + '</strong>' +
          '<span style="padding:1px 6px;border-radius:999px;background:' + (item.readAt ? C.soft : C.primary) + ';color:' + (item.readAt ? C.muted : '#fff') + ';font-size:10px;white-space:nowrap">' + state + '</span></div>' +
        '<div style="margin:7px 0 0 34px;color:' + C.muted + ';font-size:12px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">' + esc(String(item.body || '').replace(/\s+/g, ' ')) + '</div>' +
        '<div style="margin:4px 0 0 34px;color:' + C.faint + ';font-size:11px">' + esc(formatDateTime(item.createdAt)) + '</div>' +
      '</button>';
    }

    function renderPanel() {
      const pop = panel();
      if (!pop) return;
      const body = notifications.length
        ? notifications.map(item => isSite(item) ? siteHtml(item) : interactionHtml(item)).join('')
        : '<p style="margin:0;padding:28px 12px;text-align:center;color:' + C.muted + ';font-size:13px">暂无通知</p>';
      const pager = totalPages > 1
        ? '<div style="display:flex;align-items:center;justify-content:space-between;gap:8px;padding:9px 12px;border-top:1px solid ' + C.border + '"><button type="button" data-notification-page="' + (page - 1) + '"' + (page <= 1 ? ' disabled' : '') + ' style="padding:5px 8px;background:' + C.soft + ';border:1px solid ' + C.border + ';border-radius:6px;color:' + C.fg + ';font-size:12px;cursor:pointer">上一页</button><span style="font-size:11px;color:' + C.muted + '">' + page + ' / ' + totalPages + '</span><button type="button" data-notification-page="' + (page + 1) + '"' + (page >= totalPages ? ' disabled' : '') + ' style="padding:5px 8px;background:' + C.soft + ';border:1px solid ' + C.border + ';border-radius:6px;color:' + C.fg + ';font-size:12px;cursor:pointer">下一页</button></div>'
        : '';
      pop.innerHTML = '<div class="pet-notification-panel" style="background:' + C.bg + ';border:1px solid ' + C.border + ';border-radius:8px;box-shadow:0 12px 30px rgba(0,0,0,.16);width:min(390px,calc(100vw - 16px));max-height:min(560px,calc(100vh - 96px));overflow:auto">' +
        '<div style="display:flex;align-items:center;gap:8px;padding:11px 12px;border-bottom:1px solid ' + C.border + '"><strong style="font-size:14px;color:' + C.fgDark + '">通知</strong><span style="font-size:11px;color:' + C.muted + '">' + total + ' 条</span><button type="button" id="pet-notification-close" title="关闭通知" aria-label="关闭通知" style="margin-left:auto;width:28px;height:28px;background:none;border:none;color:' + C.muted + ';font-size:18px;cursor:pointer">×</button></div>' +
        '<div id="pet-notification-filters" style="display:flex;align-items:end;gap:8px;flex-wrap:wrap;padding:10px 12px;border-bottom:1px solid ' + C.border + '"><div class="pet-notification-date-range"><label for="pet-notification-start">起始日期<input id="pet-notification-start" class="pet-date" type="date" aria-label="通知起始日期" value="' + esc(dateStart) + '"></label><label for="pet-notification-end">结束日期<input id="pet-notification-end" class="pet-date" type="date" aria-label="通知结束日期" value="' + esc(dateEnd) + '"></label></div><button type="button" id="pet-notification-reset" title="重置通知日期筛选">↺ 重置</button></div>' +
        '<div>' + body + '</div>' + pager +
        '</div>';
      bindPanelEvents(pop);
    }

    function bindPanelEvents(pop) {
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
      const start = $('#pet-notification-start', pop);
      const end = $('#pet-notification-end', pop);
      if (start) start.onchange = () => { dateStart = start.value; if (dateStart && dateEnd && dateStart > dateEnd) dateEnd = dateStart; page = 1; loadNotifications(); };
      if (end) end.onchange = () => { dateEnd = end.value; if (dateStart && dateEnd && dateEnd < dateStart) dateStart = dateEnd; page = 1; loadNotifications(); };
      const reset = $('#pet-notification-reset', pop);
      if (reset) reset.onclick = () => { dateStart = ''; dateEnd = ''; page = 1; loadNotifications(); };
      if (picker && typeof picker.attachDate === 'function') {
        if (start) picker.attachDate(start);
        if (end) picker.attachDate(end);
      }
      $all('.pet-notification-submission', pop).forEach(button => {
        button.onclick = () => {
          if (!button.dataset.submission) return;
          closeNotifications();
          onOpenSubmission(button.dataset.submission);
        };
      });
      $all('.pet-notification-read', pop).forEach(button => { button.onclick = () => markRead(button.dataset.notificationId); });
      $all('[data-notification-detail]', pop).forEach(button => {
        button.onclick = () => {
          const item = notifications.find(notification => notification.id === button.dataset.notificationDetail);
          if (item) openSiteNotification(item);
        };
      });
    }

    function closeDetailCard() {
      const card = $('#pet-notification-detail-card');
      if (card && card.parentNode) card.parentNode.removeChild(card);
    }

    function openSiteNotification(item) {
      closeDetailCard();
      const card = document.createElement('div');
      card.id = 'pet-notification-detail-card';
      card.setAttribute('role', 'dialog');
      card.setAttribute('aria-modal', 'true');
      card.setAttribute('aria-label', '站长通知内容');
      card.style.cssText = 'position:fixed;z-index:17000;left:50%;top:50%;transform:translate(-50%,-50%);width:min(360px,calc(100vw - 32px));max-height:calc(100vh - 48px);overflow:auto;background:' + C.bg + ';border:1px solid ' + C.border + ';border-radius:10px;box-shadow:0 18px 42px rgba(0,0,0,.28);padding:18px;box-sizing:border-box;color:' + C.fg + ';';
      card.innerHTML = '<div style="display:flex;align-items:start;gap:10px"><strong style="min-width:0;flex:1;font-size:16px;line-height:1.45;color:' + C.fgDark + '">' + esc(item.title || '站长通知') + '</strong><button type="button" data-notification-detail-close title="关闭" aria-label="关闭" style="width:28px;height:28px;border:0;background:none;color:' + C.muted + ';font-size:19px;cursor:pointer">×</button></div><div style="margin-top:13px;white-space:pre-wrap;word-break:break-word;line-height:1.7;font-size:14px">' + esc(item.body || '') + '</div><div style="margin-top:14px;color:' + C.faint + ';font-size:11px">' + esc(formatDateTime(item.createdAt)) + '</div><div style="display:flex;justify-content:flex-end;gap:8px;margin-top:18px"><button type="button" data-notification-detail-close style="padding:7px 10px;border:1px solid ' + C.border + ';border-radius:7px;background:' + C.soft + ';color:' + C.fg + ';cursor:pointer">关闭</button>' + (!item.readAt ? '<button type="button" data-notification-detail-read="' + esc(item.id) + '" style="padding:7px 12px;border:1px solid ' + C.primary + ';border-radius:7px;background:' + C.primary + ';color:#fff;cursor:pointer;font-weight:700">已读</button>' : '') + '</div>';
      document.body.appendChild(card);
      $all('[data-notification-detail-close]', card).forEach(button => { button.onclick = closeDetailCard; });
      const read = $('[data-notification-detail-read]', card);
      if (read) read.onclick = () => markRead(read.dataset.notificationDetailRead, { closeDetail: true });
    }

    async function markRead(id, options = {}) {
      if (!id) return;
      const result = await api('/api/my/notifications/read', { method: 'POST', body: { ids: [id] } });
      if (!result.ok) { showToast((result.data && result.data.message) || '标记已读失败', true); return; }
      notifications = notifications.map(item => item.id === id ? { ...item, readAt: new Date().toISOString(), pinned: false } : item);
      unreadCount = Math.max(0, Number(result.data && result.data.unreadCount) || 0);
      notifyUnreadChange();
      if (options.closeDetail) closeDetailCard();
      renderPanel();
    }

    async function loadNotifications(options = {}) {
      if (!getUser()) return;
      const pop = panel();
      if (!pop) return;
      const currentRequestId = ++requestId;
      if (!options.silent) pop.innerHTML = '<div style="background:' + C.bg + ';border:1px solid ' + C.border + ';border-radius:8px;box-shadow:0 12px 30px rgba(0,0,0,.16);width:min(390px,calc(100vw - 16px));padding:24px 12px;text-align:center;color:' + C.muted + ';font-size:13px">正在加载通知…</div>';
      const result = await api('/api/my/notifications?' + queryString());
      if (currentRequestId !== requestId || !panel() || !isOpen()) return;
      if (!result.ok) {
        pop.innerHTML = '<div style="background:' + C.bg + ';border:1px solid ' + C.border + ';border-radius:8px;box-shadow:0 12px 30px rgba(0,0,0,.16);width:min(390px,calc(100vw - 16px));padding:24px 12px;text-align:center;color:' + C.danger + ';font-size:13px">' + esc((result.data && result.data.message) || '通知加载失败') + '</div>';
        return;
      }
      const data = result.data || {};
      notifications = Array.isArray(data.notifications) ? data.notifications : [];
      total = Math.max(0, Number(data.total) || 0);
      totalPages = Math.max(1, Number(data.totalPages) || Math.ceil(total / PAGE_SIZE) || 1);
      page = Math.max(1, Math.min(totalPages, Number(data.page) || page));
      unreadCount = Math.max(0, Number(data.unreadCount) || 0);
      renderPanel();
      notifyUnreadChange();
    }

    async function refreshUnreadCount() {
      if (!getUser()) { unreadCount = 0; notifyUnreadChange(); return; }
      const result = await api('/api/my/notifications?page=1&pageSize=1');
      if (!result.ok || !result.data) return;
      unreadCount = Math.max(0, Number(result.data.unreadCount) || 0);
      notifyUnreadChange();
    }

    function stopRefresh() { if (refreshTimer) { clearTimeout(refreshTimer); refreshTimer = null; } }
    function scheduleRefresh() {
      stopRefresh();
      refreshTimer = setTimeout(async () => {
        if (isOpen()) { await loadNotifications({ silent: true }); scheduleRefresh(); }
      }, 30000);
      // Node/JSDOM 测试环境不应因浏览器侧刷新计时器而延长进程生命周期。
      if (refreshTimer && typeof refreshTimer.unref === 'function') refreshTimer.unref();
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
      pop.style.left = Math.max(8, Math.min(rect.right - 390, window.innerWidth - 398)) + 'px';
      pop.setAttribute('role', 'dialog');
      pop.setAttribute('aria-label', '通知');
      loadNotifications().then(scheduleRefresh);
    }

    function closeNotifications() { closeDetailCard(); stopRefresh(); const pop = panel(); if (pop) pop.style.display = 'none'; }
    function toggleNotifications(anchor) { const pop = panel(); if (pop && pop.style.display !== 'none') closeNotifications(); else openNotifications(anchor); }
    function isOpen() { const pop = panel(); return !!pop && pop.style.display !== 'none'; }

    if (typeof window !== 'undefined' && window.addEventListener) {
      window.addEventListener('focus', () => { if (isOpen()) loadNotifications({ silent: true }); });
    }

    return { closeNotifications, isOpen, loadNotifications, refreshUnreadCount, toggleNotifications, unreadCount: () => unreadCount };
  }

  return { createPetNotifications };
}));
