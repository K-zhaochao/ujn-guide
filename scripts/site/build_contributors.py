"""抓取 GitHub / Gitee 的贡献者，写进「反馈与贡献」页顶部的标记区。

为什么在**构建时**抓、把产物提交进仓库：
- 访客端直接拉 API 会撞上未认证限流（GitHub 60 次/小时/IP），校园网 NAT 下很快耗尽，
  页面会时好时坏；
- 构建时抓一次，访客零请求；抓不到（没网、仓库还没提交过）就沿用仓库里的版本或退回占位文案。

用法::

    python scripts/site/build_contributors.py           # 重新生成
    python scripts/site/build_contributors.py --check   # 只校验标记区
"""

from __future__ import annotations

import argparse
import html
import math
from urllib.parse import urlsplit
import json
import re
import sys
import urllib.error
import urllib.request
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parents[2]
PAGE = PROJECT_ROOT / "docs" / "contribute" / "index.md"
START = "<!-- contributors:start -->"
END = "<!-- contributors:end -->"
USER_AGENT = "ujn-guide-contributors/1.0 (+https://gitee.com/Draven323/ujn-guide)"
TIMEOUT = 15

SOURCES = (
    {
        "key": "github",
        "label": "GitHub",
        "repo": "https://github.com/K-zhaochao/ujn-guide",
        "api": "https://api.github.com/repos/K-zhaochao/ujn-guide/contributors?per_page=30",
    },
    {
        "key": "gitee",
        "label": "Gitee",
        "repo": "https://gitee.com/Draven323/ujn-guide",
        "api": "https://gitee.com/api/v5/repos/Draven323/ujn-guide/contributors?per_page=30",
    },
)


def fetch_json(url: str, timeout: float = TIMEOUT) -> object:
    request = urllib.request.Request(
        url, headers={"User-Agent": USER_AGENT, "Accept": "application/vnd.github+json"}
    )
    with urllib.request.urlopen(request, timeout=timeout) as response:
        body = response.read().decode("utf-8", "replace").strip()
        # 仓库一个提交都没有时，GitHub 的 contributors 接口返回 204 No Content（空响应体）。
        # 这是正常情况，不是抓取失败——按「暂无贡献者」处理。
        if not body:
            return []
        return json.loads(body)


def normalize(items: object, source: dict[str, str]) -> list[dict[str, object]]:
    """把两家的返回整理成同一种结构；只保留能识别出名字的条目。"""
    if not isinstance(items, list):
        return []
    people: list[dict[str, object]] = []
    for item in items:
        if not isinstance(item, dict):
            continue
        name = str(item.get("login") or item.get("name") or "").strip()
        if not name:
            continue
        contributions = item.get("contributions")
        if contributions is None:
            contributions = item.get("contributions_count")
        people.append(
            {
                "name": name,
                "avatar": str(item.get("avatar_url") or "").strip(),
                "url": str(item.get("html_url") or item.get("url") or source["repo"]).strip(),
                "contributions": int(contributions) if isinstance(contributions, (int, float)) and math.isfinite(contributions) and contributions >= 0 else None,
                "source": source["label"],
            }
        )
    return people


def collect(sources=SOURCES, fetcher=fetch_json, fallback=()) -> list[dict[str, object]]:
    """Keep platform attribution; preserve the cached platform on temporary API failures."""
    people: list[dict[str, object]] = []
    seen = set()
    for source in sources:
        try:
            items = normalize(fetcher(source["api"]), source)
        except (urllib.error.URLError, TimeoutError, ValueError, json.JSONDecodeError) as error:
            print(f"[contributors] {source['label']} 抓取失败：{error}", file=sys.stderr)
            items = [person for person in fallback if person.get("source") == source["label"]]
        for person in items:
            key = (source["key"], str(person["name"]).lower())
            if key not in seen:
                seen.add(key)
                people.append(person)
    return people


