---
tags:
  - 宠物收集录
hide:
  - navigation
  - toc
---

# 🐾 宠物收集录

<!-- 页面专属导航栏：登录 / 投稿 / 我的投稿 / 改名（由 pets.js 渲染） -->
<div id="pet-nav"></div>

<!-- 登录小卡片（点击导航栏登录按钮弹出，GitHub / Gitee） -->
<div id="pet-login-pop" style="display:none"></div>

<!-- 改名小卡片 -->
<div id="pet-rename-pop" style="display:none"></div>

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
</style>

!!! tip "📸 关于本栏目"
    本栏目收集了济南大学校园内的宠物图鉴。登录后即可投稿你的发现，也可以为喜欢的宠物点赞！

<!-- 工具栏（搜索 / 分类 / 排序）— 静态容器，搜索输入时不会重建，避免输入框失焦 -->
<div id="pet-toolbar"></div>

<!-- 宠物图鉴动态渲染区（结果网格 + 分页） -->
<div id="pet-gallery">
  <p style="text-align:center;color:#999;padding:40px">加载中...</p>
</div>

<!-- 我的投稿区（页面底部，登录后点击"我的投稿"展开） -->
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
