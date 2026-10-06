# 构建与验证

本仓库的静态站构建需要 Python 3.13+、Node.js 22.16.0 和 npm。Node 版本由 `.nvmrc` 固定，Python 依赖由 `requirements.txt` 精确锁定，Pagefind 由根目录 `package-lock.json` 锁定。

```powershell
python -m pip install -r requirements.txt
npm ci
npm run test:build
npm run test:frontend
npm run test:release
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
| `overrides/main.html` | 只剩约 70 行模板：公告栏结构、header、extrahead（Umami）、scripts（引入上面两个文件）。**不要往模板里塞回大段 `<style>` / `<script>`。** |
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

反馈页第 2 节的 issue 列表由浏览器直接读 GitHub 公开接口，**要求仓库公开**（匿名读公开仓库不需要
token；私有仓库必须带 token，而 token 不能放在静态页面里）。GitHub Pages 不设 CSP，无需额外配置；
若改回自建 Nginx 并启用 CSP，需要在 `connect-src` 里放行 `https://api.github.com`，否则列表会显示
「暂时读不到」。想要「页面内评论区」而不是列表，可换成 giscus（需公开仓库 + 安装 giscus App +
开启 Discussions）。

`npm run test:frontend` 使用 Vitest + jsdom 运行前端脚本测试：猫猫图鉴的分页与相册弹窗、
反馈页的 GitHub issue 列表（用假 fetch）、综测计算器、MathJax 的按需加载与即时导航排版、
AI 助手与 Cloudflare AI Worker（源码在 `workers/ai-worker.js`）。它不访问真实 API。

`npm run test:release` 验证同源 API 发布契约、release manifest、文件篡改拒绝与 health 对账。Linux 上的原子切换与回滚由 `scripts/release/` 提供；真实服务器配置和运维材料仅保存在本机 `deploy/` 目录。

`scripts/release/` 是配合私有后端仓库的不可变发布流程：先创建并校验不可变 release，再通过
`deploy-release.sh` 原子切换 `current`、重启服务并核对 health 的 release 摘要。纯静态内容
（本仓库当前的部署方式）不需要它，`npm run build` 后把 `site/` 交给静态托管即可。
`deploy/deploy.ps1` 仅是历史手工压缩脚本，不能用于生产发布。

## 统一验证

提交前使用根目录入口执行与 CI 相同的构建、单元测试和依赖审计。默认 `all` 会同时调用独立后端仓库的验证脚本；只检验主站时使用 `site`，不需要后端工作区。

```powershell
.\verify.ps1 -Target site
.\verify.ps1 -Target all
```

```bash
./verify.sh --target site
./verify.sh --target all
```

`-SkipInstall` 仅用于已经完成依赖安装后的本地复测；`-SkipAudit` 仅用于定位构建或测试问题，不能作为提交或发布证据。检查结果写入被 Git 忽略的 `reports/site/`，其中包含单元测试、严格构建、`npm audit` 和 `pip-audit` 输出。仓库的 `.github/workflows/verify.yml` 在 Ubuntu 与 Windows 上执行同一入口，并额外扫描完整 Git 历史中的泄露凭据。

后端位于独立的 `server/` 仓库，Node.js 同样固定为 22.16.0；其测试、覆盖率和迁移命令见 `server/README.md`。
