(function () {
  'use strict';
  var API = 'https://api.github.com', PER_PAGE = 10, activeHost = null, dispose = null;
  function el(tag, cls, text) { var node = document.createElement(tag); node.className = cls || ''; if (text !== undefined) node.textContent = text; return node; }
  function link(repo, number, text, anchor) { var node = el('a', '', text); node.href = 'https://github.com/' + repo + '/issues/' + number + (anchor || ''); node.target = '_blank'; node.rel = 'noopener noreferrer'; return node; }
  function relativeTime(iso) {
    var date = new Date(iso); if (isNaN(date.getTime())) return '';
    var days = Math.floor(Math.max(0, Date.now() - date.getTime()) / 86400000);
    return days === 0 ? '今天' : days < 30 ? days + ' 天前' : date.toLocaleDateString('zh-CN');
  }
  function header(entry) {
    var node = el('div', 'gh-issue__header'), author = entry.user && entry.user.login || '同学';
    var avatarUrl = entry.user && entry.user.avatar_url || '', avatar;
    if (/^https:\/\/avatars\.githubusercontent\.com\//.test(avatarUrl)) { avatar = el('img', 'gh-issue__avatar'); avatar.src = avatarUrl; avatar.alt = ''; avatar.loading = 'lazy'; avatar.referrerPolicy = 'no-referrer'; }
    else avatar = el('span', 'gh-issue__avatar', author.slice(0, 1).toUpperCase());
    node.append(avatar, el('span', 'gh-issue__meta', '@' + author + ' · ' + relativeTime(entry.created_at) + (typeof entry.comments === 'number' ? ' · 💬 ' + entry.comments : ''))); return node;
  }
  function init() {
    var host = document.getElementById('gh-issues'); if (host === activeHost) return;
    if (dispose) dispose(); activeHost = host; dispose = null; if (!host) return;
    var repo = host.dataset.repo; if (!/^[\w.-]+\/[\w.-]+$/.test(repo || '')) return;
    var list = host.querySelector('.gh-issues__list'), status = host.querySelector('.gh-issues__status'); if (!list || !status) return;
    var tabs = Array.from(host.querySelectorAll('.gh-issues__tab')), cache = {}, controllers = new Set(), alive = true, revision = 0, page = 1, state = host.dataset.state || 'open';
    var nav = host.querySelector('.gh-issues__pagination');
    async function request(path) {
      var controller = new AbortController(); controllers.add(controller);
      var timer = setTimeout(function () { controller.abort(); }, 12000);
      try {
        var response = await fetch(API + '/repos/' + repo + path, { headers: { Accept: 'application/vnd.github.text+json' }, signal: controller.signal });
        if (!response.ok) throw new Error('GitHub 暂时没有响应，请稍后重试，或打开全部留言。');
        var data = await response.json(); if (!Array.isArray(data)) throw new Error('留言暂时加载失败，请稍后重试。');
        var pagination = response.headers && response.headers.get('link') || '';
        return { items: data, next: pagination ? /rel="next"/.test(pagination) : data.length === PER_PAGE };
      } finally { clearTimeout(timer); controllers.delete(controller); }
    }
    function buildRow(issue) {
      var item = el('li', 'gh-issue'), title = link(repo, issue.number, ''); title.className = 'gh-issue__title';
      title.append(el('span', 'gh-issue__number', '#' + issue.number), document.createTextNode(issue.title || '校园留言'));
      item.append(header(issue), title, el('p', 'gh-issue__body', issue.body_text || issue.body || '这条留言还没有详细说明。'));
      if (Array.isArray(issue.labels) && issue.labels.length) { var labels = el('div', 'gh-issue__labels'); issue.labels.slice(0, 4).forEach(function (label) { labels.appendChild(el('span', 'gh-issue__label', typeof label === 'string' ? label : label.name)); }); item.appendChild(labels); }
      var actions = el('div', 'gh-issue__actions'), expand = el('button', 'gh-issue__expand', '查看回复（' + (issue.comments || 0) + '）'); expand.type = 'button'; expand.setAttribute('aria-expanded', 'false');
      var replies = el('div', 'gh-replies'); replies.id = 'gh-replies-' + issue.number; replies.hidden = true; expand.setAttribute('aria-controls', replies.id);
      var replyStatus = el('p', 'gh-replies__status'), replyList = el('div', 'gh-replies__list'), more = el('button', 'gh-replies__more', '加载更多回复'); more.type = 'button'; more.hidden = true; replies.append(replyStatus, replyList, more);
      var replyPage = 1, loaded = false, loading = false;
      async function loadReplies() {
        if (loading) return; loading = true; more.disabled = true; replyStatus.textContent = '正在加载回复…';
        try {
          var result = await request('/issues/' + issue.number + '/comments?per_page=' + PER_PAGE + '&page=' + replyPage);
          if (!alive || !item.isConnected) return;
          result.items.forEach(function (entry) { var row = el('article', 'gh-reply'); row.append(header(entry), el('p', 'gh-reply__body', entry.body_text || entry.body || '')); replyList.appendChild(row); });
          loaded = true; replyPage++; more.textContent = '加载更多回复'; more.hidden = !result.next; replyStatus.textContent = replyList.children.length ? '' : '还没有回复，一起来聊聊。';
        } catch (error) { if (alive && item.isConnected) { replyStatus.textContent = error.message; more.hidden = false; more.textContent = '重试加载回复'; } }
        finally { loading = false; more.disabled = false; }
      }
      expand.addEventListener('click', function () { replies.hidden = !replies.hidden; expand.setAttribute('aria-expanded', String(!replies.hidden)); if (!replies.hidden && !loaded) loadReplies(); });
      more.addEventListener('click', loadReplies); actions.append(expand, link(repo, issue.number, '去 GitHub 回复 ↗', '#new_comment_field')); item.append(actions, replies); return item;
    }
    async function render() {
      var mine = ++revision, key = state + ':' + page, requestedState = state;
      list.replaceChildren(); status.hidden = false; status.textContent = '正在加载留言…'; if (nav) nav.hidden = true;
      try {
        var result = cache[key] || await request('/issues?state=' + state + '&per_page=' + PER_PAGE + '&page=' + page + '&sort=updated');
        if (!alive || mine !== revision) return; cache[key] = result;
        var issues = result.items.filter(function (issue) { return !issue.pull_request && Number.isInteger(issue.number) && issue.number > 0; });
        issues.forEach(function (issue) { list.appendChild(buildRow(issue)); });
        status.hidden = !!issues.length;
        status.textContent = requestedState === 'open' ? '当前没有留言，欢迎提第一个建议 🙌' : '这一页还没有已处理的留言。';
        if (nav) {
          nav.replaceChildren(); nav.hidden = page === 1 && !result.next;
          var previous = el('button', '', '上一页'), next = el('button', '', '下一页'), summary = el('span', '', '第 ' + page + ' 页'); previous.type = next.type = 'button'; previous.disabled = page <= 1; next.disabled = !result.next;
          previous.addEventListener('click', function () { page--; render(); }); next.addEventListener('click', function () { page++; render(); }); nav.append(previous, summary, next);
        }
      } catch (error) { if (alive && mine === revision) { status.textContent = error.message; status.hidden = false; } }
    }
    tabs.forEach(function (tab) {
      tab.addEventListener('click', function () { state = tab.dataset.state; page = 1; tabs.forEach(function (other) { var selected = other === tab; other.classList.toggle('is-active', selected); other.setAttribute('aria-selected', String(selected)); }); render(); });
      tab.addEventListener('keydown', function (event) { if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return; event.preventDefault(); var index = event.key === 'Home' ? 0 : event.key === 'End' ? tabs.length - 1 : (tabs.indexOf(tab) + (event.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length; tabs[index].focus(); tabs[index].click(); });
    });
    var composer = host.querySelector('.gh-composer');
    if (composer) composer.addEventListener('submit', function (event) {
      event.preventDefault(); if (!composer.reportValidity()) return;
      var title = composer.elements.title.value.trim(), body = composer.elements.body.value.trim(); if (!title || !body) return;
      var url = new URL('https://github.com/' + repo + '/issues/new'); url.searchParams.set('title', title); url.searchParams.set('body', body);
      if (url.href.length > 7500) { status.hidden = false; status.textContent = '留言较长，请精简后再发布。'; return; }
      window.open(url.href, '_blank', 'noopener,noreferrer');
    });
    dispose = function () { alive = false; revision++; controllers.forEach(function (controller) { controller.abort(); }); }; render();
  }
  if (typeof document$ !== 'undefined' && document$.subscribe) document$.subscribe(init);
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
