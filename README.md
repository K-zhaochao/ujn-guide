# 济南大学校园通 · ujn-guide

给济大学子的一站式校园指南：地点、绿皮书、电话、宠物图鉴、规章制度、实用工具。
主体是静态站（MkDocs Material + Pagefind 搜索），网页成绩导出使用独立的短时内存会话 Node 服务；宠物投稿后台已归档。构建与验收自动化。

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
npm run test:grades     # 教务登录、账号查询选项、内存会话与导出服务
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

网页仅提供本站输入账密的导出操作：登录后读取当前学生可查询的学年、学期，选择范围后下载 Excel。需部署独立的内存会话服务，详见 tools/grade-export/README.md。不再提供浏览器脚本、本地命令行或安装器；旧源码在 _archive/grade-export-legacy/ 留存。

## 目录结构

```
docs/                 站点内容（Markdown + 资源）
  assets/stylesheets/ 设计令牌与组件样式
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

## 许可

本站采用**严格的分层许可**——代码与内容分开授权，第三方素材各自保留原许可：

| 范围 | 许可 | 你可以做什么 |
| --- | --- | --- |
| **代码**（`scripts/`、`hooks/`、`overrides/`、`docs/javascripts/`、`docs/assets/stylesheets/`、`tools/`、`tests/`、构建配置） | **[AGPL-3.0](LICENSE)** | 可自由使用与修改；但**分发修改版、或把它作为网络服务提供，都必须以同样的许可公开全部源码** |
| **站点内容**（`docs/` 下的文字与原创图片） | **CC BY-NC-ND 4.0** | 可转载（署名 + 链接 + 非商业 + 不修改）；**不得商用、不得改动后发布** |
| **第三方素材** | 各自原许可 | 见 `docs/assets/fonts/NOTICE.txt`、`docs/assets/zongce-calculator/LICENSE.txt` 等 |

> 为什么选 AGPL：这个站点会被部署成公开服务，AGPL 的第 13 条（Remote Network Interaction）
> 正好覆盖「改完代码挂到网上给别人用」这种情形——**改动必须回馈**，避免有人拿改动版做闭源站点。
>
> 需要商用授权（例如把内容用于付费服务）请通过站点「关于 → 联系作者」联系维护者。


## 宠物后台归档与网页成绩导出

宠物投稿后台相关工具、测试和本机材料集中在 `_archive/pet-submission-backend/`（已忽略），可整体移走；静态图鉴保留。

`npm run build` 后执行 `npm run dev:site`，打开 `http://127.0.0.1:8787/tools/grade-export/` 使用网页表单。生产环境的 HTTPS 反向代理见 `tools/grade-export/README.md`；GitHub Pages 只托管静态部分，不运行该服务。
