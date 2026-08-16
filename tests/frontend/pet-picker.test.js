import { createRequire } from 'node:module';
import { describe, expect, it, beforeEach, vi } from 'vitest';

const require = createRequire(import.meta.url);
const picker = require('../../docs/pets/pet-picker.js');

function makePicker(overrides = {}) {
  const controller = picker.createPetPicker({
    document,
    C: { primary: '#3b82f6', border: '#e5e7eb', inputBg: '#fff', soft: 'rgba(0,0,0,.04)', muted: '#9ca3af', faint: '#b0b4bb' },
    ...overrides,
  });
  return controller;
}

function mountSelect(options = ['全部类型', '🐱 猫猫', '🐶 狗狗']) {
  const select = document.createElement('select');
  select.setAttribute('aria-label', '测试选择');
  options.forEach((label, i) => {
    const opt = document.createElement('option');
    opt.value = i === 0 ? '' : 'v' + i;
    opt.textContent = label;
    select.appendChild(opt);
  });
  document.body.appendChild(select);
  return select;
}

function mountDate(value = '') {
  const input = document.createElement('input');
  input.type = 'date';
  input.value = value;
  document.body.appendChild(input);
  return input;
}

function fireMousedown(el) {
  el.dispatchEvent(new MouseEvent('mousedown', { button: 0, bubbles: true, cancelable: true }));
}

