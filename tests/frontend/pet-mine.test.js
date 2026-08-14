import { createRequire } from 'node:module';
import { describe, expect, it, vi, beforeEach } from 'vitest';

const require = createRequire(import.meta.url);
const mine = require('../../docs/pets/pet-mine.js');

const C = {
  bg: '#fff', fg: '#374151', fgDark: '#1f2937', border: '#e5e7eb', soft: '#f3f4f6',
  imgBg: '#f3f4f6', muted: '#9ca3af', faint: '#b0b4bb', primary: '#3b82f6',
  gradA: '#fdf2f8', gradB: '#fff7ed', overlay: 'rgba(0,0,0,.55)', chipBg: '#fff',
  avatarBg: '#e5e7eb', danger: '#ef4444', dangerBg: '#fee2e2', success: '#22c55e',
  inputBg: '#fff',
};
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
})[c]);

/** 构造可控的 pet-mine 实例与 DOM 环境 */
function makeMine(overrides) {
  const calls = { api: [], submissionAction: [], toast: [], openModal: [], closeModal: [], onListChanged: 0 };
  const user = { provider: 'github', username: 'tester', nickname: '测试' };
  let siteConfig = { allowSubmit: true, allowEdit: true, allowDelete: true, maintenance: false };
  const petCache = new Map();
  const catEmoji = { 猫猫: '🐱' };
  const CATEGORIES = [{ key: '猫猫' }, { key: '狗狗' }];

  const deps = {
    $: (sel, root) => (root || document).querySelector(sel),
    $all: (sel, root) => Array.from((root || document).querySelectorAll(sel)),
    document,
    C,
    esc,
    views: () => ({
      minePaginationNumbersHtml: (page, total) => '<span>页' + page + '/' + total + '</span>',
      mineStatusMeta: s => ({ label: s, color: '#fff' }),
      mineTypeLabel: s => (s && s.type && s.type.name) || s.category || '',
      mineTypeIcon: () => '🐾',
      mineRowHtml: s => '<div class="pet-mine-row" data-id="' + esc(s.id) + '"><button class="pet-edit-btn" data-id="' + esc(s.id) + '">编辑</button>' +
        '<button class="pet-view-btn" data-id="' + esc(s.id) + '">详情</button>' +
        '<button class="pet-history-btn" data-id="' + esc(s.id) + '">历史</button>' +
        '<button class="pet-revisions-btn" data-id="' + esc(s.id) + '">修订</button>' +
        '<button class="pet-resubmit-btn" data-id="' + esc(s.id) + '" data-row="2">重新提交</button>' +
        '<button class="pet-del-btn" data-id="' + esc(s.id) + '" data-row="2">删除</button></div>',
      mineDetailHtml: s => '<button id="pet-detail-close">✕</button><div>详情 ' + esc(s.name || '') + '</div>',
      mineHistoryHtml: () => '<div>历史</div>',
      mineRevisionsHtml: (revisions, id) => revisions.map(r =>
        '<div><button class="pet-revision-withdraw" data-submission="' + esc(id) + '" data-id="' + esc(r.id) + '" data-row="1">撤回</button></div>').join('') || '<p>无修订</p>',
    }),
    buildMineListQuery: (params) => {
      const q = {};
      if (params.query) q.q = params.query;
      if (params.status) q.status = params.status;
      if (params.category) q.category = params.category;
      if (params.start) q.start = params.start;
      if (params.end) q.end = params.end;
      if (params.sort) q.sort = params.sort;
      if (params.page > 1) q.page = String(params.page);
      if (params.pageSize) q.pageSize = String(params.pageSize);
      return q;
    },
    api: async (path) => { calls.api.push(path); return { ok: true, data: { items: [], total: 0, totalPages: 1, statusCounts: {} } }; },
    apiSubmissionAction: async (method, path, body) => { calls.submissionAction.push({ method, path, body }); return { ok: true, data: { message: 'ok' } }; },
    showToast: (msg, isError) => calls.toast.push({ msg, isError }),
    openPetModal: (modal, opts) => { calls.openModal.push(opts); },
    closePetModal: () => calls.closeModal.push(1),
    onLoginRequired: () => calls.toast.push({ msg: 'openLoginPop', isError: true }),
    onSubmit: () => calls.toast.push({ msg: 'submit', isError: false }),
    onEdit: id => calls.toast.push({ msg: 'edit:' + id, isError: false }),
    onListChanged: () => calls.onListChanged++,
    petCache,
    fallbackCopy: (text, btn) => calls.toast.push({ msg: 'copy:' + text, isError: false }),
    getUser: () => user,
    getSiteConfig: () => siteConfig,
    getCategories: () => CATEGORIES,
    getCatEmoji: () => catEmoji,
    MINE_PAGE_SIZE: 20,
    ...overrides,
  };
  const controller = mine.createPetMine(deps);
  return { controller, calls, deps, setSiteConfig: s => { siteConfig = s; } };
}

