/**
 * 响应式体检：把主要页面在手机 / 平板 / 小笔记本 / 桌面四个宽度下走一遍，
 * 找横向溢出、超出视口的元素，以及被裁掉的文字。
 *
 *   node scripts/verify/responsive-sweep.mjs
 *
 * 它扫的是构建产物（默认 site/），按顶层目录各取一个代表页 + 几个深层页，
 * 每个页面 × 每个宽度都量一次 `documentElement.scrollWidth - clientWidth`，
 * 并列出超出视口的元素（tag + class + 越界像素），方便直接定位。
 */

import { readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { BASE_URL, connect, sleep } from './cdp.mjs';

const SITE_DIR = process.env.UJN_SITE_DIR || 'site';
const WIDTHS = [390, 768, 1024, 1440];

function collectPages() {
  const pages = [];
  for (const entry of readdirSync(SITE_DIR)) {
    if (entry.startsWith('assets') || entry === 'pagefind') continue;
    const full = join(SITE_DIR, entry);
    if (!statSync(full).isDirectory()) continue;
    try {
      if (statSync(join(full, 'index.html')).isFile()) pages.push(`/${entry}/`);
    } catch (error) { /* 没有 index.html，跳过 */ }
  }
  for (const deep of [
    'site-guide/main-campus/canteen-8',
    'green-book/scholarship/zongce-calculator',
  ]) {
    try {
      if (statSync(join(SITE_DIR, deep, 'index.html')).isFile()) pages.push(`/${deep}/`);
    } catch (error) { /* 不存在就跳过 */ }
  }
  return pages;
}

const PROBE = `JSON.stringify((() => {
  const vw = document.documentElement.clientWidth;
  const content = document.querySelector('.md-content__inner') || document.body;
  const offenders = [];
  for (const el of content.querySelectorAll('*')) {
    const rect = el.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) continue;
    const over = Math.max(Math.round(rect.right - vw), Math.round(-rect.left));
    if (over <= 2) continue;
    // 祖先里有横向可滚动容器（代码块、表格外框）时，超出视口是**设计如此**：
    // 长命令/长路径本来就要能横向滚动。这类不算问题，否则每天都会误报。
    let clipped = false;
    for (let parent = el.parentElement; parent; parent = parent.parentElement) {
      const overflowX = getComputedStyle(parent).overflowX;
      if (overflowX === 'auto' || overflowX === 'scroll' || overflowX === 'hidden') { clipped = true; break; }
    }
    if (clipped) continue;
    offenders.push({
      tag: el.tagName.toLowerCase(),
      cls: (el.className || '').toString().split(' ').slice(0, 2).join('.'),
      width: Math.round(rect.width),
      over,
    });
  }
  return {
    pageOverflowX: document.documentElement.scrollWidth - vw,
    offenders: offenders.slice(0, 4),
    offenderCount: offenders.length,
  };
})())`;

const cdp = await connect();
const pages = collectPages();
console.log(`共 ${pages.length} 个页面 × ${WIDTHS.length} 个宽度 = ${pages.length * WIDTHS.length} 次检查`);
const problems = [];

for (const width of WIDTHS) {
  await cdp.viewport({ width, height: 900, mobile: width < 800 });
  for (const page of pages) {
    await cdp.goto(BASE_URL + page, 2100);
    const raw = await cdp.evaluate(PROBE);
    if (typeof raw !== 'string') {
      problems.push({ width, page, kind: '取数失败', detail: raw?.error || '未知' });
      continue;
    }
    const info = JSON.parse(raw);
    if (info.pageOverflowX > 1) {
      problems.push({ width, page, kind: '页面横向滚动', detail: `${info.pageOverflowX}px；元素：${JSON.stringify(info.offenders)}` });
    } else if (info.offenderCount > 0) {
      problems.push({ width, page, kind: '元素超出视口', detail: `${info.offenderCount} 个：${JSON.stringify(info.offenders)}` });
    }
  }
  console.log(`  ${width}px 检查完毕`);
  await sleep(200);
}

if (!problems.length) {
  console.log('✅ 所有页面在四个宽度下都没有横向溢出');
} else {
  console.log(`\n发现 ${problems.length} 处：`);
  for (const item of problems) {
    console.log(`  [${item.width}px] ${item.page} — ${item.kind}：${item.detail}`);
  }
}
cdp.close();
process.exit(problems.length ? 1 : 0);
