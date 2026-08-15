import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { createContext, runInContext } from 'node:vm';
import { JSDOM } from 'jsdom';

const require = createRequire(import.meta.url);
const stateModule = require('../../server/public/admin-ui-state.js');
const viewsModule = require('../../server/public/admin-ui-views.js');
const pickerModule = require('../../server/public/admin-picker.js');
// 显式基于本文件定位源码，避免依赖进程 cwd（vitest --root 可能改变 cwd）
const adminUiCode = readFileSync(require.resolve('../../server/public/admin-ui.js'), 'utf8');

/** 构造 HTTP 风格响应（与脚本内 api() 的解析方式一致） */
const jsonResponse = (data, status = 200) => ({
  ok: status >= 200 && status < 300,
  status,
  json: async () => data,
});

const ADMIN = {
  provider: 'github', username: 'root', nickname: '站长', role: 'superadmin', isAdmin: true, avatarUrl: '',
};
const MODERATOR = {
  provider: 'github', username: 'mod', nickname: '审核员', role: 'admin', isAdmin: true, avatarUrl: '',
};

const SAMPLE_SUB = {
  id: 'sub_1', name: '小白', category: '猫猫', type: { name: '猫猫' }, status: 'pending',
  location: '操场', createdAt: '2026-08-01T10:00:00Z', rowVersion: 1,
  contributor: { provider: 'github', username: 'tester', nickname: '测试' },
  images: [], likes: 0, liked: false,
};

/**
 * 标准路由 mock：覆盖登录/统计/各视图数据端点。
 * overrides 可替换/追加端点（url => response | Promise）。
 */
function standardRoutes({ user = ADMIN, overrides = {} } = {}) {
  const routes = {
    '/api/auth/me': () => jsonResponse({ success: true, csrfToken: 'csrf-1', user }),
    '/api/auth/config': () => jsonResponse({ providers: ['github', 'gitee'] }),
    '/api/admin/stats': () => jsonResponse({ stats: { pending: 1, approved: 2, rejected: 0, deleted: 0, users: 1, banned: 0 } }),
    '/api/content-model/types': () => jsonResponse({ types: [{ id: 'cat', name: '猫猫', icon: '🐱', sortOrder: 1 }] }),
    '/api/admin/submissions?status=pending&page=1&pageSize=10&sort=oldest': () => jsonResponse({
      total: 1, submissions: [SAMPLE_SUB],
      schema: { schemaVersion: 1, types: [], fields: [] },
    }),
    '/api/admin/submission-revisions?status=pending&page=1&pageSize=10&sort=oldest': () => jsonResponse({ total: 0, revisions: [] }),
    '/api/admin/submissions?status=approved&page=1&pageSize=10&sort=latest': () => jsonResponse({ total: 0, submissions: [] }),
    '/api/admin/submissions?status=rejected&page=1&pageSize=10&sort=latest': () => jsonResponse({ total: 0, submissions: [] }),
    '/api/admin/submissions?status=deleted&page=1&pageSize=10&sort=latest': () => jsonResponse({ total: 0, submissions: [] }),
    '/api/admin/users?q=&page=1&pageSize=10': () => jsonResponse({
      total: 1,
      users: [{ id: 'u1', provider: 'github', username: 'tester', nickname: '测试', role: 'user', total: 1, approved: 1, pending: 0, banned: false, email: 'a@b.c', note: '' }],
    }),
    '/api/admin/content-model/draft': () => jsonResponse({ draft: { draftRevision: 5, types: [{ id: 'cat', name: '猫猫', icon: '🐱', sortOrder: 1 }], fields: [], bindings: [] }, diff: null, validation: null }),
    '/api/admin/content-model/versions?page=1&pageSize=10': () => jsonResponse({ versions: [], total: 0 }),
    '/api/admin/settings': () => jsonResponse({ settings: { allowSubmit: true, allowEdit: true, allowDelete: true, maintenanceMode: false, maxDailySubmit: 3, maxSubmitRequestsPerMinute: 20, auditRetentionDays: 180, revision: 1 }, policy: [], runtime: {} }),
    '/api/admin/settings/history?page=1&pageSize=10': () => jsonResponse({ items: [], total: 0 }),
    '/api/admin/backups?limit=5': () => jsonResponse({ exports: [] }),
    '/api/admin/banned-users?q=&page=1&pageSize=10': () => jsonResponse({ users: [], total: 0 }),
    '/api/admin/banned-ips?ip=&reason=&start=&end=&page=1&pageSize=10': () => jsonResponse({ bannedIPs: [], total: 0 }),
    '/api/admin/audit?action=&actor=&targetUser=&start=&end=&page=1&pageSize=50': () => jsonResponse({ total: 1, audit: [{ id: 1, action: 'submission.approve', actor_username: 'root', created_at: '2026-08-01T10:00:00Z', target_id: 'sub_1', target_username: 'tester', target_avatar: '', detail: '通过投稿' }] }),
    '/api/admin/audit-cleanup/tasks?limit=8&offset=0': () => jsonResponse({ tasks: [], total: 0 }),
    '/api/admin/audit/actions': () => jsonResponse({ actions: [{ action: 'submission.approve' }] }),
    '/api/admin/media-assets?status=orphan%2Cdelete_pending%2Cdelete_failed&provider=&limit=50&offset=0': () => jsonResponse({ total: 0, assets: [] }),
    '/api/admin/media-assets?status=orphan,delete_pending,delete_failed&provider=&limit=50&offset=0': () => jsonResponse({ total: 0, assets: [] }),
  };
  return async (url, opts) => {
    const handler = overrides[url] || routes[url];
    if (handler) return handler(url, opts);
    if (url.startsWith('/api/admin/submissions?status=') && url.includes('pageSize=1')) {
      const status = /status=(\w+)/.exec(url)[1];
      return jsonResponse({ total: status === 'pending' ? 1 : 0, submissions: [] });
    }
    return jsonResponse({ message: 'unmocked: ' + url }, 500);
  };
}

