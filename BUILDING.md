# 构建与验证

本仓库的静态站构建需要 Python 3.13+、Node.js 22.16.0 和 npm。Node 版本由 `.nvmrc` 固定，Python 依赖由 `requirements.txt` 精确锁定，Pagefind 由根目录 `package-lock.json` 锁定。

```powershell
python -m pip install -r requirements.txt
npm ci
npm run test:build
npm run build
```

`npm run build` 会执行 `mkdocs build --strict --clean`，由 `hooks/pagefind.py` 使用本地 `pagefind` 生成搜索索引，再验证 `site/pagefind/pagefind.js`、索引文件和已知的 `pets/index.html` 页面。部署脚本 `deploy/deploy.ps1 build` 调用同一入口，不会重复生成索引。

后端位于独立的 `server/` 仓库，Node.js 同样固定为 22.16.0；其测试与迁移命令见 `server/README.md`。
