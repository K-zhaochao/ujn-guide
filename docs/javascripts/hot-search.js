/**
 * 搜索面板的「大家都在搜」。
 * =====================================
 *
 * 新生打开搜索框时常常不知道该搜什么，这里给几个校园里最常找的词（标记在
 * overrides/partials/search.html 里，脚本只负责显示时机与点击行为）。
 *
 * 约定：
 * - 查询词为空时才显示，开始输入就收起；
 * - 点击 = 填进搜索框并派发一次 input 事件——搜索逻辑（Pagefind）本来就在监听它，
 *   两个模块不必互相知道对方存在；
 * - 用原生 hidden 属性控制显隐，不依赖 :has() 之类较新的选择器。
 */

(function () {
  'use strict';

  function bindSearchHot(root) {
    var scope = root || document;
    var hot = scope.querySelector('#pagefind-hot');
    var input = scope.querySelector('#pagefind-search-input');
    if (!hot || !input) return null;
    // 幂等：即时导航后可能再次初始化，重复绑定会让一次点击派发多次 input
    if (hot.getAttribute('data-hot-bound') === '1') return hot;
    hot.setAttribute('data-hot-bound', '1');

    function update() {
      var hasQuery = input.value.trim().length > 0;
      hot.hidden = hasQuery;
    }

    hot.addEventListener('click', function (event) {
      var chip = event.target && event.target.closest ? event.target.closest('.md-search__hot-chip') : null;
      if (!chip) return;
      var query = chip.getAttribute('data-query') || chip.textContent || '';
      if (!query) return;
      input.value = query;
      update();
      input.dispatchEvent(new Event('input', { bubbles: true }));
      if (typeof input.focus === 'function') input.focus();
    });

    input.addEventListener('input', update);
    input.addEventListener('search', update);
    var form = scope.querySelector('#pagefind-search-form');
    if (form) {
      form.addEventListener('reset', function () {
        // 表单 reset 会先清空再触发，等一拍再读值
        setTimeout(update, 0);
      });
    }

    update();
    return hot;
  }

  function start() {
    bindSearchHot(document);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start);
  } else {
    start();
  }

  // 供测试调用
  window.UJNHotSearch = { bind: bindSearchHot };
})();
