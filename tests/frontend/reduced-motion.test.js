import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const require = createRequire(import.meta.url);
const css = readFileSync(require.resolve('../../docs/assets/stylesheets/ujn.css'), 'utf8');

/**
 * 「减少动态效果」这条规则很容易在重构样式时被顺手删掉，而它删了不会有任何报错，
 * 只有开启该设置的用户会觉得界面又开始晃。这里做一层文本级守卫。
 */
describe('减少动态效果（prefers-reduced-motion）', () => {
  const start = css.indexOf('@media (prefers-reduced-motion: reduce)');
  const block = start < 0 ? '' : css.slice(start);

  it('存在 reduce 媒体查询', () => {
    expect(start).toBeGreaterThan(-1);
  });

  it('同时压掉动画与过渡，且覆盖伪元素', () => {
    expect(block).toMatch(/\*,\s*\*::before,\s*\*::after\s*\{/);
    expect(block).toMatch(/animation-duration:\s*\.01ms\s*!important/);
    expect(block).toMatch(/transition-duration:\s*\.01ms\s*!important/);
    expect(block).toMatch(/animation-iteration-count:\s*1\s*!important/);
    expect(block).toMatch(/scroll-behavior:\s*auto\s*!important/);
  });

  it('用 .01ms 而不是 none：动画与过渡事件仍要触发，避免依赖它们的逻辑卡住', () => {
    expect(block).toContain('.01ms');
    expect(block).not.toMatch(/animation:\s*none/);
  });

  it('放在文件最后，压过前面的组件规则', () => {
    // 这条媒体查询必须是文件结尾，后面不再有任何规则正文
    expect(css.trimEnd().endsWith(block.trimEnd())).toBe(true);
  });

  it('注释里写明了为什么这里必须用 !important', () => {
    const head = css.slice(Math.max(0, start - 900), start);
    expect(head).toContain('!important');
    expect(head).toContain('页面级内联样式');
  });
});
