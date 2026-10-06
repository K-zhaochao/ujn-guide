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
    name = str(person["name"])
    contributions = person["contributions"]
    meta = f"{contributions} 次提交 · {person['source']}" if contributions else str(person["source"])
    avatar = str(person["avatar"])
    picture = (
        f'<img src="{avatar}" alt="" width="44" height="44" loading="lazy" decoding="async">'
        if avatar
        else '<span class="ujn-contributor__initial">' + name[:1].upper() + "</span>"
    )
    return (
        f'  <a class="ujn-contributor" href="{person["url"]}" target="_blank" rel="noopener">'
        f"{picture}"
        f'<span class="ujn-contributor__name">{name}</span>'
        f'<span class="ujn-contributor__meta">{meta}</span></a>'
    )


def render(people: list[dict[str, object]]) -> str:
    """按来源（GitHub / Gitee）分组，输出带滑动切换的结构。

    渐进增强：**默认（没有 JS）两个面板都显示**，每块顶上有一行小标题；
    JS 生效时给 html 加 ujn-js，CSS 才把面板收起来、改用标签栏切换。
    这样「禁用 JS 就看不到一部分贡献者」的情况不会发生。
    """
    if not people:
        # 仓库还没推送、或者构建时没网：别留空白，给出去处
        body = [
            "!!! quote \"还没有提交记录\"",
            "    这两个仓库目前都还没有提交，所以还没有贡献者名单。"
            "成为第一个？改动流程见下面的第 3、4 节；也可以直接在 "
            "[GitHub](https://github.com/K-zhaochao/ujn-guide) 或 "
            "[Gitee](https://gitee.com/Draven323/ujn-guide) 提 issue。",
        ]
        return "\n".join([START, *body, END])

    groups: list[tuple[str, str, list[dict[str, object]]]] = []
    for source in SOURCES:
        members = [person for person in people if person.get("source") == source["label"]]
        if members:
            groups.append((source["key"], source["label"], members))
    # 理论上可能出现第三来源；没分到组的照旧显示，不丢人
    rest = [person for person in people if not any(person in members for _, _, members in groups)]
    if rest:
        groups.append(("other", "其他", rest))

    tabs = ["  <div class=\"ujn-contributors-tabs__bar\" role=\"tablist\" aria-label=\"贡献者来源\">"]
    for index, (key, label, members) in enumerate(groups):
        selected = "true" if index == 0 else "false"
        tabs.append(
            f'    <button class="ujn-contributors-tabs__tab" type="button" role="tab"'
            f' id="ujn-contributor-tab-{key}" aria-controls="ujn-contributor-panel-{key}"'
            f' aria-selected="{selected}" tabindex="{0 if index == 0 else -1}" data-ujn-tab="{key}">'
            f"{label} <span class=\"ujn-contributors-tabs__count\">{len(members)}</span></button>"
        )
    tabs.append("  </div>")

    panels = []
    for index, (key, label, members) in enumerate(groups):
        # 注意：**不能**在 HTML 里写 hidden —— 那样没有 JS 时第二个面板也会被藏起来，
        # 等于把一半贡献者藏了。收起面板是 JS 生效后的行为（脚本里设 hidden），
        # 没有 JS 时两个面板都照常显示。
        panels.append(
            f'  <div class="ujn-contributors-panel" id="ujn-contributor-panel-{key}"'
            f' role="tabpanel" aria-labelledby="ujn-contributor-tab-{key}" data-ujn-panel="{key}">'
        )
        panels.append(f'    <p class="ujn-contributors-panel__title">{label}</p>')
        panels.append('    <div class="ujn-contributors">')
        panels.extend(person_html(person) for person in members)
        panels.append("    </div>")
        panels.append("  </div>")

    body = [
        '<div class="ujn-contributors-tabs" data-ujn-tabs>',
        *tabs,
        *panels,
        "</div>",
    ]
    return "\n".join([START, *body, END])


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
