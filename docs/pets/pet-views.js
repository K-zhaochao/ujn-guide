/*
 * 宠物前端渲染层纯函数。
 * 所有 HTML 生成逻辑收敛于此，通过 createPetViews(ctx) 注入依赖：
 *   - 颜色对象 C、分类/可投稿类型、内容模型
 *   - 视图模型函数（fieldKey/fieldIcon/fieldDisplayValue/publicFieldEntries/petEmoji/paginationPages）
 *   - 格式化工具（esc/formatDate/formatDateTime/humanizeDuration/resolveImage/displayName/imageLimitLabel）
 * 纯函数无 DOM 副作用，可被 Vitest 直接单测；pets.js 只保留状态与事件绑定。
 */
(function (root, factory) {
  const views = factory();
  if (typeof module === 'object' && module.exports) module.exports = views;
  if (root) root.UJNGuidePetViews = views;
}(typeof window !== 'undefined' ? window : globalThis, function () {
  'use strict';

  function createPetViews(ctx) {
    if (!ctx || !ctx.C) throw new TypeError('渲染层需要颜色配置');
    const {
      C,
      catEmoji = {},
      CATEGORIES = [],
      SUBMISSION_TYPES = [],
      contentSchema = { types: [], fields: [], bindings: [] },
      maxImagesLimit = 10,
      maxImageBytesLimit = 2 * 1024 * 1024,
      safeHttpUrl = url => url || '',
      fieldKey = f => (f && (f.key || f.fieldKey)) || '',
      fieldIcon = f => (f && f.icon) || '•',
      fieldDisplayValue = (f, v) => (v == null ? '' : String(v)),
      publicFieldEntries = () => [],
      petEmoji = () => '🐾',
      paginationPages = (total, current) => [current],
      esc = s => String(s == null ? '' : s),
      formatDate = () => '',
      formatDateTime = () => '',
      humanizeDuration = () => '',
      resolveImage = url => url || '',
      displayName = () => '匿名',
      imageLimitLabel = () => '2 MB',
    } = ctx;

    // ================== 图鉴分页数字按钮（宠物收集录主题：圆形药丸页码） ==================

    function paginationNumbersHtml(totalPages, currentPage) {
      const pages = paginationPages(totalPages, currentPage);
      const html = [];
      for (let i = 0; i < pages.length; i++) {
        const p = pages[i];
        if (i > 0 && p - pages[i - 1] > 1) html.push('<span style="color:' + C.muted + ';padding:0 2px">…</span>');
        html.push(
          '<button class="pet-pager-num pet-page-btn' + (p === currentPage ? ' is-active' : '') + '" data-page="' + p + '" aria-label="第 ' + p + ' 页">' + p + '</button>'
        );
      }
      return html.join('');
    }

    // 每页数量下拉（宠物收集录主题）：切换后由各控制器绑定 change 事件重置到第 1 页重新加载
    function pageSizeSelectHtml({ cls = '', current = 12, options = [6, 12, 24, 48] } = {}) {
      return '<label class="pet-pager-size-wrap">每页 <select class="pet-pager-size ' + cls + '" aria-label="每页显示数量">' +
        options.map(v => '<option value="' + v + '"' + (Number(v) === Number(current) ? ' selected' : '') + '>' + v + '</option>').join('') +
        '</select> 条</label>';
    }

    // 上一页 / 下一页 按钮（主题化渐变药丸 + 🐾 肉垫图标）
    function pagerNavBtnHtml({ cls, label, page, disabled }) {
      return '<button class="pet-pager-btn ' + cls + '" data-page="' + page + '" ' + (disabled ? 'disabled' : '') + '>' + label + '</button>';
    }

    // ================== 宠物卡片 ==================

    function petCardHtml(p) {
      const img = p.images && p.images.length ? p.images[0] : '';
      const who = p.contributor ? displayName(p.contributor) : '';
      const summaryFields = publicFieldEntries(p, 'card')
        .filter(entry => fieldKey(entry.field) !== 'name' && fieldDisplayValue(entry.field, entry.value) !== '')
        .map(entry => '<div style="font-size:var(--pet-card-sub,12px);color:' + C.muted + ';margin-top:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis" title="' + esc((entry.field.label || fieldKey(entry.field)) + '：' + fieldDisplayValue(entry.field, entry.value)) + '">' + esc(fieldIcon(entry.field)) + ' ' + esc(fieldDisplayValue(entry.field, entry.value)) + '</div>')
        .join('');
      const whoLink = p.contributor && p.contributor.profileUrl
        ? '<a href="' + esc(p.contributor.profileUrl) + '" target="_blank" rel="noopener" onclick="event.stopPropagation()" style="color:' + C.muted + ';text-decoration:none;cursor:pointer" title="打开个人主页">@' + esc(who) + '</a>'
        : (who ? '@' + esc(who) : '');
      return '<div class="pet-card" data-id="' + esc(p.id) + '" tabindex="0" role="button" aria-label="查看 ' + esc(p.name || '未命名宠物') + ' 详情" style="background:' + C.bg + ';border:1px solid ' + C.border + ';border-radius:12px;overflow:hidden;cursor:pointer;transition:transform .15s,box-shadow .15s">' +
        '<div style="width:100%;height:var(--pet-card-img-h,130px);background:' + C.imgBg + ';position:relative">' +
        (img ? '<img src="' + esc(resolveImage(img)) + '" alt="' + esc(p.name) + '" loading="lazy" style="width:100%;height:100%;object-fit:cover" onerror="this.parentNode.innerHTML=\'<div style=\'width:100%;height:100%;display:flex;align-items:center;justify-content:center;font-size:var(--pet-card-emoji,36px)\'>' + esc(petEmoji(p)) + '</div>\'">' : '<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;font-size:var(--pet-card-emoji,36px)">' + esc(petEmoji(p)) + '</div>') +
        '</div>' +
        '<div style="padding:var(--pet-card-pad,10px 12px)">' +
        '<div style="font-size:var(--pet-card-title,15px);font-weight:600;color:' + C.fgDark + '">' + (p.name ? esc(p.name) : '<span style="color:' + C.muted + ';font-weight:500">🐾 未命名宠物</span>') + '</div>' +
        summaryFields +
        '<div style="display:flex;align-items:center;gap:8px;margin-top:6px">' +
        '<span class="pet-card-like" style="display:inline-flex;align-items:center;gap:3px;font-size:var(--pet-card-meta,12px);color:' + (p.liked ? C.danger : C.muted) + '">' + (p.liked ? '❤️' : '🤍') + ' ' + (p.likeCount || 0) + '</span>' +
        (whoLink ? '<span style="margin-left:auto;font-size:var(--pet-card-meta,11px);color:' + C.faint + ';white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:90px">📸 ' + whoLink + '</span>' : '') +
        '</div>' +
        '</div></div>';
    }

    // ================== 图鉴整体（分组 + 空态 + 分页） ==================

    function galleryHtml({ allPets = [], searchQuery = '', currentPage = 1, totalPages = 1, totalCount = 0, pageSize = 12 } = {}) {
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
            // 图标与文字默认「💬 加入群聊」，站长可在后台按需改为「📖 查看说明」「🐧 QQ 群」等
            const groupIcon = (c.metadata && c.metadata.groupIcon) || '💬';
            const groupLabel = (c.metadata && c.metadata.groupLabel) || '加入群聊';
            const groupLink = groupUrl
              ? '<a href="' + esc(groupUrl) + '" target="_blank" rel="noopener noreferrer" style="display:inline-flex;align-items:center;gap:4px;padding:2px 12px;border-radius:20px;background:' + C.primary + ';color:#fff;font-size:12px;font-weight:500;text-decoration:none;vertical-align:middle">' + esc(groupIcon) + ' ' + esc(groupLabel) + '</a>'
              : '';
            return '<h3 style="margin:18px 0 12px;font-size:17px;color:' + C.fgDark + ';display:flex;align-items:center;gap:8px;flex-wrap:wrap">' +
              esc(c.emoji || catEmoji[c.key] || '') + ' ' + esc(c.key) +
              ' <span style="font-size:13px;color:' + C.muted + ';font-weight:400">' + list.length + ' 只</span>' +
              groupLink +
              '</h3>' +
              '<div class="pet-grid" style="display:grid;grid-template-columns:repeat(4,1fr);gap:14px">' +
              list.map(p => petCardHtml(p)).join('') +
              '</div>';
          }).join('');

      // 分页条始终显示（有数据时），即使只有一页也提供 上一页/数字/下一页 + 每页数量下拉
      const pager = totalCount > 0
        ? '<div class="pet-pager">' +
            pagerNavBtnHtml({ cls: 'pet-page-btn', label: '🐾 上一页', page: currentPage - 1, disabled: currentPage <= 1 }) +
            paginationNumbersHtml(totalPages, currentPage) +
            pagerNavBtnHtml({ cls: 'pet-page-btn', label: '下一页 🐾', page: currentPage + 1, disabled: currentPage >= totalPages }) +
            '<span style="font-size:12px;color:' + C.muted + ';margin-left:4px">共 ' + totalCount + ' 只 · 第 ' + currentPage + '/' + totalPages + ' 页</span>' +
            pageSizeSelectHtml({ cls: 'pet-page-size', current: pageSize }) +
          '</div>'
        : '<div style="text-align:center;font-size:13px;color:' + C.muted + ';margin:26px 0 10px">共 ' + totalCount + ' 只宠物</div>';

      return result + pager;
    }

    function likedPetsHtml({ pets = [], currentPage = 1, totalPages = 1, totalCount = 0, pageSize = 12 } = {}) {
      const list = pets.length
        ? '<div class="pet-grid" style="display:grid;grid-template-columns:repeat(4,1fr);gap:14px">' + pets.map(pet => petCardHtml(pet)).join('') + '</div>'
        : '<p class="pet-liked-empty" style="text-align:center;color:' + C.muted + ';padding:32px 0">还没有收藏，去图鉴里点亮喜欢的宠物吧。</p>';
      // 分页条始终显示（有数据时），即使只有一页也提供 上一页/数字/下一页 + 每页数量下拉
      const pager = totalCount > 0
        ? '<div class="pet-pager">' +
            pagerNavBtnHtml({ cls: 'pet-liked-page-btn', label: '🐾 上一页', page: currentPage - 1, disabled: currentPage <= 1 }) +
            paginationNumbersHtml(totalPages, currentPage).replaceAll('pet-page-btn', 'pet-liked-page-btn') +
            pagerNavBtnHtml({ cls: 'pet-liked-page-btn', label: '下一页 🐾', page: currentPage + 1, disabled: currentPage >= totalPages }) +
            '<span style="font-size:12px;color:' + C.muted + ';margin-left:4px">共 ' + totalCount + ' 只 · 第 ' + currentPage + '/' + totalPages + ' 页</span>' +
            pageSizeSelectHtml({ cls: 'pet-liked-page-size', current: pageSize }) +
          '</div>'
        : '';
      return list + pager;
    }

    // ================== 详情弹窗主体 ==================

    function detailModalHtml(p) {
      const images = p.images || [];
      const mainImg = images.length ? resolveImage(images[0]) : '';
      const displayType = p.type && p.type.name ? p.type.name : p.category;

      const infoRow = (label, emoji, value) => {
        // 字段未填写时隐藏整行，不用“暂未记录”占位；用户填写后再展示
        if (value === null || value === undefined || value === '') return '';
        return '<div style="display:flex;gap:10px;padding:10px 14px;background:' + C.soft + ';border-radius:10px;align-items:flex-start">' +
          '<span style="font-size:16px;line-height:1.5">' + esc(emoji) + '</span>' +
          '<div style="min-width:0">' +
            '<div style="font-size:12px;color:' + C.muted + ';margin-bottom:2px">' + esc(label) + '</div>' +
            '<div style="font-size:14px;line-height:1.6;color:' + C.fg + ';word-break:break-word">' +
              esc(value) +
            '</div>' +
          '</div>' +
        '</div>';
      };
      const detailFieldsHtml = publicFieldEntries(p, 'detail')
        .filter(entry => fieldKey(entry.field) !== 'name')
        .map(entry => infoRow(entry.field.label || fieldKey(entry.field), fieldIcon(entry.field), fieldDisplayValue(entry.field, entry.value)))
        .join('');

      function contributorInner(contributor) {
        return (contributor.avatarUrl
              ? '<img src="' + esc(contributor.avatarUrl) + '" alt="" style="width:26px;height:26px;border-radius:50%;object-fit:cover">'
              : '<span style="width:26px;height:26px;border-radius:50%;background:' + C.avatarBg + ';display:flex;align-items:center;justify-content:center;font-size:13px">🐾</span>') +
            '<div style="font-size:13px;color:' + C.fg + '"><span style="color:' + C.muted + '">投稿人</span> @' + esc(displayName(contributor)) + '</div>';
      }
      const contributorHtml = p.contributor
        ? '<div style="display:flex;align-items:center;gap:8px;padding:10px 14px;background:' + C.soft + ';border-radius:10px">' +
            (p.contributor.profileUrl
              ? '<a href="' + esc(p.contributor.profileUrl) + '" target="_blank" rel="noopener" style="display:flex;align-items:center;gap:8px;text-decoration:none;color:inherit" title="打开个人主页">' + contributorInner(p.contributor) + '</a>'
              : contributorInner(p.contributor)) +
          '</div>'
        : '';

      const timeHtml = '<div style="font-size:12px;color:' + C.faint + ';text-align:center;margin-top:2px">' +
        (p.createdAt ? '投稿于 ' + esc(formatDate(p.createdAt)) : '') +
        (p.updatedAt && p.updatedAt !== p.createdAt ? ' · 更新于 ' + esc(formatDate(p.updatedAt)) : '') +
        '</div>';

      return '<div class="pet-scroll" style="background:' + C.bg + ';border-radius:16px;max-width:620px;width:100%;max-height:90vh;overflow-y:auto;position:relative">' +
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
        '<div style="padding:16px 24px 24px;display:flex;flex-direction:column;gap:10px">' +
          detailFieldsHtml +
          contributorHtml +
          timeHtml +
        '</div>' +
        '</div>';
    }

    // ================== 内容模型：类型字段绑定 ==================

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

    // ================== 动态字段 HTML ==================

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
        control = '<select class="pet-select"' + attrs + (type === 'multiselect' ? ' multiple size="4"' : '') + ' style="' + base + (readOnly ? ';opacity:.72' : '') + '">' + (type === 'select' ? '<option value="">请选择</option>' : '') + options + '</select>';
      } else if (type === 'boolean') {
        control = '<label style="display:flex;align-items:center;gap:8px;padding:9px 11px;border:1px solid ' + C.border + ';border-radius:8px;background:' + C.inputBg + (readOnly ? ';opacity:.72' : '') + '"><input type="checkbox"' + attrs + (value ? ' checked' : '') + '> <span>是</span></label>';
      } else {
        const htmlType = type === 'number' ? 'number' : type === 'date' ? 'date' : type === 'url' ? 'url' : 'text';
        control = '<input type="' + htmlType + '" class="' + (htmlType === 'date' ? 'pet-date pet-control' : 'pet-control') + '"' + attrs + ' value="' + esc(value == null ? '' : value) + '" placeholder="' + esc(field.placeholder || '') + '"' +
          (type === 'number' ? ' step="any"' : '') +
          (field.minValue != null ? ' min="' + Number(field.minValue) + '"' : '') + (field.maxValue != null ? ' max="' + Number(field.maxValue) + '"' : '') + ' style="' + base + (readOnly ? ';opacity:.72' : '') + '">';
      }
      return '<div style="grid-column:' + (type === 'textarea' || type === 'multiselect' ? '1 / -1' : 'auto') + '"><label for="' + id + '" style="display:block;font-size:13px;font-weight:600;color:' + C.muted + ';margin-bottom:4px">' + esc(field.label || key) + required + '</label>' + control + help + '</div>';
    }

    // ================== 投稿字段区 ==================

    function renderSubmitFieldsHtml(typeId, values) {
      const fields = schemaFieldsForType(typeId).filter(field => (field.key || field.fieldKey) !== 'name');
      return fields.length
        ? fields.map(field => dynamicFieldHtml(field, values && values[field.key || field.fieldKey])).join('')
        : '<div style="grid-column:1/-1;color:' + C.muted + ';font-size:13px;padding:8px 0">该类型暂无其他需填写字段</div>';
    }

    // ================== 我的投稿 ==================

    function mineStatusMeta(status) {
      // 徽章底色用 CSS 变量（index.md 定义），浅色/深色主题分别适配，保证文字可读
      if (status === 'approved') return { label: '✅ 已通过', color: C.success, bg: 'var(--pet-success-bg,#dcfce7)' };
      if (status === 'rejected') return { label: '❌ 已拒绝', color: C.danger, bg: C.dangerBg };
      if (status === 'deleted') return { label: '🗑️ 已删除', color: 'var(--pet-muted-fg,#6b7280)', bg: 'var(--pet-muted-bg,#f3f4f6)' };
      return { label: '⏳ 待审核', color: 'var(--pet-pending-fg,#92400e)', bg: 'var(--pet-pending-bg,#fef3c7)' };
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

    // ================== 我的投稿分页（宠物收集录主题：圆形药丸页码） ==================

    function minePaginationNumbersHtml(minePage, mineTotalPages) {
      const pages = [];
      const push = p => { if (p >= 1 && p <= mineTotalPages && !pages.includes(p)) pages.push(p); };
      push(1); push(mineTotalPages);
      for (let p = minePage - 2; p <= minePage + 2; p++) push(p);
      pages.sort((a, b) => a - b);
      const html = [];
      pages.forEach((p, i) => {
        if (i && p - pages[i - 1] > 1) html.push('<span style="color:' + C.muted + '">…</span>');
        html.push('<button class="pet-pager-num pet-mine-page-btn' + (p === minePage ? ' is-active' : '') + '" data-page="' + p + '" aria-label="第 ' + p + ' 页">' + p + '</button>');
      });
      return html.join('');
    }

    // ================== 我的投稿行 ==================

    function mineRowHtml(s) {
      const meta = mineStatusMeta(s.status);
      const thumb = s.thumbnail || (s.images && s.images[0]) || '';
      const actions = Array.isArray(s.availableActions) ? s.availableActions : [];
      const pendingRevisionCount = Number(s.pendingRevisionCount || 0);
      const hasPendingRevision = pendingRevisionCount > 0;
      const latestRevision = s.latestRevision || null;
      const rejectedRevision = s.status === 'approved' && !hasPendingRevision && latestRevision && latestRevision.status === 'rejected'
        ? latestRevision
        : null;
      const revisionWorkflowBadge = hasPendingRevision && s.status === 'approved'
        ? '<span style="font-size:11px;padding:2px 7px;border-radius:10px;background:' + C.soft + ';color:' + C.primary + ';border:1px solid ' + C.primary + '">📝 修改待审核</span>'
        : (rejectedRevision ? '<span style="font-size:11px;padding:2px 7px;border-radius:10px;background:' + C.dangerBg + ';color:' + C.danger + ';border:1px solid ' + C.danger + '">⚠️ 修改未通过</span>' : '');
      // 完整拒绝原因：若超过单行则列表内截断，悬停标题仍可查看全文。
      const rejectFull = s.status === 'rejected' && s.rejectReason ? s.rejectReason : '';
      return '<div class="pet-mine-row" data-id="' + esc(s.id) + '" style="display:flex;align-items:center;gap:10px;padding:9px 10px;border:1px solid ' + C.border + ';border-radius:10px;background:' + C.soft + ';min-width:0;flex-wrap:wrap">' +
        (thumb ? '<img src="' + esc(resolveImage(thumb)) + '" alt="" loading="lazy" style="width:46px;height:46px;border-radius:8px;object-fit:cover;flex:none">' : '<span style="width:46px;height:46px;border-radius:8px;background:' + C.imgBg + ';display:flex;align-items:center;justify-content:center;font-size:20px;flex:none">' + esc(mineTypeIcon(s)) + '</span>') +
        '<div style="min-width:0;flex:1"><div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap"><strong style="font-size:14px;color:' + C.fgDark + ';white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:260px">' + (s.name ? esc(s.name) : '<span style="color:' + C.muted + '">🐾 未命名宠物</span>') + '</strong><span style="font-size:11px;padding:2px 7px;border-radius:10px;background:' + meta.bg + ';color:' + meta.color + '">' + meta.label + '</span>' + revisionWorkflowBadge +
        '<button class="pet-mine-shortid" title="点击复制投稿 ID：' + esc(s.id) + '" style="font-size:11px;padding:2px 7px;border:1px dashed ' + C.border + ';border-radius:8px;background:' + C.bg + ';color:' + C.muted + ';cursor:pointer">#' + esc(s.shortId || String(s.id).replace(/^pet_/, '')) + '</button></div>' +
        '<div style="font-size:12px;color:' + C.muted + ';margin-top:3px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">' + esc(mineTypeLabel(s)) + ' · 投稿 ' + esc(formatDate(s.createdAt)) + (s.updatedAt && s.updatedAt !== s.createdAt ? ' · 更新 ' + esc(formatDate(s.updatedAt)) : '') +
        (s.reviewAgeMs > 0 ? ' · 已等待 ' + esc(humanizeDuration(s.reviewAgeMs)) : '') + '</div>' +
        (hasPendingRevision ? '<div style="font-size:12px;color:' + C.primary + ';margin-top:3px">📝 ' + pendingRevisionCount + ' 条候选修改正在待审核；图鉴仍显示当前公开版本</div>' : '') +
        (rejectedRevision ? '<div role="alert" style="margin-top:7px;padding:8px 9px;background:' + C.dangerBg + ';border:1px solid ' + C.danger + ';border-radius:7px;color:' + C.danger + ';font-size:12px;line-height:1.55"><strong>⚠️ 修改审核未通过</strong><span style="display:block;margin-top:2px">审核意见：' + esc(rejectedRevision.reviewReason || '管理员未填写具体说明') + '</span><span style="display:block;margin-top:2px">图鉴仍展示当前已通过版本，请按意见修改后重新提交。</span></div>' : '') +
        (rejectFull ? '<div style="font-size:12px;color:' + C.danger + ';margin-top:3px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis" title="' + esc(rejectFull) + '">🚫 ' + esc(rejectFull) + '</div>' : '') +
        ((s.summaryFields && s.summaryFields.length) ? '<div style="font-size:12px;color:' + C.fg + ';margin-top:3px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">' + s.summaryFields.map(f => esc(f.label) + ': ' + (typeof f.value === 'string' ? esc(f.value) : JSON.stringify(f.value))).join(' · ') + '</div>' : '') +
        '</div>' +
        '<div class="pet-mine-row-actions" style="display:flex;gap:5px;flex:none;margin-left:auto;flex-wrap:wrap">' +
        (actions.includes('history') ? '<button class="pet-history-btn" data-id="' + esc(s.id) + '" style="padding:6px 9px;background:' + C.soft + ';color:' + C.fg + ';border:1px solid ' + C.border + ';border-radius:7px;font-size:12px;cursor:pointer">🕘 历史</button>' : '') +
        (!rejectedRevision && (hasPendingRevision || latestRevision) ? '<button class="pet-revisions-btn" data-id="' + esc(s.id) + '" style="padding:6px 9px;background:' + C.soft + ';color:' + C.primary + ';border:1px solid ' + C.border + ';border-radius:7px;font-size:12px;cursor:pointer">📝 ' + (hasPendingRevision ? '查看待审修改' : '查看修改记录') + '</button>' : '') +
        (rejectedRevision && actions.includes('edit') ? '<button class="pet-rejected-revision-edit-btn" data-id="' + esc(s.id) + '" data-revision="' + esc(rejectedRevision.id || '') + '" style="padding:6px 9px;background:' + C.primary + ';color:#fff;border:none;border-radius:7px;font-size:12px;font-weight:600;cursor:pointer">✏️ 按意见重新修改</button>' : '') +
        (rejectedRevision && rejectedRevision.canWithdraw ? '<button class="pet-rejected-revision-withdraw" data-id="' + esc(s.id) + '" data-revision="' + esc(rejectedRevision.id || '') + '" data-row="' + Number(rejectedRevision.rowVersion || 1) + '" style="padding:6px 9px;background:' + C.soft + ';color:' + C.danger + ';border:1px solid ' + C.danger + ';border-radius:7px;font-size:12px;cursor:pointer">撤回修改</button>' : '') +
        (actions.includes('edit') ? '<button class="pet-edit-btn" data-id="' + esc(s.id) + '" data-row="' + (s.rowVersion || 1) + '" style="padding:6px 9px;background:' + C.primary + ';color:#fff;border:none;border-radius:7px;font-size:12px;cursor:pointer">✏️ 编辑</button>' : '') +
        (actions.includes('resubmit') ? '<button class="pet-resubmit-btn" data-id="' + esc(s.id) + '" data-row="' + (s.rowVersion || 1) + '" style="padding:6px 9px;background:' + C.primary + ';color:#fff;border:none;border-radius:7px;font-size:12px;cursor:pointer">🔁 重新提交审核</button>' : '') +
        (actions.includes('delete') ? '<button class="pet-del-btn" data-id="' + esc(s.id) + '" data-row="' + (s.rowVersion || 1) + '" style="padding:6px 9px;background:' + C.dangerBg + ';color:' + C.danger + ';border:1px solid ' + C.dangerBg + ';border-radius:7px;font-size:12px;cursor:pointer">🗑️ 删除</button>' : '') +
        '</div></div>';
    }

    // ================== 我的投稿卡片（对标图鉴宠物卡片：手机端一行两个） ==================

    function mineCardHtml(s) {
      const meta = mineStatusMeta(s.status);
      const thumb = s.thumbnail || (s.images && s.images[0]) || '';
      const actions = Array.isArray(s.availableActions) ? s.availableActions : [];
      const pendingRevisionCount = Number(s.pendingRevisionCount || 0);
      const hasPendingRevision = pendingRevisionCount > 0;
      const latestRevision = s.latestRevision || null;
      const rejectedRevision = s.status === 'approved' && !hasPendingRevision && latestRevision && latestRevision.status === 'rejected'
        ? latestRevision
        : null;
      const revisionWorkflowBadge = hasPendingRevision && s.status === 'approved'
        ? '<span style="font-size:10px;padding:1px 6px;border-radius:9px;background:' + C.soft + ';color:' + C.primary + ';border:1px solid ' + C.primary + '">📝 修改待审核</span>'
        : (rejectedRevision ? '<span style="font-size:10px;padding:1px 6px;border-radius:9px;background:' + C.dangerBg + ';color:' + C.danger + ';border:1px solid ' + C.danger + '">⚠️ 修改未通过</span>' : '');
      const rejectFull = s.status === 'rejected' && s.rejectReason ? s.rejectReason : '';
      const shortIdBtn = '<button class="pet-mine-shortid" title="点击复制投稿 ID：' + esc(s.id) + '" style="font-size:10px;padding:1px 6px;border:1px dashed ' + C.border + ';border-radius:7px;background:' + C.bg + ';color:' + C.muted + ';cursor:pointer;flex:none">#' + esc(s.shortId || String(s.id).replace(/^pet_/, '')) + '</button>';

      const actionBtn = (cls, id, extra, label, variant) => {
        const base = variant === 'primary'
          ? 'background:' + C.primary + ';color:#fff;border:none;font-weight:600'
          : (variant === 'danger' ? 'background:' + C.dangerBg + ';color:' + C.danger + ';border:1px solid ' + C.dangerBg : 'background:' + C.soft + ';color:' + C.fg + ';border:1px solid ' + C.border);
        return '<button class="' + cls + '" data-id="' + esc(id) + '"' + (extra ? ' ' + extra : '') + ' style="width:100%;min-height:26px;padding:3px 6px;border-radius:7px;font-size:11px;cursor:pointer;' + base + '">' + label + '</button>';
      };
      const btnRows = [];
      if (actions.includes('history')) btnRows.push(actionBtn('pet-history-btn', s.id, '', '🕘 历史'));
      if (!rejectedRevision && (hasPendingRevision || latestRevision)) btnRows.push(actionBtn('pet-revisions-btn', s.id, '', '📝 ' + (hasPendingRevision ? '待审修改' : '修改记录'), 'primary'));
      if (rejectedRevision && actions.includes('edit')) btnRows.push(actionBtn('pet-rejected-revision-edit-btn', s.id, 'data-revision="' + esc(rejectedRevision.id || '') + '"', '✏️ 重新修改', 'primary'));
      if (rejectedRevision && rejectedRevision.canWithdraw) btnRows.push(actionBtn('pet-rejected-revision-withdraw', s.id, 'data-revision="' + esc(rejectedRevision.id || '') + '" data-row="' + Number(rejectedRevision.rowVersion || 1) + '"', '撤回修改', 'danger'));
      if (actions.includes('edit')) btnRows.push(actionBtn('pet-edit-btn', s.id, 'data-row="' + (s.rowVersion || 1) + '"', '✏️ 编辑', 'primary'));
      if (actions.includes('resubmit')) btnRows.push(actionBtn('pet-resubmit-btn', s.id, 'data-row="' + (s.rowVersion || 1) + '"', '🔁 重新提交', 'primary'));
      if (actions.includes('delete')) btnRows.push(actionBtn('pet-del-btn', s.id, 'data-row="' + (s.rowVersion || 1) + '"', '🗑️ 删除', 'danger'));
      // 若只有单个操作按钮，让它占满整行更易点按
      const actionsHtml = btnRows.length
        ? '<div class="pet-mine-row-actions" style="margin-top:auto;padding-top:7px;display:grid;grid-template-columns:repeat(' + Math.min(btnRows.length, 2) + ',minmax(0,1fr));gap:5px">' + btnRows.join('') + '</div>'
        : '';

      const summaryHtml = (s.summaryFields && s.summaryFields.length)
        ? '<div style="font-size:11px;color:' + C.fg + ';margin-top:3px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">' + s.summaryFields.map(f => esc(f.label) + ': ' + (typeof f.value === 'string' ? esc(f.value) : JSON.stringify(f.value))).join(' · ') + '</div>'
        : '';
      const timeText = esc(mineTypeLabel(s)) + ' · 投稿 ' + esc(formatDate(s.createdAt)) + (s.updatedAt && s.updatedAt !== s.createdAt ? ' · 更新 ' + esc(formatDate(s.updatedAt)) : '') +
        (s.reviewAgeMs > 0 ? ' · 已等待 ' + esc(humanizeDuration(s.reviewAgeMs)) : '');

      // 注意：不要加 pet-card class —— 图鉴的 $all('.pet-card') 会给它绑定 openDetail，
      // 导致点操作按钮冒泡弹出详情。mine-card 仅用于我的投稿列表。
      return '<div class="pet-mine-card" data-id="' + esc(s.id) + '" style="background:' + C.bg + ';border:1px solid ' + C.border + ';border-radius:12px;overflow:hidden;display:flex;flex-direction:column;min-width:0">' +
        '<div style="width:100%;height:var(--pet-card-img-h,110px);background:' + C.imgBg + ';position:relative;flex:none">' +
        (thumb
          ? '<img src="' + esc(resolveImage(thumb)) + '" alt="' + esc(s.name || '') + '" loading="lazy" style="width:100%;height:100%;object-fit:cover" onerror="this.outerHTML=\'<div style=\'width:100%;height:100%;display:flex;align-items:center;justify-content:center;font-size:var(--pet-card-emoji,28px)\'>' + esc(mineTypeIcon(s)) + '</div>\'">'
          : '<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;font-size:var(--pet-card-emoji,28px)">' + esc(mineTypeIcon(s)) + '</div>') +
        '<span style="position:absolute;top:6px;left:6px;font-size:10px;padding:1px 7px;border-radius:9px;background:' + meta.bg + ';color:' + meta.color + ';border:1px solid ' + C.border + '">' + meta.label + '</span>' +
        '</div>' +
        '<div style="padding:var(--pet-card-pad,9px 10px);flex:1;display:flex;flex-direction:column;gap:1px;min-width:0">' +
        '<div style="display:flex;align-items:center;gap:4px;min-width:0">' +
        '<strong style="font-size:var(--pet-card-title,14px);font-weight:600;color:' + C.fgDark + ';white-space:nowrap;overflow:hidden;text-overflow:ellipsis;flex:1;min-width:0">' + (s.name ? esc(s.name) : '<span style="color:' + C.muted + ';font-weight:500">🐾 未命名宠物</span>') + '</strong>' +
        revisionWorkflowBadge +
        shortIdBtn +
        '</div>' +
        '<div style="font-size:11px;color:' + C.muted + ';margin-top:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">' + timeText + '</div>' +
        (hasPendingRevision ? '<div style="font-size:11px;color:' + C.primary + ';margin-top:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">📝 ' + pendingRevisionCount + ' 条修改待审核</div>' : '') +
        (rejectedRevision ? '<div style="margin-top:4px;padding:6px 7px;background:' + C.dangerBg + ';border:1px solid ' + C.danger + ';border-radius:7px;color:' + C.danger + ';font-size:11px;line-height:1.5">⚠️ 审核未通过：' + esc(rejectedRevision.reviewReason || '管理员未填写具体说明') + '</div>' : '') +
        (rejectFull ? '<div style="font-size:11px;color:' + C.danger + ';margin-top:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis" title="' + esc(rejectFull) + '">🚫 ' + esc(rejectFull) + '</div>' : '') +
        summaryHtml +
        actionsHtml +
        '</div>' +
        '</div>';
    }

    // ================== 我的投稿：纯查看详情 ==================

    function mineDetailHtml(sub) {
      const typeName = sub.type && sub.type.name ? sub.type.name : (sub.category || '未分类');
      const meta = mineStatusMeta(sub.status);
      const rows = [];
      const defs = Array.isArray(sub.fieldDefinitions) && sub.fieldDefinitions.length ? sub.fieldDefinitions : [];
      const values = Object.assign({}, sub.dynamicFields && typeof sub.dynamicFields === 'object' ? sub.dynamicFields : {});
      const definitionsByKey = new Map();
      const renderedDynamicKeys = new Set();
      defs.forEach(field => {
        const key = field.key || field.fieldKey;
        if (key && !definitionsByKey.has(key)) definitionsByKey.set(key, field);
      });
      const pushRow = (label, emoji, value) => {
        // 字段未填写时隐藏整行，不用“暂未记录”占位；用户填写后再展示
        if (value === null || value === undefined || value === '') return;
        const legacyKeys = { '发现地点': 'location', '外貌特征': 'appearance', '性格特点': 'personality', '描述 / 留言': 'description' };
        const legacyKey = legacyKeys[label];
        // Dynamic definitions are authoritative when a migrated field is also stored in a legacy column.
        if (legacyKey && definitionsByKey.has(legacyKey) && values[legacyKey] !== undefined && values[legacyKey] !== '') return;
        rows.push('<div style="display:flex;gap:10px;padding:10px 14px;background:' + C.soft + ';border-radius:10px;align-items:flex-start">' +
          '<span style="font-size:15px;line-height:1.5">' + esc(emoji) + '</span>' +
          '<div style="min-width:0;flex:1"><div style="font-size:12px;color:' + C.muted + ';margin-bottom:2px">' + esc(label) + '</div>' +
          '<div style="font-size:13px;line-height:1.6;color:' + C.fg + ';word-break:break-word;white-space:pre-wrap">' +
          esc(value) + '</div></div></div>');
      };
      pushRow('类型', mineTypeIcon(sub), typeName);
      pushRow('发现地点', '📍', sub.location || '');
      pushRow('外貌特征', '🐾', sub.appearance || '');
      pushRow('性格特点', '💬', sub.personality || '');
      pushRow('描述 / 留言', '📝', sub.description || '');
      if (sub.status === 'rejected' && sub.rejectReason) pushRow('拒绝原因', '🚫', sub.rejectReason);
      // 动态字段（与编辑弹窗一致的字段定义）
      defs.forEach(field => {
        const key = field.key || field.fieldKey;
        if (!key || key === 'name' || renderedDynamicKeys.has(key)) return;
        if (values[key] === undefined || values[key] === '') return;
        renderedDynamicKeys.add(key);
        pushRow(field.label || key, fieldIcon(field), typeof values[key] === 'string' ? values[key] : JSON.stringify(values[key]));
      });

      const displayImages = Array.isArray(sub.displayImages) ? sub.displayImages : sub.images;
      const imagesHtml = (displayImages && displayImages.length)
        ? '<div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:14px">' + displayImages.map(img => {
            const url = typeof img === 'string' ? img : (img.url || '');
            return url ? '<img src="' + esc(resolveImage(url)) + '" alt="" loading="lazy" style="width:72px;height:72px;object-fit:cover;border-radius:8px">' : '';
          }).join('') + '</div>'
        : '';

      return '<div class="pet-scroll" style="background:' + C.bg + ';border-radius:16px;max-width:560px;width:100%;padding:24px;position:relative;max-height:90vh;overflow-y:auto">' +
        '<button id="pet-detail-close" style="position:absolute;top:12px;right:16px;background:none;border:none;font-size:24px;cursor:pointer;color:' + C.muted + '">✕</button>' +
        '<h2 style="margin:0 0 4px;font-size:19px;color:' + C.fgDark + '">👁️ 投稿详情</h2>' +
        '<div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;font-size:12px;color:' + C.muted + ';margin-bottom:6px">' +
          '<span style="padding:2px 8px;border-radius:10px;background:' + meta.bg + ';color:' + meta.color + '">' + meta.label + '</span>' +
          (sub.shortId || sub.id ? '<span style="font-size:11px;padding:2px 8px;border:1px dashed ' + C.border + ';border-radius:8px;color:' + C.muted + '">#' + esc(sub.shortId || String(sub.id).replace(/^pet_/, '')) + '</span>' : '') +
        '</div>' +
        '<div style="font-size:13px;color:' + C.fg + ';margin-bottom:14px">' + (sub.name ? esc(sub.name) : '未命名宠物') + ' · ' + esc(typeName) + '</div>' +
        '<div style="display:flex;flex-direction:column;gap:8px;margin-bottom:14px">' + rows.join('') + '</div>' +
        imagesHtml +
        '<div style="font-size:12px;color:' + C.faint + '">投稿于 ' + esc(formatDate(sub.createdAt)) + (sub.updatedAt && sub.updatedAt !== sub.createdAt ? ' · 更新于 ' + esc(formatDate(sub.updatedAt)) : '') + '</div>' +
        '</div>';
    }

    // ================== 我的投稿：历史弹窗 ==================

    function mineHistoryHtml(history) {
      return history.length
        ? '<div style="display:flex;flex-direction:column;gap:0">' + history.map((h, i) =>
            '<div style="display:flex;gap:12px;position:relative;padding:0 0 16px">' +
            (i < history.length - 1 ? '<span style="position:absolute;left:7px;top:18px;bottom:0;width:2px;background:' + C.border + '"></span>' : '') +
            '<span style="width:16px;height:16px;border-radius:50%;background:' + C.primary + ';flex:none;margin-top:2px;z-index:1"></span>' +
            '<div style="min-width:0;flex:1"><div style="font-size:13px;color:' + C.fgDark + ';font-weight:600">' + esc(h.label) + '</div>' +
            (h.detail ? '<div style="font-size:12px;color:' + C.muted + ';margin-top:2px;word-break:break-word">' + esc(h.detail) + '</div>' : '') +
            '<div style="font-size:11px;color:' + C.faint + ';margin-top:2px">' + esc(formatDateTime(h.createdAt)) + (h.actor ? ' · ' + esc(h.actor) : '') + '</div></div></div>'
          ).join('') + '</div>'
        : '<p style="color:' + C.muted + ';text-align:center;padding:18px 0">暂无历史记录</p>';
    }

    // ================== 我的投稿：公开修订 ==================

    function revisionValue(value) {
      if (value === null || value === undefined || value === '') return '未填写';
      return typeof value === 'string' ? value : JSON.stringify(value);
    }

    function mineRevisionsHtml(revisions, id) {
      const labels = { pending: '待审核', approved: '已公开', rejected: '已拒绝', withdrawn: '已撤回', superseded: '已过期' };
      const colors = { pending: C.primary, approved: C.success, rejected: C.danger, withdrawn: C.muted, superseded: C.muted };
      const cards = revisions.map(revision => {
        const diff = revision.diff || {};
        const changes = [].concat(diff.changes || [], diff.fieldChanges || []).slice(0, 12);
        const changeHtml = changes.length
          ? '<div style="display:flex;flex-direction:column;gap:4px;margin-top:8px">' + changes.map(change =>
              '<div style="font-size:12px;color:' + C.fg + ';word-break:break-word"><strong>' + esc(change.key) + '</strong>：' + esc(revisionValue(change.from)) + ' → ' + esc(revisionValue(change.to)) + '</div>'
            ).join('') + (diff.imagesChanged ? '<div style="font-size:12px;color:' + C.fg + '">图片顺序或内容已修改</div>' : '') + '</div>'
          : (diff.imagesChanged ? '<div style="font-size:12px;color:' + C.fg + ';margin-top:8px">图片顺序或内容已修改</div>' : '<div style="font-size:12px;color:' + C.muted + ';margin-top:8px">没有可展示的字段差异</div>');
        return '<div style="padding:11px 12px;border:1px solid ' + C.border + ';border-radius:9px;background:' + C.soft + '">' +
          '<div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap"><strong style="font-size:13px;color:' + C.fgDark + '">' + esc(labels[revision.status] || revision.status) + '</strong>' +
          '<span style="font-size:11px;color:' + (colors[revision.status] || C.muted) + '">提交于 ' + esc(formatDateTime(revision.createdAt)) + '</span>' +
          (revision.source === 'admin' ? '<span style="font-size:11px;color:' + C.muted + '">管理员修订</span>' : '') + '</div>' +
          changeHtml +
          (revision.reviewReason ? '<div style="font-size:12px;color:' + (revision.status === 'rejected' ? C.danger : C.muted) + ';margin-top:8px">审核说明：' + esc(revision.reviewReason) + '</div>' : '') +
          (revision.canWithdraw ? '<div style="margin-top:9px"><button class="pet-revision-withdraw" data-submission="' + esc(id) + '" data-id="' + esc(revision.id) + '" data-row="' + Number(revision.rowVersion || 1) + '" data-status="' + esc(revision.status) + '" style="padding:6px 9px;background:' + C.soft + ';color:' + C.danger + ';border:1px solid ' + C.border + ';border-radius:7px;font-size:12px;cursor:pointer">撤回修改</button></div>' : '') +
        '</div>';
      }).join('') || '<p style="color:' + C.muted + ';text-align:center;padding:18px 0">暂无公开修订记录</p>';
      return '<div style="display:flex;flex-direction:column;gap:9px">' + cards + '</div>';
    }

    return {
      paginationNumbersHtml,
      pageSizeSelectHtml,
      petCardHtml,
      galleryHtml,
      likedPetsHtml,
      detailModalHtml,
      schemaFieldsForType,
      dynamicFieldHtml,
      renderSubmitFieldsHtml,
      mineStatusMeta,
      mineTypeLabel,
      mineTypeIcon,
      minePaginationNumbersHtml,
      mineRowHtml,
      mineCardHtml,
      mineHistoryHtml,
      revisionValue,
      mineRevisionsHtml,
    };
  }

  return { createPetViews };
}));
