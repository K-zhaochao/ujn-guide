"""站点链接体检脚本的测试：解析、路径归一化与问题分类。"""

from __future__ import annotations

import importlib.util
import tempfile
import unittest
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parent.parent
SPEC = importlib.util.spec_from_file_location(
    "check_links", PROJECT_ROOT / "scripts" / "site" / "check_links.py"
)
assert SPEC and SPEC.loader
check_links = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(check_links)


def write(site: Path, relative: str, html: str) -> None:
    path = site / relative
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(html, encoding="utf-8")


class CollectorTests(unittest.TestCase):
    def test_collects_links_ids_and_names(self) -> None:
        collector = check_links.LinkCollector()
        collector.feed(
            '<a href="/a/">x</a><img src="b.webp"><h2 id="sec">s</h2>'
            '<a name="legacy"></a><script src="c.js"></script>'
        )
        self.assertEqual(
            collector.links,
            [("a", "/a/"), ("img", "b.webp"), ("script", "c.js")],
        )
        self.assertEqual(collector.ids, {"sec", "legacy"})

    def test_decodes_entities(self) -> None:
        collector = check_links.LinkCollector()
        collector.feed('<a href="/a/?x=1&amp;y=2">x</a>')
        self.assertEqual(collector.links[0][1], "/a/?x=1&y=2")


class PathTests(unittest.TestCase):
    def test_page_url_maps_index_to_directory(self) -> None:
        site = Path("/tmp/site")
        self.assertEqual(check_links.page_url(site / "pets" / "index.html", site), "/pets/")
        self.assertEqual(check_links.page_url(site / "404.html", site), "/404.html")
        self.assertEqual(check_links.page_url(site / "index.html", site), "/")

    def test_resolve_handles_directory_urls_assets_and_externals(self) -> None:
        site = Path("/tmp/site")
        self.assertEqual(check_links.resolve("./pets/", "/", site), site / "pets" / "index.html")
        self.assertEqual(check_links.resolve("../assets/a.webp", "/pets/", site), site / "assets" / "a.webp")
        self.assertEqual(check_links.resolve("a.webp", "/pets/", site), site / "pets" / "a.webp")
        self.assertIsNone(check_links.resolve("https://example.com/x", "/", site))
        # 百分号编码要还原，否则中文路径会被当成不存在
        self.assertEqual(check_links.resolve("%E5%AE%A0%E7%89%A9/", "/", site), site / "宠物" / "index.html")


class AuditTests(unittest.TestCase):
    def setUp(self) -> None:
        self._directory = tempfile.TemporaryDirectory()
        self.site = Path(self._directory.name)
        write(self.site, "index.html", """
            <html><body>
              <a href="pets/">宠物</a>
              <a href="pets/#missing">跳到一个不存在的锚点</a>
              <a href="pets/#cat">跳到存在的锚点</a>
              <a href="assets/photo.webp">图片</a>
              <a href="gone/">已经不存在的页面</a>
              <a href="https://example.com/">外链</a>
              <a href="mailto:a@b.c">邮件</a>
              <a href="javascript:void(0)">伪链接</a>
            </body></html>
        """)
        write(self.site, "pets/index.html", '<html><body><h2 id="cat">猫</h2></body></html>')
        write(self.site, "assets/photo.webp", "webp")

    def tearDown(self) -> None:
        self._directory.cleanup()

    def test_reports_only_real_problems(self) -> None:
        pages, externals, total = check_links.collect_pages(self.site)
        self.assertEqual(len(pages), 2)
        self.assertEqual(externals, {"https://example.com/"})
        self.assertGreater(total, 0)

        problems = check_links.check_internal(pages, self.site)
        self.assertEqual([f"{url} -> {target}" for url in ["/"] for target in []] , [])
        broken_files = problems["站内链接指向不存在的文件"]
        broken_anchors = problems["锚点不存在"]
        self.assertEqual(len(broken_files), 1)
        self.assertIn("/ -> gone/", broken_files)
        self.assertEqual(len(broken_anchors), 1)
        self.assertIn("/ -> pets/#missing", broken_anchors)
        # javascript: 伪链接单独归类；正常链接（含存在的锚点、图片、外链、mailto）不算问题
        self.assertEqual(problems["javascript: 伪链接"], ["/ -> javascript:void(0)"])
        self.assertEqual(len(problems), 3)

    def test_audit_summarises_pages_and_links(self) -> None:
        page_count, link_count, problems = check_links.audit(self.site)
        self.assertEqual(page_count, 2)
        self.assertGreater(link_count, 5)
        self.assertIn("站内链接指向不存在的文件", problems)

    def test_clean_site_reports_nothing(self) -> None:
        write(self.site, "index.html", '<a href="pets/">宠物</a><a href="pets/#cat">猫</a>')
        _, _, problems = check_links.audit(self.site)
        self.assertEqual(problems, {})


class RepositoryTests(unittest.TestCase):
    def test_built_site_has_no_internal_problems(self) -> None:
        """仓库里的 site/ 若已构建，则不允许有站内问题（CI 里由 npm run build 兜住）。"""
        site = PROJECT_ROOT / "site"
        if not site.is_dir():
            self.skipTest("还没有构建产物")
        page_count, link_count, problems = check_links.audit(site)
        self.assertGreater(page_count, 100)
        self.assertGreater(link_count, 10000)
        self.assertEqual(problems, {}, f"站内链接问题：{problems}")


if __name__ == "__main__":
    unittest.main()
