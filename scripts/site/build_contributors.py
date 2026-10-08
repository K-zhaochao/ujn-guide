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
                "contributions": int(contributions) if isinstance(contributions, (int, float)) else None,
                "source": source["label"],
            }
        )
    return people


def collect(sources=SOURCES, fetcher=fetch_json) -> list[dict[str, object]]:
    """按来源顺序抓取并合并；同一个人在两处都出现时合并提交数。"""
    merged: dict[str, dict[str, object]] = {}
    order: list[str] = []
    for source in sources:
        try:
            people = normalize(fetcher(source["api"]), source)  # type: ignore[arg-type]
        except (urllib.error.URLError, TimeoutError, ValueError, json.JSONDecodeError) as error:
            print(f"[contributors] {source['label']} 抓取失败：{error}", file=sys.stderr)
            continue
        for person in people:
            key = str(person["name"]).lower()
            if key in merged:
                if person["contributions"]:
                    existing = merged[key]["contributions"] or 0
                    merged[key]["contributions"] = int(existing) + int(person["contributions"])
                continue
            merged[key] = person
            order.append(key)
    return [merged[key] for key in order]


def person_html(person: dict[str, object]) -> str:
    name = html.escape(str(person["name"]), quote=True)
    source = html.escape(str(person["source"]), quote=True)
    contributions = person["contributions"]
    meta = f"{contributions} 次提交 · {source}" if contributions else source
    def safe_url(value: object) -> str:
        text = str(value)
        return html.escape(text, quote=True) if text.startswith("https://") else ""
    avatar = safe_url(person["avatar"])
    url = safe_url(person["url"])
    picture = (f'<img src="{avatar}" alt="" width="36" height="36" loading="lazy" decoding="async">' if avatar else f'<span class="ujn-contributor__initial">{name[:1].upper()}</span>')
    return (f'<a class="ujn-contributor" href="{url}" target="_blank" rel="noopener noreferrer">{picture}'
            f'<span class="ujn-contributor__text"><span class="ujn-contributor__name">{name}</span><span class="ujn-contributor__meta">{meta}</span></span></a>')


def render(people: list[dict[str, object]]) -> str:
    if not people:
        return "\n".join([START, '<p>感谢每一位补充校园信息的同学。<a href="https://github.com/K-zhaochao/ujn-guide">一起完善指南 →</a></p>', END])
    return "\n".join([START, '<div class="ujn-contributors" aria-label="贡献者">', *(person_html(person) for person in people), '</div>', END])


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

    people = collect()
    updated = replace_block(document, render(people))
    if updated != document:
        PAGE.write_text(updated, encoding="utf-8", newline="\n")
    names = "、".join(str(person["name"]) for person in people) or "（暂无）"
    print(f"[contributors] {len(people)} 位贡献者：{names}")


if __name__ == "__main__":
    main()
