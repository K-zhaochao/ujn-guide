/**
 * 🐾 宠物收集录 — 前端脚本 v5
 * ===========================
 * 功能：
 *   - 页面专属导航栏：登录（GitHub/Gitee 小卡片）、改名、投稿、我的投稿
 *   - 动态拉取 /api/pets 渲染宠物卡片网格（按分类分组）
 *   - 搜索 / 分类筛选 / 排序（最新发布·最近更新·点赞最多）
 *   - 点赞（登录用户），卡片与详情弹窗均可
 *   - 投稿模态框、我的投稿（页面底部，编辑 / 删除）
 *   - 详情弹窗
 *   - 全部颜色使用 CSS 变量（适配 Material 深色主题）
 *
 * 发布拓扑：
 *   API 通过同源 /api 访问；Nginx 将 /api 和 /admin 反向代理到后端。
 */
(function () {
  'use strict';

  // ================== P2-10 生命周期 ==================
  // 本脚本仅服务宠物页（/pets/ 及 /pets/index.html），但**必须首帧无条件订阅**
  // document$：Material navigation.instant 在站内导航时不会重跑 extra_javascript，
  // 若首帧 return 则导航到宠物页后无人初始化（卡在加载中）。
  // 订阅回调按当前路径分流：宠物页 → 初始化并重注册全局监听；其他页 → 只清理监听，
  // 不发起任何 /api 请求。
  function isPetPage() {
    return /\/pets(\/index\.html)?\/?($|\?|#)/.test(location.pathname);
  }

  // Material 即时导航/多次 init 时，window/document 上的监听会叠加。
  // 统一登记到 window.__pet_globals，每次初始化前先移除上一轮遗留监听，再注册新监听。
  const petGlobals = window.__pet_globals || (window.__pet_globals = []);
  function disposePetGlobals() {
    while (petGlobals.length) {
      removePetGlobal(petGlobals[petGlobals.length - 1]);
    }
  }
  function addPetGlobal(target, type, fn) {
    const entry = { target, type, fn };
    petGlobals.push(entry);
    target.addEventListener(type, fn);
    return entry;
  }
  function removePetGlobal(entry) {
    if (!entry) return;
    try { entry.target.removeEventListener(entry.type, entry.fn); } catch (_) { /* ignore */ }
    const index = petGlobals.indexOf(entry);
    if (index >= 0) petGlobals.splice(index, 1);
  }

  // ================== 配置（无任何硬编码密钥） ==================
  // P0-04：生产环境固定走同源反向代理，禁止把开发机地址编入发布产物。
  const API_BASE = '';
  const MAX_IMAGES = 5; // 默认值；运行时由 schema.constraints.maxImages 覆盖（P1-06）
  let maxImagesLimit = MAX_IMAGES;
  let maxImageBytesLimit = 5 * 1024 * 1024;
  const PAGE_SIZE = 24;

  // 官方品牌图标（内联 SVG，避免额外网络请求；path 取自官方 logo）
  const BRAND_ICONS = {
    github: '<svg viewBox="0 0 16 16" width="18" height="18" fill="currentColor" aria-hidden="true"><path fill-rule="evenodd" d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27s1.36.09 2 .27c1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0 0 16 8c0-4.42-3.58-8-8-8z"/></svg>',
    gitee: '<svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" aria-hidden="true"><path d="M11.984 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.016 0zm6.09 5.333c.328 0 .593.266.592.593v1.482a.594.594 0 0 1-.593.592H9.777c-.982 0-1.778.796-1.778 1.778v5.63c0 .327.266.592.593.592h5.63c.982 0 1.778-.796 1.778-1.778v-.296a.593.593 0 0 0-.592-.593h-4.15a.592.592 0 0 1-.592-.592v-1.482a.593.593 0 0 1 .593-.592h6.815c.327 0 .593.265.593.592v3.408a4 4 0 0 1-4 4H5.926a.593.593 0 0 1-.593-.593V9.778a4.444 4.444 0 0 1 4.445-4.444h8.296Z"/></svg>',
  };

  // 类型只能来自已发布 schema。配置尚未加载时保持空集合，避免旧的
  // 固定八分类在后台发布前抢先生效或成为可投稿兜底。
  let CATEGORIES = [];
  let SUBMISSION_TYPES = [];
  let catEmoji = {};

  const SORTS = [
    { key: 'latest', label: '🕒 最新发布' },
    { key: 'updated', label: '✏️ 最近更新' },
    { key: 'likes', label: '❤️ 点赞最多' },
  ];

  // CSS 变量映射：全部颜色走变量，自动适配 Material 深色主题（fallback 保底）
  const C = {
    bg: 'var(--md-default-bg-color,#fff)',
    fg: 'var(--md-default-fg-color,#374151)',
    fgDark: 'var(--md-default-fg-color,#1f2937)',
    border: 'var(--pet-border,#e5e7eb)',
    soft: 'var(--pet-soft,rgba(0,0,0,.04))',
    imgBg: 'var(--pet-img-bg,#f3f4f6)',
    muted: 'var(--pet-muted,#9ca3af)',
    faint: 'var(--pet-faint,#b0b4bb)',
    primary: 'var(--pet-primary,#3b82f6)',
    gradA: 'var(--pet-grad-a,#fdf2f8)',
    gradB: 'var(--pet-grad-b,#fff7ed)',
    overlay: 'var(--pet-overlay,rgba(0,0,0,.55))',
    chipBg: 'var(--pet-chip-bg,#fff)',
    avatarBg: 'var(--pet-avatar-bg,#e5e7eb)',
    danger: 'var(--pet-danger,#ef4444)',
    dangerBg: 'var(--pet-danger-bg,#fee2e2)',
    success: 'var(--pet-success,#22c55e)',
    inputBg: 'var(--pet-input-bg,#fff)',
  };

  // ================== 状态 ==================
  let allPets = [];
  let currentFilter = '全部';
  let searchQuery = '';
  let sortMode = 'latest';
  let currentPage = 1;
  let totalPages = 1;
  let totalCount = 0;
  let user = null; // { provider, providerId, username, avatarUrl, nickname, isAdmin }
  let authProviders = ['github'];

  // “我的投稿”使用独立的服务端分页状态，避免与公开宠物列表互相影响。
  const MINE_PAGE_SIZE = 20;
  let minePage = 1;
  let mineTotalPages = 1;
  let mineTotal = 0;
  let mineQuery = '';
  let mineStatus = '';
  let mineCategory = '';
  let mineDate = '';
  let mineDateEnd = '';
  let mineSort = 'updated';
  let mineRequestId = 0;
  let mineTypesLoaded = false;

  // 站点系统配置（功能开关 / 维护模式），由 /api/pet-config 拉取，与后台设置实时同步
  let siteConfig = { allowSubmit: true, allowEdit: true, allowDelete: true, maintenance: false, schemaVersion: null };
  let contentSchema = { schemaVersion: null, types: [], fields: [], bindings: [], constraints: { maxImages: MAX_IMAGES } };
  let contentSchemaReady = false;
  const petClient = window.UJNGuidePetClient;
  const petViewModel = window.UJNGuidePetViewModel;
  const petOAuth = window.UJNGuidePetOAuth;
  const petModal = window.UJNGuidePetModal;
  const petFormat = window.UJNGuidePetFormat;
  const petViews = window.UJNGuidePetViews;
  const safeHttpUrl = petClient && petClient.safeHttpUrl;
  let modalController = null;

  // 纯工具函数（pet-format.js）：本地别名让全部既有调用点保持不变
  const {
    esc,
    formatDate,
    formatDateTime,
    humanizeDuration,
    dataUrlByteLength,
    resolveImage,
    displayName,
    debounce,
  } = petFormat;

  /** 图片上限标签：旧签名无参（闭包读 maxImageBytesLimit），包装 pet-format 版 */
  function imageLimitLabel() {
    return petFormat.imageLimitLabel(maxImageBytesLimit);
  }

  // 渲染层（pet-views.js）：每次按当前状态重建实例，避免闭包捕获旧 CATEGORIES/schema
  function buildViewsContext() {
    return {
      C,
      catEmoji,
      CATEGORIES,
      SUBMISSION_TYPES,
      contentSchema,
      maxImagesLimit,
      maxImageBytesLimit,
      safeHttpUrl,
      fieldKey,
      fieldIcon,
      fieldDisplayValue,
      legacyPublicDefinitions,
      publicFieldEntries,
      petEmoji,
      paginationPages: (total, current) => petViewModel.paginationPages(total, current),
      esc,
      formatDate,
      formatDateTime,
      humanizeDuration,
      resolveImage,
      displayName,
      imageLimitLabel,
    };
  }
  function views() { return petViews.createPetViews(buildViewsContext()); }

  function applyContentSchema(config, schema) {
    const projection = petViewModel && petViewModel.projectContentSchema(config, schema, MAX_IMAGES);
    if (!projection) return false;
    contentSchema = projection.contentSchema;
    maxImagesLimit = projection.maxImagesLimit;
    maxImageBytesLimit = projection.maxImageBytesLimit;
    CATEGORIES = projection.categories;
    SUBMISSION_TYPES = projection.submissionTypes;
    catEmoji = projection.categoryEmoji;
    siteConfig.schemaVersion = contentSchema.schemaVersion;
    contentSchemaReady = true;
    return true;
  }

  // 图鉴数据缓存（切换分类 / 排序即时返回，15s 过期 + 数据变更时主动清除）
  const petCache = new Map();
  const PET_CACHE_TTL = 15000;
  const PET_CACHE_MAX = 12;

  // ================== 工具 ==================

  function $(sel, root) { return (root || document).querySelector(sel); }
  function $all(sel, root) { return Array.from((root || document).querySelectorAll(sel)); }

  function typeForPet(p) {
    return petViewModel.typeForPet(p, CATEGORIES);
  }

  function petEmoji(p) {
    return petViewModel.petEmoji(p, CATEGORIES, catEmoji);
  }

  function fieldKey(field) { return petViewModel.fieldKey(field); }

  function fieldIcon(field) { return petViewModel.fieldIcon(field); }

  function fieldDisplayValue(field, value) { return petViewModel.fieldDisplayValue(field, value); }

  function legacyPublicDefinitions(p, context) { return petViewModel.legacyPublicDefinitions(p, context); }

  function publicFieldEntries(p, context) { return petViewModel.publicFieldEntries(p, context); }

  function showToast(msg, isError) {
    let t = document.getElementById('pet-toast');
    if (!t) {
      t = document.createElement('div');
      t.id = 'pet-toast';
      // P2-14：Toast 增加 aria-live，屏幕阅读器可感知消息变化
      t.setAttribute('role', 'status');
      t.setAttribute('aria-live', 'polite');
      t.style.cssText = 'position:fixed;top:20px;right:20px;z-index:20000;padding:12px 20px;border-radius:8px;font-size:14px;box-shadow:0 4px 12px rgba(0,0,0,.15);max-width:360px;transition:opacity .3s';
      document.body.appendChild(t);
    }
    t.style.background = isError ? C.danger : C.success;
    t.style.color = '#fff';
    t.textContent = msg;
    t.style.display = 'block';
    t.style.opacity = '1';
    clearTimeout(t._timer);
    t._timer = setTimeout(() => { t.style.opacity = '0'; }, 3500);
  }

  // ================== P2-14 无障碍：弹窗统一语义 ==================
  // 所有弹层打开统一走 openPetModal：
  //   - role=dialog + aria-modal + aria-label（屏幕阅读器语义）
  //   - Esc 关闭 + 焦点恢复
  //   - 打开时记录触发元素，关闭时恢复焦点
  // 弹窗控制器统一处理重复打开、Esc 监听清理和焦点恢复。
  function openPetModal(modal, opts) {
    opts = opts || {};
    return modalController.open(modal, {
      label: opts.label,
      style: 'position:fixed;top:0;left:0;right:0;bottom:0;background:' + C.overlay + ';z-index:15000;display:flex;align-items:center;justify-content:center;padding:20px',
    });
  }

  function closePetModal(modal) {
    modalController.close(modal);
  }

  // ================== API ==================

  if (!petClient || typeof petClient.createApiClient !== 'function' || typeof petClient.createAuthSession !== 'function' ||
      !petViewModel || typeof petViewModel.projectContentSchema !== 'function' ||
      !petOAuth || typeof petOAuth.createOAuthTransaction !== 'function' ||
      !petModal || typeof petModal.createModalController !== 'function' ||
      !petFormat || typeof petFormat.esc !== 'function' ||
      !petViews || typeof petViews.createPetViews !== 'function') {
    throw new Error('缺少宠物前端基础模块，无法初始化宠物页面');
  }
  modalController = petModal.createModalController({
    document,
    requestAnimationFrame: typeof window.requestAnimationFrame === 'function' ? window.requestAnimationFrame.bind(window) : undefined,
    registerListener: addPetGlobal,
    unregisterListener: removePetGlobal,
  });
  const oauthTransaction = petOAuth.createOAuthTransaction({
    origin: petOAuth.resolveOrigin(API_BASE || location.origin, location.origin),
  });
  let authSession;
  const apiClient = petClient.createApiClient({
    baseUrl: API_BASE,
    getCsrfToken: () => authSession ? authSession.getCsrfToken() : '',
  });
  authSession = petClient.createAuthSession({ request: apiClient.request });

  async function api(path, opts) {
    const result = await authSession.request(path, opts);
    if (result.sessionExpired) {
      const msg = (result.data && result.data.message) || '';
      user = null;
      renderNav();
      updateAuthUI();
      if (/拉黑/.test(msg)) showToast('⚠️ ' + msg, true);
    }
    return result;
  }

  // P1-03 自愈：投稿写操作遇到 ROW_VERSION_REQUIRED / SUBMISSION_CONFLICT 时，
  // 自动重新拉取该投稿最新 rowVersion 并重试一次；仍失败才提示用户手动刷新。
  async function apiSubmissionAction(method, path, body, retried) {
    const r = await api(path, { method, body });
    const code = r.data && r.data.code;
    if (!r.ok && (code === 'ROW_VERSION_REQUIRED' || code === 'SUBMISSION_CONFLICT') && !retried) {
      const detail = await api('/api/my/submissions/' + encodeURIComponent(body._id), { method: 'GET' });
      const sub = detail.ok && (detail.data.submission || detail.data.item);
      if (!sub) { showToast('刷新失败，请手动刷新后重试', true); return r; }
      delete body._id;
      body.rowVersion = sub.rowVersion || sub.row_version || 1;
      return apiSubmissionAction(method, path, body, true);
    }
    return r;
  }

  // ================== 认证 ==================

  // 记录我们打开的 OAuth 窗口引用：登录回调窗口通过 postMessage 回传 token，
  // 监听端同时校验窗口引用和本次交易 nonce，防止可信 origin 内的其他窗口伪造消息。
  function openOAuth(provider) {
    const w = 620, h = 720;
    const left = (screen.width - w) / 2;
    const top = (screen.height - h) / 2;
    const nonce = petClient.createOAuthNonce(window.crypto, window.btoa);
    if (!nonce) {
      showToast('当前浏览器不支持安全登录，请升级浏览器后重试', true);
      return;
    }
    const loginUrl = new URL(API_BASE + '/api/auth/' + encodeURIComponent(provider) + '/login', location.href);
    loginUrl.searchParams.set('nonce', nonce);
    const openedWindow = window.open(loginUrl.href, 'oauth',
      'width=' + w + ',height=' + h + ',left=' + left + ',top=' + top);
    if (!openedWindow) {
      showToast('登录窗口被浏览器拦截，请允许弹窗后重试', true);
      return;
    }
    oauthTransaction.start(openedWindow, nonce);
  }

  async function restoreSession() {
    const r = await authSession.restore();
    if (r.ok && r.data.success) {
      user = authSession.getUser();
    } else {
      const msg = (r.data && r.data.message) || '';
      user = null;
      // P2-09：token 失效也会改变 liked / likeCount 展示，失效公开缓存
      petCache.clear();
      // 被拉黑时提示用户联系站长（其余情况静默清理过期 token）
      if (r.status === 403 && /拉黑/.test(msg)) {
        showToast('⚠️ ' + msg, true);
      }
    }
    renderNav();
    updateAuthUI();
  }

  async function logout() {
    const result = await authSession.logout();
    if (!result.ok && result.status !== 401) {
      showToast((result.data && result.data.message) || '退出登录失败，请重试', true);
      return;
    }
    user = null;
    oauthTransaction.clear();
    closePop('pet-login-pop');
    closePop('pet-rename-pop');
    $('#pet-mine-section').style.display = 'none';
    renderNav();
    updateAuthUI();
    // P2-09：退出后 liked / likeCount 随登录态变化，失效公开缓存并刷新
    petCache.clear();
    loadPets();
    showToast('已退出登录');
  }

  // ================== 弹层（登录卡片 / 改名卡片） ==================

  function closePop(id) {
    const el = document.getElementById(id);
    if (el) el.style.display = 'none';
  }

  function showPop(id, anchorId) {
    const pop = document.getElementById(id);
    const anchor = document.getElementById(anchorId);
    if (!pop || !anchor) return;
    const rect = anchor.getBoundingClientRect();
    // P2-14：小卡片也带 dialog 语义，屏幕阅读器可识别
    pop.setAttribute('role', 'dialog');
    pop.setAttribute('aria-modal', 'false');
    pop.style.display = 'block';
    pop.style.position = 'fixed';
    pop.style.zIndex = '16000';
    // 右对齐锚点下方（卡片宽约 260px）
    pop.style.top = (rect.bottom + 10) + 'px';
    pop.style.left = Math.max(8, rect.right - 264) + 'px';
    // 超出底部则向上弹
    const h = pop.offsetHeight || 200;
    if (rect.bottom + 10 + h > window.innerHeight) {
      pop.style.top = Math.max(8, rect.top - h - 10) + 'px';
    }
  }

  /** 登录小卡片（GitHub / Gitee 双按钮） */
  function openLoginPop() {
    const pop = $('#pet-login-pop');
    const isOpen = pop.style.display !== 'none';
    closePop('pet-rename-pop');
    if (isOpen) { closePop('pet-login-pop'); return; }

    const btn = (p) => '<button id="pet-login-' + p + '" style="display:inline-flex;align-items:center;justify-content:center;gap:8px;width:100%;padding:10px 16px;background:' + (p === 'gitee' ? '#c71d23' : '#24292f') + ';color:#fff;border:none;border-radius:8px;font-size:14px;font-weight:600;cursor:pointer">' + BRAND_ICONS[p] + '<span>' + (p === 'gitee' ? 'Gitee 登录' : 'GitHub 登录') + '</span></button>';

    pop.innerHTML =
      '<div style="background:' + C.bg + ';border:1px solid ' + C.border + ';border-radius:14px;box-shadow:0 8px 28px rgba(0,0,0,.18);padding:16px;width:250px">' +
      '<div style="font-size:14px;font-weight:700;margin-bottom:4px;color:' + C.fg + '">🔑 登录宠物收集录</div>' +
      '<div style="font-size:12px;color:' + C.muted + ';margin-bottom:12px">登录后可投稿 / 点赞 / 管理自己的投稿</div>' +
      '<div style="display:flex;flex-direction:column;gap:8px">' +
      authProviders.map(btn).join('') +
      '</div>' +
      '<div style="font-size:11px;color:' + C.faint + ';margin-top:12px;line-height:1.5">登录即代表你同意将照片用于校园图鉴展示。头像与昵称取自平台。</div>' +
      '</div>';
    showPop('pet-login-pop', 'pet-login-btn');
    authProviders.forEach(p => {
      const b = $('#pet-login-' + p);
      if (b) b.onclick = () => { closePop('pet-login-pop'); openOAuth(p); };
    });
  }

  /** 改名小卡片 */
  function openRenamePop() {
    const pop = $('#pet-rename-pop');
    const isOpen = pop.style.display !== 'none';
    closePop('pet-login-pop');
    if (isOpen) { closePop('pet-rename-pop'); return; }
    if (!user) return;

    pop.innerHTML =
      '<div style="background:' + C.bg + ';border:1px solid ' + C.border + ';border-radius:14px;box-shadow:0 8px 28px rgba(0,0,0,.18);padding:16px;width:250px">' +
      '<div style="font-size:14px;font-weight:700;margin-bottom:4px;color:' + C.fg + '">✏️ 修改展示昵称</div>' +
      '<div style="font-size:12px;color:' + C.muted + ';margin-bottom:10px">昵称用于投稿者展示，改名后你过去的投稿也会同步更新</div>' +
      '<input id="pet-rename-input" maxlength="20" placeholder="输入新昵称" value="' + esc(user.nickname || '') + '" style="width:100%;box-sizing:border-box;padding:9px 12px;border:1px solid ' + C.border + ';border-radius:8px;font-size:14px;outline:none;background:' + C.inputBg + ';color:inherit">' +
      '<div style="display:flex;gap:8px;margin-top:10px">' +
      '<button id="pet-rename-save" style="flex:1;padding:8px 0;background:' + C.primary + ';color:#fff;border:none;border-radius:8px;font-size:14px;cursor:pointer;font-weight:600">保存</button>' +
      '<button id="pet-rename-cancel" style="padding:8px 14px;background:' + C.soft + ';border:1px solid ' + C.border + ';border-radius:8px;font-size:14px;cursor:pointer;color:' + C.fg + '">取消</button>' +
      '</div>' +
      '</div>';
    showPop('pet-rename-pop', 'pet-user-btn');
    $('#pet-rename-cancel').onclick = () => closePop('pet-rename-pop');
    $('#pet-rename-save').onclick = async () => {
      const val = $('#pet-rename-input').value.trim().slice(0, 20);
      if (!val) { showToast('昵称不能为空', true); return; }
      const r = await api('/api/auth/me', { method: 'PUT', body: { nickname: val } });
      if (r.ok) {
        user.nickname = r.data.nickname;
        closePop('pet-rename-pop');
        renderNav();
        showToast('✅ 昵称已更新');
        petCache.clear();
        loadPets(); // 刷新卡片投稿人展示
      } else {
        showToast(r.data.message || '修改失败', true);
      }
    };
    const input = $('#pet-rename-input');
    input.focus();
    input.select();
    input.onkeydown = (e) => { if (e.key === 'Enter') $('#pet-rename-save').click(); };
  }

  // 点击空白处关闭弹层（用 closest 判断锚点，兼容点击按钮内部 SVG/span 的情况）
  function registerPopupClose() {
    addPetGlobal(document, 'click', function (e) {
      const pop = $('#pet-login-pop');
      const rp = $('#pet-rename-pop');
      const isLoginAnchor = !!(e.target.closest && e.target.closest('#pet-login-btn'));
      const isRenameAnchor = !!(e.target.closest && (e.target.closest('#pet-user-btn') || e.target.closest('#pet-rename-nav')));
      if (pop && pop.style.display !== 'none') {
        if (!pop.contains(e.target) && !isLoginAnchor) closePop('pet-login-pop');
      }
      if (rp && rp.style.display !== 'none') {
        if (!rp.contains(e.target) && !isRenameAnchor) closePop('pet-rename-pop');
      }
    });
  }

  // ================== 页面导航栏 ==================

  function renderNav() {
    const nav = $('#pet-nav');
    if (!nav) return;
    // 管理后台与主站共用 Cookie 会话；后端仍会在管理 API 上校验管理员角色。
    const adminBtn = user && user.isAdmin
      ? '<button id="pet-admin-nav" style="display:inline-flex;align-items:center;gap:5px;padding:8px 14px;background:none;border:1px solid ' + C.primary + ';border-radius:9px;font-size:14px;cursor:pointer;color:' + C.primary + ';font-weight:600">⚙️ 管理后台</button>'
      : '';
    const loginBtn = !user
      ? '<button id="pet-login-btn" style="display:inline-flex;align-items:center;gap:6px;padding:8px 18px;background:' + C.primary + ';color:#fff;border:none;border-radius:9px;font-size:14px;font-weight:600;cursor:pointer">' + BRAND_ICONS.github + '<span>登录</span></button>'
      : '<div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">' +
          '<button id="pet-user-btn" title="点击修改昵称" style="display:inline-flex;align-items:center;gap:8px;background:' + C.soft + ';border:1px solid ' + C.border + ';border-radius:20px;padding:4px 12px 4px 4px;cursor:pointer;font-size:14px;color:' + C.fg + ';font-weight:600">' +
            (user.avatarUrl
              ? '<img src="' + esc(user.avatarUrl) + '" alt="" style="width:26px;height:26px;border-radius:50%;object-fit:cover">'
              : '<span style="width:26px;height:26px;border-radius:50%;background:' + C.avatarBg + ';display:inline-flex;align-items:center;justify-content:center;font-size:13px">🐾</span>') +
            '<span>' + esc(displayName(user)) + '</span>' +
            '<span style="font-size:11px;color:' + C.muted + '">✏️</span>' +
          '</button>' +
          '<button id="pet-rename-nav" title="修改展示昵称" style="display:inline-flex;align-items:center;gap:4px;padding:8px 10px;background:none;border:1px dashed ' + C.border + ';border-radius:9px;font-size:13px;cursor:pointer;color:' + C.muted + '">✏️ 改昵称</button>' +
          (siteConfig.allowSubmit && !siteConfig.maintenance && contentSchemaReady && SUBMISSION_TYPES.length
            ? '<button id="pet-submit-nav" style="display:inline-flex;align-items:center;gap:5px;padding:8px 16px;background:' + C.primary + ';color:#fff;border:none;border-radius:9px;font-size:14px;font-weight:600;cursor:pointer">🆕 投稿</button>'
            : '<button id="pet-submit-nav" style="display:inline-flex;align-items:center;gap:5px;padding:8px 16px;background:' + C.soft + ';color:' + C.muted + ';border:1px solid ' + C.border + ';border-radius:9px;font-size:14px;font-weight:600;cursor:not-allowed" title="' + (siteConfig.maintenance ? '宠物收集录正在维护中' : (!contentSchemaReady ? '投稿配置暂未加载' : '投稿功能已关闭')) + '">🆕 投稿</button>') +
          '<button id="pet-mine-nav" style="display:inline-flex;align-items:center;gap:5px;padding:8px 14px;background:' + C.soft + ';border:1px solid ' + C.border + ';border-radius:9px;font-size:14px;cursor:pointer;color:' + C.fg + '">📋 我的投稿</button>' +
          adminBtn +
          '<button id="pet-logout-nav" style="padding:8px 12px;background:none;border:none;border-radius:8px;font-size:13px;cursor:pointer;color:' + C.muted + '">退出</button>' +
        '</div>';

    nav.innerHTML =
      '<div style="display:flex;align-items:center;justify-content:flex-end;gap:10px;flex-wrap:wrap;padding:12px 4px;border-bottom:1px solid ' + C.border + ';margin-bottom:16px">' +
      '<div>' + loginBtn + '</div>' +
      '</div>';

    const lb = $('#pet-login-btn'); if (lb) lb.onclick = openLoginPop;
    const ub = $('#pet-user-btn'); if (ub) ub.onclick = openRenamePop;
    const rn = $('#pet-rename-nav'); if (rn) rn.onclick = openRenamePop;
    const sb = $('#pet-submit-nav'); if (sb) sb.onclick = openSubmitModal;    const mb = $('#pet-mine-nav');
    if (mb) mb.onclick = () => {
      const sec = $('#pet-mine-section');
      if (sec.style.display === 'none' || !sec.dataset.loaded) {
        openMineSection();
      } else {
        sec.style.display = 'none';
      }
    };
    const ab = $('#pet-admin-nav');
    if (ab) ab.onclick = () => window.open('/admin', '_blank', 'noopener');
    const lo = $('#pet-logout-nav'); if (lo) lo.onclick = logout;
  }

  // ================== 工具栏（静态，避免搜索框失焦） ==================

  function renderToolbar() {
    const tb = $('#pet-toolbar');
    if (!tb || tb.dataset.rendered) return;
    tb.dataset.rendered = '1';

    const sortGroup = '<div style="display:flex;gap:6px;flex-wrap:wrap">' +
      SORTS.map(s =>
        '<button class="pet-sort-btn" data-sort="' + s.key + '" style="padding:7px 12px;border-radius:18px;border:1px solid ' + C.border + ';background:' + C.chipBg + ';color:' + C.fg + ';font-size:13px;cursor:pointer;font-weight:500">' + s.label + '</button>'
      ).join('') +
      '</div>';

    const filters = ['全部', ...CATEGORIES.map(c => c.key)].map(c =>
      '<button class="pet-filter-btn" data-cat="' + esc(c) + '" style="padding:6px 16px;border-radius:20px;border:1px solid ' + C.border + ';background:' + C.chipBg + ';color:' + C.fg + ';font-size:13px;cursor:pointer;font-weight:500">' +
      (c === '全部' ? '🐾 全部' : (catEmoji[c] || '') + ' ' + c) + '</button>'
    ).join('');

    tb.innerHTML =
      '<div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin-bottom:12px">' +
      '<input type="text" id="pet-search" placeholder="🔍 搜索宠物名 / 地点..." aria-label="搜索宠物名或地点" style="flex:1;min-width:200px;max-width:380px;padding:10px 14px;border:1px solid ' + C.border + ';border-radius:9px;font-size:14px;outline:none;background:' + C.inputBg + ';color:inherit">' +
      sortGroup +
      '</div>' +
      '<div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:20px">' + filters + '</div>';

    const search = $('#pet-search');
    search.addEventListener('input', debounce(function () {
      searchQuery = this.value.trim();
      currentPage = 1;
      loadPets();
    }, 350));

    $all('.pet-filter-btn').forEach(btn => {
      btn.addEventListener('click', function () {
        currentFilter = this.dataset.cat;
        currentPage = 1;
        updateFilterUI();
        loadPets();
      });
    });
    $all('.pet-sort-btn').forEach(btn => {
      btn.addEventListener('click', function () {
        sortMode = this.dataset.sort;
        currentPage = 1;
        updateSortUI();
        loadPets();
      });
    });
    updateFilterUI();
    updateSortUI();
  }

  function updateFilterUI() {
    $all('.pet-filter-btn').forEach(b => {
      const active = b.dataset.cat === currentFilter;
      b.style.background = active ? C.primary : C.chipBg;
      b.style.color = active ? '#fff' : C.fg;
      b.style.borderColor = active ? C.primary : C.border;
    });
  }

  function updateSortUI() {
    $all('.pet-sort-btn').forEach(b => {
      const active = b.dataset.sort === sortMode;
      b.style.background = active ? C.primary : C.chipBg;
      b.style.color = active ? '#fff' : C.fg;
      b.style.borderColor = active ? C.primary : C.border;
    });
  }

  // ================== 宠物图鉴渲染 ==================

  // P2-09：公开列表请求序号——快速搜索 / 切换类型时旧响应不得覆盖新响应
  let petRequestId = 0;

  async function loadPets() {
    const gallery = $('#pet-gallery');
    if (!gallery) return;

    const params = new URLSearchParams(petViewModel.buildPetListQuery({
      searchQuery,
      currentFilter,
      categories: CATEGORIES,
      sortMode,
      currentPage,
      pageSize: PAGE_SIZE,
    }));
    const cacheKey = params.toString();
    const requestSeq = ++petRequestId;

    // 命中缓存 → 即时渲染，无需等待网络
    const cached = petCache.get(cacheKey);
    if (cached && Date.now() - cached.t < PET_CACHE_TTL) {
      if (requestSeq !== petRequestId) return; // 已有更新的请求发出
      allPets = cached.pets;
      totalCount = cached.total;
      totalPages = cached.totalPages;
      renderGallery();
      return;
    }

    // 首次加载显示占位；已有内容则轻微变淡，避免"加载中"整页闪烁
    const hasContent = gallery.querySelector('.pet-card, .pet-empty, .pet-error');
    if (!hasContent) {
      gallery.innerHTML = '<p style="text-align:center;color:#999;padding:40px">🐾 加载中...</p>';
    } else {
      gallery.style.transition = 'opacity .12s';
      gallery.style.opacity = '0.4';
    }

    const r = await api('/api/pets?' + params.toString());
    if (requestSeq !== petRequestId) return; // 已被更新的请求取代，丢弃本次响应
    if (!r.ok) {
      gallery.style.opacity = '';
      gallery.innerHTML = '<p class="pet-error" style="text-align:center;color:' + C.danger + ';padding:40px">⚠️ 加载失败：' + esc(r.data.message || '未知错误') + '</p>';
      return;
    }
    allPets = r.data.pets || [];
    totalCount = r.data.total || 0;
    totalPages = r.data.totalPages || 1;
    if (petCache.size >= PET_CACHE_MAX) petCache.delete(petCache.keys().next().value);
    petCache.set(cacheKey, { pets: allPets, total: totalCount, totalPages, t: Date.now() });
    renderGallery();
    gallery.style.opacity = '';
  }

  function renderGallery() {
    const gallery = $('#pet-gallery');
    if (!gallery) return;

    // 渲染层（pet-views.js）负责 HTML 生成：分组、空态、分页、卡片
    gallery.innerHTML = views().galleryHtml({
      allPets,
      searchQuery,
      currentPage,
      totalPages,
      totalCount,
    });

    $all('.pet-page-btn').forEach(btn => {
      btn.addEventListener('click', function () {
        if (this.disabled) return;
        const page = parseInt(this.dataset.page, 10);
        if (page < 1 || page > totalPages || page === currentPage) return;
        currentPage = page;
        loadPets();
        window.scrollTo({ top: 0, behavior: 'smooth' });
      });
    });
    $all('.pet-card').forEach(card => {
      card.addEventListener('click', function () { openDetail(this.dataset.id); });
      // P2-14：键盘操作（Enter / Space 打开详情）
      card.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openDetail(this.dataset.id); }
      });
    });
  }

  // ================== 点赞 ==================

  async function toggleLike(petId, btn) {
    if (!user) {
      showToast('请先登录后再点赞 💌', true);
      openLoginPop();
      return;
    }
    const r = await api('/api/pets/' + petId + '/like', { method: 'POST' });
    if (!r.ok || !r.data.success) {
      showToast(r.data.message || '点赞失败', true);
      return;
    }
    const liked = r.data.liked;
    const count = r.data.likeCount;
    // 详情弹窗按钮
    if (btn) {
      btn.innerHTML = '<span>' + (liked ? '❤️' : '🤍') + '</span><span>' + count + '</span>';
      btn.style.background = liked ? 'var(--pet-danger,#ef4444)' : C.soft;
      btn.style.color = liked ? '#fff' : C.fg;
      btn.style.borderColor = liked ? 'var(--pet-danger,#ef4444)' : C.border;
    }
    // 同步列表卡片徽章
    const card = $('.pet-card[data-id="' + petId + '"]');
    if (card) {
      const badge = card.querySelector('.pet-card-like');
      if (badge) {
        badge.textContent = (liked ? '❤️ ' : '🤍 ') + count;
        badge.style.color = liked ? C.danger : C.muted;
      }
    }
    // P2-09：点赞改变 liked / likeCount，任何排序下都应失效缓存，避免切页/搜索时回旧值
    petCache.clear();
    if (sortMode === 'likes') loadPets();
    showToast(r.data.message || (liked ? '已点赞' : '已取消点赞'));
  }

  // ================== 详情弹窗 ==================

  async function openDetail(id) {
    const r = await api('/api/pets/' + id);
    if (!r.ok || !r.data.pet) { showToast('加载详情失败', true); return; }
    const p = r.data.pet;
    const modal = $('#pet-detail-modal');
    openPetModal(modal, { label: '宠物详情' });

    const images = p.images || [];
    let detailIdx = 0; // 当前主图索引（供灯箱使用）

    // 渲染层（pet-views.js）负责详情 HTML 生成
    modal.innerHTML = views().detailModalHtml(p);

    $('#pet-detail-close').onclick = () => { closePetModal(modal); };
    // 主图点击 → 灯箱全屏查看（不再新开标签页）
    const detailMain = modal.querySelector('#pet-detail-main');
    if (detailMain) detailMain.onclick = () => openLightbox(images.map(resolveImage), detailIdx);
    modal.onclick = (e) => { if (e.target === modal) closePetModal(modal); };
    $('#pet-like-btn').onclick = (e) => { e.stopPropagation(); toggleLike(p.id, e.currentTarget); };

    // 缩略图切换主图
    $all('[data-detail-img]', modal).forEach(thumb => {
      thumb.addEventListener('click', function () {
        const idx = parseInt(this.dataset.detailImg, 10);
        detailIdx = idx;
        const imgs = images.map(resolveImage);
        const main = modal.querySelector('#pet-detail-main') ||
          modal.querySelector('img[style*="max-height:340px"]');
        if (main && imgs[idx]) main.src = imgs[idx];
        $all('[data-detail-img]', modal).forEach(t => { t.style.borderColor = 'transparent'; });
        this.style.borderColor = C.primary;
      });
    });
  }

  /** 剪贴板 API 不可用时的兜底复制 */
  function fallbackCopy(text, btn) {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    try { document.execCommand('copy'); showToast('✅ 已复制投稿 ID：' + text); } catch (e) { showToast('复制失败，请手动复制：' + text, true); }
    document.body.removeChild(ta);
  }

  // ================== 图片灯箱（全屏查看，不跳新页面） ==================

  let lightboxImages = [];
  let lightboxIndex = 0;

  function openLightbox(list, index) {
    lightboxImages = list || [];
    lightboxIndex = Math.max(0, Math.min(index || 0, lightboxImages.length - 1));
    const lb = $('#pet-lightbox');
    if (!lb) return;
    renderLightbox();
    lb.style.display = 'flex';
    document.body.style.overflow = 'hidden';
  }

  function renderLightbox() {
    const img = $('#pet-lightbox-img');
    if (img && lightboxImages[lightboxIndex]) img.src = lightboxImages[lightboxIndex];
    const counter = $('#pet-lightbox-counter');
    if (counter) counter.textContent = lightboxImages.length > 1 ? (lightboxIndex + 1) + ' / ' + lightboxImages.length : '';
    const prev = $('#pet-lightbox-prev');
    const next = $('#pet-lightbox-next');
    if (prev) prev.style.display = lightboxImages.length > 1 ? 'flex' : 'none';
    if (next) next.style.display = lightboxImages.length > 1 ? 'flex' : 'none';
  }

  function closeLightbox() {
    const lb = $('#pet-lightbox');
    if (lb) lb.style.display = 'none';
    document.body.style.overflow = '';
  }

  function lightboxStep(dir) {
    if (!lightboxImages.length) return;
    lightboxIndex = (lightboxIndex + dir + lightboxImages.length) % lightboxImages.length;
    renderLightbox();
  }

  // ================== 投稿模态框 ==================

  // 字段绑定 / 动态字段 HTML / 字段区渲染由 pet-views.js 提供：
  //   views().schemaFieldsForType(typeId)
  //   views().dynamicFieldHtml(field, value, idPrefix)
  //   views().renderSubmitFieldsHtml(typeId, values)

  function renderSubmitFields(typeId, values) {
    const root = $('#pet-dynamic-fields');
    if (!root) return;
    root.innerHTML = views().renderSubmitFieldsHtml(typeId, values);
  }

  function readDynamicFields(root) {
    const values = {};
    $all('[data-field-key]', root || document).forEach(el => {
      const key = el.dataset.fieldKey;
      if (!key) return;
      if (el.type === 'checkbox') values[key] = !!el.checked;
      else if (el.multiple) values[key] = Array.from(el.selectedOptions).map(option => option.value);
      else values[key] = el.value.trim();
    });
    return values;
  }

  function openSubmitModal() {
    if (!contentSchemaReady || !SUBMISSION_TYPES.length) {
      showToast('投稿配置尚未加载或当前没有可投稿类型，请稍后刷新页面', true);
      return;
    }
    if (siteConfig.maintenance) {
      showToast('⚠️ 宠物收集录正在维护中，投稿功能暂时关闭', true);
      return;
    }
    if (!siteConfig.allowSubmit) {
      showToast('⚠️ 当前已关闭投稿功能，请联系站长', true);
      return;
    }
    const modal = $('#pet-submit-modal');
    openPetModal(modal, { label: '投稿新宠物' });
    modal.innerHTML =
      '<div class="pet-scroll" style="background:' + C.bg + ';border-radius:16px;max-width:540px;width:100%;max-height:90vh;overflow-y:auto;padding:26px 24px;position:relative">' +
      '<button id="pet-submit-close" style="position:absolute;top:12px;right:16px;background:none;border:none;font-size:26px;cursor:pointer;color:' + C.muted + '">✕</button>' +
      '<h2 style="margin:0 0 18px;font-size:20px;color:' + C.fgDark + '">🐾 投稿新宠物</h2>' +

      '<div style="display:flex;gap:10px;margin-bottom:16px">' +
        '<div style="flex:1">' +
          '<label style="display:block;font-size:14px;font-weight:600;margin-bottom:6px;color:' + C.fg + '">种类 <span style="color:' + C.danger + '">*</span></label>' +
          '<div id="pet-category-picker" style="position:relative">' +
            '<button type="button" id="pet-category-btn" style="width:100%;padding:10px 12px;border:1px solid ' + C.border + ';border-radius:8px;font-size:15px;background:' + C.inputBg + ';color:inherit;cursor:pointer;text-align:left;display:flex;align-items:center;justify-content:space-between;gap:6px;box-sizing:border-box">' +
              '<span id="pet-category-label" style="color:' + C.muted + '">请选择</span>' +
              '<span id="pet-category-caret" style="font-size:12px;color:' + C.muted + ';transition:transform .15s">▾</span>' +
            '</button>' +
            '<div id="pet-category-menu" style="display:none;position:absolute;top:calc(100% + 6px);left:0;right:0;background:' + C.bg + ';border:1px solid ' + C.border + ';border-radius:10px;box-shadow:0 10px 30px rgba(0,0,0,.18);z-index:40;padding:6px;max-height:260px;overflow-y:auto">' +
              '<div style="display:grid;grid-template-columns:1fr 1fr;gap:4px">' +
                '<button type="button" class="pet-cat-opt" data-cat="" style="grid-column:1 / -1;display:flex;align-items:center;justify-content:center;gap:6px;padding:9px 10px;border:none;border-radius:8px;background:' + C.soft + ';color:' + C.muted + ';font-size:13px;cursor:pointer">🧭 请选择</button>' +
                SUBMISSION_TYPES.map(c => '<button type="button" class="pet-cat-opt" data-cat="' + esc(c.key) + '" data-type-id="' + esc(c.id) + '" data-type-code="' + esc(c.code || '') + '" style="display:flex;align-items:center;gap:8px;padding:9px 10px;border:none;border-radius:8px;background:none;color:' + C.fg + ';font-size:14px;cursor:pointer;text-align:left">' + esc(c.emoji) + ' <span>' + esc(c.key) + '</span></button>').join('') +
              '</div>' +
            '</div>' +
          '</div>' +
        '</div>' +
        '<div style="flex:2">' +
          '<label style="display:block;font-size:14px;font-weight:600;margin-bottom:6px;color:' + C.fg + '">宠物名称 <span style="font-weight:400;color:' + C.muted + ';font-size:12px">（选填）</span></label>' +
          '<input type="text" id="pet-name" maxlength="20" placeholder="例：小白（也可留空）" style="width:100%;padding:10px 12px;border:1px solid ' + C.border + ';border-radius:8px;font-size:15px;outline:none;background:' + C.inputBg + ';color:inherit;box-sizing:border-box">' +
          '<div id="pet-name-status" style="font-size:12px;margin-top:4px;min-height:18px;color:' + C.muted + '">💡 名称选填，留空将显示为“未命名宠物”，可凭照片+地点识别</div>' +
        '</div>' +
      '</div>' +

      '<div style="margin-bottom:16px">' +
        '<label style="display:block;font-size:14px;font-weight:600;margin-bottom:6px;color:' + C.fg + '">照片 <span style="color:' + C.danger + '">*</span> <span style="font-weight:400;color:' + C.muted + ';font-size:12px">（1~' + maxImagesLimit + ' 张，单张不超过 ' + imageLimitLabel() + '，自动压缩）</span></label>' +
        '<label for="pet-images" style="display:inline-flex;align-items:center;gap:6px;padding:10px 20px;background:' + C.soft + ';color:' + C.primary + ';border:2px dashed var(--pet-primary,#93c5fd);border-radius:10px;font-size:14px;font-weight:500;cursor:pointer">' +
        '<span style="font-size:18px">📷</span> 选择文件</label>' +
        '<input type="file" id="pet-images" accept="image/*" multiple style="display:none">' +
        '<span id="pet-image-count" style="font-size:13px;color:' + C.muted + ';margin-left:8px"></span>' +
        '<div id="pet-image-previews" style="display:flex;gap:8px;margin-top:10px;flex-wrap:wrap"></div>' +
      '</div>' +

      '<div id="pet-dynamic-fields" style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:16px"></div>' +

      '<div id="pet-auth-area" style="margin-bottom:14px"></div>' +
      '<button id="pet-submit-btn" disabled style="width:100%;padding:12px;background:#9ca3af;color:#fff;border:none;border-radius:8px;font-size:16px;cursor:not-allowed;font-weight:600">🔒 请先登录后再投稿</button>' +
      '</div>';

    $('#pet-submit-close').onclick = closeWithDraftSave;
    modal.onclick = (e) => { if (e.target === modal) closeWithDraftSave(); };

    updateAuthUI();

    // ===== P1-06 投稿草稿：自动保存 + 恢复（草稿只存文本字段与图片张数，不存 dataUrl） =====
    let draftId = null;
    let draftRowVersion = 1;
    let draftTimer = null;
    const DRAFT_SAVE_DELAY = 800;
    const buildDraftPayload = () => {
      const fields = readDynamicFields($('#pet-dynamic-fields'));
      const nameEl = $('#pet-name');
      if (nameEl) fields.name = nameEl.value.trim();
      return {
        typeId: submitTypeId || undefined,
        typeCode: submitTypeCode || undefined,
        category: submitCategory || undefined,
        fields,
        imageCount: uploadedImages.length,
      };
    };
    const hasDraftContent = (payload) => {
      if (payload.category || payload.typeId || payload.imageCount) return true;
      return Object.values(payload.fields || {}).some(v => String(v || '').trim() !== '');
    };
    const saveDraft = () => {
      if (!user) return;
      const payload = buildDraftPayload();
      if (!hasDraftContent(payload)) return;
      api('/api/my/drafts', {
        method: 'POST',
        body: { id: draftId || undefined, rowVersion: draftId ? draftRowVersion : undefined, schemaVersion: contentSchema.schemaVersion || siteConfig.schemaVersion, payload },
      }).then(r => {
        if (r.ok && r.data && r.data.draft) { draftId = r.data.draft.id; draftRowVersion = r.data.draft.rowVersion; }
      }).catch(() => { /* 草稿保存失败不打断投稿 */ });
    };
    const scheduleDraftSave = () => {
      clearTimeout(draftTimer);
      draftTimer = setTimeout(saveDraft, DRAFT_SAVE_DELAY);
    };
    const discardDraft = () => {
      if (draftId) api('/api/my/drafts/' + encodeURIComponent(draftId), { method: 'DELETE' }).catch(() => {});
      draftId = null;
    };
    function closeWithDraftSave() {
      clearTimeout(draftTimer);
      saveDraft(); // 关闭时立即保存当前内容
      closeSubmitModal();
    }
    const restoreLatestDraft = async () => {
      if (!user) return;
      try {
        const r = await api('/api/my/drafts?pageSize=1');
        if (!r.ok || !r.data || !r.data.items || !r.data.items.length) return;
        const d = r.data.items[0];
        draftId = d.id;
        draftRowVersion = d.rowVersion || 1;
        const p = d.payload || {};
        if (p.category || p.typeId) {
          submitCategory = p.category || '';
          submitTypeId = p.typeId || '';
          submitTypeCode = p.typeCode || '';
          catLabel.textContent = submitCategory ? (catEmoji[submitCategory] || '') + ' ' + submitCategory : '请选择';
          catLabel.style.color = submitCategory ? 'inherit' : C.muted;
          renderSubmitFields(submitTypeId, p.fields || {});
        }
        const nameEl = $('#pet-name');
        if (nameEl && p.fields && p.fields.name) nameEl.value = p.fields.name;
        const cnt = $('#pet-image-count');
        if (cnt && p.imageCount) cnt.textContent = '💾 上次草稿 ' + p.imageCount + ' 张照片（需重新选择）';
        showToast('💾 已恢复上次未完成的投稿草稿');
      } catch (e) { /* 草稿恢复失败不打断投稿 */ }
    };

    // 输入变化 → 防抖自动保存
    const nameEl = $('#pet-name');
    if (nameEl) nameEl.addEventListener('input', scheduleDraftSave);
    const dynRoot = $('#pet-dynamic-fields');
    if (dynRoot) dynRoot.addEventListener('input', scheduleDraftSave);
    restoreLatestDraft();

    // 自定义分类下拉（替代原生 select）
    let submitCategory = '';
    let submitTypeId = '';
    let submitTypeCode = '';
    // P1-04 幂等键：每次打开投稿弹窗生成一次；提交失败重试（弹窗未关）复用同一 key，
    // 服务端据此去重，双击/网络重试不会产生重复投稿。
    let submitIdempotencyKey = 'submit:' + (user ? (user.userId || user.id || '') : 'anon') + ':' + Date.now().toString(36) + ':' + Math.random().toString(36).slice(2, 8);
    const catBtn = $('#pet-category-btn');
    const catLabel = $('#pet-category-label');
    const catMenu = $('#pet-category-menu');
    catBtn.addEventListener('click', function (e) {
      e.stopPropagation();
      const open = catMenu.style.display !== 'none';
      catMenu.style.display = open ? 'none' : 'block';
      $('#pet-category-caret').style.transform = open ? '' : 'rotate(180deg)';
    });
    // 点击外部关闭下拉（只注册一次，避免每次打开弹窗都新增监听）
    if (!window.__petCatMenuBound) {
      window.__petCatMenuBound = true;
      document.addEventListener('click', function (e) {
        const picker = $('#pet-category-picker');
        if (picker && !picker.contains(e.target)) {
          const m = $('#pet-category-menu');
          if (m) m.style.display = 'none';
          const caret = $('#pet-category-caret');
          if (caret) caret.style.transform = '';
        }
      });
    }
    $all('.pet-cat-opt').forEach(opt => {
      opt.addEventListener('click', function () {
        submitCategory = this.dataset.cat;
        submitTypeId = this.dataset.typeId || '';
        submitTypeCode = this.dataset.typeCode || '';
        catMenu.style.display = 'none';
        $('#pet-category-caret').style.transform = '';
        if (!submitCategory) {
          catLabel.textContent = '请选择';
          catLabel.style.color = C.muted;
        } else {
          catLabel.textContent = (catEmoji[submitCategory] || '') + ' ' + submitCategory;
          catLabel.style.color = 'inherit';
        }
        renderSubmitFields(submitTypeId, {});
        scheduleDraftSave(); // P1-06：类型选择变化也计入草稿
      });
    });

    // 图片压缩预览
    const imgInput = $('#pet-images');
    const previews = $('#pet-image-previews');
    const imageCount = $('#pet-image-count');
    const uploadedImages = [];
    imgInput.addEventListener('change', async function () {
      const files = Array.from(this.files).slice(0, maxImagesLimit);
      previews.innerHTML = '';
      uploadedImages.length = 0;
      for (const file of files) {
        try {
          const dataUrl = await fileToWebP(file);
          assertImageWithinLimit(dataUrl);
          uploadedImages.push(dataUrl);
          const div = document.createElement('div');
          div.style.cssText = 'width:80px;height:80px;border-radius:8px;overflow:hidden;border:1px solid ' + C.border + ';position:relative';
          div.innerHTML = '<img src="' + dataUrl + '" style="width:100%;height:100%;object-fit:cover">' +
            '<span style="position:absolute;top:2px;right:2px;background:rgba(0,0,0,.6);color:#fff;border-radius:50%;width:18px;height:18px;text-align:center;line-height:18px;font-size:12px;cursor:pointer">✕</span>';
          div.onclick = (e) => {
            if (e.target.tagName === 'SPAN') {
              div.remove();
              const idx = uploadedImages.indexOf(dataUrl);
              if (idx > -1) uploadedImages.splice(idx, 1);
              imageCount.textContent = uploadedImages.length ? '已选 ' + uploadedImages.length + ' 张' : '';
            }
          };
          previews.appendChild(div);
        } catch (e) { showToast(e && e.message ? e.message : '图片压缩失败，请更换图片后重试', true); }
      }
      imageCount.textContent = uploadedImages.length ? '已选 ' + uploadedImages.length + ' 张' : '';
      scheduleDraftSave(); // P1-06：图片张数变化计入草稿
    });

    // 提交
    $('#pet-submit-btn').addEventListener('click', async function () {
      const name = $('#pet-name').value.trim();
      const category = submitCategory;
      const dynamicRoot = $('#pet-dynamic-fields');
      if (dynamicRoot) {
        const invalid = $all('[required]', dynamicRoot).find(el => !el.checkValidity());
        if (invalid) { invalid.reportValidity(); return; }
      }
      const fields = readDynamicFields(dynamicRoot);
      fields.name = name;
      const location = fields.location || '';
      const appearance = fields.appearance || '';
      const personality = fields.personality || '';
      const description = fields.description || '';

      if (!category || !submitTypeId) { showToast('请选择种类', true); return; }
      if (uploadedImages.length < 1) { showToast('请至少上传 1 张照片', true); return; }

      this.disabled = true;
      this.textContent = '⏳ 提交中...';
      const r = await api('/api/submissions', {
        method: 'POST',
        body: { name, category, typeId: submitTypeId, typeCode: submitTypeCode, schemaVersion: contentSchema.schemaVersion || siteConfig.schemaVersion, fields, location, appearance, personality, description, images: uploadedImages, idempotencyKey: submitIdempotencyKey },
      });
      if (r.ok && r.data.success) {
        showToast(r.data.message || '✅ 投稿成功！');
        discardDraft(); // P1-06：提交成功即丢弃草稿，避免再次恢复
        closeSubmitModal();
        petCache.clear();
        loadPets();
      } else {
        this.disabled = false;
        this.textContent = '📤 提交投稿';
        // 幂等命中（重复提交）也视为成功：不提示错误
        if (r.data && r.data.idempotent) {
          showToast(r.data.message || '✅ 该投稿已提交！');
          discardDraft();
          closeSubmitModal();
          petCache.clear();
          loadPets();
        } else {
          showToast(r.data.message || '投稿失败，请重试', true);
        }
      }
    });
  }

  function closeSubmitModal() {
    const m = $('#pet-submit-modal');
    if (m) closePetModal(m);
  }

  /** 投稿模态框内：登录区 / 已登录状态 */
  function updateAuthUI() {
    const area = $('#pet-auth-area');
    if (!area) return;
    const submitBtn = $('#pet-submit-btn');
    if (user) {
      area.innerHTML =
        '<div style="display:flex;align-items:center;gap:8px;padding:10px 12px;background:' + C.soft + ';border:1px solid ' + C.border + ';border-radius:8px;font-size:14px;color:' + C.fg + '">' +
        (user.avatarUrl ? '<img src="' + esc(user.avatarUrl) + '" style="width:24px;height:24px;border-radius:50%" alt="" onerror="this.style.display=\'none\'">' : '') +
        '<span>✅ 将以 <strong>@' + esc(displayName(user)) + '</strong> 身份投稿' + (user.isAdmin ? ' <span style="color:#1d4ed8;font-size:12px">(管理员)</span>' : '') + '</span>' +
        '<button id="pet-logout-btn" style="margin-left:auto;background:none;border:1px solid ' + C.border + ';border-radius:6px;padding:4px 10px;font-size:12px;cursor:pointer;color:' + C.muted + '">退出</button>' +
        '</div>';
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.style.background = C.primary;
        submitBtn.style.cursor = 'pointer';
        submitBtn.textContent = '📤 提交投稿';
      }
    } else {
      area.innerHTML =
        '<div style="padding:14px 16px;background:' + C.soft + ';border-radius:10px;border:1px dashed ' + C.border + ';text-align:center">' +
        '<p style="font-size:14px;font-weight:600;margin:0 0 8px;color:' + C.fg + '">🔑 登录后可投稿</p>' +
        '<div style="display:flex;justify-content:center;gap:10px;flex-wrap:wrap">' +
        authProviders.map(p =>
          '<button id="pet-login-' + p + '" style="display:inline-flex;align-items:center;justify-content:center;gap:8px;padding:9px 20px;background:' + (p === 'gitee' ? '#c71d23' : '#24292f') + ';color:#fff;border:none;border-radius:8px;font-size:14px;cursor:pointer;font-weight:500">' + BRAND_ICONS[p] + '<span>' + (p === 'gitee' ? 'Gitee 登录' : 'GitHub 登录') + '</span></button>'
        ).join('') +
        '</div></div>';
      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.style.background = '#9ca3af';
        submitBtn.style.cursor = 'not-allowed';
        submitBtn.textContent = '🔒 请先登录后再投稿';
      }
    }
    authProviders.forEach(p => {
      const btn = $('#pet-login-' + p);
      if (btn) btn.onclick = () => openOAuth(p);
    });
    const lo = $('#pet-logout-btn'); if (lo) lo.onclick = logout;
  }

  /** 图片 → WebP dataURL（压缩） */
  function assertImageWithinLimit(dataUrl) {
    if (dataUrlByteLength(dataUrl) > maxImageBytesLimit) {
      throw new Error('压缩后的单张图片超过 ' + imageLimitLabel() + '，请更换图片后重试');
    }
  }

  function fileToWebP(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          const MAX_SIDE = 1080;
          let { width, height } = img;
          if (width > MAX_SIDE || height > MAX_SIDE) {
            const ratio = Math.min(MAX_SIDE / width, MAX_SIDE / height);
            width = Math.round(width * ratio);
            height = Math.round(height * ratio);
          }
          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, width, height);
          resolve(canvas.toDataURL('image/webp', 0.82));
        };
        img.onerror = reject;
        img.src = e.target.result;
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  // ================== 我的投稿（页面底部） ==================

  // 状态徽章 / 类型标签 / 类型图标 / 分页数字由 pet-views.js 提供：
  //   views().mineStatusMeta(status)
  //   views().mineTypeLabel(submission)
  //   views().mineTypeIcon(submission)
  //   views().minePaginationNumbersHtml(minePage, mineTotalPages)

  function minePaginationNumbers() { return views().minePaginationNumbersHtml(minePage, mineTotalPages); }

  function mineQueryParams() {
    return new URLSearchParams(petViewModel.buildMineListQuery({
      query: mineQuery, status: mineStatus, category: mineCategory, start: mineDate, end: mineDateEnd,
      sort: mineSort, page: minePage, pageSize: MINE_PAGE_SIZE,
    }));
  }

  function renderMineShell(sec) {
    if (sec.dataset.mineShell === '1') return;
    // 手机端适配：筛选控件占满整行、触控区域更大；搜索框独占一行
    if (!document.getElementById('pet-mine-style')) {
      const st = document.createElement('style');
      st.id = 'pet-mine-style';
      st.textContent = '@media (max-width:640px){' +
        '#pet-mine-filters{display:grid;grid-template-columns:1fr 1fr;gap:8px;align-items:center}' +
        '#pet-mine-filters #pet-mine-search{grid-column:1/-1}' +
        '#pet-mine-filters select,#pet-mine-filters input[type=date]{width:100%;min-width:0}' +
        '}';
      document.head.appendChild(st);
    }
    const categoryOptions = '<option value="">全部类型</option>' + CATEGORIES.map(c => '<option value="' + esc(c.key) + '">' + (catEmoji[c.key] || '🐾') + ' ' + esc(c.key) + '</option>').join('');
    sec.dataset.mineShell = '1';
    sec.innerHTML =
      '<div style="border:1px solid ' + C.border + ';border-radius:14px;padding:16px;margin:24px 0 8px">' +
      '<div style="display:flex;align-items:center;gap:10px;margin-bottom:12px;flex-wrap:wrap">' +
      '<span id="pet-mine-title" style="font-size:17px;font-weight:700;color:' + C.fgDark + '">📋 我的投稿</span>' +
      '<span style="font-size:12px;color:' + C.muted + '">支持关键词、状态、类型、日期筛选；详情按需加载</span>' +
      '<button id="pet-mine-close" style="margin-left:auto;padding:5px 14px;background:' + C.soft + ';border:1px solid ' + C.border + ';border-radius:8px;font-size:13px;cursor:pointer;color:' + C.fg + '">收起 ▲</button>' +
      (siteConfig.allowSubmit && !siteConfig.maintenance
        ? '<button id="pet-mine-submit" style="padding:5px 14px;background:' + C.primary + ';color:#fff;border:none;border-radius:8px;font-size:13px;cursor:pointer;font-weight:600">🆕 投稿</button>'
        : '') +
      '</div>' +
      '<div id="pet-mine-status-counts" style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:10px"></div>' +
      '<div id="pet-mine-filters" style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:12px">' +
      '<input id="pet-mine-search" type="search" enterkeyhint="search" placeholder="🔎 搜索名称、地点、描述或 ID，回车或失焦后生效" aria-label="搜索我的投稿" style="flex:1;min-width:190px;padding:9px 11px;border:1px solid ' + C.border + ';border-radius:8px;background:' + C.inputBg + ';color:inherit;font-size:13px;outline:none">' +
      '<select id="pet-mine-category" style="padding:9px 10px;border:1px solid ' + C.border + ';border-radius:8px;background:' + C.inputBg + ';color:inherit;font-size:13px">' + categoryOptions + '</select>' +
      '<input id="pet-mine-date" type="date" title="按投稿日期范围（开始）筛选" style="padding:8px 9px;border:1px solid ' + C.border + ';border-radius:8px;background:' + C.inputBg + ';color:inherit;font-size:13px">' +
      '<span style="font-size:12px;color:' + C.muted + '">至</span>' +
      '<input id="pet-mine-date-end" type="date" title="按投稿日期范围（结束）筛选" style="padding:8px 9px;border:1px solid ' + C.border + ';border-radius:8px;background:' + C.inputBg + ';color:inherit;font-size:13px">' +
      '<select id="pet-mine-sort" style="padding:9px 10px;border:1px solid ' + C.border + ';border-radius:8px;background:' + C.inputBg + ';color:inherit;font-size:13px"><option value="updated">最近修改</option><option value="latest">最新投稿</option><option value="oldest">最早投稿</option><option value="name">名称</option><option value="status">状态</option></select>' +
      '<button id="pet-mine-reset" title="一键重置所有筛选" style="padding:8px 12px;background:' + C.soft + ';border:1px solid ' + C.border + ';border-radius:8px;color:' + C.fg + ';font-size:13px;cursor:pointer">↺ 重置</button>' +
      '</div>' +
      '<div id="pet-mine-list" aria-live="polite"></div>' +
      '<div id="pet-mine-pager" style="display:flex;align-items:center;justify-content:center;gap:6px;flex-wrap:wrap;margin-top:14px"></div>' +
      '</div>';

    $('#pet-mine-close').onclick = () => { sec.style.display = 'none'; };
    const mineSubmit = $('#pet-mine-submit');
    if (mineSubmit) mineSubmit.onclick = openSubmitModal;

    const search = $('#pet-mine-search');
    // 关键词搜索改为显式触发：Enter 或失焦才请求，避免每次输入都打接口。
    // 失焦时若关键词没有变化则不重复请求（如从搜索框切到其他筛选控件）。
    let lastAppliedQuery = '';
    const applyMineQuery = () => {
      const v = search.value.trim();
      if (v === lastAppliedQuery) return;
      lastAppliedQuery = v;
      mineQuery = v;
      minePage = 1;
      loadMineSubmissions();
    };
    search.onkeydown = e => { if (e.key === 'Enter') { e.preventDefault(); applyMineQuery(); search.blur(); } };
    search.onfocusout = applyMineQuery;
    // 部分移动端浏览器（iOS 等）软键盘「搜索」键触发 search 事件而非 keydown，做兜底
    search.onsearch = applyMineQuery;
    $('#pet-mine-category').onchange = e => { mineCategory = e.target.value; minePage = 1; loadMineSubmissions(); };
    $('#pet-mine-date').onchange = e => { mineDate = e.target.value; minePage = 1; loadMineSubmissions(); };
    $('#pet-mine-date-end').onchange = e => {
      mineDateEnd = e.target.value;
      // 结束日期早于开始日期时自动对齐，避免空结果误导
      if (mineDate && mineDateEnd && mineDateEnd < mineDate) mineDate = mineDateEnd;
      minePage = 1; loadMineSubmissions();
    };
    $('#pet-mine-sort').onchange = e => { mineSort = e.target.value; minePage = 1; loadMineSubmissions(); };
    // P2-13：一键重置所有筛选（含日期范围、排序），恢复到默认列表。
    const mineReset = $('#pet-mine-reset');
    if (mineReset) mineReset.onclick = () => {
      mineQuery = ''; mineStatus = ''; mineCategory = ''; mineDate = ''; mineDateEnd = '';
      mineSort = 'updated'; minePage = 1;
      $('#pet-mine-search').value = '';
      $('#pet-mine-category').value = '';
      $('#pet-mine-date').value = '';
      $('#pet-mine-date-end').value = '';
      $('#pet-mine-sort').value = 'updated';
      loadMineSubmissions();
    };
  }

  async function loadMineTypeOptions() {
    if (mineTypesLoaded) return;
    const select = $('#pet-mine-category');
    if (!select) return;
    const r = await api('/api/content-model/types');
    if (r.ok && r.data && Array.isArray(r.data.types) && r.data.types.length) {
      const types = r.data.types;
      const options = ['<option value="">全部类型</option>'].concat(r.data.types.map(t =>
        '<option value="' + esc(t.id != null ? String(t.id) : (t.code || t.name || '')) + '">' + esc(t.icon || '🐾') + ' ' + esc(t.name || t.code || '未命名类型') + '</option>'
      ));
      select.innerHTML = options.join('');
      // Keep a category/code filter selected after the dynamic options arrive.
      if (mineCategory) {
        const selectedType = types.find(t => String(t.id) === String(mineCategory) || t.code === mineCategory || t.name === mineCategory);
        if (selectedType) mineCategory = String(selectedType.id);
        select.value = mineCategory;
      }
    }
    mineTypesLoaded = true;
  }

  function renderMineRows(items, data) {
    const sec = $('#pet-mine-section');
    const list = $('#pet-mine-list');
    if (!list) return;
    const counts = data.statusCounts || {};
    const allStatusCount = ['pending', 'approved', 'rejected', 'deleted'].reduce((sum, key) => sum + Number(counts[key] || 0), 0) || mineTotal;
    const title = $('#pet-mine-title');
    if (title) title.textContent = '📋 我的投稿（' + mineTotal + '）';
    const countLabels = [
      ['', '全部', allStatusCount],
      ['pending', '待审核', counts.pending || 0],
      ['approved', '已通过', counts.approved || 0],
      ['rejected', '已拒绝', counts.rejected || 0],
      ['deleted', '已删除', counts.deleted || 0],
    ];
    const countBox = $('#pet-mine-status-counts');
    if (countBox) countBox.innerHTML = countLabels.map(c =>
      '<button class="pet-mine-count-btn" data-status="' + c[0] + '" aria-pressed="' + (mineStatus === c[0] ? 'true' : 'false') + '" style="padding:4px 9px;border:1px solid ' + (mineStatus === c[0] ? C.primary : C.border) + ';border-radius:14px;background:' + (mineStatus === c[0] ? C.primary : C.soft) + ';color:' + (mineStatus === c[0] ? '#fff' : C.fg) + ';font-size:12px;cursor:pointer">' + c[1] + ' ' + c[2] + '</button>'
    ).join('');
    $all('.pet-mine-count-btn', sec).forEach(btn => {
      btn.onclick = () => {
        mineStatus = btn.dataset.status;
        minePage = 1;
        loadMineSubmissions();
      };
    });

    if (!items.length) {
      list.innerHTML = '<p style="color:' + C.muted + ';text-align:center;padding:28px 12px">' + (mineQuery || mineStatus || mineCategory || mineDate || mineDateEnd ? '没有符合筛选条件的投稿' : '你还没有投稿过，点击右上角“投稿”开始吧！🐾') + '</p>';
    } else {
      // 行 HTML 由渲染层（pet-views.js）生成
      list.innerHTML = '<div style="display:flex;flex-direction:column;gap:7px">' + items.map(s => views().mineRowHtml(s)).join('') + '</div>';
    }

    const pager = $('#pet-mine-pager');
    if (pager) {
      pager.innerHTML = mineTotalPages > 1
        ? '<button class="pet-mine-page-btn" data-page="' + (minePage - 1) + '" ' + (minePage <= 1 ? 'disabled' : '') + ' style="padding:6px 10px;border:1px solid ' + C.border + ';border-radius:7px;background:' + C.bg + ';color:' + C.fg + ';cursor:pointer">上一页</button>' + minePaginationNumbers() + '<button class="pet-mine-page-btn" data-page="' + (minePage + 1) + '" ' + (minePage >= mineTotalPages ? 'disabled' : '') + ' style="padding:6px 10px;border:1px solid ' + C.border + ';border-radius:7px;background:' + C.bg + ';color:' + C.fg + ';cursor:pointer">下一页</button><span style="font-size:12px;color:' + C.muted + ';margin-left:6px">第 ' + minePage + '/' + mineTotalPages + ' 页</span>'
        : '<span style="font-size:12px;color:' + C.muted + '">共 ' + mineTotal + ' 条</span>';
      $all('.pet-mine-page-btn', pager).forEach(btn => {
        btn.onclick = () => {
          if (btn.disabled) return;
          const p = Number(btn.dataset.page);
          if (p < 1 || p > mineTotalPages || p === minePage) return;
          minePage = p;
          loadMineSubmissions();
        };
      });
    }

    $all('.pet-edit-btn', sec).forEach(btn => { btn.onclick = () => openEditModal(btn.dataset.id); });
    $all('.pet-mine-shortid', sec).forEach(btn => {
      btn.onclick = (e) => {
        e.stopPropagation();
        const fullId = btn.title.replace(/^点击复制投稿 ID：/, '').trim();
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(fullId).then(() => showToast('✅ 已复制投稿 ID：' + fullId)).catch(() => fallbackCopy(fullId, btn));
        } else fallbackCopy(fullId, btn);
      };
    });
    $all('.pet-view-btn', sec).forEach(btn => { btn.onclick = () => openMineDetail(btn.dataset.id); });
    $all('.pet-history-btn', sec).forEach(btn => { btn.onclick = () => openMineHistory(btn.dataset.id); });
    $all('.pet-revisions-btn', sec).forEach(btn => { btn.onclick = () => openMineRevisions(btn.dataset.id); });
    $all('.pet-restore-btn', sec).forEach(btn => {
      btn.onclick = async () => {
        if (siteConfig.maintenance) { showToast('⚠️ 宠物收集录正在维护中，请稍后再试', true); return; }
        if (!confirm('♻️ 撤销删除该投稿吗？将恢复为删除前的状态。')) return;
        const r = await apiSubmissionAction('POST', '/api/my/submissions/' + encodeURIComponent(btn.dataset.id) + '/restore', { rowVersion: Number(btn.dataset.row || 1), _id: btn.dataset.id });
        showToast(r.data.message || (r.ok ? '已撤销删除' : '操作失败'), !r.ok);
        if (r.ok) {
          petCache.clear();
          await loadMineSubmissions();
        }
      };
    });
    $all('.pet-resubmit-btn', sec).forEach(btn => {
      btn.onclick = async () => {
        if (siteConfig.maintenance) { showToast('⚠️ 宠物收集录正在维护中，请稍后再试', true); return; }
        if (!confirm('🔁 确定将该投稿重新提交审核吗？提交后需重新等待审核结果。')) return;
        const r = await apiSubmissionAction('POST', '/api/submissions/' + encodeURIComponent(btn.dataset.id) + '/resubmit', { rowVersion: Number(btn.dataset.row || 1), _id: btn.dataset.id });
        showToast(r.data.message || (r.ok ? '已重新提交' : '操作失败'), !r.ok);
        if (r.ok) {
          petCache.clear();
          await loadMineSubmissions();
        }
      };
    });
    $all('.pet-del-btn', sec).forEach(btn => {
      btn.onclick = async () => {
        if (siteConfig.maintenance) { showToast('⚠️ 宠物收集录正在维护中，删除功能暂时关闭', true); return; }
        if (!siteConfig.allowDelete) { showToast('⚠️ 当前已关闭投稿删除功能，请联系站长', true); return; }
        if (!confirm('⚠️ 确认删除该投稿吗？删除后可在管理后台恢复（软删除）。')) return;
        const r = await apiSubmissionAction('DELETE', '/api/submissions/' + encodeURIComponent(btn.dataset.id), { rowVersion: Number(btn.dataset.row || 1), _id: btn.dataset.id });
        showToast(r.data.message || (r.ok ? '已删除' : '删除失败'), !r.ok);
        if (r.ok) {
          petCache.clear();
          if (minePage > mineTotalPages) minePage = mineTotalPages;
          await loadMineSubmissions();
          loadPets();
        }
      };
    });
  }

  // ================== 我的投稿：纯查看详情（P2-13） ==================
  // 不依赖编辑权限：维护模式 / 关闭编辑 / 已删除状态下也能查看完整内容。

  async function openMineDetail(id) {
    let r = await api('/api/my/submissions/' + encodeURIComponent(id));
    let sub = r.ok && r.data ? (r.data.submission || r.data.item) : null;
    if (!sub) { showToast((r.data && r.data.message) || '未找到投稿', true); return; }

    const modal = $('#pet-detail-modal');
    openPetModal(modal, { label: '投稿详情' });
    // 详情 HTML 由渲染层（pet-views.js）生成
    modal.innerHTML = views().mineDetailHtml(sub);
    $('#pet-detail-close').onclick = () => { closePetModal(modal); };
    modal.onclick = (e) => { if (e.target === modal) closePetModal(modal); };
  }

  // ================== 我的投稿：历史弹窗（P2-13） ==================

  async function openMineHistory(id) {
    let r = await api('/api/my/submissions/' + encodeURIComponent(id) + '/history');
    if (!r.ok) { showToast((r.data && r.data.message) || '加载历史失败', true); return; }
    const history = (r.data && r.data.history) || [];
    const modal = $('#pet-detail-modal');
    openPetModal(modal, { label: '投稿历史' });
    // 历史时间线 HTML 由渲染层（pet-views.js）生成
    modal.innerHTML =
      '<div class="pet-scroll" style="background:' + C.bg + ';border-radius:16px;max-width:520px;width:100%;padding:24px;position:relative;max-height:90vh;overflow-y:auto">' +
      '<button id="pet-detail-close" style="position:absolute;top:12px;right:16px;background:none;border:none;font-size:24px;cursor:pointer;color:' + C.muted + '">✕</button>' +
      '<h2 style="margin:0 0 14px;font-size:19px;color:' + C.fgDark + '">🕘 投稿历史</h2>' +
      views().mineHistoryHtml(history) +
      '</div>';
    $('#pet-detail-close').onclick = () => { closePetModal(modal); };
    modal.onclick = (e) => { if (e.target === modal) closePetModal(modal); };
  }

  // 已公开投稿的候选版本在服务端单独保存。这个视图让投稿人知道哪些
  // 变更仍在审核、哪些被拒绝，而不会把候选内容误当作当前公开内容。

  async function openMineRevisions(id) {
    const r = await api('/api/my/submissions/' + encodeURIComponent(id) + '/revisions');
    if (!r.ok) { showToast((r.data && r.data.message) || '加载修订失败', true); return; }
    const revisions = (r.data && r.data.revisions) || [];
    const modal = $('#pet-detail-modal');
    openPetModal(modal, { label: '公开修订' });
    // 修订卡片 HTML 由渲染层（pet-views.js）生成
    modal.innerHTML =
      '<div class="pet-scroll" style="background:' + C.bg + ';border-radius:16px;max-width:620px;width:100%;padding:24px;position:relative;max-height:90vh;overflow-y:auto">' +
      '<button id="pet-detail-close" style="position:absolute;top:12px;right:16px;background:none;border:none;font-size:24px;cursor:pointer;color:' + C.muted + '">✕</button>' +
      '<h2 style="margin:0 0 5px;font-size:19px;color:' + C.fgDark + '">📝 公开修订</h2>' +
      '<p style="font-size:12px;color:' + C.muted + ';line-height:1.6;margin:0 0 14px">待审核修订不会改变当前公开内容；审核通过后才会替换。</p>' +
      views().mineRevisionsHtml(revisions, id) + '</div>';
    $('#pet-detail-close').onclick = () => { closePetModal(modal); };
    modal.onclick = (e) => { if (e.target === modal) closePetModal(modal); };
    $all('.pet-revision-withdraw', modal).forEach(btn => {
      btn.onclick = async () => {
        if (!confirm('确定撤回这条待审修订吗？')) return;
        const result = await apiSubmissionAction('DELETE', '/api/submissions/' + encodeURIComponent(btn.dataset.submission) + '/revisions/' + encodeURIComponent(btn.dataset.id), {
          rowVersion: Number(btn.dataset.row || 1), _id: btn.dataset.submission,
        });
        showToast(result.data.message || (result.ok ? '已撤回修订' : '撤回失败'), !result.ok);
        if (result.ok) { closePetModal(modal); petCache.clear(); await loadMineSubmissions(); }
      };
    });
  }

  async function loadMineSubmissions() {
    if (!user) return;
    const sec = $('#pet-mine-section');
    if (!sec) return;
    renderMineShell(sec);
    sec.dataset.loaded = '1';
    const requestId = ++mineRequestId;
    const list = $('#pet-mine-list');
    if (list && !list.innerHTML) list.innerHTML = '<p style="color:' + C.muted + ';text-align:center;padding:24px">正在加载投稿…</p>';
    const r = await api('/api/my/submissions?' + mineQueryParams().toString());
    if (requestId !== mineRequestId) return;
    if (!r.ok) { if (list) list.innerHTML = '<p style="color:' + C.danger + ';text-align:center;padding:24px">⚠️ ' + esc(r.data.message || '加载失败') + '</p>'; return; }
    const data = r.data || {};
    const items = Array.isArray(data.items) ? data.items : (Array.isArray(data.submissions) ? data.submissions : []);
    mineTotal = Number.isFinite(Number(data.total)) ? Number(data.total) : items.length;
    mineTotalPages = Math.max(1, Number(data.totalPages) || Math.ceil(mineTotal / MINE_PAGE_SIZE) || 1);
    const responsePage = Math.max(1, Number(data.page) || minePage);
    if (responsePage > mineTotalPages && items.length === 0 && mineTotal > 0) {
      minePage = mineTotalPages;
      return loadMineSubmissions();
    }
    minePage = Math.min(responsePage, mineTotalPages);
    renderMineRows(items, data);
  }

  async function openMineSection() {
    if (!user) { showToast('请先登录', true); openLoginPop(); return; }
    const sec = $('#pet-mine-section');
    if (!sec) return;
    sec.style.display = 'block';
    renderMineShell(sec);
    loadMineTypeOptions();
    await loadMineSubmissions();
    sec.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  // ================== 编辑投稿模态框 ==================

  async function openEditModal(id) {
    if (siteConfig.maintenance) { showToast('⚠️ 宠物收集录正在维护中，编辑功能暂时关闭', true); return; }
    if (!siteConfig.allowEdit) { showToast('⚠️ 当前已关闭投稿编辑功能，请联系站长', true); return; }
    // 详情按 ID 懒加载，避免再次下载整份投稿列表（旧实现最多只取 200 条）。
    let r = await api('/api/my/submissions/' + encodeURIComponent(id));
    let sub = r.ok && r.data ? (r.data.submission || r.data.item) : null;
    // 兼容尚未挂载新路由的旧服务：临时从旧列表中查找，升级后不会走这里。
    if (!sub) {
      r = await api('/api/my/submissions?q=' + encodeURIComponent(id) + '&page=1&pageSize=200');
      sub = r.ok && r.data ? (r.data.submissions || r.data.items || []).find(s => s.id === id) : null;
    }
    if (!sub) { showToast((r.data && r.data.message) || '未找到投稿', true); return; }

    const legacyDefinitions = [
      { key: 'name', label: '名称', dataType: 'text', maxLength: 20, placeholder: '例：小白（也可留空）' },
      { key: 'location', label: '常出没地点', dataType: 'location', maxLength: 100 },
      { key: 'appearance', label: '外貌特征', dataType: 'text', maxLength: 100 },
      { key: 'personality', label: '性格特点', dataType: 'text', maxLength: 100 },
      { key: 'description', label: '描述 / 留言', dataType: 'textarea', maxLength: 500 },
    ];
    const definitions = Array.isArray(sub.fieldDefinitions) && sub.fieldDefinitions.length
      ? sub.fieldDefinitions
      : legacyDefinitions;
    const values = Object.assign({
      name: sub.name || '',
      location: sub.location || '',
      appearance: sub.appearance || '',
      personality: sub.personality || '',
      description: sub.description || '',
    }, sub.dynamicFields && typeof sub.dynamicFields === 'object' ? sub.dynamicFields : {});
    const fieldsHtml = definitions.map(field => views().dynamicFieldHtml(field, values[fieldKey(field)], 'pet-edit-field-')).join('');
    const typeName = sub.type && sub.type.name ? sub.type.name : sub.category;
    const schemaVersion = sub.formSchemaVersionId || sub.schemaVersion;
    const readOnlyCount = definitions.filter(field => field.readOnly || field.archivedNow).length;
    // P1-05：既有图回显（详情接口返回 [{url,key}]；兼容旧 string 数组）
    const editImages = Array.isArray(sub.images) && sub.images.length
      ? sub.images.map(img => typeof img === 'string' ? { url: img, key: '' } : { url: img.url || '', key: img.key || '' })
      : [];

    const modal = $('#pet-edit-modal');
    openPetModal(modal, { label: '编辑投稿' });
    modal.innerHTML =
      '<div class="pet-scroll" style="background:' + C.bg + ';border-radius:16px;max-width:560px;width:100%;padding:24px;position:relative;max-height:90vh;overflow-y:auto">' +
      '<button id="pet-edit-close" style="position:absolute;top:12px;right:16px;background:none;border:none;font-size:24px;cursor:pointer;color:' + C.muted + '">✕</button>' +
      '<h2 style="margin:0 0 4px;font-size:19px;color:' + C.fgDark + '">✏️ 编辑投稿</h2>' +
      '<div style="font-size:13px;color:' + C.muted + ';margin-bottom:8px">' + (sub.name ? esc(sub.name) : '未命名宠物') + ' · ' + esc(typeName || '未分类') + (schemaVersion ? ' · schema v' + esc(schemaVersion) : '') + '</div>' +
      '<div style="font-size:12px;color:' + C.muted + ';margin-bottom:16px">按该投稿保存时的字段版本编辑；保存后“最近更新”排序会置顶。' + (readOnlyCount ? '其中 ' + readOnlyCount + ' 个字段因归档或权限调整为只读。' : '') + '</div>' +
      // P1-05：图片区（删除 ✕ / 排序 ⇅ / 替换重选 / 追加新图）
      '<div style="margin-bottom:16px">' +
        '<label style="display:block;font-size:14px;font-weight:600;margin-bottom:6px;color:' + C.fg + '">照片 <span style="font-weight:400;color:' + C.muted + ';font-size:12px">（1~' + maxImagesLimit + ' 张，单张不超过 ' + imageLimitLabel() + '，点 ✕ 删除，⇅ 调整顺序）</span></label>' +
        '<div id="pet-edit-images" style="display:flex;gap:8px;flex-wrap:wrap"></div>' +
        '<label for="pet-edit-images-input" style="display:inline-flex;align-items:center;gap:6px;padding:9px 16px;background:' + C.soft + ';color:' + C.primary + ';border:2px dashed var(--pet-primary,#93c5fd);border-radius:10px;font-size:13px;font-weight:500;cursor:pointer;margin-top:10px">' +
          '<span style="font-size:16px">📷</span> 添加照片</label>' +
        '<input type="file" id="pet-edit-images-input" accept="image/*" multiple style="display:none">' +
        '<div id="pet-edit-images-hint" style="font-size:12px;color:' + C.muted + ';margin-top:6px"></div>' +
      '</div>' +
      '<div id="pet-edit-dynamic-fields" style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:16px">' +
      (fieldsHtml || '<div style="grid-column:1/-1;color:' + C.muted + ';font-size:13px;padding:8px 0">该历史版本没有可编辑字段</div>') +
      '</div>' +

      '<div style="display:flex;gap:10px">' +
      '<button id="pet-edit-save" style="flex:1;padding:11px 0;background:' + C.primary + ';color:#fff;border:none;border-radius:8px;font-size:15px;font-weight:600;cursor:pointer">保存修改</button>' +
      '<button id="pet-edit-cancel" style="padding:11px 20px;background:' + C.soft + ';border:1px solid ' + C.border + ';border-radius:8px;font-size:14px;cursor:pointer;color:' + C.fg + '">取消</button>' +
      '</div>' +
      '</div>';

    $('#pet-edit-close').onclick = () => { closePetModal(modal); };
    $('#pet-edit-cancel').onclick = () => { closePetModal(modal); };
    modal.onclick = (e) => { if (e.target === modal) closePetModal(modal); };

    // ---- P1-05：编辑图片交互 ----
    const editImagesRoot = $('#pet-edit-images');
    const editImagesHint = $('#pet-edit-images-hint');
    function renderEditImages() {
      editImagesRoot.innerHTML = '';
      editImages.forEach((img, index) => {
        const div = document.createElement('div');
        div.style.cssText = 'width:84px;border-radius:8px;overflow:hidden;border:1px solid ' + C.border + ';position:relative;background:' + C.soft;
        div.innerHTML =
          '<img src="' + esc(img.url || img.dataUrl || '') + '" style="width:100%;height:84px;object-fit:cover;display:block">' +
          '<div style="position:absolute;top:0;left:0;right:0;display:flex;justify-content:space-between;padding:2px">' +
            '<button type="button" data-act="del" title="删除" aria-label="删除图片" style="background:rgba(0,0,0,.62);color:#fff;border:none;border-radius:50%;width:24px;height:24px;text-align:center;line-height:1;font-size:12px;cursor:pointer;padding:0">✕</button>' +
            '<span style="background:rgba(0,0,0,.62);color:#fff;border-radius:8px;padding:1px 2px;font-size:11px;line-height:18px;cursor:pointer">' +
              '<button type="button" data-act="up" title="前移" aria-label="前移图片" style="background:none;border:none;color:#fff;font-size:11px;cursor:pointer;padding:2px;margin-right:2px">▲</button>' +
              '<button type="button" data-act="down" title="后移" aria-label="后移图片" style="background:none;border:none;color:#fff;font-size:11px;cursor:pointer;padding:2px">▼</button>' +
            '</span>' +
          '</div>' +
          (index === 0 ? '<div style="position:absolute;left:4px;bottom:4px;background:var(--pet-primary,#93c5fd);color:#0b1220;border-radius:6px;font-size:10px;padding:1px 5px">封面</div>' : '');
        div.addEventListener('click', (e) => {
          const act = e.target && e.target.dataset && e.target.dataset.act;
          if (act === 'del') {
            editImages.splice(index, 1);
          } else if (act === 'up' && index > 0) {
            const [moved] = editImages.splice(index, 1);
            editImages.splice(index - 1, 0, moved);
          } else if (act === 'down' && index < editImages.length - 1) {
            const [moved] = editImages.splice(index, 1);
            editImages.splice(index + 1, 0, moved);
          } else if (!act) {
            // 点图重选替换
            const picker = document.createElement('input');
            picker.type = 'file';
            picker.accept = 'image/*';
            picker.onchange = async () => {
              const file = picker.files && picker.files[0];
              if (!file) return;
              try {
                const dataUrl = await fileToWebP(file);
                assertImageWithinLimit(dataUrl);
                editImages[index] = { dataUrl };
                renderEditImages();
              } catch (err) { showToast(err && err.message ? err.message : '图片压缩失败，请更换图片后重试', true); }
            };
            picker.click();
          }
          renderEditImages();
        });
        editImagesRoot.appendChild(div);
      });
      editImagesHint.textContent = editImages.length
        ? (editImages.length + ' 张 · 点击图片可替换 · 第一张为封面')
        : '请至少保留 1 张照片';
    }
    renderEditImages();
    const editImagesInput = $('#pet-edit-images-input');
    editImagesInput.addEventListener('change', async function () {
      const files = Array.from(this.files).slice(0, maxImagesLimit - editImages.length);
      for (const file of files) {
        try {
          const dataUrl = await fileToWebP(file);
          assertImageWithinLimit(dataUrl);
          editImages.push({ dataUrl });
        } catch (err) { showToast(err && err.message ? err.message : '图片压缩失败，请更换图片后重试', true); }
      }
      this.value = '';
      renderEditImages();
    });

    $('#pet-edit-save').onclick = async () => {
      const root = $('#pet-edit-dynamic-fields');
      const invalid = root && $all('[required]', root).find(el => !el.checkValidity());
      if (invalid) { invalid.reportValidity(); return; }
      const fields = readDynamicFields(root);
      // P1-05：组装 images —— 既有图传 { url, key }，新增/替换图传 { dataUrl }
      if (!editImages.length) { showToast('请至少保留 1 张照片', true); return; }
      if (editImages.length > maxImagesLimit) { showToast('最多 ' + maxImagesLimit + ' 张照片', true); return; }
      const images = editImages.map(img => img.dataUrl ? { dataUrl: img.dataUrl } : { url: img.url, key: img.key || undefined });
      const saveButton = $('#pet-edit-save');
      saveButton.disabled = true;
      saveButton.textContent = '保存中…';
      const up = await apiSubmissionAction('PUT', '/api/submissions/' + encodeURIComponent(id), {
        fields,
        name: fields.name !== undefined ? fields.name : sub.name,
        location: fields.location !== undefined ? fields.location : sub.location,
        appearance: fields.appearance !== undefined ? fields.appearance : sub.appearance,
        personality: fields.personality !== undefined ? fields.personality : sub.personality,
        description: fields.description !== undefined ? fields.description : sub.description,
        // Keep the published schema/type and optimistic row version when
        // available; old servers simply ignore these extra fields.
        typeId: sub.typeId || (sub.type && sub.type.id) || undefined,
        schemaVersion: sub.formSchemaVersionId || sub.schemaVersion || undefined,
        rowVersion: sub.rowVersion || undefined,
        images,
        _id: id,
      });
      saveButton.disabled = false;
      saveButton.textContent = '保存修改';
      showToast(up.data.message || (up.ok ? '已保存' : '保存失败'), !up.ok);
      if (up.ok) {
        closePetModal(modal);
        petCache.clear();
        openMineSection();
        loadPets();
      }
    };
  }

  // ================== 维护模式横幅 ==================

  function renderMaintenanceBanner() {
    if (document.getElementById('pet-maintenance-banner')) return;
    const banner = document.createElement('div');
    banner.id = 'pet-maintenance-banner';
    banner.style.cssText = 'position:sticky;top:0;z-index:12000;background:#fee2e2;color:#b91c1c;border-bottom:1px solid #fca5a5;padding:10px 16px;text-align:center;font-size:14px;font-weight:600';
    banner.innerHTML = '🔧 宠物收集录正在维护中，投稿 / 编辑 / 删除功能暂时关闭，敬请期待恢复！';
    const nav = document.getElementById('pet-nav');
    if (nav && nav.parentNode) nav.parentNode.insertBefore(banner, nav);
    else document.body.prepend(banner);
  }

  // ================== 初始化 ==================

  // P2-09：OAuth postMessage 监听在宠物页初始化时安装（不等 init() 的多次
  // 异步请求完成后再装，避免快速回调的登录窗口丢消息）。P2-10：经 addPetGlobal
  // 统一登记，导航/多次初始化先移除上一轮再注册，不叠加。
  // 回调页通过同源 /api 提供。origin、窗口引用、消息结构和本次 nonce 都必须匹配。
  function installOAuthListener() {
    addPetGlobal(window, 'message', async function (event) {
      const message = oauthTransaction.consume(event);
      if (!message) return;
      if (message.type === 'auth-success') {
        await restoreSession();
        if (!user) {
          showToast('登录状态未建立，请重新登录', true);
          return;
        }
        showToast('✅ 已以 @' + displayName(user) + ' 身份登录');
        // 登录后公开列表的 liked / likeCount 可能变化：失效图鉴缓存并刷新
        petCache.clear();
        loadPets();
      } else if (message.type === 'auth-error') {
        showToast(message.message || '登录失败', true);
      }
    });
  }

  async function init() {
    // 注入弹窗细滚动条样式（细、圆角、融入卡片，避免系统粗滚动条破坏美观）
    if (!document.getElementById('pet-scroll-style')) {
      const st = document.createElement('style');
      st.id = 'pet-scroll-style';
      st.textContent = '.pet-scroll{scrollbar-width:thin;scrollbar-color:rgba(120,120,120,.35) transparent}' +
        '.pet-scroll::-webkit-scrollbar{width:5px;height:5px}' +
        '.pet-scroll::-webkit-scrollbar-thumb{background:rgba(120,120,120,.3);border-radius:99px}' +
        '.pet-scroll::-webkit-scrollbar-track{background:transparent}';
      document.head.appendChild(st);
    }
    // 先渲染导航；工具栏需等待动态类型配置，避免先画一份硬编码分类。
    renderNav();

    // 获取已配置的登录平台
    const cfg = await api('/api/auth/config');
    if (cfg.ok && Array.isArray(cfg.data.providers) && cfg.data.providers.length) {
      authProviders = cfg.data.providers;
    }

    // 拉取系统配置（功能开关 / 维护模式）——与后台设置实时同步
    const petCfg = await api('/api/pet-config');
    if (petCfg.ok && petCfg.data && petCfg.data.config) {
      siteConfig = Object.assign(siteConfig, petCfg.data.config);
      applyContentSchema(petCfg.data.config, petCfg.data.schema);
    }
    renderToolbar();
    // 维护模式：渲染全站维护横幅
    if (siteConfig.maintenance) renderMaintenanceBanner();

    // 登录状态恢复（成功后重绘导航栏）
    await restoreSession();

    // 灯箱控制（全局绑定一次；P2-10：keydown 走统一登记，导航重跑不叠加）
    const lbEl = $('#pet-lightbox');
    if (lbEl) {
      lbEl.onclick = (e) => { if (e.target === lbEl) closeLightbox(); };
      const c = $('#pet-lightbox-close'); if (c) c.onclick = closeLightbox;
      const pv = $('#pet-lightbox-prev'); if (pv) pv.onclick = (e) => { e.stopPropagation(); lightboxStep(-1); };
      const nx = $('#pet-lightbox-next'); if (nx) nx.onclick = (e) => { e.stopPropagation(); lightboxStep(1); };
      addPetGlobal(document, 'keydown', function (e) {
        if (lbEl.style.display === 'none') return;
        if (e.key === 'Escape') closeLightbox();
        if (e.key === 'ArrowLeft') lightboxStep(-1);
        if (e.key === 'ArrowRight') lightboxStep(1);
      });
    }

    // 加载宠物图鉴
    await loadPets();
  }

  // ================== P2-10 生命周期 ==================
  // Material 即时导航：改用 document$ 订阅（每次导航完成都会触发），替代
  // DOMContentLoaded。脚本只加载一次（即时导航不重跑 extra_javascript），
  // 因此首帧必须无条件订阅；回调内按当前路径分流：
  //   - 宠物页：清理上一轮监听 → 注册弹层/OAuth 监听 → init()
  //   - 其他页：仅清理全局监听，不发起任何 /api 请求
  // 非 Material 环境回退到 DOMContentLoaded。订阅存于 window.__petSub，
  // 避免脚本被重复执行时叠加订阅。
  function bootPets() {
    disposePetGlobals();
    if (!isPetPage()) return; // 非宠物页：零请求、零渲染
    registerPopupClose();
    installOAuthListener();
    init();
  }
  if (typeof document$ !== 'undefined' && document$ && document$.subscribe) {
    if (window.__petSub) { try { window.__petSub.unsubscribe(); } catch (_) { /* ignore */ } }
    window.__petSub = document$.subscribe(bootPets);
  } else if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bootPets);
  } else {
    bootPets();
  }
})();
