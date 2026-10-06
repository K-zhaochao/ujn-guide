"""站点链接体检：把构建产物里的链接逐个走一遍。

`mkdocs build --strict` 只校验 Markdown 源文件之间的链接，管不到这些：
- 页面里 HTML 注入的链接（导航、页脚、卡片、脚本生成的列表）；
- 锚点（`page/#section` 是否真的存在对应 id）；
- 图片、PDF 等静态资源是否存在。

用法::

    python scripts/site/check_links.py                  # 只查站内（默认，可进 CI）
    python scripts/site/check_links.py --external       # 额外探测外链（需要网络，慢）
    python scripts/site/check_links.py --limit 20       # 每类问题最多打印多少条

外链单独统计、默认不影响退出码：很多站点（QQ、政务网站）会拦爬虫，
把它们算成错误只会让检查失去意义。
"""

from __future__ import annotations

import argparse
import os
import re
import sys
import urllib.error
import urllib.request
from collections import defaultdict
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import unquote, urldefrag, urljoin, urlparse

PROJECT_ROOT = Path(__file__).resolve().parents[2]
SITE = PROJECT_ROOT / "site"
SKIP_SCHEMES = ("mailto:", "tel:", "sms:", "data:", "javascript:", "blob:")


class LinkCollector(HTMLParser):
    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.links: list[tuple[str, str]] = []  # (标签, href/src)
        self.ids: set[str] = set()

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        values = dict(attrs)
        if values.get("id"):
            self.ids.add(values["id"] or "")
        if values.get("name"):
            self.ids.add(values["name"] or "")
        for attribute in ("href", "src"):
            value = values.get(attribute)
            if value:
                self.links.append((tag, value))


def page_url(path: Path, site: Path = SITE) -> str:
    """把 site/foo/index.html 还原成站点路径 /foo/。"""
    relative = path.relative_to(site).as_posix()
    if relative.endswith("index.html"):
        relative = relative[: -len("index.html")]
    return "/" + relative


def deployment_prefix() -> str:
    """站点部署的子路径前缀（例如 /ujn-guide），根路径部署时返回空串。

    GitHub Pages 的项目站点把站点放在 /<仓库名>/ 下，site_url 里就带着这个前缀，
    于是 404.html 等页面里的站内链接全是 /ujn-guide/xxx。检查产物时必须先去掉它，
    否则每一条都会被判成「指向不存在的文件」——CI 上 148 处误报就是这么来的
    （本地开发是根路径部署，所以永远看不到这个错）。
    """
    config = SITE.parent / "mkdocs.yml"
    value = ""
    # 环境变量优先：CI 就是用 SITE_URL 覆盖 mkdocs.yml 里的 site_url 的，
    # 只读文件会读到空前缀（我第一版就是这么写的，本地子路径复现仍然 148 处报错）。
    env_value = os.environ.get("SITE_URL", "").strip()
    if env_value:
        value = env_value
    else:
        try:
            text = config.read_text(encoding="utf-8")
        except OSError:
            return ""
        match = re.search(r"^\s*site_url:\s*(.+)$", text, re.M)
        if not match:
            return ""
        value = match.group(1).strip().strip("\"'")
    path = urlparse(value).path.rstrip("/")
    return "" if path in ("", "/") else path


def resolve(target: str, base: str, site: Path = SITE) -> Path | None:
    """把链接解析到产物里的文件；返回 None 表示不需要检查（外链等）。"""
    absolute = urljoin(base, target)
    parsed = urlparse(absolute)
    if parsed.scheme in ("http", "https"):
        return None
    path = unquote(parsed.path)
    prefix = deployment_prefix()
    if prefix and (path == prefix or path.startswith(prefix + "/")):
        path = path[len(prefix):] or "/"
    candidate = site / path.lstrip("/")
    if parsed.path.endswith("/") or candidate.is_dir():
        candidate = candidate / "index.html"
    return candidate


