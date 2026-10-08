#!/usr/bin/env bash
set -euo pipefail

project_root="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
target="site"
skip_install=false
skip_audit=false

usage() {
  printf '%s\n' "Usage: ./verify.sh [--target site] [--skip-install] [--skip-audit]"
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --target)
      target="${2:-}"
      shift 2
      ;;
    --skip-install)
      skip_install=true
      shift
      ;;
    --skip-audit)
      skip_audit=true
      shift
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      usage >&2
      exit 2
      ;;
  esac
done

case "$target" in
  site) ;;
  *) usage >&2; exit 2 ;;
esac

run_and_log() {
  local label="$1"
  local log_file="$2"
  shift 2
  printf '[verify] %s\n' "$label"
  "$@" > >(tee "$log_file") 2>&1
}

verify_site() {
  local report_root="$project_root/reports/site"
  mkdir -p "$report_root"
  cd "$project_root"

  if [[ "$skip_install" == false ]]; then
    npm ci
    python -m pip install -r requirements.txt "pip-audit==2.10.1"
  fi

  run_and_log "run site build unit tests" "$report_root/unit-tests.log" npm run test:build
  run_and_log "run frontend unit tests" "$report_root/frontend-unit-tests.log" npm run test:frontend
  run_and_log "run strict site build" "$report_root/build.log" npm run build

  if [[ "$skip_audit" == false ]]; then
    npm audit --omit=dev --audit-level=high --json > "$report_root/npm-audit.json"
    cat "$report_root/npm-audit.json"
    # pip-audit 在 CI 上出现过「报告无漏洞、退出码却是 1」的情况，set -e 会直接把流水线判死。
    # 所以它自己的退出码只当参考，**判据交给 check_pip_audit.py 解析报告**：
    # 任何一个依赖的 vulns 非空才算失败（顶层的字段名不是 vulnerabilities，别再用 grep 猜）。
    PYTHONUTF8=1 python -m pip_audit --requirement requirements.txt \
      --format json --output "$report_root/pip-audit.json" --progress-spinner off || true
    PYTHONUTF8=1 python scripts/security/check_pip_audit.py "$report_root/pip-audit.json"
  fi
}

verify_site
