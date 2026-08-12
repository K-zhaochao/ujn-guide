import { createRequire } from 'node:module';
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';

const require = createRequire(import.meta.url);
const submit = require('../../docs/pets/pet-submit.js');

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

/** 构造可控的 pet-submit 实例与 DOM 环境 */
function makeSubmit(overrides) {
  const calls = { api: [], toast: [], openModal: [], closeModal: [], onSubmitted: 0, cacheClear: 0 };
  let user = { provider: 'github', username: 'tester', nickname: '测试', userId: 'u1' };
  let siteConfig = { allowSubmit: true, allowEdit: true, allowDelete: true, maintenance: false, schemaVersion: 1 };
  let contentSchema = { schemaVersion: 1, types: [{ id: 'cat', key: '猫猫', code: 'cat', emoji: '🐱' }], fields: [], bindings: [] };
  let contentSchemaReady = true;
  let SUBMISSION_TYPES = [{ id: 'cat', key: '猫猫', code: 'cat', emoji: '🐱' }];
  let maxImagesLimit = 5;
  const petCache = { clear: () => { calls.cacheClear++; } };
  const catEmoji = { 猫猫: '🐱' };
  let apiImpl = async (path, opts) => {
    if (String(path).startsWith('/api/my/drafts?pageSize=1')) return { ok: true, status: 200, data: { items: [] } };
    return { ok: true, status: 200, data: { success: true, message: '✅ 投稿成功！' } };
  };

  const deps = {
    $: (sel, root) => (root || document).querySelector(sel),
    $all: (sel, root) => Array.from((root || document).querySelectorAll(sel)),
    document, C, esc,
    views: () => ({
      renderSubmitFieldsHtml: (typeId, values) => '<input data-field-key="name" value="' + esc((values && values.name) || '') + '">',
    }),
    api: (path, opts) => { calls.api.push({ path, opts }); return apiImpl(path, opts); },
    showToast: (msg, isError) => { calls.toast.push({ msg, isError }); },
    openPetModal: (modal) => { calls.openModal.push(modal); },
    closePetModal: (modal) => { calls.closeModal.push(modal); },
    updateAuthUI: () => {
      const btn = document.querySelector('#pet-submit-btn');
      if (btn) {
        btn.disabled = !user;
        btn.textContent = user ? '📤 提交投稿' : '🔒 请先登录后再投稿';
      }
    },
    renderSubmitFields: (typeId, values) => {
      const root = document.querySelector('#pet-dynamic-fields');
      if (root) root.innerHTML = deps.views().renderSubmitFieldsHtml(typeId, values);
    },
    readDynamicFields: (root) => {
      const values = {};
      (root || document).querySelectorAll('[data-field-key]').forEach(el => { values[el.dataset.fieldKey] = el.value.trim(); });
      return values;
    },
    fileToWebP: async () => 'data:image/webp;base64,AA==',
    assertImageWithinLimit: () => {},
    imageLimitLabel: () => '5MB',
    petCache,
    onSubmitted: () => { calls.onSubmitted++; },
    getUser: () => user,
    getSiteConfig: () => siteConfig,
    getContentSchema: () => contentSchema,
    getContentSchemaReady: () => contentSchemaReady,
    getSubmissionTypes: () => SUBMISSION_TYPES,
    getMaxImagesLimit: () => maxImagesLimit,
    getCatEmoji: () => catEmoji,
  };
  const controller = submit.createPetSubmit(Object.assign(deps, overrides || {}));
  return {
    calls, controller,
    setUser: u => { user = u; },
    setSiteConfig: s => { siteConfig = s; },
    setSchemaReady: v => { contentSchemaReady = v; },
    setSubmissionTypes: v => { SUBMISSION_TYPES = v; },
    setApi: fn => { apiImpl = fn; },
    deps,
  };
}

/** 挂载投稿弹窗容器 */
function mountSubmit() {
  const modal = document.createElement('div');
  modal.id = 'pet-submit-modal';
  document.body.appendChild(modal);
  return modal;
}

// fake timers 下 setTimeout 被接管，flush 用虚拟时钟推进微任务
const flush = () => vi.advanceTimersByTimeAsync(0);

