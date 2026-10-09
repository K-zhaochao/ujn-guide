import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { beforeEach, describe, expect, it } from 'vitest';

const require = createRequire(import.meta.url);
const source = readFileSync(require.resolve('../../docs/javascripts/directory.js'), 'utf8');
function page(section = 'phone-book') {
  document.body.innerHTML = '';
  window.eval(source);
  document.body.innerHTML = `<article><div class="ujn-page ujn-page--directory" data-page-section="${section}"><h1>通讯录</h1>
    <h2 id="literature">文学院</h2><details><summary>展开</summary><div class="md-typeset__scrollwrap"><table><thead><tr><th>部门</th><th>电话</th></tr></thead><tbody>
    <tr><td>教学办公室</td><td>0531-82769248<br>0531-82769211（西）</td></tr><tr><td>院长室</td><td>0531-82769209</td></tr></tbody></table></div></details>
    <h2 id="math">数学学院</h2><details open><summary>展开</summary><table><tbody><tr><td>办公室</td><td>0531-82765480</td></tr></tbody></table></details>
    </div></article>`;
  return window.UJNDirectory.sync();
}
beforeEach(() => { document.body.innerHTML = ''; delete window.UJNDirectory; });
describe('本页通讯录筛选', () => {
  it('保持所有数据与原始折叠状态，生成带标签和实时提示的筛选框', () => {
    const ui = page();
    expect(ui.groups.map(g => g.block.open)).toEqual([false, true]);
    expect(document.querySelector('label').htmlFor).toBe(ui.input.id);
    expect(document.querySelector('[role=status]').textContent).toContain('共 3 条');
    expect(document.querySelectorAll('thead tr')).toHaveLength(1);
  });
  it('匹配学院名称，展开命中组并隐藏其他组，清除后恢复状态', () => {
    const ui = page(); ui.input.value = '文学院'; expect(ui.filter()).toBe(2);
    expect(ui.groups[0].block.open).toBe(true); expect(ui.groups[1].block.hidden).toBe(true);
    ui.input.value = ''; expect(ui.filter()).toBe(3);
    expect(ui.groups.map(g => g.block.open)).toEqual([false, true]);
    expect(ui.groups.every(g => !g.block.hidden && !g.heading.hidden)).toBe(true);
  });
  it('按部门或号码筛选行而不是删除行', () => {
    const ui = page(); ui.input.value = '  82769248 '; expect(ui.filter()).toBe(1);
    expect(ui.groups[0].rows[1].hidden).toBe(true);
    ui.input.value = '办公室'; expect(ui.filter()).toBe(2);
    expect(document.querySelectorAll('tbody tr')).toHaveLength(3);
  });
  it('无结果有明确反馈，清除按钮恢复数据并聚焦输入', () => {
    const ui = page(); ui.input.value = '没有这个部门'; ui.input.dispatchEvent(new Event('input'));
    expect(document.querySelector('[role=status]').textContent).toContain('没有匹配');
    document.querySelector('form button').click();
    expect(ui.input.value).toBe(''); expect(document.activeElement).toBe(ui.input);
    expect(document.querySelectorAll('tbody tr[hidden]')).toHaveLength(0);
  });
  it('多个号码变成独立拨号链接，保留换行和备注', () => {
    page();
    expect(document.querySelectorAll('a[href^="tel:"]')).toHaveLength(4);
    expect(document.querySelector('a').getAttribute('href')).toBe('tel:053182769248');
    expect(document.querySelector('td:nth-child(2)').querySelector('br')).not.toBeNull();
    expect(document.querySelector('td:nth-child(2)').textContent).toContain('（西）');
  });
  it('重复初始化不重复控件或链接，并支持即时导航替换页面', () => {
    page(); window.UJNDirectory.sync();
    expect(document.querySelectorAll('form')).toHaveLength(1);
    expect(document.querySelectorAll('a')).toHaveLength(4);
    page(); expect(document.querySelectorAll('form')).toHaveLength(1);
  });
  it('不改写已有链接、短号码、代码和非通讯录中的数字', () => {
    document.body.innerHTML = '<table><tr><td><a href="https://example.test/">13812345678</a> 12345 <code>13912345678</code></td></tr></table>';
    window.eval(source); window.UJNDirectory.dialLinks(document.body);
    expect(document.querySelectorAll('a')).toHaveLength(1);
  });
  it('同乡表格筛选但不自动生成拨号链接', () => {
    const ui = page('hometown-groups'); ui.input.value = '办公室'; expect(ui.filter()).toBe(2);
    expect(document.querySelector('label').textContent).toBe('快速找同乡');
    expect(document.querySelector('a[href^="tel:"]')).toBeNull();
  });
  it('表格可通过键盘聚焦，提交搜索不会刷新页面', () => {
    page(); expect(document.querySelector('.md-typeset__scrollwrap').tabIndex).toBe(0);
    const event = new Event('submit', { cancelable: true });
    document.querySelector('form').dispatchEvent(event); expect(event.defaultPrevented).toBe(true);
  });
  it('同乡页的静态返回按钮保持在标题之后、搜索框之前，筛选不隐藏返回入口', () => {
    document.body.innerHTML = '<div class="ujn-page ujn-page--directory" data-page-section="hometown-groups"><h1>老乡群</h1><p><a class="md-button ujn-parent-return" href="/campus-life/">← 返回校园生活</a></p><h2>各省份老乡群</h2><table><tbody><tr><td>河北</td></tr><tr><td>河南</td></tr></tbody></table></div>';
    window.eval(source);
    const root = document.querySelector('.ujn-page');
    expect(root.children[1].querySelector('.ujn-parent-return')).not.toBeNull();
    expect(root.children[2].className).toBe('ujn-directory-search');
    const input = root.querySelector('input'); input.value = '不存在'; input.dispatchEvent(new Event('input'));
    expect(root.querySelector('.ujn-parent-return').closest('[hidden]')).toBeNull();
    window.UJNDirectory.sync(); expect(root.querySelectorAll('form')).toHaveLength(1);
  });
});
