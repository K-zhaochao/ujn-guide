import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const require = createRequire(import.meta.url);
const core = require('../../docs/assets/zongce-calculator/calculator-core.js');
const controller = readFileSync(require.resolve('../../docs/assets/zongce-calculator/calculator.js'), 'utf8');
const page = readFileSync(require.resolve('../../docs/green-book/scholarship/zongce-calculator.md'), 'utf8');
const formMarkup = page.split('<!-- zc:form:start -->')[1].split('<!-- zc:form:end -->')[0];

describe('综测规则与表格解析', () => {
  it('按政策将 GPA 和综合素质分别折算为 75% 和 25%', () => {
    const result = core.calculate({ gpa: 3.6, quality: 80 }, 'direct');
    expect(result.total).toBe(3.7);
    expect(result.academicPart).toBeCloseTo(2.7, 8);
    expect(result.qualityPart).toBe(1);
    expect(core.calculate({ gpa: 0, quality: 0 }, 'direct').total).toBe(0);
  });

  it('评议人数按四舍五入去掉两端 10%，且小样本不会被清空', () => {
    expect(core.reviewMean([0, 0, ...Array(11).fill(9), 10, 10])).toBe(9);
    expect(core.reviewMean([9.5])).toBe(9.5);
    expect(core.reviewMean([0, 10])).toBe(5);
  });

  it('基础分遵守 60 分临界值、第二课堂和公益劳动封顶', () => {
    const full = { gpa: 5, zhengzhi: 10, pinde: 10, jilv: 5, chengxin: 5, ketang: 100, gongyi: 100, tice: 60, sushe: 60, nengli: 50 };
    expect(core.calculate(full)).toMatchObject({ review: 30, ability: 70, quality: 100, total: 5 });
    expect(core.calculate({ ...full, tice: 59.9999, sushe: 59.9999 })).toMatchObject({ ability: 60, quality: 90, total: 4.875 });
  });

  it('上游示例导入后的成绩保持 3.7252', () => {
    const parsed = core.parseImport(core.IMPORT_TEMPLATE);
    const scores = Object.fromEntries(Object.entries(parsed.entries).map(([id, entry]) => [id, entry.value]));
    expect(parsed.mode).toBe('detail');
    expect(parsed.missing).toHaveLength(0);
    expect(core.calculate(scores)).toMatchObject({ review: 27.625, ability: 51.25, quality: 78.875, total: 3.7252 });
  });

  it('拒绝负数、越界分数、非整数次数及评议中的错误数据', () => {
    expect(() => core.calculate({ gpa: -1 }, 'detail')).toThrow();
    expect(() => core.calculate({ gpa: 3, quality: 101 }, 'direct')).toThrow();
    expect(() => core.calculate({ gongyi: 1.5 })).toThrow();
    expect(() => core.calculate({ zhengzhi: [9, 11] })).toThrow();
    expect(() => core.parseImport('GPA,3.6abc')).toThrow();
    expect(() => core.parseImport('政治素养,"9,错误,10"')).toThrow();
    expect(() => core.parseImport('GPA,Infinity')).toThrow();
  });

  it('课程按学分加权，允许零绩点并拒绝零学分与不完整课程', () => {
    expect(core.weightedGpa([{ credit: '3', grade: '4' }, { credit: '1', grade: '2' }])).toBe(3.5);
    expect(core.weightedGpa([{ credit: '3', grade: '0' }])).toBe(0);
    expect(core.weightedGpa([{ credit: '', grade: '' }])).toBeNull();
    expect(() => core.weightedGpa([{ credit: '0', grade: '4' }])).toThrow();
    expect(() => core.weightedGpa([{ credit: '3', grade: '' }])).toThrow();
  });

  it('识别两列横向表格、BOM、引号和末尾空行，且总分模式不提示细项缺失', () => {
    const parsed = core.parseImport('\uFEFF"GPA","综合素质总分"\r\n"3.6","80"\r\n,,\r\n');
    expect(parsed.mode).toBe('direct');
    expect(parsed.entries).toMatchObject({ gpa: { value: 3.6 }, quality: { value: 80 } });
    expect(parsed.missing).toHaveLength(0);
    const vertical = core.parseImport('gpa\t3.6\n综合素质评价成绩\t80');
    expect(vertical.entries).toEqual(parsed.entries);
  });

  it('支持带引号的逗号和跨行评议名单，忽略纯空单元格行', () => {
    const parsed = core.parseImport('项目,数值\nGPA,3.6\n政治素养,"9,8\n10"\n,,,\n');
    expect(parsed.entries.zhengzhi).toEqual({ value: [9, 8, 10], list: true });
    expect(parsed.missing.some(field => field.id === 'quality')).toBe(false);
    expect(() => core.parseImport('GPA,3.6\nGPA,4')).toThrow(/重复/);
    expect(() => core.parseImport('GPA,"3.6')).toThrow(/引号/);
  });
});

