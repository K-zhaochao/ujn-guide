/**
 * 💬 站内 GitHub Issues 列表
 * =====================================
 *
 * 把公开仓库的 issue 直接列在反馈页上，避免重复提问。
 *
 * 要求：仓库必须是公开的。公开仓库用 GitHub 匿名 API 即可读取（每小时 60 次 / 每个 IP），
 * 不需要也不能放 token —— 静态页面里的 token 等于公开。私有仓库只能改成构建时抓取。
 * 如果加载失败（限流、断网、仓库改名），页面会提示并保留直达仓库的链接。
 *
 * 只有页面里存在 #gh-issues 容器时才工作；容器用 data-repo / data-state 配置。
 */

(function () {
  'use strict';

  var API = 'https://api.github.com';
  var PER_PAGE = 20;

  function relativeTime(iso) {
    var then = new Date(iso).getTime();
    if (isNaN(then)) return '';
    var minutes = Math.floor((Date.now() - then) / 60000);
    if (minutes < 1) return '刚刚';
    if (minutes < 60) return minutes + ' 分钟前';
    var hours = Math.floor(minutes / 60);
    if (hours < 24) return hours + ' 小时前';
    var days = Math.floor(hours / 24);
    if (days < 30) return days + ' 天前';
    var date = new Date(then);
    return date.getFullYear() + '-' + String(date.getMonth() + 1).padStart(2, '0') + '-' +
      String(date.getDate()).padStart(2, '0');
  }

  function buildRow(repo, issue) {
    var item = document.createElement('li');
    item.className = 'gh-issue';

    var title = document.createElement('a');
    title.className = 'gh-issue__title';
    title.href = 'https://github.com/' + repo + '/issues/' + issue.number;
    title.target = '_blank';
    title.rel = 'noopener noreferrer';
    var number = document.createElement('span');
    number.className = 'gh-issue__number';
    number.textContent = '#' + issue.number;
    title.appendChild(number);
    title.appendChild(document.createTextNode(issue.title));
    item.appendChild(title);

    if (Array.isArray(issue.labels) && issue.labels.length) {
      var labels = document.createElement('span');
      labels.className = 'gh-issue__labels';
      issue.labels.slice(0, 4).forEach(function (label) {
        var chip = document.createElement('span');
        chip.className = 'gh-issue__label';
        chip.textContent = typeof label === 'string' ? label : label.name;
        labels.appendChild(chip);
      });
      item.appendChild(labels);
    }

    var meta = document.createElement('span');
    meta.className = 'gh-issue__meta';
    var author = issue.user && issue.user.login ? issue.user.login : '匿名';
    meta.textContent = '@' + author + ' · ' + relativeTime(issue.created_at) +
      ' · 💬 ' + (issue.comments || 0);
    item.appendChild(meta);

    return item;
  }

  function render(host, state) {
    var repo = host.getAttribute('data-repo');
    var list = host.querySelector('.gh-issues__list');
    var status = host.querySelector('.gh-issues__status');
    if (!repo || !list || !status) return;

    list.textContent = '';
    status.textContent = '正在加载 GitHub 上的 issue…';
    status.hidden = false;

    // 缓存挂在容器上：同一个页面视图内切换页签不重复请求，
    // 重新进入页面（navigation.instant 会换掉容器）时自然失效。
    var cache = host.__ghIssuesCache || (host.__ghIssuesCache = {});
    var cached = cache[state];
    if (cached) {
      paint(cached);
      return;
    }

    fetch(API + '/repos/' + repo + '/issues?state=' + state + '&per_page=' + PER_PAGE + '&sort=updated', {
      headers: { Accept: 'application/vnd.github+json' },
    })
      .then(function (response) {
        if (!response.ok) throw new Error('HTTP ' + response.status);
        return response.json();
      })
      .then(function (issues) {
        // 仓库里的 Pull Request 也会出现在 issues 接口里，这里只保留真正的 issue
        var only = issues.filter(function (issue) { return !issue.pull_request; });
        cache[state] = only;
        paint(only);
      })
      .catch(function (error) {
        status.textContent = '暂时读不到 GitHub issue（' + error.message +
          '，可能是匿名接口限流）。可以直接点上面的按钮去仓库里查看或提交。';
        status.hidden = false;
      });

    function paint(issues) {
      list.textContent = '';
      if (!issues.length) {
        status.textContent = state === 'open' ?
          '目前没有开放中的 issue，欢迎提第一个 🙌' :
          '还没有已关闭的 issue。';
        status.hidden = false;
        return;
      }
      issues.forEach(function (issue) { list.appendChild(buildRow(repo, issue)); });
      status.hidden = true;
    }
  }

  function init() {
    var host = document.getElementById('gh-issues');
    if (!host) return;

    var tabs = Array.prototype.slice.call(host.querySelectorAll('.gh-issues__tab'));
    tabs.forEach(function (tab) {
      tab.addEventListener('click', function () {
        tabs.forEach(function (other) {
          var active = other === tab;
          other.classList.toggle('is-active', active);
          other.setAttribute('aria-selected', active ? 'true' : 'false');
        });
        render(host, tab.getAttribute('data-state'));
      });
    });

    var initial = host.querySelector('.gh-issues__tab.is-active');
    render(host, (initial && initial.getAttribute('data-state')) || host.getAttribute('data-state') || 'open');
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  // 兼容 MkDocs navigation.instant：每次进入该页面后重新接管
  if (typeof document$ !== 'undefined' && document$.subscribe) {
    document$.subscribe(function () { init(); });
  }
})();
