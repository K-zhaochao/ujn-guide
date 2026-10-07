---
# 左侧那一列只有一个「反馈与贡献」，占地方；去掉后正文更宽敞（手机端抽屉不受影响）
hide:
  - navigation
---

# 💬 反馈与贡献

## 🙌 贡献者

这份指南由下面这些同学一起维护（GitHub 与 Gitee 两个仓库的提交合并统计）：

<!-- contributors:start -->
<div class="ujn-contributors-tabs" data-ujn-tabs>
  <div class="ujn-contributors-tabs__bar" role="tablist" aria-label="贡献者来源">
    <button class="ujn-contributors-tabs__tab" type="button" role="tab" id="ujn-contributor-tab-github" aria-controls="ujn-contributor-panel-github" aria-selected="true" tabindex="0" data-ujn-tab="github">GitHub <span class="ujn-contributors-tabs__count">1</span></button>
    <button class="ujn-contributors-tabs__tab" type="button" role="tab" id="ujn-contributor-tab-gitee" aria-controls="ujn-contributor-panel-gitee" aria-selected="false" tabindex="-1" data-ujn-tab="gitee">Gitee <span class="ujn-contributors-tabs__count">1</span></button>
  </div>
  <div class="ujn-contributors-panel" id="ujn-contributor-panel-github" role="tabpanel" aria-labelledby="ujn-contributor-tab-github" data-ujn-panel="github">
    <p class="ujn-contributors-panel__title">GitHub</p>
    <div class="ujn-contributors">
  <a class="ujn-contributor" href="https://github.com/K-zhaochao" target="_blank" rel="noopener"><img src="https://avatars.githubusercontent.com/u/179425934?v=4" alt="" width="44" height="44" loading="lazy" decoding="async"><span class="ujn-contributor__name">K-zhaochao</span><span class="ujn-contributor__meta">140 次提交 · GitHub</span></a>
    </div>
  </div>
  <div class="ujn-contributors-panel" id="ujn-contributor-panel-gitee" role="tabpanel" aria-labelledby="ujn-contributor-tab-gitee" data-ujn-panel="gitee">
    <p class="ujn-contributors-panel__title">Gitee</p>
    <div class="ujn-contributors">
  <a class="ujn-contributor" href="https://gitee.com/Draven323/ujn-guide" target="_blank" rel="noopener"><span class="ujn-contributor__initial">D</span><span class="ujn-contributor__name">Draven</span><span class="ujn-contributor__meta">140 次提交 · Gitee</span></a>
    </div>
  </div>
</div>
<!-- contributors:end -->

---

这个页面写给两种人：

- **只想提个意见、报个错误、问个问题**——不用懂技术，看第 1 节就够了；
- **想直接改内容、加东西**——看第 3 节（网页直接改）或第 4 节（本地改）。

!!! tip "会开发的：改好推上去就行，不用管部署"
    改动进入 `main`（你自己推送，或维护者合并你的 Pull Request）后，仓库里的自动流程会重新构建并发布站点。
    贡献者不需要服务器权限，也不需要了解站点部署在哪里、怎么发布——这部分由维护者负责。

!!! note "🕒 想知道最近改了什么"
    见 **[最近更新](../changelog.md)**：那一页由 git 提交历史自动生成，会列出内容层面的改动
    （纯维护性的重构、测试之类不会出现）。你提的建议被采纳后，也会出现在那里。

---

## 1. 🙋 提意见 / 报问题（不懂技术也能做）

**推荐用 Gitee 提 Issue**：注册登录 Gitee 就能提交，速度和访问都更稳。

