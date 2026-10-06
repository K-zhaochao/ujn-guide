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
  var MOBILE_PAGE_SIZE = 6;
  var MOBILE_QUERY = '(max-width: 640px)';
  var PAGE_SIZE_OPTIONS = [6, 12, 24, 0]; // 0 表示「全部」
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

  function sizeLabel(size) {
    return size === 0 ? '全部' : String(size);
  }

  /** 生成页码序列，过长时用 null 表示省略号。 */
  function pageSequence(current, total) {
    var wanted = [1, total, current - 1, current, current + 1];
    var pages = [];
    for (var i = 0; i < wanted.length; i += 1) {
      var page = wanted[i];
      if (page >= 1 && page <= total && pages.indexOf(page) === -1) pages.push(page);
    }
    pages.sort(function (a, b) { return a - b; });
    var sequence = [];
    for (var j = 0; j < pages.length; j += 1) {
      if (j > 0 && pages[j] - pages[j - 1] > 1) sequence.push(null);
      sequence.push(pages[j]);
    }
    return sequence;
  }

  function createController(deck, cards) {
    var pager = document.getElementById('pet-pager');
    var viewer = null;
    var pageSize = defaultPageSize();
    var page = 1;
    var sizeChosen = false;
    var media = typeof window.matchMedia === 'function' ? window.matchMedia(MOBILE_QUERY) : null;

    // ==================== 分页 ====================
    function totalPages() {
      return pageSize > 0 ? Math.max(1, Math.ceil(cards.length / pageSize)) : 1;
    }

    function applyPage() {
      var pages = totalPages();
      page = clamp(page, 1, pages);
      var start = pageSize > 0 ? (page - 1) * pageSize : 0;
      var end = pageSize > 0 ? start + pageSize : cards.length;
      for (var i = 0; i < cards.length; i += 1) {
        cards[i].classList.toggle('is-hidden', i < start || i >= end);
      }
      renderPager();
    }

    function button(className, label, text) {
      var element = document.createElement('button');
      element.type = 'button';
      element.className = className;
      if (label) element.setAttribute('aria-label', label);
      element.textContent = text;
      return element;
    }

    function goTo(nextPage) {
      var pages = totalPages();
      var target = clamp(nextPage, 1, pages);
      if (target === page) return;
      page = target;
      applyPage();
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

      if (pages > 1) {
        var prev = button('pet-pager__btn', '上一页', '‹ 上一页');
        prev.disabled = page === 1;
        prev.addEventListener('click', function () { goTo(page - 1); });
        pager.appendChild(prev);

        var sequence = pageSequence(page, pages);
        for (var i = 0; i < sequence.length; i += 1) {
          if (sequence[i] === null) {
            var gap = document.createElement('span');
            gap.className = 'pet-pager__gap';
            gap.textContent = '…';
            pager.appendChild(gap);
            continue;
          }
          var number = sequence[i];
          var item = button('pet-pager__num', '第 ' + number + ' 页', String(number));
          if (number === page) {
            item.classList.add('is-active');
            item.setAttribute('aria-current', 'page');
          }
          (function (target) {
            item.addEventListener('click', function () { goTo(target); });
          })(number);
          pager.appendChild(item);
        }

        var next = button('pet-pager__btn', '下一页', '下一页 ›');
        next.disabled = page === pages;
        next.addEventListener('click', function () { goTo(page + 1); });
        pager.appendChild(next);
      }

      var meta = document.createElement('span');
      meta.className = 'pet-pager__meta';
      meta.textContent = pages > 1 ?
        '共 ' + cards.length + ' 只 · 第 ' + page + '/' + pages + ' 页' :
        '共 ' + cards.length + ' 只';
      pager.appendChild(meta);

      pager.appendChild(buildSizePicker());
    }

    /** 每页数量：自绘下拉面板（原生 select 的选项列表无法跟随站点主题）。 */
    function buildSizePicker() {
      var wrap = document.createElement('div');
      wrap.className = 'pet-pager__size-wrap';

      var label = document.createElement('span');
      label.className = 'pet-pager__size-label';
      label.textContent = '每页';
      wrap.appendChild(label);

      var button = document.createElement('button');
      button.type = 'button';
      button.className = 'pet-pager__size-btn';
      button.setAttribute('aria-haspopup', 'listbox');
      button.setAttribute('aria-expanded', 'false');
      button.setAttribute('aria-label', '每页显示数量');
      var value = document.createElement('span');
      value.className = 'pet-pager__size-value';
      value.textContent = sizeLabel(pageSize);
      var caret = document.createElement('span');
      caret.className = 'pet-pager__size-caret';
      caret.setAttribute('aria-hidden', 'true');
      caret.textContent = '▾';
      button.appendChild(value);
      button.appendChild(caret);
      wrap.appendChild(button);

      var menu = document.createElement('div');
      menu.className = 'pet-pager__size-menu';
      menu.setAttribute('role', 'listbox');
      menu.setAttribute('aria-label', '每页显示数量');
      menu.hidden = true;
      wrap.appendChild(menu);

      var options = [];
      for (var i = 0; i < PAGE_SIZE_OPTIONS.length; i += 1) {
        var size = PAGE_SIZE_OPTIONS[i];
        var option = document.createElement('button');
        option.type = 'button';
        option.className = 'pet-pager__size-option';
        option.setAttribute('role', 'option');
        option.setAttribute('data-value', String(size));
        option.textContent = sizeLabel(size);
        if (size === pageSize) {
          option.classList.add('is-selected');
          option.setAttribute('aria-selected', 'true');
        } else {
          option.setAttribute('aria-selected', 'false');
        }
        options.push(option);
        menu.appendChild(option);
      }

      function close() {
        if (menu.hidden) return;
        menu.hidden = true;
        button.setAttribute('aria-expanded', 'false');
        document.removeEventListener('pointerdown', onOutside, true);
        document.removeEventListener('keydown', onMenuKey, true);
      }

      function onOutside(event) {
        if (!wrap.contains(event.target)) close();
      }

      function focusOption(index) {
        var bounded = (index + options.length) % options.length;
        options[bounded].focus();
      }

      function onMenuKey(event) {
        var current = options.indexOf(document.activeElement);
        if (event.key === 'Escape') {
          event.preventDefault();
          close();
          button.focus();
        } else if (event.key === 'ArrowDown') {
          event.preventDefault();
          focusOption(current + 1);
        } else if (event.key === 'ArrowUp') {
          event.preventDefault();
          focusOption(current - 1);
        }
      }

      function open() {
        menu.hidden = false;
        button.setAttribute('aria-expanded', 'true');
        var selected = options.filter(function (option) { return option.classList.contains('is-selected'); })[0];
        (selected || options[0]).focus();
        document.addEventListener('pointerdown', onOutside, true);
        document.addEventListener('keydown', onMenuKey, true);
      }

      button.addEventListener('click', function () {
        if (menu.hidden) open();
        else close();
      });

      menu.addEventListener('click', function (event) {
        var option = event.target.closest ? event.target.closest('.pet-pager__size-option') : null;
        if (!option) return;
        sizeChosen = true;
        pageSize = parseInt(option.getAttribute('data-value'), 10) || 0;
        page = 1;
        close();
        applyPage();
      });

      return wrap;
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
        '    <span class="pet-viewer__count"></span>',
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
      parts.count.textContent = (wrapped + 1) + ' / ' + total;
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
      if (media) {
        if (media.addEventListener) media.addEventListener('change', onMediaChange);
        else if (media.addListener) media.addListener(onMediaChange);
      }
    }

    function destroy() {
      close();
      deck.removeEventListener('click', onDeckClick);
      document.removeEventListener('keydown', onKeyDown);
      if (media) {
        if (media.removeEventListener) media.removeEventListener('change', onMediaChange);
        else if (media.removeListener) media.removeListener(onMediaChange);
      }
      if (viewer && viewer.parentNode) viewer.parentNode.removeChild(viewer);
      viewer = null;
      parts = null;
      if (pager) pager.textContent = '';
    }

    return { start: start, destroy: destroy };
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