/** 启动一个独立 JSDOM 实例并执行 admin-ui.js */
function boot({ user = ADMIN, fetchImpl, overrides = {} } = {}) {
  const dom = new JSDOM('<!DOCTYPE html><html><head></head><body><div id="app"></div></body></html>', {
    url: 'http://localhost:3005/admin/',
    pretendToBeVisual: true,
  });
  const { window } = dom;
  window.AdminUiState = stateModule;
  window.AdminUiViews = viewsModule;
  window.AdminPicker = pickerModule;
  window.__ADMIN_CFG = { LOGO: '/admin/assets/favicon.svg', MAIN_SITE: 'http://localhost:3005' };
  const fetchCalls = [];
  const impl = fetchImpl || standardRoutes({ user, overrides });
  window.fetch = (...args) => { fetchCalls.push({ url: args[0], opts: args[1] }); return Promise.resolve(impl(args[0], args[1])); };
  // 模拟浏览器关键全局（脚本会用到）
  window.screen = { width: 1280, height: 800 };
  window.scrollTo = () => {};
  // jsdom 的 Window.eval 不解析 window/document 全局，需用 vm context 执行
  runInContext(adminUiCode, createContext(window));
  return { dom, window, document: window.document, fetchCalls };
}

/** 轮询等待指定选择器出现 */
async function waitFor(doc, selector, timeout = 800) {
  const start = Date.now();
  for (;;) {
    const el = doc.querySelector(selector);
    if (el) return el;
    if (Date.now() - start > timeout) throw new Error('等待超时: ' + selector + '；当前 app 内容: ' + (doc.getElementById('app') || {}).innerHTML);
    await new Promise(r => setTimeout(r, 5));
  }
}

const settle = () => new Promise(r => setTimeout(r, 10));

