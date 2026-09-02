import { createRequire } from 'node:module';
import { describe, expect, it, vi } from 'vitest';

const require = createRequire(import.meta.url);
const likeList = require('../../docs/pets/pet-like-list.js');

function setup({ apiImpl } = {}) {
  document.body.innerHTML = '<button id="detail-trigger">点赞列表</button><div id="pet-like-list-modal" style="display:none"></div>';
  const api = vi.fn(apiImpl || (() => Promise.resolve({
    ok: true,
    data: {
      total: 1, page: 1, totalPages: 1,
      likes: [{ displayName: '点赞同学', avatarUrl: '', profileUrl: 'https://github.com/liker', likedAt: '2026-09-02T06:30:00.000Z' }],
    },
  })));
  let onClose = null;
  const openPetModal = vi.fn((modal, options) => {
    onClose = options.onClose;
    modal.style.display = 'flex';
  });
  const closePetModal = vi.fn((modal, options = {}) => {
    modal.style.display = 'none';
    if (onClose) onClose();
    if (options.restoreFocus !== false) document.getElementById('detail-trigger').focus();
  });
  const views = vi.fn(() => ({
    likeListModalHtml: ({ likes, total, page, totalPages, status, message }) => {
      if (status === 'loading') return '<button id="pet-like-list-close">关闭</button><p>加载</p>';
      if (status === 'error') return '<button id="pet-like-list-close">关闭</button><p>' + message + '</p><button id="pet-like-list-retry">重试</button>';
      return '<button id="pet-like-list-close">关闭</button><p>共 ' + total + ' 人，第 ' + page + '/' + totalPages + ' 页</p>' +
        likes.map(item => '<span>' + item.displayName + '</span>').join('') +
        '<button class="pet-like-list-page-btn" data-page="' + Math.max(1, page - 1) + '"' + (page === 1 ? ' disabled' : '') + '>上一页</button>' +
        '<button class="pet-like-list-page-btn" data-page="' + Math.min(totalPages, page + 1) + '"' + (page === totalPages ? ' disabled' : '') + '>下一页</button>';
    },
  }));
  const controller = likeList.createPetLikeList({
    document,
    $: selector => document.querySelector(selector),
    $all: (selector, root = document) => [...root.querySelectorAll(selector)],
    views,
    api,
    openPetModal,
    closePetModal,
  });
  return { api, controller, openPetModal, closePetModal };
}

describe('宠物投稿点赞列表控制器', () => {
  it('打开时只请求第 1 页，关闭后恢复详情入口焦点', async () => {
    const { api, controller, openPetModal, closePetModal } = setup();
    document.getElementById('detail-trigger').focus();

    await controller.openLikeList('pet_1');
    expect(api).toHaveBeenCalledWith('/api/pets/pet_1/likes?page=1&pageSize=20');
    expect(openPetModal).toHaveBeenCalledWith(document.getElementById('pet-like-list-modal'), expect.objectContaining({ label: '点赞列表', zIndex: 16000 }));
    expect(document.getElementById('pet-like-list-modal').textContent).toContain('点赞同学');

    document.getElementById('pet-like-list-close').click();
    expect(closePetModal).toHaveBeenCalledOnce();
    expect(document.activeElement).toBe(document.getElementById('detail-trigger'));
  });

  it('翻页仅请求目标页，并在网络失败时可重试当前页', async () => {
    let attempts = 0;
    const { api, controller } = setup({
      apiImpl: path => {
        const page = Number(new URLSearchParams(path.split('?')[1]).get('page'));
        attempts += 1;
        if (attempts === 2) return Promise.resolve({ ok: false, data: { message: '网络暂时不可用' } });
        return Promise.resolve({ ok: true, data: { total: 40, page, totalPages: 2, likes: [{ displayName: '第' + page + '页用户' }] } });
      },
    });
    await controller.openLikeList('pet_2');
    document.querySelectorAll('.pet-like-list-page-btn')[1].click();
    await new Promise(resolve => setTimeout(resolve, 0));
    expect(api).toHaveBeenLastCalledWith('/api/pets/pet_2/likes?page=2&pageSize=20');
    expect(document.getElementById('pet-like-list-modal').textContent).toContain('网络暂时不可用');

    document.getElementById('pet-like-list-retry').click();
    await new Promise(resolve => setTimeout(resolve, 0));
    expect(api).toHaveBeenLastCalledWith('/api/pets/pet_2/likes?page=2&pageSize=20');
    expect(document.getElementById('pet-like-list-modal').textContent).toContain('第2页用户');
  });

  it('关闭后的过期响应不会重新渲染弹窗', async () => {
    let resolveRequest;
    const pending = new Promise(resolve => { resolveRequest = resolve; });
    const { controller } = setup({ apiImpl: () => pending });
    const opening = controller.openLikeList('pet_3');
    controller.closeLikeList();
    resolveRequest({ ok: true, data: { total: 1, page: 1, totalPages: 1, likes: [{ displayName: '不应显示' }] } });
    await opening;
    expect(document.getElementById('pet-like-list-modal').style.display).toBe('none');
    expect(document.getElementById('pet-like-list-modal').textContent).not.toContain('不应显示');
  });
});
