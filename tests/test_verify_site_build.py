"""Unit tests for static-site build artifact validation."""

from __future__ import annotations

import tempfile
import unittest
from pathlib import Path

from scripts.verify_site_build import REQUIRED_FILES, SITE_DIR, ZONGCE_PAGE, SiteBuildVerificationError, verify_site


class VerifySiteBuildTests(unittest.TestCase):
    def create_valid_site(self, root: Path) -> Path:
        site_dir = root / "site"
        (site_dir / "pets").mkdir(parents=True)
        (site_dir / "pagefind").mkdir()
        (site_dir / "index.html").write_text("<title>济南大学校园通</title>", encoding="utf-8")
        (site_dir / "pets" / "index.html").write_text("<h1>宠物收集录</h1>", encoding="utf-8")
        (site_dir / "pagefind" / "pagefind.js").write_text("export default {}", encoding="utf-8")
        (site_dir / "pagefind" / "fragment.pf_fragment").write_bytes(b"index")
        for required in REQUIRED_FILES:
            target = site_dir / required.relative_to(SITE_DIR)
            if not target.exists():
                target.parent.mkdir(parents=True, exist_ok=True)
                target.write_text("fixture", encoding="utf-8")
        (site_dir / ZONGCE_PAGE).write_text(
            '<input id="zc-gpa"><input id="zc-quality"><textarea id="zc-import-text"></textarea>'
            '<a class="md-button zc-repo-button" '
            'href="https://github.com/WHHWWHHWWHHWWHHW/zongce-calculator">原作者开源仓库</a>',
            encoding="utf-8",
        )
        return site_dir

    def test_valid_site_requires_pagefind_and_known_page(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            self.assertEqual(verify_site(self.create_valid_site(Path(directory))), 2)

    def test_missing_pagefind_entry_fails(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            site_dir = self.create_valid_site(Path(directory))
            (site_dir / "pagefind" / "pagefind.js").unlink()
            with self.assertRaisesRegex(SiteBuildVerificationError, "pagefind.js"):
                verify_site(site_dir)

    def test_wrong_known_page_content_fails(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            site_dir = self.create_valid_site(Path(directory))
            (site_dir / "pets" / "index.html").write_text("<h1>错误页面</h1>", encoding="utf-8")
            with self.assertRaisesRegex(SiteBuildVerificationError, "pets/index.html"):
                verify_site(site_dir)

    def test_calculator_html_escaped_as_code_fails(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            site_dir = self.create_valid_site(Path(directory))
            (site_dir / ZONGCE_PAGE).write_text(
                '<pre>&lt;input id="zc-gpa"&gt;&lt;input id="zc-quality"&gt;'
                '&lt;textarea id="zc-import-text"&gt;&lt;/textarea&gt;</pre>', encoding="utf-8",
            )
            with self.assertRaisesRegex(SiteBuildVerificationError, "表单控件"):
                verify_site(site_dir)

    def test_missing_upstream_repository_button_fails(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            site_dir = self.create_valid_site(Path(directory))
            (site_dir / ZONGCE_PAGE).write_text(
                '<input id="zc-gpa"><input id="zc-quality"><textarea id="zc-import-text"></textarea>',
                encoding="utf-8",
            )
            with self.assertRaisesRegex(SiteBuildVerificationError, "原作者开源仓库按钮"):
                verify_site(site_dir)

    def test_missing_calculator_script_fails(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            site_dir = self.create_valid_site(Path(directory))
            (site_dir / "assets" / "zongce-calculator" / "calculator.js").unlink()
            with self.assertRaisesRegex(SiteBuildVerificationError, "calculator.js"):
                verify_site(site_dir)
