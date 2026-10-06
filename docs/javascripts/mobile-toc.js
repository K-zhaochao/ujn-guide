/**
 * 窄屏下的「本页目录」。
 * =====================================
 *
 * Material 在 1220px 以下会把右侧目录栏整个隐藏，手机与平板读者因此看不到本页有哪些小节。
 * 之前用 theme.features 的 toc.integrate 解决，但它会让桌面端也失去右侧目录栏（第 9 轮回退），
 * 所以改成这里的做法：只在右侧目录栏不可见时，把正文标题收进一个 <details> 折叠块。
 *
 * - 判断依据是目录栏的实际布局，而不是猜媒体查询断点，缩窄/放宽窗口都能自动跟进；
 * - 标题取 article 里的 h2/h3，去掉 Material 的 permalink「¶」；
 * - 少于 2 个标题就不插入，避免一页只有一个小节时也占一块地方；
 * - 桌面端（目录栏可见）会把已有的折叠块移除。
 */

(function () {
  'use strict';

  var MOUNT_CLASS = 'ujn-mobile-toc';
  var MIN_HEADINGS = 2;
  var ARTICLE_SELECTOR = '.md-content__inner, article';

  function railVisible() {
    var rail = document.querySelector('.md-sidebar--secondary');
    if (!rail) return false;
    if (typeof rail.getBoundingClientRect !== 'function') return false;
    var box = rail.getBoundingClientRect();
    return box.width > 0 && box.height > 0;
  }

  function headingText(node) {
    var clone = node.cloneNode(true);
    var permalink = clone.querySelector('.headerlink');
    if (permalink && permalink.parentNode) permalink.parentNode.removeChild(permalink);
    return (clone.textContent || '').replace(/\s+/g, ' ').trim();
  }

  function collect(article) {
    var nodes = article.querySelectorAll('h2[id], h3[id]');
    var items = [];
    for (var index = 0; index < nodes.length; index += 1) {
      var node = nodes[index];
      if (node.closest && node.closest('.' + MOUNT_CLASS)) continue;
      var text = headingText(node);
      if (!text) continue;
      items.push({ id: node.id, text: text, level: node.tagName === 'H3' ? 3 : 2 });
    }
    return items;
  }

  function build(article) {
    var items = collect(article);
    if (items.length < MIN_HEADINGS) return null;

    var details = document.createElement('details');
    details.className = MOUNT_CLASS;

    var summary = document.createElement('summary');
    summary.textContent = '本页目录 · ' + items.length + ' 节';
    details.appendChild(summary);

    var list = document.createElement('ul');
    items.forEach(function (item) {
      var entry = document.createElement('li');
      if (item.level === 3) entry.className = 'ujn-mobile-toc__sub';
      var link = document.createElement('a');
      link.href = '#' + item.id;
      link.textContent = item.text;
      entry.appendChild(link);
      list.appendChild(entry);
    });
    details.appendChild(list);

    // 点完跳转就收起来，免得挡住正文
    details.addEventListener('click', function (event) {
      if (event.target && event.target.closest && event.target.closest('a')) details.open = false;
    });
    return details;
  }

  function articleRoot() {
    return document.querySelector(ARTICLE_SELECTOR);
  }

  function sync() {
    var article = articleRoot();
    if (!article) return null;
    var existing = article.querySelector('.' + MOUNT_CLASS);
    var wanted = railVisible() ? null : build(article);

    if (!wanted) {
      if (existing && existing.parentNode) existing.parentNode.removeChild(existing);
      return null;
    }
    if (existing) {
      existing.open = false;
      if (existing.parentNode) existing.parentNode.replaceChild(wanted, existing);
      return wanted;
    }
    var title = article.querySelector('h1');
    if (title && title.parentNode) title.parentNode.insertBefore(wanted, title.nextSibling);
    else article.insertBefore(wanted, article.firstChild);
    return wanted;
  }

  var lastWidth = window.innerWidth;
  function onResize() {
    // 只在跨过断点时重算，避免拖动窗口时反复重建 DOM
    if (Math.abs(window.innerWidth - lastWidth) < 80) return;
    lastWidth = window.innerWidth;
    sync();
  }

  function start() {
    sync();
    window.addEventListener('resize', onResize);
    if (typeof document$ !== 'undefined' && document$ && document$.subscribe) {
      document$.subscribe(function () { sync(); });
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start);
  } else {
    start();
  }

  // 供测试直接调用
  window.UJNMobileToc = { sync: sync, build: build, collect: collect, railVisible: railVisible };
})();
