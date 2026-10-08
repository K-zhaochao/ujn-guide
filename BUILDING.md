# 构建与验证

本仓库的静态站构建需要 Python 3.13+、Node.js 22.16.0 和 npm。Node 版本由 `.nvmrc` 固定，Python 依赖由 `requirements.txt` 精确锁定，Pagefind 由根目录 `package-lock.json` 锁定。

```powershell
python -m pip install -r requirements.txt
npm ci
npm run test:build
npm run test:frontend
npm run build
```

## 综测计算器

综测计算器属于主站静态资源，访问路径为 `/green-book/scholarship/zongce-calculator/`，
不依赖独立 `server/` 仓库的 API、登录或数据库。入口位于首页、绿皮书导航与综测规则页。
绿皮书导航中的「实用工具」与「学业管理」同级，排在其上方；综测计算器归入「实用工具」。

上游为 [WHHWWHHWWHHWWHHW/zongce-calculator](https://github.com/WHHWWHHWWHHWWHHW/zongce-calculator)，
采用 Apache-2.0；本次核对的上游版本是 `7619d3d5d5577997a39dc6d934a55e22001238b9`。
页面在 `docs/green-book/scholarship/zongce-calculator.md`，样式、纯计算模块、页面脚本、
许可证、修改说明和原作者赞赏图统一放在 `docs/assets/zongce-calculator/`。
原作者仓库按钮与「支持工具原作者」入口应在后续修改中保留。

脚本通过 Material 的 `document$` 初始化每次即时导航后的表单。成绩只留在当前页面内存，
不使用 localStorage、Cookie 或 API 保存；导入会替换当前成绩，按所选模式提示缺失字段。
CSV/TXT/TSV 在浏览器本地读取，XLSX 需另存为 CSV 或复制表格文本。
GPA 直接使用教务处给出的值；能力分使用学院审核值，不在此工具中推断奖学金资格。

修改计算或导入逻辑后运行 `npm run test:frontend` 与 `npm run build`，并核对直接访问、
从首页即时导航进入、手机布局和原作者链接。资源更新时同时递增 `mkdocs.yml` 中该工具的
`?v=` 版本。不要直接编辑生成的 `site/`，也不要在接入工具时改动宠物后台仓库。

## 公式渲染与即时导航

主站保留 Material 的 `navigation.instant`。`docs/javascripts/mathjax.js` 在页尾先写好
`window.MathJax` 配置，**引擎按需加载**：只有当前页面真的出现 `.arithmatex` 公式时才注入
`<script>`（约 1 MB，带 SRI 与 `crossorigin`），`overrides/main.html` 不再无条件引入引擎。
引擎地址与 SRI 只在该文件顶部的 `ENGINE` 常量里维护一份；即时导航进入公式页时由同一个
入口补加载，所以从无公式页跳进公式页也能正常排版。

首次排版等待 `MathJax.startup.promise` 完成，与后续导航共用串行队列；快速切页时跳过
尚未开始的旧页面任务。每个新页面先执行 `clearCache()`、`typesetClear()`、`texReset()`，
再仅排版当前正文内的 `.arithmatex` 公式。即时导航会移除动态样式，仅调用
`typesetPromise()` 会复用旧字形样式，导致新出现的数字、字母或符号缺失。
不要恢复定时轮询或初始自动排版；加载和排版异常在控制台以 `[MathJax]` 标记。

修改后运行 `npm run test:frontend` 与 `npm run build`，并递增 `mkdocs.yml` 中该脚本的
`?v=` 版本。浏览器验收须包含直接访问、从无公式页进入、连续切换「成绩规则 / 推免保送须知 /
荣誉评选与奖金须知」以及后退、前进；重点检查新页面新增的字形和分式，不要只统计公式节点。
无公式的页面（如 `/pets/`）在 DevTools 网络面板里**不应出现** `cdn.jsdelivr.net` 请求。

## 性能与资源约定

- **不要恢复 Google Fonts**：`mkdocs.yml` 里的 `theme.font: false` 是有意为之。Material 默认
  会引入一个阻塞渲染的外部样式表（fonts.googleapis.com），国内网络下经常挂起，还会把访客
  IP 交给 Google；关掉后走系统字体栈，中文由 PingFang SC / 微软雅黑 / Noto Sans CJK 渲染。
- **公式只在需要的页面加载引擎**，见上一节；不要再往 `main.html` 里加回引擎 `<script>`。
- **大图先压缩**。检查并转换超过 200 KB 的位图：

  ```powershell
  python scripts/images/optimize_assets.py --check   # 只报告
  python scripts/images/optimize_assets.py --apply --max-width 2400
  ```

  脚本会转成 WebP、按 `--max-width` 缩放、改写 `docs/**/*.md` 里的引用，并在体积确实变小时
  删除原图（git 历史仍保留）。校区地图从 14261px / 4.88 MB 降到 2400px / 0.24 MB，属于这类
  素材的典型处理方式；PDF 等文档不在此脚本范围内。
- **卡牌封面用缩略图**。猫猫原图常见 1600~2133px（单张最大 2 MB），而卡牌只有两三百像素宽：

  ```powershell
  python scripts/images/build_thumbs.py          # 生成 thumbs/（93 张，27.6 MB -> 6.6 MB）
  python scripts/images/build_thumbs.py --check  # CI：缺失或过期即失败
  ```

  缩略图是**提交进仓库的产物**，站点构建不需要 Pillow；换图后要重新生成，否则
  `scripts/pets/build_gallery.py` 会明确报错，`npm run test:build` 也会失败。
- **外部运行时依赖保持最小**：目前只剩自托管 Umami、jsdelivr（按需的 MathJax）与 unpkg
  （仅图表页的 mermaid）。新增第三方 CDN 前先确认国内可达性，优先自托管。

## 样式与脚本放在哪里

主题覆盖层已经从「一个 1500 行的模板文件」拆开了，改东西前先看这张表：

| 位置 | 放什么 |
| --- | --- |
| `docs/assets/stylesheets/ujn.css` | 站点自定义样式（公告栏、QQ 群入口、搜索与 AI 助手、页脚按钮、两个弹窗）。改完**必须递增 `mkdocs.yml` 里的 `?v=`**，否则访客继续用缓存。 |
| `docs/javascripts/ujn-ui.js` | 公告栏关闭、页脚按钮注入、跳蚤市场与赞助弹窗、即时导航滚动修复。站点根路径由脚本自身地址反推（`document.currentScript`），跳蚤市场配置读页面上的 `<script type="application/json" id="ujn-flea-config">`。 |
| `docs/javascripts/mobile-toc.js` | 窄屏的「本页目录」折叠块。Material 在 1220px 以下会隐藏右侧目录栏，这个脚本在目录栏不可见时把正文的 h2/h3 收进一个 `<details>`；**不要靠 `toc.integrate` 解决**（那会让桌面端也失去目录栏）。 |
| `docs/javascripts/hot-search.js` | 搜索面板的「大家都在搜」胶囊（标记在 `overrides/partials/search.html`）。查询词为空时显示；点击后填入搜索框并**派发一次 `input` 事件**——Pagefind 的搜索逻辑本来就在监听它，两个模块不必互相知道对方存在。搜不到结果时，`search.html` 会调 `UJNHotSearch.suggest(文案)` 把同一组词再摆出来（换个标题），把死路变成出口；继续输入会自动收起并恢复默认标题。新增预设词请顺手在浏览器里点一遍，确认有结果。**注意**：Material 把下拉面板的底色画在 `.md-search__scrollwrap` 上，外层 `.md-search__output` 是透明的——往面板里加任何新块都要自己刷 `var(--md-default-bg-color)`，否则正文会从面板里透出来（踩过一次）。 |
| `overrides/main.html` | 只剩约 70 行模板：公告栏结构、header、extrahead（Umami）、scripts（引入上面两个文件）。**不要往模板里塞回大段 `<style>` / `<script>`。** |
| `docs/changelog.md` | 「最近更新」页。正文由 `scripts/site/build_changelog.py` 从 git 提交历史生成（读者可见的改动进列表，重构/测试/构建等维护性提交按前缀过滤）。页面**提交进仓库**，保证直接 `mkdocs build` 也不缺页；`scripts/build_site.py` 每次构建前会重生成一遍，所以线上永远是最新的。这一页天然**比最新一次提交慢一步**（提交信息要等提交完成才读得到），所以构建后看到它变了是正常的，跟着下一次提交一起提交即可。 |
| 页面里的 `<style>` | `docs/pets/index.md`、`docs/contribute/index.md` 等页面自带的样式是有意内联的：只在当页加载、不影响其它页面；代价是不能缓存，少量规则可以接受。 |

搬迁前后用「截图 + computed style」指纹做过对比（6 个页面/视口，含两个弹窗与深色模式），
像素完全一致。以后再动这类纯搬迁的改动，沿用同样办法验收：先存 before 指纹，改完再比一次。
注意基线必须取自「改动前的当前提交」——拿几天前的指纹去比，会把别的改动算进来。

### 设计令牌与组件

`ujn.css` 顶部有一组令牌，新样式请优先复用，别再写裸数值：

| 令牌 | 用途 |
| --- | --- |
| `--ujn-radius-xs / -sm / -md / -lg / -circle` | 圆角（4px / 6px / 8px / 1rem / 50%） |
| `--ujn-hairline`、`--ujn-muted`、`--ujn-accent` | 跟随主题的线条色、弱化文字、主色 |
| `--ujn-shadow-soft`、`--ujn-shadow-modal`、`--ujn-scrim` | 轻阴影、弹窗阴影、遮罩底色 |

弹窗已经抽成「基础组件 + 各自差异」两层，新增弹窗照这个来：

- `.ujn-overlay`（固定定位 + 遮罩 + 居中 + 淡入）与 `.ujn-overlay--open`（`display: flex`）；
- `.ujn-modal`（卡片底色、圆角、阴影、相对定位、上滑动画）；
- 各弹窗自己的类只留差异，例如 `.flea-card` 只管 `max-width: 580px` 与滚动，
  `.donate-card` 只管 `max-width: 380px` 与内边距；标记上同时带基础类与自己的类
  （`class="ujn-overlay flea-overlay"`），`ujn-ui.js` 里就是按这个写法生成的。

胶囊按钮/页签也共用一个组件：`.ujn-pill`（形状、字号字重、过渡）与 `.ujn-pill.is-active`
（选中态底色与文字色），宠物图鉴的页码与反馈页的页签都用它，页面样式只留尺寸、边框与自己的
过渡列表。**注意优先级**：页面样式通常写成 `#pet-pager .pet-pager__num`，ID 选择器会压过
全局的 `.ujn-pill`；所以组件负责的声明不要留在页面里重复写，否则会把组件按回去——
页码的未选中底色就因此写成 `:not(.is-active)`，把选中态让给组件。

### `!important` 审计结论

`ujn.css` 原有 17 处 `!important`，按「能否证明它不必要」逐个处理：**去掉 8 处、保留 9 处**。

| 处理 | 位置 | 依据 |
| --- | --- | --- |
| 已去掉（8 处） | QQ 群入口的 `color`；左侧分组标题的 `font-weight/color/opacity`；AI 控制栏下边框（浅色 + 深色）；搜索清除按钮的 `opacity/pointer-events` | 默认态 + hover 态 + 搜索面板打开态的 computed style 前后对比，**0 差异** |
| 已去掉（3 处） | 右侧目录 hover 的 `color/opacity`、目录选中项 hover 的 `color` | 选择器本就比 Material 的 `.md-nav__link:hover` 更具体；CDP 强制 `:hover` 验收，0 差异。要点：强制后等 ~300ms 让过渡跑完，否则读到动画中间值、偶尔误报 |
| 已删除死规则（2 处） | `.md-nav__item--nested > .md-nav__link--active` 的加亮规则 | 6 个代表性页面上**一次都匹配不到**：Material 只给「当前页自己」的链接加 `--active`，其父项是 `.md-nav__item--active` 而不是 `--nested` |
| 已去掉（3 处） | `.ai-result-container` 的 `padding/border`、`.ai-btn--stop` 的 `animation` | 用 `?ai-debug=1` 造出真实 UI 后对比计算值，0 差异 |
| 已换成提高权重（1 处） | `.ai-mode--selected` 的 `border-color` | 它要压过 `.ai-mode-option:hover`；直接去掉后**悬停会变回灰边**（实测确认），所以改写成 `.ai-mode-option.ai-mode--selected`（与 hover 同权重，靠源顺序取胜），悬停时边框仍是主色 |

**结论：`ujn.css` 里的 `!important` 已清零（原 17 处）。** 顺序始终是「先能测，再动」——
测不到就不动，能测到的都留了依据。

### 怎么验收 AI 面板

结果容器、停止按钮、模式选中态平时要真的提问或点开设置才会出现，无头会话里取不到。
带 `?ai-debug=1` 打开任意页面时，脚本会暴露 `window.__ujnAiDebug.sampleAnswer(问题文本)`：
它调用**真实**的构造函数把结果容器（含停止按钮）插进搜索结果列表；设置面板用现成的
`window.__openAISettings()`。这样量到的就是线上样式，而不是另写一套假 DOM。

**踩过的坑：改主题特性开关（`theme.features`）时要验证「少了什么」。** 第 2 轮为了让手机端在抽屉里
看到本页目录开了 `toc.integrate`，它在**所有宽度**下都会把本页目录并进左侧导航，桌面端右侧的
`md-sidebar--secondary` 于是整个从产物里消失（`grep -c md-sidebar--secondary site/pets/index.html` = 0）。
当时只确认了「手机端抽屉里多出目录」，没确认「桌面上少了目录」，直到第 9 轮做 `!important` 审计、
要测右侧目录 hover 时才发现页面上根本没这个元素。教训：加特性前先给**将被影响的那块界面**拍指纹，
加完再比一次——「新东西出现了」不等于「旧东西还在」。

### 无障碍：动态效果与键盘

- **`prefers-reduced-motion`**：`ujn.css` 最后有一条全局媒体查询，把动画与过渡压到 `.01ms`
  （不是 `none`——事件仍要触发，否则依赖 `transitionend` 的逻辑会卡住）。这里是**故意**用
  `!important` 的：页面级内联 `<style>` 在文档里更靠后，只有它才能稳定压住；与前面
  「`!important` 审计」不冲突，那一轮清掉的是多余的。改动后用 CDP 媒体模拟验收：
  `Emulation.setEmulatedMedia({features:[{name:'prefers-reduced-motion', value:'reduce'}]})`，
  在 `reduce` 与 `no-preference` 下各测一次，确认前者≈0、后者恢复原时长（普通访客不受影响）。
  `tests/frontend/reduced-motion.test.js` 做文本级守卫，防止重构时被顺手删掉。
- **相册弹窗**：焦点锁在弹窗内（Tab / Shift+Tab 循环）、Esc 关闭后焦点回到打开它的卡牌按钮、
  翻页用一个 `role="status" aria-live="polite"` 的隐藏区域播报「第 N 张，共 M 张」。

### 导航约定

**读者会主动找的页面，自己占一个顶级标签；只有「关于本站」这类常规元信息才收进分组。**
`tests/test_nav.py` 会检查标签数量上限、目标文件是否存在、有没有重复入口，以及这条归类规则。

| 标签 | 覆盖范围 |
| --- | --- |
| 首页 / 🌏 地点通 / 📗 绿皮书 / 📞 电话大全 / 🐾 宠物收集录 / 📜 规章制度 | 单一主题 |
| 🎓 校园生活 | 社团与组织、老乡群、校历（都属于「课外」） |
| 💡 反馈与贡献、🕒 最近更新 | 读者会主动找的入口，**不要塞进分组** |
| ℹ️ 关于 | 联系作者、免责声明（常规元信息） |

踩过的坑：曾经为了把标签从 12 个压到 8 个，把「反馈与贡献」「最近更新」并进「关于」——
结果手机端读者得展开抽屉才知道有这些页面，而我又在页面正文里补了一块「这一组还有别的页面」
来自救，等于用更绕的方式解决自己造的问题。结论：**分组只适合"读者不会专门去找"的页面**。

改导航时的验收：`npm run build` 会跑 `check_links.py`（每个入口、锚点、资源都过一遍）；
再在 1440 与 390 两个宽度各看一眼顶栏与手机抽屉。并标签时用脚本比对过「导航涉及的页面」
清单，确保一个页面都没丢。

### 站点体检工具

`mkdocs build --strict` 只校验 Markdown 源文件之间的链接，管不到页面里 HTML 注入的链接、
锚点和静态资源。构建之后跑一次这个，能把整站走一遍（257 个页面、4 万多个链接，十几秒）：

```powershell
python scripts/site/check_links.py              # 站内链接 / 锚点 / 图片 PDF 等资源，可进 CI
python scripts/site/check_links.py --external   # 再探一遍外链（需要网络，QQ、政务站会拦爬虫，仅供参考）
```

**这一关已经接进构建**：`npm run build`（= `scripts/build_site.py`）在严格构建之后会跑一次站内体检，
发现问题就让构建失败并打印报告——所以本地和 CI 都拦得住。外链只在手动加 `--external` 时探，
结果不影响退出码。

它抓到过一个真实问题：`overrides/main.html` 里手写 `{{ base_url }}/javascripts/...`，
在 404 页（`base_url` 是 `/`）会拼成 `//javascripts/...`——那是「协议相对地址」，
浏览器会去找一台叫 `javascripts` 的主机。**资源路径一律交给 Material 的 `| url` 过滤器**，
它会把各种情况都归一化。

## 无头浏览器验收

	ests/ 里的单元测试管不到「界面还是原来那样吗」「手机上会不会溢出」这类问题，
所以另有一套基于无头 Chrome 的验收脚本，放在 scripts/verify/，用法与经验见那里的 README：

`powershell
npm run verify:ui          # 截图 + computed style 指纹（改前 before / 改后 after）
npm run verify:ui:compare  # 两次指纹逐像素、逐属性比对
npm run verify:responsive  # 13 个页面 × 4 个宽度扫横向溢出
npm run verify:hit         # 命中检测：真实鼠标坐标点击，抓「被透明层挡住、点不到」
npm run verify:links       # 站内链接 / 锚点 / 资源（也已接进 npm run build）
`

它们抓到过的真问题（404 页脚本地址、桌面目录栏消失、搜索面板透明、胶囊组件状态漂移）
都记在那个 README 里——那几条正是「只跑单元测试不会发现」的典型。

## 本地预览
站点是**纯静态**的，本地预览不需要任何后端：

```powershell
python -m mkdocs serve --dev-addr 127.0.0.1:8000
# 打开 http://127.0.0.1:8000/
```

宠物收集录的照片、分页和相册弹窗全部在浏览器本地完成，不请求接口；`/admin`、`/api/*`
属于独立的私有后端仓库，本仓库不包含、本地也没有。`mkdocs serve` 在部分环境（后台会话、
无桌面通知）收不到文件变更，改了内容页面没变时重启一次即可。

猫猫卡牌墙由脚本生成，新增或修改猫猫页面后要重新生成（忘了跑，`npm run test:build` 会报错）：

```powershell
python scripts/pets/build_gallery.py
```

`npm run build` 会执行 `mkdocs build --strict --clean`，由 `hooks/pagefind.py` 使用本地 `pagefind` 生成搜索索引，再验证 `site/pagefind/pagefind.js`、索引文件和已知的 `pets/index.html` 页面。

## 部署到 GitHub Pages

仓库自带 `.github/workflows/pages.yml`：推送到 `main` 或手动触发就会构建并发布。
要求仓库公开，并在 `Settings → Pages → Build and deployment` 把 Source 选为 **GitHub Actions**。

项目站点位于 `https://<用户名>.github.io/<仓库名>/` 子路径下，workflow 会用
`SITE_URL` 覆盖 `mkdocs.yml` 的 `site_url`；搜索的 `basePath` / `baseUrl` 在运行时会
自动带上子路径，无需额外配置。本地复现 Pages 构建：

```powershell
$env:SITE_URL='https://k-zhaochao.github.io/ujn-guide/'
npm run build
```

反馈页同学留言区的 issue 列表由浏览器直接读 GitHub 公开接口，**要求仓库公开**（匿名读公开仓库不需要
token；私有仓库必须带 token，而 token 不能放在静态页面里）。GitHub Pages 不设 CSP，无需额外配置；
若改回自建 Nginx 并启用 CSP，需要在 `connect-src` 里放行 `https://api.github.com`，否则列表会显示
「暂时读不到」。本站已提供 Issues 列表与按需展开回复；若以后选择独立的讨论系统，可接入 giscus（需公开仓库、安装 giscus App 并开启 Discussions）。

`npm run test:frontend` 使用 Vitest + jsdom 运行前端脚本测试：猫猫图鉴的分页与相册弹窗、
反馈页的 GitHub issue 列表（用假 fetch）、综测计算器、MathJax 的按需加载与即时导航排版、
AI 助手与 Cloudflare AI Worker（源码在 `workers/ai-worker.js`）。它不访问真实 API。

## 宠物后台归档

宠物投稿后台的发布工具、本地代理、测试与运维材料已归档到 `_archive/pet-submission-backend/`，不参与当前构建。静态宠物图鉴不变。

本站使用 MkDocs 静态构建；`npm run dev:site` 启动本地预览，生产站点由 GitHub Pages 发布。

## 统一验证

```powershell
.\verify.ps1 -Target site
```

```bash
./verify.sh --target site
```

默认验证目标为主站，不再调用移除的私有后端。入口执行构建单元测试、前端测试、严格构建与依赖审计。`-SkipInstall` 用于依赖已安装后的本地复测；`-SkipAudit` 仅用于排障。测试报告写入被 Git 忽略的 `reports/site/`。


## 更新记录与反馈展示

Pages checkout 使用 `fetch-depth: 0`，更新生成器读取完整非合并提交，不限 30 条；前端每页 10 条，无 JavaScript 时保留全部记录。维护说明与测试证据放在仓库文档或本地 reports，不写进同学使用的页面。

反馈页使用公开 Issues 和按需加载回复，全部外部正文按纯文本渲染。留言草稿跳转 GitHub，由同学登录确认发布；站点不存放 GitHub token。贡献者按 GitHub/Gitee 分组，滑动指示器切换平台；切换栏仅显示平台名称，卡片保留个人提交次数。构建时获取、访客零请求；单个平台暂时失败时保留缓存。无 JavaScript 时显示两组名单。


## Gitee 更新同步到 GitHub Pages

目标链路：Gitee main 合并贡献 → GitHub main 同步 → pages.yml 构建并部署。

已启用 Gitee → GitHub 推送镜像，以 Gitee 为内容入口、GitHub 为部署镜像。本地提交后执行 `git push gitee main`；需要立即同步时，在 Gitee「仓库镜像管理」点击对应镜像的「更新」，再核对两端 main 提交与 GitHub Pages 部署状态。若历史分叉，先合并冲突，不覆盖任意一端的独有提交。

### 方法一：Gitee 推送镜像

若账号的仓库管理提供「仓库镜像管理 / 推送镜像」，选 **Gitee → GitHub 的推送镜像**，目标仓库 https://github.com/K-zhaochao/ujn-guide.git，配置 GitHub 身份与访问令牌。不要选择反方向的拉取镜像。功能开放及收费情况以当前账号界面为准。

令牌仅授予目标仓库所需的 Contents 写入；同步 .github/workflows/ 的提交还需 Workflows 写入权限。GitHub main 的分支保护也必须允许该身份。令牌只填在镜像配置，不写进仓库、网页、URL 或说明截图。

GitHub 仓库 Settings → Pages → Build and deployment → Source 选 GitHub Actions。推送镜像到 GitHub main 的提交会触发现有 Pages workflow。别人创建 PR 后仍需合并进 Gitee main，单纯 fork 或创建 PR 不更新主站。

### 方法二：GitHub Actions 定时拉取

以下是待启用模板，**本轮未安装定时同步任务**。先统一两端 main，再将模板保存为 .github/workflows/gitee-sync.yml 并提交 GitHub。一般内容更新可使用仓库 GITHUB_TOKEN；分支保护或工作流文件写入要求另行适配限定权限的 GitHub App/令牌。

```yaml
name: Sync Gitee to GitHub
on:
  schedule:
    - cron: '17,47 * * * *'
  workflow_dispatch:
permissions:
  contents: write
  actions: write
concurrency:
  group: gitee-sync
  cancel-in-progress: false
jobs:
  sync:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          ref: main
          fetch-depth: 0
      - name: Fast-forward main from Gitee
        id: sync
        shell: bash
        run: |
          set -euo pipefail
          git fetch --no-tags https://gitee.com/Draven323/ujn-guide.git main:refs/remotes/gitee/main
          if git merge-base --is-ancestor refs/remotes/gitee/main HEAD; then
            echo 'changed=false' >> "$GITHUB_OUTPUT"
            exit 0
          fi
          git merge --ff-only refs/remotes/gitee/main
          git push origin HEAD:main
          echo 'changed=true' >> "$GITHUB_OUTPUT"
      - name: Explicitly start verification and Pages deployment
        if: steps.sync.outputs.changed == 'true'
        env:
          GH_TOKEN: ${{ github.token }}
        run: |
          gh workflow run verify.yml --ref main
          gh workflow run pages.yml --ref main
```

模板每半小时检查一次，定时触发可能排队延迟；两端分叉时 --ff-only 停止并留下错误，不强推、不丢提交。GITHUB_TOKEN 的 push 默认不触发另一个 push workflow，因此模板显式调用 workflow_dispatch；忽略这一步会出现“代码同步了但页面未部署”。公开仓库的定时任务长期无活动可能被停用，需要在 Actions 中恢复。

参考：[GitHub 工作流触发规则](https://docs.github.com/en/actions/how-tos/write-workflows/choose-when-workflows-run/trigger-a-workflow)、[Gitee 官方镜像说明](https://blog.gitee.com/2021/07/15/repo-mirror/)、[GitHub 访问令牌](https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/managing-your-personal-access-tokens)。
