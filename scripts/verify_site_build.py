"""Verify the static site assets produced by the strict MkDocs build."""

from __future__ import annotations

import sys
from html.parser import HTMLParser
from pathlib import Path


PROJECT_ROOT = Path(__file__).resolve().parent.parent
SITE_DIR = PROJECT_ROOT / "site"
ZONGCE_PAGE = Path("green-book/scholarship/zongce-calculator/index.html")
ZONGCE_REPOSITORY = "https://github.com/WHHWWHHWWHHWWHHW/zongce-calculator"
REQUIRED_FILES = (
    SITE_DIR / "index.html",
    SITE_DIR / "pets" / "index.html",
    SITE_DIR / "pagefind" / "pagefind.js",
    SITE_DIR / ZONGCE_PAGE,
    *(SITE_DIR / "assets" / "zongce-calculator" / name for name in (
        "calculator-core.js", "calculator.js", "calculator.css",
        "LICENSE.txt", "NOTICE.txt", "author-support.jpg",
    )),
)


class SiteBuildVerificationError(RuntimeError):
    """Raised when a required static-site artifact is missing or malformed."""


class CalculatorPageParser(HTMLParser):
    """Inspect elements, not escaped HTML accidentally rendered as code blocks."""

    def __init__(self) -> None:
        super().__init__()
        self.control_ids: set[str] = set()
        self.has_repository_button = False

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        attributes = dict(attrs)
        if tag in {"input", "textarea"} and attributes.get("id"):
            self.control_ids.add(attributes["id"])
        if tag == "a" and attributes.get("href") == ZONGCE_REPOSITORY:
            if "zc-repo-button" in (attributes.get("class") or "").split():
                self.has_repository_button = True


def verify_site(site_dir: Path = SITE_DIR) -> int:
    for file_path in REQUIRED_FILES:
        relative_path = file_path.relative_to(SITE_DIR)
        candidate = site_dir / relative_path
        if not candidate.is_file() or candidate.stat().st_size == 0:
            raise SiteBuildVerificationError(f"缺少或为空的构建产物：site/{relative_path.as_posix()}")

    pets_page = (site_dir / "pets" / "index.html").read_text(encoding="utf-8")
    if "宠物收集录" not in pets_page:
        raise SiteBuildVerificationError("已知页面 pets/index.html 未包含预期标题")

    calculator = CalculatorPageParser()
    calculator.feed((site_dir / ZONGCE_PAGE).read_text(encoding="utf-8"))
    if not {"zc-gpa", "zc-quality", "zc-import-text"}.issubset(calculator.control_ids):
        raise SiteBuildVerificationError("综测计算器缺少实际表单控件，请检查 Markdown 是否将 HTML 转成了代码块")
    if not calculator.has_repository_button:
        raise SiteBuildVerificationError("综测计算器缺少原作者开源仓库按钮")

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
    print(f"[verify-site] 通过：{file_count} 个 Pagefind 文件，已验证宠物页与综测计算器")


if __name__ == "__main__":
    main()
