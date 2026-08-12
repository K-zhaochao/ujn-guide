import { createRequire } from 'node:module';
import { describe, expect, it } from 'vitest';

const require = createRequire(import.meta.url);
const format = require('../../docs/pets/pet-format.js');

describe('宠物前端格式化工具', () => {
  it('HTML 转义 & < > " \'', () => {
    expect(window.UJNGuidePetFormat).toBe(format);
    expect(format.esc('<b title="x">&amp;</b>')).toBe('&lt;b title=&quot;x&quot;&gt;&amp;amp;&lt;/b&gt;');
    expect(format.esc(null)).toBe('');
    expect(format.esc(undefined)).toBe('');
    expect(format.esc(0)).toBe('0');
  });

  it('ISO 时间 → 本地日期 / 完整时间，非法输入返回空串', () => {
    expect(format.formatDate('2026-08-07T10:00:00.000Z')).toBe('2026-08-07');
    expect(format.formatDate('not-a-date')).toBe('');
    expect(format.formatDate('')).toBe('');
    expect(format.formatDate(null)).toBe('');
    expect(format.formatDateTime('2026-08-07T06:03:00.000Z')).toMatch(/^2026-08-07 \d{2}:03$/);
    expect(format.formatDateTime('bad')).toBe('');
  });

  it('毫秒时长 → 人类可读', () => {
    expect(format.humanizeDuration(30 * 1000)).toBe('不到 1 分钟');
    expect(format.humanizeDuration(5 * 60 * 1000)).toBe('5 分钟');
    expect(format.humanizeDuration(2 * 3600 * 1000 + 15 * 60 * 1000)).toBe('2 小时 15 分');
    expect(format.humanizeDuration(3 * 86400 * 1000 + 5 * 3600 * 1000)).toBe('3 天 5 小时');
    expect(format.humanizeDuration(0)).toBe('');
    expect(format.humanizeDuration(-1)).toBe('');
    expect(format.humanizeDuration(undefined)).toBe('');
  });

  it('dataURL 字节长度与图片上限标签', () => {
    // 空串/无逗号返回 0
    expect(format.dataUrlByteLength('')).toBe(0);
    expect(format.dataUrlByteLength('no-comma')).toBe(0);
    // 1 字节 Base64：'AA==' → 1
    expect(format.dataUrlByteLength('data:image/png;base64,AA==')).toBe(1);
    // 2 字节：'AAA=' → 2
    expect(format.dataUrlByteLength('data:image/png;base64,AAA=')).toBe(2);
    // 3 字节：'AAAA' → 3
    expect(format.dataUrlByteLength('data:image/png;base64,AAAA')).toBe(3);
    expect(format.imageLimitLabel(5 * 1024 * 1024)).toBe('5 MB');
    expect(format.imageLimitLabel(3 * 1024 * 1024)).toBe('3 MB');
    expect(format.imageLimitLabel(0)).toBe('5 MB');
    expect(format.imageLimitLabel(-10)).toBe('5 MB');
  });

  it('图片地址解析与昵称展示', () => {
    expect(format.resolveImage('')).toBe('');
    expect(format.resolveImage('https://a.com/x.jpg')).toBe('https://a.com/x.jpg');
    expect(format.resolveImage('data:image/png;base64,AAA=')).toBe('data:image/png;base64,AAA=');
    expect(format.resolveImage('/img/cat.jpg')).toBe('/img/cat.jpg');
    expect(format.displayName(null)).toBe('匿名');
    expect(format.displayName({})).toBe('匿名');
    expect(format.displayName({ username: 'alice' })).toBe('alice');
    expect(format.displayName({ username: 'alice', nickname: ' 阿莉 ' })).toBe('阿莉');
    expect(format.displayName({ username: 'alice', nickname: '   ' })).toBe('alice');
  });

  it('debounce 只在静默期后执行一次', async () => {
    let calls = 0;
    const fn = format.debounce(() => { calls += 1; }, 10);
    fn(); fn(); fn();
    await new Promise(resolve => setTimeout(resolve, 40));
    expect(calls).toBe(1);
  });
});
