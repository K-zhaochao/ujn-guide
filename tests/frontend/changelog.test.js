import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
const source = readFileSync('docs/javascripts/changelog.js', 'utf8');
function boot(count) { document.body.innerHTML = '<section id="ujn-changelog" data-page-size="10"><ol>' + Array.from({length:count}, (_,i) => '<li data-change-item>更新' + i + '</li>').join('') + '</ol><nav data-change-pagination hidden></nav></section>'; new Function(source)(); }
const shown = () => Array.from(document.querySelectorAll('[data-change-item]')).filter(n => !n.hidden);
describe('complete changelog pagination', () => {
 it('shows ten per page but preserves all history', () => { boot(141); expect(shown()).toHaveLength(10); expect(document.querySelectorAll('[data-change-item]')).toHaveLength(141); expect(document.querySelector('[role=status]').textContent).toContain('141'); });
 it('next, previous and page select reach the final item', () => { boot(25); const buttons = document.querySelectorAll('nav button'); buttons[1].click(); expect(shown()[0].textContent).toBe('更新10'); buttons[0].click(); expect(shown()[0].textContent).toBe('更新0'); const select = document.querySelector('select'); select.value='3'; select.dispatchEvent(new Event('change')); expect(shown()).toHaveLength(5); expect(buttons[1].disabled).toBe(true); });
 it('small histories do not show unnecessary pagination', () => { boot(3); expect(shown()).toHaveLength(3); expect(document.querySelector('nav').hidden).toBe(true); });
 it('reinitialization has no duplicates', () => { boot(40); new Function(source)(); expect(document.querySelectorAll('nav button')).toHaveLength(2); });
});
