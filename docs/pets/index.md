---
tags:
  - 宠物收集录
# 这一页左侧只会显示「宠物收集录」一条（没有下级页面），占着一整列却没用；
# 隐藏后正文变宽并居中。手机端的抽屉导航不受影响（Material 只在宽屏渲染这个侧栏）。
hide:
  - navigation
  # 右侧目录只有「猫猫图集」一条，对着一墙卡片没什么用；去掉后正文更宽、也更容易居中
  - toc
---

# 🐾 宠物收集录

---

## 🐱 猫猫图集

!!! tip "📸 关于本栏目"
    本栏目收集了济南大学校园内的猫咪图集。点击卡牌上的照片可以左右滑动浏览这只猫的全部照片，点击名字进入它的专属页面。

    [:fontawesome-brands-qq: 加入猫猫收集图鉴群聊](https://qm.qq.com/q/IucYbisPys){ .md-button }

<!-- 按名字找猫：筛选逻辑在 gallery.js（筛选结果同样分页，封面按当前页加载）。
     注意写的是「名字」而不是「相关信息」——卡牌上只有名字可以筛，
     正文内容不在页面上，别让读者以为能按特征搜。 -->
<div class="pet-filter">
  <label class="pet-filter__label" for="pet-filter-input">🔍 按名字找猫</label>
  <input class="pet-filter__input" id="pet-filter-input" type="search" autocomplete="off"
    placeholder="例如「优米」「图书馆学长」" aria-describedby="pet-filter-count" />
  <span class="pet-filter__count" id="pet-filter-count" role="status" aria-live="polite"></span>
</div>

<style>
/* 按名字找猫 */
.pet-filter {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: .45rem;
  margin: 1rem 0 1.2rem;
  padding: .6rem .75rem;
  border: 1px solid var(--pet-hairline, var(--ujn-hairline));
  border-radius: var(--ujn-radius-md);
  background: color-mix(in srgb, var(--pet-accent, var(--ujn-accent)) 4%, transparent);
}

.pet-filter__label {
  font-size: .72rem;
  font-weight: 600;
  color: var(--pet-accent, var(--ujn-accent));
}

.pet-filter__input {
  flex: 1 1 12rem;
  min-width: 0;
  padding: .34rem .6rem;
  border: 1px solid var(--pet-hairline, var(--ujn-hairline));
  border-radius: var(--ujn-radius-sm);
  background: var(--md-default-bg-color);
  color: var(--md-default-fg-color);
  font-family: inherit;
  font-size: .72rem;
}

.pet-filter__input:focus-visible {
  outline: 2px solid var(--pet-accent, var(--ujn-accent));
  outline-offset: 1px;
}

.pet-filter__count {
  font-size: .68rem;
  color: var(--pet-muted, var(--ujn-muted));
}


/* ===== 🐾 猫猫图鉴：照片卡牌 / 分页 / 相册弹窗 =====
   纯静态实现：卡牌是构建时生成的 HTML，分页与相册都在浏览器本地完成，
   页面不发送任何接口请求。卡牌区由 scripts/pets/build_gallery.py 生成。 */
#pet-deck,
#pet-pager,
#pet-viewer {
  --pet-accent: var(--md-primary-fg-color);
  --pet-hairline: var(--md-default-fg-color--lightest);
  --pet-muted: var(--md-default-fg-color--light);
}

/* ---------- 照片卡牌 ---------- */
#pet-deck {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: .85rem;
  margin: 1.2rem 0 0;
}

#pet-deck .pet-card {
  display: flex;
  flex-direction: column;
  overflow: hidden;
  background: var(--md-default-bg-color);
  border: 1px solid var(--pet-hairline);
  border-radius: .7rem;
  box-shadow: 0 .1rem .35rem rgba(0, 0, 0, .08);
  transition: transform .22s ease, box-shadow .22s ease, border-color .22s ease;
}

#pet-deck .pet-card:hover,
#pet-deck .pet-card:focus-within {
  transform: translateY(-.2rem);
  border-color: var(--pet-accent);
  box-shadow: 0 .6rem 1.4rem rgba(0, 0, 0, .18);
}

#pet-deck .pet-card.is-hidden {
  display: none;
}

/* 卡牌上部的照片窗口：固定 3:4，居中裁切。
   元素是 <button>（原因见 scripts/pets/build_gallery.py），需要清掉按钮默认样式。 */
#pet-deck .pet-card__shot {
  display: block;
  width: 100%;
  padding: 0;
  border: 0;
  appearance: none;
  -webkit-appearance: none;
  font: inherit;
  color: inherit;
  text-align: inherit;
  aspect-ratio: 3 / 4;
  overflow: hidden;
  cursor: zoom-in;
  background: linear-gradient(135deg, rgba(63, 81, 181, .18), rgba(63, 81, 181, .06));
}

#pet-deck .pet-card__shot img {
  display: block;
  width: 100%;
  height: 100%;
  margin: 0;
  border-radius: 0;
  object-fit: cover;
  object-position: center 32%;
  transition: transform .35s ease;
}

#pet-deck img[data-pet-src]:not([src]) { visibility: hidden; }

#pet-deck .pet-card:hover .pet-card__shot img {
  transform: scale(1.05);
}

/* 卡牌下部的铭牌 */
#pet-deck .pet-card__plate {
  display: flex;
  flex: 1 1 auto;
  align-items: center;
  justify-content: center;
  padding: .5rem .55rem;
  border-top: 1px solid var(--pet-hairline);
  background: linear-gradient(180deg, rgba(63, 81, 181, .07), transparent);
}

#pet-deck .pet-card__plate,
#pet-deck .pet-card__shot {
  color: inherit;
  text-decoration: none;
}

#pet-deck .pet-card__shot:focus-visible {
  outline: 2px solid var(--pet-accent);
  outline-offset: -2px;
}

#pet-deck .pet-card__name {
  overflow: hidden;
  color: var(--md-default-fg-color);
  font-size: .68rem;
  font-weight: 700;
  line-height: 1.3;
  text-align: center;
  white-space: nowrap;
  text-overflow: ellipsis;
}

/* ---------- 分页条 ---------- */
#pet-pager {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: center;
  gap: .34rem;
  margin: 1.15rem 0 .5rem;
}

#pet-pager:empty {
  display: none;
}

/* 页码的形状、字号字重与选中态配色来自共用的 .ujn-pill（见 ujn.css），
   这里只留它没有的：布局、自己的过渡（页码要让 border-color 与 box-shadow 参与过渡）
   以及尺寸与边框。 */
#pet-pager .pet-pager__btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: var(--ujn-radius-pill);
  font-size: .66rem;
  font-weight: 600;
  line-height: 1;
  cursor: pointer;
  transition: transform .15s ease, box-shadow .15s ease, border-color .15s ease,
    background-color .15s ease, color .15s ease;
}

#pet-pager .pet-pager__num {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  line-height: 1;
  transition: transform .15s ease, box-shadow .15s ease, border-color .15s ease,
    background-color .15s ease, color .15s ease;
}

#pet-pager .pet-pager__btn {
  gap: .2rem;
  padding: .42rem .78rem;
  border: 1px solid color-mix(in srgb, var(--pet-accent) 35%, transparent);
  background: linear-gradient(135deg,
      color-mix(in srgb, var(--pet-accent) 10%, transparent),
      color-mix(in srgb, var(--pet-accent) 4%, transparent));
  color: var(--md-default-fg-color);
  box-shadow: 0 .08rem .28rem rgba(0, 0, 0, .06);
}

#pet-pager .pet-pager__btn:hover:not(:disabled) {
  transform: translateY(-1px);
  box-shadow: 0 .2rem .5rem rgba(0, 0, 0, .12);
}

#pet-pager .pet-pager__btn:disabled {
  opacity: .4;
  cursor: not-allowed;
}

#pet-pager .pet-pager__num {
  min-width: 1.65rem;
  height: 1.65rem;
  padding: 0 .35rem;
  border: 1px solid var(--pet-hairline);
}

/* 底色只给未选中的页码：选中态的底色来自 .ujn-pill.is-active，
   如果这里不加 :not()，ID 选择器会把它压回去（实测过，会让选中页码变白）。 */
#pet-pager .pet-pager__num:not(.is-active) {
  background: var(--md-default-bg-color);
}

#pet-pager .pet-pager__num:hover {
  border-color: var(--pet-accent);
  color: var(--pet-accent);
}

#pet-pager .pet-pager__num.is-active {
  border-color: transparent;
  box-shadow: 0 .1rem .35rem color-mix(in srgb, var(--pet-accent) 45%, transparent);
}

#pet-pager .pet-pager__gap {
  color: var(--pet-muted);
  font-size: .66rem;
  padding: 0 .1rem;
}

#pet-pager .pet-pager__meta {
  color: var(--pet-muted);
  font-size: .62rem;
  margin-left: .3rem;
  white-space: nowrap;
}

#pet-pager .pet-pager__btn:focus-visible,
#pet-pager .pet-pager__num:focus-visible {
  outline: 2px solid var(--pet-accent);
  outline-offset: 2px;
}

/* ---------- 相册弹窗 ---------- */
body.pet-viewer-open {
  overflow: hidden;
}

#pet-viewer {
  position: fixed;
  inset: 0;
  z-index: 20000;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: .6rem;
}

#pet-viewer[hidden] {
  display: none;
}

#pet-viewer .pet-viewer__backdrop {
  position: absolute;
  inset: 0;
  background: rgba(12, 16, 28, .74);
}

#pet-viewer .pet-viewer__panel {
  position: relative;
  display: grid;
  grid-template-rows: auto minmax(0, 1fr) auto;
  width: min(100%, 58rem);
  max-height: calc(100dvh - 1.2rem);
  overflow: hidden;
  background: var(--md-default-bg-color);
  border-radius: .8rem;
  box-shadow: 0 1rem 2.6rem rgba(0, 0, 0, .45);
  animation: pet-viewer-in .18s ease-out;
}

@keyframes pet-viewer-in {
  from {
    opacity: 0;
    transform: scale(.97);
  }
}

