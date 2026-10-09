import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { beforeEach, describe, expect, it } from 'vitest';

const require = createRequire(import.meta.url);
const source = readFileSync(require.resolve('../../docs/javascripts/mobile-toc.js'), 'utf8');

/** 造一页正文：h1 + 若干 h2/h3，标题里带 Material 的 permalink「¶」。 */
function newPage(headings) {
  const article = document.createElement('article');
  article.className = 'md-content__inner md-typeset';
  const title = document.createElement('h1');
  title.textContent = '宠物收集录';
  article.appendChild(title);
  headings.forEach(([level, id, text, withPermalink = true]) => {
    const node = document.createElement(level);
    node.id = id;
    node.textContent = text;
    if (withPermalink) {
      const link = document.createElement('a');
      link.className = 'headerlink';
      link.href = `#${id}`;
      link.textContent = '¶';
      node.appendChild(link);
    }
    article.appendChild(node);
  });
  const existing = document.querySelector('article');
  if (existing) existing.replaceWith(article);
  else document.body.appendChild(article);
  return article;
}

function installRail({ visible }) {
  const rail = document.createElement('aside');
  rail.className = 'md-sidebar md-sidebar--secondary';
  rail.getBoundingClientRect = () => ({
    width: visible ? 242 : 0, height: visible ? 400 : 0, top: 180, left: 1088, right: 1330, bottom: 580, x: 1088, y: 180,
  });
  document.body.appendChild(rail);
  return rail;
}

function boot() {
  window.eval(source);
  return window.UJNMobileToc;
}

describe('窄屏本页目录', () => {
  it('首页、工具和图鉴优先操作入口，不插入额外正文目录', () => {
    installRail({ visible: false });
    const article = newPage([['h2', 'a', '第一节'], ['h2', 'b', '第二节']]);
    const layout = document.createElement('div'); layout.dataset.pageKind = 'home';
    article.append(layout);
    const api = boot();
    ['home', 'tool', 'gallery'].forEach(kind => {
      layout.dataset.pageKind = kind;
      expect(api.sync()).toBeNull();
      expect(article.querySelector('.ujn-mobile-toc')).toBeNull();
    });
  });
  beforeEach(() => {
    document.body.replaceChildren();
    delete window.UJNMobileToc;
  });

  it('目录栏不可见时插入折叠块，链接去掉 permalink 的 ¶，h3 加子级类', () => {
    installRail({ visible: false });
    newPage([['h2', 'a', '第一节'], ['h3', 'b', '子节'], ['h2', 'c', '第二节']]);
    const block = boot().sync();

    expect(block.tagName).toBe('DETAILS');
    expect(block.className).toBe('ujn-mobile-toc');
    expect(block.querySelector('summary').textContent).toBe('本页目录 · 3 节');
    const links = [...block.querySelectorAll('a')];
    expect(links.map(link => link.textContent)).toEqual(['第一节', '子节', '第二节']);
    expect(links.map(link => link.getAttribute('href'))).toEqual(['#a', '#b', '#c']);
    expect(block.querySelectorAll('li')[1].className).toBe('ujn-mobile-toc__sub');
    // 插在 h1 之后，而不是最前面
    const article = document.querySelector('article');
    expect(article.children[1]).toBe(block);
    // 默认收起，点链接后收起
    expect(block.open).toBe(false);
    block.open = true;
    links[0].dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
    expect(block.open).toBe(false);
  });

  it('目录栏可见（桌面端）时不插入', () => {
    installRail({ visible: true });
    newPage([['h2', 'a', '第一节'], ['h2', 'b', '第二节']]);
    const api = boot();
    expect(api.sync()).toBeNull();
    expect(document.querySelector('.ujn-mobile-toc')).toBeNull();
  });

  it('少于两个标题不插入；从窄变宽会把已插入的移除', () => {
    const rail = installRail({ visible: false });
    newPage([['h2', 'only', '唯一小节']]);
    const api = boot();
    expect(api.sync()).toBeNull();

    newPage([['h2', 'a', '第一节'], ['h2', 'b', '第二节']]);
    expect(api.sync()).not.toBeNull();
    expect(document.querySelectorAll('.ujn-mobile-toc')).toHaveLength(1);

    // 窗口变宽 → 目录栏出现 → 折叠块应被移除
    rail.getBoundingClientRect = () => ({ width: 242, height: 400, top: 0, left: 0, right: 242, bottom: 400, x: 0, y: 0 });
    expect(api.sync()).toBeNull();
    expect(document.querySelector('.ujn-mobile-toc')).toBeNull();
  });

  it('重复 sync 不会堆出多个折叠块，并跟随新的页面内容更新', () => {
    installRail({ visible: false });
    newPage([['h2', 'a', '第一节'], ['h2', 'b', '第二节']]);
    const api = boot();
    api.sync();
    api.sync();
    expect(document.querySelectorAll('.ujn-mobile-toc')).toHaveLength(1);

    newPage([['h2', 'x', '新的第一节'], ['h2', 'y', '新的第二节'], ['h2', 'z', '新的第三节']]);
    const block = api.sync();
    expect(document.querySelectorAll('.ujn-mobile-toc')).toHaveLength(1);
    expect(block.querySelector('summary').textContent).toBe('本页目录 · 3 节');
    expect([...block.querySelectorAll('a')].map(link => link.textContent)).toEqual(['新的第一节', '新的第二节', '新的第三节']);
  });

  it('页面没有正文容器时安全返回', () => {
    installRail({ visible: false });
    document.body.replaceChildren();
    expect(boot().sync()).toBeNull();
  });
});
