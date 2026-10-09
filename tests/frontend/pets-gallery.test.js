/**
 * 猫猫图鉴前端控制器测试（docs/pets/gallery.js）
 *
 * 覆盖：分页默认数量与翻页、每页数量切换、窄屏默认值、相册弹窗的打开/翻页/关闭。
 * 脚本本身是 IIFE，这里通过 document$（MkDocs 即时导航的信号）驱动每次初始化，
 * 与浏览器里的加载方式一致。
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const source = readFileSync(resolve(process.cwd(), 'docs/pets/gallery.js'), 'utf8');

const handlers = [];
globalThis.document$ = { subscribe: fn => handlers.push(fn) };

function deckHtml(count, photosPerCat = 2) {
  const cards = [];
  for (let index = 0; index < count; index += 1) {
    const name = `猫${index + 1}`;
    const photos = Array.from({ length: photosPerCat }, (_, photo) => `photo-${index + 1}-${photo + 1}.webp`);
    cards.push(
      `  <div class="pet-card" data-name="${name}" data-photos="${photos.join('|')}">`,
      `    <button class="pet-card__shot" type="button" aria-label="${name}"><img class="pet-photo" data-pet-src="${photos[0]}" alt="${name}"></button>`,
      `    <a class="pet-card__plate" href="cats/${name}/"><span class="pet-card__name">${name}</span></a>`,
      '  </div>',
    );
  }
  return `<div class="pet-filter">
    <input class="pet-filter__input" id="pet-filter-input" type="search">
    <span class="pet-filter__count" id="pet-filter-count" role="status" aria-live="polite"></span>
  </div>
<div class="pet-deck" id="pet-deck">\n${cards.join('\n')}\n</div>\n<nav class="pet-pager" id="pet-pager"></nav>`;
}

function boot(html, { mobile = false } = {}) {
  document.body.innerHTML = html;
  window.matchMedia = vi.fn(query => ({
    matches: mobile && query.includes('max-width'),
    media: query,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
  }));
  window.scrollTo = vi.fn();
  handlers.forEach(handler => handler());
}

function visibleCards() {
  return Array.from(document.querySelectorAll('#pet-deck .pet-card')).filter(
    card => !card.classList.contains('is-hidden'),
  );
}

function visibleNames() {
  return visibleCards().map(card => card.getAttribute('data-name'));
}

function pagerButton(label) {
  return Array.from(document.querySelectorAll('#pet-pager .pet-pager__btn')).find(
    button => button.getAttribute('aria-label') === label,
  );
}

function choosePageSize(value) {
  const trigger = document.querySelector('.pet-pager__size-trigger');
  if (trigger.getAttribute('aria-expanded') === 'false') trigger.click();
  const option = document.querySelector('.pet-pager__size-option[data-value="' + value + '"]');
  if (!option) throw new Error('Missing page-size option ' + value);
  option.click();
}
function submitPage(value) {
  const input = document.querySelector('#pet-page-input');
  input.value = value;
  input.dispatchEvent(new Event('input', { bubbles: true }));
  document.querySelector('.pet-pager__jump').dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
}
function comboKey(key) {
  document.querySelector('.pet-pager__size-trigger').dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }));
}

// 脚本在模块加载时执行一次；此时还没有卡牌，init() 会安全返回
new Function(source)();

beforeEach(() => {
  document.body.innerHTML = '';
});
afterEach(() => vi.unstubAllGlobals());

describe('猫猫图鉴分页', () => {
  it('电脑默认 12 张，使用页码输入而不是数字按钮条', () => {
    boot(deckHtml(37));
    expect(visibleCards()).toHaveLength(12);
    expect(document.querySelector('#pet-page-input').value).toBe('1');
    expect(document.querySelector('.pet-pager__meta').textContent).toBe('共 37 只 · 第 1/4 页');
    expect(document.querySelectorAll('.pet-pager__num')).toHaveLength(0);
  });
  it('手机默认每页 8 张', () => {
    boot(deckHtml(37), { mobile: true });
    expect(visibleCards()).toHaveLength(8);
    expect(document.querySelector('.pet-pager__meta').textContent).toContain('第 1/5 页');
  });
  it('上一页、下一页和页码跳转不遗漏，末页按钮禁用', () => {
    boot(deckHtml(30));
    expect(pagerButton('上一页').disabled).toBe(true);
    pagerButton('下一页').click();
    expect(visibleNames()[0]).toBe('猫13');
    submitPage('3');
    expect(visibleNames()).toEqual(['猫25', '猫26', '猫27', '猫28', '猫29', '猫30']);
    expect(pagerButton('下一页').disabled).toBe(true);
    pagerButton('上一页').click();
    expect(document.querySelector('#pet-page-input').value).toBe('2');
    expect(document.activeElement).toBe(pagerButton('上一页'));
  });
  it('每页只支持 8/12/24，无全部和原生下拉框', () => {
    boot(deckHtml(37));
    expect([...document.querySelectorAll('[role="option"]')].map(x => x.dataset.value)).toEqual(['8', '12', '24']);
    expect(document.querySelector('#pet-pager select')).toBeNull();
    choosePageSize(24);
    expect(visibleCards()).toHaveLength(24);
    expect(document.querySelector('.pet-pager__size-trigger').textContent).toBe('24');
    expect(document.activeElement).toBe(document.querySelector('.pet-pager__size-trigger'));
    choosePageSize(8);
    expect(visibleCards()).toHaveLength(8);
    expect(document.querySelector('.pet-pager__meta').textContent).toContain('第 1/5 页');
  });
  it('空值、非整数、不合理数值和越界页码均保持当前页', () => {
    boot(deckHtml(37));
    for (const value of ['', '0', '-1', '1.5', '2e0', 'Infinity', 'abc', '5', '9999999999999999', '２', '1foo']) {
      submitPage(value);
      expect(visibleNames()[0]).toBe('猫1');
      expect(document.querySelector('#pet-page-input').getAttribute('aria-invalid')).toBe('true');
      expect(document.querySelector('#pet-page-error').hidden).toBe(false);
      expect(document.querySelector('#pet-page-error').textContent).toContain('1～4');
      expect(document.activeElement.id).toBe('pet-page-input');
    }
    submitPage(' 02 ');
    expect(visibleNames()[0]).toBe('猫13');
    expect(document.querySelector('#pet-page-input').value).toBe('2');
    expect(document.querySelector('#pet-page-input').hasAttribute('aria-invalid')).toBe(false);
    expect(document.querySelector('#pet-page-error').hidden).toBe(true);
  });
  it('重新输入清除错误，同页跳转也规范化数字', () => {
    boot(deckHtml(37));
    submitPage('0');
    const input = document.querySelector('#pet-page-input');
    input.value = '1'; input.dispatchEvent(new Event('input'));
    expect(input.hasAttribute('aria-invalid')).toBe(false);
    expect(document.querySelector('#pet-page-error').hidden).toBe(true);
    submitPage('01');
    expect(document.querySelector('#pet-page-input').value).toBe('1');
    expect(visibleCards()).toHaveLength(12);
  });
  it('主题化菜单支持方向键、首末选项、确认和 Escape', () => {
    boot(deckHtml(37));
    comboKey('ArrowDown');
    expect(document.querySelector('[role="listbox"]').hidden).toBe(false);
    expect(document.querySelector('[role="combobox"]').getAttribute('aria-activedescendant')).toBe('pet-size-12');
    comboKey('ArrowDown'); comboKey('Enter');
    expect(visibleCards()).toHaveLength(24);
    expect(document.querySelector('[role="listbox"]').hidden).toBe(true);
    comboKey('Home');
    expect(document.querySelector('[role="combobox"]').getAttribute('aria-activedescendant')).toBe('pet-size-8');
    comboKey('Escape');
    expect(visibleCards()).toHaveLength(24);
    comboKey(' '); comboKey('End'); comboKey('Enter');
    expect(document.querySelector('[role="option"][aria-selected="true"]').dataset.value).toBe('24');
  });
  it('点击外部或 Tab 离开关闭菜单，即时导航没有重复控件', () => {
    boot(deckHtml(37)); comboKey('Enter');
    document.body.click();
    expect(document.querySelector('[role="listbox"]').hidden).toBe(true);
    comboKey('Enter'); comboKey('Tab');
    expect(document.querySelector('[role="combobox"]').getAttribute('aria-expanded')).toBe('false');
    boot(deckHtml(37));
    expect(document.querySelectorAll('[role="combobox"]')).toHaveLength(1);
    expect(document.querySelectorAll('[role="option"]')).toHaveLength(3);
  });
  it('未访问页的缩略图没有 src，访问过的图片保留缓存', () => {
    boot(deckHtml(37), { mobile: true });
    expect(document.querySelectorAll('#pet-deck img[src]')).toHaveLength(8);
    expect(document.querySelectorAll('#pet-deck img:not([src])')).toHaveLength(29);
    submitPage('5');
    expect(visibleCards()).toHaveLength(5);
    expect(document.querySelectorAll('#pet-deck img[src]')).toHaveLength(13);
    submitPage('1');
    expect(document.querySelectorAll('#pet-deck img[src]')).toHaveLength(13);
  });
  it('筛选结果也分页，不一次加载所有匹配的图片', () => {
    boot(deckHtml(100), { mobile: true });
    const input = document.getElementById('pet-filter-input');
    input.value = '猫'; input.dispatchEvent(new Event('input'));
    expect(visibleCards()).toHaveLength(8);
    expect(document.querySelector('.pet-filter__count').textContent).toBe('找到 100 只');
    expect(document.querySelectorAll('#pet-deck img[src]')).toHaveLength(8);
    expect(document.querySelector('.pet-pager__meta').textContent).toContain('第 1/13 页');
    submitPage('13'); expect(visibleCards()).toHaveLength(4);
  });
  it('仅一页仍有禁用的前后按钮，并可输入页码 1', () => {
    boot(deckHtml(5));
    expect(pagerButton('上一页').disabled).toBe(true);
    expect(pagerButton('下一页').disabled).toBe(true);
    submitPage('1'); expect(visibleCards()).toHaveLength(5);
  });
  it('每页数量变化回到第一页且更新校验范围', () => {
    boot(deckHtml(37)); submitPage('4'); choosePageSize(24);
    expect(document.querySelector('#pet-page-input').value).toBe('1');
    submitPage('3'); expect(document.querySelector('#pet-page-error').textContent).toContain('1～2');
  });
  it('桌面固定四列，平板手机为两列', () => {
    const css = readFileSync(resolve(process.cwd(), 'docs/pets/index.md'), 'utf8');
    expect(css).toContain('grid-template-columns: repeat(4, minmax(0, 1fr))');
    expect(css).toContain('max-width: 900px');
    expect(css).toContain('grid-template-columns: repeat(2, minmax(0, 1fr))');
  });
  it('换页时滚动到卡牌区顶部', () => {
    boot(deckHtml(30)); pagerButton('下一页').click(); expect(window.scrollTo).toHaveBeenCalled();
  });
});

describe('猫猫相册弹窗', () => {
  function openFirstCard() {
    const shot = document.querySelector('#pet-deck .pet-card__shot');
    const event = new window.MouseEvent('click', { bubbles: true, cancelable: true, button: 0 });
    shot.dispatchEvent(event);
    return event;
  }

  it('点击照片打开弹窗并显示第一张与计数', () => {
    boot(deckHtml(3, 3));
    const shot = document.querySelector('#pet-deck .pet-card__shot');
    // 触发器必须是按钮：站内 <a> 会被 Material 的 navigation.instant 接管并跳转
    expect(shot.tagName).toBe('BUTTON');
    const event = openFirstCard();
    expect(event.defaultPrevented).toBe(true);
    expect(window.location.pathname).not.toContain('cats/');

    const viewer = document.getElementById('pet-viewer');
    expect(viewer.hidden).toBe(false);
    expect(document.body.classList.contains('pet-viewer-open')).toBe(true);
    expect(viewer.querySelector('.pet-viewer__title').textContent).toBe('猫1');
    expect(viewer.querySelector('.pet-viewer__count').textContent).toBe('1 / 3');
    expect(viewer.querySelector('.pet-viewer__img').getAttribute('src')).toBe('photo-1-1.webp');
    expect(viewer.querySelectorAll('.pet-viewer__dot')).toHaveLength(3);
    // 弹窗本身就是详情内容，不应再有跳转详情页的按钮
    expect(viewer.querySelector('.pet-viewer__link')).toBeNull();
  });

  it('箭头、页码圆点与键盘方向键都能翻页，Esc 关闭并恢复隐藏', () => {
    boot(deckHtml(3, 3));
    openFirstCard();
    const viewer = document.getElementById('pet-viewer');
    const img = viewer.querySelector('.pet-viewer__img');

    viewer.querySelector('.pet-viewer__nav--next').click();
    expect(img.getAttribute('src')).toBe('photo-1-2.webp');
    expect(viewer.querySelector('.pet-viewer__count').textContent).toBe('2 / 3');

    viewer.querySelector('.pet-viewer__nav--prev').click();
    viewer.querySelector('.pet-viewer__nav--prev').click();
    expect(img.getAttribute('src')).toBe('photo-1-3.webp');

    viewer.querySelectorAll('.pet-viewer__dot')[0].click();
    expect(img.getAttribute('src')).toBe('photo-1-1.webp');

    document.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'ArrowRight' }));
    expect(img.getAttribute('src')).toBe('photo-1-2.webp');

    document.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Escape' }));
    expect(viewer.hidden).toBe(true);
    expect(document.body.classList.contains('pet-viewer-open')).toBe(false);
  });

  it('点遮罩关闭弹窗', () => {
    boot(deckHtml(2, 1));
    openFirstCard();
    const viewer = document.getElementById('pet-viewer');
    viewer.querySelector('.pet-viewer__backdrop').click();
    expect(viewer.hidden).toBe(true);
  });

  it('只有一张照片时禁用左右箭头且不渲染圆点', () => {
    boot(deckHtml(2, 1));
    openFirstCard();
    const viewer = document.getElementById('pet-viewer');
    expect(viewer.querySelector('.pet-viewer__nav--prev').disabled).toBe(true);
    expect(viewer.querySelector('.pet-viewer__nav--next').disabled).toBe(true);
    expect(viewer.querySelectorAll('.pet-viewer__dot')).toHaveLength(0);
  });

  it('弹窗只读取当前卡牌的照片，不混入别的猫', () => {
    boot(deckHtml(3, 2));
    const shots = document.querySelectorAll('#pet-deck .pet-card__shot');
    shots[1].dispatchEvent(new window.MouseEvent('click', { bubbles: true, cancelable: true }));
    const viewer = document.getElementById('pet-viewer');
    expect(viewer.querySelector('.pet-viewer__title').textContent).toBe('猫2');
    expect(viewer.querySelector('.pet-viewer__img').getAttribute('src')).toBe('photo-2-1.webp');
  });

  it('即时导航重跑初始化后，旧弹窗与旧监听都会被清理', () => {
    boot(deckHtml(2, 2));
    openFirstCard();
    expect(document.querySelectorAll('#pet-viewer')).toHaveLength(1);

    boot(deckHtml(4, 2));
    expect(document.querySelectorAll('#pet-viewer')).toHaveLength(0);
    expect(visibleCards()).toHaveLength(4);
    openFirstCard();
    expect(document.querySelectorAll('#pet-viewer')).toHaveLength(1);
    expect(document.getElementById('pet-viewer').hidden).toBe(false);
  });

  it('打开时焦点落在关闭按钮，翻页用 aria-live 播报完整句子', () => {
    boot(deckHtml(2, 3));
    openFirstCard();
    const viewer = document.getElementById('pet-viewer');
    const status = viewer.querySelector('[role="status"]');

    expect(document.activeElement).toBe(viewer.querySelector('.pet-viewer__close'));
    expect(status.getAttribute('aria-live')).toBe('polite');
    expect(status.textContent).toBe('第 1 张，共 3 张：猫1');
    // 视觉上的计数对读屏是重复信息
    expect(viewer.querySelector('.pet-viewer__count').getAttribute('aria-hidden')).toBe('true');

    viewer.querySelector('.pet-viewer__nav--next').click();
    expect(status.textContent).toBe('第 2 张，共 3 张：猫1');
    viewer.querySelectorAll('.pet-viewer__dot')[2].click();
    expect(status.textContent).toBe('第 3 张，共 3 张：猫1');
  });

  it('Tab 焦点锁在弹窗内：末尾回到开头、开头 Shift+Tab 回到末尾、焦点在外面会被拉回来', () => {
    boot(deckHtml(2, 3));
    openFirstCard();
    const viewer = document.getElementById('pet-viewer');
    const panel = viewer.querySelector('.pet-viewer__panel');
    const close = viewer.querySelector('.pet-viewer__close');
    const lastDot = viewer.querySelectorAll('.pet-viewer__dot')[2];
    const tab = (shiftKey = false) => document.dispatchEvent(
      new window.KeyboardEvent('keydown', { key: 'Tab', shiftKey, bubbles: true, cancelable: true }),
    );

    // 末尾 → 开头
    lastDot.focus();
    expect(panel.contains(document.activeElement)).toBe(true);
    tab();
    expect(document.activeElement).toBe(close);

    // 开头 Shift+Tab → 末尾
    tab(true);
    expect(document.activeElement).toBe(lastDot);

    // 焦点在弹窗外（模拟点击背景/浏览器地址栏后回来）→ 拉回第一个可聚焦元素
    document.body.focus();
    tab();
    expect(document.activeElement).toBe(close);
  });

  it('关闭后焦点回到打开它的卡牌按钮', () => {
    boot(deckHtml(2, 3));
    const shot = document.querySelector('#pet-deck .pet-card__shot');
    shot.dispatchEvent(new window.MouseEvent('click', { bubbles: true, cancelable: true }));
    expect(document.activeElement).not.toBe(shot);

    document.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    expect(document.activeElement).toBe(shot);
  });
  it('按名字找猫：分页显示命中项并给出计数', () => {
    boot(deckHtml(6, 2));
    const input = document.getElementById('pet-filter-input');
    const pager = document.getElementById('pet-pager');
    const count = document.getElementById('pet-filter-count');
    expect(visibleNames().length).toBeGreaterThan(0);

    // 真打字：派发 input 事件（控制器就是监听它的）
    input.value = '猫3';
    input.dispatchEvent(new window.Event('input', { bubbles: true }));
    expect(visibleNames()).toEqual(['猫3']);
    expect(count.textContent).toBe('找到 1 只');
    expect(pager.hidden).toBe(false);

    // 没命中：全部隐藏 + 给一句人话
    input.value = '不存在的名字';
    input.dispatchEvent(new window.Event('input', { bubbles: true }));
    expect(visibleNames()).toEqual([]);
    expect(count.textContent).toContain('没有匹配');

    // 清空：恢复分页与计数
    input.value = '';
    input.dispatchEvent(new window.Event('input', { bubbles: true }));
    expect(count.textContent).toBe('');
    expect(pager.hidden).toBe(false);
    expect(visibleNames().length).toBeGreaterThan(0);
  });

  it('筛选是大小写不敏感的子串匹配，且即时导航重跑后依然生效', () => {
    boot(deckHtml(3, 1));
    const input = document.getElementById('pet-filter-input');
    input.value = '猫';
    input.dispatchEvent(new window.Event('input', { bubbles: true }));
    expect(visibleNames()).toEqual(['猫1', '猫2', '猫3']);

    // 模拟即时导航：重新初始化后，筛选框应该重新接上（而不是留着上一次的状态）
    input.value = '猫2';
    input.dispatchEvent(new window.Event('input', { bubbles: true }));
    boot(deckHtml(3, 1));
    const fresh = document.getElementById('pet-filter-input');
    fresh.value = '猫1';
    fresh.dispatchEvent(new window.Event('input', { bubbles: true }));
    expect(visibleNames()).toEqual(['猫1']);
  });
});
