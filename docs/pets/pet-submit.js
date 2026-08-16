/*
 * 宠物前端「投稿表单」交互控制器。
 * 收敛投稿模态框的草稿自动保存 / 恢复 / 丢弃、类型选择、图片压缩预览、
 * 幂等提交与失败重试的全部交互状态，通过 createPetSubmit(deps) 注入依赖：
 *   - DOM 查询（$/ $all / document）、主题 C、转义 esc
 *   - 渲染层工厂 views()（动态字段 HTML 由 pet-views.js 提供）
 *   - API 客户端（api）、toast、弹窗控制器
 *   - 辅助：updateAuthUI / renderSubmitFields / readDynamicFields / fileToWebP /
 *     assertImageWithinLimit / imageLimitLabel（仍由 pets.js 提供并注入）
 *   - 回调：onSubmitted（提交成功后刷新公开列表）
 *   - 可变状态 getter：getUser / getSiteConfig / getContentSchema /
 *     getContentSchemaReady / getSubmissionTypes / getMaxImagesLimit / getCatEmoji
 * 状态（本地草稿、submitTypeId、submitIdempotencyKey 等）全部内聚于此；
 * pets.js 只保留实例化与委托调用。
 * 草稿为浏览器本地（localStorage，含压缩后的图片 dataURL），无草稿时不提示。
 */