#pet-viewer .pet-viewer__bar {
  display: flex;
  align-items: center;
  gap: .5rem;
  padding: .55rem .7rem;
  border-bottom: 1px solid var(--pet-hairline);
}

#pet-viewer .pet-viewer__title {
  font-size: .78rem;
  font-weight: 700;
}

#pet-viewer .pet-viewer__count {
  color: var(--pet-muted);
  font-size: .64rem;
}

#pet-viewer .pet-viewer__close {
  margin-left: auto;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 1.75rem;
  height: 1.75rem;
  flex: 0 0 auto;
  border: 1px solid var(--pet-hairline);
  border-radius: 50%;
  background: transparent;
  color: var(--md-default-fg-color);
  font-size: .8rem;
  line-height: 1;
  cursor: pointer;
  transition: border-color .15s ease, color .15s ease;
}

#pet-viewer .pet-viewer__close:hover {
  border-color: var(--pet-accent);
  color: var(--pet-accent);
}

#pet-viewer .pet-viewer__stage {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 0;
  background: var(--md-code-bg-color);
  touch-action: none;
}

#pet-viewer .pet-viewer__img {
  max-width: 100%;
  max-height: 100%;
  width: auto;
  height: auto;
  margin: 0;
  border-radius: 0;
  object-fit: contain;
  user-select: none;
  -webkit-user-drag: none;
  transition: opacity .18s ease;
}

#pet-viewer .pet-viewer__img.is-loading {
  opacity: .35;
}

#pet-viewer .pet-viewer__nav {
  position: absolute;
  top: 50%;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 2.2rem;
  height: 2.2rem;
  transform: translateY(-50%);
  border: 1px solid rgba(255, 255, 255, .28);
  border-radius: 50%;
  background: rgba(12, 16, 28, .42);
  color: #fff;
  font-size: 1.1rem;
  line-height: 1;
  cursor: pointer;
  transition: background-color .15s ease, transform .15s ease;
}

#pet-viewer .pet-viewer__nav:hover {
  background: rgba(12, 16, 28, .68);
}

#pet-viewer .pet-viewer__nav:disabled {
  opacity: 0;
  pointer-events: none;
}

#pet-viewer .pet-viewer__nav--prev {
  left: .55rem;
}

#pet-viewer .pet-viewer__nav--next {
  right: .55rem;
}

#pet-viewer .pet-viewer__dots {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: .3rem;
  padding: .55rem .7rem;
  border-top: 1px solid var(--pet-hairline);
}

#pet-viewer .pet-viewer__dots:empty {
  display: none;
}

#pet-viewer .pet-viewer__dot {
  min-width: 1.4rem;
  height: 1.4rem;
  padding: 0 .3rem;
  border: 1px solid var(--pet-hairline);
  border-radius: 999px;
  background: transparent;
  color: var(--md-default-fg-color);
  font-family: inherit;
  font-size: .6rem;
  font-weight: 600;
  cursor: pointer;
  transition: border-color .15s ease, background-color .15s ease, color .15s ease;
}

#pet-viewer .pet-viewer__dot:hover {
  border-color: var(--pet-accent);
  color: var(--pet-accent);
}

#pet-viewer .pet-viewer__dot.is-active {
  border-color: transparent;
  background: var(--pet-accent);
  color: #fff;
}

/* ---------- 深色主题微调 ---------- */
/* 深色主题下选中态的文字色由 .ujn-pill.is-active 统一处理，这里只剩查看器圆点 */
[data-md-color-scheme="slate"] #pet-viewer .pet-viewer__dot.is-active {
  color: #0b1220;
}

[data-md-color-scheme="slate"] #pet-deck .pet-card {
  box-shadow: 0 .1rem .4rem rgba(0, 0, 0, .35);
}

/* ---------- 窄屏适配 ---------- */
@media screen and (max-width: 900px) {
  #pet-deck { grid-template-columns: repeat(2, minmax(0, 1fr)); }
}
@media screen and (max-width: 640px) {
  #pet-deck {
    gap: .6rem;
  }

  #pet-deck .pet-card__plate {
    padding: .42rem .45rem;
  }

  #pet-pager .pet-pager__meta {
    display: inline;
  }

  #pet-viewer {
    padding: 0;
  }

  #pet-viewer .pet-viewer__panel {
    width: 100%;
    max-height: 100dvh;
    height: 100dvh;
    border-radius: 0;
  }

  #pet-viewer .pet-viewer__nav {
    width: 2rem;
    height: 2rem;
  }
}
</style>

