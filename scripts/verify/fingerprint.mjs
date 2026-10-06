/**
 * 改动前后「看起来一模一样」的自动证明（截图部分）。
 *
 * 用法：
 *   node scripts/verify/fingerprint.mjs before                    # 改代码之前跑，存一份基线
 *   node scripts/verify/fingerprint.mjs after                     # 改完再跑，存一份结果
 *   python scripts/verify/compare_fingerprint.py before after     # 逐像素与逐属性比对
 *
 * 它做两件事：
 *   1. 6 个页面/视口 —— 首页（桌面/手机/深色）、跳蚤市场弹窗、赞助弹窗、宠物收集录；
 *   2. 11 个关键元素的 computed style（含两个弹窗的圆角、宽度、内边距）。
 * 光看截图会漏掉「颜色变了但形状没变」这类问题，所以两边都要比。
 *
 * 比对放在 Python 里做（Pillow 本来就是本仓库图片脚本的依赖），Node 这边只负责截图。
 *
 * 注意：基线必须取自「改动前的当前提交」。拿几天前的指纹去比，会把别人的改动算进来——
 * 我踩过这个坑，白查了半天。
 */

import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { BASE_URL, OUT_DIR, connect, sleep } from './cdp.mjs';

const PROPS = ['display', 'position', 'backgroundColor', 'color', 'borderRadius', 'borderColor',
  'borderWidth', 'padding', 'margin', 'fontSize', 'fontWeight', 'boxShadow', 'width', 'height',
  'opacity', 'zIndex'];

const SELECTORS = [
  '.md-banner', '.md-header', '.md-header__qq-group', '.md-tabs__list', '.md-content__inner',
  '.md-footer-meta__inner', '.ujn-footer-signature',
  '#donate-modal-overlay .donate-card', '#flea-modal-overlay .flea-card',
  '#pet-deck .pet-card', '.ujn-contributors',
];

async function capture(label) {
  const cdp = await connect();
  const report = { styles: {}, shots: [] };

  const shots = [
    { name: 'home-desktop', page: '/', viewport: { width: 1440, height: 950 }, act: null },
    { name: 'home-flea', page: '/', viewport: { width: 1440, height: 950 }, act: 'open-flea' },
    { name: 'home-donate', page: '/', viewport: { width: 1440, height: 950 }, act: 'open-donate' },
    { name: 'home-dark', page: '/', viewport: { width: 1440, height: 950, scheme: 'dark' }, act: null },
    { name: 'home-mobile', page: '/', viewport: { width: 390, height: 844, mobile: true }, act: null },
    { name: 'pets-mobile', page: '/pets/', viewport: { width: 390, height: 844, mobile: true }, act: null },
  ];

  for (const shot of shots) {
    await cdp.viewport(shot.viewport);
    await cdp.goto(BASE_URL + shot.page, 3500);
    if (shot.act === 'open-flea') {
      const trigger = await cdp.evaluate(`(() => {
        const el = document.querySelector('[data-ujn-modal="flea"]') || document.querySelector('.md-footer-btn--market');
        if (el) { el.click(); return true; } return false;
      })()`);
      if (!trigger) console.warn(`  ${shot.name}: 没找到打开跳蚤市场的入口`);
      await sleep(600);
    }
    if (shot.act === 'open-donate') {
      const trigger = await cdp.evaluate(`(() => {
        const el = document.querySelector('[data-ujn-modal="donate"]') || document.querySelector('.md-footer-btn--donate');
        if (el) { el.click(); return true; } return false;
      })()`);
      if (!trigger) console.warn(`  ${shot.name}: 没找到打开赞助弹窗的入口`);
      await sleep(600);
    }
    const raw = await cdp.send('Page.captureScreenshot', { format: 'png' });
    const file = join(OUT_DIR, `fp-${label}-${shot.name}.png`);
    writeFileSync(file, Buffer.from(raw.data, 'base64'));
    report.shots.push(shot.name);

    if (shot.name === 'home-desktop' || shot.name === 'home-flea' || shot.name === 'home-donate') {
      const styles = await cdp.evaluate(`(() => {
        const props = ${JSON.stringify(PROPS)};
        const out = {};
        for (const selector of ${JSON.stringify(SELECTORS)}) {
          const el = document.querySelector(selector);
          if (!el) { out[selector] = null; continue; }
          const cs = getComputedStyle(el);
          out[selector] = Object.fromEntries(props.map(p => [p, cs[p]]));
        }
        return JSON.stringify(out);
      })()`);
      if (typeof styles === 'string') Object.assign(report.styles, JSON.parse(styles));
    }
  }

  const file = join(OUT_DIR, `fp-${label}.json`);
  writeFileSync(file, JSON.stringify(report, null, 1));
  cdp.close();
  console.log(`${label}: 已保存 ${file} 与 ${report.shots.length} 张截图`);
}

const mode = process.argv[2] || 'before';
await capture(mode);
