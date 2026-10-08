import { readFileSync } from 'node:fs';
import { beforeEach, afterEach, describe, it, expect, vi } from 'vitest';
import { exportFields } from '../../tools/grade-export/jwgl-endpoint.mjs';

const source = readFileSync('docs/javascripts/grade-export.js', 'utf8');
const page = readFileSync('docs/tools/grade-export.md', 'utf8');
const html = page.slice(page.indexOf('<div id="grade-export-tool"'), page.indexOf('<noscript>'));
const handlers = []; globalThis.document$ = { subscribe: fn => handlers.push(fn) }; new Function(source)();
const flush = () => new Promise(done => setTimeout(done, 0));
const form = () => document.getElementById('grade-export-form');
const tool = () => document.getElementById('grade-export-tool');
const status = () => tool().querySelector('[data-grade-status]').textContent;
const trigger = () => form().querySelector('[role="combobox"]');
const input = () => form().elements.xnm;
const boot = () => { document.body.innerHTML = html; handlers.forEach(fn => fn()); };
const confirm = () => tool().querySelector('[data-grade-continue]').click();
const setYear = value => { input().value = value; input().dispatchEvent(new Event('input', { bubbles: true })); };
const selectTerm = value => { trigger().click(); [...form().querySelectorAll('[role="option"]')].find(n => n.textContent === value).click(); };
const submit = () => { const event = new Event('submit', { bubbles: true, cancelable: true }); form().dispatchEvent(event); return event; };
const schoolPage = (year = "2024") => `<select name="xnm"><option value="2025">2025—2026</option><option value="${year}" selected>${year} 学年</option></select><select id="xqm"><option value="">请选择</option><option value="3" selected>第一学期</option><option value="12">第二学期</option><option value="16" disabled>短学期</option></select>`;
async function upload(text, attrs = {}) {
 const node = tool().querySelector('[data-grade-import]');
 Object.defineProperty(node, 'files', { configurable: true, value: [{ name: '成绩.html', size: 1000, text: async () => text, ...attrs }] });
 node.dispatchEvent(new Event('change', { bubbles: true })); await flush();
}
beforeEach(() => { globalThis.fetch = vi.fn(); boot(); });
afterEach(() => { document.body.innerHTML = ''; handlers.forEach(fn => fn()); vi.restoreAllMocks(); });

