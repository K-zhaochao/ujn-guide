---
tags:
  - 宠物收集录
hide:
  - navigation
  - toc
---

# 🐾 宠物收集录

<!-- 页面专属导航栏与登录后个人工作区（由 pets.js 控制） -->
<div id="pet-nav"></div>

<!-- 登录后默认展开的个人工作区；投稿与收藏不再分散在导航按钮和页面底部。 -->
<section id="pet-personal-workspace" aria-label="个人工作区" style="display:none">
  <div class="pet-workspace-header">
    <div id="pet-workspace-tabs" class="pet-workspace-tabs" role="tablist" aria-label="个人内容">
      <button id="pet-workspace-mine-tab" class="pet-workspace-tab" type="button" role="tab" aria-selected="true" aria-controls="pet-mine-section">我的投稿</button>
      <button id="pet-workspace-liked-tab" class="pet-workspace-tab" type="button" role="tab" aria-selected="false" aria-controls="pet-liked-section" tabindex="-1">我的收藏</button>
    </div>
    <button id="pet-workspace-submit" class="pet-workspace-submit" type="button">投稿</button>
  </div>
  <section id="pet-mine-section" role="tabpanel" aria-labelledby="pet-workspace-mine-tab"></section>
  <section id="pet-liked-section" role="tabpanel" aria-labelledby="pet-workspace-liked-tab" hidden></section>
</section>

<!-- 登录小卡片（点击导航栏登录按钮弹出，GitHub / Gitee） -->
<div id="pet-login-pop" style="display:none"></div>

<!-- 改名小卡片 -->
<div id="pet-rename-pop" style="display:none"></div>

