---
title: 最近更新
hide:
  - toc
  - navigation
---

# 最近更新

校园指南的内容、功能和界面更新，按时间倒序排列。

<!-- changelog:start -->
<section id="ujn-changelog" data-page-size="10" aria-label="更新记录">
<ol class="ujn-changelog__list">
<li class="ujn-change" data-change-item><time datetime="2026-10-09">2026-10-09</time><div><p>🎨 校园指南响应式布局与猫猫图鉴分页，按需加载图片</p><span class="ujn-change__scope">校园生活 · 绿皮书 · 🐾 宠物收集录</span></div></li>
<li class="ujn-change" data-change-item><time datetime="2026-10-09">2026-10-09</time><div><p>🛠️ 贡献者首屏稳定切换、展开贡献指南并添加 WebP 图片工具</p></div></li>
<li class="ujn-change" data-change-item><time datetime="2026-10-09">2026-10-09</time><div><p>🎨 更新页码输入校验、精简贡献者切换并下线成绩导出</p><span class="ujn-change__scope">grade-export · 实用工具</span></div></li>
<li class="ujn-change" data-change-item><time datetime="2026-10-08">2026-10-08</time><div><p>✨ 纯静态官网成绩导出与贡献者平台滑块</p><span class="ujn-change__scope">grade-export</span></div></li>
<li class="ujn-change" data-change-item><time datetime="2026-10-08">2026-10-08</time><div><p>优化校园通：完整更新分页、同学留言与网页成绩导出</p><span class="ujn-change__scope">grade-export · 实用工具</span></div></li>
<li class="ujn-change" data-change-item><time datetime="2026-10-07">2026-10-07</time><div><p>成绩导出脚本 v1.3：照学校源码复刻真实导出流程（export_exportConfig.html + dcclbh=JW_N305005_XSCXCJ + 23 列 + 提交筛选表单），并删掉已废弃的自建请求路径</p></div></li>
<li class="ujn-change" data-change-item><time datetime="2026-10-07">2026-10-07</time><div><p>成绩导出脚本 v1.2：优先点学校自带的导出按钮（自己拼参数会被判非法，返回通用错误页）；找不到才退回自建请求</p></div></li>
<li class="ujn-change" data-change-item><time datetime="2026-10-07">2026-10-07</time><div><p>成绩导出脚本 v1.1：带 ?gnmkdm= 菜单码、参数改从页面读取、失败时打印服务端原话（旧版在真实系统上导出返回 HTML）</p></div></li>
<li class="ujn-change" data-change-item><time datetime="2026-10-07">2026-10-07</time><div><p>贡献者：按 GitHub/Gitee 分类 + 滑动切换（无 JS 时两个面板都显示）；对比度改为跟随主题前景色；LICENSE 采用 AGPL-3.0</p></div></li>
<li class="ujn-change" data-change-item><time datetime="2026-10-07">2026-10-07</time><div><p>工具与文档：单文件可执行程序（Node SEA）构建脚本 + 三系统 Release workflow；README；成绩导出页按系统给下载入口</p><span class="ujn-change__scope">grade-export</span></div></li>
<li class="ujn-change" data-change-item><time datetime="2026-10-07">2026-10-07</time><div><p>修复 CI：verify.sh 末尾的 [[ ]] &amp;&amp; cmd 在条件为假时让脚本返回 1（所有检查全绿却 exit 1 的真凶）</p></div></li>
<li class="ujn-change" data-change-item><time datetime="2026-10-07">2026-10-07</time><div><p>修复 CI 审计判据：改用脚本解析 pip-audit 报告（顶层没有 vulnerabilities 字段，之前 grep 永不匹配导致无漏洞也判红）+ 4 项单测</p></div></li>
<li class="ujn-change" data-change-item><time datetime="2026-10-07">2026-10-07</time><div><p>修复 CI：Python 审计以报告内容为准（pip-audit 在 Linux 上报无漏洞却返回 1，被 set -e 直接判死）</p></div></li>
<li class="ujn-change" data-change-item><time datetime="2026-10-07">2026-10-07</time><div><p>修复 CI 最后两处：verify.sh 用不存在的 PROJECT_ROOT 变量；Pillow 升到 12.3.0（12.0.0 有 37 条已知漏洞）</p></div></li>
<li class="ujn-change" data-change-item><time datetime="2026-10-07">2026-10-07</time><div><p>修复 CI：无私有 server/ 时跳过 release 工具测试（公开仓库里它们必然 MODULE_NOT_FOUND）</p></div></li>
<li class="ujn-change" data-change-item><time datetime="2026-10-07">2026-10-07</time><div><p>修复 CI：宠物卡牌路径先 resolve 再算相对路径（Windows 8.3 短名导致 ValueError）；公开仓库跳过依赖私有后端的 admin 套件</p></div></li>
<li class="ujn-change" data-change-item><time datetime="2026-10-07">2026-10-07</time><div><p>修复 CI：链接检查器识别部署子路径（SITE_URL 的 /ujn-guide 前缀曾导致 148 处误报）</p></div></li>
<li class="ujn-change" data-change-item><time datetime="2026-10-07">2026-10-07</time><div><p>测试：Pagefind 钩子的断言改为 shell=False（原断言把导致 CI 失败的 bug 钉成了期望）</p></div></li>
<li class="ujn-change" data-change-item><time datetime="2026-10-07">2026-10-07</time><div><p>修复 CI：Pagefind 钩子误用 shell=True 配列表（Linux 上等于只跑 npx）；宠物卡牌相对路径不再依赖盘符</p></div></li>
<li class="ujn-change" data-change-item><time datetime="2026-10-07">2026-10-07</time><div><p>修复 CI：scripts/site/ 被 .gitignore 吞掉（3 个测试报 FileNotFoundError）；Windows 运行器强制 UTF-8</p></div></li>
<li class="ujn-change" data-change-item><time datetime="2026-10-07">2026-10-07</time><div><p>🛠️ Windows 双击入口不再&quot;闪一下就没了&quot;</p></div></li>
<li class="ujn-change" data-change-item><time datetime="2026-10-07">2026-10-07</time><div><p>工具：成绩导出的安装器（Windows / macOS / Linux）与页面入口</p><span class="ujn-change__scope">grade-export</span></div></li>
<li class="ujn-change" data-change-item><time datetime="2026-10-07">2026-10-07</time><div><p>工具：教务成绩导出的本地版 CLI（按说明第 1~3 节实现）+ 本地假教务系统自测</p></div></li>
<li class="ujn-change" data-change-item><time datetime="2026-10-07">2026-10-07</time><div><p>修正：删掉误写进读者页面的「为什么不能输密码」解释；宠物页每页数量对齐列数</p></div></li>
<li class="ujn-change" data-change-item><time datetime="2026-10-07">2026-10-07</time><div><p>文档：验收脚本 README 与 BUILDING.md 补上命中检测（npm run verify:hit）</p></div></li>
<li class="ujn-change" data-change-item><time datetime="2026-10-07">2026-10-07</time><div><p>工具：固化「真实鼠标命中检测」；宠物页找猫筛选补 jsdom 用例</p></div></li>
<li class="ujn-change" data-change-item><time datetime="2026-10-07">2026-10-07</time><div><p>工具与字体：教务成绩导出改成 Tampermonkey 脚本；全站换成霞鹜文楷</p><span class="ujn-change__scope">grade-export · 实用工具</span></div></li>
<li class="ujn-change" data-change-item><time datetime="2026-10-07">2026-10-07</time><div><p>🎨 修好手机端页头图标不齐（Material 的不对称下边距）</p></div></li>
<li class="ujn-change" data-change-item><time datetime="2026-10-07">2026-10-07</time><div><p>🎨 标题改用霞鹜文楷（子集化 194 KB），并按计划把字体方案落地</p></div></li>
<li class="ujn-change" data-change-item><time datetime="2026-10-07">2026-10-07</time><div><p>✨ 新增「实用工具」落地页与教务成绩导出工具；主页原「综测计算器」卡片改为「实用工具」</p><span class="ujn-change__scope">grade-export · 实用工具</span></div></li>
<li class="ujn-change" data-change-item><time datetime="2026-10-07">2026-10-07</time><div><p>🎨 修好页头对齐与「免责声明」点不了；宠物页加找猫筛选；落地字体方案</p><span class="ujn-change__scope">🐾 宠物收集录</span></div></li>
<li class="ujn-change" data-change-item><time datetime="2026-10-07">2026-10-07</time><div><p>🎨 页头按钮真正对齐并补上仓库入口；更新页/反馈页去掉左侧栏</p></div></li>
<li class="ujn-change" data-change-item><time datetime="2026-10-07">2026-10-07</time><div><p>文档：构建时刷新「最近更新」页（收录</p></div></li>
<li class="ujn-change" data-change-item><time datetime="2026-10-07">2026-10-07</time><div><p>工具：把这次的验收脚本收进仓库（scripts/verify/）</p></div></li>
<li class="ujn-change" data-change-item><time datetime="2026-10-07">2026-10-07</time><div><p>🎨 页头 QQ 群入口与其它图标对齐（同一套尺寸与基线）</p></div></li>
<li class="ujn-change" data-change-item><time datetime="2026-10-07">2026-10-07</time><div><p>修复与内容：手机端搜索面板补回返回箭头；赞助措辞与开源仓库入口</p></div></li>
<li class="ujn-change" data-change-item><time datetime="2026-10-07">2026-10-07</time><div><p>🧭 反馈与贡献、最近更新改回独立标签，撤掉「这一组还有别的页面」</p></div></li>
<li class="ujn-change" data-change-item><time datetime="2026-10-07">2026-10-07</time><div><p>🎨 跳蚤市场与赞助从页脚移到首页入口卡片</p></div></li>
<li class="ujn-change" data-change-item><time datetime="2026-10-07">2026-10-07</time><div><p>✨ 反馈页顶部展示 GitHub 与 Gitee 的贡献者名单</p></div></li>
<li class="ujn-change" data-change-item><time datetime="2026-10-07">2026-10-07</time><div><p>🎨 宠物收集录去掉无用的左侧栏；「关于」组的兄弟页面在本页列出</p><span class="ujn-change__scope">🐾 宠物收集录</span></div></li>
<li class="ujn-change" data-change-item><time datetime="2026-10-07">2026-10-07</time><div><p>🎨 页脚改成「居中按钮 + 居中签名」，去掉 Material 版权行</p></div></li>
<li class="ujn-change" data-change-item><time datetime="2026-10-07">2026-10-07</time><div><p>🛠️ 搜索面板的「大家都在搜」是透明的，正文会从面板里透出来</p></div></li>
<li class="ujn-change" data-change-item><time datetime="2026-10-07">2026-10-07</time><div><p>🧭 顶级导航 12 -&gt; 8 个标签，站点自身的页面收进「关于」</p></div></li>
<li class="ujn-change" data-change-item><time datetime="2026-10-07">2026-10-07</time><div><p>构建：站内链接体检接进构建，并给它补上测试</p></div></li>
<li class="ujn-change" data-change-item><time datetime="2026-10-07">2026-10-07</time><div><p>🛠️ 404 页的脚本地址会拼成 //javascripts/…，导致脚本加载失败</p></div></li>
<li class="ujn-change" data-change-item><time datetime="2026-10-07">2026-10-07</time><div><p>✨ 搜不到结果时推荐几个热门词，把死路变成出口</p></div></li>
<li class="ujn-change" data-change-item><time datetime="2026-10-07">2026-10-07</time><div><p>✨ 搜索面板加「大家都在搜」，新生不再对着空搜索框发呆</p></div></li>
<li class="ujn-change" data-change-item><time datetime="2026-10-07">2026-10-07</time><div><p>无障碍：支持系统的「减少动态效果」设置</p></div></li>
<li class="ujn-change" data-change-item><time datetime="2026-10-07">2026-10-07</time><div><p>✨ 新增「最近更新」页，由 git 提交历史自动生成</p></div></li>
<li class="ujn-change" data-change-item><time datetime="2026-10-07">2026-10-07</time><div><p>重构：清掉 ujn.css 最后 4 处 !important，并给 AI 面板加可验收入口</p></div></li>
<li class="ujn-change" data-change-item><time datetime="2026-10-07">2026-10-07</time><div><p>✨ 窄屏补上「本页目录」，手机端不再迷路</p></div></li>
<li class="ujn-change" data-change-item><time datetime="2026-10-07">2026-10-07</time><div><p>🛠️ 恢复桌面端右侧「目录」栏</p></div></li>
<li class="ujn-change" data-change-item><time datetime="2026-10-07">2026-10-07</time><div><p>无障碍：相册弹窗锁住 Tab 焦点，翻页用 live region 播报</p></div></li>
<li class="ujn-change" data-change-item><time datetime="2026-10-06">2026-10-06</time><div><p>重构：审计 !important，去掉 8 处能证明多余的</p></div></li>
<li class="ujn-change" data-change-item><time datetime="2026-10-06">2026-10-06</time><div><p>重构：胶囊按钮/页签抽成共用组件 .ujn-pill</p><span class="ujn-change__scope">🐾 宠物收集录</span></div></li>
<li class="ujn-change" data-change-item><time datetime="2026-10-06">2026-10-06</time><div><p>重构：ujn.css 收敛设计令牌，弹窗抽成共用骨架</p></div></li>
<li class="ujn-change" data-change-item><time datetime="2026-10-06">2026-10-06</time><div><p>性能：卡牌封面改用缩略图，首屏图片传输降 73~75%</p><span class="ujn-change__scope">🐾 宠物收集录</span></div></li>
<li class="ujn-change" data-change-item><time datetime="2026-10-06">2026-10-06</time><div><p>🎨 首页的「手机端浏览提示」只在窄屏显示</p></div></li>
<li class="ujn-change" data-change-item><time datetime="2026-10-06">2026-10-06</time><div><p>重构：拆开主题覆盖层，样式与脚本各自独立成文件</p></div></li>
<li class="ujn-change" data-change-item><time datetime="2026-10-06">2026-10-06</time><div><p>🧭 导航去重、公告栏可关闭、折叠块标题带上条数</p><span class="ujn-change__scope">学院 · 组织机构 · 科研平台</span></div></li>
<li class="ujn-change" data-change-item><time datetime="2026-10-06">2026-10-06</time><div><p>验证：发布链路日志安全、上传契约与后台用例加固</p></div></li>
<li class="ujn-change" data-change-item><time datetime="2026-10-06">2026-10-06</time><div><p>✨ 接入综测计算器</p><span class="ujn-change__scope">绿皮书 · 荣誉评选与奖金须知 · 综测计算器</span></div></li>
<li class="ujn-change" data-change-item><time datetime="2026-10-06">2026-10-06</time><div><p>文档：更新 BUILDING.md 的本地预览、Pages 部署与性能约定</p></div></li>
<li class="ujn-change" data-change-item><time datetime="2026-10-06">2026-10-06</time><div><p>部署与性能：GitHub Pages 子路径构建，并去掉两个高代价外部请求</p><span class="ujn-change__scope">主校区总览 · 舜耕校区总览</span></div></li>
<li class="ujn-change" data-change-item><time datetime="2026-10-06">2026-10-06</time><div><p>✨ 新增「反馈与贡献」页与站内 GitHub issue 列表</p></div></li>
<li class="ujn-change" data-change-item><time datetime="2026-10-06">2026-10-06</time><div><p>↩️ 下线宠物投稿系统，宠物收集录重建为照片卡牌墙</p><span class="ujn-change__scope">🐾 宠物收集录</span></div></li>
<li class="ujn-change" data-change-item><time datetime="2026-09-02">2026-09-02</time><div><p>验证：新增本地同源上线验收与发布前检查</p></div></li>
<li class="ujn-change" data-change-item><time datetime="2026-09-02">2026-09-02</time><div><p>🎨 增强通知日期筛选控件的辨识度与触控尺寸</p><span class="ujn-change__scope">🐾 宠物收集录</span></div></li>
<li class="ujn-change" data-change-item><time datetime="2026-09-02">2026-09-02</time><div><p>🛠️ 通知日期选择器切换月份不再关闭面板</p></div></li>
<li class="ujn-change" data-change-item><time datetime="2026-09-02">2026-09-02</time><div><p>✨ 投稿详情新增分页点赞列表弹窗与移动端体验</p><span class="ujn-change__scope">🐾 宠物收集录</span></div></li>
<li class="ujn-change" data-change-item><time datetime="2026-09-01">2026-09-01</time><div><p>🛠️ 通知日期选择器交互不再关闭通知窗口；将挂载在页面根节点的自定义日历面板识别为通知筛选的内部操作，避免日期翻页和选日被外部点击逻辑误关闭；补充回归测试并重新构建主站静态文件。</p></div></li>
<li class="ujn-change" data-change-item><time datetime="2026-09-01">2026-09-01</time><div><p>✨ 主站通知支持站长消息、日期筛选、显式已读与撤回同步；将互动通知统一更名为通知，复用我的投稿日期选择器并适配手机端；未读站长通知置顶，内容卡片仅在用户点击已读后解除置顶；补充通知和后台通知页前端测试，并已完成前端全量测试与静态构建。</p><span class="ujn-change__scope">🐾 宠物收集录</span></div></li>
<li class="ujn-change" data-change-item><time datetime="2026-09-01">2026-09-01</time><div><p>深色主题投稿状态标签改用不透明底色</p><span class="ujn-change__scope">🐾 宠物收集录</span></div></li>
<li class="ujn-change" data-change-item><time datetime="2026-09-01">2026-09-01</time><div><p>为我的收藏增加筛选并适配投稿状态徽章深色主题</p><span class="ujn-change__scope">🐾 宠物收集录</span></div></li>
<li class="ujn-change" data-change-item><time datetime="2026-09-01">2026-09-01</time><div><p>主站搜索支持投稿 ID 精确查找</p></div></li>
<li class="ujn-change" data-change-item><time datetime="2026-08-17">2026-08-17</time><div><p>下拉固定高度列表滚动条同步至管理后台 + resize 防御</p></div></li>
<li class="ujn-change" data-change-item><time datetime="2026-08-16">2026-08-16</time><div><p>选项面板内部滚动（滚动条/鼠标滚轮）不再误关闭</p></div></li>
<li class="ujn-change" data-change-item><time datetime="2026-08-16">2026-08-16</time><div><p>类型筛选下拉改为固定高度列表 + 右侧适配主题滚动条</p><span class="ujn-change__scope">🐾 宠物收集录</span></div></li>
<li class="ujn-change" data-change-item><time datetime="2026-08-16">2026-08-16</time><div><p>「我的投稿」全部类型筛选改为固定大小的滚轮选择器</p><span class="ujn-change__scope">🐾 宠物收集录</span></div></li>
<li class="ujn-change" data-change-item><time datetime="2026-08-16">2026-08-16</time><div><p>投稿弹窗新增草稿提示条，图片超限改为设计弹窗</p></div></li>
<li class="ujn-change" data-change-item><time datetime="2026-08-16">2026-08-16</time><div><p>投稿草稿改为浏览器本地存储（含图片），无草稿不提示</p></div></li>
<li class="ujn-change" data-change-item><time datetime="2026-08-16">2026-08-16</time><div><p>投稿限额生效约束与单图上限 2MB 前端同步</p></div></li>
<li class="ujn-change" data-change-item><time datetime="2026-08-16">2026-08-16</time><div><p>投稿照片上限默认 10 张 + 我的投稿默认列表不再展示软删除作品</p></div></li>
<li class="ujn-change" data-change-item><time datetime="2026-08-15">2026-08-15</time><div><p>宠物风控件与 IP 封禁筛选测试</p></div></li>
<li class="ujn-change" data-change-item><time datetime="2026-08-15">2026-08-15</time><div><p>分页组件测试更新为宠物风结构</p></div></li>
<li class="ujn-change" data-change-item><time datetime="2026-08-15">2026-08-15</time><div><p>🐾 宠物页分页条主题化与每页数量下拉（图鉴/我的/收藏）</p><span class="ujn-change__scope">🐾 宠物收集录</span></div></li>
<li class="ujn-change" data-change-item><time datetime="2026-08-15">2026-08-15</time><div><p>🐾 我的投稿/收藏：分页条始终显示 + 每页数量响应式（手机6/电脑12）</p></div></li>
<li class="ujn-change" data-change-item><time datetime="2026-08-15">2026-08-15</time><div><p>🐾 图鉴分页滚动目标调整：滚到搜索框（工具栏）而非列表顶部</p></div></li>
<li class="ujn-change" data-change-item><time datetime="2026-08-15">2026-08-15</time><div><p>🐾 宠物页分页翻页滚动修复：不再滑到页面顶部，改为滑到组件内第一个作品位置</p></div></li>
<li class="ujn-change" data-change-item><time datetime="2026-08-15">2026-08-15</time><div><p>测试：pet-views 状态徽章断言增强（bg/color 校验四种状态底色，与 mineStatusMeta 实际实现一致）</p></div></li>
<li class="ujn-change" data-change-item><time datetime="2026-08-15">2026-08-15</time><div><p>🐾 宠物页 UI 优化：筛选控件可爱化（自定义下拉/日历）+ 我的投稿状态徽章补底色</p><span class="ujn-change__scope">🐾 宠物收集录</span></div></li>
<li class="ujn-change" data-change-item><time datetime="2026-08-15">2026-08-15</time><div><p>恢复登录用户个人工作区的收起与展开控制</p><span class="ujn-change__scope">🐾 宠物收集录</span></div></li>
<li class="ujn-change" data-change-item><time datetime="2026-08-15">2026-08-15</time><div><p>重构宠物个人工作区并统一投稿收藏入口</p><span class="ujn-change__scope">🐾 宠物收集录</span></div></li>
<li class="ujn-change" data-change-item><time datetime="2026-08-15">2026-08-15</time><div><p>完善被拒修订撤回与手机端投稿适配</p></div></li>
<li class="ujn-change" data-change-item><time datetime="2026-08-15">2026-08-15</time><div><p>优化被拒修订的提示与再次修改流程</p></div></li>
<li class="ujn-change" data-change-item><time datetime="2026-08-15">2026-08-15</time><div><p>完善投稿待审核流转与互动通知层级</p></div></li>
<li class="ujn-change" data-change-item><time datetime="2026-08-15">2026-08-15</time><div><p>完善宠物投稿互动通知与修订审核前端</p><span class="ujn-change__scope">🐾 宠物收集录</span></div></li>
<li class="ujn-change" data-change-item><time datetime="2026-08-14">2026-08-14</time><div><p>完善主站宠物投稿的站内确认弹窗、公开稿修改再审核提示与交互回归测试</p></div></li>
<li class="ujn-change" data-change-item><time datetime="2026-08-14">2026-08-14</time><div><p>移除我的投稿冗余查看入口并收敛交互测试</p></div></li>
<li class="ujn-change" data-change-item><time datetime="2026-08-14">2026-08-14</time><div><p>🎨 完善投稿详情与登录后移动端操作界面</p><span class="ujn-change__scope">🐾 宠物收集录</span></div></li>
<li class="ujn-change" data-change-item><time datetime="2026-08-14">2026-08-14</time><div><p>🛠️ 限制回收站投稿恢复权限并同步刷新我的投稿列表</p></div></li>
<li class="ujn-change" data-change-item><time datetime="2026-08-14">2026-08-14</time><div><p>测试：覆盖管理后台重复图片展示防线</p></div></li>
<li class="ujn-change" data-change-item><time datetime="2026-08-14">2026-08-14</time><div><p>🛠️ 我的投稿详情隐藏重复图片地址</p></div></li>
<li class="ujn-change" data-change-item><time datetime="2026-08-14">2026-08-14</time><div><p>测试：同步主站与后台入口的视图渲染契约</p></div></li>
<li class="ujn-change" data-change-item><time datetime="2026-08-14">2026-08-14</time><div><p>纳管 AI Worker 并固化生产发布上传契约</p></div></li>
<li class="ujn-change" data-change-item><time datetime="2026-08-14">2026-08-14</time><div><p>完善宠物收集录我的收藏视图与点赞同步闭环</p><span class="ujn-change__scope">🐾 宠物收集录</span></div></li>
<li class="ujn-change" data-change-item><time datetime="2026-08-14">2026-08-14</time><div><p>P1-01/02: 补充投稿图片顺序与审批冲突交互测试</p></div></li>
<li class="ujn-change" data-change-item><time datetime="2026-08-14">2026-08-14</time><div><p>P1-04: 构建 hook、AI Worker 与部署脚本 dry-run 测试</p></div></li>
<li class="ujn-change" data-change-item><time datetime="2026-08-12">2026-08-12</time><div><p>P1-02: 管理后台 jsdom 组件测试（admin-ui.test.js 15 项）</p></div></li>
<li class="ujn-change" data-change-item><time datetime="2026-08-12">2026-08-12</time><div><p>extract submit form to pet-submit.js with tests</p></div></li>
<li class="ujn-change" data-change-item><time datetime="2026-08-12">2026-08-12</time><div><p>P1-01: 我的投稿交互逻辑外置（pet-mine.js）并补组件测试</p></div></li>
<li class="ujn-change" data-change-item><time datetime="2026-08-12">2026-08-12</time><div><p>P1-02: 管理后台渲染层组件测试（admin-views.test.js）</p></div></li>
<li class="ujn-change" data-change-item><time datetime="2026-08-12">2026-08-12</time><div><p>P1-01: 宠物前端渲染层与工具层外置（pet-views.js / pet-format.js）</p></div></li>
<li class="ujn-change" data-change-item><time datetime="2026-08-12">2026-08-12</time><div><p>主站按内容模型提示并校验图片限额</p></div></li>
<li class="ujn-change" data-change-item><time datetime="2026-08-12">2026-08-12</time><div><p>收敛我的投稿状态筛选入口</p></div></li>
<li class="ujn-change" data-change-item><time datetime="2026-08-11">2026-08-11</time><div><p>完善主站投稿修订状态展示</p></div></li>
<li class="ujn-change" data-change-item><time datetime="2026-08-11">2026-08-11</time><div><p>校验管理后台静态资源发布完整性</p></div></li>
<li class="ujn-change" data-change-item><time datetime="2026-08-11">2026-08-11</time><div><p>同步单域发布配置校验</p></div></li>
<li class="ujn-change" data-change-item><time datetime="2026-08-11">2026-08-11</time><div><p>主站改为直接进入同源管理后台</p></div></li>
<li class="ujn-change" data-change-item><time datetime="2026-08-11">2026-08-11</time><div><p>校验同源后端回环监听</p></div></li>
<li class="ujn-change" data-change-item><time datetime="2026-08-11">2026-08-11</time><div><p>新增本地同源联调入口</p></div></li>
<li class="ujn-change" data-change-item><time datetime="2026-08-11">2026-08-11</time><div><p>调整后端默认端口为3005</p></div></li>
<li class="ujn-change" data-change-item><time datetime="2026-08-11">2026-08-11</time><div><p>完善同源部署代理校验</p></div></li>
<li class="ujn-change" data-change-item><time datetime="2026-08-11">2026-08-11</time><div><p>拆分宠物 OAuth 与弹窗交互模块</p></div></li>
<li class="ujn-change" data-change-item><time datetime="2026-08-11">2026-08-11</time><div><p>提取宠物前端视图模型并补充测试</p></div></li>
<li class="ujn-change" data-change-item><time datetime="2026-08-11">2026-08-11</time><div><p>建立宠物前端认证测试基础</p></div></li>
<li class="ujn-change" data-change-item><time datetime="2026-08-11">2026-08-11</time><div><p>迁移宠物登录至 Cookie 会话</p></div></li>
<li class="ujn-change" data-change-item><time datetime="2026-08-11">2026-08-11</time><div><p>校验 OAuth 弹窗随机数</p></div></li>
<li class="ujn-change" data-change-item><time datetime="2026-08-11">2026-08-11</time><div><p>停止跟踪本机部署材料</p></div></li>
<li class="ujn-change" data-change-item><time datetime="2026-08-11">2026-08-11</time><div><p>建立不可变发布与回滚链路</p></div></li>
<li class="ujn-change" data-change-item><time datetime="2026-08-11">2026-08-11</time><div><p>建立主站持续集成与统一验证入口</p></div></li>
<li class="ujn-change" data-change-item><time datetime="2026-08-11">2026-08-11</time><div><p>固定静态站构建工具链</p><span class="ujn-change__scope">教育与心理科学学院 · 共青团团员证管理规定 · 🪪 校园卡使用指南</span></div></li>
<li class="ujn-change" data-change-item><time datetime="2026-08-11">2026-08-11</time><div><p>P2-13 我的投稿增强 + P2-14 无障碍与移动端</p><span class="ujn-change__scope">🐾 宠物收集录</span></div></li>
<li class="ujn-change" data-change-item><time datetime="2026-08-10">2026-08-10</time><div><p>P1 整改前端配套</p></div></li>
<li class="ujn-change" data-change-item><time datetime="2026-08-09">2026-08-09</time><div><p>拆分仓库——server 移入独立私有仓库，本仓库不再跟踪后端代码</p></div></li>
<li class="ujn-change" data-change-item><time datetime="2026-08-09">2026-08-09</time><div><p>仓库拆分前快照（撤回草稿/草稿修订页/我的投稿搜索等未提交改动）</p></div></li>
<li class="ujn-change" data-change-item><time datetime="2026-08-09">2026-08-09</time><div><p>main.html 排版调整（Umami 注释缩进 + MathJax 标签折行）</p></div></li>
<li class="ujn-change" data-change-item><time datetime="2026-08-09">2026-08-09</time><div><p>P2 安全加固 + 登录按钮 + 内容模型 UI</p></div></li>
<li class="ujn-change" data-change-item><time datetime="2026-08-09">2026-08-09</time><div><p>修复 OAuth postMessage 来源校验、AI DOM XSS、trust proxy 与图片上传校验，移除硬编码凭据</p></div></li>
<li class="ujn-change" data-change-item><time datetime="2026-08-09">2026-08-09</time><div><p>宠物投稿系统重构 v5（内容模型/审核/审计/媒体资产）+ 安全净化基线</p><span class="ujn-change__scope">🐾 宠物收集录</span></div></li>
<li class="ujn-change" data-change-item><time datetime="2026-08-06">2026-08-06</time><div><p>宠物投稿系统基础实现（GitHub OAuth + 即时发布引擎）</p><span class="ujn-change__scope">🐾 宠物收集录</span></div></li>
<li class="ujn-change" data-change-item><time datetime="2026-07-29">2026-07-29</time><div><p>优化markdown公式的cdn</p><span class="ujn-change__scope">成绩规则</span></div></li>
<li class="ujn-change" data-change-item><time datetime="2026-07-28">2026-07-28</time><div><p>优化页脚按钮的显示</p></div></li>
<li class="ujn-change" data-change-item><time datetime="2026-07-28">2026-07-28</time><div><p>新增贡献者、改变联系方式和免责声明位置</p><span class="ujn-change__scope">2023-2024学年第二学期转专业方案汇总 · 2024-2025学年第二学期转专业方案汇总 · 图书馆常见问题</span></div></li>
<li class="ujn-change" data-change-item><time datetime="2026-07-28">2026-07-28</time><div><p>重新设计首页，新增“联系作者”和“免责声明”按钮，优化地点通修改正确折叠地图链接，新增舜耕校区图书馆相关文件</p><span class="ujn-change__scope">⚖️ 免责声明 · 🪪 校园卡使用指南 · 第1食堂·学府宴</span></div></li>
<li class="ujn-change" data-change-item><time datetime="2026-07-28">2026-07-28</time><div><p>init — 济南大学校园通 v1.0</p><span class="ujn-change__scope">社团与组织 · 学校组织 · ftf-board-game</span></div></li>
</ol>
<nav class="ujn-pagination" data-change-pagination aria-label="更新记录分页" hidden></nav>
</section>
<!-- changelog:end -->

[有建议或发现错误？来反馈一下 →](contribute/index.md)
