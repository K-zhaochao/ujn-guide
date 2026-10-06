"""从 git 提交历史生成「最近更新」页（docs/changelog.md）。

给读者看的：这份校园指南最近有哪些内容与功能上的变化。做法与卡牌墙一致——写进标记区，可重复运行。

用法::

    python scripts/site/build_changelog.py            # 重新生成
    python scripts/site/build_changelog.py --check    # 只校验标记区是否存在

筛选规则
- 只看改动过 docs/ 下 .md 的提交；
- **过滤纯维护性提交**（重构/测试/构建/部署/性能/文档/验证/无障碍等前缀，以及 Merge），
  读者不需要知道我们把 <style> 搬到了哪个文件；**回退会列出**，因为「某个功能下线了」
  正是读者该知道的事；
- 其余提交按日期倒序展示，最多 MAX_ENTRIES 条；页面名取自 mkdocs.yml 的导航标题
  （所以「涉及 电话大全、社团与组织」比一串文件路径好读）。

提交信息直接显示在这一页上，所以写提交信息时请当成人话写
（「新增舜耕校区食堂攻略」比「update docs」有用得多）。
"""

from __future__ import annotations

import argparse
import re
import subprocess
import sys
from pathlib import Path

import yaml

PROJECT_ROOT = Path(__file__).resolve().parents[2]
PAGE = PROJECT_ROOT / "docs" / "changelog.md"
CONFIG = PROJECT_ROOT / "mkdocs.yml"
START = "<!-- changelog:start -->"
END = "<!-- changelog:end -->"
MAX_ENTRIES = 30
MAX_LINKS = 3
MAX_SUBJECT = 80

# 这些前缀的提交属于站点维护，读者不关心（「回退」不在此列：功能下线读者需要知道）
INTERNAL_PREFIXES = (
    "重构", "测试", "构建", "部署", "性能", "文档", "验证", "无障碍", "发布",
    "chore", "refactor", "test", "tests", "build", "ci", "docs", "perf",
    # 约定式提交（feat(pets): …）是写给开发者的，读者看不懂括号里的模块名
    "feat(", "fix(", "style(", "perf(", "revert(",
)

# 分类前缀 -> 给读者看的标记（保留「这是什么类型的改动」这个信息）
TAGS = {
    "功能": "✨", "新增": "✨", "内容": "📝", "添加": "📝", "更新": "📝",
    "修复": "🛠️", "界面": "🎨", "优化": "🎨", "回退": "↩️", "信息架构": "🧭",
}

# 提交信息里对读者没意义的片段（重构过程、内部编号、技术特性名），展示前清掉
CLEANUPS = (
    (re.compile(r"（(?:[^（）]*(?:纯静态资源|构建校验|回归测试|指纹|脚本|接口)[^（）]*)）"), ""),
    (re.compile(r"（第\s*\d+\s*轮[^）]*）"), ""),
    (re.compile(r"[，,；;]?\s*(?:第\s*\d+\s*轮|本轮)[^，。；]*"), ""),
    (re.compile(r"\s*[（(]\s*[)）]"), ""),
)

RECORD = "\x1e"
FIELD = "\x1f"


def parse_log(raw: str) -> list[dict[str, object]]:
    """把 ``git log --pretty=format:%x1e%ad%x1f%s --name-only`` 的输出解析成提交列表。"""
    entries: list[dict[str, object]] = []
    for chunk in raw.split(RECORD):
        chunk = chunk.strip("\n")
        if not chunk:
            continue
        lines = chunk.split("\n")
        head = lines[0].split(FIELD)
        if len(head) != 2:
            continue
        date, subject = head[0].strip(), head[1].strip()
        pages = [line.strip() for line in lines[1:] if line.strip().endswith(".md")]
        entries.append({"date": date, "subject": subject, "pages": pages})
    return entries


def is_reader_relevant(entry: dict[str, object]) -> bool:
    subject = str(entry["subject"])
    if subject.startswith("Merge "):
        return False
    lowered = subject.lower()
    return not any(lowered.startswith(prefix) for prefix in INTERNAL_PREFIXES)


class _Loader(yaml.SafeLoader):
    """mkdocs.yml 里有 !ENV 之类的自定义标签，SafeLoader 默认会报错，这里统一忽略。"""


_Loader.add_multi_constructor("!", lambda loader, suffix, node: None)
_Loader.add_multi_constructor("tag:yaml.org,2002:python/name:", lambda loader, suffix, node: None)