(function (root, factory) {
  const submit = factory();
  if (typeof module === 'object' && module.exports) module.exports = submit;
  if (root) root.UJNGuidePetSubmit = submit;
}(typeof window !== 'undefined' ? window : globalThis, function () {
  'use strict';

  function createPetSubmit(deps) {
    const {
      $, $all, document,
      C, esc,
      views,
      api,
      showToast,
      openPetModal, closePetModal,
      updateAuthUI,
      renderSubmitFields, readDynamicFields,
      fileToWebP, assertImageWithinLimit,
      imageLimitLabel,
      petCache,
      onSubmitted,
      getUser,
      getSiteConfig,
      getContentSchema,
      getContentSchemaReady,
      getSubmissionTypes,
      getMaxImagesLimit,
      getCatEmoji,
    } = deps;

    function openSubmitModal() {
      const siteConfig = getSiteConfig();
      const contentSchema = getContentSchema();
      const contentSchemaReady = getContentSchemaReady();
      const SUBMISSION_TYPES = getSubmissionTypes();
      const maxImagesLimit = getMaxImagesLimit();
      const catEmoji = getCatEmoji();
      const user = getUser();
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

      // ===== 投稿草稿：浏览器本地自动保存 + 恢复（localStorage，含压缩后的图片 dataURL） =====
      // 原 P1-06 服务端草稿（/api/my/drafts）改为本地草稿：草稿与浏览器绑定、包含图片，
      // 避免跨设备出现「提示有草稿却无图片」；无本地草稿时不提示、不打扰。
      let draftTimer = null;
      const DRAFT_SAVE_DELAY = 800;
      const draftStorage = (() => {
        try {
          const s = typeof localStorage !== 'undefined' ? localStorage : null;
          if (s) { s.setItem('__ujn_draft_probe__', '1'); s.removeItem('__ujn_draft_probe__'); }
          return s;
        } catch (_) { return null; }
      })();
      const draftKey = () => 'ujn:pet-submit:draft' + (user && (user.userId || user.id) ? ':' + (user.userId || user.id) : '');
      const buildDraftPayload = () => {
        const fields = readDynamicFields($('#pet-dynamic-fields'));
        const nameEl = $('#pet-name');
        if (nameEl) fields.name = nameEl.value.trim();
        return {
          savedAt: new Date().toISOString(),
          schemaVersion: contentSchema.schemaVersion || siteConfig.schemaVersion,
          typeId: submitTypeId || undefined,
          typeCode: submitTypeCode || undefined,
          category: submitCategory || undefined,
          fields,
          images: uploadedImages.slice(),
        };
      };
      const hasDraftContent = (payload) => {
        if (payload.category || payload.typeId || (payload.images && payload.images.length)) return true;
        return Object.values(payload.fields || {}).some(v => String(v || '').trim() !== '');
      };
      const saveDraft = () => {
        if (!user || !draftStorage) return;
        const payload = buildDraftPayload();
        if (!hasDraftContent(payload)) { draftStorage.removeItem(draftKey()); return; }
        try {
          draftStorage.setItem(draftKey(), JSON.stringify(payload));
        } catch (e) {
          // 浏览器存储配额超限：降级为仅保存文本与字段（图片不落盘），恢复时明确提示
          if (e && (e.name === 'QuotaExceededError' || e.code === 22)) {
            payload.images = [];
            payload.imagesTruncated = true;
            try { draftStorage.setItem(draftKey(), JSON.stringify(payload)); } catch (_) { /* 文本都存不下则放弃草稿 */ }
          }
        }
      };
      const scheduleDraftSave = () => {
        clearTimeout(draftTimer);
        draftTimer = setTimeout(saveDraft, DRAFT_SAVE_DELAY);
      };
      const discardDraft = () => {
        if (draftStorage) draftStorage.removeItem(draftKey());
      };
      function closeWithDraftSave() {
        clearTimeout(draftTimer);
        saveDraft(); // 关闭时立即保存当前内容
        closeSubmitModal();
      }
      const restoreLatestDraft = () => {
        if (!user || !draftStorage) return;
        let p = null;
        try { p = JSON.parse(draftStorage.getItem(draftKey()) || 'null'); } catch (_) { p = null; }
        if (!p || !hasDraftContent({ category: p.category, typeId: p.typeId, fields: p.fields || {}, images: p.images || [] })) return;
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
        if (Array.isArray(p.images) && p.images.length) {
          uploadedImages.push.apply(uploadedImages, p.images);
          renderImagePreviews();
        }
        const cnt = $('#pet-image-count');
        if (cnt && uploadedImages.length) cnt.textContent = '已恢复 ' + uploadedImages.length + ' 张照片';
        showToast(p.imagesTruncated
          ? '💾 已恢复上次草稿（图片因浏览器存储空间不足未保存）'
          : '💾 已恢复上次未完成的投稿草稿（含 ' + uploadedImages.length + ' 张照片）');
      };

      // 输入变化 → 防抖自动保存
      const nameEl = $('#pet-name');
      if (nameEl) nameEl.addEventListener('input', scheduleDraftSave);
      const dynRoot = $('#pet-dynamic-fields');
      if (dynRoot) dynRoot.addEventListener('input', scheduleDraftSave);

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

      // 图片压缩预览（change 事件清空重选；草稿恢复复用同一渲染）
      const imgInput = $('#pet-images');
      const previews = $('#pet-image-previews');
      const imageCount = $('#pet-image-count');
      const uploadedImages = [];
      const renderImagePreviews = () => {
        previews.innerHTML = '';
        uploadedImages.forEach((dataUrl) => {
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
              scheduleDraftSave(); // 图片删除也计入草稿
            }
          };
          previews.appendChild(div);
        });
        imageCount.textContent = uploadedImages.length ? '已选 ' + uploadedImages.length + ' 张' : '';
      };
      imgInput.addEventListener('change', async function () {
        const files = Array.from(this.files).slice(0, maxImagesLimit);
        uploadedImages.length = 0;
        for (const file of files) {
          try {
            const dataUrl = await fileToWebP(file);
            assertImageWithinLimit(dataUrl);
            uploadedImages.push(dataUrl);
          } catch (e) { showToast(e && e.message ? e.message : '图片压缩失败，请更换图片后重试', true); }
        }
        renderImagePreviews();
        scheduleDraftSave(); // 图片变化计入草稿
      });
      // 打开弹窗后恢复本地草稿（无草稿时不提示）
      restoreLatestDraft();

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
          await onSubmitted();
        } else {
          this.disabled = false;
          this.textContent = '📤 提交投稿';
          // 幂等命中（重复提交）也视为成功：不提示错误
          if (r.data && r.data.idempotent) {
            showToast(r.data.message || '✅ 该投稿已提交！');
            discardDraft();
            closeSubmitModal();
            petCache.clear();
            await onSubmitted();
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

    return { openSubmitModal, closeSubmitModal };
  }

  return { createPetSubmit };
}));
