/**
 * 命中检测：页面上那些「看起来能点」的东西，真的能点到吗？
 *
 *   node scripts/verify/hit-test.mjs
 *
 * 做法：取元素的中心坐标，用 CDP 在真实坐标上做命中检测（document.elementFromPoint），
 * 要求命中的元素落在该元素内部；再对标签栏做一次**真实鼠标点击**，确认地址真的变了。
 *
 * 为什么不能用 element.click()：它绕过命中检测。曾经有个真实 bug——
 * 顶栏最后一个标签「免责声明」点不动，因为搜索面板关闭时只是 opacity: 0，
 * 里面一块 234×195 的区域仍然可命中，正好压在标签上；用 click() 测永远发现不了。
 */

import { BASE_URL, connect, sleep } from './cdp.mjs';

// 每个宽度下要检查的「应该能点到」的元素。选择器写成列表，命中就通过。
const TARGETS = [
  { name: '页头 · 交流群', selector: '.md-header__qq-group' },
  { name: '页头 · GitHub', selector: '.md-header__repo[href*="github"]' },
  { name: '页头 · Gitee', selector: '.md-header__repo[href*="gitee"]' },
  { name: '页头 · 主题切换', selector: '.md-header__option label.md-header__button:not([hidden])' },
  { name: '顶栏 · 最后一个标签', selector: '.md-tabs__item:last-child .md-tabs__link' },
  // 排除 Material 的标题锚点 .headerlink：它平时不可见（悬停才显形），不是给读者点的
  { name: '正文 · 第一个链接', selector: '.md-content__inner a[href]:not(.headerlink)' },
  { name: '页脚 · 首页入口卡片按钮', selector: '[data-ujn-modal]' },
];

const VIEWPORTS = [
  { label: '桌面 1440', width: 1440, height: 950, mobile: false, page: '/' },
  { label: '手机 390', width: 390, height: 844, mobile: true, page: '/' },
];

const cdp = await connect();
const problems = [];

for (const view of VIEWPORTS) {
  await cdp.viewport({ width: view.width, height: view.height, mobile: view.mobile });
  await cdp.goto(BASE_URL + view.page, 3000);
  // 移动端抽屉里没有这些按钮，跳过不存在的目标
  for (const target of TARGETS) {
    const center = await cdp.centerOf(target.selector);
    if (!center) continue;
    const hit = await cdp.hitTest(center[0], center[1]);
    const inside = await cdp.evaluate(`(() => {
      const el = document.querySelector(${JSON.stringify(target.selector)});
      const top = document.elementFromPoint(${center[0]}, ${center[1]});
      return el && top ? el.contains(top) : false;
    })()`);
    if (inside === true) {
      console.log(`  ✓ [${view.label}] ${target.name}`);
    } else {
      problems.push(`[${view.label}] ${target.name} 点不到——坐标 (${center[0]}, ${center[1]}) 实际命中的是：${hit}`);
      console.log(`  ✗ [${view.label}] ${target.name} → ${hit}`);
    }
  }
}

// 真实鼠标点击标签栏最后一个标签，确认真的会跳转
await cdp.viewport({ width: 1440, height: 950, mobile: false });
await cdp.goto(BASE_URL + '/', 3000);
const before = await cdp.evaluate('location.pathname');
const center = await cdp.centerOf('.md-tabs__item:last-child .md-tabs__link');
if (center) {
  await cdp.clickAt(center[0], center[1]);
  await sleep(2200);
  const after = await cdp.evaluate('location.pathname');
  if (after !== before) {
    console.log(`  ✓ 真实点击最后一个标签：${before.replace('/ujn-guide', '')} → ${after.replace('/ujn-guide', '')}`);
  } else {
    problems.push(`真实点击最后一个标签后地址没变（仍是 ${before}）——说明有东西挡住了它`);
    console.log('  ✗ 真实点击最后一个标签后地址没变');
  }
}

cdp.close();
if (problems.length) {
  console.log(`\n发现 ${problems.length} 处「点不到」：`);
  for (const item of problems) console.log('  - ' + item);
} else {
  console.log('\n✅ 所有目标都能被真实点到');
}
process.exit(problems.length ? 1 : 0);
