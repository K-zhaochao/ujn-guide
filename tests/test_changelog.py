"""「最近更新」页生成脚本的测试：解析、筛选、链接与页面标记。"""

from __future__ import annotations

import importlib.util
import unittest
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parent.parent
SPEC = importlib.util.spec_from_file_location(
    "build_changelog", PROJECT_ROOT / "scripts" / "site" / "build_changelog.py"
)
assert SPEC and SPEC.loader
changelog = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(changelog)

RECORD = changelog.RECORD
FIELD = changelog.FIELD


def log_entry(date: str, subject: str, paths: list[str]) -> str:
    return RECORD + date + FIELD + subject + "\n" + "\n".join(paths) + "\n"


class ParseLogTests(unittest.TestCase):
    def test_parses_date_subject_and_markdown_paths(self) -> None:
        raw = (
            log_entry("2026-10-07", "内容：新增舜耕校区食堂攻略", ["docs/site-guide/x.md", "docs/a.png"])
            + log_entry("2026-10-06", "重构：搬家", ["docs/pets/index.md"])
        )
        entries = changelog.parse_log(raw)
        self.assertEqual(len(entries), 2)
        self.assertEqual(entries[0]["date"], "2026-10-07")
        self.assertEqual(entries[0]["subject"], "内容：新增舜耕校区食堂攻略")
        # 只保留 .md，图片等附件不算「内容更新」
        self.assertEqual(entries[0]["pages"], ["docs/site-guide/x.md"])

    def test_ignores_blank_and_malformed_chunks(self) -> None:
        self.assertEqual(changelog.parse_log("\n\n"), [])
        self.assertEqual(changelog.parse_log("没有分隔符的垃圾"), [])


class FilterTests(unittest.TestCase):
    def entry(self, subject: str) -> dict[str, object]:
        return {"date": "2026-10-07", "subject": subject, "pages": ["docs/a.md"]}

    def test_maintenance_commits_are_hidden(self) -> None:
        for subject in ["重构：拆开主题覆盖层", "测试：补 5 个用例", "chore: bump deps", "文档：更新 BUILDING.md"]:
            self.assertFalse(changelog.is_reader_relevant(self.entry(subject)), subject)

    def test_content_commits_are_shown(self) -> None:
        for subject in ["内容：新增舜耕校区食堂攻略", "修复：通知面板不再误关", "回退：下线宠物投稿系统", "添加校历"]:
            self.assertTrue(changelog.is_reader_relevant(self.entry(subject)), subject)

    def test_merge_commits_are_hidden(self) -> None:
        self.assertFalse(changelog.is_reader_relevant(self.entry("Merge pull request #3 from x/y")))


class RenderTests(unittest.TestCase):
    def test_links_use_nav_titles_and_fall_back_to_file_stem(self) -> None:
        entries = [{"date": "2026-10-07", "subject": "内容：新增攻略", "pages": ["docs/phone-book/colleges.md", "docs/unknown/thing.md"]}]
        block = changelog.render(entries, {"phone-book/colleges.md": "📞 电话大全"})
        self.assertIn("**2026-10-07** 内容：新增攻略（📞 电话大全、thing）", block)
        self.assertTrue(block.startswith(changelog.START))
        self.assertTrue(block.endswith(changelog.END))

    def test_keeps_at_most_max_entries_and_truncates_long_subjects(self) -> None:
        entries = [{"date": "2026-10-07", "subject": "长" * 200, "pages": []} for _ in range(changelog.MAX_ENTRIES + 5)]
        block = changelog.render(entries, {})
        items = [line for line in block.splitlines() if line.startswith("- ")]
        self.assertEqual(len(items), changelog.MAX_ENTRIES)
        self.assertLessEqual(len(items[0]), changelog.MAX_SUBJECT + 20)
        self.assertIn("…", items[0])

    def test_empty_history_renders_placeholder(self) -> None:
        self.assertIn("暂时还没有内容更新记录", changelog.render([], {}))

    def test_page_link_handles_directory_urls(self) -> None:
        self.assertEqual(changelog.page_link("docs/pets/index.md"), "pets.md")
        self.assertEqual(changelog.page_link("docs/green-book.md"), "green-book.md")
        self.assertIsNone(changelog.page_link("docs/index.md"))
        self.assertIsNone(changelog.page_link("docs/a.png"))


class RepositoryPageTests(unittest.TestCase):
    def test_committed_page_has_markers_and_entries(self) -> None:
        document = changelog.PAGE.read_text(encoding="utf-8")
        self.assertIn(changelog.START, document)
        self.assertIn(changelog.END, document)
        block = document.split(changelog.START, 1)[1].split(changelog.END, 1)[0]
        items = [line for line in block.splitlines() if line.startswith("- ")]
        self.assertTrue(items, "更新记录不该是空的，跑一下 python scripts/site/build_changelog.py")
        for line in items:
            self.assertRegex(line, r"^- \*\*\d{4}-\d{2}-\d{2}\*\* \S")

    def test_nav_titles_are_readable(self) -> None:
        titles = changelog.nav_titles()
        self.assertTrue(titles, "没能从 mkdocs.yml 里读出导航标题（可能是自定义 YAML 标签没被忽略）")
        self.assertTrue(any("宠物" in title for title in titles.values()))


if __name__ == "__main__":
    unittest.main()
