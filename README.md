# 济南大学校园通 · ujn-guide

给济大学子的一站式校园指南：地点、绿皮书、电话、宠物图鉴、规章制度、实用工具。
站点是纯静态的（MkDocs Material + Pagefind 搜索），构建与验收全自动化。

- 线上站点：<https://ujn.matehub.top/>
- GitHub：<https://github.com/K-zhaochao/ujn-guide>
- Gitee：<https://gitee.com/Draven323/ujn-guide>

## 内容一览

| 栏目 | 说明 |
| --- | --- |
| 🌏 地点通 | 主校区 / 舜耕校区的教学楼、食堂、图书馆、生活设施，配地图与实拍 |
| 📗 绿皮书 | 学业规则、培养方案、奖助、应征入伍、转专业等 |
| 📞 电话大全 | 组织机构、学院、科研平台的联系方式 |
| 🎓 校园生活 | 社团与组织、老乡群、校历 |
| 🐾 宠物收集录 | 校园猫咪图集：按名字找猫、相册弹窗、每页数量对齐列数 |
| 📜 规章制度 | 学籍、考试、宿舍、安全等制度原文与解读 |
| 🧰 实用工具 | 综测计算器、教务成绩导出 |
| 💡 反馈与贡献 | 提意见 / 报错 / 直接改内容，附贡献者名单 |
| 🕒 最近更新 | 由 git 历史自动生成的读者可见更新 |
| ℹ️ 关于 | 联系作者、免责声明 |

## 本地开发

需要 **Node 22**（见 `.nvmrc`）与 **Python 3.13**。

```bash
npm ci                                    # 前端与构建工具
python -m pip install -r requirements.txt # MkDocs 与插件

npm run build      # 严格构建 + Pagefind 索引 + 站内链接体检
python -m mkdocs serve --dev-addr 127.0.0.1:8000   # 本地预览
```

常用脚本：

```bash
npm run test:frontend   # vitest：前端行为
npm run test:build      # python -m unittest：生成器与构建
npm run test:release    # 发布工具（需要私有 server/，公开仓库会自动跳过）
npm run verify:ui       # 无头浏览器：截图 + computed style 指纹
npm run verify:responsive  # 13 页 × 4 宽度扫横向溢出
npm run verify:hit      # 命中检测：用真实鼠标坐标抓「被透明层挡住、点不到」
npm run verify:links    # 链接 / 锚点 / 资源体检（也已接进 npm run build）
```

一键跑全部校验：`./verify.ps1 -Target site`（Windows）或 `./verify.sh --target site`。

产物与生成物：

- `site/` 是构建输出（已忽略）；缩略图、`docs/changelog.md`、贡献者名单都是**提交进仓库的生成物**，
  由 `scripts/build_site.py` 在构建前刷新——这样构建不依赖网络与 Pillow；
- 字体是自托管的子集（`docs/assets/fonts/`，见其中的 `NOTICE.txt`）。

## 实用工具：教务成绩导出

三种用法，按省事程度排列（详见站点「实用工具 → 教务成绩导出」）：

1. **Tampermonkey 脚本**（推荐，**不需要账号密码**）：在教务系统页面内运行，复用你已登录的会话；
2. **单文件可执行程序**（约 100 MB，内置 Node 运行时，双击即用）：见
   [Releases](https://github.com/K-zhaochao/ujn-guide/releases/latest)；
3. **本地安装器 / 命令行**：`tools/grade-export/` 下，也支持 `--user/--year/--term/--output` 参数。

> 这些工具都在**你自己的电脑上**运行，账号密码只在本机内存里用一次，不写入磁盘、不发给任何第三方。
> 本站是静态站点，没有后端，也没有任何地方会收到你的凭据。

构建单文件版：

```bash
node scripts/tools/build-exe.mjs   # 产物在 dist/（已忽略，不进仓库）
```

打 `v*` tag 时，`.github/workflows/build-binaries.yml` 会自动为 Windows / macOS / Linux 构建并作为
Release 附件上传。

## 目录结构

```
docs/                 站点内容（Markdown + 资源）
  assets/stylesheets/ 设计令牌与组件样式
  assets/tools/       成绩导出的脚本与安装器（供下载）
  javascripts/        站点交互脚本
hooks/                MkDocs 构建钩子（Pagefind）
overrides/            Material 主题模板覆盖
scripts/              构建、生成器、验收、发布工具
tests/                Python / vitest / node --test 三套测试
tools/grade-export/   成绩导出程序的源码
site/                 构建产物（忽略）
```

## 贡献

- 提意见 / 报错：站点「反馈与贡献」页有 GitHub 与 Gitee 两种入口；
- 直接改内容：改 `docs/` 下的 Markdown 即可，`npm run build` 会告诉你哪里有问题（含链接体检）；
- 提交前请让 `./verify.ps1 -Target site`（或 `./verify.sh --target site`）通过。

## 说明

- 本站由济大学子个人自发创建与维护，**与济南大学官方无任何隶属关系**；
- 内容仅供参考，不构成官方意见；引用他人成果请保留出处；
- 详细条款见站点「免责声明」页。
