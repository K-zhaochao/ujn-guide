(function () {
  'use strict';
  function init() {
    var host = document.getElementById('ujn-changelog');
    if (!host || host.dataset.paginationReady) return;
    var nav = host.querySelector('[data-change-pagination]');
    if (!nav) return;
    host.dataset.paginationReady = '1';
    var items = Array.from(host.querySelectorAll('[data-change-item]'));
    var size = Number(host.dataset.pageSize) || 10, count = Math.ceil(items.length / size);
    if (count <= 1) return;
    var page = 1;
    var previous = document.createElement('button'), next = document.createElement('button');
    var jump = document.createElement('button'), input = document.createElement('input');
    var label = document.createElement('label'), summary = document.createElement('span');
    var error = document.createElement('span');
    previous.type = next.type = jump.type = 'button';
    previous.textContent = '上一页'; next.textContent = '下一页'; jump.textContent = '跳转';
    input.type = 'text'; input.inputMode = 'numeric'; input.pattern = '[0-9]+';
    input.id = 'ujn-changelog-page'; input.autocomplete = 'off';
    input.setAttribute('aria-label', '跳转更新页');
    input.setAttribute('aria-describedby', 'ujn-changelog-page-summary ujn-changelog-page-error');
    label.className = 'ujn-pagination__jump'; label.htmlFor = input.id;
    label.append('第 ', input, ' 页');
    summary.id = 'ujn-changelog-page-summary'; summary.setAttribute('role', 'status'); summary.setAttribute('aria-live', 'polite');
    error.id = 'ujn-changelog-page-error'; error.className = 'ujn-pagination__error';
    error.setAttribute('role', 'alert'); error.hidden = true;
    nav.replaceChildren(previous, label, jump, next, summary, error); nav.hidden = false;
    function clearError() { input.removeAttribute('aria-invalid'); error.hidden = true; error.textContent = ''; }
    function paint() {
      items.forEach(function (item, index) { item.hidden = Math.floor(index / size) + 1 !== page; });
      previous.disabled = page === 1; next.disabled = page === count; input.value = String(page);
      summary.textContent = '共 ' + items.length + ' 条 · ' + page + ' / ' + count + ' 页';
      clearError();
    }
    function change(value) {
      page = value; paint();
      if (host.scrollIntoView) host.scrollIntoView({ block: 'start' });
    }
    function submit() {
      var text = input.value.trim(), value = Number(text);
      if (!/^[0-9]+$/.test(text) || !Number.isSafeInteger(value) || value < 1 || value > count) {
        input.setAttribute('aria-invalid', 'true'); error.hidden = false;
        error.textContent = '请输入 1～' + count + ' 之间的整数页码。';
        return;
      }
      change(value);
    }
    previous.addEventListener('click', function () { if (page > 1) change(page - 1); });
    next.addEventListener('click', function () { if (page < count) change(page + 1); });
    jump.addEventListener('click', submit);
    input.addEventListener('change', submit);
    input.addEventListener('input', clearError);
    input.addEventListener('keydown', function (event) {
      if (event.key === 'Enter') { event.preventDefault(); submit(); }
    });
    paint();
  }
  if (typeof document$ !== 'undefined' && document$.subscribe) document$.subscribe(init);
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
