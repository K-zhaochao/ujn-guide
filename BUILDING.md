# 构建与验证

本仓库的静态站构建需要 Python 3.13+、Node.js 22.16.0 和 npm。Node 版本由 `.nvmrc` 固定，Python 依赖由 `requirements.txt` 精确锁定，Pagefind 由根目录 `package-lock.json` 锁定。

```powershell
python -m pip install -r requirements.txt
npm ci
npm run test:build
npm run build
```

`npm run build` 会执行 `mkdocs build --strict --clean`，由 `hooks/pagefind.py` 使用本地 `pagefind` 生成搜索索引，再验证 `site/pagefind/pagefind.js`、索引文件和已知的 `pets/index.html` 页面。部署脚本 `deploy/deploy.ps1 build` 调用同一入口，不会重复生成索引。

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
