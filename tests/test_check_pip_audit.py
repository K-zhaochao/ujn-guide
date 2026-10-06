"""check_pip_audit.py 的单元测试。

这条判据我第一版写错过（用 grep 找顶层 vulnerabilities 字段，而 pip-audit 的字段是
每个依赖的 vulns），结果 CI 明明无漏洞却判红。用真实报告结构把它钉死。
"""

from __future__ import annotations

import importlib.util
import json
import tempfile
import unittest
from pathlib import Path

SPEC = importlib.util.spec_from_file_location(
    "check_pip_audit",
    Path(__file__).resolve().parents[1] / "scripts" / "security" / "check_pip_audit.py",
)
assert SPEC and SPEC.loader
checker = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(checker)


def run(report: object) -> int:
    with tempfile.TemporaryDirectory() as directory:
        path = Path(directory) / "pip-audit.json"
        path.write_text(json.dumps(report), encoding="utf-8")
        return checker.main.__wrapped__(path) if hasattr(checker.main, "__wrapped__") else _run_path(path)


def _run_path(path: Path) -> int:
    import sys

    argv = sys.argv
    sys.argv = ["check_pip_audit.py", str(path), "--quiet"]
    try:
        return checker.main()
    finally:
        sys.argv = argv


# pip-audit 真实报告的形状（顶层只有 dependencies 与 fixes）
CLEAN = {
    "dependencies": [
        {"name": "mkdocs-material", "version": "9.7.7", "vulns": []},
        {"name": "pillow", "version": "12.3.0", "vulns": []},
    ],
    "fixes": [],
}

WITH_VULN = {
    "dependencies": [
        {"name": "mkdocs-material", "version": "9.7.7", "vulns": []},
        {
            "name": "pillow",
            "version": "12.0.0",
            "vulns": [{"id": "PYSEC-2026-3454", "fix_versions": ["12.3.0"]}],
        },
    ],
    "fixes": [],
}


class CheckPipAuditTests(unittest.TestCase):
    def test_clean_report_passes(self) -> None:
        self.assertEqual(run(CLEAN), 0)

    def test_report_with_vulnerability_fails(self) -> None:
        self.assertEqual(run(WITH_VULN), 1)

    def test_findings_mention_package_and_fix(self) -> None:
        findings = checker.find_vulnerabilities(WITH_VULN)
        self.assertEqual(len(findings), 1)
        self.assertIn("pillow", findings[0])
        self.assertIn("PYSEC-2026-3454", findings[0])
        self.assertIn("12.3.0", findings[0])

    def test_broken_report_is_not_treated_as_success(self) -> None:
        with self.assertRaises(ValueError):
            checker.find_vulnerabilities({"fixes": []})


if __name__ == "__main__":
    unittest.main()
