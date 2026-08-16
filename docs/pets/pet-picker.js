/*
 * 宠物前端「可爱风」选择器组件。
 *
 * 原生 <select> 的选项列表与 <input type="date"> 的日历弹层都是浏览器系统 UI
 * （shadow DOM 内部），无法用 CSS 定制。本组件在鼠标/触控点击时拦截原生弹出，
 * 改为显示圆角可爱面板：
 *   - attachSelect(select)：自定义下拉面板（选项圆角高亮、当前项主色标记；
 *     选项多时面板固定高度、右侧显示适配主题的滚动条，不占满屏幕）
 *   - attachDate(input)：自定义日历面板（圆角日格、今天描边、选中填充主色）
 *
 * 设计约束：
 *   - 下拉：键盘交互（Tab / Enter / 箭头）完全保留原生控件，无障碍不受影响；
 *   - 日期：桌面端把 type="date" 运行时转换为只读文本框（绕开系统占位/高亮），
 *     键盘 Enter / 空格 打开日历面板，Esc 关闭；
 *   - 选中后同步原生元素 value 并派发 change 事件，业务 onchange 逻辑零改动；
 *   - 触屏设备（pointer: coarse）自动跳过，保留系统原生选择器（体验更优）；
 *   - 面板定位挂在 body 下，视口内翻转，点击外部 / Esc / 滚动 / 缩放自动关闭。
 *
 * 通过 createPetPicker(deps) 注入依赖（document / C 颜色变量）。
 */
