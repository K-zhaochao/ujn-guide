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
    const { $, $all, C, esc, views, api, showToast, onLoginRequired, onOpenDetail, getUser, PAGE_SIZE = 12, picker = null } = deps;
    let pets = [];
    let page = 1;
    let total = 0;
    let totalPages = 1;
    let requestId = 0;
    let likedQuery = '';
    let likedDate = '';
    let likedDateEnd = '';
    // 每页数量（用户可经分页条下拉调整）：初始手机（<768px）6 个/页，电脑 PAGE_SIZE 个/页
    let likedPageSize = (typeof window !== 'undefined' && window.innerWidth < 768) ? 6 : PAGE_SIZE;

    function currentLikedPageSize() { return likedPageSize; }

    function section() { return $('#pet-liked-section'); }

    function renderShell() {
      const sec = section();
      if (!sec || sec.dataset.likedShell === '1') return;
      sec.dataset.likedShell = '1';
      sec.innerHTML =
        '<div class="pet-liked-shell">' +
          '<div id="pet-liked-filters" style="display:flex;align-items:end;gap:8px;flex-wrap:wrap;margin-bottom:12px">' +
            '<input id="pet-liked-search" type="search" enterkeyhint="search" placeholder="🔎 搜索名称、地点、描述或 ID，回车或失焦后生效" aria-label="搜索我的收藏" style="flex:1;min-width:190px;padding:9px 11px;border:1px solid ' + C.border + ';border-radius:8px;background:' + C.inputBg + ';color:inherit;font-size:13px;outline:none">' +
            '<div class="pet-liked-date-range"><label for="pet-liked-date">收藏起始日期<input id="pet-liked-date" class="pet-date" type="date" aria-label="收藏起始日期" style="padding:8px 9px;border:1px solid ' + C.border + ';border-radius:8px;background:' + C.inputBg + ';color:inherit;font-size:13px"></label><label for="pet-liked-date-end">收藏结束日期<input id="pet-liked-date-end" class="pet-date" type="date" aria-label="收藏结束日期" style="padding:8px 9px;border:1px solid ' + C.border + ';border-radius:8px;background:' + C.inputBg + ';color:inherit;font-size:13px"></label></div>' +
            '<button id="pet-liked-reset" title="一键重置所有筛选" style="padding:8px 12px;background:' + C.soft + ';border:1px solid ' + C.border + ';border-radius:8px;color:' + C.fg + ';font-size:13px;cursor:pointer">↺ 重置</button>' +
          '</div>' +
          '<p id="pet-liked-count" aria-live="polite"></p>' +
          '<div id="pet-liked-list"></div>' +
        '</div>';

      const search = $('#pet-liked-search');
      let lastAppliedQuery = likedQuery;
      const applyLikedQuery = () => {
        const value = search.value.trim();
        if (value === lastAppliedQuery) return;
        lastAppliedQuery = value;
        likedQuery = value;
        page = 1;
        void loadLikedPets();
      };
      search.onkeydown = event => {
        if (event.key === 'Enter') {
          event.preventDefault();
          applyLikedQuery();
          search.blur();
        }
      };
      search.onfocusout = applyLikedQuery;
      search.onsearch = applyLikedQuery;
      search.addEventListener('search', applyLikedQuery);
      $('#pet-liked-date').onchange = event => {
        likedDate = event.target.value;
        page = 1;
        void loadLikedPets();
      };
      $('#pet-liked-date-end').onchange = event => {
        likedDateEnd = event.target.value;
        if (likedDate && likedDateEnd && likedDateEnd < likedDate) {
          likedDate = likedDateEnd;
          $('#pet-liked-date').value = likedDate;
        }
        page = 1;
        void loadLikedPets();
      };
      $('#pet-liked-reset').onclick = () => {
        likedQuery = ''; likedDate = ''; likedDateEnd = ''; page = 1;
        lastAppliedQuery = '';
        $('#pet-liked-search').value = '';
        $('#pet-liked-date').value = '';
        $('#pet-liked-date-end').value = '';
        void loadLikedPets();
      };
      if (picker && typeof picker.attachDate === 'function') {
        picker.attachDate($('#pet-liked-date'));
        picker.attachDate($('#pet-liked-date-end'));
      }
    }

    function renderLikedPets() {
      const list = $('#pet-liked-list');
      const count = $('#pet-liked-count');
      if (!list) return;
      if (count) count.textContent = total ? '共 ' + total + ' 只' : '';
      list.innerHTML = views().likedPetsHtml({ pets, currentPage: page, totalPages, totalCount: total, pageSize: currentLikedPageSize() });
      const sizeSelect = $('.pet-liked-page-size', list);
      if (sizeSelect) {
        sizeSelect.onchange = () => {
          likedPageSize = Number(sizeSelect.value) || PAGE_SIZE;
          page = 1; // 每页数量变化后从第 1 页重新加载
          void loadLikedPets();
        };
        // 自定义可爱风下拉面板（pet-picker.js）：鼠标点击时替代原生 option 列表
        if (picker && typeof picker.attachSelect === 'function') picker.attachSelect(sizeSelect);
      }
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
      if (likedQuery) query.set('q', likedQuery);
      if (likedDate) query.set('start', likedDate);
      if (likedDateEnd) query.set('end', likedDateEnd);
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
