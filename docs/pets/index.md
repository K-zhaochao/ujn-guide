---
tags:
  - 宠物收集录
hide:
  - navigation
  - toc
---

# 🐾 宠物收集录

<!-- 页面专属导航栏：登录 / 投稿 / 我的投稿 / 我的收藏 / 改名（由 pets.js 渲染） -->
<div id="pet-nav"></div>

<!-- 登录小卡片（点击导航栏登录按钮弹出，GitHub / Gitee） -->
<div id="pet-login-pop" style="display:none"></div>

<!-- 改名小卡片 -->
<div id="pet-rename-pop" style="display:none"></div>

<!-- 导航栏互动通知面板 -->
<div id="pet-notification-pop" style="display:none"></div>

<style>
  /* ===== 宠物页 CSS 变量：自动适配 Material 浅色 / 深色（slate）主题 ===== */
  :root {
    --pet-img-bg: #f3f4f6;              /* 卡片图片占位底 */
    --pet-soft: rgba(0, 0, 0, .04);     /* 信息行浅底 */
    --pet-muted: #9ca3af;               /* 次要文字 */
    --pet-faint: #b0b4bb;               /* 更淡文字 */
    --pet-border: #e5e7eb;              /* 边框 / 分隔线 */
    --pet-primary: #3b82f6;             /* 主色 */
    --pet-grad-a: #fdf2f8;              /* 详情头部渐变起 */
    --pet-grad-b: #fff7ed;              /* 详情头部渐变止 */
    --pet-overlay: rgba(0, 0, 0, .55);  /* 弹窗遮罩 */
    --pet-chip-bg: #fff;                /* 徽章底 */
    --pet-avatar-bg: #e5e7eb;           /* 头像占位底 */
    --pet-danger: #ef4444;
    --pet-danger-bg: #fee2e2;
    --pet-success: #22c55e;
    --pet-input-bg: #fff;
  }
  [data-md-color-scheme="slate"] {
    --pet-img-bg: #2b3038;
    --pet-soft: rgba(255, 255, 255, .06);
    --pet-muted: #8b93a1;
    --pet-faint: #6b7280;
    --pet-border: #3a4150;
    --pet-primary: #60a5fa;
    --pet-grad-a: #2a2433;
    --pet-grad-b: #2b2a22;
    --pet-overlay: rgba(0, 0, 0, .72);
    --pet-chip-bg: #2b3038;
    --pet-avatar-bg: #3a4150;
    --pet-danger: #f87171;
    --pet-danger-bg: rgba(239, 68, 68, .18);
    --pet-success: #4ade80;
    --pet-input-bg: #1f242d;
  }

  /* 宠物卡片网格：桌面 4 列 → 中屏 3 列 → 窄屏 2 列 → 手机 1 列 */
  .pet-grid { grid-template-columns: repeat(4, 1fr) !important; }
  @media (max-width: 1100px) { .pet-grid { grid-template-columns: repeat(3, 1fr) !important; } }
  @media (max-width: 760px)  { .pet-grid { grid-template-columns: repeat(2, 1fr) !important; } }
  @media (max-width: 480px)  { .pet-grid { grid-template-columns: 1fr !important; } }

  /* P2-14 无障碍：键盘焦点可见 */
  .pet-card:focus-visible,
  .pet-mine-row:focus-visible,
  button:focus-visible,
  input:focus-visible,
  select:focus-visible,
  textarea:focus-visible,
  a:focus-visible {
    outline: 2px solid var(--pet-primary, #3b82f6);
    outline-offset: 2px;
  }

  /* P2-14 移动端：动态表单单列、触控目标 ≥ 44px、弹窗适配软键盘 */
  @media (max-width: 640px) {
    #pet-dynamic-fields,
    #pet-edit-dynamic-fields { grid-template-columns: 1fr !important; }
    #pet-submit-modal .pet-scroll,
    #pet-edit-modal .pet-scroll,
    #pet-detail-modal .pet-scroll { max-height: 78vh !important; padding-bottom: max(20px, env(safe-area-inset-bottom)) !important; }
    .pet-mine-row button,
    #pet-mine-status-counts button,
    #pet-mine-filters button,
    #pet-mine-pager button { min-height: 44px; }
    #pet-liked-list button { min-height: 44px; }
    #pet-mine-filters input[type=date] { min-height: 44px; }
  }

  /* 登录后的个人导航：桌面端按账户、主操作、辅助操作分组，窄屏改为等宽操作区。 */
  #pet-nav .pet-nav-shell {
    justify-content: flex-start !important;
    padding: 10px 0 14px !important;
  }
  #pet-nav .pet-nav-actions {
    display: flex;
    align-items: center;
    gap: 8px;
    width: 100%;
  }
  #pet-nav .pet-nav-account { margin-right: auto; max-width: min(42%, 260px); }
  #pet-nav .pet-nav-primary-action,
  #pet-nav .pet-nav-secondary-action,
  #pet-nav .pet-nav-login {
    min-height: 38px;
    border-radius: 8px !important;
  }
  #pet-nav .pet-nav-primary-action { white-space: nowrap; }
  #pet-nav .pet-nav-login { margin-left: auto; }
  #pet-nav .pet-nav-logout {
    width: 38px;
    height: 38px;
    padding: 0 !important;
    justify-content: center;
  }
  #pet-nav #pet-notifications-nav { flex: 0 0 38px; }

  /* 我的投稿的筛选控件在桌面端紧凑同行，在日期范围内保持明确的起止关系。 */
  #pet-mine-section > div {
    margin: 22px 0 8px !important;
    border-radius: 8px !important;
  }
  #pet-liked-section > div { margin: 24px 0 8px !important; }
  #pet-mine-filters {
    align-items: end !important;
    gap: 9px !important;
  }
  #pet-mine-filters select,
  #pet-mine-filters input,
  #pet-mine-filters button {
    min-height: 38px;
    border-radius: 8px !important;
    box-sizing: border-box;
  }
  #pet-mine-filters select,
  #pet-mine-filters input[type="search"],
  #pet-mine-filters input[type="date"] {
    border-color: var(--pet-border) !important;
    background-color: var(--pet-input-bg) !important;
  }
  #pet-mine-filters select:hover,
  #pet-mine-filters input:hover { border-color: var(--pet-primary) !important; }
  #pet-mine-filters select:focus,
  #pet-mine-filters input:focus {
    border-color: var(--pet-primary) !important;
    box-shadow: 0 0 0 3px color-mix(in srgb, var(--pet-primary) 20%, transparent);
  }
  #pet-mine-filters input[type="date"] {
    color-scheme: light dark;
    cursor: pointer;
    font-variant-numeric: tabular-nums;
  }
  #pet-mine-filters input[type="date"]::-webkit-calendar-picker-indicator {
    cursor: pointer;
    opacity: .72;
  }
  #pet-mine-filters .pet-mine-date-range {
    display: grid;
    grid-template-columns: repeat(2, minmax(132px, 1fr));
    gap: 8px;
  }
  #pet-mine-filters .pet-mine-date-range label {
    display: grid;
    gap: 3px;
    color: var(--pet-muted);
    font-size: 11px;
    font-weight: 600;
  }
  #pet-mine-filters .pet-mine-date-range input { width: 100%; }

  @media (max-width: 640px) {
    #pet-nav .pet-nav-shell { align-items: stretch !important; }
    #pet-nav .pet-nav-actions {
      display: grid !important;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 7px;
    }
    #pet-nav .pet-nav-account {
      grid-column: 1 / -1;
      max-width: none;
      margin: 0;
      min-height: 40px;
      justify-content: flex-start;
    }
    #pet-nav .pet-nav-primary-action {
      width: 100%;
      min-width: 0;
      min-height: 40px;
      justify-content: center;
      padding: 7px 5px !important;
      font-size: 12px !important;
    }
    #pet-nav .pet-nav-secondary-action { min-height: 36px; font-size: 12px !important; }
    #pet-nav #pet-admin-nav { grid-column: 1 / span 2; justify-content: center; }
    #pet-nav #pet-notifications-nav { width:100%; height:36px; }
    #pet-nav #pet-logout-nav { grid-column: 3; width: 100%; height: 36px; }
    #pet-nav .pet-nav-login { width: 100%; margin-left: 0; justify-content: center; }

    #pet-mine-section > div { padding: 13px 12px !important; margin-top: 18px !important; }
    #pet-liked-section > div { padding-top: 14px !important; margin-top: 20px !important; }
    #pet-mine-section > div > div:first-child,
    #pet-liked-section > div > div:first-child { gap: 8px !important; margin-bottom: 10px !important; }
    #pet-mine-title { font-size: 16px !important; }
    #pet-mine-close,
    #pet-liked-close { width: 36px !important; height: 36px !important; min-height: 36px !important; padding: 0 !important; }
    #pet-mine-status-counts {
      flex-wrap: nowrap !important;
      overflow-x: auto;
      padding-bottom: 2px;
      scrollbar-width: thin;
    }
    #pet-mine-status-counts button { flex: 0 0 auto; min-height: 36px !important; }
    #pet-mine-filters {
      display: grid !important;
      grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
      gap: 8px !important;
    }
    #pet-mine-filters #pet-mine-search,
    #pet-mine-filters .pet-mine-date-range,
    #pet-mine-filters #pet-mine-reset { grid-column: 1 / -1; }
    #pet-mine-filters select,
    #pet-mine-filters input,
    #pet-mine-filters button { width: 100%; min-height: 40px !important; }
    #pet-mine-filters .pet-mine-date-range { grid-template-columns: repeat(2, minmax(0, 1fr)); }
    #pet-mine-filters #pet-mine-reset { justify-content: center; }
    #pet-mine-list .pet-mine-row { align-items: flex-start !important; }
    #pet-mine-list .pet-mine-row-actions {
      display: grid !important;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 6px !important;
      flex: 0 0 100% !important;
      width: 100%;
      margin-left: 0 !important;
    }
    #pet-mine-list .pet-mine-row-actions button { width: 100%; min-height: 36px !important; }
    #pet-liked-list .pet-grid { gap: 10px !important; }
  }

  @media (max-width: 380px) {
    #pet-nav .pet-nav-primary-action { font-size: 11px !important; }
    #pet-mine-filters .pet-mine-date-range { grid-template-columns: 1fr; }
  }
