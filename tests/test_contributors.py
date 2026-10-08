"""贡献者名单生成脚本的测试：归一化、合并、渲染与占位文案。"""

from __future__ import annotations

import importlib.util
import unittest
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parent.parent
SPEC = importlib.util.spec_from_file_location(
    "build_contributors", PROJECT_ROOT / "scripts" / "site" / "build_contributors.py"
)
assert SPEC and SPEC.loader
contributors = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(contributors)

GITHUB = {"key": "github", "label": "GitHub", "repo": "https://github.com/x/y", "api": "gh"}
GITEE = {"key": "gitee", "label": "Gitee", "repo": "https://gitee.com/x/y", "api": "gt"}


class NormalizeTests(unittest.TestCase):
    def test_github_shape(self) -> None:
        people = contributors.normalize(
            [{"login": "Draven", "avatar_url": "https://a/1.png", "html_url": "https://gh/draven", "contributions": 12}],
            GITHUB,
        )
        self.assertEqual(
            people,
            [{"name": "Draven", "avatar": "https://a/1.png", "url": "https://gh/draven",
              "contributions": 12, "source": "GitHub"}],
        )

    def test_entries_without_a_name_are_dropped(self) -> None:
        self.assertEqual(contributors.normalize([{"contributions": 3}, "垃圾", None], GITEE), [])

    def test_non_list_payload_is_ignored(self) -> None:
        # 仓库不存在时 API 会返回错误对象而不是数组
        self.assertEqual(contributors.normalize({"message": "Not Found"}, GITHUB), [])


class CollectTests(unittest.TestCase):
    def test_preserves_same_person_in_each_platform(self) -> None:
        def fetcher(url: str) -> object:
            if url == "gh":
                return [{"login": "Draven", "contributions": 5, "avatar_url": "a", "html_url": "u"}]
            return [{"login": "draven", "contributions": 7, "avatar_url": "b", "html_url": "u2"}]

        people = contributors.collect((GITHUB, GITEE), fetcher)
        self.assertEqual(len(people), 2)
        self.assertEqual([person["contributions"] for person in people], [5, 7])
        self.assertEqual([person["source"] for person in people], ["GitHub", "Gitee"])

    def test_a_failing_source_does_not_break_the_other(self) -> None:
        def fetcher(url: str) -> object:
            if url == "gh":
                raise ValueError("boom")
            return [{"login": "cat", "contributions": 1}]

        people = contributors.collect((GITHUB, GITEE), fetcher)
        self.assertEqual([person["name"] for person in people], ["cat"])


class RenderTests(unittest.TestCase):
    def test_renders_card_with_avatar_and_counts(self) -> None:
        block = contributors.render(
            [{"name": "Draven", "avatar": "https://a/1.png", "url": "https://gh/d", "contributions": 12, "source": "GitHub"}]
        )
        self.assertTrue(block.startswith(contributors.START))
        self.assertTrue(block.endswith(contributors.END))
        self.assertIn('class="ujn-contributor" href="https://gh/d"', block)
        self.assertIn('src="https://a/1.png"', block)
        self.assertIn(">Draven<", block)
        self.assertIn("12 次提交", block)

    def test_falls_back_to_initial_when_no_avatar(self) -> None:
        block = contributors.render([{"name": "cat", "avatar": "", "url": "u", "contributions": None, "source": "Gitee"}])
        self.assertIn('class="ujn-contributor__initial">C<', block)
        self.assertIn(">Gitee<", block)

    def test_empty_list_renders_placeholder_with_links(self) -> None:
        block = contributors.render([])
        self.assertIn("感谢每一位", block)
        self.assertIn("github.com/K-zhaochao/ujn-guide", block)
        self.assertIn('role="tablist"', block)


class EscapeTests(unittest.TestCase):
    def test_remote_names_and_links_are_not_html_injection(self):
        block = contributors.render([{'name': '<script>x</script>', 'avatar': 'javascript:x', 'url': 'javascript:x', 'contributions': 1, 'source': 'GitHub'}])
        self.assertNotIn('<script>', block)
        self.assertNotRegex(block, r'(?:href|src)="javascript:')
        self.assertIn('role="tablist"', block)
        self.assertIn('ujn-contributor__text', block)


