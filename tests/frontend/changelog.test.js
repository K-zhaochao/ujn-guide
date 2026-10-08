import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
const source = readFileSync('docs/javascripts/changelog.js', 'utf8');
function boot(count) { document.body.innerHTML = '<section id="ujn-changelog" data-page-size="10"><ol>' + Array.from({length:count}, (_,i) => '<li data-change-item>更新' + i + '</li>').join('') + '</ol><nav data-change-pagination hidden></nav></section>'; new Function(source)(); }
const shown = () => Array.from(document.querySelectorAll('[data-change-item]')).filter(n => !n.hidden);
const input = () => document.querySelector('nav input');
const button = name => Array.from(document.querySelectorAll('nav button')).find(n => n.textContent === name);
function enter(value) { input().value = value; input().dispatchEvent(new KeyboardEvent('keydown', {key:'Enter', cancelable:true})); }

describe('complete changelog pagination', () => {
 it('shows ten per page but preserves all history', () => { boot(141); expect(shown()).toHaveLength(10); expect(document.querySelectorAll('[data-change-item]')).toHaveLength(141); expect(document.querySelector('[role=status]').textContent).toContain('141'); expect(document.querySelector('select')).toBeNull(); expect(input().inputMode).toBe('numeric'); });
 it('next, previous and entered page reach the final item', () => { boot(25); button('下一页').click(); expect(shown()[0].textContent).toBe('更新10'); button('上一页').click(); expect(shown()[0].textContent).toBe('更新0'); enter('3'); expect(shown()).toHaveLength(5); expect(button('下一页').disabled).toBe(true); expect(input().value).toBe('3'); });
 it('supports jump button and change events, normalizing whitespace and leading zeroes', () => { boot(25); input().value=' 02 '; button('跳转').click(); expect(input().value).toBe('2'); input().value='3'; input().dispatchEvent(new Event('change')); expect(shown()).toHaveLength(5); });
 it.each(['', ' ', '0', '-1', '4', '1.5', '1e0', '+1', 'abc', 'NaN', 'Infinity', '9007199254740993', '１', '1 2'])('rejects invalid page %j without changing the visible page', value => { boot(25); button('下一页').click(); enter(value); expect(shown()[0].textContent).toBe('更新10'); expect(input().getAttribute('aria-invalid')).toBe('true'); const error=document.querySelector('[role=alert]'); expect(error.hidden).toBe(false); expect(error.textContent).toContain('1～3'); expect(document.querySelector('[role=status]').textContent).toContain('2 / 3'); });
 it('clears validation on editing and valid navigation', () => { boot(25); enter('99'); input().value='2'; input().dispatchEvent(new Event('input')); expect(input().hasAttribute('aria-invalid')).toBe(false); expect(document.querySelector('[role=alert]').hidden).toBe(true); enter('2'); expect(shown()[0].textContent).toBe('更新10'); enter('0'); button('上一页').click(); expect(input().value).toBe('1'); expect(document.querySelector('[role=alert]').hidden).toBe(true); expect(button('上一页').disabled).toBe(true); });
 it('small histories do not show unnecessary pagination', () => { boot(3); expect(shown()).toHaveLength(3); expect(document.querySelector('nav').hidden).toBe(true); });
 it('reinitialization has no duplicates and preserves entered page', () => { boot(40); enter('2'); new Function(source)(); expect(document.querySelectorAll('nav button')).toHaveLength(3); expect(document.querySelectorAll('nav input')).toHaveLength(1); expect(shown()[0].textContent).toBe('更新10'); });
});