[:fontawesome-solid-comment-dots: 在 Gitee 提 Issue](https://gitee.com/Draven323/ujn-guide/issues/new){ .md-button .md-button--primary }
[:fontawesome-brands-github: 在 GitHub 提 Issue](https://github.com/K-zhaochao/ujn-guide/issues/new){ .md-button }

也可以用 QQ 群直接说（导航栏「关于 → 联系作者」）。写的时候带上这几点，问题会好处理很多：

| 要写清楚 | 例子 |
| --- | --- |
| 哪个页面 | 复制浏览器地址栏，例如 `https://ujn.matehub.top/pets/` |
| 发生了什么 | 「点击第 3 页的『小白』，弹窗里的照片顺序和第 2 页对不上」 |
| 你期望是什么 | 「应该按猫猫页面里的顺序来」 |
| 截图 | 手机截图或电脑截图都行，比文字描述省事 |

!!! tip "提之前先看一眼下面有没有人已经提过"
    重复的 issue 会让维护者漏掉真正新的问题。下面的列表实时来自 GitHub，可以直接点进去补充信息。

## 2. 🐛 已有的问题与建议

<div id="gh-issues" data-repo="K-zhaochao/ujn-guide" data-state="open">
  <div class="gh-issues__tabs" role="tablist">
    <button class="ujn-pill gh-issues__tab is-active" type="button" role="tab" aria-selected="true" data-state="open">开放中</button>
    <button class="ujn-pill gh-issues__tab" type="button" role="tab" aria-selected="false" data-state="closed">已关闭</button>
  </div>
  <p class="gh-issues__status">正在加载 GitHub 上的 issue…</p>
  <ol class="gh-issues__list"></ol>
  <p class="gh-issues__hint">
    列表通过 GitHub 公开接口读取（不需要登录，匿名限流约每小时 60 次）。
    如果显示读不到，请直接打开
    <a href="https://github.com/K-zhaochao/ujn-guide/issues" target="_blank" rel="noopener noreferrer">GitHub Issues</a>
    或
    <a href="https://gitee.com/Draven323/ujn-guide/issues" target="_blank" rel="noopener noreferrer">Gitee Issues</a>。
  </p>
</div>

<style>
/* ===== 反馈页：issue 列表（样式跟随主题，浅色/深色自动适配） ===== */
#gh-issues {
  --gh-accent: var(--md-primary-fg-color);
  --gh-hairline: var(--md-default-fg-color--lightest);
  --gh-muted: var(--md-default-fg-color--light);
  margin: 1.1rem 0 .6rem;
}

#gh-issues .gh-issues__tabs {
  display: inline-flex;
  gap: .25rem;
  padding: .18rem;
  border: 1px solid var(--gh-hairline);
  border-radius: 999px;
  background: color-mix(in srgb, var(--gh-accent) 6%, transparent);
}

/* 页签的形状、字号字重与选中态配色来自共用的 .ujn-pill（见 ujn.css），这里只留内边距 */
#gh-issues .gh-issues__tab {
  padding: .32rem .8rem;
}

#gh-issues .gh-issues__tab:hover {
  color: var(--gh-accent);
}

#gh-issues .gh-issues__status,
#gh-issues .gh-issues__hint {
  color: var(--gh-muted);
  font-size: .66rem;
  line-height: 1.6;
}

#gh-issues .gh-issues__hint {
  margin-top: .5rem;
}

#gh-issues .gh-issues__list {
  margin: .7rem 0 0;
  padding: 0;
  list-style: none;
}

#gh-issues .gh-issue {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: .35rem;
  padding: .55rem .7rem;
  margin-bottom: .4rem;
  border: 1px solid var(--gh-hairline);
  border-radius: .55rem;
  background: var(--md-default-bg-color);
  transition: border-color .15s ease, box-shadow .15s ease;
}

#gh-issues .gh-issue:hover {
  border-color: var(--gh-accent);
  box-shadow: 0 .2rem .6rem rgba(0, 0, 0, .12);
}

#gh-issues .gh-issue__title {
  color: var(--md-default-fg-color);
  font-size: .72rem;
  font-weight: 600;
  text-decoration: none;
}

#gh-issues .gh-issue__title:hover {
  color: var(--gh-accent);
  text-decoration: underline;
}

#gh-issues .gh-issue__number {
  margin-right: .3rem;
  color: var(--gh-muted);
  font-weight: 700;
}

#gh-issues .gh-issue__labels {
  display: inline-flex;
  flex-wrap: wrap;
  gap: .25rem;
}

#gh-issues .gh-issue__label {
  padding: .1rem .4rem;
  border: 1px solid color-mix(in srgb, var(--gh-accent) 40%, transparent);
  border-radius: 999px;
  color: var(--gh-accent);
  font-size: .58rem;
  font-weight: 600;
}

#gh-issues .gh-issue__meta {
  margin-left: auto;
  color: var(--gh-muted);
  font-size: .6rem;
  white-space: nowrap;
}
</style>

## 3. ✏️ 改一句话 / 换一张图（不用装环境）

GitHub 和 Gitee 的网页版都能直接编辑文件，适合改错别字、更新电话、换图片这类小改动：

1. 打开仓库并进到对应文件，例如 `docs/site-guide/main-campus/canteen-1.md`；
2. 点右上角的铅笔图标（GitHub）或「编辑」（Gitee）；
3. 改完在页面下方填写提交说明：有仓库写权限就直接提交到 `main`（或你自己的分支），没有写权限就选择「新建分支并发起 PR / Pull Request」；
4. 推送或合并进 `main` 之后，站点会自动重新构建发布，**你不需要做任何部署操作**。

!!! warning "两条底线"
    不要提交密钥、`.env`、证书；不要直接改 `site/` 目录（它是构建产物，下次构建会被覆盖）。

