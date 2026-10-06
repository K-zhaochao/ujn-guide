import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { createContext, runInContext } from 'node:vm';
import { JSDOM } from 'jsdom';

const require = createRequire(import.meta.url);
const stateModule = require('../../server/public/admin-ui-state.js');
const viewsModule = require('../../server/public/admin-ui-views.js');
const pickerModule = require('../../server/public/admin-picker.js');
const contentModelModule = require('../../server/public/admin-content-model.js');
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
const MODEL_CONFIG = {
  mode: 'direct', revision: 5, schemaVersion: 1,
  types: [{ id: 'cat', code: 'cat', name: '猫猫', icon: '🐱', sortOrder: 1, visible: true, acceptSubmission: true }],
  fields: [], bindings: [],
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
    '/api/admin/site-notifications?page=1&pageSize=10': () => jsonResponse({
      total: 1,
      notifications: [{ id: 1, title: '维护提醒', body: '今晚短暂维护', audienceLabel: '全站用户', recipientCount: 12, readCount: 3, createdAt: '2026-09-01T10:00:00Z', withdrawnAt: '' }],
    }),
    '/api/admin/notification-groups': () => jsonResponse({ groups: [{ id: 2, name: '志愿者', memberCount: 4 }] }),
    '/api/admin/site-notification-audience?audienceType=all': () => jsonResponse({ audience: { audienceType: 'all', audienceLabel: '全站用户', recipientCount: 12 } }),
    '/api/admin/content-model/config': () => jsonResponse({ config: MODEL_CONFIG }),
    '/api/admin/settings': () => jsonResponse({ settings: { allowSubmit: true, allowEdit: true, allowDelete: true, maintenanceMode: false, maxDailySubmit: 3, maxSubmitRequestsPerMinute: 20, auditRetentionDays: 180, maxImagesPerSubmission: 10, revision: 1 }, policy: [], runtime: {} }),
    '/api/admin/settings/history?page=1&pageSize=10': () => jsonResponse({ items: [], total: 0 }),
    '/api/admin/backups?limit=5': () => jsonResponse({ exports: [] }),
    '/api/admin/banned-users?q=&page=1&pageSize=10': () => jsonResponse({ users: [], total: 0 }),
    '/api/admin/banned-ips?ip=&reason=&start=&end=&page=1&pageSize=10': () => jsonResponse({ bannedIPs: [], total: 0 }),
    '/api/admin/audit?action=&actor=&targetUser=&targetId=&start=&end=&page=1&pageSize=50': () => jsonResponse({ total: 1, audit: [{ id: 1, action: 'submission.approve', actor_username: 'root', created_at: '2026-08-01T10:00:00Z', target_id: 'sub_1', target_username: 'tester', target_avatar: '', detail: '通过投稿' }] }),
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
  window.AdminContentModel = contentModelModule;
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
const deferredResponse = () => {
  let resolve;
  const promise = new Promise(yes => { resolve = yes; });
  return { promise, resolve };
};
const RESTORE_IMPORT = { id: 'restore_test', fileName: 'synthetic.ujnbak', status: 'preflighted', sizeBytes: 100,
  preflightHash: 'hash-fixture', backupId: 'backup-fixture', preflight: { compatible: true, settings: { present: true } } };
const restoreRoutes = extra => ({
  '/api/admin/restore-imports?limit=20': () => jsonResponse({ imports: [RESTORE_IMPORT] }),
  '/api/admin/restore-jobs?limit=20': () => jsonResponse({ jobs: [] }),
  ...extra,
});

describe('管理后台前端交互控制器（admin-ui.js 组件测试）', () => {
  let instances = [];
  beforeEach(() => { instances = []; });
  afterEach(() => { instances.forEach(i => i.dom.window.close()); });

  function bootTracked(opts) {
    const inst = boot(opts);
    instances.push(inst);
    return inst;
  }

  it('恢复页：旧请求在切换待审核后才返回，不覆盖当前内容或重新轮询', async () => {
    const old = deferredResponse();
    const { document, fetchCalls } = bootTracked({ overrides: restoreRoutes({ '/api/admin/restore-imports?limit=20': () => old.promise }) });
    await waitFor(document, '.nav-item[data-view="restore"]');
    document.querySelector('.nav-item[data-view="restore"]').click();
    await settle();
    document.querySelector('.nav-item[data-view="pending"]').click();
    await waitFor(document, '[data-check-id="sub_1"]');
    const content = document.getElementById('view-root').innerHTML;
    old.resolve(jsonResponse({ imports: [RESTORE_IMPORT] })); await settle();
    expect(document.getElementById('view-root').innerHTML).toBe(content);
    expect(fetchCalls.filter(c => c.url.includes('/restore-imports?'))).toHaveLength(1);
  });

  it('恢复页：同页刷新采用最新响应，失败可重试且旧失败不抹掉新数据', async () => {
    const old = deferredResponse();
    let requests = 0;
    const { document } = bootTracked({ overrides: restoreRoutes({ '/api/admin/restore-imports?limit=20': () => ++requests === 1 ? old.promise : jsonResponse({ imports: [{ ...RESTORE_IMPORT, fileName: 'fresh-file' }] }) }) });
    await waitFor(document, '.nav-item[data-view="restore"]');
    document.querySelector('.nav-item[data-view="restore"]').click();
    await settle(); document.querySelector('[data-action="view-refresh"]').click();
    await waitFor(document, '[data-action="restore-preflight"]');
    old.resolve(jsonResponse({ message: 'stale failure' }, 500)); await settle();
    expect(document.getElementById('view-root').textContent).toContain('fresh-file');
    expect(document.getElementById('view-root').textContent).not.toContain('stale failure');
  });

  it('恢复页：活动任务轮询离页即清理，迟到的轮询回调也不发请求', async () => {
    let active = true;
    const { window, document, fetchCalls } = bootTracked({ overrides: restoreRoutes({ '/api/admin/restore-jobs?limit=20': () => jsonResponse({ jobs: active ? [{ id: 'job1', status: 'promoting' }] : [] }) }) });
    const timers = new Map();
    const originalSet = window.setTimeout.bind(window), originalClear = window.clearTimeout.bind(window);
    window.setTimeout = (callback, ms, ...args) => {
      const handle = originalSet(ms === 3000 ? () => {} : callback, ms === 3000 ? 60000 : ms, ...args);
      if (ms === 3000) timers.set(handle, callback);
      return handle;
    };
    window.clearTimeout = handle => { timers.delete(handle); originalClear(handle); };
    await waitFor(document, '.nav-item[data-view="restore"]');
    document.querySelector('.nav-item[data-view="restore"]').click();
    await waitFor(document, '[data-action="restore-upload"]');
    expect(timers.size).toBe(1);
    const stale = [...timers.values()][0];
    document.querySelector('.nav-item[data-view="pending"]').click(); await settle();
    expect(timers.size).toBe(0);
    const calls = fetchCalls.length;
    stale(); await settle(); expect(fetchCalls.length).toBe(calls);
    active = false;
    document.querySelector('.nav-item[data-view="restore"]').click();
    await waitFor(document, '[data-action="restore-upload"]');
    expect(timers.size).toBe(0);
  });

  it('恢复向导：离页关闭口令/确认弹窗，不继续发预检或恢复写请求', async () => {
    const { document, fetchCalls } = bootTracked({ overrides: restoreRoutes() });
    await waitFor(document, '.nav-item[data-view="restore"]');
    document.querySelector('.nav-item[data-view="restore"]').click();
    await waitFor(document, '[data-action="restore-preflight"]');
    document.querySelector('[data-action="restore-preflight"]').click();
    const password = await waitFor(document, '[data-restore-pass]');
    password.value = 'synthetic-secret-passphrase';
    const oldConfirm = document.querySelector('[data-ib-ok]');
    document.querySelector('.nav-item[data-view="pending"]').click();
    oldConfirm.click(); await settle();
    expect(document.querySelector('.cf-overlay')).toBeNull();
    expect(password.value).toBe('');
    expect(fetchCalls.some(c => c.url.endsWith('/preflight'))).toBe(false);
    expect(fetchCalls.some(c => c.url.endsWith('/confirm'))).toBe(false);
  });

  it('恢复向导：迟到的身份重验证不在新页面自动提交全量恢复', async () => {
    const reauth = deferredResponse();
    const { document, fetchCalls } = bootTracked({ overrides: restoreRoutes({ '/api/admin/reauth': () => reauth.promise }) });
    await waitFor(document, '.nav-item[data-view="restore"]');
    document.querySelector('.nav-item[data-view="restore"]').click();
    (await waitFor(document, '[data-action="restore-confirm-full"]')).click();
    (await waitFor(document, '[data-restore-pass]')).value = 'synthetic-restore-passphrase';
    document.querySelector('[data-ib-ok]').click(); await settle();
    document.querySelector('[data-ib-input]').value = '恢复全量数据';
    document.querySelector('[data-ib-ok]').click(); await settle();
    document.querySelector('[data-ib-input]').value = 'root';
    document.querySelector('[data-ib-ok]').click(); await settle();
    expect(fetchCalls.some(c => c.url === '/api/admin/reauth')).toBe(true);
    document.querySelector('.nav-item[data-view="pending"]').click();
    await waitFor(document, '[data-check-id="sub_1"]');
    reauth.resolve(jsonResponse({ success: true })); await settle();
    expect(fetchCalls.some(c => c.url.endsWith('/confirm'))).toBe(false);
    expect(document.querySelector('.cf-overlay')).toBeNull();
  });

  it('恢复页：取消结果迟到不刷新其他页面；上传创建完成后若离页则不继续 PUT', async () => {
    const cancellation = deferredResponse(), creation = deferredResponse();
    const { window, document, fetchCalls } = bootTracked({ overrides: restoreRoutes({
      '/api/admin/restore-imports/restore_test': () => cancellation.promise,
      '/api/admin/restore-imports': () => creation.promise,
    }) });
    await waitFor(document, '.nav-item[data-view="restore"]');
    document.querySelector('.nav-item[data-view="restore"]').click();
    (await waitFor(document, '[data-action="restore-import-cancel"]')).click();
    (await waitFor(document, '[data-cf-ok]')).click(); await settle();
    document.querySelector('.nav-item[data-view="pending"]').click();
    await waitFor(document, '[data-check-id="sub_1"]');
    const content = document.getElementById('view-root').innerHTML;
    cancellation.resolve(jsonResponse({ success: true })); await settle();
    expect(document.getElementById('view-root').innerHTML).toBe(content);
    document.querySelector('.nav-item[data-view="restore"]').click();
    const upload = await waitFor(document, '[data-action="restore-upload"]');
    Object.defineProperty(document.querySelector('[data-restore-file]'), 'files', { value: [new window.File(['test'], 'synthetic.ujnbak')] });
    upload.click(); await settle();
    document.querySelector('.nav-item[data-view="pending"]').click(); await settle();
    creation.resolve(jsonResponse({ uploadUrl: '/api/admin/restore-imports/new_fixture/file' })); await settle();
    expect(fetchCalls.some(c => c.opts?.method === 'PUT' && c.url.endsWith('/file'))).toBe(false);
  });

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
    ['pending', 'approved', 'rejected', 'deleted', 'users', 'notifications', 'banned', 'model', 'audit', 'media', 'settings']
      .forEach(v => expect(items).toContain(v));
  });

  it('超管可进入通知页，查看投递范围、分组和可撤回历史', async () => {
    const { document, fetchCalls } = bootTracked({ user: ADMIN });
    await waitFor(document, '#sidebar');
    document.querySelector('.nav-item[data-view="notifications"]').click();
    await waitFor(document, '[data-notification-title]');
    await settle();
    const text = document.getElementById('view-root').textContent;
    expect(text).toContain('发布通知');
    expect(text).toContain('志愿者');
    expect(text).toContain('维护提醒');
    expect(text).toContain('将发送给 12 位有效用户');
    expect(fetchCalls.some(call => call.url === '/api/admin/site-notifications?page=1&pageSize=10')).toBe(true);
    expect(fetchCalls.some(call => call.url === '/api/admin/notification-groups')).toBe(true);
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
    // 投稿限额：最多上传图片数动态项渲染（后台运行时管控）
    const imageInput = document.querySelector('[data-setting-number="maxImagesPerSubmission"]');
    expect(imageInput).toBeTruthy();
    expect(imageInput.value).toBe('10');
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

  it('审批冲突：保留现场，不重拉版本或自动重试', async () => {
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
    expect(approveAttempts).toBe(1);
    const approveCalls = fetchCalls.filter(c => c.url === '/api/admin/submissions/sub_1/approve');
    expect(approveCalls.length).toBe(1);
    expect(JSON.parse(approveCalls[0].opts.body).rowVersion).toBe(1);
    expect(fetchCalls.some(c => c.url === '/api/admin/submissions/sub_1')).toBe(false);
    expect(document.getElementById('pet-toast').textContent).toContain('本次操作未执行');
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
    expect(JSON.parse(batch.opts.body).items).toEqual([{ id: 'sub_1', rowVersion: 1 }]);
    expect(JSON.parse(batch.opts.body).ids).toBeUndefined();
  });

  it('批量确认冻结卡片版本；部分冲突不读取最新版自动重试', async () => {
    const { window, document, fetchCalls } = bootTracked({ user: ADMIN, overrides: {
      '/api/admin/submissions/batch': () => jsonResponse({ success: true, okCount: 0, failCount: 1, message: '请重新查看后确认', results: [{ id: 'sub_1', ok: false, code: 'SUBMISSION_CONFLICT', currentRowVersion: 2, message: '投稿已变化' }] }),
    } });
    const checkbox = await waitFor(document, '[data-check][data-check-id]');
    checkbox.checked = true;
    checkbox.dispatchEvent(new window.Event('change', { bubbles: true }));
    document.querySelector('[data-action="bulk-approve"]').click();
    await waitFor(document, '[data-cf-ok]');
    window.__subData.sub_1 = { ...SAMPLE_SUB, rowVersion: 2 };
    checkbox.dataset.checkVersion = '2';
    document.querySelector('[data-cf-ok]').click();
    await settle();
    const calls = fetchCalls.filter(c => c.url === '/api/admin/submissions/batch');
    expect(calls).toHaveLength(1);
    expect(JSON.parse(calls[0].opts.body).items).toEqual([{ id: 'sub_1', rowVersion: 1 }]);
    expect(fetchCalls.some(c => c.url === '/api/admin/submissions/sub_1')).toBe(false);
    expect(document.querySelector('[data-check]').checked).toBe(false);
  });

  it('批量操作遇到缺失的卡片版本时不提交', async () => {
    const { window, document, fetchCalls } = bootTracked({ user: ADMIN });
    const checkbox = await waitFor(document, '[data-check][data-check-id]');
    checkbox.checked = true;
    delete checkbox.dataset.checkVersion;
    checkbox.dispatchEvent(new window.Event('change', { bubbles: true }));
    document.querySelector('[data-action="bulk-approve"]').click();
    await settle();
    expect(document.getElementById('pet-toast').textContent).toContain('版本信息不完整');
    expect(fetchCalls.some(c => c.url === '/api/admin/submissions/batch')).toBe(false);
  });

  it('编辑投稿弹窗：照片张数提示使用运行时生效值而非 schema 快照', async () => {
    const { document, fetchCalls } = bootTracked({
      user: ADMIN,
      overrides: {
        '/api/admin/submissions/sub_1': () => jsonResponse({ submission: { ...SAMPLE_SUB, images: [] } }),
        // schema 快照仍是旧值 5 张/5MB；运行时设置已将张数改为 15、单图大小 env 为 2MB
        '/api/content-model/schema': () => jsonResponse({ schema: { schemaVersion: 1, types: [{ id: 'cat', name: '猫猫', icon: '🐱', sortOrder: 1 }], fields: [], bindings: [], constraints: { maxImages: 5, maxImageBytes: 5 * 1024 * 1024 } } }),
        '/api/admin/settings': () => jsonResponse({
          settings: { allowSubmit: true, allowEdit: true, allowDelete: true, maintenanceMode: false, maxDailySubmit: 3, maxSubmitRequestsPerMinute: 20, auditRetentionDays: 180, maxImagesPerSubmission: 15, revision: 2 },
          policy: [],
          runtime: { environment: { runtimeMaxImagesPerSubmission: 15, maxImageBytes: 2 * 1024 * 1024 } },
        }),
      },
    });
    await waitFor(document, '[data-action="edit"][data-id]');
    const editBtn = document.querySelector('[data-action="edit"][data-id]');
    expect(editBtn).toBeTruthy();
    editBtn.click();
    await waitFor(document, '#m-image-meta');
    const meta = document.getElementById('m-image-meta').textContent;
    // 提示与服务端校验一致：张数以运行时值 15 为准、单图大小以运行时 env 2MB 为准，而不是 schema 快照的 5 张/5MB
    expect(meta).toContain('/15 张');
    expect(meta).toContain('2MB');
    expect(meta).not.toContain('5MB');
    expect(fetchCalls.some(c => c.url === '/api/admin/settings')).toBe(true);
  });

  it('后台编辑配置冲突：保留全部输入和照片，核对后再次提交才写入', async () => {
    const definitions = [{ id: 1, key: 'name', label: '名称', dataType: 'text', showInAdmin: true }, { id: 2, key: 'old_note', label: '旧备注', dataType: 'text', showInAdmin: true }];
    let detail = { ...SAMPLE_SUB, typeId: 'cat', schemaVersion: 1, currentSchemaVersion: 1, fields: { name: '小白', old_note: '历史备注' }, fieldDefinitions: definitions, images: [{ url: 'https://example.invalid/kept.png' }] };
    let config = MODEL_CONFIG;
    const { window, document, fetchCalls } = bootTracked({ user: ADMIN, overrides: {
      '/api/admin/content-model/config': () => jsonResponse({ config }),
      '/api/admin/submissions/sub_1': (url, opts) => opts.method === 'PUT'
        ? jsonResponse({ code: 'SUBMISSION_CONFLICT', message: '已被其他人修改' }, 409)
        : jsonResponse({ submission: detail }),
    } });
    await waitFor(document, '[data-action="edit"][data-id]');
    document.querySelector('[data-action="edit"]').click(); await waitFor(document, '#m-save');
    document.querySelector('[data-admin-field-key="name"]').value = '我正在修改';
    document.querySelector('[data-admin-field-key="old_note"]').value = '先保留旧输入';
    config = { ...MODEL_CONFIG, schemaVersion: 2, revision: 6 };
    detail = { ...detail, currentSchemaVersion: 2, rowVersion: 2, fieldDefinitions: [definitions[0], { ...definitions[1], archivedNow: true, readOnly: true }] };
    window.dispatchEvent(new window.Event('focus')); await waitFor(document, '#m-review-config');
    expect(document.querySelector('#m-save').disabled).toBe(true);
    document.querySelector('#m-review-config').click(); await waitFor(document, '#m-confirm-config');
    document.querySelector('[data-admin-field-key="name"]').value = '核对时继续输入';
    document.querySelector('#m-confirm-config').click();
    expect(fetchCalls.filter(call => call.opts.method === 'PUT')).toHaveLength(0);
    expect(document.querySelector('[data-admin-field-key="old_note"]').disabled).toBe(true);
    expect(document.querySelector('[data-admin-field-key="old_note"]').value).toBe('先保留旧输入');
    expect(document.querySelectorAll('#m-image-grid img')).toHaveLength(1);
    document.querySelector('#m-save').click(); await waitFor(document, '#m-review-config');
    const writes = fetchCalls.filter(call => call.opts.method === 'PUT');
    expect(writes).toHaveLength(1);
    expect(JSON.parse(writes[0].opts.body)).toMatchObject({ schemaVersion: 1, currentSchemaVersion: 2, rowVersion: 2, fields: { name: '核对时继续输入' } });
    expect(JSON.parse(writes[0].opts.body).fields).not.toHaveProperty('old_note');
    expect(document.querySelector('[data-admin-field-key="name"]').value).toBe('核对时继续输入');
  });

  it('后台软删除冲突保留现场，不更新 rowVersion 或自动重试', async () => {
    const { document, fetchCalls } = bootTracked({ user: ADMIN, overrides: {
      '/api/admin/submissions/sub_1/soft-delete': () => jsonResponse({ code: 'SUBMISSION_CONFLICT' }, 409),
      '/api/admin/submissions/sub_1': () => jsonResponse({ submission: { ...SAMPLE_SUB, rowVersion: 2 } }),
    } });
    await waitFor(document, '[data-action="softdelete"]');
    document.querySelector('[data-action="softdelete"]').click(); await waitFor(document, '[data-cf-ok]');
    document.querySelector('[data-cf-ok]').click(); await settle();
    const writes = fetchCalls.filter(call => call.url === '/api/admin/submissions/sub_1/soft-delete');
    expect(writes).toHaveLength(1);
    expect(JSON.parse(writes[0].opts.body).rowVersion).toBe(1);
    expect(fetchCalls.some(call => call.url === '/api/admin/submissions/sub_1')).toBe(false);
    expect(document.getElementById('pet-toast').textContent).toContain('本次操作未执行');
  });

  it('后台异步打开编辑后切走视图，迟到详情不能打开旧弹窗', async () => {
    let finish;
    const { document } = bootTracked({ user: ADMIN, overrides: {
      '/api/admin/submissions/sub_1': () => new Promise(resolve => { finish = resolve; }),
    } });
    await waitFor(document, '[data-action="edit"][data-id]');
    document.querySelector('[data-action="edit"]').click(); await settle();
    document.querySelector('.nav-item[data-view="model"]').click(); await waitFor(document, '.cm-card');
    finish(jsonResponse({ submission: SAMPLE_SUB })); await settle();
    expect(document.querySelector('#m-save')).toBeNull();
    expect(document.querySelector('.cm-card')).toBeTruthy();
  });

  it('设置两窗口冲突：保存遇 SETTINGS_CONFLICT 提示并自动重拉最新值', async () => {
    const { document, fetchCalls } = bootTracked({ user: ADMIN, overrides: {
      '/api/admin/settings': async (url, opts) => {
        if (opts && opts.method === 'PUT') {
          return jsonResponse({ message: '已被其他管理员修改', code: 'SETTINGS_CONFLICT' }, 409);
        }
        return jsonResponse({ settings: { allowSubmit: true, allowEdit: true, allowDelete: true, maintenanceMode: false, maxDailySubmit: 3, maxSubmitRequestsPerMinute: 20, auditRetentionDays: 180, maxImagesPerSubmission: 10, revision: 1 }, policy: [], runtime: {} });
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

  it('类型完整保存：只有一个即时写请求，携带并发标记与 CSRF', async () => {
    const { window, document, fetchCalls } = bootTracked({ user: ADMIN, overrides: {
      '/api/admin/content-model/types/cat': () => jsonResponse({ success: true, changed: true, config: MODEL_CONFIG }),
    } });
    await waitFor(document, '.nav-item[data-view="model"]');
    document.querySelector('.nav-item[data-view="model"]').click();
    await waitFor(document, '[data-action="modeltypeedit"]');
    document.querySelector('[data-action="modeltypeedit"]').click();
    document.querySelector('[data-cm="name"]').value = '校园猫';
    document.querySelector('[data-cm-form]').dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true }));
    await settle();
    const writes = fetchCalls.filter(c => c.url.includes('/content-model/') && c.opts.method !== 'GET');
    expect(writes).toHaveLength(1);
    expect(writes[0].opts.method).toBe('PATCH');
    expect(writes[0].opts.headers['X-Content-Model-Mode']).toBe('direct');
    expect(writes[0].opts.headers['X-CSRF-Token']).toBe('csrf-1');
    expect(JSON.parse(writes[0].opts.body)).toMatchObject({ name: '校园猫', fields: [], expectedRevision: 5 });
    expect(fetchCalls.some(c => /\/(draft|publish|rollback|versions)(\?|$)/.test(c.url))).toBe(false);
  });

  it('类型删除：确认历史保留说明后调用逻辑删除', async () => {
    const { document, fetchCalls } = bootTracked({ user: ADMIN, overrides: {
      '/api/admin/content-model/types/cat': () => jsonResponse({ success: true, removed: true, retainedHistoricalData: true, config: { ...MODEL_CONFIG, types: [{ ...MODEL_CONFIG.types[0], archived: true }] } }),
    } });
    await waitFor(document, '.nav-item[data-view="model"]');
    document.querySelector('.nav-item[data-view="model"]').click();
    await waitFor(document, '[data-action="modeltypedelete"]');
    document.querySelector('[data-action="modeltypedelete"]').click();
    await waitFor(document, '[data-cf-ok]');
    expect(document.body.textContent).toContain('不会删除已有投稿或历史字段值');
    document.querySelector('[data-cf-ok]').click();
    await settle();
    const removed = fetchCalls.find(c => c.url === '/api/admin/content-model/types/cat');
    expect(removed.opts.method).toBe('DELETE');
    expect(JSON.parse(removed.opts.body).expectedRevision).toBe(5);
    document.querySelector('[data-action="modeldeleted"]').click();
    expect(document.querySelector('[data-action="modeltyperestore"]')).toBeTruthy();
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

  it('回收站：进入时间筛选下拉渲染、搜索携带 deletedDays、清除重置', async () => {
    const { document, fetchCalls } = bootTracked({ user: ADMIN, overrides: {
      '/api/admin/submissions?status=deleted&page=1&pageSize=10&sort=latest&deletedDays=30': () => jsonResponse({
        total: 0, submissions: [], schema: { schemaVersion: 1, types: [], fields: [] },
      }),
    } });
    await waitFor(document, '.nav-item[data-view="deleted"]');
    document.querySelector('.nav-item[data-view="deleted"]').click();
    await waitFor(document, '[data-subsearch-deleted-days]');
    const select = document.querySelector('[data-subsearch-deleted-days]');
    // 三个档位齐全，默认「全部」
    expect(select.querySelector('option[value=""]').textContent).toContain('全部');
    expect(select.querySelector('option[value="7"]').textContent).toContain('7 日');
    expect(select.querySelector('option[value="30"]').textContent).toContain('30 日');
    expect(select.querySelector('option[value="90"]').textContent).toContain('90 日');
    // 选择 30 日并搜索 → 请求携带 deletedDays=30
    select.value = '30';
    document.querySelector('[data-action="subsearch"]').click();
    await waitFor(document, '.empty');
    await settle();
    expect(fetchCalls.some(call => call.url.includes('status=deleted') && call.url.includes('deletedDays=30'))).toBe(true);
    // 清除 → 回到不带 deletedDays 的默认请求
    document.querySelector('[data-action="subsearch-clear"]').click();
    await settle();
    const lastDeletedCall = fetchCalls.filter(call => call.url.includes('status=deleted')).pop();
    expect(lastDeletedCall).toBeTruthy();
    expect(lastDeletedCall.url).not.toContain('deletedDays');
  });

  it('类型删除：有历史引用仍提供逻辑删除，不再展示永久删除资格', async () => {
    const { document } = bootTracked({ user: ADMIN, overrides: {
      '/api/admin/content-model/config': () => jsonResponse({
        config: {
          ...MODEL_CONFIG,
          types: [{
            id: 'cat', name: '猫猫', icon: '🐱', sortOrder: 1,
            submissionCount: 3,
            deletionEligibility: { deletable: false, reasons: [
              { code: 'SUBMISSION_REFERENCED', count: 3 },
              { code: 'SCHEMA_VERSION_REFERENCED', versions: [1, 2] },
            ] },
          }],
          fields: [], bindings: [],
        },
      }),
    } });
    await waitFor(document, '.nav-item[data-view="model"]');
    document.querySelector('.nav-item[data-view="model"]').click();
    await waitFor(document, '.cm-card');
    const cell = document.querySelector('.cm-card');
    expect(cell.textContent).not.toContain('[object Object]');
    expect(cell.textContent).not.toContain('永久删除');
    expect(cell.textContent).toContain('关联投稿 3 条');
    expect(cell.querySelector('[data-action="modeltypedelete"]')).toBeTruthy();
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
