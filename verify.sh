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
    # pip-audit 在 CI 上出现过「报告写着 No known vulnerabilities found，退出码却是 1」的情况
    # （临时虚拟环境的差异所致），而 set -e 会让整个校验直接挂掉。
    # 所以这里自己接住退出码，**以报告内容为准**：报告里没有漏洞就算通过，有漏洞才失败。
    set +e
    PYTHONUTF8=1 python -m pip_audit --requirement requirements.txt --format json --output "$report_root/pip-audit.json" --progress-spinner off
    audit_status=$?
    set -e
    audit_report="$report_root/pip-audit.json"
    if [[ -f "$audit_report" ]] && ! grep -q '"vulnerabilities": \[\]' "$audit_report"; then
      echo "[verify] Python 依赖审计发现漏洞，详见 $audit_report" >&2
      cat "$audit_report"
      exit 1
    fi
    if [[ $audit_status -ne 0 && ! -f "$audit_report" ]]; then
      echo "[verify] Python 依赖审计没能生成报告（退出码 $audit_status）" >&2
      exit "$audit_status"
    fi
    echo "[verify] Python 依赖审计通过（报告：$audit_report）"
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

[[ "$target" == site || "$target" == all ]] && verify_site
[[ "$target" == server || "$target" == all ]] && verify_server
