"""Verify the static site assets produced by the strict MkDocs build."""

from __future__ import annotations

import sys
from pathlib import Path


PROJECT_ROOT = Path(__file__).resolve().parent.parent
SITE_DIR = PROJECT_ROOT / "site"
REQUIRED_FILES = (
    SITE_DIR / "index.html",
    SITE_DIR / "pets" / "index.html",
    SITE_DIR / "pagefind" / "pagefind.js",
)


class SiteBuildVerificationError(RuntimeError):
    """Raised when a required static-site artifact is missing or malformed."""


def verify_site(site_dir: Path = SITE_DIR) -> int:
    for file_path in REQUIRED_FILES:
        relative_path = file_path.relative_to(SITE_DIR)
        candidate = site_dir / relative_path
        if not candidate.is_file() or candidate.stat().st_size == 0:
            raise SiteBuildVerificationError(f"缺少或为空的构建产物：site/{relative_path.as_posix()}")

    pets_page = (site_dir / "pets" / "index.html").read_text(encoding="utf-8")
    if "宠物收集录" not in pets_page:
        raise SiteBuildVerificationError("已知页面 pets/index.html 未包含预期标题")

    pagefind_files = [file_path for file_path in (site_dir / "pagefind").rglob("*") if file_path.is_file()]
    if len(pagefind_files) < 2:
        raise SiteBuildVerificationError("Pagefind 索引产物不完整")

    return len(pagefind_files)


def main() -> None:
    try:
        file_count = verify_site()
    except SiteBuildVerificationError as error:
        print(f"[verify-site] {error}", file=sys.stderr)
        raise SystemExit(1) from error
    print(f"[verify-site] 通过：{file_count} 个 Pagefind 文件，已验证 pets/index.html")


if __name__ == "__main__":
    main()
