/**
 * 猫猫图鉴前端控制器测试（docs/pets/gallery.js）
 *
 * 覆盖：分页默认数量与翻页、每页数量切换、窄屏默认值、相册弹窗的打开/翻页/关闭。
 * 脚本本身是 IIFE，这里通过 document$（MkDocs 即时导航的信号）驱动每次初始化，
 * 与浏览器里的加载方式一致。
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { beforeEach, describe, expect, it, vi } from 'vitest';

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
      `    <button class="pet-card__shot" type="button" aria-label="${name}"><img class="pet-photo" src="${photos[0]}" alt="${name}"></button>`,
      `    <a class="pet-card__plate" href="cats/${name}/"><span class="pet-card__name">${name}</span></a>`,
      '  </div>',
    );
  }
  return `<div class="pet-deck" id="pet-deck">\n${cards.join('\n')}\n</div>\n<nav class="pet-pager" id="pet-pager"></nav>`;
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

/** 通过自绘下拉面板选择每页数量 */
function choosePageSize(value) {
  document.querySelector('#pet-pager .pet-pager__size-btn').click();
  const option = Array.from(document.querySelectorAll('#pet-pager .pet-pager__size-option')).find(
    item => item.getAttribute('data-value') === String(value),
  );
  if (!option) throw new Error('下拉面板里没有 ' + value);
  option.click();
}

// 脚本在模块加载时执行一次；此时还没有卡牌，init() 会安全返回
new Function(source)();

beforeEach(() => {
  document.body.innerHTML = '';
});

describe('猫猫图鉴分页', () => {
  it('桌面默认每页 12 张，并渲染分页条与页码', () => {
    boot(deckHtml(30));
    expect(visibleCards()).toHaveLength(12);
    expect(visibleNames()[0]).toBe('猫1');
    expect(document.querySelectorAll('#pet-pager .pet-pager__num')).toHaveLength(3);
    expect(document.querySelector('#pet-pager .pet-pager__num.is-active').textContent).toBe('1');
    expect(document.querySelector('#pet-pager .pet-pager__meta').textContent).toBe('共 30 只 · 第 1/3 页');
  });

  it('窄屏默认每页 6 张', () => {
    boot(deckHtml(30), { mobile: true });
    expect(visibleCards()).toHaveLength(6);
    expect(document.querySelector('#pet-pager .pet-pager__meta').textContent).toBe('共 30 只 · 第 1/5 页');
  });

  it('下一页 / 页码 / 上一页都能切换，并在首末页禁用按钮', () => {
    boot(deckHtml(30));
    expect(pagerButton('上一页').disabled).toBe(true);

    pagerButton('下一页').click();
    expect(visibleNames()[0]).toBe('猫13');
    expect(pagerButton('上一页').disabled).toBe(false);

    Array.from(document.querySelectorAll('#pet-pager .pet-pager__num'))
      .find(button => button.textContent === '3')
      .click();
    expect(visibleNames()).toEqual(['猫25', '猫26', '猫27', '猫28', '猫29', '猫30']);
    expect(pagerButton('下一页').disabled).toBe(true);

    pagerButton('上一页').click();
    expect(document.querySelector('#pet-pager .pet-pager__num.is-active').textContent).toBe('2');
  });

  it('每页数量下拉面板可以改成 24 或全部，并可开合', () => {
    boot(deckHtml(30));
    const button = document.querySelector('#pet-pager .pet-pager__size-btn');
    const menu = document.querySelector('#pet-pager .pet-pager__size-menu');
    expect(button.textContent).toContain('12');
    expect(menu.hidden).toBe(true);
    expect(button.getAttribute('aria-expanded')).toBe('false');

    button.click();
    expect(menu.hidden).toBe(false);
    expect(button.getAttribute('aria-expanded')).toBe('true');
    expect(document.querySelectorAll('#pet-pager .pet-pager__size-option')).toHaveLength(4);
    expect(document.querySelector('#pet-pager .pet-pager__size-option.is-selected').textContent).toBe('12');
    button.click();
    expect(menu.hidden).toBe(true);

    choosePageSize(24);
    expect(menu.hidden).toBe(true);
    expect(document.querySelector('#pet-pager .pet-pager__size-btn').textContent).toContain('24');
    expect(visibleCards()).toHaveLength(24);
    expect(document.querySelectorAll('#pet-pager .pet-pager__num')).toHaveLength(2);

    choosePageSize(0);
    expect(document.querySelector('#pet-pager .pet-pager__size-btn').textContent).toContain('全部');
    expect(visibleCards()).toHaveLength(30);
    expect(document.querySelectorAll('#pet-pager .pet-pager__num')).toHaveLength(0);
    expect(document.querySelector('#pet-pager .pet-pager__meta').textContent).toBe('共 30 只');
  });

  it('卡牌数量不足一页时不渲染翻页按钮', () => {
    boot(deckHtml(5));
    expect(visibleCards()).toHaveLength(5);
    expect(document.querySelectorAll('#pet-pager .pet-pager__btn')).toHaveLength(0);
  });

  it('换页时滚动到卡牌区顶部', () => {
    boot(deckHtml(30));
    pagerButton('下一页').click();
    expect(window.scrollTo).toHaveBeenCalled();
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
});