</style>

!!! tip "📸 关于本栏目"
    本栏目收集了济南大学校园内的宠物图鉴。登录后即可投稿你的发现、为喜欢的宠物点赞，并在“我的收藏”中按点赞时间查看仍公开的记录。

<!-- 工具栏（搜索 / 分类 / 排序）— 静态容器，搜索输入时不会重建，避免输入框失焦 -->
<div id="pet-toolbar"></div>

<!-- 宠物图鉴动态渲染区（结果网格 + 分页） -->
<div id="pet-gallery">
  <p style="text-align:center;color:#999;padding:40px">加载中...</p>
</div>

<!-- 我的收藏区（页面底部，登录后点击“我的收藏”展开） -->
<div id="pet-liked-section" style="display:none"></div>

<!-- 我的投稿区（页面底部，登录后点击“我的投稿”展开） -->
<div id="pet-mine-section" style="display:none"></div>

<!-- 弹窗容器 -->
<div id="pet-detail-modal" style="display:none"></div>
<div id="pet-submit-modal" style="display:none"></div>
<div id="pet-edit-modal" style="display:none"></div>

<!-- 图片灯箱（点击详情大图全屏查看，支持左右切换 / Esc 关闭） -->
<div id="pet-lightbox" style="display:none;position:fixed;inset:0;background:rgba(0,0,0,.88);z-index:17000;align-items:center;justify-content:center;cursor:zoom-out">
  <button id="pet-lightbox-close" style="position:fixed;top:16px;right:20px;background:rgba(255,255,255,.15);border:none;color:#fff;font-size:18px;width:36px;height:36px;border-radius:50%;cursor:pointer;z-index:2;display:flex;align-items:center;justify-content:center">✕</button>
  <button id="pet-lightbox-prev" style="display:none;position:fixed;left:14px;top:50%;transform:translateY(-50%);background:rgba(255,255,255,.15);border:none;color:#fff;font-size:24px;width:42px;height:42px;border-radius:50%;cursor:pointer;z-index:2;align-items:center;justify-content:center">‹</button>
  <img id="pet-lightbox-img" alt="" style="max-width:92vw;max-height:88vh;border-radius:8px;box-shadow:0 12px 40px rgba(0,0,0,.5);cursor:default;object-fit:contain">
  <button id="pet-lightbox-next" style="display:none;position:fixed;right:14px;top:50%;transform:translateY(-50%);background:rgba(255,255,255,.15);border:none;color:#fff;font-size:24px;width:42px;height:42px;border-radius:50%;cursor:pointer;z-index:2;align-items:center;justify-content:center">›</button>
  <div id="pet-lightbox-counter" style="position:fixed;bottom:18px;left:50%;transform:translateX(-50%);color:#ddd;font-size:13px;background:rgba(0,0,0,.5);padding:4px 14px;border-radius:20px"></div>
</div>
