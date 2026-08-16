import { createRequire } from 'node:module';
import { describe, expect, it, beforeEach, vi } from 'vitest';

const require = createRequire(import.meta.url);
const picker = require('../../server/public/admin-picker.js');

function makePicker(overrides = {}) {
  return picker.createAdminPicker({ document, window, ...overrides });
}

function mountSelect(options = ['全部状态', '已通过', '待审核']) {
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

describe('管理后台宠物风选择器（admin-picker.js）', () => {
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
      expect(panel.textContent).toContain('已通过');
    });

    it('点击选项：同步原生 select.value 并派发 change 事件后关闭面板', () => {
      const controller = makePicker();
      const select = mountSelect();
      const onChange = vi.fn();
      select.addEventListener('change', onChange);
      controller.attachSelect(select);
      fireMousedown(select);
      const option = Array.from(document.querySelectorAll('.pet-picker-option')).find(o => o.dataset.value === 'v1');
      option.click();
      expect(select.value).toBe('v1');
      expect(onChange).toHaveBeenCalledOnce();
      expect(document.querySelector('.pet-picker-panel')).toBeNull();
    });

    it('按 Esc 关闭面板', () => {
      const controller = makePicker();
      const select = mountSelect();
      controller.attachSelect(select);
      fireMousedown(select);
      expect(document.querySelector('.pet-picker-panel')).not.toBeNull();
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
      expect(document.querySelector('.pet-picker-panel')).toBeNull();
    });

    it('普通下拉面板带 --list 类（固定高度 + 滚动条），紧凑面板不带', () => {
      const controller = makePicker();
      const many = ['全部操作', '通过公开投稿', '驳回公开投稿', '删除投稿', '恢复投稿', '通过修订', '驳回修订', '封禁用户', '解封用户', '管理员任免'];
      const select = mountSelect(many);
      controller.attachSelect(select);
      fireMousedown(select);
      const panel = document.querySelector('.pet-picker-panel');
      expect(panel.classList.contains('pet-picker-panel--list')).toBe(true);
      expect(panel.classList.contains('pet-picker-panel--compact')).toBe(false);
      panel.remove();
      const compact = mountSelect(['6', '12', '24', '48']);
      compact.classList.add('pet-pager-size');
      controller.attachSelect(compact);
      fireMousedown(compact);
      const cPanel = document.querySelector('.pet-picker-panel');
      expect(cPanel.classList.contains('pet-picker-panel--compact')).toBe(true);
      expect(cPanel.classList.contains('pet-picker-panel--list')).toBe(false);
    });

    it('面板内部滚动（滚动条 / 鼠标滚轮）不关闭面板', () => {
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
        window.dispatchEvent(new Event('resize'));
      }).not.toThrow();
      expect(document.querySelector('.pet-picker-panel')).toBeNull();
    });
  });

  describe('自定义日历面板 attachDate', () => {
    it('桌面端：type=date 转只读文本框后点击打开面板', () => {
      const controller = makePicker();
      const input = mountDate();
      controller.attachDate(input);
      expect(input.type).toBe('text');
      expect(input.readOnly).toBe(true);
      fireMousedown(input);
      const panel = document.querySelector('.pet-picker-panel.pet-cal');
      expect(panel).not.toBeNull();
      expect(panel.querySelectorAll('.pet-cal-day').length).toBeGreaterThanOrEqual(28);
    });

    it('选择日期：写入 input.value（YYYY-MM-DD）、派发 change、关闭面板', () => {
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

    it('键盘 Enter 打开日历面板', () => {
      const controller = makePicker();
      const input = mountDate();
      controller.attachDate(input);
      input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
      expect(document.querySelector('.pet-picker-panel.pet-cal')).not.toBeNull();
    });

    it('已有值时打开面板：对应日期带 is-selected', () => {
      const controller = makePicker();
      const input = mountDate('2026-08-15');
      controller.attachDate(input);
      fireMousedown(input);
      expect(document.querySelector('.pet-cal-title').textContent).toBe('2026年8月');
      expect(document.querySelector('.pet-cal-day.is-selected')).not.toBeNull();
    });

    it('月份切换：点击 ‹ › 改变标题', () => {
      const controller = makePicker();
      const input = mountDate('2026-08-15');
      controller.attachDate(input);
      fireMousedown(input);
      document.querySelector('.pet-cal-nav[aria-label="下个月"]').click();
      expect(document.querySelector('.pet-cal-title').textContent).toBe('2026年9月');
      document.querySelector('.pet-cal-nav[aria-label="上个月"]').click();
      document.querySelector('.pet-cal-nav[aria-label="上个月"]').click();
      expect(document.querySelector('.pet-cal-title').textContent).toBe('2026年7月');
    });
  });

  describe('批量附加 attachControls', () => {
    it('根元素内所有 select 与 date 输入均被附加', () => {
      const controller = makePicker();
      const select = mountSelect();
      const input = mountDate();
      const wrap = document.createElement('div');
      document.body.appendChild(wrap);
      wrap.appendChild(select);
      wrap.appendChild(input);
      controller.attachControls(wrap);
      fireMousedown(select);
      expect(document.querySelector('.pet-picker-panel')).not.toBeNull();
      document.querySelector('.pet-picker-panel').remove();
      fireMousedown(input);
      expect(document.querySelector('.pet-picker-panel.pet-cal')).not.toBeNull();
    });
  });
});
