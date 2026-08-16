/*
 * 宠物前端的纯格式化工具函数。
 * 无 DOM 依赖、无全局状态；同一输入必然同一输出，可直接被 Vitest 单测。
 * UMD 保持 MkDocs 直接加载脚本的部署方式，同时让 Vitest 可用 CommonJS 引入。
 */
(function (root, factory) {
  const format = factory();
  if (typeof module === 'object' && module.exports) module.exports = format;
  if (root) root.UJNGuidePetFormat = format;
}(typeof window !== 'undefined' ? window : globalThis, function () {
  'use strict';

  /** HTML 转义（& < > " '） */
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    })[c]);
  }

  function pad(n) {
    return String(n).padStart(2, '0');
  }

  /** ISO 时间 → 本地日期（如 2026-08-07）；非法输入返回空串 */
  function formatDate(iso) {
    if (!iso) return '';
    const d = new Date(iso);
    if (isNaN(d.getTime())) return '';
    return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  }

  /** ISO 时间 → 本地完整时间（2026-08-07 14:03）；非法输入返回空串 */
  function formatDateTime(iso) {
    if (!iso) return '';
    const d = new Date(iso);
    if (isNaN(d.getTime())) return '';
    return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()) +
      ' ' + pad(d.getHours()) + ':' + pad(d.getMinutes());
  }

  /** 毫秒时长 → 人类可读（如「2 小时 15 分」「3 天」） */
  function humanizeDuration(ms) {
    if (!ms || ms < 0) return '';
    const minutes = Math.floor(ms / 60000);
    if (minutes < 1) return '不到 1 分钟';
    const days = Math.floor(minutes / 1440);
    const hours = Math.floor((minutes % 1440) / 60);
    const mins = minutes % 60;
    if (days > 0) return days + ' 天' + (hours ? ' ' + hours + ' 小时' : '');
    if (hours > 0) return hours + ' 小时' + (mins ? ' ' + mins + ' 分' : '');
    return mins + ' 分钟';
  }

  /** dataURL 的原始字节数（近似，按 Base64 解码长度计算） */
  function dataUrlByteLength(dataUrl) {
    const comma = String(dataUrl || '').indexOf(',');
    if (comma < 0) return 0;
    const base64 = String(dataUrl).slice(comma + 1).replace(/\s/g, '');
    const padding = base64.endsWith('==') ? 2 : (base64.endsWith('=') ? 1 : 0);
    return Math.max(0, Math.floor(base64.length * 3 / 4) - padding);
  }

  /** 字节上限 → 人类可读（如「2 MB」）；非整 MB 保留 1 位小数 */
  function imageLimitLabel(bytes) {
    const limit = Number(bytes) > 0 ? Number(bytes) : 2 * 1024 * 1024;
    return (limit / (1024 * 1024)).toFixed(limit % (1024 * 1024) ? 1 : 0) + ' MB';
  }

  /** 站内相对路径（历史猫图片）原样返回，外部 URL / dataURL 直接透传 */
  function resolveImage(url) {
    if (!url) return '';
    if (/^https?:|^data:/.test(url)) return url;
    return url;
  }

  /** 展示昵称：nickname 优先，其次平台用户名 */
  function displayName(u) {
    if (!u) return '匿名';
    return (u.nickname || '').trim() || u.username || '匿名';
  }

  /** 防抖：触发后等待 ms 无新触发才执行 */
  function debounce(fn, ms) {
    let t;
    return function () {
      clearTimeout(t);
      t = setTimeout(() => fn.apply(this, arguments), ms);
    };
  }

  return {
    esc,
    formatDate,
    formatDateTime,
    humanizeDuration,
    dataUrlByteLength,
    imageLimitLabel,
    resolveImage,
    displayName,
    debounce,
  };
}));
