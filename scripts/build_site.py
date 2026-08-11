"""Run the reproducible strict MkDocs build and verify its output."""

from __future__ import annotations

import os
import subprocess
import sys
from pathlib import Path

from verify_site_build import SiteBuildVerificationError, verify_site


PROJECT_ROOT = Path(__file__).resolve().parent.parent


def build_environment() -> dict[str, str]:
    environment = os.environ.copy()
    environment.setdefault("NO_MKDOCS_2_WARNING", "true")
    warning_filter = "ignore:pkg_resources is deprecated as an API:UserWarning"
    current_filters = environment.get("PYTHONWARNINGS", "")
    environment["PYTHONWARNINGS"] = ",".join(filter(None, (warning_filter, current_filters)))
    return environment


def run_build(project_root: Path = PROJECT_ROOT) -> int:
    result = subprocess.run(
        [sys.executable, "-m", "mkdocs", "build", "--strict", "--clean"],
        cwd=project_root,
        env=build_environment(),
        check=False,
    )
    return result.returncode


def main() -> None:
    if run_build() != 0:
        raise SystemExit(1)
    try:
        file_count = verify_site()
    except SiteBuildVerificationError as error:
        print(f"[build-site] {error}", file=sys.stderr)
        raise SystemExit(1) from error
    print(f"[build-site] 严格构建通过，Pagefind 已生成 {file_count} 个文件")


if __name__ == "__main__":
    main()
