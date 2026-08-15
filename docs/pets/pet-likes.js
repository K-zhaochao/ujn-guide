/*
 * 宠物前端“我的收藏”交互控制器。
 * 已登录用户可按点赞时间查看仍公开的收藏；详情中取消点赞会即时移除卡片。
 */
(function (root, factory) {
  const likes = factory();
  if (typeof module === 'object' && module.exports) module.exports = likes;
  if (root) root.UJNGuidePetLikes = likes;
}(typeof window !== 'undefined' ? window : globalThis, function () {
  'use strict';

  function createPetLikes(deps) {
    const { $, $all, C, esc, views, api, showToast, onLoginRequired, onOpenDetail, getUser, PAGE_SIZE = 12 } = deps;
    let pets = [];
    let page = 1;
    let total = 0;
    let totalPages = 1;
    let requestId = 0;

    // 每页数量响应式：手机（<768px）6 个/页，电脑 12 个/页；测试可注入 PAGE_SIZE 覆盖桌面值
    function currentLikedPageSize() {
      const mobile = typeof window !== 'undefined' && window.innerWidth < 768;
      return mobile ? 6 : PAGE_SIZE;
    }

    function section() { return $('#pet-liked-section'); }

    function renderShell() {
      const sec = section();
      if (!sec || sec.dataset.likedShell === '1') return;
      sec.dataset.likedShell = '1';
      sec.innerHTML =
        '<div class="pet-liked-shell">' +
          '<p id="pet-liked-count" aria-live="polite"></p>' +
          '<div id="pet-liked-list"></div>' +
        '</div>';
    }

    function renderLikedPets() {
      const list = $('#pet-liked-list');
      const count = $('#pet-liked-count');
      if (!list) return;
      if (count) count.textContent = total ? '共 ' + total + ' 只' : '';
      list.innerHTML = views().likedPetsHtml({ pets, currentPage: page, totalPages, totalCount: total });
      $all('.pet-liked-page-btn', list).forEach(button => {
        button.onclick = () => {
          if (button.disabled) return;
          const nextPage = Number(button.dataset.page);
          if (!Number.isInteger(nextPage) || nextPage < 1 || nextPage > totalPages || nextPage === page) return;
          page = nextPage;
          void loadLikedPets().then(() => {
            // 滚动到我的收藏列表顶部（第一个作品位置），而不是页面最顶部
            const listEl = $('#pet-liked-list');
            if (listEl && typeof listEl.scrollIntoView === 'function') {
              listEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
          });
        };
      });
      $all('.pet-card', list).forEach(card => {
        card.onclick = () => onOpenDetail(card.dataset.id);
        card.onkeydown = event => {
          if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); onOpenDetail(card.dataset.id); }
        };
      });
    }

    async function loadLikedPets() {
      if (!getUser()) return;
      const sec = section();
      if (!sec) return;
      renderShell();
      const list = $('#pet-liked-list');
      const currentRequestId = ++requestId;
      if (list && !list.innerHTML) list.innerHTML = '<p style="color:' + C.muted + ';text-align:center;padding:24px">正在加载收藏…</p>';
      const query = new URLSearchParams({ page: String(page), pageSize: String(currentLikedPageSize()) });
      const result = await api('/api/my/liked-pets?' + query.toString());
      if (currentRequestId !== requestId || !list) return;
      if (!result.ok) {
        list.innerHTML = '<p style="color:' + C.danger + ';text-align:center;padding:24px">⚠️ ' + esc(result.data.message || '加载失败') + '</p>';
        return;
      }
      const data = result.data || {};
      pets = Array.isArray(data.pets) ? data.pets : [];
      total = Math.max(0, Number(data.total) || 0);
      totalPages = Math.max(1, Number(data.totalPages) || Math.ceil(total / currentLikedPageSize()) || 1);
      if (page > totalPages && total > 0) {
        page = totalPages;
        return loadLikedPets();
      }
      page = Math.max(1, Number(data.page) || page);
      renderLikedPets();
    }

    async function openLikedSection(options = {}) {
      if (!getUser()) { showToast('请先登录后查看收藏', true); onLoginRequired(); return; }
      const sec = section();
      if (!sec) return;
      sec.hidden = false;
      sec.style.display = 'block';
      renderShell();
      await loadLikedPets();
      if (options.scroll !== false && typeof sec.scrollIntoView === 'function') {
        sec.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }

    function closeLikedSection() {
      const sec = section();
      if (sec) sec.style.display = 'none';
    }

    function removeLikedPet(id) {
      const sec = section();
      if (!sec || sec.style.display === 'none' || !pets.some(pet => pet.id === id)) return;
      pets = pets.filter(pet => pet.id !== id);
      total = Math.max(0, total - 1);
      totalPages = Math.max(1, Math.ceil(total / currentLikedPageSize()));
      if (page > totalPages) page = totalPages;
      renderLikedPets();
      // 补齐分页留下的位置，并确认下一页边界。
      loadLikedPets();
    }

    return { closeLikedSection, loadLikedPets, openLikedSection, removeLikedPet, renderLikedPets, renderShell };
  }

  return { createPetLikes };
}));
