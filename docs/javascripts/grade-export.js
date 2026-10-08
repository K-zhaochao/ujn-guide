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
  function init() {
    var form = document.getElementById('grade-export-form');
    if (form === activeForm) return;
    if (cleanup) cleanup(); activeForm = form; cleanup = null;
    if (!form) return;
    var submit = form.querySelector('[type="submit"]'), cancel = form.querySelector('[data-grade-cancel]');
    var status = form.querySelector('[data-grade-status]'), password = form.elements.password;
    var loginPanel = form.querySelector('[data-grade-login]'), exportPanel = form.querySelector('[data-grade-export]');
    var logout = form.querySelector('[data-grade-logout]');
    var base = new URL('../../api/grade-export/', window.location.href), configValid = true;
    try {
      var configNode = document.getElementById('ujn-grade-config');
      var apiUrl = configNode && JSON.parse(configNode.textContent).apiUrl;
      if (apiUrl) {
        base = new URL(apiUrl);
        if (base.username || base.password || base.search || base.hash || !base.pathname.endsWith('/api/grade-export/') || (base.protocol !== 'https:' && !(base.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(base.hostname)))) throw new Error();
      }
    } catch (_) { configValid = false; }
    var retry = form.querySelector('[data-grade-retry]'), showPassword = form.querySelector('[data-grade-password-toggle]');
    if (showPassword) showPassword.addEventListener('click', function () { var showing = password.type === 'password'; password.type = showing ? 'text' : 'password'; showPassword.setAttribute('aria-pressed', String(showing)); showPassword.textContent = showing ? '隐藏密码' : '显示密码'; });
    function hidePassword() { password.type = 'password'; if (showPassword) { showPassword.setAttribute('aria-pressed', 'false'); showPassword.textContent = '显示密码'; } }
    var enabled = false, busy = false, token = '', ready = false, controller = null, expiryTimer = null, alive = true;
    var picks = {};
    form.querySelectorAll('[data-grade-select]').forEach(function (widget) {
      var name = widget.dataset.gradeSelect; picks[name] = picker(widget, name === 'year' ? '登录后读取学年' : name === 'term' ? '登录后读取学期' : '选择登录方式');
    });
    picks.mode.set([{ value: 'sso', label: '统一身份认证（学校入口）' }, { value: 'direct', label: '教务系统直接登录（正方）' }], 'sso');
    function message(text, kind) { if (!alive) return; status.textContent = text; status.dataset.kind = kind || 'info'; }
    function sync() {
      submit.disabled = busy || !enabled || (!!token && !ready); submit.textContent = token ? '导出 Excel 成绩单' : '登录并读取可查询学期';
      cancel.hidden = !busy; if (showPassword) showPassword.disabled = busy || !enabled || !!token; form.setAttribute('aria-busy', String(busy));
      ['user', 'password'].forEach(function (name) { form.elements[name].disabled = busy || !enabled || !!token; });
      picks.mode.disabled(busy || !enabled || !!token);
      picks.year.disabled(busy || !token); picks.term.disabled(busy || !token || !ready); logout.disabled = busy;
      loginPanel.hidden = !!token; exportPanel.hidden = !token;
      form.querySelector('[data-grade-step="login"]').toggleAttribute('aria-current', !token);
      form.querySelector('[data-grade-step="export"]').toggleAttribute('aria-current', !!token);
      form.querySelector('[data-grade-step="' + (token ? 'export' : 'login') + '"]').setAttribute('aria-current', 'step');
    }
    function releaseToken(value) {
      if (!value) return;
      fetch(new URL('logout', base).href, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-UJN-Grade-Export': '1' }, body: JSON.stringify({ sessionToken: value }), credentials: 'omit', cache: 'no-store', keepalive: true }).catch(function () {});
    }
    function resetSession() {
      var previous = token; token = ''; ready = false; clearTimeout(expiryTimer); password.value = ''; hidePassword();
      picks.year.set([], ''); picks.term.set([], ''); releaseToken(previous); sync();
    }
    function validPeriods(data) {
      return data && ['years', 'terms'].every(function (key) { return Array.isArray(data[key]) && data[key].length && data[key].every(function (option) { return typeof option.value === 'string' && typeof option.label === 'string'; }); })
        && data.years.some(function (option) { return option.value === data.year; }) && data.terms.some(function (option) { return option.value === data.term; });
    }
    function applyPeriods(data) {
      if (!validPeriods(data)) throw new Error('学校未返回完整的可查询学年、学期，请重新登录。');
      picks.year.set(data.years, data.year); picks.term.set(data.terms, data.term); ready = true;
    }
    async function request(action, payload) {
      var current = new AbortController(); controller = current;
      var timer = setTimeout(function () { current.abort(); }, 80000);
      try {
        var body = JSON.stringify(payload); if ('password' in payload) payload.password = '';
        var response = await fetch(new URL(action, base).href, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-UJN-Grade-Export': '1' }, body: body, signal: current.signal, credentials: 'omit', cache: 'no-store' }); body = '';
        if (current.signal.aborted || !alive) throw new DOMException('Cancelled', 'AbortError');
        if (!response.ok) {
          var errorData = await response.json().catch(function () { return {}; });
          if (response.status === 401 || errorData.sessionExpired) resetSession();
          throw new Error(errorData.message || '操作失败（HTTP ' + response.status + '）');
        }
        var result;
        if (action === 'export') {
          var type = (response.headers.get('content-type') || '').toLowerCase();
          if (!/application\/(vnd\.ms-excel|octet-stream)/.test(type)) throw new Error('服务返回的不是 Excel 文件，请检查部署配置。');
          result = { headers: response.headers, blob: await response.blob() };
        } else result = await response.json();
        if (current.signal.aborted || !alive) {
          if (action === 'login') releaseToken(result.sessionToken);
          throw new DOMException('Cancelled', 'AbortError');
        }
        return result;
      } finally {
        clearTimeout(timer); payload.password = ''; if (controller === current) controller = null;
      }
    }
    async function loadTerms() {
      if (!token || busy) return; ready = false; picks.term.set([], ''); busy = true; sync(); message('正在读取所选学年的可查询学期…');
      try { applyPeriods(await request('periods', { sessionToken: token, year: form.elements.year.value })); message('请选择学期，然后导出成绩。'); }
      catch (error) { if (error.name === 'AbortError') resetSession(); message(error.name === 'AbortError' ? '查询已取消或超时，请重新登录。' : error.message, 'error'); }
      finally { busy = false; if (alive) sync(); }
    }
    form.elements.year.addEventListener('change', loadTerms);
    logout.addEventListener('click', function () { resetSession(); message('已退出，请填写账号密码重新登录。'); });
    cancel.addEventListener('click', function () { if (controller) controller.abort(); });
    form.addEventListener('submit', async function (event) {
      event.preventDefault(); if (!enabled || busy || !form.reportValidity() || (token && !ready)) return;
      var loggingIn = !token, account = form.elements.user.value.trim();
      var payload = loggingIn ? { user: account, password: password.value, mode: form.elements.mode.value } : { sessionToken: token, year: form.elements.year.value, term: form.elements.term.value };
      password.value = ''; hidePassword(); busy = true; sync(); message(loggingIn ? '正在登录并读取账号可查询的学年、学期…' : '正在生成成绩单，请稍候…');
      try {
        var response = await request(loggingIn ? 'login' : 'export', payload);
        if (loggingIn) {
          var data = response;
          if (!alive) { releaseToken(data.sessionToken); return; }
          if (typeof data.sessionToken !== 'string' || !/^[\w-]{43}$/.test(data.sessionToken)) throw new Error('登录会话返回异常，请重试。');
          token = data.sessionToken; applyPeriods(data);
          form.querySelector('[data-grade-account]').textContent = '已登录 · ' + account;
          expiryTimer = setTimeout(function () { if (controller) controller.abort(); resetSession(); message('登录会话已到期，请重新登录。', 'error'); }, Math.min(600, Math.max(1, data.expiresIn || 600)) * 1000);
          message('已读取账号可查询的学年、学期。选择范围后导出。', 'success');
        } else {
          var blob = response.blob; if (!alive) return;
          if (!blob.size) throw new Error('学校返回了空文件，请换一个学年学期。');
          var name = '济大成绩单.xls', match = /filename\*=UTF-8''([^;]+)/i.exec(response.headers.get('content-disposition') || '');
          if (match) { try { name = decodeURIComponent(match[1]); } catch (_) {} }
          name = name.replace(/[\\/:*?"<>|\x00-\x1f]/g, '_');
          var url = URL.createObjectURL(blob), link = document.createElement('a'); link.href = url; link.download = name;
          document.body.appendChild(link); link.click(); link.remove(); setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
          message('已开始下载：' + name, 'success');
        }
      } catch (error) {
        if (loggingIn || error.name === 'AbortError') resetSession();
        message(error.name === 'AbortError' ? '操作已取消或超时，请重新登录。' : error.message, 'error');
      } finally { payload.password = ''; password.value = ''; busy = false; if (alive) sync(); }
    });
    var probe = null, probeTimer = null;
    function connect() {
      if (probe) probe?.abort(); clearTimeout(probeTimer);
      var currentProbe = new AbortController(); probe = currentProbe;
      probeTimer = setTimeout(function () { currentProbe.abort(); }, 5000);
      enabled = false; sync(); message('正在连接成绩导出…'); if (retry) retry.hidden = true;
      (configValid ? fetch(new URL('status', base).href, { credentials: 'omit', cache: 'no-store', signal: currentProbe.signal }) : Promise.reject(new Error()))
        .then(function (response) { if (!response.ok) throw new Error(); return response.json(); })
        .then(function (data) { if (!alive || probe !== currentProbe) return; if (data.enabled !== true) throw new Error(); enabled = true; sync(); message('填写账号密码，登录后选择学年和学期。'); })
        .catch(function () { if (!alive || probe !== currentProbe) return; enabled = false; sync(); message('成绩导出暂未开放，请稍后再试。', 'error'); if (retry) retry.hidden = false; })
        .finally(function () { if (probe === currentProbe) clearTimeout(probeTimer); });
    }
    if (retry) retry.addEventListener('click', connect); connect();
    cleanup = function () {
      alive = false; password.value = ''; if (controller) controller.abort(); probe?.abort(); clearTimeout(probeTimer); clearTimeout(expiryTimer);
      releaseToken(token); token = ''; Object.values(picks).forEach(function (pick) { pick.destroy(); }); window.removeEventListener('pagehide', cleanupPage);
    };
    function cleanupPage() { if (cleanup) cleanup(); activeForm = null; cleanup = null; }
    window.addEventListener('pagehide', cleanupPage);
  }
  if (typeof document$ !== 'undefined') document$.subscribe(init);
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
