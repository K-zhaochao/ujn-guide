"""从完整 Git 历史生成全部更新记录；浏览器每页显示 10 条，无 JS 时保留全部记录。"""

from __future__ import annotations

import argparse
import html
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
PAGE_SIZE = 10
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
    return not str(entry["subject"]).startswith("Merge ")



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
    selected = [entry for entry in entries if is_reader_relevant(entry)]
    body = [START, f'<section id="ujn-changelog" data-page-size="{PAGE_SIZE}" aria-label="更新记录">', '<ol class="ujn-changelog__list">']
    for entry in selected:
        subject = reader_subject(str(entry["subject"]).lstrip("\ufeff"))
        subject = re.sub(r"^(?:feat|fix|style|refactor|chore|docs|test|ci|build|perf)(?:\([^)]*\))?:\s*", "", subject, flags=re.I)
        labels = []
        for path in entry["pages"]:
            link = page_link(str(path))
            label = titles.get(str(path)[len("docs/"):], Path(link).stem) if link else None
            if label and label not in labels and label not in ("🕒 最近更新", "💡 反馈与贡献"):
                labels.append(label)
            if len(labels) >= MAX_LINKS:
                break
        scope = ' · '.join(labels)
        date = html.escape(str(entry['date']), quote=True)
        body.append(f'<li class="ujn-change" data-change-item><time datetime="{date}">{date}</time><div><p>{html.escape(subject)}</p>' + (f'<span class="ujn-change__scope">{html.escape(scope)}</span>' if scope else '') + '</div></li>')
    body.extend(['</ol>', '<nav class="ujn-pagination" data-change-pagination aria-label="更新记录分页" hidden></nav>'])
    if not selected:
        body.append('<p>暂时还没有更新记录。</p>')
    body.extend(['</section>', END])
    return "\n".join(body)


def read_log(project_root: Path = PROJECT_ROOT) -> list[dict[str, object]]:
    result = subprocess.run(
        ["git", "log", f"--pretty=format:{RECORD}%ad{FIELD}%s", "--date=short", "--name-only", "--no-merges"],
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
    shown = sum(1 for line in block.splitlines() if 'data-change-item' in line)
    if updated != document:
        PAGE.write_text(updated, encoding="utf-8", newline="\n")
        print(f"[changelog] 已更新 {PAGE.relative_to(PROJECT_ROOT)}：{shown} 条读者可见的更新")
    else:
        print(f"[changelog] 无需更新（{shown} 条）")


if __name__ == "__main__":
    main()