def person_html(person: dict[str, object]) -> str:
    name = html.escape(str(person["name"]), quote=True)
    source = html.escape(str(person["source"]), quote=True)
    contributions = person["contributions"]
    meta = f"{contributions} 次提交" if contributions is not None else "一起完善指南"
    def safe_url(value: object) -> str:
        text = str(value)
        try:
            parsed = urlsplit(text)
            valid = parsed.scheme == "https" and bool(parsed.hostname) and not parsed.username and not parsed.password
        except ValueError:
            valid = False
        return html.escape(text, quote=True) if valid else ""
    avatar = safe_url(person["avatar"])
    url = safe_url(person["url"]) or "https://github.com/K-zhaochao/ujn-guide"
    initial = html.escape(str(person["name"])[:1].upper(), quote=True)
    picture = (f'<img class="off-glb" src="{avatar}" alt="" width="44" height="44" loading="lazy" decoding="async">' if avatar else f'<span class="ujn-contributor__initial">{initial}</span>')
    return (f'<a class="ujn-contributor" href="{url}" target="_blank" rel="noopener noreferrer">'
            f'<span class="ujn-contributor__portrait">{picture}</span>'
            f'<span class="ujn-contributor__text"><span class="ujn-contributor__name">{name}</span><span class="ujn-contributor__meta">{meta}</span></span>'
            f'<span class="ujn-contributor__badge">{source}</span></a>')


def render(people: list[dict[str, object]]) -> str:
    lines = [START, '<div class="ujn-contributors" data-contributors aria-label="贡献者">',
             '<div class="ujn-contributors__header"><span class="ujn-contributors__eyebrow">一起点亮校园指南</span>',
             '<div class="ujn-contributors__switch" role="tablist" aria-label="贡献者平台" hidden><span class="ujn-contributors__slider" aria-hidden="true"></span>']
    for index, source in enumerate(SOURCES):
        count = sum(person["source"] == source["label"] for person in people)
        lines.append(f'<button type="button" role="tab" id="contributors-tab-{source["key"]}" aria-controls="contributors-panel-{source["key"]}" aria-selected="{str(index == 0).lower()}" tabindex="{0 if index == 0 else -1}" data-platform="{source["key"]}">{source["label"]}<span class="ujn-contributors__count">{count}</span></button>')
    lines.append('</div></div>')
    for source in SOURCES:
        members = [person for person in people if person["source"] == source["label"]]
        lines.append(f'<section class="ujn-contributors__panel" id="contributors-panel-{source["key"]}" role="tabpanel" aria-labelledby="contributors-tab-{source["key"]}" data-platform="{source["key"]}" tabindex="0">')
        lines.append(f'<p class="ujn-contributors__caption">{source["label"]} · {len(members)} 位贡献者</p><div class="ujn-contributors__cards">')
        lines.extend(person_html(person) for person in members)
        if not members:
            lines.append(f'<p class="ujn-contributors__empty">感谢每一位补充校园信息的同学。<a href="{source["repo"]}" target="_blank" rel="noopener noreferrer">一起完善指南 →</a></p>')
        lines.append('</div></section>')
    # Inert JSON cache survives transient source failures. Escape '<' to prevent closing the script element.
    cache = json.dumps(people, ensure_ascii=False).replace("<", "\\u003c").replace(">", "\\u003e").replace("&", "\\u0026")
    lines.extend([f'<script type="application/json" data-contributors-cache>{cache}</script>', '</div>', END])
    return "\n".join(lines)


def cached_people(document: str) -> list[dict[str, object]]:
    match = re.search(r'<script type="application/json" data-contributors-cache>(.*?)</script>', document, re.S)
    try:
        items = json.loads(match[1]) if match else []
        return [item for item in items if isinstance(item, dict) and all(key in item for key in ("name", "avatar", "url", "contributions", "source"))] if isinstance(items, list) else []
    except (ValueError, TypeError):
        return []


def replace_block(document: str, block: str) -> str:
    start = document.find(START)
    end = document.find(END)
    if start < 0 or end < 0 or end < start:
        raise SystemExit(f"{PAGE.relative_to(PROJECT_ROOT)} 里找不到 {START} / {END} 标记")
    return document[:start] + block + document[end + len(END):]


def main() -> None:
    parser = argparse.ArgumentParser(description="生成贡献者名单")
    parser.add_argument("--check", action="store_true", help="只校验标记区存在")
    args = parser.parse_args()

    document = PAGE.read_text(encoding="utf-8")
    if args.check:
        if START not in document or END not in document:
            raise SystemExit(f"{PAGE.relative_to(PROJECT_ROOT)} 缺少贡献者标记区")
        print("[contributors] 标记区正常")
        return

    people = collect(fallback=cached_people(document))
    updated = replace_block(document, render(people))
    if updated != document:
        PAGE.write_text(updated, encoding="utf-8", newline="\n")
    names = "、".join(str(person["name"]) for person in people) or "（暂无）"
    print(f"[contributors] {len(people)} 位贡献者：{names}")


if __name__ == "__main__":
    main()
