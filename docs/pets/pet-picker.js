/*
 * 宠物前端「可爱风」选择器组件。
 *
 * 原生 <select> 的选项列表与 <input type="date"> 的日历弹层都是浏览器系统 UI
 * （shadow DOM 内部），无法用 CSS 定制。本组件在鼠标/触控点击时拦截原生弹出，
 * 改为显示圆角可爱面板：
 *   - attachSelect(select)：自定义下拉面板（选项圆角高亮、当前项主色标记）
 *   - attachWheel(select)：滚轮选择面板（选项很多时防占屏；固定视窗高度，
 *     中间行主色高亮、上下行缩小变淡，鼠标滚轮逐格滑动，停止滚动防抖提交）
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
      // 分页条「每页数量」迷你下拉使用紧凑面板（选项居中、窄宽）；其余保持通用面板
      panel.className = 'pet-picker-panel' + (select.classList.contains('pet-pager-size') ? ' pet-picker-panel--compact' : '');
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

    // ================== 滚轮选择面板（选项很多时防占屏） ==================
    // 类型等选项多时，普通下拉面板把所有选项竖直铺开会占满屏幕。滚轮面板
    // 固定视窗高度（中间行主色高亮放大，上下行缩小变淡 + 渐变遮罩模拟曲率），
    // 鼠标滚轮逐格滑动选择，停止滚动 280ms 后防抖提交 change；点击某行立即
    // 选中并关闭。键盘交互保留原生控件（同 attachSelect），触屏走原生选择器。
    function attachWheel(select) {
      if (!select || select.dataset.petPickerWheel === '1' || isCoarsePointer) return;
      select.dataset.petPickerWheel = '1';
      select.addEventListener('mousedown', (e) => {
        if (e.button !== 0) return;
        e.preventDefault(); // 阻止原生下拉弹出
        if (openPanel && openPanel.anchor === select) { closePanel(); return; }
        select.focus({ preventScroll: true });
        openWheelPanel(select);
      });
    }

    function openWheelPanel(select) {
      closePanel();
      const options = Array.prototype.slice.call(select.options || []);
      if (!options.length) return;
      const ROW_H = 40;

      const panel = document.createElement('div');
      panel.className = 'pet-picker-panel pet-picker-wheel';
      panel.setAttribute('role', 'listbox');
      panel.setAttribute('aria-label', select.getAttribute('aria-label') || '选择');
      const view = document.createElement('div');
      view.className = 'pet-wheel-view';
      const rows = options.map((opt, i) => {
        const row = document.createElement('button');
        row.type = 'button';
        row.className = 'pet-wheel-row';
        row.setAttribute('role', 'option');
        row.setAttribute('aria-selected', 'false');
        row.dataset.index = String(i);
        row.textContent = opt.textContent;
        row.addEventListener('click', () => { applyValue(i, true); });
        view.appendChild(row);
        return row;
      });
      panel.appendChild(view);

      let index = Math.max(0, options.findIndex(o => o.value === select.value));
      if (index < 0) index = 0;
      let commitTimer = null;

      function render() {
        rows.forEach((row, i) => {
          const offset = i - index;
          const dist = Math.abs(offset);
          row.style.transform = 'translateY(' + (offset * ROW_H) + 'px) scale(' + (dist === 0 ? 1 : 0.88) + ')';
          row.style.opacity = dist === 0 ? '1' : (dist === 1 ? '0.55' : '0');
          row.style.pointerEvents = dist <= 1 ? 'auto' : 'none';
          row.style.zIndex = dist === 0 ? '2' : '1';
          row.setAttribute('aria-selected', String(i === index));
          if (i === index) {
            row.classList.add('is-active');
            row.setAttribute('tabindex', '0');
          } else {
            row.classList.remove('is-active');
            row.removeAttribute('tabindex');
          }
        });
        view.setAttribute('aria-label', '当前选择：' + (options[index] ? options[index].textContent : ''));
      }

      // 选中某格：值变化才派发 change；关闭时同步原生 select（防抖未落盘的值）
      function applyValue(i, close) {
        clearTimeout(commitTimer);
        if (i < 0 || i >= options.length) return;
        const changed = i !== index;
        index = i;
        if (changed) {
          select.value = options[i].value;
          select.dispatchEvent(new Event('change', { bubbles: true }));
        }
        render();
        if (close) {
          select.value = options[i].value; // 确保最终值同步（若滚动后立即点击）
          closePanel();
        }
      }

      // 滚轮：先即时视觉滑动，停止 280ms 后再提交 change（快速连滚只打一次接口）
      panel.addEventListener('wheel', (e) => {
        e.preventDefault();
        const next = index + (e.deltaY > 0 ? 1 : -1);
        if (next < 0 || next >= options.length) return;
        index = next;
        render();
        clearTimeout(commitTimer);
        commitTimer = setTimeout(() => {
          select.value = options[index].value;
          select.dispatchEvent(new Event('change', { bubbles: true }));
        }, 280);
      }, { passive: false });

      // 面板内键盘：↑↓ 切换、Home/End 首末、Enter/空格 确认（Esc 由全局监听关闭并还焦）
      panel.addEventListener('keydown', (e) => {
        let next = null;
        if (e.key === 'ArrowUp') next = index - 1;
        else if (e.key === 'ArrowDown') next = index + 1;
        else if (e.key === 'Home') next = 0;
        else if (e.key === 'End') next = options.length - 1;
        else if (e.key === 'Enter' || e.key === ' ' || e.key === 'Spacebar') { e.preventDefault(); applyValue(index, true); return; }
        if (next !== null) {
          e.preventDefault();
          next = Math.max(0, Math.min(options.length - 1, next));
          applyValue(next, false);
          const row = rows[next];
          if (row && typeof row.focus === 'function') row.focus({ preventScroll: true });
        }
      });

      openPanel = { el: panel, anchor: select, kind: 'wheel' };
      placePanel(panel, select);
      render();
    }

    return { attachSelect, attachWheel, attachDate, closePanel, isCoarsePointer, unbindDismiss };
  }

  return { createPetPicker };
}));
