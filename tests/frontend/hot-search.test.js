import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { beforeEach, describe, expect, it } from 'vitest';

const require = createRequire(import.meta.url);
const source = readFileSync(require.resolve('../../docs/javascripts/hot-search.js'), 'utf8');

/** 造一个和 overrides/partials/search.html 结构一致的搜索面板。 */
function newSearchPanel({ chips = ['快递', '食堂', '转专业'], value = '' } = {}) {
  const inner = document.createElement('div');
  inner.className = 'md-search__inner';
  inner.innerHTML = `
    <form class="md-search__form" id="pagefind-search-form">
      <input type="text" class="md-search__input" id="pagefind-search-input" value="${value}" />
      <button type="reset" id="pagefind-search-clear">✕</button>
    </form>
    <div class="md-search__output">
      <div class="md-search__hot" id="pagefind-hot" hidden>
        ${chips.map(chip => `<button class="ujn-pill md-search__hot-chip" type="button" data-query="${chip}">${chip}</button>`).join('')}
      </div>
      <ol class="md-search-result__list" id="pagefind-search-list"></ol>
    </div>`;
  document.body.replaceChildren(inner);
  window.eval(source);
  return {
    hot: document.getElementById('pagefind-hot'),
    input: document.getElementById('pagefind-search-input'),
    form: document.getElementById('pagefind-search-form'),
    api: window.UJNHotSearch,
  };
}

describe('搜索面板「大家都在搜」', () => {
  beforeEach(() => {
    document.body.replaceChildren();
    delete window.UJNHotSearch;
  });

  it('查询为空时显示，输入后收起（纯空白也算空）', () => {
    const panel = newSearchPanel();
    panel.api.bind(document);
    expect(panel.hot.hidden).toBe(false);

    panel.input.value = '快递';
    panel.input.dispatchEvent(new window.Event('input', { bubbles: true }));
    expect(panel.hot.hidden).toBe(true);

    panel.input.value = '   ';
    panel.input.dispatchEvent(new window.Event('input', { bubbles: true }));
    expect(panel.hot.hidden).toBe(false);
  });

  it('重复绑定是幂等的：一次点击只派发一次 input', () => {
    const panel = newSearchPanel();
    panel.api.bind(document);
    panel.api.bind(document);
    panel.api.bind(document);
    const seen = [];
    panel.input.addEventListener('input', () => seen.push(panel.input.value));

    panel.hot.querySelectorAll('.md-search__hot-chip')[0].click();
    expect(seen).toEqual(['快递']);
  });

  it('点击胶囊会填入查询词并派发 input 事件（搜索逻辑据此触发）', () => {
    const panel = newSearchPanel();
    panel.api.bind(document);
    const seen = [];
    panel.input.addEventListener('input', () => seen.push(panel.input.value));

    panel.hot.querySelectorAll('.md-search__hot-chip')[2].click();

    expect(panel.input.value).toBe('转专业');
    expect(seen).toEqual(['转专业']);
    expect(panel.hot.hidden).toBe(true);
    expect(document.activeElement).toBe(panel.input);
  });

  it('清除后重新出现', async () => {
    const panel = newSearchPanel({ value: '食堂' });
    panel.api.bind(document);
    expect(panel.hot.hidden).toBe(true);

    panel.input.value = '';
    panel.form.dispatchEvent(new window.Event('reset', { bubbles: true }));
    await new Promise(resolve => setTimeout(resolve, 5));
    expect(panel.hot.hidden).toBe(false);
  });

  it('面板不存在时安全返回，不抛错', () => {
    document.body.replaceChildren();
    window.eval(source);
    expect(window.UJNHotSearch.bind(document)).toBeNull();
  });

  it('没有 data-query 的胶囊不会清空输入框', () => {
    const panel = newSearchPanel();
    panel.api.bind(document);
    panel.input.value = '校历';
    const chip = document.createElement('button');
    chip.className = 'md-search__hot-chip';
    chip.textContent = '';
    panel.hot.appendChild(chip);
    chip.click();
    expect(panel.input.value).toBe('校历');
  });
});
