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
});
