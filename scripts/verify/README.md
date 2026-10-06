# 无头浏览器验收工具

这些脚本用一个开着远程调试端口的 Chrome，对**构建产物**做自动验收。它们不是单元测试
（那部分在 `tests/`），而是回答「改完之后界面还是原来那样吗」「手机上会不会溢出」这类问题。

## 准备环境

```powershell
# 1) 构建产物，并用一个静态服务器把它跑起来（用子路径模拟 GitHub Pages 更贴近线上）
npm run build

# 2) 起一个带远程调试端口的无头 Chrome
& "C:\Program Files\Google\Chrome\Application\chrome.exe" `
  --headless=new --disable-gpu --hide-scrollbars --no-first-run `
  --remote-debugging-port=9222 --user-data-dir="$env:TEMP\uin-cdp" `
  --window-size=1440,950 about:blank
```

默认访问 `http://127.0.0.1:8100/ujn-guide`（子路径部署的样子）。
换地址或输出目录用环境变量：`UJN_BASE_URL`、`UJN_OUT_DIR`、`UJN_SITE_DIR`。

## 三个脚本

### 1. 像素 + 样式指纹 —— 「看着一模一样」的证明

```powershell
node scripts/verify/fingerprint.mjs before     # 改代码之前
# ……改代码……
node scripts/verify/fingerprint.mjs after
python scripts/verify/compare_fingerprint.py before after
```

覆盖 6 个页面/视口（首页桌面/手机/深色、跳蚤市场弹窗、赞助弹窗、宠物收集录）的截图，
以及 11 个关键元素的 16 项 computed style。**两边都要比**：截图对颜色微调不敏感，
computed style 对「形状变了但颜色没变」不敏感。

> 基线必须取自「改动前的当前提交」。拿几天前的指纹去比，会把别人的改动算进来——
> 我踩过这个坑，白查了半天。工作区已经改了代码时，用 `git stash` 收起来再取基线。

### 2. 响应式体检 —— 手机上会不会溢出

```powershell
node scripts/verify/responsive-sweep.mjs
```

每个顶层目录取一个代表页 + 几个深层页，在 390 / 768 / 1024 / 1440 四个宽度下量横向溢出，
并列出超出视口的元素（tag + class + 越界像素）。

### 3. 命中检测 —— 「看起来能点」的东西真的能点到吗

```powershell
npm run verify:hit
```

取元素中心坐标，用 CDP 在真实坐标上做命中检测，再对顶栏最后一个标签做一次**真实鼠标点击**
（按下 + 抬起），确认地址真的变了。

**为什么不能用 `element.click()`**：它绕过命中检测。曾经有个真 bug——顶栏最后一个标签
「免责声明」点不动，因为搜索面板关闭时只是 `opacity: 0`，里面 234×195 的一块仍然可命中、
正好压在那个标签上；用 `click()` 测了好几轮都没发现。

写这个脚本时我踩了三个坑，都已修在 `cdp.mjs` 的 `centerOf()` 里：

1. 元素在视口外时 `elementFromPoint` 一律返回 null —— 先 `scrollIntoView`；
2. 行内元素（会换行的链接）整体外接框的中心可能落在两行之间的空隙 —— 改用第一个行盒的中心；
3. 收起状态 `<details>` 里的元素照样有 `getClientRects()` —— 用 `checkVisibility()` 挡掉。

（另外要排除 Material 的标题锚点 `.headerlink`：它悬停才显形，不是给读者点的。）

### 4. 链接体检 —— 见 `scripts/site/check_links.py`

它已经接进 `npm run build`（站内链接、锚点、静态资源），不需要手动跑；
探外链时加 `--external`。

## 它们各自抓到过什么

留着这些脚本不是摆设，下面几个真问题都是它们先发现的：

- **404 页脚本地址拼成 `//javascripts/…`**（协议相对地址，浏览器会去找一台叫 javascripts 的主机）
  —— 链接体检在 4 万多个链接里挑出来的；
- **桌面端右侧「目录」栏消失两轮** —— 起因是开了 `toc.integrate`，直到做交互状态采集时
  才发现页面上根本没有这个元素；
- **搜索面板的「大家都在搜」透明、正文透出来** —— 读者截图反馈，随后用 computed style 定位到
  Material 把底色画在 `.md-search__scrollwrap` 上；
- **胶囊组件的 `line-height` 串味、ID 选择器把选中态压回去** —— 改之前先扩了状态指纹，
  第一次跑就报了 14 处差异。

## 写这类脚本的两条经验

1. **别把 DOM 异常吞成 `undefined`**。探针求值失败时要把 `exceptionDetails` 打出来，
   否则「没数据」和「没报错」分不清（我为此多查了一轮）。
2. **强制伪类/状态后要等一拍**。用 CDP 强制 `:hover` 之后要等约 300ms 让过渡跑完，
   否则会读到动画中间值（`rgba(255,255,255,0.01)` 这种），误报成差异。