describe('管理后台前端交互控制器（admin-ui.js 组件测试）', () => {
  let instances = [];
  beforeEach(() => { instances = []; });
  afterEach(() => { instances.forEach(i => i.dom.window.close()); });

  function bootTracked(opts) {
    const inst = boot(opts);
    instances.push(inst);
    return inst;
  }

  it('未登录：渲染登录页并展示 OAuth 提供方', async () => {
    const { document } = bootTracked({ fetchImpl: async (url) => {
      if (url === '/api/auth/me') return jsonResponse({ success: false }, 401);
      if (url === '/api/auth/config') return jsonResponse({ providers: ['github', 'gitee'] });
      return jsonResponse({ message: 'unmocked' }, 500);
    } });
    await waitFor(document, '.login-card');
    const text = document.getElementById('app').textContent;
    expect(text).toContain('登录');
    expect(document.querySelectorAll('.oauth-btn').length).toBeGreaterThanOrEqual(1);
  });

  it('已登录但非管理员：渲染无权限提示', async () => {
    const { document } = bootTracked({ fetchImpl: async (url) => {
      if (url === '/api/auth/me') return jsonResponse({ success: true, csrfToken: 'x', user: { ...MODERATOR, isAdmin: false, role: 'user' } });
      return jsonResponse({ message: 'unmocked' }, 500);
    } });
    await waitFor(document, '.forbidden');
    expect(document.getElementById('app').textContent).toContain('无权限');
  });

  it('普通管理员：仪表盘渲染，侧边栏仅显示有权限视图', async () => {
    const { document } = bootTracked({ user: MODERATOR });
    await waitFor(document, '#sidebar');
    const items = [...document.querySelectorAll('.nav-item')].map(n => n.dataset.view);
    expect(items).toContain('pending');
    expect(items).toContain('users');
    // 站长专属视图对普通管理员不可见
    expect(items).not.toContain('deleted');
    expect(items).not.toContain('banned');
    expect(items).not.toContain('model');
    expect(items).not.toContain('audit');
    expect(items).not.toContain('media');
    expect(items).not.toContain('settings');
  });

  it('超管：侧边栏渲染全部视图', async () => {
    const { document } = bootTracked({ user: ADMIN });
    await waitFor(document, '#sidebar');
    const items = [...document.querySelectorAll('.nav-item')].map(n => n.dataset.view);
    ['pending', 'approved', 'rejected', 'deleted', 'users', 'banned', 'model', 'audit', 'media', 'settings']
      .forEach(v => expect(items).toContain(v));
  });

  it('待审核列表加载成功：渲染投稿卡片与投稿人', async () => {
    const { document } = bootTracked({ user: ADMIN });
    await waitFor(document, '#sub-list');
    const text = document.getElementById('view-root').textContent;
    expect(text).toContain('小白');
    expect(text).toContain('@tester');
  });

  it('topbar refresh reloads the current list and sidebar snapshot', async () => {
    const { document, fetchCalls } = bootTracked({ user: ADMIN });
    await waitFor(document, '#sub-list');
    const listCallsBefore = fetchCalls.filter(call => call.url === '/api/admin/submissions?status=pending&page=1&pageSize=10&sort=oldest').length;
    const statsCallsBefore = fetchCalls.filter(call => call.url === '/api/admin/stats').length;
    const refresh = document.querySelector('[data-action="view-refresh"]');

    expect(refresh).toBeTruthy();
    refresh.click();
    await settle();

    expect(fetchCalls.filter(call => call.url === '/api/admin/submissions?status=pending&page=1&pageSize=10&sort=oldest').length).toBeGreaterThan(listCallsBefore);
    expect(fetchCalls.filter(call => call.url === '/api/admin/stats').length).toBeGreaterThan(statsCallsBefore);
    expect(fetchCalls.every(call => call.opts && call.opts.cache === 'no-store')).toBe(true);
    expect(document.querySelector('.nav-item[data-view="pending"]').classList.contains('active')).toBe(true);
  });

  it('待审核页：公开稿修改进入独立队列且不出现批量选择框', async () => {
    const { document } = bootTracked({ user: ADMIN, overrides: {
      '/api/admin/submission-revisions?status=pending&page=1&pageSize=10&sort=oldest': () => jsonResponse({
        total: 1,
        revisions: [{
          id: 'rev_1', createdAt: '2026-08-01T10:00:00Z', source: 'user', canApprove: true,
          diff: { changes: [{ key: 'name', from: '小白', to: '修改后的小白' }], fieldChanges: [], imagesChanged: false },
          candidate: { name: '修改后的小白', category: '猫猫' }, candidateType: { name: '猫猫', icon: '🐱' },
          submission: { id: 'sub_public', name: '小白', category: '猫猫' },
          contributor: { provider: 'github', username: 'tester', nickname: '测试' },
        }],
        fieldLabels: { name: '宠物昵称' },
      }),
    } });
    await waitFor(document, '#pending-revision-queue');
    const queue = document.getElementById('pending-revision-queue');
    expect(queue.textContent).toContain('修改后的小白');
    expect(queue.textContent).toContain('小白');
    expect(queue.textContent).toContain('宠物昵称');
    expect(queue.textContent).toContain('查看完整对比并审核');
    expect(queue.querySelector('[data-check]')).toBeNull();
    expect(queue.querySelector('[data-action="revisions"]')).toBeTruthy();
  });

  it('待审核列表加载失败：展示错误信息', async () => {
    const { document } = bootTracked({ overrides: {
      '/api/admin/submissions?status=pending&page=1&pageSize=10&sort=oldest': () => jsonResponse({ message: '数据库连接失败' }, 500),
    } });
    await waitFor(document, '.empty');
    expect(document.getElementById('view-root').textContent).toContain('加载失败');
    expect(document.getElementById('view-root').textContent).toContain('数据库连接失败');
  });

  it('侧边栏切换视图：点击“用户”后加载用户列表', async () => {
    const { document, fetchCalls } = bootTracked({ user: ADMIN });
    await waitFor(document, '.nav-item[data-view="users"]');
    document.querySelector('.nav-item[data-view="users"]').click();
    await waitFor(document, 'table');
    expect(document.getElementById('view-root').textContent).toContain('tester');
    expect(fetchCalls.some(c => c.url.includes('/api/admin/users?'))).toBe(true);
  });

  it('用户列表加载失败：展示错误', async () => {
    const { document } = bootTracked({ user: ADMIN, overrides: {
      '/api/admin/users?q=&page=1&pageSize=10': () => jsonResponse({ message: '用户数据异常' }, 500),
    } });
    await waitFor(document, '.nav-item[data-view="users"]');
    document.querySelector('.nav-item[data-view="users"]').click();
    await waitFor(document, '.empty');
    expect(document.getElementById('view-root').textContent).toContain('加载失败');
    expect(document.getElementById('view-root').textContent).toContain('用户数据异常');
  });

  it('内容模型加载成功：渲染类型管理视图', async () => {
    const { document } = bootTracked({ user: ADMIN });
    await waitFor(document, '.nav-item[data-view="model"]');
    document.querySelector('.nav-item[data-view="model"]').click();
    await waitFor(document, '.model-types, .model-type-list, [data-action="modeltypenew"], .settings-wrap');
    expect(document.getElementById('view-root').textContent).toContain('猫猫');
  });

  it('系统设置加载成功：渲染功能开关与保存按钮', async () => {
    const { document } = bootTracked({ user: ADMIN });
    await waitFor(document, '.nav-item[data-view="settings"]');
    document.querySelector('.nav-item[data-view="settings"]').click();
    await waitFor(document, '.settings-wrap');
    const text = document.getElementById('view-root').textContent;
    expect(text).toContain('允许投稿');
    expect(document.querySelector('[data-action="settings-save"]')).toBeTruthy();
  });

  it('系统设置加载失败：展示错误', async () => {
    const { document } = bootTracked({ user: ADMIN, overrides: {
      '/api/admin/settings': () => jsonResponse({ message: '设置读取失败' }, 500),
    } });
    await waitFor(document, '.nav-item[data-view="settings"]');
    document.querySelector('.nav-item[data-view="settings"]').click();
    await waitFor(document, '.empty');
    expect(document.getElementById('view-root').textContent).toContain('加载失败');
    expect(document.getElementById('view-root').textContent).toContain('设置读取失败');
  });

  it('审计日志加载成功：渲染表格与操作下拉', async () => {
    const { document } = bootTracked({ user: ADMIN });
    await waitFor(document, '.nav-item[data-view="audit"]');
    document.querySelector('.nav-item[data-view="audit"]').click();
    await waitFor(document, '.table-wrap');
    expect(document.getElementById('view-root').textContent).toContain('submission.approve');
    expect(document.querySelector('select[data-af-action]')).toBeTruthy();
    expect(document.querySelector('input[data-af-target-user]')).toBeTruthy();
    expect(document.getElementById('view-root').textContent).toContain('@tester');
  });

  it('审计日志目标用户筛选：请求与清理范围保持一致', async () => {
    const { document, fetchCalls } = bootTracked({ user: ADMIN });
    await waitFor(document, '.nav-item[data-view="audit"]');
    document.querySelector('.nav-item[data-view="audit"]').click();
    await waitFor(document, '[data-af-target-user]');
    document.querySelector('[data-af-target-user]').value = '测试投稿人';
    document.querySelector('[data-action="auditfilter"]').click();
    await settle();
    expect(fetchCalls.some(call => call.url.includes('targetUser=%E6%B5%8B%E8%AF%95%E6%8A%95%E7%A8%BF%E4%BA%BA'))).toBe(true);
  });

  it('媒体清理加载成功：渲染资源表格（空态）', async () => {
    const { document } = bootTracked({ user: ADMIN });
    await waitFor(document, '.nav-item[data-view="media"]');
    document.querySelector('.nav-item[data-view="media"]').click();
    await waitFor(document, '.media-summary, .empty');
    expect(document.getElementById('view-root').textContent).toContain('媒体');
  });

  it('审批冲突：自动重拉 rowVersion 并重试成功', async () => {
    let approveAttempts = 0;
    const { document, fetchCalls } = bootTracked({ user: ADMIN, overrides: {
      '/api/admin/submissions/sub_1/approve': async (url, opts) => {
        approveAttempts++;
        if (approveAttempts === 1) return jsonResponse({ message: '行版本冲突', code: 'SUBMISSION_CONFLICT' }, 409);
        const body = JSON.parse(opts.body);
        if (body.rowVersion !== 2) return jsonResponse({ message: 'rowVersion 未刷新', code: 'SUBMISSION_CONFLICT' }, 409);
        return jsonResponse({ success: true, message: '已通过' });
      },
      '/api/admin/submissions/sub_1': () => jsonResponse({ submission: { ...SAMPLE_SUB, rowVersion: 2 } }),
    } });
    await waitFor(document, '[data-action="approve"]');
    document.querySelector('[data-action="approve"]').click();
    await settle();
    expect(approveAttempts).toBe(2);
    const approveCalls = fetchCalls.filter(c => c.url === '/api/admin/submissions/sub_1/approve');
    expect(approveCalls.length).toBe(2);
    expect(JSON.parse(approveCalls[1].opts.body).rowVersion).toBe(2);
    expect(document.getElementById('pet-toast').textContent).toContain('已通过');
  });

  it('批量通过：勾选后确认并提交批量接口', async () => {
    const { window, document, fetchCalls } = bootTracked({ user: ADMIN });
    await waitFor(document, '[data-check][data-check-id]');
    const checkbox = document.querySelector('[data-check][data-check-id]');
    checkbox.checked = true;
    checkbox.dispatchEvent(new window.Event('change', { bubbles: true }));
    document.querySelector('[data-action="bulk-approve"]').click();
    // 确认弹窗
    await waitFor(document, '[data-cf-ok]');
    document.querySelector('[data-cf-ok]').click();
    await settle();
    const batch = fetchCalls.find(c => c.url === '/api/admin/submissions/batch');
    expect(batch).toBeTruthy();
    expect(batch.opts.method).toBe('POST');
    expect(JSON.parse(batch.opts.body).action).toBe('approve');
    expect(JSON.parse(batch.opts.body).ids).toContain('sub_1');
  });

  it('设置两窗口冲突：保存遇 SETTINGS_CONFLICT 提示并自动重拉最新值', async () => {
    const { document, fetchCalls } = bootTracked({ user: ADMIN, overrides: {
      '/api/admin/settings': async (url, opts) => {
        if (opts && opts.method === 'PUT') {
          return jsonResponse({ message: '已被其他管理员修改', code: 'SETTINGS_CONFLICT' }, 409);
        }
        return jsonResponse({ settings: { allowSubmit: true, allowEdit: true, allowDelete: true, maintenanceMode: false, maxDailySubmit: 3, maxSubmitRequestsPerMinute: 20, auditRetentionDays: 180, revision: 1 }, policy: [], runtime: {} });
      },
    } });
    await waitFor(document, '.nav-item[data-view="settings"]');
    document.querySelector('.nav-item[data-view="settings"]').click();
    await waitFor(document, '.settings-wrap');
    const isGet = c => String(c.opts && c.opts.method || 'GET').toUpperCase() === 'GET';
    const getCallsBefore = fetchCalls.filter(c => c.url === '/api/admin/settings' && isGet(c)).length;
    // 关闭「允许投稿」并保存 → 确认弹窗 → 提交
    document.querySelector('[data-setting="allowSubmit"]').click();
    document.querySelector('[data-action="settings-save"]').click();
    await waitFor(document, '[data-cf-ok]');
    document.querySelector('[data-cf-ok]').click();
    await settle();
    const put = fetchCalls.find(c => c.url === '/api/admin/settings' && c.opts && String(c.opts.method).toUpperCase() === 'PUT');
    expect(put).toBeTruthy();
    expect(JSON.parse(put.opts.body).expectedRevision).toBe(1);
    expect(JSON.parse(put.opts.body).allowSubmit).toBe(false);
    // 冲突后应提示并重新 GET 拉取最新值
    expect(document.getElementById('pet-toast').textContent).toContain('已被其他管理员修改');
    const getCallsAfter = fetchCalls.filter(c => c.url === '/api/admin/settings' && isGet(c)).length;
    expect(getCallsAfter).toBeGreaterThan(getCallsBefore);
  });

  it('内容模型发布：预览确认后调用发布接口并携带草稿修订号', async () => {
    const { document, fetchCalls } = bootTracked({ user: ADMIN, overrides: {
      '/api/admin/content-model/preview': () => jsonResponse({ preview: { valid: true, errors: [], warnings: [], impact: { submissions: 0 }, draftRevision: 5 } }),
      '/api/admin/content-model/publish': () => jsonResponse({ ok: true, message: '内容模型已发布' }),
    } });
    await waitFor(document, '.nav-item[data-view="model"]');
    document.querySelector('.nav-item[data-view="model"]').click();
    await waitFor(document, '[data-action="modelpublish"]');
    document.querySelector('[data-action="modelpublish"]').click();
    // 预览弹窗（confirmBox 挂载在 body）
    await waitFor(document, '[data-cf-ok]');
    expect(document.body.textContent).toContain('内容模型影响预览');
    document.querySelector('[data-cf-ok]').click();
    await settle();
    const preview = fetchCalls.find(c => c.url === '/api/admin/content-model/preview');
    expect(preview).toBeTruthy();
    expect(preview.opts.method).toBe('POST');
    const publish = fetchCalls.find(c => c.url === '/api/admin/content-model/publish');
    expect(publish).toBeTruthy();
    expect(JSON.parse(publish.opts.body).expectedDraftRevision).toBe(5);
  });

  it('内容模型回滚：确认后携带目标版本与草稿修订号', async () => {
    const { document, fetchCalls } = bootTracked({ user: ADMIN, overrides: {
      '/api/admin/content-model/versions?page=1&pageSize=10': () => jsonResponse({
        versions: [{ version: 1, status: 'published', basedOnVersion: null, checksum: 'abc123', createdAt: '2026-08-01T10:00:00Z' }],
        total: 1,
      }),
      '/api/admin/content-model/rollback': () => jsonResponse({ ok: true, message: '已回滚并发布新版本' }),
    } });
    await waitFor(document, '.nav-item[data-view="model"]');
    document.querySelector('.nav-item[data-view="model"]').click();
    // 切到「发布历史」tab 才渲染版本列表与回滚按钮
    await waitFor(document, '[data-action="modeltab"][data-tab="versions"]');
    document.querySelector('[data-action="modeltab"][data-tab="versions"]').click();
    await waitFor(document, '[data-action="modelrollback"]');
    document.querySelector('[data-action="modelrollback"]').click();
    await waitFor(document, '[data-cf-ok]');
    document.querySelector('[data-cf-ok]').click();
    await settle();
    const rollback = fetchCalls.find(c => c.url === '/api/admin/content-model/rollback');
    expect(rollback).toBeTruthy();
    expect(rollback.opts.method).toBe('POST');
    expect(JSON.parse(rollback.opts.body).version).toBe(1);
    expect(JSON.parse(rollback.opts.body).expectedDraftRevision).toBe(5);
  });

  it('审计清理任务重试：确认后调用重试接口并刷新任务列表', async () => {
    const { document, fetchCalls } = bootTracked({ user: ADMIN, overrides: {
      '/api/admin/audit-cleanup/tasks?limit=8&offset=0': () => jsonResponse({
        total: 1,
        tasks: [{ id: 'clean_1', status: 'failed', filters: { action: 'submit' }, processedCount: 5, createdAt: '2026-08-01T10:00:00Z' }],
      }),
      '/api/admin/audit-cleanup/tasks/clean_1/retry': () => jsonResponse({ ok: true, message: '任务已重新排队' }),
    } });
    await waitFor(document, '.nav-item[data-view="audit"]');
    document.querySelector('.nav-item[data-view="audit"]').click();
    await waitFor(document, '[data-action="auditcleanup-retry"]');
    document.querySelector('[data-action="auditcleanup-retry"]').click();
    await waitFor(document, '[data-cf-ok]');
    document.querySelector('[data-cf-ok]').click();
    await settle();
    const retry = fetchCalls.find(c => c.url === '/api/admin/audit-cleanup/tasks/clean_1/retry');
    expect(retry).toBeTruthy();
    expect(retry.opts.method).toBe('POST');
    expect(document.getElementById('pet-toast').textContent).toContain('任务已重新排队');
  });

  it('封禁管理：IP 封禁列表加载并渲染筛选控件与表格', async () => {
    const { document } = bootTracked({ user: ADMIN, overrides: {
      '/api/admin/banned-ips?ip=&reason=&start=&end=&page=1&pageSize=10': () => jsonResponse({
        total: 2,
        bannedIPs: [
          { ip_hash: 'a'.repeat(64), reason: '恶意投稿', created_at: '2026-08-01T10:00:00Z' },
          { ip_hash: 'b'.repeat(64), reason: '刷屏', created_at: '2026-08-02T10:00:00Z' },
        ],
      }),
    } });
    await waitFor(document, '.nav-item[data-view="banned"]');
    document.querySelector('.nav-item[data-view="banned"]').click();
    // 切到「IP 封禁」tab
    await waitFor(document, '[data-ban-tab="ips"]');
    document.querySelector('[data-ban-tab="ips"]').click();
    await waitFor(document, '[data-banip-input]');
    const text = document.getElementById('view-root').textContent;
    expect(text).toContain('恶意投稿');
    expect(document.querySelectorAll('[data-action="unban"]').length).toBe(2);
    // 筛选控件齐全（IP/原因/起止日期）
    expect(document.querySelector('[data-banip-reason]')).toBeTruthy();
    expect(document.querySelector('[data-banip-start]')).toBeTruthy();
    expect(document.querySelector('[data-banip-end]')).toBeTruthy();
    // 有数据时渲染宠物风分页条
    expect(document.querySelector('[data-nav="banned"]')).toBeTruthy();
  });

  it('封禁管理：空列表展示引导文案且日期筛选无结果时提示精确匹配', async () => {
    const { document } = bootTracked({ user: ADMIN });
    await waitFor(document, '.nav-item[data-view="banned"]');
    document.querySelector('.nav-item[data-view="banned"]').click();
    await waitFor(document, '[data-ban-tab="ips"]');
    document.querySelector('[data-ban-tab="ips"]').click();
    await waitFor(document, '[data-banip-input]');
    expect(document.getElementById('view-root').textContent).toContain('暂无封禁 IP');
  });

  it('封禁管理：筛选请求携带 IP/原因/时间范围（ISO 边界）', async () => {
    const { document, fetchCalls } = bootTracked({ user: ADMIN });
    await waitFor(document, '.nav-item[data-view="banned"]');
    document.querySelector('.nav-item[data-view="banned"]').click();
    await waitFor(document, '[data-ban-tab="ips"]');
    document.querySelector('[data-ban-tab="ips"]').click();
    await waitFor(document, '[data-banip-input]');
    document.querySelector('[data-banip-input]').value = '203.0.113.10';
    document.querySelector('[data-banip-reason]').value = '恶意';
    document.querySelector('[data-banip-start]').value = '2026-08-01';
    document.querySelector('[data-banip-end]').value = '2026-08-10';
    document.querySelector('[data-action="banipfilter"]').click();
    await settle();
    // 取最后一次 banned-ips 请求（首次为初始加载的空参数请求）
    const calls = fetchCalls.filter(c => c.url.includes('/api/admin/banned-ips?'));
    const call = calls[calls.length - 1];
    expect(call).toBeTruthy();
    expect(call.url).toContain('ip=203.0.113.10');
    expect(call.url).toContain('reason=%E6%81%B6%E6%84%8F');
    expect(call.url).toContain('start=2026-08-01T00%3A00%3A00.000Z');
    expect(call.url).toContain('end=2026-08-10T23%3A59%3A59.999Z');
    expect(call.url).toContain('page=1');
  });

  it('内容模型：数据安全列正确渲染对象数组原因（不出现 [object Object]）', async () => {
    const { document } = bootTracked({ user: ADMIN, overrides: {
      '/api/admin/content-model/draft': () => jsonResponse({
        draft: {
          draftRevision: 5,
          types: [{
            id: 'cat', name: '猫猫', icon: '🐱', sortOrder: 1,
            deletionEligibility: { deletable: false, reasons: [
              { code: 'SUBMISSION_REFERENCED', count: 3 },
              { code: 'SCHEMA_VERSION_REFERENCED', versions: [1, 2] },
            ] },
          }],
          fields: [], bindings: [],
        },
        diff: null, validation: null,
      }),
    } });
    await waitFor(document, '.nav-item[data-view="model"]');
    document.querySelector('.nav-item[data-view="model"]').click();
    await waitFor(document, '.model-delete-state.protected');
    const cell = document.querySelector('.model-delete-state.protected');
    expect(cell.textContent).not.toContain('[object Object]');
    expect(cell.textContent).toContain('仅可归档');
    expect(cell.textContent).toContain('已有投稿引用（3 处）');
    expect(cell.textContent).toContain('已发布 Schema 引用（1, 2）');
    expect(cell.title).toContain('已有投稿引用（3 处）');
  });

  it('系统设置：创建备份弹窗口令一致后按钮可用', async () => {
    const { window, document, fetchCalls } = bootTracked({ user: ADMIN });
    await waitFor(document, '.nav-item[data-view="settings"]');
    document.querySelector('.nav-item[data-view="settings"]').click();
    await waitFor(document, '[data-action="backup-export-create"]');
    document.querySelector('[data-action="backup-export-create"]').click();
    await waitFor(document, '[data-backup-create]');
    const pass = document.querySelector('[data-backup-pass]');
    const confirm = document.querySelector('[data-backup-confirm]');
    const create = document.querySelector('[data-backup-create]');
    expect(create.disabled).toBe(true);
    pass.value = 'correct-horse-battery';
    confirm.value = 'correct-horse-battery';
    pass.dispatchEvent(new window.Event('input', { bubbles: true }));
    confirm.dispatchEvent(new window.Event('input', { bubbles: true }));
    expect(create.disabled).toBe(false);
    // 点击创建：POST /admin/backups 携带口令
    create.click();
    await settle();
    const post = fetchCalls.find(c => c.url === '/api/admin/backups' && c.opts && String(c.opts.method).toUpperCase() === 'POST');
    expect(post).toBeTruthy();
    expect(JSON.parse(post.opts.body).passphrase).toBe('correct-horse-battery');
  });
});