def check_internal(pages: dict[str, LinkCollector], site: Path = SITE) -> dict[str, list[str]]:
    problems: dict[str, list[str]] = defaultdict(list)
    for url, collector in pages.items():
        for tag, raw in collector.links:
            target = raw.strip()
            if not target or target.startswith(SKIP_SCHEMES):
                if target.startswith("javascript:"):
                    problems["javascript: 伪链接"].append(f"{url} -> {target}")
                continue
            parsed = urlparse(urljoin(url, target))
            if parsed.scheme in ("http", "https"):
                continue
            path, fragment = urldefrag(target)
            if path:
                resolved = resolve(target, url, site)
                if resolved is not None and not resolved.is_file():
                    problems["站内链接指向不存在的文件"].append(f"{url} -> {target}")
                    continue
            if fragment:
                # 锚点：目标页面里必须有同名 id/name
                if path:
                    resolved = resolve(target, url, site)
                    if resolved is None or not resolved.is_file():
                        continue  # 文件缺失上面已经报过，不再重复
                    target_url = page_url(resolved, site)
                else:
                    target_url = url
                other = pages.get(target_url)
                if other is None:
                    problems["锚点指向的页面不在扫描范围"].append(f"{url} -> {target}")
                elif fragment not in other.ids:
                    problems["锚点不存在"].append(f"{url} -> {target}")
    return problems


def collect_pages(site: Path = SITE) -> tuple[dict[str, LinkCollector], set[str], int]:
    """读一遍产物，返回（页面 -> 链接/锚点, 外链集合, 链接总数）。"""
    pages: dict[str, LinkCollector] = {}
    externals: set[str] = set()
    total_links = 0
    for path in sorted(site.rglob("*.html")):
        collector = LinkCollector()
        collector.feed(path.read_text(encoding="utf-8", errors="ignore"))
        pages[page_url(path, site)] = collector
        total_links += len(collector.links)
        for _, raw in collector.links:
            if raw.startswith(("http://", "https://")):
                externals.add(raw)
    return pages, externals, total_links


def audit(site: Path = SITE) -> tuple[int, int, dict[str, list[str]]]:
    """站内体检：返回（页面数, 链接数, 问题）。"""
    pages, _, total_links = collect_pages(site)
    return len(pages), total_links, check_internal(pages, site)


def check_external(links: set[str], timeout: float = 8.0) -> dict[str, list[str]]:
    problems: dict[str, list[str]] = defaultdict(list)
    for link in sorted(links):
        request = urllib.request.Request(link, method="HEAD", headers={"User-Agent": "ujn-guide-link-check/1.0"})
        try:
            with urllib.request.urlopen(request, timeout=timeout) as response:
                if response.status >= 400:
                    problems[f"外链返回 {response.status}"].append(link)
        except urllib.error.HTTPError as error:
            problems[f"外链返回 {error.code}"].append(link)
        except Exception as error:  # 超时、DNS、证书……统一记为「探测失败」
            problems[f"外链探测失败（{type(error).__name__}）"].append(link)
    return problems


def main() -> None:
    parser = argparse.ArgumentParser(description="站点链接体检")
    parser.add_argument("--site", type=Path, default=SITE, help="构建产物目录（默认 site/）")
    parser.add_argument("--external", action="store_true", help="额外探测外链（需要网络）")
    parser.add_argument("--limit", type=int, default=12, help="每类问题最多打印多少条")
    args = parser.parse_args()

    if not args.site.is_dir():
        print("[link-check] 先构建站点：npm run build", file=sys.stderr)
        raise SystemExit(1)

    pages, externals, total_links = collect_pages(args.site)
    print(f"[link-check] 扫描 {len(pages)} 个页面、{total_links} 个链接（外链 {len(externals)} 个）")
    problems = check_internal(pages, args.site)

    if args.external:
        problems.update(check_external(externals))

    if not problems:
        print("[link-check] 站内链接、锚点、静态资源全部正常")
        return

    for kind, items in sorted(problems.items(), key=lambda item: -len(item[1])):
        print(f"\n== {kind}：{len(items)} 处 ==")
        for item in items[: args.limit]:
            print(f"  - {item}")
        if len(items) > args.limit:
            print(f"  …… 另有 {len(items) - args.limit} 处")

    # 只有站内问题才影响退出码；外链探测失败是常态
    internal_failure = any(not kind.startswith("外链") for kind in problems)
    raise SystemExit(1 if internal_failure else 0)


if __name__ == "__main__":
    main()
