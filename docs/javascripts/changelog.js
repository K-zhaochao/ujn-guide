(function () {
  'use strict';
  function init() {
    var host = document.getElementById('ujn-changelog');
    if (!host || host.dataset.paginationReady) return;
    host.dataset.paginationReady = '1';
    var items = Array.from(host.querySelectorAll('[data-change-item]'));
    var nav = host.querySelector('[data-change-pagination]');
    if (!nav) return;
    var size = Number(host.dataset.pageSize) || 10, count = Math.ceil(items.length / size);
    if (count <= 1) return;
    var page = 1;
    var previous = document.createElement('button'), next = document.createElement('button');
    var select = document.createElement('select'), summary = document.createElement('span');
    previous.type = next.type = 'button'; previous.textContent = '上一页'; next.textContent = '下一页';
    select.setAttribute('aria-label', '跳转更新页'); summary.setAttribute('role', 'status'); summary.setAttribute('aria-live', 'polite');
    for (var i = 1; i <= count; i++) { var option = document.createElement('option'); option.value = String(i); option.textContent = '第 ' + i + ' 页'; select.appendChild(option); }
    nav.replaceChildren(previous, select, next, summary); nav.hidden = false;
    function paint() {
      items.forEach(function (item, index) { item.hidden = Math.floor(index / size) + 1 !== page; });
      previous.disabled = page === 1; next.disabled = page === count; select.value = String(page);
      summary.textContent = '共 ' + items.length + ' 条 · ' + page + ' / ' + count + ' 页';
    }
    function change(value) { page = Math.min(count, Math.max(1, value)); paint(); if (host.scrollIntoView) host.scrollIntoView({ block: 'start' }); }
    previous.addEventListener('click', function () { change(page - 1); });
    next.addEventListener('click', function () { change(page + 1); });
    select.addEventListener('change', function () { change(Number(select.value)); }); paint();
  }
  if (typeof document$ !== 'undefined' && document$.subscribe) document$.subscribe(init);
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