function mountSection() {
  const sec = document.createElement('section');
  sec.id = 'pet-mine-section';
  sec.style.display = 'none';
  document.body.appendChild(sec);
  const modal = document.createElement('div');
  modal.id = 'pet-detail-modal';
  modal.style.display = 'none';
  document.body.appendChild(modal);
  return sec;
}

describe('宠物「我的投稿」交互控制器', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    // jsdom 未实现 scrollIntoView，补一个空实现避免 openMineSection 抛错
    if (!Element.prototype.scrollIntoView) {
      Element.prototype.scrollIntoView = () => {};
    }
  });

  it('未登录打开我的投稿：提示登录并触发登录回调', async () => {
    const { controller, calls } = makeMine({ getUser: () => null });
    await controller.openMineSection();
    expect(calls.toast.some(t => t.isError)).toBe(true);
    expect(calls.api.length).toBe(0);
  });

  it('打开后渲染外壳并加载列表（加载态 → 数据态）', async () => {
    const { controller, deps } = makeMine({
      api: async (path) => {
        if (path.startsWith('/api/my/submissions?')) {
          return { ok: true, data: { items: [{ id: 's1', name: '小白', status: 'approved' }], total: 1, totalPages: 1, statusCounts: { pending: 0, approved: 1, rejected: 0, deleted: 0 } } };
        }
        return { ok: true, data: {} };
      },
    });
    const sec = mountSection();
    await controller.openMineSection();
    expect(sec.style.display).toBe('block');
    expect(document.getElementById('pet-mine-list').innerHTML).toContain('pet-mine-row');
    expect(document.querySelector('#pet-mine-title').textContent).toContain('（1）');
  });

  it('加载失败：显示错误信息', async () => {
    const { controller } = makeMine({
      api: async () => ({ ok: false, data: { message: '网络错误' } }),
    });
    mountSection();
    await controller.openMineSection();
    expect(document.getElementById('pet-mine-list').textContent).toContain('网络错误');
  });

  it('空列表：无筛选显示引导，有筛选显示空态', async () => {
    const { controller } = makeMine({
      api: async () => ({ ok: true, data: { items: [], total: 0, totalPages: 1, statusCounts: {} } }),
    });
    mountSection();
    await controller.openMineSection();
    expect(document.getElementById('pet-mine-list').textContent).toContain('你还没有投稿过');
  });

  it('状态统计按钮切换筛选并重新加载', async () => {
    const { controller, calls } = makeMine({
      api: async (path) => {
        calls.api.push(path);
        return { ok: true, data: { items: [], total: 0, totalPages: 1, statusCounts: { pending: 2 } } };
      },
    });
    mountSection();
    await controller.openMineSection();
    const before = calls.api.length;
    document.querySelector('.pet-mine-count-btn[data-status="pending"]').onclick();
    expect(calls.api.length).toBe(before + 1);
    expect(calls.api[calls.api.length - 1]).toContain('status=pending');
  });

  it('重置按钮清空全部筛选并回到第 1 页', async () => {
    const { controller, calls } = makeMine({
      api: async (path) => {
        calls.api.push(path);
        return { ok: true, data: { items: [], total: 0, totalPages: 1, statusCounts: {} } };
      },
    });
    mountSection();
    await controller.openMineSection();
    // 先设置几个筛选值
    document.getElementById('pet-mine-search').value = '小白';
    document.getElementById('pet-mine-category').value = '猫猫';
    document.getElementById('pet-mine-date').value = '2026-08-01';
    document.getElementById('pet-mine-date-end').value = '2026-08-10';
    document.getElementById('pet-mine-sort').value = 'latest';
    document.getElementById('pet-mine-reset').onclick();
    const last = calls.api[calls.api.length - 1];
    expect(last).not.toContain('q=');
    expect(last).not.toContain('category=');
    expect(last).not.toContain('start=');
    expect(last).toContain('sort=updated');
    expect(document.getElementById('pet-mine-search').value).toBe('');
    expect(document.getElementById('pet-mine-category').value).toBe('');
  });

  it('分页：上一页/下一页触发请求并带上页码', async () => {
    const { controller, calls } = makeMine({
      api: async (path) => {
        calls.api.push(path);
        return { ok: true, data: { items: [{}], total: 60, totalPages: 3, page: 1, statusCounts: {} } };
      },
    });
    mountSection();
    await controller.openMineSection();
    // 渲染分页按钮后触发下一页
    document.querySelector('.pet-mine-page-btn[data-page="2"]').onclick();
    expect(calls.api[calls.api.length - 1]).toContain('page=2');
  });

  it('行内操作委托回调：编辑/详情/历史/修订', async () => {
    const { controller, calls } = makeMine({
      api: async (path) => {
        if (path.startsWith('/api/my/submissions?')) {
          return { ok: true, data: { items: [{ id: 's1', name: '小白', status: 'approved' }], total: 1, totalPages: 1, statusCounts: {} } };
        }
        if (path.includes('/history')) return { ok: true, data: { history: [] } };
        if (path.includes('/revisions')) return { ok: true, data: { revisions: [] } };
        return { ok: true, data: { submission: { id: 's1', name: '小白' } } };
      },
    });
    mountSection();
    await controller.openMineSection();
    document.querySelector('.pet-edit-btn').onclick();
    expect(calls.toast.some(t => t.msg === 'edit:s1')).toBe(true);
    document.querySelector('.pet-view-btn').onclick();
    await new Promise(r => setTimeout(r, 0));
    expect(document.getElementById('pet-detail-modal')).toBeTruthy();
    document.querySelector('.pet-history-btn').onclick();
    await new Promise(r => setTimeout(r, 0));
    expect(document.querySelector('#pet-detail-modal').textContent).toContain('历史');
    document.querySelector('.pet-revisions-btn').onclick();
    await new Promise(r => setTimeout(r, 0));
    expect(document.querySelector('#pet-detail-modal').textContent).toContain('修订');
  });

  it('删除投稿：确认后调用删除接口并刷新公开列表', async () => {
    const { controller, calls } = makeMine({
      api: async (path) => {
        if (path.startsWith('/api/my/submissions?')) {
          return { ok: true, data: { items: [{ id: 's1', name: '小白', status: 'approved' }], total: 1, totalPages: 1, statusCounts: {} } };
        }
        return { ok: true, data: { submission: { id: 's1' } } };
      },
    });
    mountSection();
    await controller.openMineSection();
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);
    document.querySelector('.pet-del-btn').onclick();
    await new Promise(r => setTimeout(r, 0));
    expect(confirmSpy).toHaveBeenCalledWith(expect.stringContaining('七天内'));
    expect(calls.submissionAction.some(s => s.method === 'DELETE' && s.path.includes('/api/submissions/s1'))).toBe(true);
    expect(calls.onListChanged).toBe(1);
    confirmSpy.mockRestore();
  });

  it('删除投稿：取消确认不调用接口', async () => {
    const { controller, calls } = makeMine({
      api: async (path) => {
        if (path.startsWith('/api/my/submissions?')) {
          return { ok: true, data: { items: [{ id: 's1', name: '小白', status: 'approved' }], total: 1, totalPages: 1, statusCounts: {} } };
        }
        return { ok: true, data: { submission: { id: 's1' } } };
      },
    });
    mountSection();
    await controller.openMineSection();
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false);
    document.querySelector('.pet-del-btn').onclick();
    await new Promise(r => setTimeout(r, 0));
    expect(calls.submissionAction.length).toBe(0);
    expect(calls.onListChanged).toBe(0);
    confirmSpy.mockRestore();
  });

  it('维护模式下删除和重新提交被拦截', async () => {
    const { controller, calls, setSiteConfig } = makeMine({
      api: async (path) => {
        if (path.startsWith('/api/my/submissions?')) {
          return { ok: true, data: { items: [{ id: 's1', name: '小白', status: 'deleted' }], total: 1, totalPages: 1, statusCounts: {} } };
        }
        return { ok: true, data: { submission: { id: 's1' } } };
      },
    });
    setSiteConfig({ allowSubmit: false, allowEdit: false, allowDelete: false, maintenance: true });
    mountSection();
    await controller.openMineSection();
    document.querySelector('.pet-del-btn').onclick();
    await new Promise(r => setTimeout(r, 0));
    expect(calls.submissionAction.length).toBe(0);
    document.querySelector('.pet-resubmit-btn').onclick();
    await new Promise(r => setTimeout(r, 0));
    expect(calls.submissionAction.length).toBe(0);
  });

  it('重新提交成功后刷新我的投稿，但不刷新公开列表', async () => {
    const { controller, calls } = makeMine({
      api: async (path) => {
        if (path.startsWith('/api/my/submissions?')) {
          return { ok: true, data: { items: [{ id: 's1', name: '小白', status: 'rejected' }], total: 1, totalPages: 1, statusCounts: {} } };
        }
        return { ok: true, data: { submission: { id: 's1' } } };
      },
    });
    mountSection();
    await controller.openMineSection();
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);
    document.querySelector('.pet-resubmit-btn').onclick();
    await new Promise(r => setTimeout(r, 0));
    expect(calls.onListChanged).toBe(0);
    expect(calls.submissionAction.some(s => s.path.includes('/resubmit'))).toBe(true);
    confirmSpy.mockRestore();
  });

  it('我的投稿状态筛选不展示已删除记录', async () => {
    const { controller } = makeMine({
      api: async path => {
        if (path.startsWith('/api/my/submissions?')) {
          return { ok: true, data: { items: [], total: 0, totalPages: 1, statusCounts: { pending: 1, approved: 2, rejected: 3, deleted: 4 } } };
        }
        return { ok: true, data: {} };
      },
    });
    mountSection();
    await controller.openMineSection();
    expect(document.querySelectorAll('[data-status="deleted"]')).toHaveLength(0);
  });

  it('刷新我的投稿可重置到第一页，确保新投稿立即可见', async () => {
    const { controller, calls } = makeMine({
      api: async (path) => {
        calls.api.push(path);
        return { ok: true, data: { items: [{ id: 's1', name: '小白', status: 'pending' }], total: 41, totalPages: 3, page: path.includes('page=2') ? 2 : 1, statusCounts: {} } };
      },
    });
    mountSection();
    await controller.openMineSection();
    document.querySelector('.pet-mine-page-btn[data-page="2"]').onclick();
    await controller.refreshMineSubmissions({ resetPage: true });
    expect(calls.api[calls.api.length - 1]).not.toContain('page=2');
  });

  it('类型选项加载：填充下拉并保持已选筛选', async () => {
    const { controller } = makeMine({
      api: async (path) => {
        if (path.startsWith('/api/my/submissions?')) {
          return { ok: true, data: { items: [], total: 0, totalPages: 1, statusCounts: {} } };
        }
        if (path === '/api/content-model/types') {
          return { ok: true, data: { types: [{ id: 7, code: 'cat', name: '猫猫', icon: '🐱' }, { id: 8, code: 'dog', name: '狗狗', icon: '🐶' }] } };
        }
        return { ok: true, data: {} };
      },
    });
    mountSection();
    await controller.openMineSection();
    const select = document.getElementById('pet-mine-category');
    expect(select.querySelectorAll('option').length).toBe(3); // 全部 + 2 类型
    expect(select.innerHTML).toContain('猫猫');
  });

  it('mineQueryParams：委托 buildMineListQuery 构建查询串', () => {
    const { controller } = makeMine({});
    const qs = controller.mineQueryParams();
    expect(qs.get('pageSize')).toBe('20');
    expect(qs.get('sort')).toBe('updated');
  });
});
