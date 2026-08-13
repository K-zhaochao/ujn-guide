"""Unit tests for the MkDocs Pagefind build hook (hooks/pagefind.py)."""

from __future__ import annotations

import tempfile
import unittest
from pathlib import Path
from types import SimpleNamespace

from hooks.pagefind import on_post_build, run_pagefind_index


def make_result(returncode: int, stdout: str = "", stderr: str = "") -> SimpleNamespace:
    return SimpleNamespace(returncode=returncode, stdout=stdout, stderr=stderr)


class PagefindHookTests(unittest.TestCase):
    def make_site(self, root: Path, with_pagefind_output: bool = True) -> Path:
        site_dir = root / "site"
        site_dir.mkdir(parents=True, exist_ok=True)
        (site_dir / "index.html").write_text("<title>济南大学校园通</title>", encoding="utf-8")
        if with_pagefind_output:
            pf = site_dir / "pagefind"
            pf.mkdir(parents=True)
            (pf / "pagefind.js").write_text("export default {}", encoding="utf-8")
            (pf / "fragment.pf_fragment").write_bytes(b"index")
        return site_dir

    def test_missing_site_skips_index(self) -> None:
        """site 缺失时跳过索引，不调用 runner，不抛异常。"""
        with tempfile.TemporaryDirectory() as directory:
            calls: list[list[str]] = []

            def runner(cmd, **kwargs):
                calls.append(cmd)
                return make_result(0)

            missing = Path(directory) / "no-such-site"
            self.assertTrue(run_pagefind_index(missing, runner=runner))
            self.assertEqual(calls, [])

    def test_success_requires_pagefind_output(self) -> None:
        """Pagefind 返回 0 且产物存在时返回 True。"""
        with tempfile.TemporaryDirectory() as directory:
            site_dir = self.make_site(Path(directory))
            seen: dict = {}

            def runner(cmd, **kwargs):
                seen["cmd"] = cmd
                seen["cwd"] = kwargs.get("cwd")
                seen["shell"] = kwargs.get("shell")
                return make_result(0, stdout="Indexed 3 pages")

            self.assertTrue(run_pagefind_index(site_dir, runner=runner))
            self.assertEqual(seen["cmd"][0], "npx")
            self.assertIn("pagefind", seen["cmd"])
            self.assertIn(str(site_dir), seen["cmd"])
            self.assertEqual(seen["cwd"], str(site_dir.parent))
            self.assertTrue(seen["shell"])

    def test_failure_raises_system_exit(self) -> None:
        """Pagefind 返回码非 0 时抛出 SystemExit(1) 使构建失败。"""
        with tempfile.TemporaryDirectory() as directory:
            site_dir = self.make_site(Path(directory))

            def runner(cmd, **kwargs):
                return make_result(2, stdout="", stderr="pagefind crashed")

            with self.assertRaises(SystemExit) as ctx:
                run_pagefind_index(site_dir, runner=runner)
            self.assertEqual(ctx.exception.code, 1)

    def test_missing_output_warns_but_returns_true(self) -> None:
        """Pagefind 返回 0 但未生成 pagefind 目录时打印警告并返回 True。"""
        with tempfile.TemporaryDirectory() as directory:
            site_dir = self.make_site(Path(directory), with_pagefind_output=False)

            def runner(cmd, **kwargs):
                return make_result(0)

            self.assertTrue(run_pagefind_index(site_dir, runner=runner))

    def test_unicode_error_is_not_filtered_from_stderr(self) -> None:
        """stderr 中真正的错误（非 GBK 噪音）应保留。"""
        with tempfile.TemporaryDirectory() as directory:
            site_dir = self.make_site(Path(directory))

            def runner(cmd, **kwargs):
                return make_result(1, stderr="real failure: 内存不足")

            with self.assertRaises(SystemExit):
                run_pagefind_index(site_dir, runner=runner)

    def test_on_post_build_adapts_config(self) -> None:
        """on_post_build 从 config 读取 site_dir 并调用索引（runner 可注入）。"""
        with tempfile.TemporaryDirectory() as directory:
            site_dir = self.make_site(Path(directory))

            def runner(cmd, **kwargs):
                return make_result(0, stdout="Indexed 3 pages")

            on_post_build({"site_dir": str(site_dir)}, runner=runner)


if __name__ == "__main__":
    unittest.main()