<div class="pet-deck" id="pet-deck">
<!-- pets:deck:start -->
  <div class="pet-card" data-name="cooler（图书馆学长）" data-photos="../assets/images/%E5%AE%A0%E7%89%A9%E6%94%B6%E9%9B%86%E5%BD%95/%E7%8C%AB%E7%8C%AB%E5%9B%BE%E9%9B%86/cooler%EF%BC%88%E5%9B%BE%E4%B9%A6%E9%A6%86%E5%AD%A6%E9%95%BF%EF%BC%891.webp|../assets/images/%E5%AE%A0%E7%89%A9%E6%94%B6%E9%9B%86%E5%BD%95/%E7%8C%AB%E7%8C%AB%E5%9B%BE%E9%9B%86/cooler%EF%BC%88%E5%9B%BE%E4%B9%A6%E9%A6%86%E5%AD%A6%E9%95%BF%EF%BC%892.webp|../assets/images/%E5%AE%A0%E7%89%A9%E6%94%B6%E9%9B%86%E5%BD%95/%E7%8C%AB%E7%8C%AB%E5%9B%BE%E9%9B%86/cooler%EF%BC%88%E5%9B%BE%E4%B9%A6%E9%A6%86%E5%AD%A6%E9%95%BF%EF%BC%893.webp|../assets/images/%E5%AE%A0%E7%89%A9%E6%94%B6%E9%9B%86%E5%BD%95/%E7%8C%AB%E7%8C%AB%E5%9B%BE%E9%9B%86/cooler%EF%BC%88%E5%9B%BE%E4%B9%A6%E9%A6%86%E5%AD%A6%E9%95%BF%EF%BC%894.webp|../assets/images/%E5%AE%A0%E7%89%A9%E6%94%B6%E9%9B%86%E5%BD%95/%E7%8C%AB%E7%8C%AB%E5%9B%BE%E9%9B%86/cooler%EF%BC%88%E5%9B%BE%E4%B9%A6%E9%A6%86%E5%AD%A6%E9%95%BF%EF%BC%895.webp|../assets/images/%E5%AE%A0%E7%89%A9%E6%94%B6%E9%9B%86%E5%BD%95/%E7%8C%AB%E7%8C%AB%E5%9B%BE%E9%9B%86/cooler%EF%BC%88%E5%9B%BE%E4%B9%A6%E9%A6%86%E5%AD%A6%E9%95%BF%EF%BC%896.webp|../assets/images/%E5%AE%A0%E7%89%A9%E6%94%B6%E9%9B%86%E5%BD%95/%E7%8C%AB%E7%8C%AB%E5%9B%BE%E9%9B%86/cooler%EF%BC%88%E5%9B%BE%E4%B9%A6%E9%A6%86%E5%AD%A6%E9%95%BF%EF%BC%897.webp">
    <button class="pet-card__shot" type="button" aria-label="cooler（图书馆学长）：查看 7 张照片">
      <img class="pet-photo" data-pet-src="../assets/images/%E5%AE%A0%E7%89%A9%E6%94%B6%E9%9B%86%E5%BD%95/%E7%8C%AB%E7%8C%AB%E5%9B%BE%E9%9B%86/thumbs/cooler%EF%BC%88%E5%9B%BE%E4%B9%A6%E9%A6%86%E5%AD%A6%E9%95%BF%EF%BC%891.webp" alt="cooler（图书馆学长）" loading="lazy" decoding="async">
      <noscript><img src="../assets/images/%E5%AE%A0%E7%89%A9%E6%94%B6%E9%9B%86%E5%BD%95/%E7%8C%AB%E7%8C%AB%E5%9B%BE%E9%9B%86/thumbs/cooler%EF%BC%88%E5%9B%BE%E4%B9%A6%E9%A6%86%E5%AD%A6%E9%95%BF%EF%BC%891.webp" alt="cooler（图书馆学长）" loading="lazy" decoding="async"></noscript>
    </button>
    <a class="pet-card__plate" href="cats/cooler-%E5%9B%BE%E4%B9%A6%E9%A6%86%E5%AD%A6%E9%95%BF/"><span class="pet-card__name">cooler（图书馆学长）</span></a>
  </div>
  <div class="pet-card" data-name="优米" data-photos="../assets/images/%E5%AE%A0%E7%89%A9%E6%94%B6%E9%9B%86%E5%BD%95/%E7%8C%AB%E7%8C%AB%E5%9B%BE%E9%9B%86/%E4%BC%98%E7%B1%B31.webp|../assets/images/%E5%AE%A0%E7%89%A9%E6%94%B6%E9%9B%86%E5%BD%95/%E7%8C%AB%E7%8C%AB%E5%9B%BE%E9%9B%86/%E4%BC%98%E7%B1%B32.webp">
    <button class="pet-card__shot" type="button" aria-label="优米：查看 2 张照片">
      <img class="pet-photo" data-pet-src="../assets/images/%E5%AE%A0%E7%89%A9%E6%94%B6%E9%9B%86%E5%BD%95/%E7%8C%AB%E7%8C%AB%E5%9B%BE%E9%9B%86/thumbs/%E4%BC%98%E7%B1%B31.webp" alt="优米" loading="lazy" decoding="async">
      <noscript><img src="../assets/images/%E5%AE%A0%E7%89%A9%E6%94%B6%E9%9B%86%E5%BD%95/%E7%8C%AB%E7%8C%AB%E5%9B%BE%E9%9B%86/thumbs/%E4%BC%98%E7%B1%B31.webp" alt="优米" loading="lazy" decoding="async"></noscript>
    </button>
    <a class="pet-card__plate" href="cats/%E4%BC%98%E7%B1%B3/"><span class="pet-card__name">优米</span></a>
  </div>
  <div class="pet-card" data-name="元老" data-photos="../assets/images/%E5%AE%A0%E7%89%A9%E6%94%B6%E9%9B%86%E5%BD%95/%E7%8C%AB%E7%8C%AB%E5%9B%BE%E9%9B%86/%E5%85%83%E8%80%811.webp">
    <button class="pet-card__shot" type="button" aria-label="元老：查看 1 张照片">
      <img class="pet-photo" data-pet-src="../assets/images/%E5%AE%A0%E7%89%A9%E6%94%B6%E9%9B%86%E5%BD%95/%E7%8C%AB%E7%8C%AB%E5%9B%BE%E9%9B%86/thumbs/%E5%85%83%E8%80%811.webp" alt="元老" loading="lazy" decoding="async">
      <noscript><img src="../assets/images/%E5%AE%A0%E7%89%A9%E6%94%B6%E9%9B%86%E5%BD%95/%E7%8C%AB%E7%8C%AB%E5%9B%BE%E9%9B%86/thumbs/%E5%85%83%E8%80%811.webp" alt="元老" loading="lazy" decoding="async"></noscript>
    </button>
    <a class="pet-card__plate" href="cats/%E5%85%83%E8%80%81/"><span class="pet-card__name">元老</span></a>
  </div>
  <div class="pet-card" data-name="公主" data-photos="../assets/images/%E5%AE%A0%E7%89%A9%E6%94%B6%E9%9B%86%E5%BD%95/%E7%8C%AB%E7%8C%AB%E5%9B%BE%E9%9B%86/%E5%85%AC%E4%B8%BB1.webp|../assets/images/%E5%AE%A0%E7%89%A9%E6%94%B6%E9%9B%86%E5%BD%95/%E7%8C%AB%E7%8C%AB%E5%9B%BE%E9%9B%86/%E5%85%AC%E4%B8%BB2.webp|../assets/images/%E5%AE%A0%E7%89%A9%E6%94%B6%E9%9B%86%E5%BD%95/%E7%8C%AB%E7%8C%AB%E5%9B%BE%E9%9B%86/%E5%85%AC%E4%B8%BB3.webp|../assets/images/%E5%AE%A0%E7%89%A9%E6%94%B6%E9%9B%86%E5%BD%95/%E7%8C%AB%E7%8C%AB%E5%9B%BE%E9%9B%86/%E5%85%AC%E4%B8%BB4.webp">
    <button class="pet-card__shot" type="button" aria-label="公主：查看 4 张照片">
      <img class="pet-photo" data-pet-src="../assets/images/%E5%AE%A0%E7%89%A9%E6%94%B6%E9%9B%86%E5%BD%95/%E7%8C%AB%E7%8C%AB%E5%9B%BE%E9%9B%86/thumbs/%E5%85%AC%E4%B8%BB1.webp" alt="公主" loading="lazy" decoding="async">
      <noscript><img src="../assets/images/%E5%AE%A0%E7%89%A9%E6%94%B6%E9%9B%86%E5%BD%95/%E7%8C%AB%E7%8C%AB%E5%9B%BE%E9%9B%86/thumbs/%E5%85%AC%E4%B8%BB1.webp" alt="公主" loading="lazy" decoding="async"></noscript>
    </button>
    <a class="pet-card__plate" href="cats/%E5%85%AC%E4%B8%BB/"><span class="pet-card__name">公主</span></a>
  </div>
  <div class="pet-card" data-name="凶凶" data-photos="../assets/images/%E5%AE%A0%E7%89%A9%E6%94%B6%E9%9B%86%E5%BD%95/%E7%8C%AB%E7%8C%AB%E5%9B%BE%E9%9B%86/%E5%87%B6%E5%87%B61.webp">
    <button class="pet-card__shot" type="button" aria-label="凶凶：查看 1 张照片">
      <img class="pet-photo" data-pet-src="../assets/images/%E5%AE%A0%E7%89%A9%E6%94%B6%E9%9B%86%E5%BD%95/%E7%8C%AB%E7%8C%AB%E5%9B%BE%E9%9B%86/thumbs/%E5%87%B6%E5%87%B61.webp" alt="凶凶" loading="lazy" decoding="async">
      <noscript><img src="../assets/images/%E5%AE%A0%E7%89%A9%E6%94%B6%E9%9B%86%E5%BD%95/%E7%8C%AB%E7%8C%AB%E5%9B%BE%E9%9B%86/thumbs/%E5%87%B6%E5%87%B61.webp" alt="凶凶" loading="lazy" decoding="async"></noscript>
    </button>
    <a class="pet-card__plate" href="cats/%E5%87%B6%E5%87%B6/"><span class="pet-card__name">凶凶</span></a>
  </div>
  <div class="pet-card" data-name="口水巾" data-photos="../assets/images/%E5%AE%A0%E7%89%A9%E6%94%B6%E9%9B%86%E5%BD%95/%E7%8C%AB%E7%8C%AB%E5%9B%BE%E9%9B%86/%E5%8F%A3%E6%B0%B4%E5%B7%BE1.webp|../assets/images/%E5%AE%A0%E7%89%A9%E6%94%B6%E9%9B%86%E5%BD%95/%E7%8C%AB%E7%8C%AB%E5%9B%BE%E9%9B%86/%E5%8F%A3%E6%B0%B4%E5%B7%BE2.webp|../assets/images/%E5%AE%A0%E7%89%A9%E6%94%B6%E9%9B%86%E5%BD%95/%E7%8C%AB%E7%8C%AB%E5%9B%BE%E9%9B%86/%E5%8F%A3%E6%B0%B4%E5%B7%BE3.webp">
    <button class="pet-card__shot" type="button" aria-label="口水巾：查看 3 张照片">
      <img class="pet-photo" data-pet-src="../assets/images/%E5%AE%A0%E7%89%A9%E6%94%B6%E9%9B%86%E5%BD%95/%E7%8C%AB%E7%8C%AB%E5%9B%BE%E9%9B%86/thumbs/%E5%8F%A3%E6%B0%B4%E5%B7%BE1.webp" alt="口水巾" loading="lazy" decoding="async">
      <noscript><img src="../assets/images/%E5%AE%A0%E7%89%A9%E6%94%B6%E9%9B%86%E5%BD%95/%E7%8C%AB%E7%8C%AB%E5%9B%BE%E9%9B%86/thumbs/%E5%8F%A3%E6%B0%B4%E5%B7%BE1.webp" alt="口水巾" loading="lazy" decoding="async"></noscript>
    </button>
    <a class="pet-card__plate" href="cats/%E5%8F%A3%E6%B0%B4%E5%B7%BE/"><span class="pet-card__name">口水巾</span></a>
  </div>
  <div class="pet-card" data-name="团子" data-photos="../assets/images/%E5%AE%A0%E7%89%A9%E6%94%B6%E9%9B%86%E5%BD%95/%E7%8C%AB%E7%8C%AB%E5%9B%BE%E9%9B%86/%E5%9B%A2%E5%AD%901.webp">
    <button class="pet-card__shot" type="button" aria-label="团子：查看 1 张照片">
      <img class="pet-photo" data-pet-src="../assets/images/%E5%AE%A0%E7%89%A9%E6%94%B6%E9%9B%86%E5%BD%95/%E7%8C%AB%E7%8C%AB%E5%9B%BE%E9%9B%86/thumbs/%E5%9B%A2%E5%AD%901.webp" alt="团子" loading="lazy" decoding="async">
      <noscript><img src="../assets/images/%E5%AE%A0%E7%89%A9%E6%94%B6%E9%9B%86%E5%BD%95/%E7%8C%AB%E7%8C%AB%E5%9B%BE%E9%9B%86/thumbs/%E5%9B%A2%E5%AD%901.webp" alt="团子" loading="lazy" decoding="async"></noscript>
    </button>
    <a class="pet-card__plate" href="cats/%E5%9B%A2%E5%AD%90/"><span class="pet-card__name">团子</span></a>
  </div>
  <div class="pet-card" data-name="夸夸" data-photos="../assets/images/%E5%AE%A0%E7%89%A9%E6%94%B6%E9%9B%86%E5%BD%95/%E7%8C%AB%E7%8C%AB%E5%9B%BE%E9%9B%86/%E5%A4%B8%E5%A4%B81.webp|../assets/images/%E5%AE%A0%E7%89%A9%E6%94%B6%E9%9B%86%E5%BD%95/%E7%8C%AB%E7%8C%AB%E5%9B%BE%E9%9B%86/%E5%A4%B8%E5%A4%B82.webp|../assets/images/%E5%AE%A0%E7%89%A9%E6%94%B6%E9%9B%86%E5%BD%95/%E7%8C%AB%E7%8C%AB%E5%9B%BE%E9%9B%86/%E5%A4%B8%E5%A4%B83.webp">
    <button class="pet-card__shot" type="button" aria-label="夸夸：查看 3 张照片">
      <img class="pet-photo" data-pet-src="../assets/images/%E5%AE%A0%E7%89%A9%E6%94%B6%E9%9B%86%E5%BD%95/%E7%8C%AB%E7%8C%AB%E5%9B%BE%E9%9B%86/thumbs/%E5%A4%B8%E5%A4%B81.webp" alt="夸夸" loading="lazy" decoding="async">
      <noscript><img src="../assets/images/%E5%AE%A0%E7%89%A9%E6%94%B6%E9%9B%86%E5%BD%95/%E7%8C%AB%E7%8C%AB%E5%9B%BE%E9%9B%86/thumbs/%E5%A4%B8%E5%A4%B81.webp" alt="夸夸" loading="lazy" decoding="async"></noscript>
    </button>
    <a class="pet-card__plate" href="cats/%E5%A4%B8%E5%A4%B8/"><span class="pet-card__name">夸夸</span></a>
  </div>
  <div class="pet-card" data-name="奇美拉" data-photos="../assets/images/%E5%AE%A0%E7%89%A9%E6%94%B6%E9%9B%86%E5%BD%95/%E7%8C%AB%E7%8C%AB%E5%9B%BE%E9%9B%86/%E5%A5%87%E7%BE%8E%E6%8B%891.webp|../assets/images/%E5%AE%A0%E7%89%A9%E6%94%B6%E9%9B%86%E5%BD%95/%E7%8C%AB%E7%8C%AB%E5%9B%BE%E9%9B%86/%E5%A5%87%E7%BE%8E%E6%8B%892.webp|../assets/images/%E5%AE%A0%E7%89%A9%E6%94%B6%E9%9B%86%E5%BD%95/%E7%8C%AB%E7%8C%AB%E5%9B%BE%E9%9B%86/%E5%A5%87%E7%BE%8E%E6%8B%893.webp|../assets/images/%E5%AE%A0%E7%89%A9%E6%94%B6%E9%9B%86%E5%BD%95/%E7%8C%AB%E7%8C%AB%E5%9B%BE%E9%9B%86/%E5%A5%87%E7%BE%8E%E6%8B%894.webp">
    <button class="pet-card__shot" type="button" aria-label="奇美拉：查看 4 张照片">
      <img class="pet-photo" data-pet-src="../assets/images/%E5%AE%A0%E7%89%A9%E6%94%B6%E9%9B%86%E5%BD%95/%E7%8C%AB%E7%8C%AB%E5%9B%BE%E9%9B%86/thumbs/%E5%A5%87%E7%BE%8E%E6%8B%891.webp" alt="奇美拉" loading="lazy" decoding="async">
      <noscript><img src="../assets/images/%E5%AE%A0%E7%89%A9%E6%94%B6%E9%9B%86%E5%BD%95/%E7%8C%AB%E7%8C%AB%E5%9B%BE%E9%9B%86/thumbs/%E5%A5%87%E7%BE%8E%E6%8B%891.webp" alt="奇美拉" loading="lazy" decoding="async"></noscript>
    </button>
    <a class="pet-card__plate" href="cats/%E5%A5%87%E7%BE%8E%E6%8B%89/"><span class="pet-card__name">奇美拉</span></a>
  </div>
  <div class="pet-card" data-name="奥利奥" data-photos="../assets/images/%E5%AE%A0%E7%89%A9%E6%94%B6%E9%9B%86%E5%BD%95/%E7%8C%AB%E7%8C%AB%E5%9B%BE%E9%9B%86/%E5%A5%A5%E5%88%A9%E5%A5%A51.webp|../assets/images/%E5%AE%A0%E7%89%A9%E6%94%B6%E9%9B%86%E5%BD%95/%E7%8C%AB%E7%8C%AB%E5%9B%BE%E9%9B%86/%E5%A5%A5%E5%88%A9%E5%A5%A52.webp|../assets/images/%E5%AE%A0%E7%89%A9%E6%94%B6%E9%9B%86%E5%BD%95/%E7%8C%AB%E7%8C%AB%E5%9B%BE%E9%9B%86/%E5%A5%A5%E5%88%A9%E5%A5%A53.webp|../assets/images/%E5%AE%A0%E7%89%A9%E6%94%B6%E9%9B%86%E5%BD%95/%E7%8C%AB%E7%8C%AB%E5%9B%BE%E9%9B%86/%E5%A5%A5%E5%88%A9%E5%A5%A54.webp">
    <button class="pet-card__shot" type="button" aria-label="奥利奥：查看 4 张照片">
      <img class="pet-photo" data-pet-src="../assets/images/%E5%AE%A0%E7%89%A9%E6%94%B6%E9%9B%86%E5%BD%95/%E7%8C%AB%E7%8C%AB%E5%9B%BE%E9%9B%86/thumbs/%E5%A5%A5%E5%88%A9%E5%A5%A51.webp" alt="奥利奥" loading="lazy" decoding="async">
      <noscript><img src="../assets/images/%E5%AE%A0%E7%89%A9%E6%94%B6%E9%9B%86%E5%BD%95/%E7%8C%AB%E7%8C%AB%E5%9B%BE%E9%9B%86/thumbs/%E5%A5%A5%E5%88%A9%E5%A5%A51.webp" alt="奥利奥" loading="lazy" decoding="async"></noscript>
    </button>
    <a class="pet-card__plate" href="cats/%E5%A5%A5%E5%88%A9%E5%A5%A5/"><span class="pet-card__name">奥利奥</span></a>
  </div>
  <div class="pet-card" data-name="娓娓" data-photos="../assets/images/%E5%AE%A0%E7%89%A9%E6%94%B6%E9%9B%86%E5%BD%95/%E7%8C%AB%E7%8C%AB%E5%9B%BE%E9%9B%86/%E5%A8%93%E5%A8%931.webp">
    <button class="pet-card__shot" type="button" aria-label="娓娓：查看 1 张照片">
      <img class="pet-photo" data-pet-src="../assets/images/%E5%AE%A0%E7%89%A9%E6%94%B6%E9%9B%86%E5%BD%95/%E7%8C%AB%E7%8C%AB%E5%9B%BE%E9%9B%86/thumbs/%E5%A8%93%E5%A8%931.webp" alt="娓娓" loading="lazy" decoding="async">
      <noscript><img src="../assets/images/%E5%AE%A0%E7%89%A9%E6%94%B6%E9%9B%86%E5%BD%95/%E7%8C%AB%E7%8C%AB%E5%9B%BE%E9%9B%86/thumbs/%E5%A8%93%E5%A8%931.webp" alt="娓娓" loading="lazy" decoding="async"></noscript>
    </button>
    <a class="pet-card__plate" href="cats/%E5%A8%93%E5%A8%93/"><span class="pet-card__name">娓娓</span></a>
  </div>
  <div class="pet-card" data-name="小白" data-photos="../assets/images/%E5%AE%A0%E7%89%A9%E6%94%B6%E9%9B%86%E5%BD%95/%E7%8C%AB%E7%8C%AB%E5%9B%BE%E9%9B%86/%E5%B0%8F%E7%99%BD1.webp|../assets/images/%E5%AE%A0%E7%89%A9%E6%94%B6%E9%9B%86%E5%BD%95/%E7%8C%AB%E7%8C%AB%E5%9B%BE%E9%9B%86/%E5%B0%8F%E7%99%BD2.webp">
    <button class="pet-card__shot" type="button" aria-label="小白：查看 2 张照片">
      <img class="pet-photo" data-pet-src="../assets/images/%E5%AE%A0%E7%89%A9%E6%94%B6%E9%9B%86%E5%BD%95/%E7%8C%AB%E7%8C%AB%E5%9B%BE%E9%9B%86/thumbs/%E5%B0%8F%E7%99%BD1.webp" alt="小白" loading="lazy" decoding="async">
      <noscript><img src="../assets/images/%E5%AE%A0%E7%89%A9%E6%94%B6%E9%9B%86%E5%BD%95/%E7%8C%AB%E7%8C%AB%E5%9B%BE%E9%9B%86/thumbs/%E5%B0%8F%E7%99%BD1.webp" alt="小白" loading="lazy" decoding="async"></noscript>
    </button>
    <a class="pet-card__plate" href="cats/%E5%B0%8F%E7%99%BD/"><span class="pet-card__name">小白</span></a>
  </div>
  <div class="pet-card" data-name="小破" data-photos="../assets/images/%E5%AE%A0%E7%89%A9%E6%94%B6%E9%9B%86%E5%BD%95/%E7%8C%AB%E7%8C%AB%E5%9B%BE%E9%9B%86/%E5%B0%8F%E7%A0%B41.webp">
    <button class="pet-card__shot" type="button" aria-label="小破：查看 1 张照片">
      <img class="pet-photo" data-pet-src="../assets/images/%E5%AE%A0%E7%89%A9%E6%94%B6%E9%9B%86%E5%BD%95/%E7%8C%AB%E7%8C%AB%E5%9B%BE%E9%9B%86/thumbs/%E5%B0%8F%E7%A0%B41.webp" alt="小破" loading="lazy" decoding="async">
      <noscript><img src="../assets/images/%E5%AE%A0%E7%89%A9%E6%94%B6%E9%9B%86%E5%BD%95/%E7%8C%AB%E7%8C%AB%E5%9B%BE%E9%9B%86/thumbs/%E5%B0%8F%E7%A0%B41.webp" alt="小破" loading="lazy" decoding="async"></noscript>
    </button>
    <a class="pet-card__plate" href="cats/%E5%B0%8F%E7%A0%B4/"><span class="pet-card__name">小破</span></a>
  </div>
  <div class="pet-card" data-name="小米花" data-photos="../assets/images/%E5%AE%A0%E7%89%A9%E6%94%B6%E9%9B%86%E5%BD%95/%E7%8C%AB%E7%8C%AB%E5%9B%BE%E9%9B%86/%E5%B0%8F%E7%B1%B3%E8%8A%B11.webp|../assets/images/%E5%AE%A0%E7%89%A9%E6%94%B6%E9%9B%86%E5%BD%95/%E7%8C%AB%E7%8C%AB%E5%9B%BE%E9%9B%86/%E5%B0%8F%E7%B1%B3%E8%8A%B12.webp|../assets/images/%E5%AE%A0%E7%89%A9%E6%94%B6%E9%9B%86%E5%BD%95/%E7%8C%AB%E7%8C%AB%E5%9B%BE%E9%9B%86/%E5%B0%8F%E7%B1%B3%E8%8A%B13.webp|../assets/images/%E5%AE%A0%E7%89%A9%E6%94%B6%E9%9B%86%E5%BD%95/%E7%8C%AB%E7%8C%AB%E5%9B%BE%E9%9B%86/%E5%B0%8F%E7%B1%B3%E8%8A%B14.webp">
    <button class="pet-card__shot" type="button" aria-label="小米花：查看 4 张照片">
      <img class="pet-photo" data-pet-src="../assets/images/%E5%AE%A0%E7%89%A9%E6%94%B6%E9%9B%86%E5%BD%95/%E7%8C%AB%E7%8C%AB%E5%9B%BE%E9%9B%86/thumbs/%E5%B0%8F%E7%B1%B3%E8%8A%B11.webp" alt="小米花" loading="lazy" decoding="async">
      <noscript><img src="../assets/images/%E5%AE%A0%E7%89%A9%E6%94%B6%E9%9B%86%E5%BD%95/%E7%8C%AB%E7%8C%AB%E5%9B%BE%E9%9B%86/thumbs/%E5%B0%8F%E7%B1%B3%E8%8A%B11.webp" alt="小米花" loading="lazy" decoding="async"></noscript>
    </button>
    <a class="pet-card__plate" href="cats/%E5%B0%8F%E7%B1%B3%E8%8A%B1/"><span class="pet-card__name">小米花</span></a>
  </div>
  <div class="pet-card" data-name="小糯米" data-photos="../assets/images/%E5%AE%A0%E7%89%A9%E6%94%B6%E9%9B%86%E5%BD%95/%E7%8C%AB%E7%8C%AB%E5%9B%BE%E9%9B%86/%E5%B0%8F%E7%B3%AF%E7%B1%B31.webp|../assets/images/%E5%AE%A0%E7%89%A9%E6%94%B6%E9%9B%86%E5%BD%95/%E7%8C%AB%E7%8C%AB%E5%9B%BE%E9%9B%86/%E5%B0%8F%E7%B3%AF%E7%B1%B32.webp|../assets/images/%E5%AE%A0%E7%89%A9%E6%94%B6%E9%9B%86%E5%BD%95/%E7%8C%AB%E7%8C%AB%E5%9B%BE%E9%9B%86/%E5%B0%8F%E7%B3%AF%E7%B1%B33.webp|../assets/images/%E5%AE%A0%E7%89%A9%E6%94%B6%E9%9B%86%E5%BD%95/%E7%8C%AB%E7%8C%AB%E5%9B%BE%E9%9B%86/%E5%B0%8F%E7%B3%AF%E7%B1%B34.webp">
    <button class="pet-card__shot" type="button" aria-label="小糯米：查看 4 张照片">
      <img class="pet-photo" data-pet-src="../assets/images/%E5%AE%A0%E7%89%A9%E6%94%B6%E9%9B%86%E5%BD%95/%E7%8C%AB%E7%8C%AB%E5%9B%BE%E9%9B%86/thumbs/%E5%B0%8F%E7%B3%AF%E7%B1%B31.webp" alt="小糯米" loading="lazy" decoding="async">
      <noscript><img src="../assets/images/%E5%AE%A0%E7%89%A9%E6%94%B6%E9%9B%86%E5%BD%95/%E7%8C%AB%E7%8C%AB%E5%9B%BE%E9%9B%86/thumbs/%E5%B0%8F%E7%B3%AF%E7%B1%B31.webp" alt="小糯米" loading="lazy" decoding="async"></noscript>
    </button>
    <a class="pet-card__plate" href="cats/%E5%B0%8F%E7%B3%AF%E7%B1%B3/"><span class="pet-card__name">小糯米</span></a>
  </div>
  <div class="pet-card" data-name="小花" data-photos="../assets/images/%E5%AE%A0%E7%89%A9%E6%94%B6%E9%9B%86%E5%BD%95/%E7%8C%AB%E7%8C%AB%E5%9B%BE%E9%9B%86/%E5%B0%8F%E8%8A%B11.webp">
    <button class="pet-card__shot" type="button" aria-label="小花：查看 1 张照片">
      <img class="pet-photo" data-pet-src="../assets/images/%E5%AE%A0%E7%89%A9%E6%94%B6%E9%9B%86%E5%BD%95/%E7%8C%AB%E7%8C%AB%E5%9B%BE%E9%9B%86/thumbs/%E5%B0%8F%E8%8A%B11.webp" alt="小花" loading="lazy" decoding="async">
      <noscript><img src="../assets/images/%E5%AE%A0%E7%89%A9%E6%94%B6%E9%9B%86%E5%BD%95/%E7%8C%AB%E7%8C%AB%E5%9B%BE%E9%9B%86/thumbs/%E5%B0%8F%E8%8A%B11.webp" alt="小花" loading="lazy" decoding="async"></noscript>
    </button>
    <a class="pet-card__plate" href="cats/%E5%B0%8F%E8%8A%B1/"><span class="pet-card__name">小花</span></a>
  </div>
  <div class="pet-card" data-name="小花（黑白）" data-photos="../assets/images/%E5%AE%A0%E7%89%A9%E6%94%B6%E9%9B%86%E5%BD%95/%E7%8C%AB%E7%8C%AB%E5%9B%BE%E9%9B%86/%E5%B0%8F%E8%8A%B1%EF%BC%88%E9%BB%91%E7%99%BD%EF%BC%891.webp|../assets/images/%E5%AE%A0%E7%89%A9%E6%94%B6%E9%9B%86%E5%BD%95/%E7%8C%AB%E7%8C%AB%E5%9B%BE%E9%9B%86/%E5%B0%8F%E8%8A%B1%EF%BC%88%E9%BB%91%E7%99%BD%EF%BC%892.webp">
    <button class="pet-card__shot" type="button" aria-label="小花（黑白）：查看 2 张照片">
      <img class="pet-photo" data-pet-src="../assets/images/%E5%AE%A0%E7%89%A9%E6%94%B6%E9%9B%86%E5%BD%95/%E7%8C%AB%E7%8C%AB%E5%9B%BE%E9%9B%86/thumbs/%E5%B0%8F%E8%8A%B1%EF%BC%88%E9%BB%91%E7%99%BD%EF%BC%891.webp" alt="小花（黑白）" loading="lazy" decoding="async">
      <noscript><img src="../assets/images/%E5%AE%A0%E7%89%A9%E6%94%B6%E9%9B%86%E5%BD%95/%E7%8C%AB%E7%8C%AB%E5%9B%BE%E9%9B%86/thumbs/%E5%B0%8F%E8%8A%B1%EF%BC%88%E9%BB%91%E7%99%BD%EF%BC%891.webp" alt="小花（黑白）" loading="lazy" decoding="async"></noscript>
    </button>
    <a class="pet-card__plate" href="cats/%E5%B0%8F%E8%8A%B1-%E9%BB%91%E7%99%BD/"><span class="pet-card__name">小花（黑白）</span></a>
  </div>
  <div class="pet-card" data-name="年年" data-photos="../assets/images/%E5%AE%A0%E7%89%A9%E6%94%B6%E9%9B%86%E5%BD%95/%E7%8C%AB%E7%8C%AB%E5%9B%BE%E9%9B%86/%E5%B9%B4%E5%B9%B41.webp|../assets/images/%E5%AE%A0%E7%89%A9%E6%94%B6%E9%9B%86%E5%BD%95/%E7%8C%AB%E7%8C%AB%E5%9B%BE%E9%9B%86/%E5%B9%B4%E5%B9%B42.webp|../assets/images/%E5%AE%A0%E7%89%A9%E6%94%B6%E9%9B%86%E5%BD%95/%E7%8C%AB%E7%8C%AB%E5%9B%BE%E9%9B%86/%E5%B9%B4%E5%B9%B43.webp|../assets/images/%E5%AE%A0%E7%89%A9%E6%94%B6%E9%9B%86%E5%BD%95/%E7%8C%AB%E7%8C%AB%E5%9B%BE%E9%9B%86/%E5%B9%B4%E5%B9%B44.webp">
    <button class="pet-card__shot" type="button" aria-label="年年：查看 4 张照片">
      <img class="pet-photo" data-pet-src="../assets/images/%E5%AE%A0%E7%89%A9%E6%94%B6%E9%9B%86%E5%BD%95/%E7%8C%AB%E7%8C%AB%E5%9B%BE%E9%9B%86/thumbs/%E5%B9%B4%E5%B9%B41.webp" alt="年年" loading="lazy" decoding="async">
      <noscript><img src="../assets/images/%E5%AE%A0%E7%89%A9%E6%94%B6%E9%9B%86%E5%BD%95/%E7%8C%AB%E7%8C%AB%E5%9B%BE%E9%9B%86/thumbs/%E5%B9%B4%E5%B9%B41.webp" alt="年年" loading="lazy" decoding="async"></noscript>
    </button>
    <a class="pet-card__plate" href="cats/%E5%B9%B4%E5%B9%B4/"><span class="pet-card__name">年年</span></a>
  </div>
  <div class="pet-card" data-name="怕怕" data-photos="../assets/images/%E5%AE%A0%E7%89%A9%E6%94%B6%E9%9B%86%E5%BD%95/%E7%8C%AB%E7%8C%AB%E5%9B%BE%E9%9B%86/%E6%80%95%E6%80%951.webp|../assets/images/%E5%AE%A0%E7%89%A9%E6%94%B6%E9%9B%86%E5%BD%95/%E7%8C%AB%E7%8C%AB%E5%9B%BE%E9%9B%86/%E6%80%95%E6%80%952.webp|../assets/images/%E5%AE%A0%E7%89%A9%E6%94%B6%E9%9B%86%E5%BD%95/%E7%8C%AB%E7%8C%AB%E5%9B%BE%E9%9B%86/%E6%80%95%E6%80%953.webp|../assets/images/%E5%AE%A0%E7%89%A9%E6%94%B6%E9%9B%86%E5%BD%95/%E7%8C%AB%E7%8C%AB%E5%9B%BE%E9%9B%86/%E6%80%95%E6%80%954.webp">
    <button class="pet-card__shot" type="button" aria-label="怕怕：查看 4 张照片">
      <img class="pet-photo" data-pet-src="../assets/images/%E5%AE%A0%E7%89%A9%E6%94%B6%E9%9B%86%E5%BD%95/%E7%8C%AB%E7%8C%AB%E5%9B%BE%E9%9B%86/thumbs/%E6%80%95%E6%80%951.webp" alt="怕怕" loading="lazy" decoding="async">
      <noscript><img src="../assets/images/%E5%AE%A0%E7%89%A9%E6%94%B6%E9%9B%86%E5%BD%95/%E7%8C%AB%E7%8C%AB%E5%9B%BE%E9%9B%86/thumbs/%E6%80%95%E6%80%951.webp" alt="怕怕" loading="lazy" decoding="async"></noscript>
    </button>
    <a class="pet-card__plate" href="cats/%E6%80%95%E6%80%95/"><span class="pet-card__name">怕怕</span></a>
  </div>
  <div class="pet-card" data-name="拽子" data-photos="../assets/images/%E5%AE%A0%E7%89%A9%E6%94%B6%E9%9B%86%E5%BD%95/%E7%8C%AB%E7%8C%AB%E5%9B%BE%E9%9B%86/%E6%8B%BD%E5%AD%901.webp">
    <button class="pet-card__shot" type="button" aria-label="拽子：查看 1 张照片">
      <img class="pet-photo" data-pet-src="../assets/images/%E5%AE%A0%E7%89%A9%E6%94%B6%E9%9B%86%E5%BD%95/%E7%8C%AB%E7%8C%AB%E5%9B%BE%E9%9B%86/thumbs/%E6%8B%BD%E5%AD%901.webp" alt="拽子" loading="lazy" decoding="async">
      <noscript><img src="../assets/images/%E5%AE%A0%E7%89%A9%E6%94%B6%E9%9B%86%E5%BD%95/%E7%8C%AB%E7%8C%AB%E5%9B%BE%E9%9B%86/thumbs/%E6%8B%BD%E5%AD%901.webp" alt="拽子" loading="lazy" decoding="async"></noscript>
    </button>
    <a class="pet-card__plate" href="cats/%E6%8B%BD%E5%AD%90/"><span class="pet-card__name">拽子</span></a>
  </div>
  <div class="pet-card" data-name="捂眼睛" data-photos="../assets/images/%E5%AE%A0%E7%89%A9%E6%94%B6%E9%9B%86%E5%BD%95/%E7%8C%AB%E7%8C%AB%E5%9B%BE%E9%9B%86/%E6%8D%82%E7%9C%BC%E7%9D%9B.webp">
    <button class="pet-card__shot" type="button" aria-label="捂眼睛：查看 1 张照片">
      <img class="pet-photo" data-pet-src="../assets/images/%E5%AE%A0%E7%89%A9%E6%94%B6%E9%9B%86%E5%BD%95/%E7%8C%AB%E7%8C%AB%E5%9B%BE%E9%9B%86/thumbs/%E6%8D%82%E7%9C%BC%E7%9D%9B.webp" alt="捂眼睛" loading="lazy" decoding="async">
      <noscript><img src="../assets/images/%E5%AE%A0%E7%89%A9%E6%94%B6%E9%9B%86%E5%BD%95/%E7%8C%AB%E7%8C%AB%E5%9B%BE%E9%9B%86/thumbs/%E6%8D%82%E7%9C%BC%E7%9D%9B.webp" alt="捂眼睛" loading="lazy" decoding="async"></noscript>
    </button>
    <a class="pet-card__plate" href="cats/%E6%8D%82%E7%9C%BC%E7%9D%9B/"><span class="pet-card__name">捂眼睛</span></a>
  </div>
  <div class="pet-card" data-name="斜刘海" data-photos="../assets/images/%E5%AE%A0%E7%89%A9%E6%94%B6%E9%9B%86%E5%BD%95/%E7%8C%AB%E7%8C%AB%E5%9B%BE%E9%9B%86/%E6%96%9C%E5%88%98%E6%B5%B71.webp|../assets/images/%E5%AE%A0%E7%89%A9%E6%94%B6%E9%9B%86%E5%BD%95/%E7%8C%AB%E7%8C%AB%E5%9B%BE%E9%9B%86/%E6%96%9C%E5%88%98%E6%B5%B72.webp">
    <button class="pet-card__shot" type="button" aria-label="斜刘海：查看 2 张照片">
      <img class="pet-photo" data-pet-src="../assets/images/%E5%AE%A0%E7%89%A9%E6%94%B6%E9%9B%86%E5%BD%95/%E7%8C%AB%E7%8C%AB%E5%9B%BE%E9%9B%86/thumbs/%E6%96%9C%E5%88%98%E6%B5%B71.webp" alt="斜刘海" loading="lazy" decoding="async">
      <noscript><img src="../assets/images/%E5%AE%A0%E7%89%A9%E6%94%B6%E9%9B%86%E5%BD%95/%E7%8C%AB%E7%8C%AB%E5%9B%BE%E9%9B%86/thumbs/%E6%96%9C%E5%88%98%E6%B5%B71.webp" alt="斜刘海" loading="lazy" decoding="async"></noscript>
    </button>
    <a class="pet-card__plate" href="cats/%E6%96%9C%E5%88%98%E6%B5%B7/"><span class="pet-card__name">斜刘海</span></a>
  </div>
  <div class="pet-card" data-name="暖暖" data-photos="../assets/images/%E5%AE%A0%E7%89%A9%E6%94%B6%E9%9B%86%E5%BD%95/%E7%8C%AB%E7%8C%AB%E5%9B%BE%E9%9B%86/%E6%9A%96%E6%9A%961.webp|../assets/images/%E5%AE%A0%E7%89%A9%E6%94%B6%E9%9B%86%E5%BD%95/%E7%8C%AB%E7%8C%AB%E5%9B%BE%E9%9B%86/%E6%9A%96%E6%9A%962.webp">
    <button class="pet-card__shot" type="button" aria-label="暖暖：查看 2 张照片">
      <img class="pet-photo" data-pet-src="../assets/images/%E5%AE%A0%E7%89%A9%E6%94%B6%E9%9B%86%E5%BD%95/%E7%8C%AB%E7%8C%AB%E5%9B%BE%E9%9B%86/thumbs/%E6%9A%96%E6%9A%961.webp" alt="暖暖" loading="lazy" decoding="async">
      <noscript><img src="../assets/images/%E5%AE%A0%E7%89%A9%E6%94%B6%E9%9B%86%E5%BD%95/%E7%8C%AB%E7%8C%AB%E5%9B%BE%E9%9B%86/thumbs/%E6%9A%96%E6%9A%961.webp" alt="暖暖" loading="lazy" decoding="async"></noscript>
    </button>
    <a class="pet-card__plate" href="cats/%E6%9A%96%E6%9A%96/"><span class="pet-card__name">暖暖</span></a>
  </div>
  <div class="pet-card" data-name="树人" data-photos="../assets/images/%E5%AE%A0%E7%89%A9%E6%94%B6%E9%9B%86%E5%BD%95/%E7%8C%AB%E7%8C%AB%E5%9B%BE%E9%9B%86/%E6%A0%91%E4%BA%BA1.webp">
    <button class="pet-card__shot" type="button" aria-label="树人：查看 1 张照片">
      <img class="pet-photo" data-pet-src="../assets/images/%E5%AE%A0%E7%89%A9%E6%94%B6%E9%9B%86%E5%BD%95/%E7%8C%AB%E7%8C%AB%E5%9B%BE%E9%9B%86/thumbs/%E6%A0%91%E4%BA%BA1.webp" alt="树人" loading="lazy" decoding="async">
      <noscript><img src="../assets/images/%E5%AE%A0%E7%89%A9%E6%94%B6%E9%9B%86%E5%BD%95/%E7%8C%AB%E7%8C%AB%E5%9B%BE%E9%9B%86/thumbs/%E6%A0%91%E4%BA%BA1.webp" alt="树人" loading="lazy" decoding="async"></noscript>
    </button>
    <a class="pet-card__plate" href="cats/%E6%A0%91%E4%BA%BA/"><span class="pet-card__name">树人</span></a>
  </div>
  <div class="pet-card" data-name="橘皮" data-photos="../assets/images/%E5%AE%A0%E7%89%A9%E6%94%B6%E9%9B%86%E5%BD%95/%E7%8C%AB%E7%8C%AB%E5%9B%BE%E9%9B%86/%E6%A9%98%E7%9A%AE1.webp">
    <button class="pet-card__shot" type="button" aria-label="橘皮：查看 1 张照片">
      <img class="pet-photo" data-pet-src="../assets/images/%E5%AE%A0%E7%89%A9%E6%94%B6%E9%9B%86%E5%BD%95/%E7%8C%AB%E7%8C%AB%E5%9B%BE%E9%9B%86/thumbs/%E6%A9%98%E7%9A%AE1.webp" alt="橘皮" loading="lazy" decoding="async">
      <noscript><img src="../assets/images/%E5%AE%A0%E7%89%A9%E6%94%B6%E9%9B%86%E5%BD%95/%E7%8C%AB%E7%8C%AB%E5%9B%BE%E9%9B%86/thumbs/%E6%A9%98%E7%9A%AE1.webp" alt="橘皮" loading="lazy" decoding="async"></noscript>
    </button>
    <a class="pet-card__plate" href="cats/%E6%A9%98%E7%9A%AE/"><span class="pet-card__name">橘皮</span></a>
  </div>
  <div class="pet-card" data-name="爆米花" data-photos="../assets/images/%E5%AE%A0%E7%89%A9%E6%94%B6%E9%9B%86%E5%BD%95/%E7%8C%AB%E7%8C%AB%E5%9B%BE%E9%9B%86/%E7%88%86%E7%B1%B3%E8%8A%B11.webp|../assets/images/%E5%AE%A0%E7%89%A9%E6%94%B6%E9%9B%86%E5%BD%95/%E7%8C%AB%E7%8C%AB%E5%9B%BE%E9%9B%86/%E7%88%86%E7%B1%B3%E8%8A%B12.webp">
    <button class="pet-card__shot" type="button" aria-label="爆米花：查看 2 张照片">
      <img class="pet-photo" data-pet-src="../assets/images/%E5%AE%A0%E7%89%A9%E6%94%B6%E9%9B%86%E5%BD%95/%E7%8C%AB%E7%8C%AB%E5%9B%BE%E9%9B%86/thumbs/%E7%88%86%E7%B1%B3%E8%8A%B11.webp" alt="爆米花" loading="lazy" decoding="async">
      <noscript><img src="../assets/images/%E5%AE%A0%E7%89%A9%E6%94%B6%E9%9B%86%E5%BD%95/%E7%8C%AB%E7%8C%AB%E5%9B%BE%E9%9B%86/thumbs/%E7%88%86%E7%B1%B3%E8%8A%B11.webp" alt="爆米花" loading="lazy" decoding="async"></noscript>
    </button>
    <a class="pet-card__plate" href="cats/%E7%88%86%E7%B1%B3%E8%8A%B1/"><span class="pet-card__name">爆米花</span></a>
  </div>
  <div class="pet-card" data-name="猫子" data-photos="../assets/images/%E5%AE%A0%E7%89%A9%E6%94%B6%E9%9B%86%E5%BD%95/%E7%8C%AB%E7%8C%AB%E5%9B%BE%E9%9B%86/%E7%8C%AB%E5%AD%901.webp">
    <button class="pet-card__shot" type="button" aria-label="猫子：查看 1 张照片">
      <img class="pet-photo" data-pet-src="../assets/images/%E5%AE%A0%E7%89%A9%E6%94%B6%E9%9B%86%E5%BD%95/%E7%8C%AB%E7%8C%AB%E5%9B%BE%E9%9B%86/thumbs/%E7%8C%AB%E5%AD%901.webp" alt="猫子" loading="lazy" decoding="async">
      <noscript><img src="../assets/images/%E5%AE%A0%E7%89%A9%E6%94%B6%E9%9B%86%E5%BD%95/%E7%8C%AB%E7%8C%AB%E5%9B%BE%E9%9B%86/thumbs/%E7%8C%AB%E5%AD%901.webp" alt="猫子" loading="lazy" decoding="async"></noscript>
    </button>
    <a class="pet-card__plate" href="cats/%E7%8C%AB%E5%AD%90/"><span class="pet-card__name">猫子</span></a>
  </div>
  <div class="pet-card" data-name="白白" data-photos="../assets/images/%E5%AE%A0%E7%89%A9%E6%94%B6%E9%9B%86%E5%BD%95/%E7%8C%AB%E7%8C%AB%E5%9B%BE%E9%9B%86/%E7%99%BD%E7%99%BD1.webp|../assets/images/%E5%AE%A0%E7%89%A9%E6%94%B6%E9%9B%86%E5%BD%95/%E7%8C%AB%E7%8C%AB%E5%9B%BE%E9%9B%86/%E7%99%BD%E7%99%BD2.webp|../assets/images/%E5%AE%A0%E7%89%A9%E6%94%B6%E9%9B%86%E5%BD%95/%E7%8C%AB%E7%8C%AB%E5%9B%BE%E9%9B%86/%E7%99%BD%E7%99%BD3.webp">
    <button class="pet-card__shot" type="button" aria-label="白白：查看 3 张照片">
      <img class="pet-photo" data-pet-src="../assets/images/%E5%AE%A0%E7%89%A9%E6%94%B6%E9%9B%86%E5%BD%95/%E7%8C%AB%E7%8C%AB%E5%9B%BE%E9%9B%86/thumbs/%E7%99%BD%E7%99%BD1.webp" alt="白白" loading="lazy" decoding="async">
      <noscript><img src="../assets/images/%E5%AE%A0%E7%89%A9%E6%94%B6%E9%9B%86%E5%BD%95/%E7%8C%AB%E7%8C%AB%E5%9B%BE%E9%9B%86/thumbs/%E7%99%BD%E7%99%BD1.webp" alt="白白" loading="lazy" decoding="async"></noscript>
    </button>
    <a class="pet-card__plate" href="cats/%E7%99%BD%E7%99%BD/"><span class="pet-card__name">白白</span></a>
  </div>
  <div class="pet-card" data-name="眯眼大佐" data-photos="../assets/images/%E5%AE%A0%E7%89%A9%E6%94%B6%E9%9B%86%E5%BD%95/%E7%8C%AB%E7%8C%AB%E5%9B%BE%E9%9B%86/%E7%9C%AF%E7%9C%BC%E5%A4%A7%E4%BD%901.webp|../assets/images/%E5%AE%A0%E7%89%A9%E6%94%B6%E9%9B%86%E5%BD%95/%E7%8C%AB%E7%8C%AB%E5%9B%BE%E9%9B%86/%E7%9C%AF%E7%9C%BC%E5%A4%A7%E4%BD%902.webp|../assets/images/%E5%AE%A0%E7%89%A9%E6%94%B6%E9%9B%86%E5%BD%95/%E7%8C%AB%E7%8C%AB%E5%9B%BE%E9%9B%86/%E7%9C%AF%E7%9C%BC%E5%A4%A7%E4%BD%903.webp">
    <button class="pet-card__shot" type="button" aria-label="眯眼大佐：查看 3 张照片">
      <img class="pet-photo" data-pet-src="../assets/images/%E5%AE%A0%E7%89%A9%E6%94%B6%E9%9B%86%E5%BD%95/%E7%8C%AB%E7%8C%AB%E5%9B%BE%E9%9B%86/thumbs/%E7%9C%AF%E7%9C%BC%E5%A4%A7%E4%BD%901.webp" alt="眯眼大佐" loading="lazy" decoding="async">
      <noscript><img src="../assets/images/%E5%AE%A0%E7%89%A9%E6%94%B6%E9%9B%86%E5%BD%95/%E7%8C%AB%E7%8C%AB%E5%9B%BE%E9%9B%86/thumbs/%E7%9C%AF%E7%9C%BC%E5%A4%A7%E4%BD%901.webp" alt="眯眼大佐" loading="lazy" decoding="async"></noscript>
    </button>
    <a class="pet-card__plate" href="cats/%E7%9C%AF%E7%9C%BC%E5%A4%A7%E4%BD%90/"><span class="pet-card__name">眯眼大佐</span></a>
  </div>
  <div class="pet-card" data-name="胖橘" data-photos="../assets/images/%E5%AE%A0%E7%89%A9%E6%94%B6%E9%9B%86%E5%BD%95/%E7%8C%AB%E7%8C%AB%E5%9B%BE%E9%9B%86/%E8%83%96%E6%A9%981.webp|../assets/images/%E5%AE%A0%E7%89%A9%E6%94%B6%E9%9B%86%E5%BD%95/%E7%8C%AB%E7%8C%AB%E5%9B%BE%E9%9B%86/%E8%83%96%E6%A9%982.webp">
    <button class="pet-card__shot" type="button" aria-label="胖橘：查看 2 张照片">
      <img class="pet-photo" data-pet-src="../assets/images/%E5%AE%A0%E7%89%A9%E6%94%B6%E9%9B%86%E5%BD%95/%E7%8C%AB%E7%8C%AB%E5%9B%BE%E9%9B%86/thumbs/%E8%83%96%E6%A9%981.webp" alt="胖橘" loading="lazy" decoding="async">
      <noscript><img src="../assets/images/%E5%AE%A0%E7%89%A9%E6%94%B6%E9%9B%86%E5%BD%95/%E7%8C%AB%E7%8C%AB%E5%9B%BE%E9%9B%86/thumbs/%E8%83%96%E6%A9%981.webp" alt="胖橘" loading="lazy" decoding="async"></noscript>
    </button>
    <a class="pet-card__plate" href="cats/%E8%83%96%E6%A9%98/"><span class="pet-card__name">胖橘</span></a>
  </div>
  <div class="pet-card" data-name="花卷" data-photos="../assets/images/%E5%AE%A0%E7%89%A9%E6%94%B6%E9%9B%86%E5%BD%95/%E7%8C%AB%E7%8C%AB%E5%9B%BE%E9%9B%86/%E8%8A%B1%E5%8D%B71.webp|../assets/images/%E5%AE%A0%E7%89%A9%E6%94%B6%E9%9B%86%E5%BD%95/%E7%8C%AB%E7%8C%AB%E5%9B%BE%E9%9B%86/%E8%8A%B1%E5%8D%B72.webp|../assets/images/%E5%AE%A0%E7%89%A9%E6%94%B6%E9%9B%86%E5%BD%95/%E7%8C%AB%E7%8C%AB%E5%9B%BE%E9%9B%86/%E8%8A%B1%E5%8D%B73.webp|../assets/images/%E5%AE%A0%E7%89%A9%E6%94%B6%E9%9B%86%E5%BD%95/%E7%8C%AB%E7%8C%AB%E5%9B%BE%E9%9B%86/%E8%8A%B1%E5%8D%B74.webp">
    <button class="pet-card__shot" type="button" aria-label="花卷：查看 4 张照片">
      <img class="pet-photo" data-pet-src="../assets/images/%E5%AE%A0%E7%89%A9%E6%94%B6%E9%9B%86%E5%BD%95/%E7%8C%AB%E7%8C%AB%E5%9B%BE%E9%9B%86/thumbs/%E8%8A%B1%E5%8D%B71.webp" alt="花卷" loading="lazy" decoding="async">
      <noscript><img src="../assets/images/%E5%AE%A0%E7%89%A9%E6%94%B6%E9%9B%86%E5%BD%95/%E7%8C%AB%E7%8C%AB%E5%9B%BE%E9%9B%86/thumbs/%E8%8A%B1%E5%8D%B71.webp" alt="花卷" loading="lazy" decoding="async"></noscript>
    </button>
    <a class="pet-card__plate" href="cats/%E8%8A%B1%E5%8D%B7/"><span class="pet-card__name">花卷</span></a>
  </div>
  <div class="pet-card" data-name="花花" data-photos="../assets/images/%E5%AE%A0%E7%89%A9%E6%94%B6%E9%9B%86%E5%BD%95/%E7%8C%AB%E7%8C%AB%E5%9B%BE%E9%9B%86/%E8%8A%B1%E8%8A%B11.webp|../assets/images/%E5%AE%A0%E7%89%A9%E6%94%B6%E9%9B%86%E5%BD%95/%E7%8C%AB%E7%8C%AB%E5%9B%BE%E9%9B%86/%E8%8A%B1%E8%8A%B12.webp">
    <button class="pet-card__shot" type="button" aria-label="花花：查看 2 张照片">
      <img class="pet-photo" data-pet-src="../assets/images/%E5%AE%A0%E7%89%A9%E6%94%B6%E9%9B%86%E5%BD%95/%E7%8C%AB%E7%8C%AB%E5%9B%BE%E9%9B%86/thumbs/%E8%8A%B1%E8%8A%B11.webp" alt="花花" loading="lazy" decoding="async">
      <noscript><img src="../assets/images/%E5%AE%A0%E7%89%A9%E6%94%B6%E9%9B%86%E5%BD%95/%E7%8C%AB%E7%8C%AB%E5%9B%BE%E9%9B%86/thumbs/%E8%8A%B1%E8%8A%B11.webp" alt="花花" loading="lazy" decoding="async"></noscript>
    </button>
    <a class="pet-card__plate" href="cats/%E8%8A%B1%E8%8A%B1/"><span class="pet-card__name">花花</span></a>
  </div>
  <div class="pet-card" data-name="花花（橘版）" data-photos="../assets/images/%E5%AE%A0%E7%89%A9%E6%94%B6%E9%9B%86%E5%BD%95/%E7%8C%AB%E7%8C%AB%E5%9B%BE%E9%9B%86/%E8%8A%B1%E8%8A%B1%EF%BC%88%E6%A9%98%E7%89%88%EF%BC%891.webp|../assets/images/%E5%AE%A0%E7%89%A9%E6%94%B6%E9%9B%86%E5%BD%95/%E7%8C%AB%E7%8C%AB%E5%9B%BE%E9%9B%86/%E8%8A%B1%E8%8A%B1%EF%BC%88%E6%A9%98%E7%89%88%EF%BC%892.webp">
    <button class="pet-card__shot" type="button" aria-label="花花（橘版）：查看 2 张照片">
      <img class="pet-photo" data-pet-src="../assets/images/%E5%AE%A0%E7%89%A9%E6%94%B6%E9%9B%86%E5%BD%95/%E7%8C%AB%E7%8C%AB%E5%9B%BE%E9%9B%86/thumbs/%E8%8A%B1%E8%8A%B1%EF%BC%88%E6%A9%98%E7%89%88%EF%BC%891.webp" alt="花花（橘版）" loading="lazy" decoding="async">
      <noscript><img src="../assets/images/%E5%AE%A0%E7%89%A9%E6%94%B6%E9%9B%86%E5%BD%95/%E7%8C%AB%E7%8C%AB%E5%9B%BE%E9%9B%86/thumbs/%E8%8A%B1%E8%8A%B1%EF%BC%88%E6%A9%98%E7%89%88%EF%BC%891.webp" alt="花花（橘版）" loading="lazy" decoding="async"></noscript>
    </button>
    <a class="pet-card__plate" href="cats/%E8%8A%B1%E8%8A%B1-%E6%A9%98%E7%89%88/"><span class="pet-card__name">花花（橘版）</span></a>
  </div>
  <div class="pet-card" data-name="花酱" data-photos="../assets/images/%E5%AE%A0%E7%89%A9%E6%94%B6%E9%9B%86%E5%BD%95/%E7%8C%AB%E7%8C%AB%E5%9B%BE%E9%9B%86/%E8%8A%B1%E9%85%B11.webp|../assets/images/%E5%AE%A0%E7%89%A9%E6%94%B6%E9%9B%86%E5%BD%95/%E7%8C%AB%E7%8C%AB%E5%9B%BE%E9%9B%86/%E8%8A%B1%E9%85%B12.webp|../assets/images/%E5%AE%A0%E7%89%A9%E6%94%B6%E9%9B%86%E5%BD%95/%E7%8C%AB%E7%8C%AB%E5%9B%BE%E9%9B%86/%E8%8A%B1%E9%85%B13.webp|../assets/images/%E5%AE%A0%E7%89%A9%E6%94%B6%E9%9B%86%E5%BD%95/%E7%8C%AB%E7%8C%AB%E5%9B%BE%E9%9B%86/%E8%8A%B1%E9%85%B14.webp">
    <button class="pet-card__shot" type="button" aria-label="花酱：查看 4 张照片">
      <img class="pet-photo" data-pet-src="../assets/images/%E5%AE%A0%E7%89%A9%E6%94%B6%E9%9B%86%E5%BD%95/%E7%8C%AB%E7%8C%AB%E5%9B%BE%E9%9B%86/thumbs/%E8%8A%B1%E9%85%B11.webp" alt="花酱" loading="lazy" decoding="async">
      <noscript><img src="../assets/images/%E5%AE%A0%E7%89%A9%E6%94%B6%E9%9B%86%E5%BD%95/%E7%8C%AB%E7%8C%AB%E5%9B%BE%E9%9B%86/thumbs/%E8%8A%B1%E9%85%B11.webp" alt="花酱" loading="lazy" decoding="async"></noscript>
    </button>
    <a class="pet-card__plate" href="cats/%E8%8A%B1%E9%85%B1/"><span class="pet-card__name">花酱</span></a>
  </div>
  <div class="pet-card" data-name="蛋黄派" data-photos="../assets/images/%E5%AE%A0%E7%89%A9%E6%94%B6%E9%9B%86%E5%BD%95/%E7%8C%AB%E7%8C%AB%E5%9B%BE%E9%9B%86/%E8%9B%8B%E9%BB%84%E6%B4%BE1.webp|../assets/images/%E5%AE%A0%E7%89%A9%E6%94%B6%E9%9B%86%E5%BD%95/%E7%8C%AB%E7%8C%AB%E5%9B%BE%E9%9B%86/%E8%9B%8B%E9%BB%84%E6%B4%BE2.webp|../assets/images/%E5%AE%A0%E7%89%A9%E6%94%B6%E9%9B%86%E5%BD%95/%E7%8C%AB%E7%8C%AB%E5%9B%BE%E9%9B%86/%E8%9B%8B%E9%BB%84%E6%B4%BE3.webp">
    <button class="pet-card__shot" type="button" aria-label="蛋黄派：查看 3 张照片">
      <img class="pet-photo" data-pet-src="../assets/images/%E5%AE%A0%E7%89%A9%E6%94%B6%E9%9B%86%E5%BD%95/%E7%8C%AB%E7%8C%AB%E5%9B%BE%E9%9B%86/thumbs/%E8%9B%8B%E9%BB%84%E6%B4%BE1.webp" alt="蛋黄派" loading="lazy" decoding="async">
      <noscript><img src="../assets/images/%E5%AE%A0%E7%89%A9%E6%94%B6%E9%9B%86%E5%BD%95/%E7%8C%AB%E7%8C%AB%E5%9B%BE%E9%9B%86/thumbs/%E8%9B%8B%E9%BB%84%E6%B4%BE1.webp" alt="蛋黄派" loading="lazy" decoding="async"></noscript>
    </button>
    <a class="pet-card__plate" href="cats/%E8%9B%8B%E9%BB%84%E6%B4%BE/"><span class="pet-card__name">蛋黄派</span></a>
  </div>
  <div class="pet-card" data-name="踏雪" data-photos="../assets/images/%E5%AE%A0%E7%89%A9%E6%94%B6%E9%9B%86%E5%BD%95/%E7%8C%AB%E7%8C%AB%E5%9B%BE%E9%9B%86/%E8%B8%8F%E9%9B%AA1.webp|../assets/images/%E5%AE%A0%E7%89%A9%E6%94%B6%E9%9B%86%E5%BD%95/%E7%8C%AB%E7%8C%AB%E5%9B%BE%E9%9B%86/%E8%B8%8F%E9%9B%AA2.webp|../assets/images/%E5%AE%A0%E7%89%A9%E6%94%B6%E9%9B%86%E5%BD%95/%E7%8C%AB%E7%8C%AB%E5%9B%BE%E9%9B%86/%E8%B8%8F%E9%9B%AA3.webp|../assets/images/%E5%AE%A0%E7%89%A9%E6%94%B6%E9%9B%86%E5%BD%95/%E7%8C%AB%E7%8C%AB%E5%9B%BE%E9%9B%86/%E8%B8%8F%E9%9B%AA4.webp">
    <button class="pet-card__shot" type="button" aria-label="踏雪：查看 4 张照片">
      <img class="pet-photo" data-pet-src="../assets/images/%E5%AE%A0%E7%89%A9%E6%94%B6%E9%9B%86%E5%BD%95/%E7%8C%AB%E7%8C%AB%E5%9B%BE%E9%9B%86/thumbs/%E8%B8%8F%E9%9B%AA1.webp" alt="踏雪" loading="lazy" decoding="async">
      <noscript><img src="../assets/images/%E5%AE%A0%E7%89%A9%E6%94%B6%E9%9B%86%E5%BD%95/%E7%8C%AB%E7%8C%AB%E5%9B%BE%E9%9B%86/thumbs/%E8%B8%8F%E9%9B%AA1.webp" alt="踏雪" loading="lazy" decoding="async"></noscript>
    </button>
    <a class="pet-card__plate" href="cats/%E8%B8%8F%E9%9B%AA/"><span class="pet-card__name">踏雪</span></a>
  </div>
  <div class="pet-card" data-name="阿波罗" data-photos="../assets/images/%E5%AE%A0%E7%89%A9%E6%94%B6%E9%9B%86%E5%BD%95/%E7%8C%AB%E7%8C%AB%E5%9B%BE%E9%9B%86/%E9%98%BF%E6%B3%A2%E7%BD%971.webp|../assets/images/%E5%AE%A0%E7%89%A9%E6%94%B6%E9%9B%86%E5%BD%95/%E7%8C%AB%E7%8C%AB%E5%9B%BE%E9%9B%86/%E9%98%BF%E6%B3%A2%E7%BD%972.webp">
    <button class="pet-card__shot" type="button" aria-label="阿波罗：查看 2 张照片">
      <img class="pet-photo" data-pet-src="../assets/images/%E5%AE%A0%E7%89%A9%E6%94%B6%E9%9B%86%E5%BD%95/%E7%8C%AB%E7%8C%AB%E5%9B%BE%E9%9B%86/thumbs/%E9%98%BF%E6%B3%A2%E7%BD%971.webp" alt="阿波罗" loading="lazy" decoding="async">
      <noscript><img src="../assets/images/%E5%AE%A0%E7%89%A9%E6%94%B6%E9%9B%86%E5%BD%95/%E7%8C%AB%E7%8C%AB%E5%9B%BE%E9%9B%86/thumbs/%E9%98%BF%E6%B3%A2%E7%BD%971.webp" alt="阿波罗" loading="lazy" decoding="async"></noscript>
    </button>
    <a class="pet-card__plate" href="cats/%E9%98%BF%E6%B3%A2%E7%BD%97/"><span class="pet-card__name">阿波罗</span></a>
  </div>
<!-- pets:deck:end -->
</div>

<nav class="pet-pager" id="pet-pager" aria-label="猫猫图鉴分页"></nav>
