"""Configuration regressions which the link checker cannot see in query strings."""
import unittest
from pathlib import Path
from mkdocs.config import load_config

ROOT = Path(__file__).resolve().parents[1]

class AssetConfigTests(unittest.TestCase):
    def test_override_templates_have_no_leading_bom(self):
        for template in (ROOT / 'overrides').rglob('*.html'):
            self.assertFalse(template.read_bytes().startswith(b'\xef\xbb\xbf'), str(template))

    def test_no_retired_downloads_or_binary_release_workflow(self):
        self.assertFalse((ROOT / '.github/workflows/build-binaries.yml').exists())
        self.assertFalse(list((ROOT / 'docs/assets/tools').glob('*')))
        self.assertNotIn('standalone.mjs', (ROOT / 'scripts/build_site.py').read_text(encoding='utf-8'))

    def test_css_are_individual_existing_paths(self):
        config = load_config(str(ROOT / "mkdocs.yml"))
        css = config["extra_css"]
        self.assertTrue(any(p.startswith("assets/stylesheets/ujn-contributors.css?") for p in css))
        for asset in css:
            self.assertNotIn(" - ", asset)
            self.assertTrue((ROOT / "docs" / asset.split("?")[0]).is_file(), asset)

    def test_pages_uses_github_io_and_supports_root_repositories(self):
        source = (ROOT / ".github/workflows/pages.yml").read_text(encoding="utf-8")
        self.assertIn('SITE_URL=https://$owner.github.io/$repo/', source)
        self.assertIn('SITE_URL=https://$owner.github.io/', source)

    def test_pages_preserves_complete_history_without_grade_api(self):
        source = (ROOT / '.github/workflows/pages.yml').read_text(encoding='utf-8')
        self.assertIn('fetch-depth: 0', source)
        self.assertNotIn('vars.GRADE_EXPORT_API_URL', source)
        template = (ROOT / 'overrides/main.html').read_text(encoding='utf-8')
        self.assertNotIn('id="ujn-grade-config"', template)
        script = (ROOT / 'docs/javascripts/grade-export.js').read_text(encoding='utf8')
        self.assertNotRegex(script, r'fetch\s*\(')
        self.assertNotIn('/api/grade-export/', script)

    def test_reader_pages_do_not_contain_developer_verification_notes(self):
        for path in ['docs/tools/grade-export.md', 'docs/changelog.md', 'docs/contribute/index.md']:
            source = (ROOT / path).read_text(encoding='utf-8')
            for phrase in ['公开登录页及加密脚本已核对', '模拟测试不代表学校真实账户验证', '这一页是怎么来的', '纯维护性的改动']:
                self.assertNotIn(phrase, source)
