"""
MkDocs 构建钩子 — 构建完成后自动运行 Pagefind 搜索引擎索引

将此文件放入 hooks/ 目录，在 mkdocs.yml 中添加：
    hooks:
        - hooks/pagefind.py

这样只需一条 mkdocs build 即可完成站点构建 + Pagefind 索引。
"""

import subprocess
import sys
from pathlib import Path


def safe_print(text: str) -> None:
    """安全打印，避免 Windows GBK 终端无法处理 Unicode emoji。"""
    try:
        print(text)
    except UnicodeEncodeError:
        safe = text.encode("ascii", errors="replace").decode("ascii")
        print(safe)


def on_post_build(config, **kwargs):
    site_dir = Path(config["site_dir"])

    if not site_dir.exists():
        safe_print(f"[hooks] !! 找不到 {site_dir}，跳过 Pagefind 索引")
        return

    safe_print("[hooks] >> 运行 Pagefind 搜索引擎索引...")

    result = subprocess.run(
        ["npx", "pagefind", "--site", str(site_dir)],
        capture_output=True,
        text=True,
        encoding="utf-8",
        errors="replace",
        cwd=site_dir.parent,
        shell=True,
    )

    if result.stdout:
        for line in result.stdout.splitlines():
            safe_print(line)
    if result.stderr:
        for line in result.stderr.splitlines():
            if "Unicode" not in line and "gbk" not in line.lower():
                safe_print(line)

    if result.returncode != 0:
        safe_print(f"[hooks] !! Pagefind 索引失败 (exit code: {result.returncode})")
        raise SystemExit(1)

    pagefind_dir = site_dir / "pagefind"
    if pagefind_dir.exists():
        total_size = sum(f.stat().st_size for f in pagefind_dir.rglob("*") if f.is_file())
        file_count = len(list(pagefind_dir.rglob("*")))
        safe_print(f"[hooks] ++ Pagefind 索引完成！({file_count} 文件, {total_size / 1024:.1f} KB)")
    else:
        safe_print(f"[hooks] ?? Pagefind 运行完毕，但未找到 {pagefind_dir}")
