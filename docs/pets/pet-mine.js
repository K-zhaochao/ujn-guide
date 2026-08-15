/*
 * 宠物前端「我的投稿」交互控制器。
 * 收敛“我的投稿”页签的加载 / 筛选 / 分页 / 行操作 / 详情 / 历史 / 修订的全部交互状态，
 * 通过 createPetMine(deps) 注入依赖：
 *   - DOM 查询（$/ $all / document）
 *   - 渲染层工厂 views()（HTML 生成由 pet-views.js 提供）
 *   - 查询参数构建 buildMineListQuery（pet-view-model.js）
 *   - API 客户端（api / apiSubmissionAction）、toast、弹窗控制器
 *   - 回调：onLoginRequired / onEdit / onListChanged
 *   - 可变状态 getter：getUser / getSiteConfig / getCategories / getCatEmoji
 * 状态（minePage 等）全部内聚于此；pets.js 只保留实例化与委托调用。
 */
(function (root, factory) {
  const mine = factory();
  if (typeof module === 'object' && module.exports) module.exports = mine;
  if (root) root.UJNGuidePetMine = mine;
}(typeof window !== 'undefined' ? window : globalThis, function () {
  'use strict';

  function createPetMine(deps) {
    const {
      $, $all, document,
      C, esc,
      views,
      buildMineListQuery,
      api, apiSubmissionAction,
      showToast,
      openPetModal, closePetModal,
      confirmAction = async () => false,
      onLoginRequired,
      onEdit,
      onListChanged,
      petCache,
      fallbackCopy,
      getUser,
      getSiteConfig,
      getCategories,
      getCatEmoji,
      MINE_PAGE_SIZE = 12,
      picker = null, // 可选：自定义下拉 / 日历面板（pet-picker.js），未注入时保留原生控件
    } = deps;

    // ================== 状态 ==================
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

    // 状态徽章 / 类型标签 / 类型图标 / 分页数字由 pet-views.js 提供：
    //   views().mineStatusMeta(status)
    //   views().mineTypeLabel(submission)
    //   views().mineTypeIcon(submission)
    //   views().minePaginationNumbersHtml(minePage, mineTotalPages)

    function minePaginationNumbers() { return views().minePaginationNumbersHtml(minePage, mineTotalPages); }

    // 每页数量响应式：手机（<768px）6 个/页，电脑 12 个/页；测试可注入 MINE_PAGE_SIZE 覆盖桌面值
    function currentMinePageSize() {
      const mobile = typeof window !== 'undefined' && window.innerWidth < 768;
      return mobile ? 6 : MINE_PAGE_SIZE;
    }

    function mineQueryParams() {
      return new URLSearchParams(buildMineListQuery({
        query: mineQuery, status: mineStatus, category: mineCategory, start: mineDate, end: mineDateEnd,
        sort: mineSort, page: minePage, pageSize: currentMinePageSize(),
      }));
    }

    function renderMineShell(sec) {
      if (sec.dataset.mineShell === '1') return;
      const catEmoji = getCatEmoji();
      const CATEGORIES = getCategories();
      const categoryOptions = '<option value="">全部类型</option>' + CATEGORIES.map(c => '<option value="' + esc(c.key) + '">' + (catEmoji[c.key] || '🐾') + ' ' + esc(c.key) + '</option>').join('');
      sec.dataset.mineShell = '1';
      sec.innerHTML =
        '<div class="pet-mine-shell">' +
        '<div id="pet-mine-status-counts" style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:10px"></div>' +
        '<div id="pet-mine-filters" style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:12px">' +
        '<input id="pet-mine-search" type="search" enterkeyhint="search" placeholder="🔎 搜索名称、地点、描述或 ID，回车或失焦后生效" aria-label="搜索我的投稿" style="flex:1;min-width:190px;padding:9px 11px;border:1px solid ' + C.border + ';border-radius:8px;background:' + C.inputBg + ';color:inherit;font-size:13px;outline:none">' +
        '<select id="pet-mine-category" class="pet-select" style="padding:8px 10px;border:1px solid ' + C.border + ';border-radius:8px;background:' + C.inputBg + ';color:inherit;font-size:13px">' + categoryOptions + '</select>' +
        '<div class="pet-mine-date-range"><label for="pet-mine-date">起始日期<input id="pet-mine-date" class="pet-date" type="date" aria-label="投稿起始日期" style="padding:8px 9px;border:1px solid ' + C.border + ';border-radius:8px;background:' + C.inputBg + ';color:inherit;font-size:13px"></label><label for="pet-mine-date-end">结束日期<input id="pet-mine-date-end" class="pet-date" type="date" aria-label="投稿结束日期" style="padding:8px 9px;border:1px solid ' + C.border + ';border-radius:8px;background:' + C.inputBg + ';color:inherit;font-size:13px"></label></div>' +
        '<select id="pet-mine-sort" class="pet-select" style="padding:8px 10px;border:1px solid ' + C.border + ';border-radius:8px;background:' + C.inputBg + ';color:inherit;font-size:13px"><option value="updated">最近修改</option><option value="latest">最新投稿</option><option value="oldest">最早投稿</option><option value="name">名称</option><option value="status">状态</option></select>' +
        '<button id="pet-mine-reset" title="一键重置所有筛选" style="padding:8px 12px;background:' + C.soft + ';border:1px solid ' + C.border + ';border-radius:8px;color:' + C.fg + ';font-size:13px;cursor:pointer">↺ 重置</button>' +
        '</div>' +
        '<div id="pet-mine-list" aria-live="polite"></div>' +
        '<div id="pet-mine-pager" style="display:flex;align-items:center;justify-content:center;gap:6px;flex-wrap:wrap;margin-top:14px"></div>' +
        '</div>';

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
      // 自定义可爱风下拉 / 日历面板（pet-picker.js）：仅接管鼠标/触控点击，键盘仍走原生，
      // 选中后同步原生元素 value 并派发 change，上面的 onchange 逻辑保持不变。
      if (picker && typeof picker.attachSelect === 'function') {
        picker.attachSelect($('#pet-mine-category'));
        picker.attachSelect($('#pet-mine-sort'));
        if (typeof picker.attachDate === 'function') {
          picker.attachDate($('#pet-mine-date'));
          picker.attachDate($('#pet-mine-date-end'));
        }
      }
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
      const siteConfig = getSiteConfig();
      const counts = data.statusCounts || {};
      const allStatusCount = ['pending', 'approved', 'rejected'].reduce((sum, key) => sum + Number(counts[key] || 0), 0) || mineTotal;
      const countLabels = [
        ['', '全部', allStatusCount],
        ['pending', '待审核', counts.pending || 0],
        ['approved', '已通过', counts.approved || 0],
        ['rejected', '已拒绝', counts.rejected || 0],
        ['deleted', '已删除', counts.deleted || 0],
      ];
      const countBox = $('#pet-mine-status-counts');
      if (countBox) countBox.innerHTML = countLabels.filter(c => c[0] !== 'deleted').map(c =>
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
        list.innerHTML = '<p style="color:' + C.muted + ';text-align:center;padding:28px 12px">' + (mineQuery || mineStatus || mineCategory || mineDate || mineDateEnd ? '没有符合筛选条件的投稿' : '你还没有投稿过，点击“投稿”开始吧！🐾') + '</p>';
      } else {
        // 卡片 HTML 由渲染层（pet-views.js）生成；复用图鉴 pet-grid：桌面 4 列 → 窄屏 2 列
        list.innerHTML = '<div class="pet-grid" style="display:grid;grid-template-columns:repeat(4,1fr);gap:14px">' + items.map(s => views().mineCardHtml(s)).join('') + '</div>';
      }

      const pager = $('#pet-mine-pager');
      if (pager) {
        // 分页条始终显示（有数据时），即使只有一页也展示 上一页/数字/下一页 与页码统计
        pager.innerHTML = mineTotal > 0
          ? '<button class="pet-mine-page-btn" data-page="' + (minePage - 1) + '" ' + (minePage <= 1 ? 'disabled' : '') + ' style="padding:6px 10px;border:1px solid ' + C.border + ';border-radius:7px;background:' + C.bg + ';color:' + C.fg + ';cursor:pointer">上一页</button>' + minePaginationNumbers() + '<button class="pet-mine-page-btn" data-page="' + (minePage + 1) + '" ' + (minePage >= mineTotalPages ? 'disabled' : '') + ' style="padding:6px 10px;border:1px solid ' + C.border + ';border-radius:7px;background:' + C.bg + ';color:' + C.fg + ';cursor:pointer">下一页</button><span style="font-size:12px;color:' + C.muted + ';margin-left:6px">共 ' + mineTotal + ' 条 · 第 ' + minePage + '/' + mineTotalPages + ' 页</span>'
          : '<span style="font-size:12px;color:' + C.muted + '">共 0 条</span>';
        $all('.pet-mine-page-btn', pager).forEach(btn => {
          btn.onclick = () => {
            if (btn.disabled) return;
            const p = Number(btn.dataset.page);
            if (p < 1 || p > mineTotalPages || p === minePage) return;
            minePage = p;
            void loadMineSubmissions().then(() => {
              // 滚动到我的投稿列表顶部（第一个作品位置），而不是页面最顶部
              const listEl = $('#pet-mine-list');
              if (listEl && typeof listEl.scrollIntoView === 'function') {
                listEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
              }
            });
          };
        });
      }

      $all('.pet-edit-btn', sec).forEach(btn => { btn.onclick = (e) => { if (e) e.stopPropagation(); onEdit(btn.dataset.id); }; });
      $all('.pet-rejected-revision-edit-btn', sec).forEach(btn => {
        btn.onclick = (e) => { if (e) e.stopPropagation(); onEdit(btn.dataset.id, { revisionId: btn.dataset.revision }); };
      });
      $all('.pet-mine-shortid', sec).forEach(btn => {
        btn.onclick = (e) => {
          e.stopPropagation();
          const fullId = btn.title.replace(/^点击复制投稿 ID：/, '').trim();
          if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(fullId).then(() => showToast('✅ 已复制投稿 ID：' + fullId)).catch(() => fallbackCopy(fullId, btn));
          } else fallbackCopy(fullId, btn);
        };
      });
      $all('.pet-history-btn', sec).forEach(btn => { btn.onclick = (e) => { if (e) e.stopPropagation(); openMineHistory(btn.dataset.id); }; });
      $all('.pet-revisions-btn', sec).forEach(btn => { btn.onclick = (e) => { if (e) e.stopPropagation(); openMineRevisions(btn.dataset.id); }; });
      $all('.pet-rejected-revision-withdraw', sec).forEach(btn => {
        btn.onclick = (e) => {
          if (e) e.stopPropagation();
          withdrawRevision({
            submissionId: btn.dataset.id,
            revisionId: btn.dataset.revision,
            rowVersion: Number(btn.dataset.row || 1),
            status: 'rejected',
          });
        };
      });
      $all('.pet-resubmit-btn', sec).forEach(btn => {
        btn.onclick = async (e) => {
          if (e) e.stopPropagation();
          if (siteConfig.maintenance) { showToast('⚠️ 宠物收集录正在维护中，请稍后再试', true); return; }
          const confirmed = await confirmAction({
            title: '重新提交审核？',
            message: '该投稿会重新进入待审核队列，审核通过前不会出现在图鉴中。',
            confirmText: '重新提交',
          });
          if (!confirmed) return;
          const r = await apiSubmissionAction('POST', '/api/submissions/' + encodeURIComponent(btn.dataset.id) + '/resubmit', { rowVersion: Number(btn.dataset.row || 1), _id: btn.dataset.id });
          showToast(r.data.message || (r.ok ? '已重新提交' : '操作失败'), !r.ok);
          if (r.ok) {
            petCache.clear();
            await loadMineSubmissions();
          }
        };
      });
      $all('.pet-del-btn', sec).forEach(btn => {
        btn.onclick = async (e) => {
          if (e) e.stopPropagation();
          if (siteConfig.maintenance) { showToast('⚠️ 宠物收集录正在维护中，删除功能暂时关闭', true); return; }
          if (!siteConfig.allowDelete) { showToast('⚠️ 当前已关闭投稿删除功能，请联系站长', true); return; }
          const confirmed = await confirmAction({
            title: '删除投稿？',
            message: '删除后不会再显示在“我的投稿”中。需要恢复时，请在七天内联系站长处理。',
            confirmText: '删除投稿',
            variant: 'danger',
          });
          if (!confirmed) return;
          const r = await apiSubmissionAction('DELETE', '/api/submissions/' + encodeURIComponent(btn.dataset.id), { rowVersion: Number(btn.dataset.row || 1), _id: btn.dataset.id });
          showToast(r.data.message || (r.ok ? '已删除。七天内可联系站长 QQ 申请恢复。' : '删除失败'), !r.ok);
          if (r.ok) {
            petCache.clear();
            if (minePage > mineTotalPages) minePage = mineTotalPages;
            await loadMineSubmissions();
            if (onListChanged) onListChanged();
          }
        };
      });
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

    async function withdrawRevision({ submissionId, revisionId, rowVersion, status = 'pending' }) {
      const rejected = status === 'rejected';
      const confirmed = await confirmAction({
        title: rejected ? '撤回这次被拒修改？' : '撤回待审修改？',
        message: rejected
          ? '撤回后会保留为“已撤回”记录，当前公开内容保持不变。'
          : '撤回后这条修改不会进入审核，当前公开内容保持不变。',
        confirmText: '撤回修改',
        variant: 'danger',
      });
      if (!confirmed) return false;
      const result = await apiSubmissionAction('DELETE', '/api/submissions/' + encodeURIComponent(submissionId) + '/revisions/' + encodeURIComponent(revisionId), {
        rowVersion: Number(rowVersion || 1), _id: submissionId,
      });
      showToast(result.data.message || (result.ok ? '已撤回修改' : '撤回失败'), !result.ok);
      if (result.ok) {
        petCache.clear();
        await loadMineSubmissions();
      }
      return result.ok;
    }

    async function openMineRevisions(id) {
      const r = await api('/api/my/submissions/' + encodeURIComponent(id) + '/revisions');
      if (!r.ok) { showToast((r.data && r.data.message) || '加载修订失败', true); return; }
      const revisions = (r.data && r.data.revisions) || [];
      const modal = $('#pet-detail-modal');
      openPetModal(modal, { label: '已公开内容的修改记录' });
      // 修订卡片 HTML 由渲染层（pet-views.js）生成
      modal.innerHTML =
        '<div class="pet-scroll" style="background:' + C.bg + ';border-radius:16px;max-width:620px;width:100%;padding:24px;position:relative;max-height:90vh;overflow-y:auto">' +
        '<button id="pet-detail-close" style="position:absolute;top:12px;right:16px;background:none;border:none;font-size:24px;cursor:pointer;color:' + C.muted + '">✕</button>' +
        '<h2 style="margin:0 0 5px;font-size:19px;color:' + C.fgDark + '">📝 修改审核记录</h2>' +
        '<p style="font-size:12px;color:' + C.muted + ';line-height:1.6;margin:0 0 14px">待审核修订不会改变当前公开内容；审核通过后才会替换。</p>' +
        views().mineRevisionsHtml(revisions, id) + '</div>';
      $('#pet-detail-close').onclick = () => { closePetModal(modal); };
      modal.onclick = (e) => { if (e.target === modal) closePetModal(modal); };
      $all('.pet-revision-withdraw', modal).forEach(btn => {
        btn.onclick = async () => {
          const withdrawn = await withdrawRevision({
            submissionId: btn.dataset.submission,
            revisionId: btn.dataset.id,
            rowVersion: Number(btn.dataset.row || 1),
            status: btn.dataset.status || 'pending',
          });
          if (withdrawn) closePetModal(modal);
        };
      });
    }

    async function loadMineSubmissions() {
      if (!getUser()) return;
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
      mineTotalPages = Math.max(1, Number(data.totalPages) || Math.ceil(mineTotal / currentMinePageSize()) || 1);
      const responsePage = Math.max(1, Number(data.page) || minePage);
      if (responsePage > mineTotalPages && items.length === 0 && mineTotal > 0) {
        minePage = mineTotalPages;
        return loadMineSubmissions();
      }
      minePage = Math.min(responsePage, mineTotalPages);
      renderMineRows(items, data);
    }

    async function refreshMineSubmissions(options = {}) {
      if (options.resetPage) minePage = 1;
      await loadMineSubmissions();
    }

    async function focusPendingReview() {
      mineStatus = 'pending';
      minePage = 1;
      await loadMineSubmissions();
    }

    async function openMineSection(options = {}) {
      if (!getUser()) { showToast('请先登录', true); onLoginRequired(); return; }
      const sec = $('#pet-mine-section');
      if (!sec) return;
      sec.hidden = false;
      sec.style.display = 'block';
      renderMineShell(sec);
      loadMineTypeOptions();
      await loadMineSubmissions();
      if (options.scroll !== false && typeof sec.scrollIntoView === 'function') {
        sec.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }

    return {
      minePaginationNumbers,
      mineQueryParams,
      renderMineShell,
      loadMineTypeOptions,
      renderMineRows,
      openMineHistory,
      openMineRevisions,
      loadMineSubmissions,
      refreshMineSubmissions,
      focusPendingReview,
      openMineSection,
    };
  }

  return { createPetMine };
}));
