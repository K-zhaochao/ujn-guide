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

    def test_maintenance_commits_are_kept_in_complete_history(self) -> None:
        for subject in [
            "重构：拆开主题覆盖层", "测试：补 5 个用例", "chore: bump deps", "文档：更新 BUILDING.md",
            "feat(pets): 主站搜索支持投稿 ID 精确查找", "fix(pets,admin): 下拉滚动条同步",
        ]:
            self.assertTrue(changelog.is_reader_relevant(self.entry(subject)), subject)

    def test_content_commits_are_shown(self) -> None:
        for subject in ["内容：新增舜耕校区食堂攻略", "修复：通知面板不再误关", "回退：下线宠物投稿系统", "添加校历"]:
            self.assertTrue(changelog.is_reader_relevant(self.entry(subject)), subject)

    def test_merge_commits_are_hidden(self) -> None:
        self.assertFalse(changelog.is_reader_relevant(self.entry("Merge pull request #3 from x/y")))


class ReaderSubjectTests(unittest.TestCase):
    def test_prefix_becomes_tag(self) -> None:
        self.assertEqual(changelog.reader_subject("功能：窄屏补上本页目录"), "✨ 窄屏补上本页目录")
        self.assertEqual(changelog.reader_subject("修复：面板不再误关"), "🛠️ 面板不再误关")
        self.assertEqual(changelog.reader_subject("回退：下线投稿系统"), "↩️ 下线投稿系统")

    def test_internal_details_are_stripped(self) -> None:
        cleaned = changelog.reader_subject("功能：接入综测计算器（纯静态资源 + 页面 + 构建校验）")
        self.assertEqual(cleaned, "✨ 接入综测计算器")
        cleaned = changelog.reader_subject("修复：恢复桌面端右侧「目录」栏（第 2 轮误开 toc.integrate）")
        self.assertEqual(cleaned, "🛠️ 恢复桌面端右侧「目录」栏")
        cleaned = changelog.reader_subject("功能：新增「本页目录」，本轮顺带修了两处指纹漂移")
        self.assertNotIn("本轮", cleaned)

    def test_plain_subject_is_kept(self) -> None:
        self.assertEqual(changelog.reader_subject("🐾 宠物页分页条主题化"), "🐾 宠物页分页条主题化")


class RenderTests(unittest.TestCase):
    def test_links_use_nav_titles_and_fall_back_to_file_stem(self) -> None:
        entries = [{"date": "2026-10-07", "subject": "内容：新增攻略", "pages": ["docs/phone-book/colleges.md", "docs/unknown/thing.md"]}]
        block = changelog.render(entries, {"phone-book/colleges.md": "📞 电话大全"})
        self.assertIn('datetime="2026-10-07"', block)
        self.assertIn('📝 新增攻略', block)
        self.assertIn('📞 电话大全 · thing', block)
        self.assertTrue(block.startswith(changelog.START))
        self.assertTrue(block.endswith(changelog.END))

    def test_keeps_entire_history_for_pagination_and_escapes_html(self) -> None:
        entries = [{"date": "2026-10-07", "subject": '<script>alert(1)</script>' + "长" * 200, "pages": []} for _ in range(135)]
        block = changelog.render(entries, {})
        self.assertEqual(block.count('data-change-item'), 135)
        self.assertNotIn('<script>', block)
        self.assertIn('&lt;script&gt;', block)
        self.assertIn('data-page-size="10"', block)

    def test_empty_history_renders_placeholder(self) -> None:
        self.assertIn("暂时还没有更新记录", changelog.render([], {}))

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
        items = [line for line in block.splitlines() if 'data-change-item' in line]
        self.assertTrue(items, "更新记录不该是空的，跑一下 python scripts/site/build_changelog.py")
        for line in items:
            self.assertRegex(line, r'datetime="\d{4}-\d{2}-\d{2}"')

    def test_nav_titles_are_readable(self) -> None:
        titles = changelog.nav_titles()
        self.assertTrue(titles, "没能从 mkdocs.yml 里读出导航标题（可能是自定义 YAML 标签没被忽略）")
        self.assertTrue(any("宠物" in title for title in titles.values()))


if __name__ == "__main__":
    unittest.main()