(function (root, factory) {
  const picker = factory();
  if (typeof module === 'object' && module.exports) module.exports = picker;
  if (root) root.UJNGuidePetPicker = picker;
}(typeof window !== 'undefined' ? window : globalThis, function () {
  'use strict';

  function createPetPicker(deps) {
    const { document, C = {} } = deps;
    let openPanel = null; // { el, anchor, kind: 'select' | 'date' }

    const isCoarsePointer = typeof window !== 'undefined' && typeof window.matchMedia === 'function' &&
      window.matchMedia('(pointer: coarse)').matches;

    function closePanel() {
      if (openPanel) {
        openPanel.el.remove();
        openPanel = null;
      }
    }

    // —— 定位：面板挂在 body 下，fixed 定位，视口内翻转 ——
    function placePanel(panel, anchor) {
      document.body.appendChild(panel);
      const rect = anchor.getBoundingClientRect();
      const pr = panel.getBoundingClientRect();
      let left = Math.round(rect.left);
      let top = Math.round(rect.bottom + 6);
      const pad = 8;
      if (left + pr.width > window.innerWidth - pad) left = Math.max(pad, window.innerWidth - pr.width - pad);
      if (top + pr.height > window.innerHeight - pad) top = Math.max(pad, rect.top - pr.height - 6);
      panel.style.left = left + 'px';
      panel.style.top = top + 'px';
    }

    // —— 全局关闭：点击面板外 / Esc / 滚动 / 缩放 ——
    function bindGlobalDismiss() {
      const onDocPointer = (e) => {
        if (!openPanel) return;
        // 点击当前已打开面板的触发器时交由触发器自身 toggle，避免闪烁
        if (e.target === openPanel.anchor || openPanel.anchor.contains(e.target)) return;
        if (openPanel.el.contains(e.target)) return;
        closePanel();
      };
      const onKey = (e) => {
        if (e.key === 'Escape' && openPanel) {
          const anchor = openPanel.anchor;
          closePanel();
          if (anchor && typeof anchor.focus === 'function') anchor.focus({ preventScroll: true });
        }
      };
      const onScrollOrResize = () => closePanel();
      document.addEventListener('mousedown', onDocPointer, true);
      document.addEventListener('keydown', onKey, true);
      document.addEventListener('scroll', onScrollOrResize, true);
      window.addEventListener('resize', onScrollOrResize);
      return () => {
        document.removeEventListener('mousedown', onDocPointer, true);
        document.removeEventListener('keydown', onKey, true);
        document.removeEventListener('scroll', onScrollOrResize, true);
        window.removeEventListener('resize', onScrollOrResize);
      };
    }
    const unbindDismiss = bindGlobalDismiss();

    // ================== 自定义下拉面板 ==================

    function attachSelect(select) {
      if (!select || select.dataset.petPickerSelect === '1' || isCoarsePointer) return;
      select.dataset.petPickerSelect = '1';
      select.addEventListener('mousedown', (e) => {
        if (e.button !== 0) return;
        e.preventDefault(); // 阻止原生下拉弹出
        if (openPanel && openPanel.anchor === select) { closePanel(); return; }
        select.focus({ preventScroll: true });
        openSelectPanel(select);
      });
    }

    function openSelectPanel(select) {
      closePanel();
      const panel = document.createElement('div');
      // 分页条「每页数量」迷你下拉使用紧凑面板（选项居中、窄宽）；其余保持通用面板。
      // 普通面板追加 --list 类：选项多时面板固定高度、右侧显示适配主题的滚动条（见 index.md），
      // 选项列表不再竖直铺开占满屏幕；紧凑面板（每页数量仅 4 项）无需滚动。
      const compact = select.classList.contains('pet-pager-size');
      panel.className = 'pet-picker-panel' + (compact ? ' pet-picker-panel--compact' : ' pet-picker-panel--list');
      panel.setAttribute('role', 'listbox');
      panel.setAttribute('aria-label', select.getAttribute('aria-label') || '选择');

      const options = Array.prototype.slice.call(select.options || []);
      const selectedValue = select.value;
      options.forEach((opt) => {
        const item = document.createElement('button');
        item.type = 'button';
        item.className = 'pet-picker-option' + (opt.value === selectedValue ? ' is-selected' : '');
        item.setAttribute('role', 'option');
        item.setAttribute('aria-selected', String(opt.value === selectedValue));
        item.dataset.value = opt.value;
        item.textContent = opt.textContent;
        item.addEventListener('click', () => {
          select.value = opt.value;
          select.dispatchEvent(new Event('change', { bubbles: true }));
          closePanel();
        });
        panel.appendChild(item);
      });

      openPanel = { el: panel, anchor: select, kind: 'select' };
      placePanel(panel, select);
    }

    // ================== 自定义日历面板 ==================

    function attachDate(input) {
      if (!input || input.dataset.petPickerDate === '1' || isCoarsePointer) return;
      input.dataset.petPickerDate = '1';
      // 桌面端把 type="date" 运行时转换为只读文本框（value 保留 YYYY-MM-DD，
      // 业务 onchange 读取不受影响）。原因：浏览器原生日期框聚焦时显示的
      // yyyy/mm/dd 占位文本呈"选中"高亮（UA 样式），CSS/JS 均无法移除，
      // 且 ::-webkit-datetime-edit 伪元素在真实 Chrome 中不可靠——改为只读
      // 文本框后无系统占位/图标/高亮，完全由自定义日历面板接管。
      // 触屏（coarse）跳过转换，保留原生 type="date" 用系统选择器。
      if (input.type === 'date') {
        input.type = 'text';
        input.readOnly = true;
        input.setAttribute('placeholder', '选择日期');
      }
      input.addEventListener('mousedown', (e) => {
        if (e.button !== 0) return;
        e.preventDefault(); // 阻止文本输入/光标
        if (openPanel && openPanel.anchor === input) { closePanel(); return; }
        input.focus({ preventScroll: true });
        openDatePanel(input);
      });
      // 键盘无障碍：聚焦时 Enter / 空格 打开面板（Esc 由全局监听关闭并还焦）
      input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ' || e.key === 'Spacebar') {
          e.preventDefault();
          if (openPanel && openPanel.anchor === input) { closePanel(); return; }
          openDatePanel(input);
        }
      });
    }

    function parseDateStr(str) {
      if (!str) return null;
      const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(str));
      if (!m) return null;
      return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
    }

    function toDateStr(d) {
      const y = d.getFullYear();
      const mo = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      return y + '-' + mo + '-' + day;
    }

    function openDatePanel(input) {
      closePanel();
      const selected = parseDateStr(input.value);
      let view = selected || new Date();
      const panel = document.createElement('div');
      panel.className = 'pet-picker-panel pet-cal';
      panel.setAttribute('role', 'dialog');
      panel.setAttribute('aria-label', '选择日期');

      function pick(date) {
        input.value = toDateStr(date);
        input.dispatchEvent(new Event('change', { bubbles: true }));
        closePanel();
      }

      function render() {
        panel.innerHTML = '';
        const year = view.getFullYear();
        const month = view.getMonth();
        const today = new Date();
        const todayStr = toDateStr(today);
        const selectedStr = input.value;

        // —— 表头：‹ 2026年8月 › ——
        const head = document.createElement('div');
        head.className = 'pet-cal-head';
        const prev = document.createElement('button');
        prev.type = 'button';
        prev.className = 'pet-cal-nav';
        prev.setAttribute('aria-label', '上个月');
        prev.textContent = '‹';
        prev.addEventListener('click', () => { view = new Date(year, month - 1, 1); render(); });
        const title = document.createElement('span');
        title.className = 'pet-cal-title';
        title.textContent = year + '年' + (month + 1) + '月';
        const next = document.createElement('button');
        next.type = 'button';
        next.className = 'pet-cal-nav';
        next.setAttribute('aria-label', '下个月');
        next.textContent = '›';
        next.addEventListener('click', () => { view = new Date(year, month + 1, 1); render(); });
        head.appendChild(prev); head.appendChild(title); head.appendChild(next);
        panel.appendChild(head);

        // —— 星期行：日 一 二 三 四 五 六 ——
        const week = document.createElement('div');
        week.className = 'pet-cal-week';
        ['日', '一', '二', '三', '四', '五', '六'].forEach(w => {
          const cell = document.createElement('span');
          cell.textContent = w;
          week.appendChild(cell);
        });
        panel.appendChild(week);

        // —— 日期网格（42 格固定，含上下月补位） ——
        const grid = document.createElement('div');
        grid.className = 'pet-cal-grid';
        const firstDay = new Date(year, month, 1).getDay();
        const daysInMonth = new Date(year, month + 1, 0).getDate();
        const daysInPrev = new Date(year, month, 0).getDate();
        const cells = [];
        for (let i = firstDay - 1; i >= 0; i--) cells.push({ d: daysInPrev - i, out: true, date: new Date(year, month - 1, daysInPrev - i) });
        for (let d = 1; d <= daysInMonth; d++) cells.push({ d, out: false, date: new Date(year, month, d) });
        const total = Math.ceil(cells.length / 7) * 7;
        for (let i = 1; cells.length < total; i++) cells.push({ d: i, out: true, date: new Date(year, month + 1, i) });

        cells.forEach(({ d, out, date }) => {
          const dayStr = toDateStr(date);
          const btn = document.createElement('button');
          btn.type = 'button';
          btn.className = 'pet-cal-day' +
            (out ? ' is-out' : '') +
            (dayStr === todayStr ? ' is-today' : '') +
            (dayStr === selectedStr ? ' is-selected' : '');
          btn.textContent = String(d);
          btn.setAttribute('aria-label', dayStr);
          btn.addEventListener('click', () => pick(date));
          grid.appendChild(btn);
        });
        panel.appendChild(grid);

        // —— 底部：今天 ——
        const foot = document.createElement('div');
        foot.className = 'pet-cal-foot';
        const todayBtn = document.createElement('button');
        todayBtn.type = 'button';
        todayBtn.className = 'pet-cal-today';
        todayBtn.textContent = '🐾 回到今天';
        todayBtn.addEventListener('click', () => { view = new Date(); render(); pick(new Date()); });
        foot.appendChild(todayBtn);
        panel.appendChild(foot);
      }

      render();
      openPanel = { el: panel, anchor: input, kind: 'date' };
      placePanel(panel, input);
    }

    return { attachSelect, attachDate, closePanel, isCoarsePointer, unbindDismiss };
  }

  return { createPetPicker };
}));
