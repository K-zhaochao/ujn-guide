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
// 本地草稿 key：登录用户 userId=u1 时的 localStorage 键（与 pet-submit.js 实现一致）
const DRAFT_KEY = 'ujn:pet-submit:draft:u1';
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
  let apiImpl = async () => ({ ok: true, status: 200, data: { success: true, message: '✅ 投稿成功！' } });

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
    localStorage.clear();
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
  it('照片标签不再常驻显示单张大小上限（超限时才弹窗）', async () => {
    const t = makeSubmit();
    mountSubmit();
    t.controller.openSubmitModal();
    await flush();
    const label = Array.from(document.querySelectorAll('#pet-submit-modal label'))
      .find(el => /照片/.test(el.textContent));
    expect(label).toBeTruthy();
    expect(label.textContent).toContain('1~5 张');
    expect(label.textContent).toContain('自动压缩');
    expect(label.textContent).not.toContain('单张不超过');
  });

  it('草稿提示条：已登录可见、未登录隐藏', async () => {
    const t = makeSubmit();
    t.setUser(null); // 未登录：不保存草稿，提示条应隐藏
    mountSubmit();
    t.controller.openSubmitModal();
    await flush();
    const hint = document.querySelector('#pet-draft-hint');
    expect(hint).toBeTruthy();
    expect(hint.textContent).toContain('自动保存草稿');
    expect(hint.style.display).toBe('none');
    // 登录后重新打开：提示条可见
    t.setUser({ provider: 'github', username: 'tester', nickname: '测试', userId: 'u1' });
    document.body.innerHTML = '';
    mountSubmit();
    t.controller.openSubmitModal();
    await flush();
    expect(document.querySelector('#pet-draft-hint').style.display).not.toBe('none');
  });

  it('图片压缩后仍超限：弹出设计好的提示弹窗而非 toast', async () => {
    const t = makeSubmit({
      assertImageWithinLimit: () => {
        const err = new Error('压缩后的单张图片超过 5MB，请更换图片后重试');
        err.sizeBytes = 3 * 1024 * 1024; // 3MB
        throw err;
      },
    });
    mountSubmit();
    t.controller.openSubmitModal();
    await flush();
    const input = document.querySelector('#pet-images');
    Object.defineProperty(input, 'files', { value: [new File(['x'], 'huge.png', { type: 'image/png' })], configurable: true });
    input.dispatchEvent(new Event('change'));
    await flush();
    const dialog = document.getElementById('pet-image-limit-modal');
    expect(dialog).toBeTruthy();
    expect(dialog.textContent).toContain('huge.png');
    expect(dialog.textContent).toContain('3.0 MB'); // 实际压缩后大小
    expect(dialog.textContent).toContain('5MB'); // imageLimitLabel() 注入值
    // 超限不再走 toast 错误提示
    expect(t.calls.toast.some(x => x.isError && /超过/.test(x.msg))).toBe(false);
    // 点「知道了」关闭弹窗
    document.getElementById('pet-image-limit-ok').click();
    expect(t.calls.closeModal.length).toBeGreaterThan(0);
    // 超限图片不会进入已选列表
    expect(document.querySelectorAll('#pet-image-previews img').length).toBe(0);
  });
  it('选择种类：渲染动态字段并防抖保存本地草稿', async () => {
    const t = makeSubmit();
    mountSubmit();
    t.controller.openSubmitModal();
    await flush();
    document.querySelector('.pet-cat-opt[data-cat="猫猫"]').click();
    const dyn = document.querySelector('#pet-dynamic-fields');
    expect(dyn.querySelector('[data-field-key="name"]')).toBeTruthy();
    // 防抖 800ms 后应写入本地草稿（含类型）
    await vi.advanceTimersByTimeAsync(800);
    const draft = JSON.parse(localStorage.getItem(DRAFT_KEY));
    expect(draft).toBeTruthy();
    expect(draft.category).toBe('猫猫');
    expect(draft.typeId).toBe('cat');
  });

  it('输入名称：防抖自动保存本地草稿', async () => {
    const t = makeSubmit();
    mountSubmit();
    t.controller.openSubmitModal();
    await flush();
    const name = document.querySelector('#pet-name');
    name.value = '小白';
    name.dispatchEvent(new Event('input'));
    await vi.advanceTimersByTimeAsync(800);
    const draft = JSON.parse(localStorage.getItem(DRAFT_KEY));
    expect(draft).toBeTruthy();
    expect(draft.fields.name).toBe('小白');
  });

  it('空表单不保存草稿（无内容时不写 localStorage）', async () => {
    const t = makeSubmit();
    mountSubmit();
    t.controller.openSubmitModal();
    await flush();
    await vi.advanceTimersByTimeAsync(900);
    expect(localStorage.getItem(DRAFT_KEY)).toBeNull();
  });

  it('关闭弹窗时立即保存本地草稿', async () => {
    const t = makeSubmit();
    mountSubmit();
    t.controller.openSubmitModal();
    await flush();
    const name = document.querySelector('#pet-name');
    name.value = '小黑';
    name.dispatchEvent(new Event('input'));
    document.querySelector('#pet-submit-close').click();
    const draft = JSON.parse(localStorage.getItem(DRAFT_KEY));
    expect(draft).toBeTruthy();
    expect(draft.fields.name).toBe('小黑');
    expect(t.calls.closeModal.length).toBe(1);
  });

  it('无本地草稿时不提示恢复', async () => {
    const t = makeSubmit();
    mountSubmit();
    t.controller.openSubmitModal();
    await flush();
    // 关键：浏览器没有草稿时不得出现「已恢复」提示
    expect(t.calls.toast.some(x => /已恢复/.test(x.msg))).toBe(false);
    expect(localStorage.getItem(DRAFT_KEY)).toBeNull();
  });

  it('恢复上次草稿：回填名称/类型并提示', async () => {
    localStorage.setItem(DRAFT_KEY, JSON.stringify({
      category: '猫猫', typeId: 'cat', fields: { name: '草稿猫' }, images: [],
    }));
    const t = makeSubmit();
    mountSubmit();
    t.controller.openSubmitModal();
    await flush();
    const name = document.querySelector('#pet-name');
    expect(name.value).toBe('草稿猫');
    expect(document.querySelector('#pet-category-label').textContent).toContain('猫猫');
    expect(t.calls.toast.some(x => /已恢复/.test(x.msg))).toBe(true);
  });

  it('恢复草稿：图片 dataURL 渲染为预览并计入已选', async () => {
    const img = 'data:image/webp;base64,AA==';
    localStorage.setItem(DRAFT_KEY, JSON.stringify({
      category: '猫猫', typeId: 'cat', fields: { name: '图稿' }, images: [img, img],
    }));
    const t = makeSubmit();
    mountSubmit();
    t.controller.openSubmitModal();
    await flush();
    const previews = document.querySelector('#pet-image-previews');
    expect(previews.querySelectorAll('img').length).toBe(2);
    expect(document.querySelector('#pet-image-count').textContent).toContain('已恢复 2 张照片');
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

  it('上传照片：预览渲染并防抖保存图片到本地草稿', async () => {
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
    // 防抖后本地草稿包含压缩后的图片 dataURL
    await vi.advanceTimersByTimeAsync(800);
    const draft = JSON.parse(localStorage.getItem(DRAFT_KEY));
    expect(draft).toBeTruthy();
    expect(draft.images.length).toBe(1);
    expect(draft.images[0]).toContain('data:image');
  });

  it('删除单张图片：预览移除且顺序保持', async () => {
    const t = makeSubmit();
    mountSubmit();
    t.controller.openSubmitModal();
    await flush();
    const input = document.querySelector('#pet-images');
    const f1 = new File(['1'], 'a.png', { type: 'image/png' });
    const f2 = new File(['2'], 'b.png', { type: 'image/png' });
    Object.defineProperty(input, 'files', { value: [f1, f2], configurable: true });
    input.dispatchEvent(new Event('change'));
    await flush();
    const previews = document.querySelector('#pet-image-previews');
    expect(previews.querySelectorAll('img').length).toBe(2);
    expect(document.querySelector('#pet-image-count').textContent).toContain('已选 2 张');
    // 删除第一张（✕ 是 div 内最后一个 span 的祖先按钮）
    const first = previews.children[0];
    const removeBtn = first.querySelector('span');
    removeBtn.click();
    await flush();
    expect(previews.querySelectorAll('img').length).toBe(1);
    expect(document.querySelector('#pet-image-count').textContent).toContain('已选 1 张');
  });

  it('提交成功：调用投稿接口、清除本地草稿、关闭弹窗并回调刷新', async () => {
    const t = makeSubmit();
    // 预置一份本地草稿，验证提交成功后被清除
    localStorage.setItem(DRAFT_KEY, JSON.stringify({ category: '猫猫', typeId: 'cat', fields: {}, images: [] }));
    mountSubmit();
    t.controller.openSubmitModal();
    await flush();
    document.querySelector('.pet-cat-opt[data-cat="猫猫"]').click();
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
    expect(localStorage.getItem(DRAFT_KEY)).toBeNull();
    expect(t.calls.closeModal.length).toBe(1);
    expect(t.calls.onSubmitted).toBe(1);
    expect(t.calls.cacheClear).toBeGreaterThan(0);
  });

  it('提交失败：按钮恢复可点、提示错误且本地草稿保留', async () => {
    const t = makeSubmit();
    t.setApi(async () => ({ ok: false, status: 400, data: { message: '服务器拒绝了投稿' } }));
    mountSubmit();
    t.controller.openSubmitModal();
    await flush();
    document.querySelector('.pet-cat-opt[data-cat="猫猫"]').click();
    const input = document.querySelector('#pet-images');
    Object.defineProperty(input, 'files', { value: [new File(['x'], 'a.png', { type: 'image/png' })], configurable: true });
    input.dispatchEvent(new Event('change'));
    await flush();
    // 推进防抖让草稿落盘，验证提交失败不丢草稿
    await vi.advanceTimersByTimeAsync(800);
    expect(localStorage.getItem(DRAFT_KEY)).not.toBeNull();
    const btn = document.querySelector('#pet-submit-btn');
    btn.click();
    await flush();
    expect(btn.disabled).toBe(false);
    expect(btn.textContent).toBe('📤 提交投稿');
    expect(t.calls.toast.some(x => x.isError && /服务器拒绝了投稿/.test(x.msg))).toBe(true);
    expect(t.calls.onSubmitted).toBe(0);
    // 提交失败不丢草稿
    expect(localStorage.getItem(DRAFT_KEY)).not.toBeNull();
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