def nav_titles(project_root: Path = PROJECT_ROOT) -> dict[str, str]:
    """从 mkdocs.yml 的 nav 里取出「文件路径 -> 标题」，让更新记录里的页面名可读。"""
    try:
        config = yaml.load(CONFIG.read_text(encoding="utf-8"), Loader=_Loader) or {}
    except (OSError, yaml.YAMLError):
        return {}
    titles: dict[str, str] = {}

    def walk(node: object) -> None:
        if isinstance(node, list):
            for item in node:
                walk(item)
        elif isinstance(node, dict):
            for title, value in node.items():
                if isinstance(value, str) and value.endswith(".md"):
                    titles.setdefault(value, str(title))
                else:
                    walk(value)

    walk(config.get("nav"))
    return titles


def page_link(path: str) -> str | None:
    """把 docs/foo/index.md 之类转成站点内链接（use_directory_urls 的目录风格）。"""
    if not path.startswith("docs/") or not path.endswith(".md"):
        return None
    relative = path[len("docs/"):-len(".md")]
    if relative == "index":
        return None  # 首页单独处理，避免出现空链接
    if relative.endswith("/index"):
        relative = relative[: -len("/index")]
    return relative + ".md"


def reader_subject(subject: str) -> str:
    """把提交信息整理成给读者看的一句话：清掉内部细节，把类别前缀换成标记。"""
    text = subject.strip()
    for pattern, replacement in CLEANUPS:
        text = pattern.sub(replacement, text)
    text = re.sub(r"\s{2,}", " ", text).strip(" ，,；;、")
    for prefix, tag in TAGS.items():
        if text.startswith(prefix + "：") or text.startswith(prefix + ":"):
            return f"{tag} {text[len(prefix) + 1:].strip()}"
    return text


def render(entries: list[dict[str, object]], titles: dict[str, str] | None = None) -> str:
    titles = titles or {}
    selected = [entry for entry in entries if is_reader_relevant(entry)][:MAX_ENTRIES]
    if not selected:
        body = ["_暂时还没有内容更新记录。_"]
    else:
        body = []
        for entry in selected:
            subject = reader_subject(str(entry["subject"]))
            if len(subject) > MAX_SUBJECT:
                subject = subject[:MAX_SUBJECT].rstrip() + "…"
            labels = []
            for path in entry["pages"]:
                link = page_link(str(path))
                if not link or link in labels:
                    continue
                labels.append(titles.get(str(path)[len("docs/"):], Path(link).stem))
                if len(labels) >= MAX_LINKS:
                    break
            suffix = f"（{ '、'.join(labels) }）" if labels else ""
            body.append(f"- **{entry['date']}** {subject}{suffix}")
    return "\n".join([START, *body, END])


def read_log(project_root: Path = PROJECT_ROOT) -> list[dict[str, object]]:
    result = subprocess.run(
        ["git", "log", f"--pretty=format:{RECORD}%ad{FIELD}%s", "--date=short", "--name-only", "--", "docs"],
        cwd=project_root,
        capture_output=True,
        text=True,
        encoding="utf-8",
        check=False,
    )
    if result.returncode != 0:
        raise RuntimeError(f"git log 执行失败：{result.stderr.strip()}")
    return parse_log(result.stdout)


def replace_block(document: str, block: str) -> str:
    start = document.find(START)
    end = document.find(END)
    if start < 0 or end < 0 or end < start:
        raise SystemExit(f"{PAGE.relative_to(PROJECT_ROOT)} 里找不到 {START} / {END} 标记")
    return document[:start] + block + document[end + len(END):]


def main() -> None:
    parser = argparse.ArgumentParser(description="生成「最近更新」页")
    parser.add_argument("--check", action="store_true", help="只校验标记区存在")
    args = parser.parse_args()

    document = PAGE.read_text(encoding="utf-8")
    if args.check:
        if START not in document or END not in document:
            raise SystemExit(f"{PAGE.relative_to(PROJECT_ROOT)} 缺少 changelog 标记区")
        print("[changelog] 标记区正常")
        return

    try:
        entries = read_log()
    except RuntimeError as error:
        print(f"[changelog] 跳过生成：{error}", file=sys.stderr)
        return

    block = render(entries, nav_titles())
    updated = replace_block(document, block)
    shown = sum(1 for line in block.splitlines() if line.startswith("- "))
    if updated != document:
        PAGE.write_text(updated, encoding="utf-8", newline="\n")
        print(f"[changelog] 已更新 {PAGE.relative_to(PROJECT_ROOT)}：{shown} 条读者可见的更新")
    else:
        print(f"[changelog] 无需更新（{shown} 条）")


if __name__ == "__main__":
    main()