describe('综测页面实际表单与即时导航', () => {
  let navigate;
  let root;
  const query = selector => document.querySelector(selector);

  function newPage() {
    document.body.innerHTML = '<div data-zc-calculator>' + formMarkup + '</div>';
    root = query('[data-zc-calculator]');
  }

  function fill(selector, value) {
    const input = query(selector);
    input.value = value;
    input.dispatchEvent(new Event('input', { bubbles: true }));
  }

  function importText(text) {
    fill('#zc-import-text', text);
    query('[data-zc-action="import"]').click();
  }

  beforeEach(() => {
    newPage();
    window.UJNGuideZongceCore = core;
    window.document$ = { subscribe(callback) { navigate = callback; callback(); } };
    window.eval(controller);
  });

  afterEach(() => {
    delete window.document$;
    document.body.replaceChildren();
    vi.restoreAllMocks();
  });

  it('不显示空表单成绩，输入和模式切换实时更新，错误值不会产生结果', () => {
    expect(query('[data-zc-form]').hidden).toBe(false);
    expect(query('[data-zc-total]').textContent).toBe('—');
    query('[name="zc-quality-mode"][value="direct"]').click();
    fill('#zc-gpa', '3.6');
    fill('#zc-quality', '80');
    expect(query('[data-zc-total]').textContent).toBe('3.7000');
    fill('#zc-gpa', '-1');
    expect(query('#zc-gpa').getAttribute('aria-invalid')).toBe('true');
    expect(query('[data-zc-total]').textContent).toBe('—');
    fill('#zc-gpa', '0');
    expect(query('[data-zc-total]').textContent).toBe('1.0000');
  });

  it('重新导入替换旧成绩，并只对当前模式的缺失项目提示', () => {
    importText(core.IMPORT_TEMPLATE);
    expect(query('[data-zc-total]').textContent).toBe('3.7252');
    expect(query('[data-zc-review-mode="zhengzhi"]').value).toBe('list');
    expect(query('label[for="zc-zhengzhi-list"]')).not.toBeNull();
    importText('GPA,综合素质总分\n3.6,80');
    expect(query('[data-zc-total]').textContent).toBe('3.7000');
    expect(query('#zc-nengli').value).toBe('');
    expect(query('[data-zc-import-status]').textContent).not.toContain('待补填');
    importText('GPA,4\n能力分,10');
    expect(query('#zc-ketang').value).toBe('');
    expect(query('#zc-zhengzhi-list').value).toBe('');
    expect(query('#zc-error-ketang').hidden).toBe(false);
    expect(query('#zc-error-quality').hidden).toBe(true);
    fill('#zc-ketang', '0');
    expect(query('#zc-error-ketang').hidden).toBe(true);
    expect(query('[data-zc-total]').textContent).toBe('3.1250');
  });

  it('不完整或错误的导入不会清掉已有成绩，也不把原文当 HTML 执行', () => {
    importText('GPA,3.6\n综合素质总分,80');
    importText('GPA,-1');
    expect(query('#zc-gpa').value).toBe('3.6');
    expect(query('[data-zc-total]').textContent).toBe('3.7000');
    expect(query('[data-zc-import-status]').textContent).toContain('当前成绩未修改');
    importText('<img src=x onerror=alert(1)>');
    expect(root.querySelector('img')).toBeNull();
    expect(query('#zc-quality').value).toBe('80');
  });

  it('添加课程和应用 GPA 正常，重复导航不会叠加监听或默认课程', () => {
    navigate(); navigate();
    expect(root.querySelectorAll('[data-zc-course]')).toHaveLength(1);
    query('[data-zc-action="add-course"]').click();
    expect(root.querySelectorAll('[data-zc-course]')).toHaveLength(2);
    fill('[aria-label="课程 1 学分"]', '3');
    fill('[aria-label="课程 1 绩点"]', '4');
    fill('[aria-label="课程 2 学分"]', '1');
    fill('[aria-label="课程 2 绩点"]', '2');
    query('[data-zc-action="apply-gpa"]').click();
    expect(query('#zc-gpa').value).toBe('3.5000');
    document.body.innerHTML = '<main>其他页面</main>';
    navigate();
    newPage(); navigate();
    expect(root.querySelectorAll('[data-zc-course]')).toHaveLength(1);
    fill('#zc-gpa', '4');
    expect(query('[data-zc-total]').textContent).toBe('3.0000');
  });

  it('清空会恢复填写模式、移除导入提示与旧课程，并保留一次性监听', () => {
    importText('GPA,4\n能力分,10');
    query('[data-zc-action="reset"]').click();
    expect(query('#zc-gpa').value).toBe('');
    expect(query('#zc-import-text').value).toBe('');
    expect(query('[data-zc-total]').textContent).toBe('—');
    expect(query('#zc-error-ketang').hidden).toBe(true);
    expect(root.querySelectorAll('[data-zc-course]')).toHaveLength(1);
    query('[data-zc-action="add-course"]').click();
    expect(root.querySelectorAll('[data-zc-course]')).toHaveLength(2);
  });

  it('本地文件读取完成后填入，读取期间的手动修改或清空不会被旧文件覆盖', () => {
    const readers = [];
    class FakeReader {
      readAsText() { readers.push(this); }
    }
    vi.stubGlobal('FileReader', FakeReader);
    try {
      const input = query('#zc-import-file');
      Object.defineProperty(input, 'files', { configurable: true, value: [new File(['GPA,4'], 'scores.csv')] });
      input.dispatchEvent(new Event('change', { bubbles: true }));
      readers[0].result = 'GPA,4\n综合素质总分,80';
      readers[0].onload();
      expect(query('[data-zc-total]').textContent).toBe('4.0000');
      input.dispatchEvent(new Event('change', { bubbles: true }));
      fill('#zc-gpa', '3');
      readers[1].result = 'GPA,5'; readers[1].onload();
      expect(query('#zc-gpa').value).toBe('3');
      input.dispatchEvent(new Event('change', { bubbles: true }));
      query('[data-zc-action="reset"]').click();
      readers[2].result = 'GPA,5'; readers[2].onload();
      expect(query('#zc-gpa').value).toBe('');
    } finally { vi.unstubAllGlobals(); }
  });
});
