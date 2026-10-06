"""判断 pip-audit 的 JSON 报告里到底有没有漏洞。

为什么要单独写这个：pip-audit 在 CI 上出现过「报告无漏洞、退出码却是 1」的情况
（临时虚拟环境差异），而 verify 脚本又是 set -e / $ErrorActionPreference=Stop，
于是整条流水线被误判成红。

第一版我用 `grep '"vulnerabilities": \\[\\]'` 去判——**判据是错的**：
pip-audit 的 JSON 顶层没有 vulnerabilities 字段，每个依赖是 {"name":…, "vulns":[…]}
（见 pip-audit 文档 / 实际报告），所以 grep 永不匹配、永远走"有漏洞"分支。
现在改成解析 JSON：**任何一个依赖的 vulns 非空才算失败**。

退出码：0 = 无漏洞；1 = 有漏洞；2 = 报告缺失或读不懂（不能当成通过）。
"""

from __future__ import annotations

import argparse
import json
import pathlib
import sys


def find_vulnerabilities(report: object) -> list[str]:
    """从报告里挑出所有非空 vulns，返回人类可读的行。"""
    if not isinstance(report, dict):
        raise ValueError("报告顶层不是对象")
    dependencies = report.get("dependencies")
    if not isinstance(dependencies, list):
        raise ValueError("报告里没有 dependencies 列表")

    findings: list[str] = []
    for item in dependencies:
        if not isinstance(item, dict):
            continue
        vulns = item.get("vulns") or []
        if not vulns:
            continue
        name = item.get("name", "?")
        version = item.get("version", "?")
        for vuln in vulns:
            if isinstance(vuln, dict):
                identifier = vuln.get("id") or vuln.get("alias") or "?"
                fixes = ", ".join(vuln.get("fix_versions") or []) or "暂无"
                findings.append(f"{name} {version} — {identifier}（修复版本：{fixes}）")
            else:
                findings.append(f"{name} {version} — {vuln}")
    return findings


def main() -> int:
    parser = argparse.ArgumentParser(description="检查 pip-audit JSON 报告")
    parser.add_argument("report", type=pathlib.Path)
    parser.add_argument("--quiet", action="store_true", help="通过时不打印摘要")
    args = parser.parse_args()

    try:
        report = json.loads(args.report.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as error:
        print(f"[audit] 读不懂审计报告 {args.report}：{error}", file=sys.stderr)
        return 2

    try:
        findings = find_vulnerabilities(report)
    except ValueError as error:
        print(f"[audit] 审计报告结构异常：{error}", file=sys.stderr)
        return 2

    if findings:
        print(f"[audit] 发现 {len(findings)} 条 Python 依赖漏洞：", file=sys.stderr)
        for line in findings:
            print("  - " + line, file=sys.stderr)
        return 1

    if not args.quiet:
        count = len(report.get("dependencies") or [])
        print(f"[audit] Python 依赖审计通过：{count} 个包，无已知漏洞")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