## 4. 🧑💻 在本地改（开发者 / 想大改内容）

```powershell
python -m pip install -r requirements.txt
npm ci
python -m mkdocs serve --dev-addr 127.0.0.1:8000   # 打开 http://127.0.0.1:8000/
```

提交前跑一遍和 CI 相同的检查（构建 + 单元测试）：

```powershell
.\verify.ps1 -Target site      # Windows
./verify.sh --target site      # Linux / macOS
```

- 新增页面：在 `docs/` 下建 Markdown，再到 `mkdocs.yml` 的 `nav:` 里登记；
- 图片放 `docs/assets/`，用相对路径引用；
- 改完提交并推送：有仓库写权限就直接推到 `main`，没有写权限就到
  [GitHub](https://github.com/K-zhaochao/ujn-guide/pulls) 或
  [Gitee](https://gitee.com/Draven323/ujn-guide/pulls) 发起 Pull Request。

改动进入 `main` 后由仓库里的自动流程构建发布，**贡献者不需要服务器访问权限，也不需要了解站点怎么部署**。目录结构、构建脚本和验证命令的说明在仓库根目录的 `BUILDING.md`。

## 5. 🐾 新增一只猫（卡牌墙专用）

猫猫卡牌墙是**构建时生成**的，你只维护「猫猫页面 + 照片」两样东西：

**第 1 步**：照片放进 `docs/assets/images/宠物收集录/猫猫图集/`，命名成「名字 + 序号」，建议 `.webp`、长边 ≤ 1600px、单张 ≤ 300KB。

**第 2 步**：新建 `docs/pets/cats/新猫.md`：

```markdown
---
tags:
  - 宠物收集录
---

:arrow_left: [返回宠物收集录](../index.md)

---

# 🐱 新猫

一句话介绍它常出没的地方和性格。

![新猫](../../assets/images/宠物收集录/猫猫图集/新猫1.webp)
![新猫](../../assets/images/宠物收集录/猫猫图集/新猫2.webp)
```

H1 标题就是卡牌上显示的名字；**页面里放几张照片，弹窗里就能左右滑几张**（顺序一致）；没有照片的页面不会生成卡牌。

**第 3 步**：生成缩略图并重新生成卡牌墙。

```powershell
python scripts/images/build_thumbs.py     # 卡牌封面用的缩略图（换图后必须重跑）
python scripts/pets/build_gallery.py      # 重写卡牌区
```

卡牌封面用缩略图、点开弹窗才加载原图，所以照片可以放心存高清（省流量的同时不牺牲点开后的清晰度）。
脚本会扫描 `docs/pets/cats/*.md`，重写 `docs/pets/index.md` 里两个 `pets:deck` 标记之间的卡牌区。展示顺序由脚本顶部的 `ORDER` 决定，**没列进去的新猫自动排在最后**，所以新增一般不用管顺序。忘了跑脚本没关系：`npm run test:build` 会报「卡牌区不是最新的」或「缩略图缺失」。

## 6. ❓ 常见问题

| 现象 | 处理 |
| --- | --- |
| 卡牌顺序不对 | 改 `scripts/pets/build_gallery.py` 顶部的 `ORDER`，再重新生成 |
| 弹窗里照片数量不对 | 检查对应猫猫页面里的图片行数与顺序 |
| 某只猫没有卡牌 | 页面里没有照片，或 front matter 写了 `navigation.exclude: true` |
| 生成脚本报「图片不存在」 | 按提示核对 `docs/assets/...` 的文件名与大小写 |
| 生成脚本报「缺少卡牌缩略图」 | 先跑 `python scripts/images/build_thumbs.py`，再跑 `build_gallery.py`，两个改动一起提交 |
| 卡牌封面还是旧照片 | 换图后重跑 `python scripts/images/build_thumbs.py`（脚本按修改时间判断是否需要重建，必要时加 `--force`） |
| 搜索不到新内容 | 搜索索引在构建时生成，重新跑 `npm run build`，不要手改 `site/` |
| CI 提示卡牌区不是最新 | 本地执行 `python scripts/pets/build_gallery.py` 后一起提交 |
| 本地改了文件页面没变 | `mkdocs serve` 的热重载在部分环境不生效，重启一次即可 |

## 7. ⚠️ 不要做的事

- 不要提交密钥、`.env`、证书或服务器相关材料（提交前用 `git status` 自查）；
- 不要直接修改 `site/`；
- 不要删除第三方资源的许可与致谢（例如 `docs/assets/zongce-calculator/` 里的 LICENSE 与原作者说明）；
- 宠物投稿相关的后端服务在独立的私有仓库，本仓库只包含静态主站，不需要也不应该在这里新增后端接口。
