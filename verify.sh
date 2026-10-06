#!/usr/bin/env bash
set -euo pipefail

project_root="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
target="all"
skip_install=false
skip_audit=false

usage() {
  printf '%s\n' "Usage: ./verify.sh [--target site|server|all] [--skip-install] [--skip-audit]"
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
  site|server|all) ;;
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
  run_and_log "run local site proxy unit tests" "$report_root/local-proxy-tests.log" npm run test:dev
  run_and_log "run frontend unit tests" "$report_root/frontend-unit-tests.log" npm run test:frontend
  # server/ 是私有后端（在 .gitignore 里），公开仓库不含它；
  # release 工具测试依赖 server/upload-policy.js，缺了必然 MODULE_NOT_FOUND。
  if [ -f "$(dirname "$0")/server/upload-policy.js" ]; then
    run_and_log "run release tool unit tests" "$report_root/release-tool-tests.log" npm run test:release
  else
    echo "[verify] skip release tool unit tests (server/ not present)"
  fi
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

verify_server() {
  local server_script="$project_root/server/verify.sh"
  if [[ ! -f "$server_script" ]]; then
    printf '%s\n' "The independent server repository is required for --target server or --target all." >&2
    exit 1
  fi

  local args=()
  [[ "$skip_install" == true ]] && args+=(--skip-install)
  [[ "$skip_audit" == true ]] && args+=(--skip-audit)
  bash "$server_script" "${args[@]}"
}

# 用 if 而不是 `[[ … ]] && cmd`：后者在条件为假时会让**这一行**返回 1，
# 而它是脚本最后一行 —— 于是「所有检查全部通过、脚本却退出 1」。
# CI 上就是这么骗了我们好几轮：日志里每项都绿，最后来一句 exit code 1。
if [[ "$target" == site || "$target" == all ]]; then verify_site; fi
if [[ "$target" == server || "$target" == all ]]; then verify_server; fi
