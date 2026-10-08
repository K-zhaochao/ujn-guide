---
# 左侧那一列只有一个「反馈与贡献」，占地方；去掉后正文更宽敞（手机端抽屉不受影响）
hide:
  - navigation
---

# 💬 反馈与贡献

## 🙌 贡献者

感谢一起补充、纠错和维护校园指南的同学。

<!-- contributors:start -->
<div class="ujn-contributors" data-contributors aria-label="贡献者">
<div class="ujn-contributors__header"><span class="ujn-contributors__eyebrow">一起点亮校园指南</span>
<div class="ujn-contributors__switch" role="tablist" aria-label="贡献者平台" hidden><span class="ujn-contributors__slider" aria-hidden="true"></span>
<button type="button" role="tab" id="contributors-tab-github" aria-controls="contributors-panel-github" aria-selected="true" tabindex="0" data-platform="github">GitHub<span class="ujn-contributors__count">1</span></button>
<button type="button" role="tab" id="contributors-tab-gitee" aria-controls="contributors-panel-gitee" aria-selected="false" tabindex="-1" data-platform="gitee">Gitee<span class="ujn-contributors__count">1</span></button>
</div></div>
<section class="ujn-contributors__panel" id="contributors-panel-github" role="tabpanel" aria-labelledby="contributors-tab-github" data-platform="github" tabindex="0">
<p class="ujn-contributors__caption">GitHub · 1 位贡献者</p><div class="ujn-contributors__cards">
<a class="ujn-contributor" href="https://github.com/K-zhaochao" target="_blank" rel="noopener noreferrer"><span class="ujn-contributor__portrait"><img class="off-glb" src="https://avatars.githubusercontent.com/u/179425934?v=4" alt="" width="44" height="44" loading="lazy" decoding="async"></span><span class="ujn-contributor__text"><span class="ujn-contributor__name">K-zhaochao</span><span class="ujn-contributor__meta">142 次提交</span></span><span class="ujn-contributor__badge">GitHub</span></a>
</div></section>
<section class="ujn-contributors__panel" id="contributors-panel-gitee" role="tabpanel" aria-labelledby="contributors-tab-gitee" data-platform="gitee" tabindex="0">
<p class="ujn-contributors__caption">Gitee · 1 位贡献者</p><div class="ujn-contributors__cards">
<a class="ujn-contributor" href="https://gitee.com/Draven323/ujn-guide" target="_blank" rel="noopener noreferrer"><span class="ujn-contributor__portrait"><span class="ujn-contributor__initial">D</span></span><span class="ujn-contributor__text"><span class="ujn-contributor__name">Draven</span><span class="ujn-contributor__meta">141 次提交</span></span><span class="ujn-contributor__badge">Gitee</span></a>
</div></section>
<script type="application/json" data-contributors-cache>[{"name": "K-zhaochao", "avatar": "https://avatars.githubusercontent.com/u/179425934?v=4", "url": "https://github.com/K-zhaochao", "contributions": 142, "source": "GitHub"}, {"name": "Draven", "avatar": "", "url": "https://gitee.com/Draven323/ujn-guide", "contributions": 141, "source": "Gitee"}]</script>
</div>
<!-- contributors:end -->

## 💬 同学留言

发现信息有误，或想让本站增加什么？写下来，也可以展开已有留言看看大家的回复。

<div id="gh-issues" data-repo="K-zhaochao/ujn-guide" data-state="open">
  <form class="gh-composer" action="https://github.com/K-zhaochao/ujn-guide/issues/new" method="get" target="_blank" rel="noopener noreferrer">
    <label for="gh-message-title">标题<input id="gh-message-title" name="title" required maxlength="100" placeholder="一句话说明问题或建议"></label>
    <label for="gh-message-body">留言<textarea id="gh-message-body" name="body" required maxlength="1200" rows="3" placeholder="相关页面、具体情况和建议…请勿填写密码等个人信息"></textarea></label>
    <div class="gh-composer__actions"><button class="md-button md-button--primary" type="submit">去 GitHub 发布留言</button><a href="https://gitee.com/Draven323/ujn-guide/issues/new" target="_blank" rel="noopener noreferrer">也可在 Gitee 反馈</a></div>
    <p class="gh-composer__hint">在 GitHub 登录并确认发布后，留言会同步到这里。</p>
  </form>
  <div class="gh-issues__tabs" role="tablist" aria-label="留言状态">
    <button class="gh-issues__tab is-active" type="button" role="tab" aria-selected="true" data-state="open">讨论中</button>
    <button class="gh-issues__tab" type="button" role="tab" aria-selected="false" data-state="closed">已处理</button>
  </div>
  <p class="gh-issues__status" role="status" aria-live="polite">正在加载留言…</p>
  <ol class="gh-issues__list"></ol>
  <nav class="ujn-pagination gh-issues__pagination" aria-label="留言分页" hidden></nav>
  <p class="gh-issues__hint"><a href="https://github.com/K-zhaochao/ujn-guide/issues" target="_blank" rel="noopener noreferrer">查看全部留言 ↗</a></p>
</div>

<details class="ujn-maintain" markdown="1">
<summary>想直接补充校园内容？查看参与维护的方法</summary>

<span id="3"></span>

## ✏️ 在线修改内容

GitHub 和 Gitee 的网页版都能直接编辑文件，适合改错别字、更新电话、换图片这类小改动：

1. 打开仓库并进到对应文件，例如 `docs/site-guide/main-campus/canteen-1.md`；
2. 点右上角的铅笔图标（GitHub）或「编辑」（Gitee）；
3. 改完在页面下方填写提交说明：有仓库写权限就直接提交到 `main`（或你自己的分支），没有写权限就选择「新建分支并发起 PR / Pull Request」；
4. 改动合并进 GitHub 的 `main` 后，站点会自动构建发布；Gitee 的改动由维护者同步到 GitHub 后发布。

!!! warning "两条底线"
    不要提交密钥、`.env`、证书；不要直接改 `site/` 目录（它是构建产物，下次构建会被覆盖）。

<span id="4"></span>

## 🧑💻 在本地改（开发者 / 想大改内容）

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

改动进入 GitHub 的 `main` 后由仓库里的自动流程构建发布，**贡献者不需要服务器访问权限，也不需要了解站点怎么部署**。目录结构、构建脚本和验证命令的说明在仓库根目录的 `BUILDING.md`。

<span id="5"></span>

## 🐾 新增一只猫（卡牌墙专用）

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

<span id="6"></span>

## ❓ 常见问题

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

<span id="7"></span>

## ⚠️ 不要做的事

- 不要提交密钥、`.env`、证书或服务器相关材料（提交前用 `git status` 自查）；
- 不要直接修改 `site/`；
- 不要删除第三方资源的许可与致谢（例如 `docs/assets/zongce-calculator/` 里的 LICENSE 与原作者说明）；
- 宠物投稿相关的后端服务在独立的私有仓库，本仓库只包含静态主站，不需要也不应该在这里新增后端接口。

</details>
