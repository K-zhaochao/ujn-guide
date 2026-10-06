"""
MkDocs 构建钩子 — 构建完成后自动运行 Pagefind 搜索引擎索引

将此文件放入 hooks/ 目录，在 mkdocs.yml 中添加：
    hooks:
        - hooks/pagefind.py

这样只需一条 mkdocs build 即可完成站点构建 + Pagefind 索引。
核心逻辑提取为 run_pagefind_index(site_dir, runner)，runner 可注入以便单元测试；
on_post_build 仅做配置适配与失败退出。
"""

from __future__ import annotations

import shutil
import subprocess
import sys
from pathlib import Path
from typing import Any, Callable, Optional

try:
    from typing import Protocol
except ImportError:  # pragma: no cover - 3.7 兜底
    Protocol = object  # type: ignore[assignment,misc]


class RunResult(Protocol):
    """subprocess.CompletedProcess 的最小协议，便于测试注入假 runner。"""

    returncode: int
    stdout: str
    stderr: str


Runner = Callable[..., RunResult]


def safe_print(text: str) -> None:
    """安全打印，避免 Windows GBK 终端无法处理 Unicode emoji。"""
    try:
        print(text)
    except UnicodeEncodeError:
        safe = text.encode("ascii", errors="replace").decode("ascii")
        print(safe)


def _default_runner(cmd: list[str], **kwargs: Any) -> RunResult:
    """生产环境默认 runner：直接调用 subprocess.run。"""
    return subprocess.run(cmd, **kwargs)  # type: ignore[return-value]


def run_pagefind_index(site_dir: Path, runner: Optional[Runner] = None) -> bool:
    """
    对 site_dir 运行 Pagefind 索引。

    返回 True 表示索引成功且产物存在；site 缺失返回 True（跳过，不算失败）。
    Pagefind 返回码非 0 时抛出 SystemExit(1)，让 MkDocs 构建失败。
    产物目录缺失时打印警告但返回 True（Pagefind 可能换了输出路径）。
    """
    printer = safe_print

    if not site_dir.exists():
        printer(f"[hooks] !! 找不到 {site_dir}，跳过 Pagefind 索引")
        return True

    printer("[hooks] >> 运行 Pagefind 搜索引擎索引...")

    run = runner or _default_runner
    # 关键：不要用 shell=True 配列表——POSIX 下 sh -c 只吃第一个参数，
    # 实际只执行了 npx，Pagefind 压根没跑（Windows 下列表会被拼成命令行，所以本地看着正常）。
    # 这就是 CI 上「Pagefind 运行完毕，但未找到 site/pagefind」的真正原因。
    # npx 在 Windows 上是 npx.cmd，shell=False 时必须显式找到它。
    npx = shutil.which("npx") or "npx"
    result = run(
        [npx, "--no-install", "pagefind", "--site", str(site_dir)],
        capture_output=True,
        text=True,
        encoding="utf-8",
        errors="replace",
        cwd=str(site_dir.parent),
        shell=False,
    )

    if result.stdout:
        for line in result.stdout.splitlines():
            printer(line)
    if result.stderr:
        for line in result.stderr.splitlines():
            if "Unicode" not in line and "gbk" not in line.lower():
                printer(line)

    if result.returncode != 0:
        printer(f"[hooks] !! Pagefind 索引失败 (exit code: {result.returncode})")
        raise SystemExit(1)

    pagefind_dir = site_dir / "pagefind"
    if pagefind_dir.exists():
        total_size = sum(f.stat().st_size for f in pagefind_dir.rglob("*") if f.is_file())
        file_count = len(list(pagefind_dir.rglob("*")))
        printer(f"[hooks] ++ Pagefind 索引完成！({file_count} 文件, {total_size / 1024:.1f} KB)")
    else:
        printer(f"[hooks] ?? Pagefind 运行完毕，但未找到 {pagefind_dir}")
    return True


def on_post_build(config: dict, **kwargs: Any) -> None:
    site_dir = Path(config["site_dir"])
    # MkDocs 只传 config；runner 参数仅供单元测试注入，避免真实执行 npx。
    run_pagefind_index(site_dir, runner=kwargs.get("runner"))


if __name__ == "__main__":  # pragma: no cover
    # 直接执行时：用法 python hooks/pagefind.py <site_dir>
    run_pagefind_index(Path(sys.argv[1] if len(sys.argv) > 1 else "site"))

