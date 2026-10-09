/* Progressive directory search. All original rows remain readable without JavaScript. */
(function () {
  'use strict';
  function dialLinks(root) {
    root.querySelectorAll('td').forEach(function (cell) {
      var walker = document.createTreeWalker(cell, NodeFilter.SHOW_TEXT);
      var nodes = [];
      while (walker.nextNode()) {
        if (!walker.currentNode.parentElement.closest('a, code, script')) nodes.push(walker.currentNode);
      }
      nodes.forEach(function (node) {
        var text = node.textContent;
        // Only explicit full landlines/mobile numbers. Preserve prefixes, notes and <br>.
        var matches = Array.from(text.matchAll(/(?<!\d)(?:0\d{2,3}[-－ ]\d{7,8}|1[3-9]\d{9})(?!\d)/g));
        if (!matches.length) return;
        var fragment = document.createDocumentFragment();
        var end = 0;
        matches.forEach(function (match) {
          fragment.appendChild(document.createTextNode(text.slice(end, match.index)));
          var a = document.createElement('a');
          a.href = 'tel:' + match[0].replace(/[-－ ]/g, '');
          a.textContent = match[0];
          a.setAttribute('aria-label', '拨打 ' + match[0]);
          fragment.appendChild(a);
          end = match.index + match[0].length;
        });
        fragment.appendChild(document.createTextNode(text.slice(end)));
        node.replaceWith(fragment);
      });
    });
  }
  function init(root) {
    if (!root || root.dataset.directoryReady || !root.querySelector('tbody tr')) return null;
    root.dataset.directoryReady = 'true';
    var phone = root.dataset.pageSection === 'phone-book';
    if (phone) dialLinks(root);
    var groups = Array.from(root.querySelectorAll('table')).map(function (table) {
      var block = table.closest('details') || table.closest('.md-typeset__scrollwrap') || table;
      var previous = block.previousElementSibling;
      while (previous && previous.tagName !== 'H2') previous = previous.previousElementSibling;
      return { table: table, block: block, heading: previous, rows: Array.from(table.querySelectorAll('tbody tr')), open: block.tagName === 'DETAILS' ? block.open : null };
    });
    var form = document.createElement('form');
    form.className = 'ujn-directory-search';
    form.setAttribute('role', 'search');
    form.setAttribute('aria-label', '筛选本页信息');
    var label = document.createElement('label');
    label.htmlFor = 'ujn-directory-query';
    label.textContent = phone ? '快速找电话' : '快速找同乡';
    var controls = document.createElement('div');
    controls.className = 'ujn-directory-search__controls';
    var input = document.createElement('input');
    input.type = 'search'; input.id = label.htmlFor; input.autocomplete = 'off';
    input.placeholder = phone ? '输入学院、部门或电话号码' : '输入省份或群信息';
    input.setAttribute('aria-describedby', 'ujn-directory-status');
    var reset = document.createElement('button');
    reset.type = 'button'; reset.textContent = '清除筛选';
    var status = document.createElement('span');
    status.id = 'ujn-directory-status'; status.className = 'ujn-directory-search__status';
    status.setAttribute('role', 'status'); status.setAttribute('aria-live', 'polite');
    controls.append(input, reset); form.append(label, controls, status);
    var title = root.querySelector('h1');
    // Keep a static parent-page return action above progressive search controls.
    var returnRow = title && title.nextElementSibling;
    var anchor = returnRow && returnRow.querySelector('a.ujn-parent-return') ? returnRow : title;
    if (anchor) anchor.insertAdjacentElement('afterend', form); else root.prepend(form);
    var searching = false;
    function filter() {
      var query = input.value.trim().toLocaleLowerCase();
      if (query && !searching) groups.forEach(function (g) { if (g.open !== null) g.open = g.block.open; });
      var count = 0;
      groups.forEach(function (g) {
        var name = g.heading ? g.heading.textContent.toLocaleLowerCase() : '';
        var found = 0;
        g.rows.forEach(function (row) {
          var matches = !query || (name + ' ' + row.textContent.toLocaleLowerCase()).includes(query);
          row.hidden = !matches;
          if (matches) found++;
        });
        g.block.hidden = found === 0;
        if (g.heading) g.heading.hidden = found === 0;
        if (g.open !== null) g.block.open = query ? found > 0 : g.open;
        count += found;
      });
      searching = Boolean(query);
      status.textContent = query ? (count ? '找到 ' + count + ' 条，匹配内容已展开。' : '没有匹配结果，试试其他关键词。') : '共 ' + count + ' 条信息' + (phone ? ' · 点击号码拨号' : ' · 点击链接加入群聊');
      return count;
    }
    input.addEventListener('input', filter);
    reset.addEventListener('click', function () { input.value = ''; filter(); input.focus(); });
    form.addEventListener('submit', function (event) { event.preventDefault(); filter(); });
    filter();
    return { filter: filter, input: input, groups: groups };
  }
  function sync() {
    document.querySelectorAll('.md-typeset__scrollwrap').forEach(function (wrap) {
      wrap.tabIndex = 0;
      wrap.setAttribute('role', 'region');
      wrap.setAttribute('aria-label', '数据表格（宽表可横向滚动）');
    });
    return init(document.querySelector('.ujn-page--directory'));
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', sync);
  else sync();
  if (typeof document$ !== 'undefined' && document$.subscribe) document$.subscribe(sync);
  window.UJNDirectory = { init: init, sync: sync, dialLinks: dialLinks };
})();