describe('宠物「投稿表单」交互控制器', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    vi.useFakeTimers();
    if (!Element.prototype.scrollIntoView) Element.prototype.scrollIntoView = () => {};
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('配置未加载或无可投稿类型：提示且不打开弹窗', () => {
    const t = makeSubmit();
    t.setSchemaReady(false);
    mountSubmit();
    t.controller.openSubmitModal();
    expect(t.calls.toast.some(x => x.isError && /投稿配置尚未加载/.test(x.msg))).toBe(true);
    expect(t.calls.openModal.length).toBe(0);
  });

  it('维护模式下投稿被拦截', () => {
    const t = makeSubmit();
    t.setSiteConfig({ allowSubmit: true, allowEdit: true, allowDelete: true, maintenance: true });
    mountSubmit();
    t.controller.openSubmitModal();
    expect(t.calls.toast.some(x => x.isError && /维护中/.test(x.msg))).toBe(true);
    expect(t.calls.openModal.length).toBe(0);
  });

  it('关闭投稿功能时被拦截', () => {
    const t = makeSubmit();
    t.setSiteConfig({ allowSubmit: false, allowEdit: true, allowDelete: true, maintenance: false });
    mountSubmit();
    t.controller.openSubmitModal();
    expect(t.calls.toast.some(x => x.isError && /关闭投稿功能/.test(x.msg))).toBe(true);
    expect(t.calls.openModal.length).toBe(0);
  });

  it('打开后渲染外壳：未登录按钮禁用、登录后可用', () => {
    const t = makeSubmit();
    t.setUser(null); // 未登录
    mountSubmit();
    t.controller.openSubmitModal();
    expect(t.calls.openModal.length).toBe(1);
    const btn = document.querySelector('#pet-submit-btn');
    expect(btn).toBeTruthy();
    expect(btn.disabled).toBe(true); // 未登录：注入的 updateAuthUI 禁用提交
    const closeBtn = document.querySelector('#pet-submit-close');
    expect(closeBtn).toBeTruthy();
    expect(document.querySelector('#pet-category-btn')).toBeTruthy();
    // 重新打开（已登录）：按钮可用
    t.setUser({ provider: 'github', username: 'tester', nickname: '测试', userId: 'u1' });
    document.body.innerHTML = '';
    mountSubmit();
    t.controller.openSubmitModal();
    expect(document.querySelector('#pet-submit-btn').disabled).toBe(false);
  });

  it('选择种类：渲染动态字段并调度草稿自动保存', async () => {
    const t = makeSubmit();
    mountSubmit();
    t.controller.openSubmitModal();
    await flush();
    document.querySelector('.pet-cat-opt[data-cat="猫猫"]').click();
    const dyn = document.querySelector('#pet-dynamic-fields');
    expect(dyn.querySelector('[data-field-key="name"]')).toBeTruthy();
    // 防抖 800ms 后应触发草稿保存
    await vi.advanceTimersByTimeAsync(800);
    expect(t.calls.api.some(x => x.path === '/api/my/drafts' && x.opts.method === 'POST')).toBe(true);
  });

  it('输入名称：防抖自动保存草稿', async () => {
    const t = makeSubmit();
    mountSubmit();
    t.controller.openSubmitModal();
    await flush();
    const name = document.querySelector('#pet-name');
    name.value = '小白';
    name.dispatchEvent(new Event('input'));
    await vi.advanceTimersByTimeAsync(800);
    const draftCall = t.calls.api.find(x => x.path === '/api/my/drafts' && x.opts.method === 'POST');
    expect(draftCall).toBeTruthy();
    expect(draftCall.opts.body.payload.fields.name).toBe('小白');
  });

  it('空表单不保存草稿（无内容时不发请求）', async () => {
    const t = makeSubmit();
    mountSubmit();
    t.controller.openSubmitModal();
    await flush();
    await vi.advanceTimersByTimeAsync(900);
    expect(t.calls.api.some(x => x.path === '/api/my/drafts' && x.opts.method === 'POST')).toBe(false);
  });

  it('关闭弹窗时立即保存草稿', async () => {
    const t = makeSubmit();
    mountSubmit();
    t.controller.openSubmitModal();
    await flush();
    const name = document.querySelector('#pet-name');
    name.value = '小黑';
    name.dispatchEvent(new Event('input'));
    document.querySelector('#pet-submit-close').click();
    const draftCall = t.calls.api.find(x => x.path === '/api/my/drafts' && x.opts.method === 'POST');
    expect(draftCall).toBeTruthy();
    expect(t.calls.closeModal.length).toBe(1);
  });

  it('恢复上次草稿：回填名称并提示', async () => {
    const t = makeSubmit();
    t.setApi(async (path) => {
      if (String(path).startsWith('/api/my/drafts?pageSize=1')) {
        return { ok: true, status: 200, data: { items: [{ id: 'd1', rowVersion: 3, payload: { category: '猫猫', typeId: 'cat', fields: { name: '草稿猫' }, imageCount: 2 } }] } };
      }
      return { ok: true, status: 200, data: { success: true } };
    });
    mountSubmit();
    t.controller.openSubmitModal();
    await flush();
    const name = document.querySelector('#pet-name');
    expect(name.value).toBe('草稿猫');
    expect(t.calls.toast.some(x => /已恢复/.test(x.msg))).toBe(true);
  });

  it('提交校验：未选择种类提示错误', async () => {
    const t = makeSubmit();
    mountSubmit();
    t.controller.openSubmitModal();
    await flush();
    document.querySelector('#pet-submit-btn').click();
    expect(t.calls.toast.some(x => x.isError && /请选择种类/.test(x.msg))).toBe(true);
  });

  it('提交校验：未上传照片提示错误', async () => {
    const t = makeSubmit();
    mountSubmit();
    t.controller.openSubmitModal();
    await flush();
    document.querySelector('.pet-cat-opt[data-cat="猫猫"]').click();
    document.querySelector('#pet-submit-btn').click();
    expect(t.calls.toast.some(x => x.isError && /至少上传 1 张照片/.test(x.msg))).toBe(true);
  });

  it('上传照片：预览渲染并计入草稿图片张数', async () => {
    const t = makeSubmit();
    mountSubmit();
    t.controller.openSubmitModal();
    await flush();
    const input = document.querySelector('#pet-images');
    const file = new File(['x'], 'a.png', { type: 'image/png' });
    Object.defineProperty(input, 'files', { value: [file], configurable: true });
    input.dispatchEvent(new Event('change'));
    await flush();
    const previews = document.querySelector('#pet-image-previews');
    expect(previews.querySelectorAll('img').length).toBe(1);
    expect(document.querySelector('#pet-image-count').textContent).toContain('已选 1 张');
  });

  it('提交成功：调用投稿接口、丢弃草稿、关闭弹窗并回调刷新', async () => {
    const t = makeSubmit();
    let deleteDraftCalled = false;
    t.setApi(async (path, opts) => {
      if (String(path).startsWith('/api/my/drafts?pageSize=1')) return { ok: true, status: 200, data: { items: [] } };
      if (String(path) === '/api/my/drafts' && opts.method === 'POST') return { ok: true, status: 200, data: { draft: { id: 'd1', rowVersion: 1 } } };
      if (String(path).startsWith('/api/my/drafts/') && opts.method === 'DELETE') { deleteDraftCalled = true; return { ok: true, status: 200, data: {} }; }
      return { ok: true, status: 200, data: { success: true, message: '✅ 投稿成功！' } };
    });
    mountSubmit();
    t.controller.openSubmitModal();
    await flush();
    document.querySelector('.pet-cat-opt[data-cat="猫猫"]').click();
    // 等待草稿防抖保存建立 draftId，使提交成功后的 discardDraft 发出 DELETE
    await vi.advanceTimersByTimeAsync(800);
    const input = document.querySelector('#pet-images');
    const file = new File(['x'], 'a.png', { type: 'image/png' });
    Object.defineProperty(input, 'files', { value: [file], configurable: true });
    input.dispatchEvent(new Event('change'));
    await flush();
    document.querySelector('#pet-submit-btn').click();
    await flush();
    const subCall = t.calls.api.find(x => x.path === '/api/submissions' && x.opts.method === 'POST');
    expect(subCall).toBeTruthy();
    expect(subCall.opts.body.images.length).toBe(1);
    expect(subCall.opts.body.category).toBe('猫猫');
    expect(deleteDraftCalled).toBe(true);
    expect(t.calls.closeModal.length).toBe(1);
    expect(t.calls.onSubmitted).toBe(1);
    expect(t.calls.cacheClear).toBeGreaterThan(0);
  });

  it('提交失败：按钮恢复可点并提示错误', async () => {
    const t = makeSubmit();
    t.setApi(async (path) => {
      if (String(path).startsWith('/api/my/drafts?pageSize=1')) return { ok: true, status: 200, data: { items: [] } };
      return { ok: false, status: 400, data: { message: '服务器拒绝了投稿' } };
    });
    mountSubmit();
    t.controller.openSubmitModal();
    await flush();
    document.querySelector('.pet-cat-opt[data-cat="猫猫"]').click();
    const input = document.querySelector('#pet-images');
    Object.defineProperty(input, 'files', { value: [new File(['x'], 'a.png', { type: 'image/png' })], configurable: true });
    input.dispatchEvent(new Event('change'));
    await flush();
    const btn = document.querySelector('#pet-submit-btn');
    btn.click();
    await flush();
    expect(btn.disabled).toBe(false);
    expect(btn.textContent).toBe('📤 提交投稿');
    expect(t.calls.toast.some(x => x.isError && /服务器拒绝了投稿/.test(x.msg))).toBe(true);
    expect(t.calls.onSubmitted).toBe(0);
  });

  it('幂等命中视为成功：不提示错误并关闭', async () => {
    const t = makeSubmit();
    t.setApi(async (path) => {
      if (String(path).startsWith('/api/my/drafts?pageSize=1')) return { ok: true, status: 200, data: { items: [] } };
      return { ok: true, status: 200, data: { success: false, idempotent: true, message: '✅ 该投稿已提交！' } };
    });
    mountSubmit();
    t.controller.openSubmitModal();
    await flush();
    document.querySelector('.pet-cat-opt[data-cat="猫猫"]').click();
    const input = document.querySelector('#pet-images');
    Object.defineProperty(input, 'files', { value: [new File(['x'], 'a.png', { type: 'image/png' })], configurable: true });
    input.dispatchEvent(new Event('change'));
    await flush();
    document.querySelector('#pet-submit-btn').click();
    await flush();
    expect(t.calls.closeModal.length).toBe(1);
    expect(t.calls.toast.some(x => !x.isError && /已提交/.test(x.msg))).toBe(true);
  });
});
