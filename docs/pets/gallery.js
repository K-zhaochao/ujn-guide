/**
 * 🐾 猫猫图鉴 — 分页与相册弹窗
 * =====================================
 *
 * 纯前端实现，不发送任何接口请求：
 *   - 分页：卡牌已在构建时生成，这里只负责按页显示 / 隐藏并渲染分页条；
 *   - 相册：点击卡牌照片打开弹窗，左右箭头、键盘方向键、触摸滑动都能翻页。
 *
 * 没有本脚本时页面依旧可用：全部卡牌保持可见，分页条为空容器。
 * 卡牌数据（名字、照片列表、详情页地址）由 scripts/pets/build_gallery.py 写进
 * 每张卡牌的 data-* 属性，这里只读取，不重复维护一份清单。
 */

(function () {
  'use strict';

  // ==================== 配置 ====================
  var DESKTOP_PAGE_SIZE = 12;
  var MOBILE_PAGE_SIZE = 8;
  var MOBILE_QUERY = '(max-width: 640px)';
  var PAGE_SIZE_OPTIONS = [8, 12, 24];
  var SWIPE_THRESHOLD = 42; // 触发翻页的最小横向位移（px）
  var SWIPE_FOLLOW = 0.32; // 拖动时图片跟手的比例

  var controller = null;

  function prefersReducedMotion() {
    return typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

  function isMobile() {
    return typeof window.matchMedia === 'function' && window.matchMedia(MOBILE_QUERY).matches;
  }

  function defaultPageSize() {
    return isMobile() ? MOBILE_PAGE_SIZE : DESKTOP_PAGE_SIZE;
  }

  function clamp(value, min, max) {
    return Math.min(Math.max(value, min), max);
  }

  function createController(deck, cards) {
    var pager = document.getElementById('pet-pager');
    var viewer = null;
    var pageSize = defaultPageSize();
    var page = 1;
    var sizeChosen = false;
    var media = typeof window.matchMedia === 'function' ? window.matchMedia(MOBILE_QUERY) : null;
    var sizePicker = null;

    // ==================== 分页 ====================
    function totalPages() {
      return Math.max(1, Math.ceil(cards.filter(matches).length / pageSize));
    }

    // ==================== 按名字找猫 ====================
    // 页面上那个搜索框（docs/pets/index.md 的 #pet-filter-input）用来按名字筛卡牌。
    // 筛选结果也分页，计数仍显示全部命中数量，避免一次加载大量照片。
    var filterInput = document.getElementById('pet-filter-input');
    var filterCount = document.getElementById('pet-filter-count');
    var query = '';

    function matches(card) {
      if (!query) return true;
      var name = (card.getAttribute('data-name') || '').toLowerCase();
      return name.indexOf(query) !== -1;
    }

    function applyFilter() {
      var hits = 0;
      for (var i = 0; i < cards.length; i += 1) {
        if (matches(cards[i])) hits += 1;
      }
      if (filterCount) {
        if (!query) filterCount.textContent = '';
        else if (hits) filterCount.textContent = '找到 ' + hits + ' 只';
        else filterCount.textContent = '没有匹配的猫，换个名字试试';
      }
      return hits;
    }

    function applyPage() {
      var pages = totalPages();
      page = clamp(page, 1, pages);
      var hits = applyFilter();
      var filtered = cards.filter(matches);
      var visibleCards = filtered.slice((page - 1) * pageSize, page * pageSize);
      for (var i = 0; i < cards.length; i += 1) {
        var visible = visibleCards.indexOf(cards[i]) !== -1;
        cards[i].classList.toggle('is-hidden', !visible);
        if (visible) {
          var image = cards[i].querySelector('img[data-pet-src]');
          if (image && !image.getAttribute('src')) image.src = image.getAttribute('data-pet-src');
        }
      }
      if (pager) pager.hidden = hits === 0;
      renderPager();
    }

    if (filterInput) {
      filterInput.addEventListener('input', function () {
        query = (filterInput.value || '').trim().toLowerCase();
        page = 1;
        applyPage();
      });
      filterInput.addEventListener('search', function () {
        if (!filterInput.value) {
          query = '';
          applyPage();
        }
      });
    }

    function button(className, label, text) {
      var element = document.createElement('button');
      element.type = 'button';
      element.className = className;
      if (label) element.setAttribute('aria-label', label);
      element.textContent = text;
      return element;
    }

    function goTo(nextPage, focusSelector) {
      var pages = totalPages();
      var target = clamp(nextPage, 1, pages);
      if (target === page) return;
      page = target;
      applyPage();
      var control = pager && pager.querySelector(focusSelector || '#pet-page-input');
      if (control) control.focus({ preventScroll: true });
      scrollToDeck();
    }

    function scrollToDeck() {
      var header = document.querySelector('.md-header');
      var offset = (header ? header.offsetHeight : 60) + 12;
      var top = deck.getBoundingClientRect().top + window.pageYOffset - offset;
      window.scrollTo({ top: Math.max(top, 0), behavior: prefersReducedMotion() ? 'auto' : 'smooth' });
    }

    function renderPager() {
      if (!pager) return;
      var pages = totalPages();
      pager.textContent = '';
      sizePicker = null;
      var navigation = document.createElement('div');
      navigation.className = 'pet-pager__navigation';
      var prev = button('pet-pager__btn pet-pager__prev', '上一页', '上一页');
      var next = button('pet-pager__btn pet-pager__next', '下一页', '下一页');
      prev.disabled = page === 1;
      next.disabled = page === pages;
      prev.addEventListener('click', function () { goTo(page - 1, '.pet-pager__prev'); });
      next.addEventListener('click', function () { goTo(page + 1, '.pet-pager__next'); });
      var form = document.createElement('form');
      form.className = 'pet-pager__jump';
      form.noValidate = true;
      var label = document.createElement('label');
      label.className = 'pet-pager__page-label';
      var input = document.createElement('input');
      input.id = 'pet-page-input';
      input.type = 'text'; input.inputMode = 'numeric'; input.pattern = '[0-9]+';
      input.autocomplete = 'off'; input.maxLength = 12; input.value = String(page);
      input.setAttribute('aria-label', '跳转页码');
      input.setAttribute('aria-describedby', 'pet-page-summary pet-page-error');
      var total = document.createElement('span');
      total.textContent = '/ ' + pages + ' 页';
      label.append(input, total);
      var jump = button('pet-pager__jump-btn', '跳转到指定页', '→');
      jump.type = 'submit'; jump.title = '输入页码后跳转';
      form.append(label, jump);
      var error = document.createElement('p');
      error.id = 'pet-page-error'; error.className = 'pet-pager__error';
      error.setAttribute('role', 'alert'); error.hidden = true;
      function clearError() { input.removeAttribute('aria-invalid'); error.hidden = true; error.textContent = ''; }
      input.addEventListener('input', clearError);
      form.addEventListener('submit', function (event) {
        event.preventDefault();
        var text = input.value.trim(), value = Number(text);
        if (!/^[0-9]+$/.test(text) || !Number.isSafeInteger(value) || value < 1 || value > pages) {
          input.setAttribute('aria-invalid', 'true'); error.hidden = false;
          error.textContent = '请输入 1～' + pages + ' 之间的整数页码。';
          input.focus({ preventScroll: true });
          return;
        }
        clearError(); input.value = String(value); goTo(value);
      });
      navigation.append(prev, form, next);
      var settings = document.createElement('div');
      settings.className = 'pet-pager__settings';
      var meta = document.createElement('span');
      meta.id = 'pet-page-summary'; meta.className = 'pet-pager__meta';
      meta.setAttribute('role', 'status'); meta.setAttribute('aria-live', 'polite');
      var count = cards.filter(matches).length;
      meta.textContent = (query ? '匹配 ' : '共 ') + count + ' 只 · 第 ' + page + '/' + pages + ' 页';
      settings.append(meta, buildSizePicker());
      pager.append(navigation, settings, error);
    }

    function changeSize(size) {
      if (PAGE_SIZE_OPTIONS.indexOf(size) === -1) return;
      sizeChosen = true; pageSize = size; page = 1;
      applyPage();
      var next = pager.querySelector('.pet-pager__size-trigger');
      if (next) next.focus({ preventScroll: true });
    }

    // Fully themed popover, with a roving active option while focus stays on the combobox.
    function buildSizePicker() {
      var wrap = document.createElement('div');
      wrap.className = 'pet-pager__size-wrap';
      var label = document.createElement('span');
      label.id = 'pet-page-size-label'; label.className = 'pet-pager__size-label'; label.textContent = '每页';
      var trigger = button('pet-pager__size-trigger', '每页显示数量', String(pageSize));
      trigger.setAttribute('role', 'combobox'); trigger.setAttribute('aria-haspopup', 'listbox');
      trigger.setAttribute('aria-expanded', 'false'); trigger.setAttribute('aria-controls', 'pet-page-size-menu');
      var menu = document.createElement('div');
      menu.id = 'pet-page-size-menu'; menu.className = 'pet-pager__size-menu';
      menu.setAttribute('role', 'listbox'); menu.setAttribute('aria-labelledby', label.id); menu.hidden = true;
      var active = PAGE_SIZE_OPTIONS.indexOf(pageSize);
      var options = [];
      function paintActive() {
        options.forEach(function (option, index) { option.classList.toggle('is-highlighted', index === active); });
        trigger.setAttribute('aria-activedescendant', options[active].id);
      }
      function closeMenu() {
        menu.hidden = true; trigger.setAttribute('aria-expanded', 'false'); trigger.removeAttribute('aria-activedescendant');
      }
      function openMenu() {
        active = PAGE_SIZE_OPTIONS.indexOf(pageSize);
        menu.hidden = false; trigger.setAttribute('aria-expanded', 'true'); paintActive();
      }
      PAGE_SIZE_OPTIONS.forEach(function (size, index) {
        var option = button('pet-pager__size-option', null, size + ' 张');
        option.id = 'pet-size-' + size; option.dataset.value = String(size); option.tabIndex = -1;
        option.setAttribute('role', 'option'); option.setAttribute('aria-selected', String(size === pageSize));
        option.addEventListener('click', function () { changeSize(size); });
        options.push(option); menu.appendChild(option);
      });
      trigger.addEventListener('click', function () { if (menu.hidden) openMenu(); else closeMenu(); });
      trigger.addEventListener('keydown', function (event) {
        if (event.key === 'Tab') { closeMenu(); return; }
        if (event.key === 'Escape') { closeMenu(); event.preventDefault(); return; }
        if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
          event.preventDefault();
          if (menu.hidden) { openMenu(); return; }
          active = (active + (event.key === 'ArrowDown' ? 1 : -1) + options.length) % options.length;
          paintActive(); return;
        }
        if (event.key === 'Home' || event.key === 'End') {
          event.preventDefault(); if (menu.hidden) openMenu();
          active = event.key === 'Home' ? 0 : options.length - 1; paintActive(); return;
        }
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault(); if (menu.hidden) openMenu(); else changeSize(PAGE_SIZE_OPTIONS[active]);
        }
      });
      sizePicker = { wrap: wrap, close: closeMenu };
      wrap.append(label, trigger, menu);
      return wrap;
    }

    function closeSizeMenuOutside(event) {
      if (sizePicker && !sizePicker.wrap.contains(event.target)) sizePicker.close();
    }

    function onMediaChange() {
      if (sizeChosen) return;
      var next = defaultPageSize();
      if (next === pageSize) return;
      pageSize = next;
      page = 1;
      applyPage();
    }

    // ==================== 相册弹窗 ====================
    function buildViewer() {
      var root = document.createElement('div');
      root.id = 'pet-viewer';
      root.hidden = true;
      root.innerHTML = [
        '<div class="pet-viewer__backdrop" data-pet-close="1"></div>',
        '<div class="pet-viewer__panel" role="dialog" aria-modal="true" aria-labelledby="pet-viewer-title">',
        '  <div class="pet-viewer__bar">',
        '    <span class="pet-viewer__title" id="pet-viewer-title"></span>',
        '    <span class="pet-viewer__count" aria-hidden="true"></span>',
        '    <span class="ujn-visually-hidden" role="status" aria-live="polite"></span>',
        '    <button class="pet-viewer__close" type="button" aria-label="关闭">✕</button>',
        '  </div>',
        '  <div class="pet-viewer__stage">',
        '    <button class="pet-viewer__nav pet-viewer__nav--prev" type="button" aria-label="上一张">‹</button>',
        '    <img class="pet-viewer__img" alt="" decoding="async">',
        '    <button class="pet-viewer__nav pet-viewer__nav--next" type="button" aria-label="下一张">›</button>',
        '  </div>',
        '  <div class="pet-viewer__dots"></div>',
        '</div>',
      ].join('\n');
      document.body.appendChild(root);
      return root;
    }

    var state = { name: '', photos: [], index: 0, opener: null, drag: null };
    var parts = null;

    function ensureViewer() {
      if (viewer) return;
      viewer = buildViewer();
      parts = {
        img: viewer.querySelector('.pet-viewer__img'),
        title: viewer.querySelector('.pet-viewer__title'),
        count: viewer.querySelector('.pet-viewer__count'),
        status: viewer.querySelector('[role="status"]'),
        panel: viewer.querySelector('.pet-viewer__panel'),
        close: viewer.querySelector('.pet-viewer__close'),
        stage: viewer.querySelector('.pet-viewer__stage'),
        prev: viewer.querySelector('.pet-viewer__nav--prev'),
        next: viewer.querySelector('.pet-viewer__nav--next'),
        dots: viewer.querySelector('.pet-viewer__dots'),
      };

      parts.close.addEventListener('click', close);
      viewer.querySelector('.pet-viewer__backdrop').addEventListener('click', close);
      parts.prev.addEventListener('click', function () { show(state.index - 1); });
      parts.next.addEventListener('click', function () { show(state.index + 1); });
      // 图片的 load/error 与 requestAnimationFrame 都可能晚于 destroy() 触发，
      // 这里绑定元素本身而不是 parts，避免销毁后访问空对象。
      var image = parts.img;
      image.addEventListener('load', function () { image.classList.remove('is-loading'); });
      image.addEventListener('error', function () { image.classList.remove('is-loading'); });
      parts.stage.addEventListener('pointerdown', onPointerDown);
      parts.stage.addEventListener('pointermove', onPointerMove);
      parts.stage.addEventListener('pointerup', onPointerUp);
      parts.stage.addEventListener('pointercancel', onPointerUp);
    }

    function preload(index) {
      if (index < 0 || index >= state.photos.length) return;
      var image = new Image();
      image.src = state.photos[index];
    }

    function show(index) {
      if (!parts) return;
      var total = state.photos.length;
      if (!total) return;
      var wrapped = index < 0 ? total - 1 : (index >= total ? 0 : index);
      state.index = wrapped;
      parts.img.classList.remove('is-loading');
      parts.img.style.transition = 'none';
      parts.img.style.transform = '';
      parts.img.classList.add('is-loading');
      parts.img.src = state.photos[wrapped];
      parts.img.alt = state.name + ' 的照片 ' + (wrapped + 1) + '/' + total;
      // 视觉上的 3 / 7 对读屏是模糊的，用 live region 播报一句完整的话
      parts.count.textContent = (wrapped + 1) + ' / ' + total;
      if (parts.status) {
        parts.status.textContent = '第 ' + (wrapped + 1) + ' 张，共 ' + total + ' 张：' + state.name;
      }
      parts.prev.disabled = total < 2;
      parts.next.disabled = total < 2;
      var dots = parts.dots.querySelectorAll('.pet-viewer__dot');
      for (var i = 0; i < dots.length; i += 1) {
        dots[i].classList.toggle('is-active', i === wrapped);
        if (i === wrapped) dots[i].setAttribute('aria-current', 'true');
        else dots[i].removeAttribute('aria-current');
      }
      preload(wrapped + 1);
      preload(wrapped - 1);
      window.requestAnimationFrame(function () {
        if (parts) parts.img.style.transition = '';
      });
    }

    function open(card, opener) {
      var photos = (card.getAttribute('data-photos') || '').split('|').filter(Boolean);
      if (!photos.length) return;
      ensureViewer();
      state.name = card.getAttribute('data-name') || '';
      state.photos = photos;
      state.index = 0;
      state.opener = opener || null;
      parts.title.textContent = state.name;
      parts.dots.textContent = '';
      if (photos.length > 1) {
        for (var i = 0; i < photos.length; i += 1) {
          var dot = button('pet-viewer__dot', '第 ' + (i + 1) + ' 张', String(i + 1));
          (function (target) {
            dot.addEventListener('click', function () { show(target); });
          })(i);
          parts.dots.appendChild(dot);
        }
      }
      viewer.hidden = false;
      document.body.classList.add('pet-viewer-open');
      show(0);
      parts.close.focus({ preventScroll: true });
    }

    function close() {
      if (!viewer || viewer.hidden) return;
      viewer.hidden = true;
      document.body.classList.remove('pet-viewer-open');
      if (parts) {
        parts.img.removeAttribute('src');
        parts.img.style.transform = '';
      }
      state.photos = [];
      if (state.opener && typeof state.opener.focus === 'function') {
        state.opener.focus({ preventScroll: true });
      }
    }

    function onPointerDown(event) {
      if (!parts || event.target.closest('.pet-viewer__nav')) return;
      state.drag = { id: event.pointerId, x: event.clientX, y: event.clientY, dx: 0, dy: 0 };
      parts.img.style.transition = 'none';
      if (parts.stage.setPointerCapture) {
        try { parts.stage.setPointerCapture(event.pointerId); } catch (error) { /* 忽略 */ }
      }
    }

    function onPointerMove(event) {
      var drag = state.drag;
      if (!drag || drag.id !== event.pointerId) return;
      drag.dx = event.clientX - drag.x;
      drag.dy = event.clientY - drag.y;
      if (state.photos.length > 1 && Math.abs(drag.dx) > Math.abs(drag.dy)) {
        parts.img.style.transform = 'translateX(' + (drag.dx * SWIPE_FOLLOW) + 'px)';
      }
    }

    function onPointerUp(event) {
      var drag = state.drag;
      if (!drag || drag.id !== event.pointerId) return;
      state.drag = null;
      if (parts) {
        parts.img.style.transform = '';
        parts.img.style.transition = '';
      }
      if (state.photos.length < 2) return;
      if (Math.abs(drag.dx) >= SWIPE_THRESHOLD && Math.abs(drag.dx) > Math.abs(drag.dy)) {
        show(drag.dx < 0 ? state.index + 1 : state.index - 1);
      }
    }

    /** 弹窗内可聚焦的元素（用于把 Tab 锁在弹窗里）。 */
    var FOCUSABLE = 'button:not([disabled]), [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';

    function focusables() {
      if (!parts) return [];
      return Array.prototype.slice
        .call(parts.panel.querySelectorAll(FOCUSABLE))
        .filter(function (node) {
          return !node.disabled && node.getAttribute('aria-hidden') !== 'true';
        });
    }

    function onKeyDown(event) {
      if (!viewer || viewer.hidden) return;
      if (event.key === 'Escape') {
        event.preventDefault();
        close();
      } else if (event.key === 'ArrowLeft') {
        event.preventDefault();
        show(state.index - 1);
      } else if (event.key === 'ArrowRight') {
        event.preventDefault();
        show(state.index + 1);
      } else if (event.key === 'Tab') {
        // 焦点锁在弹窗内：否则 Tab 会跑到背景页面的链接上，读屏与键盘用户会迷路
        var items = focusables();
        if (!items.length) return;
        var first = items[0];
        var last = items[items.length - 1];
        var active = document.activeElement;
        if (!parts.panel.contains(active)) {
          event.preventDefault();
          first.focus();
        } else if (event.shiftKey && active === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && active === last) {
          event.preventDefault();
          first.focus();
        }
      }
    }

    function onDeckClick(event) {
      var shot = event.target.closest ? event.target.closest('.pet-card__shot') : null;
      if (!shot || !deck.contains(shot)) return;
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      if (typeof event.button === 'number' && event.button !== 0) return;
      var card = shot.closest('.pet-card');
      if (!card || !card.getAttribute('data-photos')) return;
      event.preventDefault();
      open(card, shot);
    }

    // ==================== 生命周期 ====================
    function start() {
      applyPage();
      deck.addEventListener('click', onDeckClick);
      document.addEventListener('keydown', onKeyDown);
      document.addEventListener('click', closeSizeMenuOutside);
      if (media) {
        if (media.addEventListener) media.addEventListener('change', onMediaChange);
        else if (media.addListener) media.addListener(onMediaChange);
      }
    }

    function destroy() {
      close();
      deck.removeEventListener('click', onDeckClick);
      document.removeEventListener('keydown', onKeyDown);
      document.removeEventListener('click', closeSizeMenuOutside);
      sizePicker = null;
      if (media) {
        if (media.removeEventListener) media.removeEventListener('change', onMediaChange);
        else if (media.removeListener) media.removeListener(onMediaChange);
      }
      if (viewer && viewer.parentNode) viewer.parentNode.removeChild(viewer);
      viewer = null;
      parts = null;
      if (pager) pager.textContent = '';
    }

    function setFilter(value) {
      query = (value || '').trim().toLowerCase();
      if (filterInput) filterInput.value = value || '';
      page = 1;
      applyPage();
    }

    return { start: start, destroy: destroy, setFilter: setFilter };
  }

  function init() {
    if (controller) {
      controller.destroy();
      controller = null;
    }
    var deck = document.getElementById('pet-deck');
    if (!deck) return;
    var cards = Array.prototype.slice.call(deck.querySelectorAll('.pet-card'));
    if (!cards.length) return;
    controller = createController(deck, cards);
    controller.start();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  // 兼容 MkDocs navigation.instant：每次换页后重新接管
  if (typeof document$ !== 'undefined' && document$.subscribe) {
    document$.subscribe(function () { init(); });
  }
})();