<!-- 导航栏通知面板 -->
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
    --pet-approved-fg: #22c55e;
    --pet-approved-bg: #dcfce7;
    --pet-rejected-fg: #ef4444;
    --pet-rejected-bg: #fee2e2;
    --pet-pending-bg: #fef3c7;      /* ⏳ 待审核徽章浅琥珀底 */
    --pet-pending-fg: #92400e;      /* ⏳ 待审核徽章棕褐字 */
    --pet-muted-bg: #f3f4f6;        /* 🗑️ 已删除徽章浅灰底 */
    --pet-muted-fg: #6b7280;        /* 🗑️ 已删除徽章灰字 */
    --pet-input-bg: #fff;
    --pet-workspace-bg: #fafbfd;
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
    /* 投稿状态标签会叠在封面图上，深色模式必须使用不透明底色以保证文字可读。 */
    --pet-approved-fg: #bbf7d0;
    --pet-approved-bg: #14532d;
    --pet-rejected-fg: #fecaca;
    --pet-rejected-bg: #7f1d1d;
    --pet-pending-bg: #78350f;
    --pet-pending-fg: #fde68a;
    --pet-muted-bg: #374151;
    --pet-muted-fg: #e5e7eb;
    --pet-input-bg: #1f242d;
    --pet-workspace-bg: #252b35;
  }

  /* 宠物卡片网格：桌面 4 列 → 中屏 3 列 → 窄屏 2 列；手机 2 列紧凑小卡片，一屏可见更多 */
  .pet-grid { grid-template-columns: repeat(4, 1fr) !important; }
  @media (max-width: 1100px) { .pet-grid { grid-template-columns: repeat(3, 1fr) !important; } }
  @media (max-width: 760px)  { .pet-grid { grid-template-columns: repeat(2, 1fr) !important; } }
  @media (max-width: 480px)  {
    .pet-grid {
      grid-template-columns: repeat(2, 1fr) !important;
      gap: 10px !important;
      /* 手机紧凑卡片：缩小封面高度、字号与内边距（卡片行内样式读取这些变量） */
      --pet-card-img-h: 96px;
      --pet-card-emoji: 26px;
      --pet-card-pad: 8px 10px;
      --pet-card-title: 13px;
      --pet-card-sub: 11px;
      --pet-card-meta: 11px;
    }
  }

  /* 分页条（宠物收集录主题）：紧凑渐变药丸「上一页/下一页」+ 圆形页码 + 迷你每页下拉 */
  .pet-pager { display: flex; align-items: center; justify-content: center; gap: 5px; flex-wrap: wrap; margin: 18px 0 8px; }
  .pet-pager-btn {
    display: inline-flex; align-items: center; gap: 4px; padding: 5px 12px; border-radius: 999px;
    border: 1px solid color-mix(in srgb, var(--pet-primary, #3b82f6) 35%, transparent);
    background: linear-gradient(135deg, var(--pet-grad-a, #fdf2f8), var(--pet-grad-b, #fff7ed));
    color: var(--md-default-fg-color, #374151); font-size: 12.5px; font-weight: 600; cursor: pointer;
    transition: transform .15s, box-shadow .15s; box-shadow: 0 1.5px 5px rgba(0, 0, 0, .06);
  }
  .pet-pager-btn:hover:not(:disabled) { transform: translateY(-1px); box-shadow: 0 3px 8px rgba(0, 0, 0, .1); }
  .pet-pager-btn:disabled { opacity: .4; cursor: not-allowed; }
  .pet-pager-num {
    min-width: 26px; height: 26px; padding: 0 6px; border-radius: 999px;
    border: 1px solid var(--pet-border, #e5e7eb); background: var(--pet-chip-bg, #fff);
    color: var(--md-default-fg-color, #374151); font-size: 12.5px; font-weight: 600; cursor: pointer;
    transition: border-color .15s, color .15s, background .15s, box-shadow .15s;
    display: inline-flex; align-items: center; justify-content: center;
  }
  .pet-pager-num:hover { border-color: var(--pet-primary, #3b82f6); color: var(--pet-primary, #3b82f6); }
  .pet-pager-num.is-active {
    background: var(--pet-primary, #3b82f6); border-color: var(--pet-primary, #3b82f6); color: #fff;
    box-shadow: 0 2px 6px color-mix(in srgb, var(--pet-primary, #3b82f6) 40%, transparent);
  }
  /* 每页数量迷你下拉：无系统箭头，纯 CSS 渐变三角指示器 + 药丸 */
  .pet-pager-size-wrap { display: inline-flex; align-items: center; gap: 4px; font-size: 12px; color: var(--pet-muted, #9ca3af); margin-left: 4px; white-space: nowrap; }
  .pet-pager-size {
    appearance: none; -webkit-appearance: none; -moz-appearance: none;
    padding: 4px 22px 4px 10px; border-radius: 999px;
    border: 1px solid color-mix(in srgb, var(--pet-primary, #3b82f6) 30%, transparent);
    background-color: var(--pet-chip-bg, #fff);
    background-image:
      linear-gradient(45deg, transparent 50%, var(--pet-muted, #9ca3af) 50%),
      linear-gradient(135deg, var(--pet-muted, #9ca3af) 50%, transparent 50%);
    background-position: calc(100% - 11px) 60%, calc(100% - 7px) 60%;
    background-size: 4px 4px, 4px 4px;
    background-repeat: no-repeat;
    color: var(--md-default-fg-color, #374151);
    font-size: 12px; font-weight: 600; cursor: pointer;
    transition: border-color .15s, background-color .15s;
  }
  .pet-pager-size:hover { border-color: color-mix(in srgb, var(--pet-primary, #3b82f6) 55%, transparent); }
  .pet-pager-size:focus { outline: 2px solid var(--pet-primary, #3b82f6); outline-offset: 2px; }

  /* 深色主题（slate）：分页按钮通透蓝紫渐变、页码/下拉主色 tint，避免发灰发暗 */
  [data-md-color-scheme="slate"] .pet-pager-btn {
    background: linear-gradient(135deg, rgba(96, 165, 250, .16), rgba(192, 132, 252, .12));
    border-color: color-mix(in srgb, var(--pet-primary, #60a5fa) 40%, transparent);
    box-shadow: 0 1.5px 6px rgba(0, 0, 0, .25);
  }
  [data-md-color-scheme="slate"] .pet-pager-btn:hover:not(:disabled) { box-shadow: 0 3px 10px rgba(0, 0, 0, .35); }
  [data-md-color-scheme="slate"] .pet-pager-num {
    background: color-mix(in srgb, var(--pet-primary, #60a5fa) 12%, var(--pet-input-bg, #1f242d));
    border-color: color-mix(in srgb, var(--pet-primary, #60a5fa) 24%, transparent);
  }
  [data-md-color-scheme="slate"] .pet-pager-num.is-active {
    background: var(--pet-primary, #60a5fa); border-color: transparent; color: #0b1220;
    box-shadow: 0 2px 8px rgba(96, 165, 250, .35);
  }
  [data-md-color-scheme="slate"] .pet-pager-size {
    background-color: var(--pet-input-bg, #1f242d);
    border-color: color-mix(in srgb, var(--pet-primary, #60a5fa) 30%, transparent);
  }

  /* P2-14 无障碍：键盘焦点可见 */
  .pet-card:focus-visible,
  .pet-mine-row:focus-visible,
  .pet-mine-card:focus-visible,
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
    #pet-mine-filters input[type=date],
    #pet-liked-filters input[type=date] { min-height: 44px; }
  }

  /* 投稿详情的点赞列表：内容区滚动、分页固定，浅色与 slate 深色共用主题变量。 */
  .pet-like-list-panel {
    width: min(100%, 540px);
    max-height: calc(100dvh - 24px);
    display: grid;
    grid-template-rows: auto minmax(0, 1fr) auto;
    overflow: hidden;
    border: 1px solid var(--pet-border);
    border-radius: 8px;
    background: var(--md-default-bg-color, #fff);
    color: var(--md-default-fg-color, #374151);
    box-shadow: 0 20px 48px rgba(0, 0, 0, .24);
  }
  .pet-like-list-header {
    display: flex;
    align-items: center;
    min-height: 58px;
    gap: 12px;
    padding: 0 16px;
    border-bottom: 1px solid var(--pet-border);
  }
  .pet-like-list-header h2 {
    min-width: 0;
    margin: 0;
    color: var(--md-default-fg-color, #1f2937);
    font-size: 17px;
    line-height: 1.4;
  }
  .pet-like-list-header h2 span { color: var(--pet-muted); font-size: 13px; font-weight: 500; }
  .pet-like-list-header button {
    display: inline-flex;
    flex: 0 0 36px;
    align-items: center;
    justify-content: center;
    width: 36px;
    height: 36px;
    margin-left: auto;
    border: 1px solid transparent;
    border-radius: 6px;
    background: transparent;
    color: var(--pet-muted);
    font-size: 18px;
    cursor: pointer;
  }
  .pet-like-list-header button:hover { background: var(--pet-soft); color: var(--md-default-fg-color, #374151); }
  .pet-like-list-body { min-height: 150px; overflow-y: auto; overscroll-behavior: contain; }
  .pet-like-list-items { margin: 0; padding: 0; list-style: none; }
  .pet-like-list-item {
    display: grid;
    grid-template-columns: 40px minmax(0, 1fr);
    gap: 11px;
    align-items: center;
    min-height: 62px;
    padding: 10px 16px;
    border-bottom: 1px solid var(--pet-border);
  }
  .pet-like-list-item:last-child { border-bottom: 0; }
  .pet-like-list-avatar {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 40px;
    height: 40px;
    overflow: hidden;
    border-radius: 50%;
    background: var(--pet-avatar-bg);
    color: var(--md-default-fg-color, #374151);
    font-size: 14px;
    font-weight: 700;
  }
  .pet-like-list-avatar img { width: 100%; height: 100%; object-fit: cover; }
  .pet-like-list-person { display: grid; min-width: 0; gap: 3px; }
  .pet-like-list-name {
    display: block;
    overflow: hidden;
    color: var(--md-default-fg-color, #374151);
    font-size: 14px;
    font-weight: 650;
    line-height: 1.35;
    text-decoration: none;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  a.pet-like-list-name:hover { color: var(--pet-primary); text-decoration: underline; }
  .pet-like-list-person time { color: var(--pet-muted); font-size: 12px; font-variant-numeric: tabular-nums; }
  .pet-like-list-empty {
    display: grid;
    min-height: 150px;
    place-content: center;
    gap: 12px;
    padding: 24px;
    color: var(--pet-muted);
    text-align: center;
  }
  .pet-like-list-empty p { margin: 0; line-height: 1.55; }
  .pet-like-list-empty button {
    min-height: 40px;
    padding: 8px 16px;
    border: 1px solid var(--pet-primary);
    border-radius: 6px;
    background: var(--pet-primary);
    color: #fff;
    font-size: 13px;
    font-weight: 650;
    cursor: pointer;
  }
  .pet-like-list-skeletons { padding: 4px 0; }
  .pet-like-list-skeleton {
    display: grid;
    grid-template-columns: 40px minmax(120px, 1fr);
    gap: 11px;
    align-items: center;
    min-height: 62px;
    padding: 10px 16px;
    border-bottom: 1px solid var(--pet-border);
  }
  .pet-like-list-skeleton span,
  .pet-like-list-skeleton i {
    display: block;
    background: var(--pet-soft);
  }
  .pet-like-list-skeleton span { width: 40px; height: 40px; border-radius: 50%; }
  .pet-like-list-skeleton i { width: 62%; height: 12px; border-radius: 4px; }
  .pet-like-list-sr-status { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; }
  .pet-like-list-pager {
    display: flex;
    align-items: center;
    justify-content: center;
    min-height: 58px;
    gap: 6px;
    padding: 9px 12px;
    border-top: 1px solid var(--pet-border);
  }
  .pet-like-list-pager button {
    min-width: 36px;
    min-height: 36px;
    padding: 0 10px;
    border: 1px solid var(--pet-border);
    border-radius: 6px;
    background: var(--pet-chip-bg);
    color: var(--md-default-fg-color, #374151);
    font-size: 12px;
    font-weight: 650;
    cursor: pointer;
  }
  .pet-like-list-pager button:hover:not(:disabled) { border-color: var(--pet-primary); color: var(--pet-primary); }
  .pet-like-list-pager button.is-active { border-color: var(--pet-primary); background: var(--pet-primary); color: #fff; }
  .pet-like-list-pager button:disabled { opacity: .42; cursor: not-allowed; }
  .pet-like-list-page-numbers { display: inline-flex; align-items: center; gap: 4px; }
  .pet-like-list-ellipsis { padding: 0 1px; color: var(--pet-muted); }
  .pet-like-list-page-summary { display: none; color: var(--pet-muted); font-size: 12px; white-space: nowrap; }

  @media (max-width: 600px) {
    .pet-like-list-panel { width: calc(100vw - 24px); max-height: calc(100dvh - 24px); }
    .pet-like-list-header { min-height: 56px; padding: 0 12px; }
    .pet-like-list-header button { flex-basis: 44px; width: 44px; height: 44px; }
    .pet-like-list-item { grid-template-columns: 40px minmax(0, 1fr); min-height: 70px; padding: 12px; }
    .pet-like-list-name { font-size: 14px; }
    .pet-like-list-person time { font-size: 12px; }
    .pet-like-list-pager { justify-content: space-between; min-height: 60px; gap: 8px; padding: 8px 12px max(8px, env(safe-area-inset-bottom)); }
    .pet-like-list-pager button { min-width: 72px; min-height: 44px; }
    .pet-like-list-page-numbers { display: none; }
    .pet-like-list-page-summary { display: block; }
  }

  /* 登录后的账号栏与个人工作区共用一套边框，视觉上是同一个工作区域。 */
  #pet-nav.pet-nav-logged-in .pet-nav-shell {
    background: var(--pet-workspace-bg);
    border: 1px solid var(--pet-border) !important;
    border-bottom: 0 !important;
    border-radius: 8px 8px 0 0 !important;
    margin-bottom: 0 !important;
    padding: 10px 14px !important;
  }
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
    min-height: 34px;
    border-radius: 8px !important;
  }
  #pet-nav .pet-nav-primary-action { white-space: nowrap; }
  #pet-nav .pet-nav-login { margin-left: auto; }
  /* 退出按钮：文字版本，宽度自适应（不再固定 34px 图标宽度） */
  #pet-nav .pet-nav-logout {
    min-width: 34px;
    height: 34px;
    padding: 0 10px !important;
    justify-content: center;
    white-space: nowrap;
  }
  /* 收起/展开按钮：文字版本，宽度自适应（flex: 0 0 34px 会压缩文字竖排） */
  #pet-nav #pet-workspace-toggle-nav {
    flex: none;
    min-width: 0;
    white-space: nowrap;
    padding: 0 10px;
  }
  #pet-nav #pet-notifications-nav { flex: 0 0 34px; }

  #pet-personal-workspace {
    border: 1px solid var(--pet-border);
    border-top: 0;
    border-radius: 0 0 8px 8px;
    background: var(--pet-workspace-bg);
    margin: 0 0 24px;
    padding: 0 14px 16px;
  }
  #pet-personal-workspace[hidden] { display: none !important; }
  .pet-workspace-header {
    display: flex;
    align-items: center;
    gap: 12px;
    min-height: 52px;
    border-bottom: 1px solid var(--pet-border);
  }
  .pet-workspace-tabs {
    display: flex;
    align-self: stretch;
    min-width: 0;
    gap: 18px;
  }
  .pet-workspace-tab {
    display: inline-flex;
    align-items: center;
    min-height: 52px;
    padding: 0 2px;
    border: 0;
    border-bottom: 2px solid transparent;
    background: transparent;
    color: var(--pet-muted);
    font-size: 14px;
    font-weight: 650;
    cursor: pointer;
  }
  .pet-workspace-tab[aria-selected="true"] {
    border-bottom-color: var(--pet-primary);
    color: var(--pet-primary);
  }
  .pet-workspace-tab:hover { color: var(--pet-primary); }
  .pet-workspace-submit {
    min-height: 34px;
    margin-left: auto;
    padding: 6px 13px;
    border: 1px solid var(--pet-primary);
    border-radius: 7px;
    background: var(--pet-primary);
    color: #fff;
    font-size: 13px;
    font-weight: 650;
    cursor: pointer;
  }
  .pet-workspace-submit:disabled {
    border-color: var(--pet-border);
    background: var(--pet-soft);
    color: var(--pet-muted);
    cursor: not-allowed;
  }
  #pet-mine-section,
  #pet-liked-section { min-width: 0; }
  #pet-mine-section .pet-mine-shell { padding-top: 14px; }
  #pet-liked-section .pet-liked-shell { padding-top: 16px; }
  #pet-liked-count {
    display: block;
    min-height: 18px;
    margin: 0 0 10px;
    color: var(--pet-muted);
    font-size: 12px;
  }

  /* 我的收藏筛选沿用投稿筛选的控件规格，日期按收藏时间而非投稿时间过滤。 */
  #pet-liked-filters {
    align-items: end !important;
    gap: 9px !important;
  }
  #pet-liked-filters input,
  #pet-liked-filters button {
    min-height: 38px;
    border-radius: 8px !important;
    box-sizing: border-box;
  }
  #pet-liked-filters input[type="search"],
  #pet-liked-filters input[type="date"] {
    border-color: var(--pet-border) !important;
    background-color: var(--pet-input-bg) !important;
  }
  #pet-liked-filters input:hover { border-color: var(--pet-primary) !important; }
  #pet-liked-filters input:focus {
    border-color: var(--pet-primary) !important;
    box-shadow: 0 0 0 3px color-mix(in srgb, var(--pet-primary) 20%, transparent);
  }
  #pet-liked-filters .pet-date {
    cursor: pointer;
    font-variant-numeric: tabular-nums;
  }
  #pet-liked-filters .pet-liked-date-range {
    display: grid;
    grid-template-columns: repeat(2, 128px);
    gap: 8px;
  }
  #pet-liked-filters .pet-liked-date-range label {
    display: grid;
    gap: 3px;
    color: var(--pet-muted);
    font-size: 11px;
    font-weight: 600;
  }
  #pet-liked-filters .pet-liked-date-range input { width: 100%; }

  /* 我的投稿的筛选控件在桌面端紧凑同行，在日期范围内保持明确的起止关系。 */
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

  /* ===== 下拉框美化：去掉系统生硬箭头，换成随主题变化的细箭头 ===== */
  .pet-select,
  #pet-mine-filters select {
    appearance: none;
    -webkit-appearance: none;
    -moz-appearance: none;
    cursor: pointer;
    padding-right: 30px !important;
    background-image: url("data:image/svg+xml;charset=utf-8,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%236b7280' stroke-width='2.5' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E") !important;
    background-repeat: no-repeat !important;
    background-position: right 9px center !important;
    background-size: 12px !important;
    transition: border-color .15s, box-shadow .15s;
  }
  [data-md-color-scheme="slate"] .pet-select,
  [data-md-color-scheme="slate"] #pet-mine-filters select {
    background-image: url("data:image/svg+xml;charset=utf-8,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%239ca3af' stroke-width='2.5' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E") !important;
  }
  .pet-select:hover,
  #pet-mine-filters select:hover { border-color: var(--pet-primary) !important; }
  .pet-select:focus,
  #pet-mine-filters select:focus {
    border-color: var(--pet-primary) !important;
    box-shadow: 0 0 0 3px color-mix(in srgb, var(--pet-primary) 20%, transparent);
    outline: none;
  }

  /* 我的投稿卡片：桌面 hover 反馈更柔和 */
  #pet-mine-list .pet-mine-card {
    transition: border-color .15s, box-shadow .15s;
  }
  #pet-mine-list .pet-mine-card:hover {
    border-color: var(--pet-primary) !important;
    box-shadow: 0 1px 5px rgba(0, 0, 0, .07);
  }
  /* 卡片内操作按钮：按钮间用虚线分隔，避免视觉粘连 */
  #pet-mine-list .pet-mine-row-actions button {
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  #pet-mine-filters .pet-date {
    cursor: pointer;
    font-variant-numeric: tabular-nums;
  }
  #pet-mine-filters .pet-mine-date-range {
    display: grid;
    /* 日期框已由 pet-picker.js 运行时转为只读文本框（无系统日历图标），
     * 固定 128px 即可容纳 YYYY-MM-DD（10 字符）与「选择日期」占位，不再随容器拉伸 */
    grid-template-columns: repeat(2, 128px);
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

  /* 通知筛选日期框：提高边界对比度和触控尺寸，亮暗主题同色系。 */
  #pet-notification-filters input,
  #pet-notification-filters button {
    min-height: 44px;
    border-radius: 8px !important;
    box-sizing: border-box;
  }
  #pet-notification-filters input[type="date"] {
    padding: 9px 12px;
    border: 2px solid var(--pet-border) !important;
    background-color: var(--pet-input-bg) !important;
    color: var(--md-default-fg-color, #374151);
    cursor: pointer;
    font-size: 13px;
    font-weight: 600;
    line-height: 1.3;
    font-variant-numeric: tabular-nums;
    transition: border-color .15s, background-color .15s, box-shadow .15s;
  }
  #pet-notification-filters input[type="date"]:hover {
    border-color: var(--pet-primary) !important;
    background-color: color-mix(in srgb, var(--pet-primary) 4%, var(--pet-input-bg)) !important;
  }
  #pet-notification-filters input[type="date"]:focus {
    border-color: var(--pet-primary) !important;
    box-shadow: 0 0 0 3px color-mix(in srgb, var(--pet-primary) 22%, transparent), 0 1px 2px rgba(0, 0, 0, .08);
    outline: none;
  }
  #pet-notification-filters .pet-notification-date-range {
    display: grid;
    grid-template-columns: repeat(2, 136px);
    gap: 10px;
  }
  #pet-notification-filters .pet-notification-date-range label {
    display: grid;
    gap: 5px;
    color: var(--md-default-fg-color, #374151);
    font-size: 12px;
    font-weight: 700;
    line-height: 1.3;
  }
  #pet-notification-filters .pet-notification-date-range input { width: 100%; }
  #pet-notification-reset {
    min-width: 72px;
    padding: 9px 10px;
    border: 2px solid var(--pet-border);
    background: var(--pet-soft);
    color: var(--md-default-fg-color, #374151);
    cursor: pointer;
    font-size: 12px;
    font-weight: 650;
    transition: border-color .15s, color .15s, background-color .15s, box-shadow .15s;
  }
  #pet-notification-reset:hover {
    border-color: var(--pet-primary);
    color: var(--pet-primary);
    background: color-mix(in srgb, var(--pet-primary) 6%, var(--pet-soft));
  }
  #pet-notification-reset:focus-visible {
    border-color: var(--pet-primary);
    box-shadow: 0 0 0 3px color-mix(in srgb, var(--pet-primary) 22%, transparent);
    outline: none;
  }

  /* ===== 自定义可爱风下拉 / 日历面板（pet-picker.js） =====
   * 原生 select 的 option 列表与原生日历弹层是浏览器系统 UI，无法 CSS 定制；
   * 鼠标/触控点击时由 pet-picker.js 显示下方面板，键盘仍走原生控件。 */
  .pet-picker-panel {
    position: fixed;
    z-index: 20000;
    box-sizing: border-box;
    border: 1px solid var(--pet-border, #e5e7eb);
    border-radius: 14px;
    background: var(--pet-input-bg, #fff);
    box-shadow: 0 10px 28px rgba(0, 0, 0, .14), 0 2px 8px rgba(0, 0, 0, .06);
    padding: 6px;
    min-width: 150px;
    font-size: 13px;
    color: var(--md-default-fg-color, #374151);
  }
  /* 下拉选项：圆角高亮、选中项主色标记 */
  .pet-picker-option {
    display: block;
    width: 100%;
    box-sizing: border-box;
    text-align: left;
    border: 0;
    border-radius: 9px;
    background: transparent;
    color: inherit;
    font-size: 13px;
    padding: 9px 12px;
    cursor: pointer;
    transition: background .12s, color .12s;
  }
  .pet-picker-option:hover {
    background: color-mix(in srgb, var(--pet-primary, #3b82f6) 10%, transparent);
  }
  .pet-picker-option.is-selected {
    background: color-mix(in srgb, var(--pet-primary, #3b82f6) 14%, transparent);
    color: var(--pet-primary, #3b82f6);
    font-weight: 650;
  }
  /* 分页条「每页数量」迷你下拉的紧凑面板：窄宽 + 居中数字选项（pet-pager-size 触发） */
  .pet-picker-panel--compact { min-width: 64px; padding: 4px; }
  .pet-picker-panel--compact .pet-picker-option {
    text-align: center; padding: 6px 10px; font-size: 12.5px; font-weight: 600; border-radius: 8px;
  }
  .pet-picker-panel--compact .pet-picker-option.is-selected {
    box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--pet-primary, #3b82f6) 45%, transparent);
  }
  /* ===== 选项列表面板（pet-picker.js）：固定高度 + 右侧适配主题的滚动条 =====
   * 类型等选项多时，选项列表固定为合适大小（最多约 8 行），不随选项数增高
   * 占满屏幕；超出部分在面板内部滚动，右侧显示适配主题的滚动条（thumb 圆角
   * 柔和、hover 变主色，亮/暗主题随 --pet-* 变量自动切换）。
   * Firefox 用 scrollbar-width/scrollbar-color，Chromium 用 ::-webkit-scrollbar。 */
  .pet-picker-panel--list {
    max-height: 272px;
    overflow-y: auto;
    scrollbar-width: thin;
    scrollbar-color: color-mix(in srgb, var(--pet-muted, #9ca3af) 45%, transparent) transparent;
  }
  .pet-picker-panel--list::-webkit-scrollbar { width: 10px; }
  .pet-picker-panel--list::-webkit-scrollbar-track { background: transparent; }
  .pet-picker-panel--list::-webkit-scrollbar-thumb {
    background: color-mix(in srgb, var(--pet-muted, #9ca3af) 45%, transparent);
    border-radius: 5px;
    border: 2px solid var(--pet-input-bg, #fff);
  }
  .pet-picker-panel--list::-webkit-scrollbar-thumb:hover {
    background: color-mix(in srgb, var(--pet-primary, #3b82f6) 55%, transparent);
  }
  /* 类型筛选触发器固定宽度：选项再多也不撑大下拉框，超长省略 */
  #pet-mine-filters #pet-mine-category {
    max-width: 152px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  /* 日历面板：圆角、柔和渐变头部、圆形日格 */
  .pet-cal {
    width: min(326px, calc(100vw - 20px));
    padding: 14px;
    border: 2px solid color-mix(in srgb, var(--pet-primary, #3b82f6) 34%, var(--pet-border, #e5e7eb));
  }
  .pet-cal-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 8px;
  }
  .pet-cal-title {
    font-size: 15px;
    font-weight: 700;
    color: var(--md-default-fg-color, #1f2937);
    letter-spacing: .5px;
  }
  .pet-cal-nav {
    flex: 0 0 40px;
    width: 40px;
    height: 40px;
    border: 1px solid color-mix(in srgb, var(--pet-primary, #3b82f6) 28%, var(--pet-border, #e5e7eb));
    border-radius: 50%;
    background: var(--pet-soft, rgba(0, 0, 0, .04));
    color: var(--pet-primary, #3b82f6);
    font-size: 20px;
    line-height: 1;
    cursor: pointer;
    transition: background .12s, transform .12s;
  }
  .pet-cal-nav:hover { background: color-mix(in srgb, var(--pet-primary, #3b82f6) 14%, transparent); }
  .pet-cal-nav:active { transform: scale(.92); }
  .pet-cal-week {
    display: grid;
    grid-template-columns: repeat(7, 1fr);
    text-align: center;
    font-size: 12px;
    font-weight: 650;
    color: var(--pet-muted, #9ca3af);
    margin-bottom: 6px;
  }
  .pet-cal-grid {
    display: grid;
    grid-template-columns: repeat(7, 1fr);
    gap: 3px;
  }
  .pet-cal-day {
    min-width: 0;
    min-height: 38px;
    height: 38px;
    border: 1px solid transparent;
    border-radius: 50%;
    background: transparent;
    color: inherit;
    font-size: 13px;
    cursor: pointer;
    transition: background .12s, color .12s, transform .12s;
  }
  .pet-cal-day:hover {
    border-color: color-mix(in srgb, var(--pet-primary, #3b82f6) 28%, transparent);
    background: color-mix(in srgb, var(--pet-primary, #3b82f6) 9%, var(--pet-soft, rgba(0, 0, 0, .04)));
  }
  .pet-cal-day.is-out { color: var(--pet-faint, #b0b4bb); }
  .pet-cal-day.is-today {
    box-shadow: inset 0 0 0 2px var(--pet-primary, #3b82f6);
    color: var(--pet-primary, #3b82f6);
    font-weight: 650;
  }
  .pet-cal-day.is-selected {
    background: var(--pet-primary, #3b82f6);
    color: #fff;
    font-weight: 650;
    box-shadow: 0 2px 5px color-mix(in srgb, var(--pet-primary, #3b82f6) 35%, transparent);
  }
  .pet-cal-day.is-selected:hover { background: var(--pet-primary, #3b82f6); }
  .pet-cal-foot { text-align: center; margin-top: 8px; }
  .pet-cal-today {
    border: 0;
    border-radius: 20px;
    background: var(--pet-soft, rgba(0, 0, 0, .04));
    color: var(--pet-primary, #3b82f6);
    min-height: 40px;
    padding: 8px 16px;
    font-size: 12px;
    font-weight: 650;
    cursor: pointer;
    transition: background .12s;
  }
  .pet-cal-today:hover { background: color-mix(in srgb, var(--pet-primary, #3b82f6) 14%, transparent); }

  @media (max-width: 640px) {
    /* —— 未登录：登录按钮对标电脑端（右对齐），仅缩小尺寸，不做居中胶囊 —— */
    #pet-nav .pet-nav-login {
      width: auto;
      margin-left: auto;
      justify-content: center;
      min-height: 30px !important;
      padding: 5px 16px !important;
      font-size: 12px !important;
      gap: 5px !important;
      border-radius: 8px !important;
    }

    /* —— 登录后导航栏：账户胶囊一行 + 按钮一行（flex 自适应），全部紧凑 —— */
    #pet-nav.pet-nav-logged-in .pet-nav-shell { padding: 8px 10px !important; }
    #pet-nav .pet-nav-shell { align-items: stretch !important; padding: 8px 0 10px !important; }
    #pet-nav .pet-nav-actions {
      display: flex !important;
      align-items: center;
      justify-content: flex-end;
      flex-wrap: wrap;
      gap: 6px;
    }
    /* 账户胶囊：内容自适应、居中显示，不再横向撑满 */
    #pet-nav .pet-nav-account {
      width: fit-content;
      max-width: 100%;
      margin: 0;
      min-height: 28px;
      justify-content: center;
      padding: 2px 12px 2px 2px !important;
      font-size: 12px !important;
      gap: 5px !important;
      border-radius: 18px !important;
    }
    #pet-nav .pet-nav-account > *:first-child {
      width: 19px !important;
      height: 19px !important;
      font-size: 10px !important;
    }
    #pet-nav .pet-nav-secondary-action { min-height: 28px; font-size: 12px !important; }
    #pet-nav #pet-admin-nav {
      justify-content: center;
      min-height: 28px !important;
      padding: 4px 8px !important;
      font-size: 12px !important;
    }
    /* 通知铃铛：固定小方钮，不随 flex 撑大 */
    #pet-nav #pet-notifications-nav {
      width: 28px !important;
      height: 28px !important;
      min-width: 28px !important;
      flex: none !important;
      padding: 0 !important;
      border-radius: 7px !important;
      font-size: 14px !important;
    }
    /* 收起/展开：文字自适应 */
    #pet-nav #pet-workspace-toggle-nav {
      height: 28px !important;
      min-height: 28px !important;
      flex: none !important;
      padding: 0 9px !important;
      border-radius: 7px !important;
      font-size: 12px !important;
    }
    /* 退出：虚线边框 + 中文，与其他按钮同高；width 自适应避免文字溢出虚线 */
    #pet-nav #pet-logout-nav {
      width: auto !important;
      min-width: 0 !important;
      height: 28px !important;
      min-height: 28px !important;
      flex: none !important;
      padding: 0 10px !important;
      border-radius: 7px !important;
      font-size: 12px !important;
      white-space: nowrap;
    }

    /* —— 个人工作区：Tab 与投稿按钮同一行，右侧投稿按钮固定宽 —— */
    #pet-personal-workspace { margin-bottom: 16px; padding: 0 10px 10px; }
    .pet-workspace-header { flex-direction: row; align-items: center; gap: 8px; padding: 6px 0 8px; min-height: 0; }
    .pet-workspace-tabs { display: flex; flex: 1; gap: 4px; width: auto; min-width: 0; }
    .pet-workspace-tab { flex: 1; justify-content: center; min-height: 32px; padding: 0 4px; font-size: 12px; }
    .pet-workspace-submit { width: auto; min-width: 92px; min-height: 32px; margin: 0; font-size: 11px; padding: 4px 10px; }

    /* —— 状态计数胶囊：一行横向滚动，矮小 —— */
    #pet-mine-status-counts {
      flex-wrap: nowrap !important;
      overflow-x: auto;
      padding-bottom: 2px;
      margin-bottom: 6px !important;
      scrollbar-width: thin;
    }
    #pet-mine-status-counts button { flex: 0 0 auto; min-height: 28px !important; padding: 2px 9px !important; font-size: 11px !important; }

    /* —— 筛选区：搜索一行 / 类型+排序+重置三列同行 / 日期范围一行 —— */
    #pet-mine-filters {
      display: grid !important;
      grid-template-columns: repeat(3, minmax(0, 1fr)) !important;
      grid-template-areas:
        "search search search"
        "cat    sort  reset"
        "date   date  date";
      gap: 6px !important;
      margin-top: 8px !important;
      margin-bottom: 6px !important;
    }
    #pet-mine-filters #pet-mine-search { grid-area: search; }
    #pet-mine-filters #pet-mine-category { grid-area: cat; }
    #pet-mine-filters #pet-mine-sort { grid-area: sort; }
    #pet-mine-filters #pet-mine-reset { grid-area: reset; }
    #pet-mine-filters .pet-mine-date-range { grid-area: date; }
    #pet-mine-filters select,
    #pet-mine-filters input,
    #pet-mine-filters button { width: 100%; min-height: 32px !important; font-size: 12px !important; }
    #pet-mine-filters .pet-mine-date-range { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 6px !important; }
    #pet-mine-filters .pet-mine-date-range label { font-size: 10px !important; }
    #pet-mine-filters #pet-mine-reset { justify-content: center; padding: 4px 8px !important; min-height: 32px !important; }

    #pet-liked-filters {
      display: grid !important;
      grid-template-columns: repeat(3, minmax(0, 1fr)) !important;
      grid-template-areas:
        "search search search"
        "date   date   reset";
      gap: 6px !important;
      margin-top: 8px !important;
      margin-bottom: 6px !important;
    }
    #pet-liked-filters #pet-liked-search { grid-area: search; }
    #pet-liked-filters .pet-liked-date-range { grid-area: date; }
    #pet-liked-filters #pet-liked-reset { grid-area: reset; }
    #pet-liked-filters input,
    #pet-liked-filters button { width: 100%; min-height: 32px !important; font-size: 12px !important; }
    #pet-liked-filters .pet-liked-date-range { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 6px !important; }
    #pet-liked-filters .pet-liked-date-range label { font-size: 10px !important; }
    #pet-liked-filters #pet-liked-reset { justify-content: center; padding: 4px 8px !important; min-height: 32px !important; }

    #pet-notification-filters { display: grid !important; grid-template-columns: minmax(0, 1fr) 68px; gap: 8px !important; }
    #pet-notification-filters .pet-notification-date-range { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px !important; }
    #pet-notification-filters .pet-notification-date-range label { gap: 4px; font-size: 12px !important; }
    #pet-notification-filters input, #pet-notification-filters button { width: 100%; min-height: 44px !important; font-size: 13px !important; }
    #pet-notification-filters input[type="date"] { padding: 8px !important; }
    #pet-notification-reset { min-width: 0; padding: 8px 6px !important; }

    /* —— 我的投稿卡片（手机端）：封面更矮、操作按钮双列紧凑、摘要单行截断 —— */
    #pet-mine-list .pet-grid {
      gap: 10px !important;
      --pet-card-img-h: 92px;
      --pet-card-emoji: 24px;
      --pet-card-pad: 8px 9px;
      --pet-card-title: 13px;
    }
    #pet-mine-list .pet-mine-card { border-radius: 10px !important; }
    /* 状态徽章在手机端更小，避免遮挡封面 */
    #pet-mine-list .pet-mine-card > div > span[style*="position:absolute"] {
      font-size: 9px !important;
      padding: 0 5px !important;
    }
    #pet-mine-list .pet-mine-row-actions button { min-height: 26px !important; padding: 3px 5px !important; font-size: 10.5px !important; }
    /* 卡片摘要 / 时间 / 拒绝原因 单行截断 */
    #pet-mine-list .pet-mine-card div[style*="font-size:11px"],
    #pet-mine-list .pet-mine-card div[style*="font-size:10px"] {
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    /* 空态：更紧凑 */
    #pet-mine-list > p { padding: 22px 10px !important; font-size: 13px !important; line-height: 1.6; }
    /* 工具栏：搜索框与筛选胶囊在手机上更紧凑 */
    #pet-toolbar .pet-sort-btn,
    #pet-toolbar .pet-filter-btn { padding: 5px 12px !important; font-size: 12px !important; }
    #pet-search { padding: 8px 12px !important; font-size: 13px !important; }
    #pet-liked-list .pet-grid { gap: 10px !important; }
  }

  @media (max-width: 380px) {
    #pet-nav .pet-nav-actions { gap: 5px !important; }
    #pet-nav #pet-admin-nav { padding: 4px 6px !important; font-size: 11px !important; }
    #pet-nav #pet-workspace-toggle-nav { padding: 0 7px !important; }
    #pet-nav #pet-logout-nav { padding: 0 8px !important; }
    #pet-mine-filters {
      grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
      grid-template-areas:
        "search search"
        "cat    sort"
        "date   date"
        "reset  reset";
    }
    #pet-mine-filters .pet-mine-date-range { grid-template-columns: 1fr; }
    #pet-liked-filters {
      grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
      grid-template-areas:
        "search search"
        "date   date"
        "reset  reset";
    }
    #pet-liked-filters .pet-liked-date-range { grid-template-columns: 1fr; }
    #pet-notification-filters { grid-template-columns: 1fr !important; }
    #pet-notification-filters .pet-notification-date-range { grid-template-columns: 1fr; }
    .pet-workspace-submit { min-width: 84px; }
  }
</style>

!!! tip "📸 关于本栏目"
    本栏目收集了济南大学校园内的宠物图鉴。登录后即可投稿你的发现、为喜欢的宠物点赞，并在“我的收藏”中按点赞时间查看、搜索和筛选仍公开的记录。投稿详情中的“点赞列表”可分页查看点赞者和时间。导航栏“通知”支持按日期筛选；未读站长通知会置顶，查看内容后需主动点击“已读”才会解除置顶。

<!-- 工具栏（搜索 / 分类 / 排序）— 静态容器，搜索输入时不会重建，避免输入框失焦 -->
<div id="pet-toolbar"></div>

<!-- 宠物图鉴动态渲染区（结果网格 + 分页） -->
<div id="pet-gallery">
  <p style="text-align:center;color:#999;padding:40px">加载中...</p>
</div>

<!-- 弹窗容器 -->
<div id="pet-detail-modal" style="display:none"></div>
<div id="pet-like-list-modal" style="display:none"></div>
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
