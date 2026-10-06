/**
 * 搜索面板的「大家都在搜」。
 * =====================================
 *
 * 新生打开搜索框时常常不知道该搜什么，这里给几个校园里最常找的词（标记在
 * overrides/partials/search.html 里，脚本只负责显示时机与点击行为）。
 *
 * 约定：
 * - 查询词为空时显示，开始输入就收起；
 * - 搜不到结果时，搜索逻辑会调 suggest() 把同一组词再摆出来（换个标题），
 *   把「没找到」这条死路变成出口——不复制一份按钮，也就不会有两套点击逻辑；
 * - 点击 = 填进搜索框并派发一次 input 事件——搜索逻辑（Pagefind）本来就在监听它，
 *   两个模块不必互相知道对方存在；
 * - 用原生 hidden 属性控制显隐，不依赖 :has() 之类较新的选择器。
 */

(function () {
  'use strict';

  var DEFAULT_LABEL = '大家都在搜';

  function bindSearchHot(root) {
    var scope = root || document;
    var hot = scope.querySelector('#pagefind-hot');
    var input = scope.querySelector('#pagefind-search-input');
    if (!hot || !input) return null;
    // 幂等：即时导航后可能再次初始化，重复绑定会让一次点击派发多次 input
    if (hot.getAttribute('data-hot-bound') === '1') {
      return hot;
    }
    hot.setAttribute('data-hot-bound', '1');

    var label = hot.querySelector('.md-search__hot-label');
    var suggested = false;
    var suggestText = '';

    function apply() {
      var hasQuery = input.value.trim().length > 0;
      hot.hidden = hasQuery && !suggested;
      if (label) label.textContent = suggested ? suggestText : DEFAULT_LABEL;
    }

    /** 回到平常状态：只按「有没有输入」决定显隐。 */
    function reset() {
      suggested = false;
      suggestText = '';
      apply();
    }

    /** 搜不到结果时由搜索逻辑调用：把推荐词再摆出来，并换一句说明。 */
    function suggest(message) {
      suggested = true;
      suggestText = message || '没找到？试试这些';
      apply();
      return hot;
    }

    hot.addEventListener('click', function (event) {
      var chip = event.target && event.target.closest ? event.target.closest('.md-search__hot-chip') : null;
      if (!chip) return;
      var query = chip.getAttribute('data-query') || chip.textContent || '';
      if (!query) return;
      input.value = query;
      reset();
      input.dispatchEvent(new Event('input', { bubbles: true }));
      if (typeof input.focus === 'function') input.focus();
    });

    input.addEventListener('input', reset);
    input.addEventListener('search', reset);
    var form = scope.querySelector('#pagefind-search-form');
    if (form) {
      form.addEventListener('reset', function () {
        // 表单 reset 会先清空再触发，等一拍再读值
        setTimeout(reset, 0);
      });
    }

    apply();
    hot.__ujnSuggest = suggest;
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

  // 供测试与搜索逻辑调用
  window.UJNHotSearch = {
    bind: bindSearchHot,
    suggest: function (message) {
      var hot = document.getElementById('pagefind-hot');
      var suggest = hot && hot.__ujnSuggest;
      if (typeof suggest === 'function') return suggest(message);
      return null;
    },
  };
})();