describe('static official-login/native-export flow', () => {
 it('has no password form, service probe, API configuration or plugin/installer', () => {
  expect(page).not.toMatch(/name="password"|name="user"|暂未开放|Tampermonkey|安装器/);
  expect(source).not.toMatch(/fetch\s*\(|api\/grade-export|sessionToken|document\.cookie|localStorage|sessionStorage/);
  expect(fetch).not.toHaveBeenCalled();
 });
 it('opens only the fixed official login URL in a separate protected tab', () => {
  const link = tool().querySelector('[data-grade-official]');
  expect(link.href).toBe('http://jwgl.ujn.edu.cn/sso/driotlogin'); expect(link.target).toBe('_blank'); expect(link.rel).toContain('noopener');
 });
 it('asks the user to confirm login instead of pretending to detect a school session', () => {
  expect(form().hidden).toBe(true); confirm(); expect(form().hidden).toBe(false);
  expect(tool().querySelector('[data-grade-login]').hidden).toBe(true); expect(document.activeElement).toBe(input());
  expect(status()).not.toContain('登录成功'); expect(fetch).not.toHaveBeenCalled();
 });
 it('does not invent an account year and requires explicit year and term choices', () => {
  confirm(); expect(input().value).toBe(''); expect(form().elements.xqm.value).toBe('');
  expect(form().querySelector('[type="submit"]').disabled).toBe(true);
  setYear('2025'); selectTerm('第二学期'); expect(form().querySelector('[type="submit"]').disabled).toBe(false);
 });
 it('blocks an incomplete or invalid submission', () => {
  expect(submit().defaultPrevented).toBe(true); confirm(); setYear('oops'); expect(submit().defaultPrevented).toBe(true);
  setYear('2025'); expect(submit().defaultPrevented).toBe(true);
 });
 it('uses a native top-level POST to the exact student export endpoint', () => {
  confirm(); setYear('2025'); selectTerm('第一学期'); const event = submit();
  expect(event.defaultPrevented).toBe(false); expect(form().method).toBe('post'); expect(form().target).toBe('_blank');
  expect(form().getAttribute('rel')).toContain('noopener');
  expect(form().action).toBe('https://jwgl.ujn.edu.cn/jwglxt/zftal/drdc/export_exportConfig.html?gnmkdm=N305005&layout=default');
  expect(fetch).not.toHaveBeenCalled();
 });
 it('matches all 23 school export columns, repeated names and template fields', () => {
  confirm(); setYear('2025'); selectTerm('第一学期'); submit();
  const actual = new URLSearchParams(new window.FormData(form()));
  const expected = new URLSearchParams(exportFields({ xnm: '2025', xqm: '3', fileName: '2025 学年成绩单' }));
  expect(actual.toString()).toBe(expected.toString()); expect(actual.getAll('exportModel.selectCol')).toHaveLength(23);
  expect(actual.get('dcclbh')).toBe('JW_N305005_XSCXCJ');
 });
 it('does not duplicate hidden fields on repeated submissions', () => {
  confirm(); setYear('2025'); selectTerm('第一学期'); submit(); submit();
  expect(new window.FormData(form()).getAll('exportModel.selectCol')).toHaveLength(23);
 });
 it('does not falsely report file download success', () => {
  confirm(); setYear('2025'); selectTerm('第一学期'); submit();
  expect(status()).toContain('不判断下载是否成功'); expect(status()).not.toContain('导出成功');
 });
 it('supports keyboard selection and escape on the themed term dropdown', () => {
  confirm(); setYear('2025'); const key = value => trigger().dispatchEvent(new KeyboardEvent('keydown', { key: value, bubbles: true, cancelable: true }));
  key('ArrowDown'); key('End'); key('Enter'); expect(form().elements.xqm.value).toBe('16');
  key('ArrowDown'); key('Escape'); expect(trigger().getAttribute('aria-expanded')).toBe('false');
 });
 it('reads selected year and actual term values from a local saved school page', async () => {
  confirm(); await upload(schoolPage()); expect(input().value).toBe('2024'); expect(form().elements.xqm.value).toBe('3');
  expect([...form().querySelectorAll('[role="option"]')].map(n => n.textContent)).toEqual(['请选择学期', '第一学期', '第二学期']);
  expect(tool().querySelector('[data-grade-options-note]').textContent).toContain('2024 学年'); expect(fetch).not.toHaveBeenCalled();
 });
 it('clears imported term choices when the year is manually changed', async () => {
  confirm(); await upload(schoolPage()); setYear('2023'); expect(form().elements.xqm.value).toBe('');
  expect(tool().querySelector('[data-grade-options-note]').textContent).toContain('不会自动读取');
 });
 it('rejects missing controls without leaving old account options selected', async () => {
  confirm(); await upload(schoolPage()); await upload('<html>登录页</html>');
  expect(input().value).toBe(''); expect(form().elements.xqm.value).toBe(''); expect(status()).toContain('没有学年');
 });
 it('requires a selected year when the saved page contains multiple years', async () => {
  confirm(); await upload(schoolPage().replace(' selected>2024', '>2024')); expect(input().value).toBe(''); expect(status()).toContain('未标明选中的学年');
 });
 it('rejects oversized and non-html files before reading them', async () => {
  confirm(); const text = vi.fn(); await upload('', { size: 3 * 1024 * 1024, text }); expect(text).not.toHaveBeenCalled();
  expect(status()).toContain('2 MB'); await upload('', { name: '成绩.exe', text }); expect(text).not.toHaveBeenCalled(); expect(status()).toContain('HTML');
 });
 it('never injects saved document scripts or external resources into the page', async () => {
  confirm(); await upload('<img src="https://evil.test/"><script>window.pwned=1</script>' + schoolPage().replace('第一学期', '&lt;img src=x onerror=alert(1)&gt;'));
  expect(tool().querySelector('img')).toBeNull(); expect(tool().querySelector('script')).toBeNull();
  expect(form().elements.xqm.value).toBe('3'); expect(fetch).not.toHaveBeenCalled();
 });
 it('ignores a stale import after year editing', async () => {
  confirm(); let resolveText; const promise = new Promise(done => resolveText = done);
  await upload('', { text: () => promise }); setYear('2022'); resolveText(schoolPage()); await flush(); expect(input().value).toBe('2022');
 });
 it('ignores a stale import after navigation or resetting the account', async () => {
  confirm(); let resolveText; await upload('', { text: () => new Promise(done => resolveText = done) });
  tool().querySelector('[data-grade-reset]').click(); resolveText(schoolPage()); await flush(); expect(form().hidden).toBe(true); expect(input().value).toBe('');
 });
 it('fully clears range, file and generated fields when switching accounts', async () => {
  confirm(); await upload(schoolPage()); submit(); tool().querySelector('[data-grade-reset]').click();
  expect(form().hidden).toBe(true); expect(input().value).toBe(''); expect(form().elements.xqm.value).toBe('');
  expect(form().querySelector('[data-grade-fields]').childElementCount).toBe(0); expect(fetch).not.toHaveBeenCalled();
 });
 it('preserves current step on repeated callbacks and initializes replacement pages', () => {
  confirm(); handlers.forEach(fn => fn()); expect(form().hidden).toBe(false); boot(); expect(form().hidden).toBe(true); confirm(); expect(form().hidden).toBe(false);
 });
});