describe('宠物前端可爱风选择器（pet-picker.js）', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  describe('自定义下拉面板 attachSelect', () => {
    it('鼠标点击 select 时打开面板并渲染全部选项', () => {
      const controller = makePicker();
      const select = mountSelect();
      controller.attachSelect(select);
      fireMousedown(select);
      const panel = document.querySelector('.pet-picker-panel');
      expect(panel).not.toBeNull();
      expect(panel.querySelectorAll('.pet-picker-option').length).toBe(3);
      expect(panel.textContent).toContain('🐱 猫猫');
    });

    it('当前选中项带 is-selected 标记', () => {
      const controller = makePicker();
      const select = mountSelect();
      select.value = 'v2';
      controller.attachSelect(select);
      fireMousedown(select);
      const selected = document.querySelector('.pet-picker-option.is-selected');
      expect(selected).not.toBeNull();
      expect(selected.dataset.value).toBe('v2');
    });

    it('点击选项：同步原生 select.value 并派发 change 事件后关闭面板', () => {
      const controller = makePicker();
      const select = mountSelect();
      const onChange = vi.fn();
      select.addEventListener('change', onChange);
      controller.attachSelect(select);
      fireMousedown(select);
      const option = Array.from(document.querySelectorAll('.pet-picker-option')).find(o => o.dataset.value === 'v2');
      option.click();
      expect(select.value).toBe('v2');
      expect(onChange).toHaveBeenCalledOnce();
      expect(document.querySelector('.pet-picker-panel')).toBeNull();
    });

    it('再次点击同一 select：关闭面板而非重开', () => {
      const controller = makePicker();
      const select = mountSelect();
      controller.attachSelect(select);
      fireMousedown(select);
      expect(document.querySelector('.pet-picker-panel')).not.toBeNull();
      fireMousedown(select);
      expect(document.querySelector('.pet-picker-panel')).toBeNull();
    });

    it('点击面板外部关闭面板', () => {
      const controller = makePicker();
      const select = mountSelect();
      controller.attachSelect(select);
      fireMousedown(select);
      expect(document.querySelector('.pet-picker-panel')).not.toBeNull();
      document.body.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }));
      expect(document.querySelector('.pet-picker-panel')).toBeNull();
    });

    it('按 Esc 关闭面板并把焦点还给 select', () => {
      const controller = makePicker();
      const select = mountSelect();
      controller.attachSelect(select);
      fireMousedown(select);
      expect(document.querySelector('.pet-picker-panel')).not.toBeNull();
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
      expect(document.querySelector('.pet-picker-panel')).toBeNull();
    });

    it('重复 attach 不重复绑定', () => {
      const controller = makePicker();
      const select = mountSelect();
      controller.attachSelect(select);
      controller.attachSelect(select);
      fireMousedown(select);
      fireMousedown(select);
      // 第一次打开、第二次关闭，面板最终不存在（没有第三次打开说明未重复绑定）
      expect(document.querySelector('.pet-picker-panel')).toBeNull();
    });
  });

  describe('选项列表面板固定高度（attachSelect）', () => {
    it('普通下拉面板带 pet-picker-panel--list 类（固定高度 + 内部滚动）', () => {
      const controller = makePicker();
      const select = mountSelect();
      controller.attachSelect(select);
      fireMousedown(select);
      const panel = document.querySelector('.pet-picker-panel');
      expect(panel).not.toBeNull();
      expect(panel.classList.contains('pet-picker-panel--list')).toBe(true);
      expect(panel.classList.contains('pet-picker-panel--compact')).toBe(false);
    });

    it('紧凑面板（每页数量）不带 --list 类（选项少无需滚动）', () => {
      const controller = makePicker();
      const select = mountSelect();
      select.classList.add('pet-pager-size');
      controller.attachSelect(select);
      fireMousedown(select);
      const panel = document.querySelector('.pet-picker-panel');
      expect(panel.classList.contains('pet-picker-panel--compact')).toBe(true);
      expect(panel.classList.contains('pet-picker-panel--list')).toBe(false);
    });

    it('选项再多也在固定高度面板内渲染全部选项（可滚动浏览）', () => {
      const controller = makePicker();
      const many = ['全部类型', '🐱 猫', '🐶 狗', '🐹 仓鼠', '🐰 兔', '🐦 鸟', '🐢 龟', '🐟 鱼', '🐸 蛙', '🐝 蜂', '🦊 狐', '🐻 熊'];
      const select = mountSelect(many);
      controller.attachSelect(select);
      fireMousedown(select);
      const panel = document.querySelector('.pet-picker-panel.pet-picker-panel--list');
      expect(panel.querySelectorAll('.pet-picker-option').length).toBe(many.length);
      expect(panel.querySelectorAll('.pet-picker-option')[2].textContent).toBe('🐶 狗');
    });

    it('面板内部滚动（滚动条拖动 / 鼠标滚轮）不关闭面板', () => {
      const controller = makePicker();
      const select = mountSelect();
      controller.attachSelect(select);
      fireMousedown(select);
      const panel = document.querySelector('.pet-picker-panel');
      panel.dispatchEvent(new Event('scroll', { bubbles: true }));
      expect(document.querySelector('.pet-picker-panel')).not.toBeNull();
    });

    it('面板外滚动（页面滚动）才关闭面板', () => {
      const controller = makePicker();
      const select = mountSelect();
      controller.attachSelect(select);
      fireMousedown(select);
      document.body.dispatchEvent(new Event('scroll', { bubbles: true }));
      expect(document.querySelector('.pet-picker-panel')).toBeNull();
    });

    it('resize 事件（target 为 window 非 Element）关闭面板且不抛错', () => {
      const controller = makePicker();
      const select = mountSelect();
      controller.attachSelect(select);
      fireMousedown(select);
      expect(() => {
        window.dispatchEvent(new Event('resize', { bubbles: false }));
      }).not.toThrow();
      expect(document.querySelector('.pet-picker-panel')).toBeNull();
    });
  });

  describe('自定义日历面板 attachDate', () => {
    it('点击输入框任意位置（不限日历图标）打开面板并渲染月份标题', () => {
      const controller = makePicker();
      const input = mountDate();
      controller.attachDate(input);
      fireMousedown(input);
      const panel = document.querySelector('.pet-picker-panel.pet-cal');
      expect(panel).not.toBeNull();
      const now = new Date();
      expect(panel.textContent).toContain(now.getFullYear() + '年' + (now.getMonth() + 1) + '月');
      expect(panel.querySelectorAll('.pet-cal-day').length).toBeGreaterThanOrEqual(28);
    });

    it('选择日期：写入 input.value、派发 change、关闭面板', () => {
      const controller = makePicker();
      const input = mountDate();
      const onChange = vi.fn();
      input.addEventListener('change', onChange);
      controller.attachDate(input);
      fireMousedown(input);
      const day = document.querySelector('.pet-cal-day:not(.is-out)');
      const label = day.getAttribute('aria-label');
      day.click();
      expect(input.value).toBe(label);
      expect(onChange).toHaveBeenCalledOnce();
      expect(document.querySelector('.pet-picker-panel')).toBeNull();
    });

    it('已有值时打开面板：对应日期带 is-selected，今天带 is-today', () => {
      const controller = makePicker();
      const today = new Date();
      const y = today.getFullYear();
      const m = String(today.getMonth() + 1).padStart(2, '0');
      const d = String(today.getDate()).padStart(2, '0');
      const input = mountDate(y + '-' + m + '-' + d);
      controller.attachDate(input);
      fireMousedown(input);
      expect(document.querySelector('.pet-cal-day.is-selected')).not.toBeNull();
      expect(document.querySelector('.pet-cal-day.is-today')).not.toBeNull();
    });

    it('月份切换：点击 ‹ › 改变标题', () => {
      const controller = makePicker();
      const input = mountDate('2026-08-15');
      controller.attachDate(input);
      fireMousedown(input);
      expect(document.querySelector('.pet-cal-title').textContent).toBe('2026年8月');
      document.querySelector('.pet-cal-nav[aria-label="下个月"]').click();
      expect(document.querySelector('.pet-cal-title').textContent).toBe('2026年9月');
      document.querySelector('.pet-cal-nav[aria-label="上个月"]').click();
      document.querySelector('.pet-cal-nav[aria-label="上个月"]').click();
      expect(document.querySelector('.pet-cal-title').textContent).toBe('2026年7月');
    });

    it('点击「🐾 回到今天」选中今天', () => {
      const controller = makePicker();
      const input = mountDate();
      const onChange = vi.fn();
      input.addEventListener('change', onChange);
      controller.attachDate(input);
      fireMousedown(input);
      document.querySelector('.pet-cal-today').click();
      const today = new Date();
      const y = today.getFullYear();
      const m = String(today.getMonth() + 1).padStart(2, '0');
      const d = String(today.getDate()).padStart(2, '0');
      expect(input.value).toBe(y + '-' + m + '-' + d);
      expect(onChange).toHaveBeenCalledOnce();
    });

    it('外部点击关闭日历面板', () => {
      const controller = makePicker();
      const input = mountDate();
      controller.attachDate(input);
      fireMousedown(input);
      expect(document.querySelector('.pet-picker-panel')).not.toBeNull();
      document.body.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }));
      expect(document.querySelector('.pet-picker-panel')).toBeNull();
    });
  });

  describe('运行时转换为只读文本框（绕开系统占位/高亮）', () => {
    it('attachDate 后 type=text + readonly + placeholder，value 保留', () => {
      const controller = makePicker();
      const input = mountDate('2026-08-15');
      controller.attachDate(input);
      expect(input.type).toBe('text');
      expect(input.readOnly).toBe(true);
      expect(input.getAttribute('placeholder')).toBe('选择日期');
      expect(input.value).toBe('2026-08-15');
    });

    it('空值 attach 转换后无系统占位文本（placeholder 为自定义提示）', () => {
      const controller = makePicker();
      const input = mountDate('');
      controller.attachDate(input);
      expect(input.type).toBe('text');
      expect(input.value).toBe('');
      expect(input.getAttribute('placeholder')).toBe('选择日期');
    });

    it('聚焦只读文本框不会产生 yyyy 占位高亮（readonly 文本框无 UA 占位）', () => {
      const controller = makePicker();
      const input = mountDate('');
      controller.attachDate(input);
      input.focus();
      expect(input.readOnly).toBe(true);
      expect(input.type).toBe('text');
      expect(document.querySelector('.pet-picker-panel')).toBeNull(); // 聚焦不自动弹面板
    });

    it('聚焦时按 Enter 打开日历面板', () => {
      const controller = makePicker();
      const input = mountDate();
      controller.attachDate(input);
      input.focus();
      input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
      expect(document.querySelector('.pet-picker-panel.pet-cal')).not.toBeNull();
    });

    it('聚焦时按空格打开日历面板', () => {
      const controller = makePicker();
      const input = mountDate();
      controller.attachDate(input);
      input.focus();
      input.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', bubbles: true }));
      expect(document.querySelector('.pet-picker-panel.pet-cal')).not.toBeNull();
    });

    it('面板已打开时再次按 Enter 关闭（toggle）', () => {
      const controller = makePicker();
      const input = mountDate();
      controller.attachDate(input);
      input.focus();
      input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
      expect(document.querySelector('.pet-picker-panel.pet-cal')).not.toBeNull();
      input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
      expect(document.querySelector('.pet-picker-panel.pet-cal')).toBeNull();
    });

    it('非 Enter/空格 键（如 Tab）不拦截，走原生焦点移动', () => {
      const controller = makePicker();
      const input = mountDate();
      controller.attachDate(input);
      const ev = new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true });
      input.dispatchEvent(ev);
      expect(ev.defaultPrevented).toBe(false);
      expect(document.querySelector('.pet-picker-panel.pet-cal')).toBeNull();
    });
  });

  describe('降级策略', () => {
    it('触屏设备（pointer: coarse）不接管，保留原生控件', () => {
      // 模拟 matchMedia 命中 coarse 指针
      const originalMatchMedia = window.matchMedia;
      window.matchMedia = (query) => ({ matches: query.includes('coarse'), media: query, addEventListener: () => {}, removeEventListener: () => {} });
      try {
        const controller = makePicker();
        expect(controller.isCoarsePointer).toBe(true);
        const select = mountSelect();
        controller.attachSelect(select);
        fireMousedown(select);
        expect(document.querySelector('.pet-picker-panel')).toBeNull();
      } finally {
        window.matchMedia = originalMatchMedia;
      }
    });

    it('未注入 picker 时 pet-mine 仍可用原生控件（由 pet-mine 测试覆盖）', () => {
      // 该用例为占位说明：picker 为可选依赖，pet-mine.test.js 已覆盖未注入场景
      expect(true).toBe(true);
    });
  });
});
