/*
 * 投稿详情的点赞列表控制器。
 * 只在打开弹窗后按页请求，使用请求序号忽略关闭或翻页后的过期响应。
 */
(function (root, factory) {
  const likeList = factory();
  if (typeof module === 'object' && module.exports) module.exports = likeList;
  if (root) root.UJNGuidePetLikeList = likeList;
}(typeof window !== 'undefined' ? window : globalThis, function () {
  'use strict';

  function createPetLikeList(deps) {
    const {
      document, $, $all, views, api, openPetModal, closePetModal,
      PAGE_SIZE = 20,
    } = deps || {};
    if (!document || typeof $ !== 'function' || typeof $all !== 'function' || typeof views !== 'function' ||
        typeof api !== 'function' || typeof openPetModal !== 'function' || typeof closePetModal !== 'function') {
      throw new TypeError('点赞列表控制器缺少依赖');
    }

    let submissionId = '';
    let page = 1;
    let total = 0;
    let totalPages = 1;
    let likes = [];
    let status = 'idle';
    let message = '';
    let requestId = 0;

    function modal() { return $('#pet-like-list-modal'); }

    function reset() {
      requestId += 1;
      submissionId = '';
      page = 1;
      total = 0;
      totalPages = 1;
      likes = [];
      status = 'idle';
      message = '';
    }

    function render() {
      const root = modal();
      if (!root) return;
      root.innerHTML = views().likeListModalHtml({ likes, total, page, totalPages, status, message });
      const close = $('#pet-like-list-close');
      if (close) close.onclick = () => closeLikeList();
      const retry = $('#pet-like-list-retry');
      if (retry) retry.onclick = () => { void loadLikeList(); };
      $all('.pet-like-list-page-btn', root).forEach(button => {
        button.onclick = () => {
          if (button.disabled || status === 'loading') return;
          const next = Number(button.dataset.page);
          if (!Number.isInteger(next) || next < 1 || next > totalPages || next === page) return;
          page = next;
          void loadLikeList();
        };
      });
      root.onclick = event => {
        if (event.target === root) closeLikeList();
      };
      $all('img[data-like-avatar]', root).forEach(image => {
        image.onerror = () => {
          image.style.display = 'none';
          const fallback = image.parentElement && image.parentElement.querySelector('[data-like-avatar-fallback]');
          if (fallback) fallback.hidden = false;
        };
      });
    }

    async function loadLikeList() {
      const root = modal();
      if (!root || !submissionId) return;
      const requestedSubmissionId = submissionId;
      const currentRequestId = ++requestId;
      status = 'loading';
      message = '';
      render();
      const query = new URLSearchParams({ page: String(page), pageSize: String(PAGE_SIZE) });
      const result = await api('/api/pets/' + encodeURIComponent(requestedSubmissionId) + '/likes?' + query.toString());
      if (currentRequestId !== requestId || requestedSubmissionId !== submissionId || root.style.display === 'none') return;
      if (!result.ok) {
        status = 'error';
        message = (result.data && result.data.message) || '点赞列表加载失败，请稍后重试';
        render();
        return;
      }
      const data = result.data || {};
      total = Math.max(0, Number(data.total) || 0);
      totalPages = Math.max(1, Number(data.totalPages) || Math.ceil(total / PAGE_SIZE) || 1);
      if (page > totalPages && total > 0) {
        page = totalPages;
        return loadLikeList();
      }
      page = Math.max(1, Number(data.page) || page);
      likes = Array.isArray(data.likes) ? data.likes : [];
      status = 'ready';
      render();
    }

    function openLikeList(id) {
      const value = String(id || '').trim();
      if (!value) return;
      const root = modal();
      if (!root) return;
      submissionId = value;
      page = 1;
      total = 0;
      totalPages = 1;
      likes = [];
      status = 'loading';
      message = '';
      openPetModal(root, {
        label: '点赞列表',
        zIndex: 16000,
        onClose: reset,
      });
      render();
      return loadLikeList();
    }

    function closeLikeList(options = {}) {
      const root = modal();
      if (!root || root.style.display === 'none') return;
      closePetModal(root, options);
    }

    return { closeLikeList, loadLikeList, openLikeList };
  }

  return { createPetLikeList };
}));
