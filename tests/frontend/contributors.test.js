import { readFileSync } from 'node:fs';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const script = readFileSync('docs/javascripts/contributors.js', 'utf8');
const page = readFileSync('docs/contribute/index.md', 'utf8');
const html = page.split('<!-- contributors:start -->')[1].split('<!-- contributors:end -->')[0];
const handlers = []; globalThis.document$ = { subscribe: fn => handlers.push(fn) };
new Function(script)();
const boot = () => { document.body.innerHTML = html; handlers.forEach(fn => fn()); };
const tab = key => document.getElementById('contributors-tab-' + key);
const panel = key => document.getElementById('contributors-panel-' + key);
beforeEach(boot);
describe('contributor platform slider', () => {
  it('starts with GitHub selected and Gitee hidden', () => {
    expect(panel('github').hidden).toBe(false); expect(panel('gitee').hidden).toBe(true);
    expect(tab('github').getAttribute('aria-selected')).toBe('true');
    expect(document.querySelector('[role="tablist"]').hidden).toBe(false);
  });
  it('switches the panel, accessibility state and slider position', () => {
    tab('gitee').click(); expect(panel('github').hidden).toBe(true); expect(panel('gitee').hidden).toBe(false);
    expect(tab('gitee').tabIndex).toBe(0); expect(tab('github').tabIndex).toBe(-1);
    expect(document.querySelector('[role="tablist"]').style.getPropertyValue('--platform-index')).toBe('1');
  });
  it('supports arrows, wraparound, Home and End with keyboard focus', () => {
    function key(which, value) { tab(which).dispatchEvent(new KeyboardEvent('keydown', { key: value, bubbles: true, cancelable: true })); }
    key('github', 'ArrowLeft'); expect(document.activeElement).toBe(tab('gitee'));
    key('gitee', 'ArrowRight'); expect(document.activeElement).toBe(tab('github'));
    key('github', 'End'); expect(document.activeElement).toBe(tab('gitee'));
    key('gitee', 'Home'); expect(document.activeElement).toBe(tab('github'));
  });
  it('is idempotent across immediate navigation callbacks and works on a replacement page', () => {
    tab('gitee').click(); handlers.forEach(fn => fn()); expect(panel('gitee').hidden).toBe(false);
    boot(); expect(panel('github').hidden).toBe(false); tab('gitee').click(); expect(panel('gitee').hidden).toBe(false);
  });
  it('does not fetch remote contributor APIs in the visitor browser', () => {
    globalThis.fetch = vi.fn(); boot(); tab('gitee').click(); expect(fetch).not.toHaveBeenCalled();
  });
  it('keeps both platform panels visible when javascript does not run', () => {
    document.body.innerHTML = html; expect(panel('github').hidden).toBe(false); expect(panel('gitee').hidden).toBe(false);
  });
});
