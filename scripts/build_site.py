"""Run the reproducible strict MkDocs build and verify its output."""

from __future__ import annotations

import os
import subprocess
import sys
from pathlib import Path

from verify_site_build import SiteBuildVerificationError, verify_site


PROJECT_ROOT = Path(__file__).resolve().parent.parent


def build_environment() -> dict[str, str]:
    environment = os.environ.copy()
    environment.setdefault("NO_MKDOCS_2_WARNING", "true")
    warning_filter = "ignore:pkg_resources is deprecated as an API:UserWarning"
    current_filters = environment.get("PYTHONWARNINGS", "")
    environment["PYTHONWARNINGS"] = ",".join(filter(None, (warning_filter, current_filters)))
    return environment


def refresh_changelog(project_root: Path = PROJECT_ROOT) -> None:
    """构建前重生成「最近更新」页。

    这一页是提交进仓库的（这样直接 mkdocs build 也不会缺页），
    但内容随 git 历史变化，所以每次构建都刷一遍；拿不到 git 就沿用仓库里的版本。
    """
    result = subprocess.run(
        [sys.executable, str(project_root / "scripts" / "site" / "build_changelog.py")],
        cwd=project_root,
        check=False,
    )
    if result.returncode != 0:
        print("[build-site] 更新日志生成失败，沿用仓库里的版本", file=sys.stderr)


def run_build(project_root: Path = PROJECT_ROOT) -> int:
    result = subprocess.run(
        [sys.executable, "-m", "mkdocs", "build", "--strict", "--clean"],
        cwd=project_root,
        env=build_environment(),
        check=False,
    )
    return result.returncode


def check_links(project_root: Path = PROJECT_ROOT) -> bool:
    """构建后做一次站内链接体检（链接、锚点、静态资源）。

    `mkdocs --strict` 只管 Markdown 源文件之间的链接，管不到 HTML 注入的链接与锚点。
    这里用子进程调用而不是 import：scripts/site 这个包名会和标准库的 site 撞车。
    """
    result = subprocess.run(
        [sys.executable, str(project_root / "scripts" / "site" / "check_links.py")],
        cwd=project_root,
        check=False,
    )
    return result.returncode == 0


def main() -> None:
    refresh_changelog()
    if run_build() != 0:
        raise SystemExit(1)
    try:
        file_count = verify_site()
    except SiteBuildVerificationError as error:
        print(f"[build-site] {error}", file=sys.stderr)
        raise SystemExit(1) from error
    print(f"[build-site] 严格构建通过，Pagefind 已生成 {file_count} 个文件", flush=True)
    if not check_links():
        print("[build-site] 站内链接体检未通过（见上面的报告）", file=sys.stderr)
        raise SystemExit(1)
    print("[build-site] 站内链接、锚点、静态资源全部正常")


if __name__ == "__main__":
    main()
