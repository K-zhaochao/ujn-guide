(function () {
  'use strict';
  var activeForm = null, cleanup = null;
  function picker(widget, placeholder) {
    var input = widget.querySelector('input'), trigger = widget.querySelector('[role="combobox"]');
    var menu = widget.querySelector('[role="listbox"]'), label = trigger.querySelector('[data-grade-value]');
    var options = [], active = -1, search = '', searchAt = 0;
    function close() { menu.hidden = true; trigger.setAttribute('aria-expanded', 'false'); trigger.removeAttribute('aria-activedescendant'); }
    function highlight(index) {
      if (!options.length) return;
      active = (index + options.length) % options.length;
      Array.from(menu.children).forEach(function (node, i) { node.dataset.active = String(i === active); });
      var node = menu.children[active]; trigger.setAttribute('aria-activedescendant', node.id);
      if (node.scrollIntoView) node.scrollIntoView({ block: 'nearest' });
    }
    function open() {
      if (trigger.disabled || !options.length) return;
      menu.hidden = false; trigger.setAttribute('aria-expanded', 'true');
      highlight(Math.max(0, options.findIndex(function (option) { return option.value === input.value; })));
    }
    function choose(index) {
      var option = options[index]; if (!option) return;
      var changed = input.value !== option.value; input.value = option.value; render();
      close(); trigger.focus(); if (changed || widget.dataset.gradeSelect === 'year') input.dispatchEvent(new Event('change', { bubbles: true }));
    }
    function render() {
      menu.replaceChildren();
      options.forEach(function (option, index) {
        var node = document.createElement('li'); node.className = 'grade-select__option'; node.tabIndex = -1;
        node.id = menu.id + '-' + index; node.setAttribute('role', 'option'); node.setAttribute('aria-selected', String(option.value === input.value));
        node.textContent = option.label;
        node.addEventListener('click', function (event) { event.preventDefault(); choose(index); }); menu.appendChild(node);
      });
      var selected = options.find(function (option) { return option.value === input.value; });
      label.textContent = selected ? selected.label : placeholder;
    }
    trigger.addEventListener('click', function (event) { event.preventDefault(); if (menu.hidden) open(); else close(); });
    trigger.addEventListener('keydown', function (event) {
      if (trigger.disabled) return;
      if (event.key === 'Tab') { close(); return; }
      if (event.key === 'Escape') { event.preventDefault(); close(); return; }
      if (['ArrowDown', 'ArrowUp', 'Home', 'End', 'Enter', ' '].includes(event.key)) {
        event.preventDefault();
        if (menu.hidden) { open(); if (event.key === 'ArrowUp') highlight(options.length - 1); return; }
        if (event.key === 'Enter' || event.key === ' ') { choose(active); return; }
        highlight(event.key === 'Home' ? 0 : event.key === 'End' ? options.length - 1 : active + (event.key === 'ArrowDown' ? 1 : -1));
      } else if (event.key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey) {
        search = Date.now() - searchAt < 800 ? search + event.key : event.key; searchAt = Date.now();
        var hit = options.findIndex(function (option) { return option.label.toLowerCase().startsWith(search.toLowerCase()); });
        if (hit >= 0) { event.preventDefault(); open(); highlight(hit); }
      }
    });
    function outside(event) { if (!widget.contains(event.target)) close(); }
    document.addEventListener('click', outside); widget.addEventListener('focusout', function (event) { if (!widget.contains(event.relatedTarget)) close(); });
    return {
      set: function (items, value) { options = items; input.value = options.some(function (o) { return o.value === value; }) ? value : options[0]?.value || ''; render(); close(); },
      disabled: function (value) { trigger.disabled = value; if (value) close(); },
      destroy: function () { document.removeEventListener('click', outside); close(); }
    };
  }
  // Native cross-origin form navigation: no fetch, API, session token or school-cookie access.
  var COLUMNS = [
  'xnmmc@学年', 'xqmmc@学期', 'kch@课程代码', 'kcmc@课程名称', 'kcxzmc@课程性质',
  'xf@学分', 'cjbz@成绩备注', 'jd@绩点', 'ksxz@成绩性质', 'sfxwkc@是否学位课程',
  'kkbmmc@开课学院', 'kcbj@课程标记', 'kclbmc@课程类别', 'kcgsmc@课程归属',
  'jxbmc@教学班', 'jsxm@任课教师', 'khfsmc@考核方式', 'xh@学号', 'xm@姓名',
  'xsbjmc@学生标记', 'cj@成绩', 'cjsfzf@是否成绩作废', 'xfjd@学分绩点',
];
  function optionsInPage(source, name) {
    var found = [], seen = new Set();
    function attr(text, key) { var hit = new RegExp('(?:^|\\s)' + key + '\\s*=\\s*(?:"([^"]*)"|\'([^\']*)\'|([^\\s>]+))', 'i').exec(text); return hit ? hit[1] ?? hit[2] ?? hit[3] : ''; }
    function plain(text) { var node = document.createElement('textarea'); node.innerHTML = text.replace(/<[^>]*>/g, ''); return node.value.trim().slice(0, 160); }
    var selects = String(source).matchAll(/<select\b([^>]*)>([\s\S]*?)<\/select>/gi);
    for (var select of selects) {
      if (attr(select[1], 'name') !== name && attr(select[1], 'id') !== name) continue;
      for (var item of select[2].matchAll(/<option\b([^>]*)>([\s\S]*?)<\/option>/gi)) {
        var value = plain(attr(item[1], 'value'));
        if (!(name === 'xnm' ? /^\d{4}$/ : /^\d{1,3}$/).test(value) || seen.has(value)) continue;
        if (/(?:^|\s)disabled(?:\s|=|$)/i.test(item[1])) continue;
        found.push({ value: value, label: plain(item[2]) || value, selected: /(?:^|\s)selected(?:\s|=|$)/i.test(item[1]) }); seen.add(value);
        if (found.length > 64) throw new Error('页面选项过多，请核对选择的文件。');
      }
    }
    return found;
  }
  function init() {
    var tool = document.getElementById('grade-export-tool');
    if (tool === activeForm) return;
    if (cleanup) cleanup(); activeForm = tool; cleanup = null;
    if (!tool) return;
    var alive = true, revision = 0, confirmed = false;
    var form = tool.querySelector('form'), login = tool.querySelector('[data-grade-login]');
    var status = tool.querySelector('[data-grade-status]'), note = tool.querySelector('[data-grade-options-note]');
    var year = form.elements.xnm, upload = tool.querySelector('[data-grade-import]'), submit = form.querySelector('[type="submit"]');
    var term = picker(form.querySelector('[data-grade-select="term"]'), '请选择学期');
    var manual = [{ value: '', label: '请选择学期' }, { value: '3', label: '第一学期' }, { value: '12', label: '第二学期' }, { value: '16', label: '短学期' }];
    function message(text, kind) { if (!alive) return; status.textContent = text; status.dataset.kind = kind || 'info'; }
    function sync() { submit.disabled = !confirmed || !/^\d{4}$/.test(year.value) || !/^\d{1,3}$/.test(form.elements.xqm.value); }
    function setStep(exporting) {
      tool.querySelectorAll('[data-grade-step]').forEach(function (node) { if (node.dataset.gradeStep === (exporting ? 'export' : 'login')) node.setAttribute('aria-current', 'step'); else node.removeAttribute('aria-current'); });
    }
    function manualOptions() {
      revision++; term.set(manual, ''); note.textContent = '按官网成绩查询页填写；这里不会自动读取账号的学年和学期。'; sync();
    }
    term.set(manual, '');
    tool.querySelector('[data-grade-continue]').addEventListener('click', function () {
      confirmed = true; form.hidden = false; login.hidden = true; setStep(true); sync(); year.focus();
      message('选择与官网一致的学年、学期，然后提交导出。');
    });
    tool.querySelector('[data-grade-reset]').addEventListener('click', function () {
      confirmed = false; revision++; form.reset(); term.set(manual, ''); form.querySelector('[data-grade-fields]').replaceChildren();
      note.textContent = '按官网成绩查询页填写；这里不会自动读取账号的学年和学期。'; form.hidden = true; login.hidden = false; setStep(false); sync();
      message('请在官网切换账号，再回到本页继续。'); tool.querySelector('[data-grade-official]').focus();
    });
    year.addEventListener('input', manualOptions); form.elements.xqm.addEventListener('change', sync);
    upload.addEventListener('change', async function () {
      var file = upload.files && upload.files[0], current = ++revision;
      if (!file) return;
      // Clear previous account/range before parsing so an invalid file never leaves stale choices enabled.
      year.value = ''; term.set(manual, ''); sync();
      note.textContent = '按官网成绩查询页填写；这里不会自动读取账号的学年和学期。';
      try {
        if (file.size > 2 * 1024 * 1024) throw new Error('请选择小于 2 MB 的成绩查询 HTML 页面。');
        if (!/\.html?$/i.test(file.name)) throw new Error('请选择 HTML 格式的成绩查询页面。');
        var text = await file.text(); if (!alive || current !== revision) return;
        var years = optionsInPage(text, 'xnm'), terms = optionsInPage(text, 'xqm'); text = '';
        if (!years.length || !terms.length) throw new Error('该文件没有学年、学期下拉框，请按官网手动填写。');
        var selectedYear = years.find(function (item) { return item.selected; });
        if (!selectedYear && years.length === 1) selectedYear = years[0];
        if (!selectedYear) throw new Error('页面未标明选中的学年，请先在官网选择学年并重新保存，或手动填写。');
        year.value = selectedYear.value;
        var selectedTerm = terms.find(function (item) { return item.selected; });
        term.set([{ value: '', label: '请选择学期' }].concat(terms), selectedTerm ? selectedTerm.value : '');
        note.textContent = '已读取该文件中 ' + selectedYear.label + ' 的学期选项；修改学年后请重新核对官网。'; sync();
        message('选项已从文件读取，尚未向学校提交导出。');
      } catch (error) { if (alive && current === revision) message(error.message || '页面读取失败，请手动填写。', 'error'); }
      finally { if (alive && current === revision) upload.value = ''; }
    });
    form.addEventListener('submit', function (event) {
      if (!confirmed || !/^\d{4}$/.test(year.value) || !/^\d{1,3}$/.test(form.elements.xqm.value)) { event.preventDefault(); message('请先在官网登录，并选择学年和学期。', 'error'); return; }
      var host = form.querySelector('[data-grade-fields]'); host.replaceChildren();
      function field(name, value) { var input = document.createElement('input'); input.type = 'hidden'; input.name = name; input.value = value; host.appendChild(input); }
      field('dcclbh', 'JW_N305005_XSCXCJ'); field('pxfs', '0');
      COLUMNS.forEach(function (column) { field('exportModel.selectCol', column); });
      field('exportModel.exportWjgs', 'xls'); field('fileName', year.value + ' 学年成绩单');
      // Leave the trusted native form submission untouched. A new top-level school page handles the response.
      message('请求将交给学校处理。请查看新打开的学校页面和下载列表；本站不判断下载是否成功。');
    });
    sync(); cleanup = function () { alive = false; revision++; term.destroy(); };
  }
  if (typeof document$ !== 'undefined') document$.subscribe(init);
  else if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