class RepositoryTests(unittest.TestCase):
    def test_page_has_markers(self) -> None:
        document = contributors.PAGE.read_text(encoding="utf-8")
        self.assertIn(contributors.START, document)
        self.assertIn(contributors.END, document)
        self.assertLess(document.index(contributors.START), document.index(contributors.END))

    def test_markers_are_near_the_top_of_the_page(self) -> None:
        """用户要求贡献者放在页面最上方。"""
        document = contributors.PAGE.read_text(encoding="utf-8")
        self.assertLess(document.index(contributors.START), 600, "贡献者名单应该在页面顶部")


if __name__ == "__main__":
    unittest.main()


class FetchTests(unittest.TestCase):
    def test_empty_body_is_treated_as_no_contributors(self) -> None:
        """空仓库：GitHub 返回 204 No Content，不能当成抓取失败。"""
        import io
        from unittest import mock

        class FakeResponse(io.BytesIO):
            def __enter__(self): return self
            def __exit__(self, *args): return False

        with mock.patch('urllib.request.urlopen', return_value=FakeResponse(b'')):
            self.assertEqual(contributors.fetch_json('https://api.github.com/x'), [])

    def test_parses_json_body(self) -> None:
        import io
        from unittest import mock

        class FakeResponse(io.BytesIO):
            def __enter__(self): return self
            def __exit__(self, *args): return False

        payload = b'[{"login": "cat"}]'
        with mock.patch('urllib.request.urlopen', return_value=FakeResponse(payload)):
            self.assertEqual(contributors.fetch_json('https://api.github.com/x'), [{"login": "cat"}])


class PlatformTests(unittest.TestCase):
    def test_both_panels_are_visible_without_javascript(self):
        block = contributors.render([])
        self.assertIn('id="contributors-panel-github"', block)
        self.assertIn('id="contributors-panel-gitee"', block)
        self.assertNotRegex(block, r'role="tabpanel"[^>]*hidden')

    def test_cache_is_inert_and_round_trips(self):
        people = [{'name': '</script><script>x</script>', 'avatar': '', 'url': '', 'contributions': 0, 'source': 'Gitee'}]
        block = contributors.render(people)
        self.assertNotIn('</script><script>', block)
        self.assertEqual(contributors.cached_people(block), people)

    def test_failed_platform_preserves_cached_members(self):
        cached = [{'name': 'cached', 'avatar': '', 'url': '', 'contributions': 10, 'source': 'Gitee'}]
        def fetcher(url):
            if url == 'gt': raise ValueError('temporary')
            return [{'login': 'new', 'contributions': 20}]
        people = contributors.collect((GITHUB, GITEE), fetcher, cached)
        self.assertEqual([p['name'] for p in people], ['new', 'cached'])

    def test_page_headings_have_no_leftover_numbering(self):
        self.assertNotRegex(contributors.PAGE.read_text(encoding='utf8'), r'(?m)^## [3-7]\.')
        for anchor in range(3, 8):
            self.assertIn(f'id="{anchor}"', contributors.PAGE.read_text(encoding='utf8'))


class LightboxCompatibilityTests(unittest.TestCase):
    def test_avatar_stays_inside_profile_card_after_actual_plugin_hook(self):
        from mkdocs_glightbox.plugin import LightboxPlugin
        from selectolax.lexbor import LexborHTMLParser
        from types import SimpleNamespace
        plugin = LightboxPlugin()
        plugin.load_config({})
        block = contributors.render([{'name': 'student', 'avatar': 'https://avatars.githubusercontent.com/u/1', 'url': 'https://github.com/student', 'contributions': 10, 'source': 'GitHub'}])
        rendered = plugin.on_page_content(block, SimpleNamespace(meta={}), {})
        tree = LexborHTMLParser(rendered)
        self.assertEqual(len(tree.css('a.ujn-contributor img')), 1)
        self.assertFalse(tree.css('a.glightbox'))
        self.assertIn('student', tree.css_first('a.ujn-contributor').text())
