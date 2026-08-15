import { createRequire } from 'node:module';
import { describe, expect, it, vi } from 'vitest';

const require = createRequire(import.meta.url);
const likes = require('../../docs/pets/pet-likes.js');

function setup(overrides = {}) {
  document.body.innerHTML = '<div id="pet-liked-section" style="display:none"></div>';
  const api = vi.fn().mockResolvedValue({
    ok: true,
    data: { pets: [{ id: 'pet_1', name: '小白' }], total: 1, page: 1, totalPages: 1 },
  });
  const views = vi.fn(() => ({
    likedPetsHtml: ({ pets, totalCount }) => '<button class="pet-card" data-id="' + (pets[0] ? pets[0].id : '') + '">' + totalCount + '</button>',
  }));
  const controller = likes.createPetLikes({
    $: selector => document.querySelector(selector),
    $all: (selector, root = document) => [...root.querySelectorAll(selector)],
    C: { border: '#ddd', fgDark: '#111', muted: '#666', soft: '#eee', fg: '#111', danger: '#d00' },
    esc: value => String(value),
    views,
    api,
    showToast: vi.fn(),
    onLoginRequired: vi.fn(),
    onOpenDetail: vi.fn(),
    getUser: () => ({ username: 'tester' }),
    PAGE_SIZE: 1,
    ...overrides,
  });
  return { api, controller, views };
}

describe('宠物前端我的收藏控制器', () => {
  it('打开后查询当前用户收藏并渲染列表', async () => {
    const { api, controller } = setup();
    await controller.openLikedSection();
    expect(api).toHaveBeenCalledWith('/api/my/liked-pets?page=1&pageSize=1');
    expect(document.getElementById('pet-liked-section').style.display).toBe('block');
    expect(document.getElementById('pet-liked-list').textContent).toBe('1');
    expect(document.getElementById('pet-liked-close')).toBeNull();
  });

  it('嵌入个人工作区时不强制滚动页面', async () => {
    const scrollIntoView = vi.fn();
    Element.prototype.scrollIntoView = scrollIntoView;
    const { controller } = setup();
    await controller.openLikedSection({ scroll: false });
    expect(scrollIntoView).not.toHaveBeenCalled();
  });

  it('取消点赞后立即移除已渲染卡片并重新查询', async () => {
    const { api, controller } = setup();
    await controller.openLikedSection();
    controller.removeLikedPet('pet_1');
    expect(document.getElementById('pet-liked-list').textContent).toBe('0');
    await Promise.resolve();
    expect(api).toHaveBeenCalledTimes(2);
  });

  it('未登录时引导登录而不发起收藏请求', async () => {
    const onLoginRequired = vi.fn();
    const { api, controller } = setup({ getUser: () => null, onLoginRequired });
    await controller.openLikedSection();
    expect(onLoginRequired).toHaveBeenCalledOnce();
    expect(api).not.toHaveBeenCalled();
  });

  it('分页：多页时渲染翻页按钮，点击下一页请求带上 page=2', async () => {
    // 渲染层生成真实的分页按钮（独立类名），控制器应绑定点击并携带页码请求
    document.body.innerHTML = '<div id="pet-liked-section" style="display:none"></div>';
    const api = vi.fn().mockImplementation((path) => {
      const q = new URLSearchParams(String(path).split('?')[1] || '');
      const page = Number(q.get('page') || 1);
      return Promise.resolve({
        ok: true,
        data: {
          pets: [{ id: 'pet_' + page, name: '收藏' + page, category: '猫猫', type: { name: '猫猫' } }],
          total: 25, page, pageSize: 1, totalPages: 25,
        },
      });
    });
    const views = vi.fn(() => ({
      likedPetsHtml: ({ pets, currentPage, totalPages, totalCount }) =>
        '<button class="pet-card" data-id="' + (pets[0] ? pets[0].id : '') + '">' + (pets[0] ? pets[0].name : '') + '</button>' +
        '<button class="pet-liked-page-btn" data-page="' + (currentPage + 1) + '">下一页</button>' +
        '<span>共 ' + totalCount + ' 只 · 第 ' + currentPage + '/' + totalPages + ' 页</span>',
    }));
    const controller = likes.createPetLikes({
      $: selector => document.querySelector(selector),
      $all: (selector, root = document) => [...root.querySelectorAll(selector)],
      C: { border: '#ddd', fgDark: '#111', muted: '#666', soft: '#eee', fg: '#111', danger: '#d00' },
      esc: value => String(value),
      views,
      api,
      showToast: vi.fn(),
      onLoginRequired: vi.fn(),
      onOpenDetail: vi.fn(),
      getUser: () => ({ username: 'tester' }),
      PAGE_SIZE: 1,
    });
    await controller.openLikedSection();
    expect(api).toHaveBeenLastCalledWith('/api/my/liked-pets?page=1&pageSize=1');
    expect(document.getElementById('pet-liked-list').textContent).toContain('共 25 只 · 第 1/25 页');
    // 点击“下一页” → 再次请求且 page=2
    document.querySelector('.pet-liked-page-btn').onclick();
    await new Promise(r => setTimeout(r, 0));
    expect(api).toHaveBeenLastCalledWith('/api/my/liked-pets?page=2&pageSize=1');
    expect(document.getElementById('pet-liked-list').textContent).toContain('第 2/25 页');
  });
});
