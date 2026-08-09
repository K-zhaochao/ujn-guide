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
 * 部署前需修改：
 *   const API_BASE = 'https://pet.matehub.top'; // 后端 API 域名
 */
(function () {
  'use strict';

  // ================== 配置（无任何硬编码密钥） ==================
  const API_BASE = 'http://127.0.0.1:3005'; // ⚠️ 部署时改为 https://pet.matehub.top
  const MAX_IMAGES = 5;
  const TOKEN_KEY = 'pet_jwt';
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
  let mineSort = 'updated';
  let mineRequestId = 0;
  let mineTypesLoaded = false;

  // 站点系统配置（功能开关 / 维护模式），由 /api/pet-config 拉取，与后台设置实时同步
  let siteConfig = { allowSubmit: true, allowEdit: true, allowDelete: true, maintenance: false, schemaVersion: null };
  let contentSchema = { schemaVersion: null, types: [], fields: [], bindings: [], constraints: { maxImages: MAX_IMAGES } };
  let contentSchemaReady = false;

  function applyContentSchema(config, schema) {
    const source = schema && Array.isArray(schema.types) ? schema : (config || {});
    if (!source || !Array.isArray(source.types)) return false;
    contentSchema = {
      schemaVersion: source.schemaVersion || (config && config.schemaVersion) || null,
      types: source.types || [],
      fields: source.fields || [],
      bindings: source.bindings || [],
      constraints: source.constraints || { maxImages: MAX_IMAGES },
    };
    const mapType = type => ({
      id: type.id,
      code: type.code,
      key: type.name,
      emoji: type.icon || '🐾',
      acceptSubmission: type.acceptSubmission !== false,
      metadata: type.metadata && typeof type.metadata === 'object' ? type.metadata : {},
    });
    CATEGORIES = contentSchema.types
      .filter(type => type.visible !== false && !type.archived && !type.archivedAt)
      .sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0))
      .map(mapType);
    SUBMISSION_TYPES = contentSchema.types
      .filter(type => type.acceptSubmission !== false && !type.archived && !type.archivedAt)
      .sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0))
      .map(mapType);
    catEmoji = Object.fromEntries(contentSchema.types.map(type => [type.name, type.icon || '🐾']));
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

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    })[c]);
  }

  function safeHttpUrl(value) {
    const raw = String(value || '').trim();
    if (!raw) return '';
    try {
      const parsed = new URL(raw);
      return parsed.protocol === 'https:' || parsed.protocol === 'http:' ? parsed.href : '';
    } catch (_) {
      return '';
    }
  }

  function typeForPet(p) {
    if (!p) return null;
    const raw = p.type || {};
    return CATEGORIES.find(type =>
      (raw.id != null && String(type.id) === String(raw.id)) ||
      (raw.code && type.code === raw.code) ||
      type.key === (raw.name || p.category)
    ) || null;
  }

  function petEmoji(p) {
    return (p && p.type && p.type.icon) || (typeForPet(p) || {}).emoji || catEmoji[p && p.category] || '🐾';
  }

  function fieldKey(field) { return field && (field.key || field.fieldKey) || ''; }

  function fieldIcon(field) {
    if (field && field.icon) return field.icon;
    return { location: '📍', appearance: '🎨', personality: '💕', description: '📝' }[fieldKey(field)] || '•';
  }

  function fieldDisplayValue(field, value) {
    if (value === undefined || value === null || value === '') return '';
    const options = Array.isArray(field && field.options) ? field.options : [];
    const labels = new Map(options.map(option => [String(option.code || option.optionCode), option.label || option.code || option.optionCode]));
    const mapOption = item => labels.get(String(item)) || String(item);
    if (Array.isArray(value)) return value.map(mapOption).join('、');
    if ((field && field.dataType) === 'boolean' || typeof value === 'boolean') return value ? '是' : '否';
    if ((field && field.dataType) === 'select') return mapOption(value);
    if (typeof value === 'object') return JSON.stringify(value);
    return String(value);
  }

  function legacyPublicDefinitions(p, context) {
    const fields = [
      { key: 'location', label: '常出没地点', dataType: 'location' },
      { key: 'appearance', label: '外貌特征', dataType: 'textarea' },
      { key: 'personality', label: '性格特点', dataType: 'textarea' },
      { key: 'description', label: '补充描述', dataType: 'textarea' },
    ];
    return fields.filter(field =>
      p && Object.prototype.hasOwnProperty.call(p, field.key) && (context !== 'card' || field.key === 'location')
    );
  }

  function publicFieldEntries(p, context) {
    const definitions = Array.isArray(p && p.fieldDefinitions) && p.fieldDefinitions.length
      ? p.fieldDefinitions
      : legacyPublicDefinitions(p, context);
    const values = Object.assign({}, p || {}, p && p.fields && typeof p.fields === 'object' ? p.fields : {});
    return definitions.map(field => ({ field, value: values[fieldKey(field)] }));
  }

  function showToast(msg, isError) {
    let t = document.getElementById('pet-toast');
    if (!t) {
      t = document.createElement('div');
      t.id = 'pet-toast';
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

  function resolveImage(url) {
    if (!url) return '';
    if (/^https?:|^data:/.test(url)) return url;
    return url; // 站内相对路径（历史猫图片）
  }

  /** 展示昵称：nickname 优先，其次平台用户名 */
  function displayName(u) {
    if (!u) return '匿名';
    return (u.nickname || '').trim() || u.username || '匿名';
  }

  // ================== API ==================

  async function api(path, opts) {
    opts = opts || {};
    const headers = { 'Content-Type': 'application/json' };
    const token = localStorage.getItem(TOKEN_KEY);
    if (token) headers['Authorization'] = 'Bearer ' + token;
    try {
      const res = await fetch(API_BASE + path, {
        method: opts.method || 'GET',
        headers,
        body: opts.body ? JSON.stringify(opts.body) : undefined,
      });
      const data = await res.json().catch(() => ({}));
      return { ok: res.ok, status: res.status, data };
    } catch (e) {
      return { ok: false, status: 0, data: { message: '网络错误，请稍后重试' } };
    }
  }

  // ================== 认证 ==================

  function openOAuth(provider) {
    const w = 620, h = 720;
    const left = (screen.width - w) / 2;
    const top = (screen.height - h) / 2;
    window.open(API_BASE + '/api/auth/' + provider + '/login', 'oauth',
      'width=' + w + ',height=' + h + ',left=' + left + ',top=' + top);
  }

  async function restoreSession() {
    if (!localStorage.getItem(TOKEN_KEY)) return;
    const r = await api('/api/auth/me');
    if (r.ok && r.data.success) {
      user = r.data.user;
    } else {
      const msg = (r.data && r.data.message) || '';
      localStorage.removeItem(TOKEN_KEY);
      user = null;
      // 被拉黑时提示用户联系站长（其余情况静默清理过期 token）
      if (r.status === 403 && /拉黑/.test(msg)) {
        showToast('⚠️ ' + msg, true);
      }
    }
    renderNav();
    updateAuthUI();
  }

  function logout() {
    localStorage.removeItem(TOKEN_KEY);
    user = null;
    closePop('pet-login-pop');
    closePop('pet-rename-pop');
    $('#pet-mine-section').style.display = 'none';
    renderNav();
    updateAuthUI();
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
  document.addEventListener('click', function (e) {
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

  // ================== 页面导航栏 ==================

  function renderNav() {
    const nav = $('#pet-nav');
    if (!nav) return;
    // 管理后台按钮（仅管理员可见；点击签发一次性票据跳转，后端 /api/auth/ticket 校验权限）
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
    if (ab) ab.onclick = async () => {
      const r = await api('/api/auth/ticket', { method: 'POST', body: {} });
      if (r.ok && r.data.url) {
        window.open(r.data.url, '_blank');
      } else {
        showToast((r.data && r.data.message) || '无权限进入管理后台', true);
      }
    };
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
      '<input type="text" id="pet-search" placeholder="🔍 搜索宠物名 / 地点..." style="flex:1;min-width:200px;max-width:380px;padding:10px 14px;border:1px solid ' + C.border + ';border-radius:9px;font-size:14px;outline:none;background:' + C.inputBg + ';color:inherit">' +
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

  async function loadPets() {
    const gallery = $('#pet-gallery');
    if (!gallery) return;

    const params = new URLSearchParams();
    if (searchQuery) params.set('q', searchQuery);
    if (currentFilter !== '全部') {
      const selectedType = CATEGORIES.find(c => c.key === currentFilter);
      if (selectedType && selectedType.id != null) params.set('typeId', selectedType.id);
      else params.set('category', currentFilter);
    }
    params.set('sort', sortMode);
    params.set('page', currentPage);
    params.set('pageSize', PAGE_SIZE);
    const cacheKey = params.toString();

    // 命中缓存 → 即时渲染，无需等待网络
    const cached = petCache.get(cacheKey);
    if (cached && Date.now() - cached.t < PET_CACHE_TTL) {
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

    const isEmpty = allPets.length === 0;

    // 按分类分组（保持 CATEGORIES 顺序）
    const groups = {};
    allPets.forEach(p => {
      const typeName = p.type && p.type.name ? p.type.name : p.category;
      (groups[typeName] = groups[typeName] || []).push(p);
    });
    const orderedGroups = CATEGORIES.map(c => [c, groups[c.key]]).filter(([, list]) => list && list.length);
    // Published data can still reference an archived/legacy type.  Never hide
    // it merely because the type is no longer in the current navigation.
    Object.keys(groups).forEach(name => {
      if (!orderedGroups.some(([c]) => c.key === name)) orderedGroups.push([{ key: name, emoji: catEmoji[name] || '🐾' }, groups[name]]);
    });

    const result = isEmpty
      ? '<p style="text-align:center;color:' + C.muted + ';padding:40px">' + (searchQuery ? '未找到相关宠物 🔍' : '暂无宠物，快来投稿第一只吧！🐾') + '</p>'
      : orderedGroups.map(([c, list]) => {
          const groupUrl = safeHttpUrl(c.metadata && (c.metadata.groupUrl || c.metadata.groupLink));
          const groupLink = groupUrl
            ? '<a href="' + esc(groupUrl) + '" target="_blank" rel="noopener noreferrer" style="display:inline-flex;align-items:center;gap:4px;padding:2px 12px;border-radius:20px;background:' + C.primary + ';color:#fff;font-size:12px;font-weight:500;text-decoration:none;vertical-align:middle">💬 加入群聊</a>'
            : '';
          return '<h3 style="margin:18px 0 12px;font-size:17px;color:' + C.fgDark + ';display:flex;align-items:center;gap:8px;flex-wrap:wrap">' +
            esc(c.emoji || catEmoji[c.key] || '') + ' ' + esc(c.key) +
            ' <span style="font-size:13px;color:' + C.muted + ';font-weight:400">' + list.length + ' 只</span>' +
            groupLink +
            '</h3>' +
            '<div class="pet-grid" style="display:grid;grid-template-columns:repeat(4,1fr);gap:14px">' +
            list.map(p => petCard(p)).join('') +
            '</div>';
        }).join('');

    const pager = totalPages > 1
      ? '<div style="display:flex;align-items:center;justify-content:center;gap:6px;margin:26px 0 10px;flex-wrap:wrap">' +
          '<button class="pet-page-btn" data-page="' + (currentPage - 1) + '" ' + (currentPage <= 1 ? 'disabled style="opacity:.4;cursor:not-allowed"' : '') + ' style="padding:7px 14px;border:1px solid ' + C.border + ';border-radius:8px;background:' + C.bg + ';font-size:14px;cursor:pointer;color:' + C.fg + '">‹ 上一页</button>' +
          paginationNumbers() +
          '<button class="pet-page-btn" data-page="' + (currentPage + 1) + '" ' + (currentPage >= totalPages ? 'disabled style="opacity:.4;cursor:not-allowed"' : '') + ' style="padding:7px 14px;border:1px solid ' + C.border + ';border-radius:8px;background:' + C.bg + ';font-size:14px;cursor:pointer;color:' + C.fg + '">下一页 ›</button>' +
          '<span style="font-size:13px;color:' + C.muted + ';margin-left:8px">共 ' + totalCount + ' 只 · 第 ' + currentPage + '/' + totalPages + ' 页</span>' +
        '</div>'
      : '<div style="text-align:center;font-size:13px;color:' + C.muted + ';margin:26px 0 10px">共 ' + totalCount + ' 只宠物</div>';

    gallery.innerHTML = result + pager;

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
    });
  }

  /** 生成页码数字按钮（当前页前后各 2 页 + 首尾） */
  function paginationNumbers() {
    const pages = [];
    const push = p => { if (!pages.includes(p)) pages.push(p); };
    for (let p = 1; p <= totalPages; p++) {
      if (p === 1 || p === totalPages || Math.abs(p - currentPage) <= 2) push(p);
    }
    const html = [];
    for (let i = 0; i < pages.length; i++) {
      const p = pages[i];
      if (i > 0 && p - pages[i - 1] > 1) html.push('<span style="color:' + C.muted + ';padding:0 2px">…</span>');
      html.push(
        '<button class="pet-page-btn" data-page="' + p + '" style="padding:7px 13px;border:1px solid ' + (p === currentPage ? C.primary : C.border) + ';border-radius:8px;background:' + (p === currentPage ? C.primary : C.bg) + ';color:' + (p === currentPage ? '#fff' : C.fg) + ';font-size:14px;cursor:pointer;font-weight:' + (p === currentPage ? '600' : '400') + '">' + p + '</button>'
      );
    }
    return html.join('');
  }

  function debounce(fn, ms) {
    let t;
    return function () { clearTimeout(t); t = setTimeout(() => fn.apply(this, arguments), ms); };
  }

  function petCard(p) {
    const img = p.images && p.images.length ? p.images[0] : '';
    const who = p.contributor ? displayName(p.contributor) : '';
    const summaryFields = publicFieldEntries(p, 'card')
      .filter(entry => fieldKey(entry.field) !== 'name' && fieldDisplayValue(entry.field, entry.value) !== '')
      .map(entry => '<div style="font-size:12px;color:' + C.muted + ';margin-top:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis" title="' + esc((entry.field.label || fieldKey(entry.field)) + '：' + fieldDisplayValue(entry.field, entry.value)) + '">' + esc(fieldIcon(entry.field)) + ' ' + esc(fieldDisplayValue(entry.field, entry.value)) + '</div>')
      .join('');
    const whoLink = p.contributor && p.contributor.profileUrl
      ? '<a href="' + esc(p.contributor.profileUrl) + '" target="_blank" rel="noopener" onclick="event.stopPropagation()" style="color:' + C.muted + ';text-decoration:none;cursor:pointer" title="打开个人主页">@' + esc(who) + '</a>'
      : (who ? '@' + esc(who) : '');
    return '<div class="pet-card" data-id="' + esc(p.id) + '" style="background:' + C.bg + ';border:1px solid ' + C.border + ';border-radius:12px;overflow:hidden;cursor:pointer;transition:transform .15s,box-shadow .15s">' +
      '<div style="width:100%;height:130px;background:' + C.imgBg + ';position:relative">' +
      (img ? '<img src="' + esc(resolveImage(img)) + '" alt="' + esc(p.name) + '" loading="lazy" style="width:100%;height:100%;object-fit:cover" onerror="this.parentNode.innerHTML=\'<div style=\'width:100%;height:100%;display:flex;align-items:center;justify-content:center;font-size:36px\'>' + esc(petEmoji(p)) + '</div>\'">' : '<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;font-size:36px">' + esc(petEmoji(p)) + '</div>') +
      '</div>' +
      '<div style="padding:10px 12px">' +
      '<div style="font-size:15px;font-weight:600;color:' + C.fgDark + '">' + (p.name ? esc(p.name) : '<span style="color:' + C.muted + ';font-weight:500">🐾 未命名宠物</span>') + '</div>' +
      summaryFields +
      '<div style="display:flex;align-items:center;gap:8px;margin-top:6px">' +
      '<span class="pet-card-like" style="display:inline-flex;align-items:center;gap:3px;font-size:12px;color:' + (p.liked ? C.danger : C.muted) + '">' + (p.liked ? '❤️' : '🤍') + ' ' + (p.likeCount || 0) + '</span>' +
      (whoLink ? '<span style="margin-left:auto;font-size:11px;color:' + C.faint + ';white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:90px">📸 ' + whoLink + '</span>' : '') +
      '</div>' +
      '</div></div>';
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
    // likes 排序模式下点赞变化会影响顺序 → 重新拉取列表
    if (sortMode === 'likes') { petCache.clear(); loadPets(); }
    showToast(r.data.message || (liked ? '已点赞' : '已取消点赞'));
  }

  // ================== 详情弹窗 ==================

  async function openDetail(id) {
    const r = await api('/api/pets/' + id);
    if (!r.ok || !r.data.pet) { showToast('加载详情失败', true); return; }
    const p = r.data.pet;
    const modal = $('#pet-detail-modal');
    modal.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;background:' + C.overlay + ';z-index:15000;display:flex;align-items:center;justify-content:center;padding:20px';

    const images = p.images || [];
    const mainImg = images.length ? resolveImage(images[0]) : '';
    let detailIdx = 0; // 当前主图索引（供灯箱使用）
    const displayType = p.type && p.type.name ? p.type.name : p.category;

    const infoRow = (label, emoji, value) =>
      '<div style="display:flex;gap:10px;padding:10px 14px;background:' + C.soft + ';border-radius:10px;align-items:flex-start">' +
        '<span style="font-size:16px;line-height:1.5">' + esc(emoji) + '</span>' +
        '<div style="min-width:0">' +
          '<div style="font-size:12px;color:' + C.muted + ';margin-bottom:2px">' + esc(label) + '</div>' +
          '<div style="font-size:14px;line-height:1.6;color:' + C.fg + ';word-break:break-word">' +
            (value ? esc(value) : '<span style="color:' + C.faint + '">暂未记录</span>') +
          '</div>' +
        '</div>' +
      '</div>';
    const detailFieldsHtml = publicFieldEntries(p, 'detail')
      .filter(entry => fieldKey(entry.field) !== 'name')
      .map(entry => infoRow(entry.field.label || fieldKey(entry.field), fieldIcon(entry.field), fieldDisplayValue(entry.field, entry.value)))
      .join('');

    const contributorHtml = p.contributor
      ? '<div style="display:flex;align-items:center;gap:8px;padding:10px 14px;background:' + C.soft + ';border-radius:10px">' +
          (p.contributor.profileUrl
            ? '<a href="' + esc(p.contributor.profileUrl) + '" target="_blank" rel="noopener" style="display:flex;align-items:center;gap:8px;text-decoration:none;color:inherit" title="打开个人主页">' + contributorInner() + '</a>'
            : contributorInner()) +
        '</div>'
      : '';
    function contributorInner() {
      return (p.contributor.avatarUrl
            ? '<img src="' + esc(p.contributor.avatarUrl) + '" alt="" style="width:26px;height:26px;border-radius:50%;object-fit:cover">'
            : '<span style="width:26px;height:26px;border-radius:50%;background:' + C.avatarBg + ';display:flex;align-items:center;justify-content:center;font-size:13px">🐾</span>') +
          '<div style="font-size:13px;color:' + C.fg + '"><span style="color:' + C.muted + '">投稿人</span> @' + esc(displayName(p.contributor)) + '</div>';
    }

    const timeHtml = '<div style="font-size:12px;color:' + C.faint + ';text-align:center;margin-top:2px">' +
      (p.createdAt ? '投稿于 ' + esc(formatDate(p.createdAt)) : '') +
      (p.updatedAt && p.updatedAt !== p.createdAt ? ' · 更新于 ' + esc(formatDate(p.updatedAt)) : '') +
      '</div>';

    modal.innerHTML =
      '<div class="pet-scroll" style="background:' + C.bg + ';border-radius:16px;max-width:620px;width:100%;max-height:90vh;overflow-y:auto;position:relative">' +

      // 头部：渐变背景 + 名称 + 徽章
      '<div style="padding:26px 24px 20px;background:linear-gradient(135deg,' + C.gradA + ' 0%,' + C.gradB + ' 100%);border-radius:16px 16px 0 0;position:relative">' +
        '<button id="pet-detail-close" style="position:absolute;top:12px;right:16px;background:var(--pet-chip-bg,rgba(255,255,255,.7));border:none;font-size:18px;cursor:pointer;color:' + C.muted + ';width:32px;height:32px;border-radius:50%;z-index:2;line-height:1">✕</button>' +
        '<div style="font-size:44px;line-height:1;margin-bottom:10px">' + esc(petEmoji(p)) + '</div>' +
        '<h2 style="margin:0 0 8px;font-size:24px;color:' + C.fgDark + '">' + (p.name ? esc(p.name) : '<span style="color:' + C.muted + '">未命名宠物</span>') + '</h2>' +
        '<div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center">' +
          '<span style="display:inline-flex;align-items:center;gap:4px;padding:3px 12px;border-radius:20px;background:' + C.primary + ';color:#fff;font-size:12px;font-weight:500">' + esc(petEmoji(p)) + ' ' + esc(displayType || '未分类') + '</span>' +
          '<button id="pet-like-btn" style="display:inline-flex;align-items:center;gap:5px;padding:4px 14px;border-radius:20px;border:1px solid ' + C.border + ';background:' + (p.liked ? C.danger : C.soft) + ';color:' + (p.liked ? '#fff' : C.fg) + ';font-size:12px;font-weight:600;cursor:pointer">' +
            '<span>' + (p.liked ? '❤️' : '🤍') + '</span><span>' + (p.likeCount || 0) + '</span>' +
          '</button>' +
        '</div>' +
      '</div>' +

      // 图片区
      (images.length
        ? '<div style="padding:16px 24px 4px">' +
            (mainImg
              ? '<img id="pet-detail-main" src="' + esc(mainImg) + '" alt="" loading="lazy" style="width:100%;max-height:340px;object-fit:cover;border-radius:12px;cursor:zoom-in">'
              : '') +
            (images.length > 1
              ? '<div class="pet-scroll" style="display:flex;gap:8px;margin-top:10px;overflow-x:auto;padding-bottom:4px">' +
                  images.map((img, i) =>
                    '<img src="' + esc(resolveImage(img)) + '" alt="' + esc(p.name || '') + ' 图' + (i + 1) + '" loading="lazy" data-detail-img="' + i + '" style="width:64px;height:64px;object-fit:cover;border-radius:8px;cursor:pointer;border:2px solid ' + (i === 0 ? C.primary : 'transparent') + ';flex-shrink:0">'
                  ).join('') +
                '</div>'
              : '') +
          '</div>'
        : '') +

      // 信息区
      '<div style="padding:16px 24px 24px;display:flex;flex-direction:column;gap:10px">' +
        detailFieldsHtml +
        contributorHtml +
        timeHtml +
      '</div>' +

      '</div>';

    $('#pet-detail-close').onclick = () => { modal.style.display = 'none'; };
    // 主图点击 → 灯箱全屏查看（不再新开标签页）
    const detailMain = modal.querySelector('#pet-detail-main');
    if (detailMain) detailMain.onclick = () => openLightbox(images.map(resolveImage), detailIdx);
    modal.onclick = (e) => { if (e.target === modal) modal.style.display = 'none'; };
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

  /** ISO 时间 → 本地日期（如 2026-08-07） */
  function formatDate(iso) {
    if (!iso) return '';
    const d = new Date(iso);
    if (isNaN(d.getTime())) return '';
    const pad = n => String(n).padStart(2, '0');
    return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
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

  function schemaFieldsForType(typeId) {
    const type = (contentSchema.types || []).find(t => String(t.id) === String(typeId));
    if (!type) return [];
    const fieldMap = new Map((contentSchema.fields || []).map(field => [String(field.id), field]));
    return (contentSchema.bindings || [])
      .filter(binding => binding.enabled !== false && (String(binding.typeId) === String(type.id) || binding.typeCode === type.code))
      .map(binding => {
        const field = fieldMap.get(String(binding.fieldId)) || (contentSchema.fields || []).find(f => f.key === binding.fieldKey);
        return field ? Object.assign({}, field, { sortOrder: binding.sortOrder == null ? field.sortOrder : binding.sortOrder, required: binding.requiredOverride == null ? !!field.required : !!binding.requiredOverride }) : null;
      })
      .filter(field => field && !field.archived && field.status !== 'archived')
      .sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));
  }

  function dynamicFieldHtml(field, value, idPrefix) {
    const key = field.key || field.fieldKey;
    const id = (idPrefix || 'pet-field-') + key.replace(/[^a-z0-9_-]/gi, '-');
    const readOnly = !!(field.readOnly || field.archivedNow);
    const required = field.required && !readOnly ? ' <span style="color:' + C.danger + '">*</span>' : '';
    const helpParts = [];
    if (field.helpText) helpParts.push(esc(field.helpText));
    if (readOnly) helpParts.push(field.archivedNow ? '该字段已归档，仅保留历史值' : '该字段当前不可编辑');
    const help = helpParts.length ? '<div style="font-size:11px;color:' + (readOnly ? C.danger : C.muted) + ';margin-top:3px">' + helpParts.join(' · ') + '</div>' : '';
    const base = 'width:100%;padding:9px 11px;border:1px solid ' + C.border + ';border-radius:8px;font-size:14px;outline:none;background:' + C.inputBg + ';color:inherit;box-sizing:border-box';
    const attrs = ' id="' + id + '" data-field-key="' + esc(key) + '"' + (field.required && !readOnly ? ' required' : '') + (readOnly ? ' disabled aria-readonly="true"' : '') +
      (field.maxLength != null ? ' maxlength="' + Number(field.maxLength) + '"' : '') +
      (field.minLength != null ? ' minlength="' + Number(field.minLength) + '"' : '');
    let control = '';
    const type = field.dataType || 'text';
    if (type === 'textarea') {
      control = '<textarea' + attrs + ' rows="3" placeholder="' + esc(field.placeholder || '') + '" style="' + base + ';resize:vertical' + (readOnly ? ';opacity:.72' : '') + '">' + esc(value == null ? '' : value) + '</textarea>';
    } else if (type === 'select' || type === 'multiselect') {
      const selected = Array.isArray(value) ? value.map(String) : [String(value == null ? '' : value)];
      const options = (field.options || []).filter(option => option.active !== false || selected.includes(String(option.code || option.optionCode))).map(option => '<option value="' + esc(option.code || option.optionCode) + '"' + (selected.includes(String(option.code || option.optionCode)) ? ' selected' : '') + '>' + esc(option.label) + (option.active === false ? '（已停用）' : '') + '</option>').join('');
      control = '<select' + attrs + (type === 'multiselect' ? ' multiple size="4"' : '') + ' style="' + base + (readOnly ? ';opacity:.72' : '') + '">' + (type === 'select' ? '<option value="">请选择</option>' : '') + options + '</select>';
    } else if (type === 'boolean') {
      control = '<label style="display:flex;align-items:center;gap:8px;padding:9px 11px;border:1px solid ' + C.border + ';border-radius:8px;background:' + C.inputBg + (readOnly ? ';opacity:.72' : '') + '"><input type="checkbox"' + attrs + (value ? ' checked' : '') + '> <span>是</span></label>';
    } else {
      const htmlType = type === 'number' ? 'number' : type === 'date' ? 'date' : type === 'url' ? 'url' : 'text';
      control = '<input type="' + htmlType + '"' + attrs + ' value="' + esc(value == null ? '' : value) + '" placeholder="' + esc(field.placeholder || '') + '"' +
        (field.minValue != null ? ' min="' + Number(field.minValue) + '"' : '') + (field.maxValue != null ? ' max="' + Number(field.maxValue) + '"' : '') + ' style="' + base + (readOnly ? ';opacity:.72' : '') + '">';
    }
    return '<div style="grid-column:' + (type === 'textarea' || type === 'multiselect' ? '1 / -1' : 'auto') + '"><label for="' + id + '" style="display:block;font-size:13px;font-weight:600;color:' + C.muted + ';margin-bottom:4px">' + esc(field.label || key) + required + '</label>' + control + help + '</div>';
  }

  function renderSubmitFields(typeId, values) {
    const root = $('#pet-dynamic-fields');
    if (!root) return;
    const fields = schemaFieldsForType(typeId).filter(field => (field.key || field.fieldKey) !== 'name');
    root.innerHTML = fields.length ? fields.map(field => dynamicFieldHtml(field, values && values[field.key || field.fieldKey])).join('') : '<div style="grid-column:1/-1;color:' + C.muted + ';font-size:13px;padding:8px 0">该类型暂无其他需填写字段</div>';
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
    modal.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;background:' + C.overlay + ';z-index:15000;display:flex;align-items:center;justify-content:center;padding:20px';
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
        '<label style="display:block;font-size:14px;font-weight:600;margin-bottom:6px;color:' + C.fg + '">照片 <span style="color:' + C.danger + '">*</span> <span style="font-weight:400;color:' + C.muted + ';font-size:12px">（1~' + MAX_IMAGES + ' 张，自动压缩）</span></label>' +
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

    $('#pet-submit-close').onclick = closeSubmitModal;
    modal.onclick = (e) => { if (e.target === modal) closeSubmitModal(); };

    updateAuthUI();

    // 自定义分类下拉（替代原生 select）
    let submitCategory = '';
    let submitTypeId = '';
    let submitTypeCode = '';
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
      });
    });

    // 图片压缩预览
    const imgInput = $('#pet-images');
    const previews = $('#pet-image-previews');
    const imageCount = $('#pet-image-count');
    const uploadedImages = [];
    imgInput.addEventListener('change', async function () {
      const files = Array.from(this.files).slice(0, MAX_IMAGES);
      previews.innerHTML = '';
      uploadedImages.length = 0;
      for (const file of files) {
        try {
          const dataUrl = await fileToWebP(file);
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
        } catch (e) { console.warn('Image conversion failed:', e); }
      }
      imageCount.textContent = uploadedImages.length ? '已选 ' + uploadedImages.length + ' 张' : '';
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
        body: { name, category, typeId: submitTypeId, typeCode: submitTypeCode, schemaVersion: contentSchema.schemaVersion || siteConfig.schemaVersion, fields, location, appearance, personality, description, images: uploadedImages },
      });
      if (r.ok && r.data.success) {
        showToast(r.data.message || '✅ 投稿成功！');
        closeSubmitModal();
        petCache.clear();
        loadPets();
      } else {
        this.disabled = false;
        this.textContent = '📤 提交投稿';
        showToast(r.data.message || '投稿失败，请重试', true);
      }
    });
  }

  function closeSubmitModal() {
    const m = $('#pet-submit-modal');
    if (m) m.style.display = 'none';
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

  function mineStatusMeta(status) {
    if (status === 'approved') return { label: '✅ 已通过', color: C.success, bg: C.success + '22' };
    if (status === 'rejected') return { label: '❌ 已拒绝', color: C.danger, bg: C.dangerBg };
    if (status === 'deleted') return { label: '🗑️ 已删除', color: C.muted, bg: C.soft };
    return { label: '⏳ 待审核', color: '#92400e', bg: 'var(--pet-success,#fef3c7)33' };
  }

  function mineTypeLabel(submission) {
    if (submission && submission.type && typeof submission.type === 'object') {
      return submission.type.name || submission.type.code || submission.category || '未分类';
    }
    return (submission && (submission.category || submission.type)) || '未分类';
  }

  function mineTypeIcon(submission) {
    if (submission && submission.type && typeof submission.type === 'object' && submission.type.icon) return submission.type.icon;
    return catEmoji[submission && submission.category] || '🐾';
  }

  function minePaginationNumbers() {
    const pages = [];
    const push = p => { if (p >= 1 && p <= mineTotalPages && !pages.includes(p)) pages.push(p); };
    push(1); push(mineTotalPages);
    for (let p = minePage - 2; p <= minePage + 2; p++) push(p);
    pages.sort((a, b) => a - b);
    const html = [];
    pages.forEach((p, i) => {
      if (i && p - pages[i - 1] > 1) html.push('<span style="color:' + C.muted + '">…</span>');
      html.push('<button class="pet-mine-page-btn" data-page="' + p + '" style="min-width:32px;padding:6px 9px;border:1px solid ' + (p === minePage ? C.primary : C.border) + ';border-radius:7px;background:' + (p === minePage ? C.primary : C.bg) + ';color:' + (p === minePage ? '#fff' : C.fg) + ';cursor:pointer">' + p + '</button>');
    });
    return html.join('');
  }

  function mineQueryParams() {
    const params = new URLSearchParams();
    if (mineQuery) params.set('q', mineQuery);
    if (mineStatus) params.set('status', mineStatus);
    if (mineCategory) {
      if (/^\d+$/.test(String(mineCategory))) params.set('typeId', mineCategory);
      else {
        params.set('category', mineCategory);
        // `type` is the forward-compatible alias used during migration.
        params.set('type', mineCategory);
      }
    }
    if (mineDate) params.set('date', mineDate);
    params.set('sort', mineSort);
    params.set('page', String(minePage));
    params.set('pageSize', String(MINE_PAGE_SIZE));
    // Soft-deleted records remain visible in the personal history; actions are
    // disabled for them, while the admin recycle bin can still restore them.
    params.set('includeDeleted', '1');
    return params;
  }

  function renderMineShell(sec) {
    if (sec.dataset.mineShell === '1') return;
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
      '<div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:12px">' +
      '<input id="pet-mine-search" type="search" placeholder="🔎 搜索名称、地点、描述或 ID" style="flex:1;min-width:190px;padding:9px 11px;border:1px solid ' + C.border + ';border-radius:8px;background:' + C.inputBg + ';color:inherit;font-size:13px;outline:none">' +
      '<select id="pet-mine-status" style="padding:9px 10px;border:1px solid ' + C.border + ';border-radius:8px;background:' + C.inputBg + ';color:inherit;font-size:13px"><option value="">全部状态</option><option value="pending">待审核</option><option value="approved">已通过</option><option value="rejected">已拒绝</option><option value="deleted">已删除</option></select>' +
      '<select id="pet-mine-category" style="padding:9px 10px;border:1px solid ' + C.border + ';border-radius:8px;background:' + C.inputBg + ';color:inherit;font-size:13px">' + categoryOptions + '</select>' +
      '<input id="pet-mine-date" type="date" title="按投稿日期筛选" style="padding:8px 9px;border:1px solid ' + C.border + ';border-radius:8px;background:' + C.inputBg + ';color:inherit;font-size:13px">' +
      '<select id="pet-mine-sort" style="padding:9px 10px;border:1px solid ' + C.border + ';border-radius:8px;background:' + C.inputBg + ';color:inherit;font-size:13px"><option value="updated">最近修改</option><option value="latest">最新投稿</option><option value="oldest">最早投稿</option><option value="name">名称</option><option value="status">状态</option></select>' +
      '</div>' +
      '<div id="pet-mine-list" aria-live="polite"></div>' +
      '<div id="pet-mine-pager" style="display:flex;align-items:center;justify-content:center;gap:6px;flex-wrap:wrap;margin-top:14px"></div>' +
      '</div>';

    $('#pet-mine-close').onclick = () => { sec.style.display = 'none'; };
    const mineSubmit = $('#pet-mine-submit');
    if (mineSubmit) mineSubmit.onclick = openSubmitModal;

    const search = $('#pet-mine-search');
    const triggerSearch = debounce(function () {
      mineQuery = this.value.trim();
      minePage = 1;
      loadMineSubmissions();
    }, 300);
    search.oninput = triggerSearch;
    search.onkeydown = e => { if (e.key === 'Enter') { mineQuery = search.value.trim(); minePage = 1; loadMineSubmissions(); } };
    $('#pet-mine-status').onchange = e => { mineStatus = e.target.value; minePage = 1; loadMineSubmissions(); };
    $('#pet-mine-category').onchange = e => { mineCategory = e.target.value; minePage = 1; loadMineSubmissions(); };
    $('#pet-mine-date').onchange = e => { mineDate = e.target.value; minePage = 1; loadMineSubmissions(); };
    $('#pet-mine-sort').onchange = e => { mineSort = e.target.value; minePage = 1; loadMineSubmissions(); };
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
      '<button class="pet-mine-count-btn" data-status="' + c[0] + '" style="padding:4px 9px;border:1px solid ' + (mineStatus === c[0] ? C.primary : C.border) + ';border-radius:14px;background:' + (mineStatus === c[0] ? C.primary : C.soft) + ';color:' + (mineStatus === c[0] ? '#fff' : C.fg) + ';font-size:12px;cursor:pointer">' + c[1] + ' ' + c[2] + '</button>'
    ).join('');
    $all('.pet-mine-count-btn', sec).forEach(btn => {
      btn.onclick = () => {
        mineStatus = btn.dataset.status;
        minePage = 1;
        const select = $('#pet-mine-status');
        if (select) select.value = mineStatus;
        loadMineSubmissions();
      };
    });

    if (!items.length) {
      list.innerHTML = '<p style="color:' + C.muted + ';text-align:center;padding:28px 12px">' + (mineQuery || mineStatus || mineCategory || mineDate ? '没有符合筛选条件的投稿' : '你还没有投稿过，点击右上角“投稿”开始吧！🐾') + '</p>';
    } else {
      list.innerHTML = '<div style="display:flex;flex-direction:column;gap:7px">' + items.map(s => {
        const meta = mineStatusMeta(s.status);
        const thumb = s.thumbnail || (s.images && s.images[0]) || '';
        const disabled = s.status === 'deleted';
        return '<div class="pet-mine-row" data-id="' + esc(s.id) + '" style="display:flex;align-items:center;gap:10px;padding:9px 10px;border:1px solid ' + C.border + ';border-radius:10px;background:' + C.soft + ';min-width:0;flex-wrap:wrap">' +
          (thumb ? '<img src="' + esc(resolveImage(thumb)) + '" alt="" loading="lazy" style="width:46px;height:46px;border-radius:8px;object-fit:cover;flex:none">' : '<span style="width:46px;height:46px;border-radius:8px;background:' + C.imgBg + ';display:flex;align-items:center;justify-content:center;font-size:20px;flex:none">' + esc(mineTypeIcon(s)) + '</span>') +
          '<div style="min-width:0;flex:1"><div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap"><strong style="font-size:14px;color:' + C.fgDark + ';white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:260px">' + (s.name ? esc(s.name) : '<span style="color:' + C.muted + '">🐾 未命名宠物</span>') + '</strong><span style="font-size:11px;padding:2px 7px;border-radius:10px;background:' + meta.bg + ';color:' + meta.color + '">' + meta.label + '</span></div><div style="font-size:12px;color:' + C.muted + ';margin-top:3px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">' + esc(mineTypeLabel(s)) + ' · 投稿 ' + esc(formatDate(s.createdAt)) + (s.updatedAt && s.updatedAt !== s.createdAt ? ' · 更新 ' + esc(formatDate(s.updatedAt)) : '') + '</div>' + (s.status === 'rejected' && s.rejectReason ? '<div style="font-size:12px;color:' + C.danger + ';margin-top:3px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">🚫 ' + esc(s.rejectReason) + '</div>' : '') + '</div>' +
          '<div style="display:flex;gap:5px;flex:none;margin-left:auto">' +
          (!disabled && siteConfig.allowEdit && !siteConfig.maintenance ? '<button class="pet-edit-btn" data-id="' + esc(s.id) + '" style="padding:6px 9px;background:' + C.primary + ';color:#fff;border:none;border-radius:7px;font-size:12px;cursor:pointer">✏️ 编辑</button>' : '') +
          (!disabled && siteConfig.allowDelete && !siteConfig.maintenance ? '<button class="pet-del-btn" data-id="' + esc(s.id) + '" style="padding:6px 9px;background:' + C.dangerBg + ';color:' + C.danger + ';border:1px solid ' + C.dangerBg + ';border-radius:7px;font-size:12px;cursor:pointer">🗑️ 删除</button>' : '') +
          (disabled ? '<span style="font-size:11px;color:' + C.muted + ';padding:6px 2px">可联系站长恢复</span>' : '') +
          '</div></div>';
      }).join('') + '</div>';
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
    $all('.pet-del-btn', sec).forEach(btn => {
      btn.onclick = async () => {
        if (siteConfig.maintenance) { showToast('⚠️ 宠物收集录正在维护中，删除功能暂时关闭', true); return; }
        if (!siteConfig.allowDelete) { showToast('⚠️ 当前已关闭投稿删除功能，请联系站长', true); return; }
        if (!confirm('⚠️ 确认删除该投稿吗？删除后可在管理后台恢复（软删除）。')) return;
        const r = await api('/api/submissions/' + encodeURIComponent(btn.dataset.id), { method: 'DELETE' });
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
    const fieldsHtml = definitions.map(field => dynamicFieldHtml(field, values[fieldKey(field)], 'pet-edit-field-')).join('');
    const typeName = sub.type && sub.type.name ? sub.type.name : sub.category;
    const schemaVersion = sub.formSchemaVersionId || sub.schemaVersion;
    const readOnlyCount = definitions.filter(field => field.readOnly || field.archivedNow).length;

    const modal = $('#pet-edit-modal');
    modal.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;background:' + C.overlay + ';z-index:15000;display:flex;align-items:center;justify-content:center;padding:20px';
    modal.innerHTML =
      '<div class="pet-scroll" style="background:' + C.bg + ';border-radius:16px;max-width:560px;width:100%;padding:24px;position:relative;max-height:90vh;overflow-y:auto">' +
      '<button id="pet-edit-close" style="position:absolute;top:12px;right:16px;background:none;border:none;font-size:24px;cursor:pointer;color:' + C.muted + '">✕</button>' +
      '<h2 style="margin:0 0 4px;font-size:19px;color:' + C.fgDark + '">✏️ 编辑投稿</h2>' +
      '<div style="font-size:13px;color:' + C.muted + ';margin-bottom:8px">' + (sub.name ? esc(sub.name) : '未命名宠物') + ' · ' + esc(typeName || '未分类') + (schemaVersion ? ' · schema v' + esc(schemaVersion) : '') + '</div>' +
      '<div style="font-size:12px;color:' + C.muted + ';margin-bottom:16px">按该投稿保存时的字段版本编辑；保存后“最近更新”排序会置顶。' + (readOnlyCount ? '其中 ' + readOnlyCount + ' 个字段因归档或权限调整为只读。' : '') + '</div>' +
      '<div id="pet-edit-dynamic-fields" style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:16px">' +
      (fieldsHtml || '<div style="grid-column:1/-1;color:' + C.muted + ';font-size:13px;padding:8px 0">该历史版本没有可编辑字段</div>') +
      '</div>' +

      '<div style="display:flex;gap:10px">' +
      '<button id="pet-edit-save" style="flex:1;padding:11px 0;background:' + C.primary + ';color:#fff;border:none;border-radius:8px;font-size:15px;font-weight:600;cursor:pointer">保存修改</button>' +
      '<button id="pet-edit-cancel" style="padding:11px 20px;background:' + C.soft + ';border:1px solid ' + C.border + ';border-radius:8px;font-size:14px;cursor:pointer;color:' + C.fg + '">取消</button>' +
      '</div>' +
      '</div>';

    $('#pet-edit-close').onclick = () => { modal.style.display = 'none'; };
    $('#pet-edit-cancel').onclick = () => { modal.style.display = 'none'; };
    modal.onclick = (e) => { if (e.target === modal) modal.style.display = 'none'; };

    $('#pet-edit-save').onclick = async () => {
      const root = $('#pet-edit-dynamic-fields');
      const invalid = root && $all('[required]', root).find(el => !el.checkValidity());
      if (invalid) { invalid.reportValidity(); return; }
      const fields = readDynamicFields(root);
      const saveButton = $('#pet-edit-save');
      saveButton.disabled = true;
      saveButton.textContent = '保存中…';
      const up = await api('/api/submissions/' + encodeURIComponent(id), {
        method: 'PUT',
        body: {
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
        },
      });
      saveButton.disabled = false;
      saveButton.textContent = '保存修改';
      showToast(up.data.message || (up.ok ? '已保存' : '保存失败'), !up.ok);
      if (up.ok) {
        modal.style.display = 'none';
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

    // postMessage 监听（OAuth 回调）— 只接受本站同源回调窗口消息，拒绝跨站伪造
    window.addEventListener('message', function (event) {
      if (event.origin !== window.location.origin) return;
      const data = event.data;
      if (!data || typeof data !== 'object') return;
      if (data.type === 'auth-success') {
        localStorage.setItem(TOKEN_KEY, data.token);
        user = data.user;
        renderNav();
        updateAuthUI();
        showToast('✅ 已以 @' + displayName(user) + ' 身份登录');
      } else if (data.type === 'auth-error') {
        showToast(data.message || '登录失败', true);
      }
    });

    // 灯箱控制（全局绑定一次）
    const lbEl = $('#pet-lightbox');
    if (lbEl) {
      lbEl.onclick = (e) => { if (e.target === lbEl) closeLightbox(); };
      const c = $('#pet-lightbox-close'); if (c) c.onclick = closeLightbox;
      const pv = $('#pet-lightbox-prev'); if (pv) pv.onclick = (e) => { e.stopPropagation(); lightboxStep(-1); };
      const nx = $('#pet-lightbox-next'); if (nx) nx.onclick = (e) => { e.stopPropagation(); lightboxStep(1); };
      document.addEventListener('keydown', function (e) {
        if (lbEl.style.display === 'none') return;
        if (e.key === 'Escape') closeLightbox();
        if (e.key === 'ArrowLeft') lightboxStep(-1);
        if (e.key === 'ArrowRight') lightboxStep(1);
      });
    }

    // 加载宠物图鉴
    await loadPets();
  }

  // 页面就绪后初始化
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
