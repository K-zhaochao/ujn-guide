#!/usr/bin/env bash
set -euo pipefail

# Deploy only a fully generated release directory. Runtime secrets remain in
# /etc/ujn-guide/pet.env; this script never copies, prints or edits that file.
script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
release_root=""
release_dir=""
service_name="ujn-guide-pet.service"
health_url="http://127.0.0.1:3005/api/health"
readiness_timeout=60
env_file=""
nginx_config=""
nginx_prefix=""
allow_initial=false
dry_run=false
rollback=false

usage() {
  cat <<'EOF'
Usage:
  deploy-release.sh --release-root /srv/ujn-guide --release-dir /srv/ujn-guide/releases/20260811.1 [options]
  deploy-release.sh --rollback --release-root /srv/ujn-guide [options]

Options:
  --service NAME       systemd service name (default: ujn-guide-pet.service)
  --health-url URL     internal health endpoint (default: http://127.0.0.1:3005/api/health)
  --readiness-timeout N  total seconds to wait for each target release (1..600, default: 60)
  --env-file PATH      external production environment file, never copied or printed
  --nginx-config PATH  rendered Nginx virtual-host configuration to cross-check
  --nginx-prefix PATH  actual Nginx prefix for relative includes (if any)
  --allow-initial      explicitly allow the first release with no rollback target
  --dry-run            verify inputs and show the planned switch without changing anything
EOF
}

fail() { printf '%s\n' "[release] $*" >&2; exit 1; }
info() { printf '%s\n' "[release] $*"; }

while [[ $# -gt 0 ]]; do
  case "$1" in
    --release-root) release_root="${2:-}"; shift 2 ;;
    --release-dir) release_dir="${2:-}"; shift 2 ;;
    --service) service_name="${2:-}"; shift 2 ;;
    --health-url) health_url="${2:-}"; shift 2 ;;
    --readiness-timeout) readiness_timeout="${2:-}"; shift 2 ;;
    --env-file) env_file="${2:-}"; shift 2 ;;
    --nginx-config) nginx_config="${2:-}"; shift 2 ;;
    --nginx-prefix) nginx_prefix="${2:-}"; shift 2 ;;
    --allow-initial) allow_initial=true; shift ;;
    --dry-run) dry_run=true; shift ;;
    --rollback) rollback=true; shift ;;
    -h|--help) usage; exit 0 ;;
    *) usage >&2; fail "未知参数：$1" ;;
  esac
done

[[ -n "$release_root" ]] || fail "必须指定 --release-root"
[[ "$readiness_timeout" =~ ^[1-9][0-9]{0,2}$ ]] && (( readiness_timeout <= 600 )) || fail "readiness-timeout 必须是 1 到 600 的整数秒"
[[ -n "$env_file" && -f "$env_file" ]] || fail "必须指定存在的 --env-file"
[[ -n "$nginx_config" && -f "$nginx_config" ]] || fail "必须指定存在的 --nginx-config"
[[ -d "$release_root/releases" ]] || fail "release 根目录中缺少 releases/：$release_root"
release_root="$(realpath "$release_root")"
releases_dir="$(realpath "$release_root/releases")"
current_link="$release_root/current"
previous_link="$release_root/previous"
for release_link in "$current_link" "$previous_link"; do
  [[ ! -e "$release_link" || -L "$release_link" ]] || fail "发布链接位置存在非符号链接，拒绝覆盖：$release_link"
done

inside_releases() {
  local candidate="$1"
  [[ "$candidate" == "$releases_dir/"* ]] && [[ "$(dirname "$candidate")" == "$releases_dir" ]]
}

resolved_link_target() {
  local link="$1"
  [[ -L "$link" ]] || return 1
  realpath "$link"
}

swap_current() {
  local target="$1"
  local staged="$current_link.next.$$"
  ln -s "$target" "$staged"
  mv -Tf "$staged" "$current_link"
}

swap_previous() {
  local target="$1"
  local staged="$previous_link.next.$$"
  ln -s "$target" "$staged"
  mv -Tf "$staged" "$previous_link"
}

verify_release() {
  local target="$1"
  node "$script_dir/release-manifest.js" --verify --release-dir "$target"
}

verify_config_contract() {
  local target="$1"
  local args=(--server-dir "$target/server" --env-file "$env_file" --nginx-config "$nginx_config")
  [[ -z "$nginx_prefix" ]] || args+=(--nginx-prefix "$nginx_prefix")
  node "$script_dir/validate-production-config.js" "${args[@]}"
}

verify_running_health() {
  local target="$1"
  local deadline=$((SECONDS + readiness_timeout))
  local remaining attempt_timeout
  info "等待 $(basename "$target") 就绪（最多 ${readiness_timeout}s）"
  while (( SECONDS < deadline )); do
    remaining=$((deadline - SECONDS))
    attempt_timeout=$remaining
    (( attempt_timeout <= 15 )) || attempt_timeout=15
    # Connection refusal, malformed responses and mixed release metadata are
    # retryable only inside this bounded window, including during rollback.
    if curl --fail --silent --max-time "$attempt_timeout" "$health_url" \
      | node "$script_dir/verify-running-release.js" "$target" >/dev/null 2>&1; then
      return 0
    fi
    (( SECONDS < deadline )) || break
    sleep 1
  done
  info "目标 release 在等待窗口内未通过 health/摘要校验"
  return 1
}

stop_service() {
  if ! systemctl stop "$service_name"; then
    info "无法停止候选服务；保持现场，需人工处置"
    return 1
  fi
  local state
  state="$(systemctl show "$service_name" --property=ActiveState --value)" || return 1
  [[ "$state" == inactive || "$state" == failed ]] || { info "服务尚未停止，需人工处置"; return 1; }
}

recover_release() {
  local target="$1"
  stop_service || return 1
  swap_current "$target" || return 1
  if systemctl restart "$service_name" && verify_running_health "$target"; then
    info "原 release 已重新启动且通过摘要校验"
    return 0
  fi
  info "恢复原 release 失败；停止服务并保持维护，需人工处置"
  stop_service || return 1
  return 1
}

if [[ "$rollback" == true ]]; then
  [[ -z "$release_dir" ]] || fail "回滚时不要同时传入 --release-dir"
  previous_target="$(resolved_link_target "$previous_link")" || fail "不存在可回滚的 previous release"
  current_target="$(resolved_link_target "$current_link")" || fail "current release 不存在"
  inside_releases "$previous_target" || fail "previous 指向 releases/ 外部，拒绝操作"
  inside_releases "$current_target" || fail "current 指向 releases/ 外部，拒绝操作"
  verify_release "$previous_target"
  verify_release "$current_target"
  verify_config_contract "$previous_target"
  verify_config_contract "$current_target"
  if [[ "$dry_run" == true ]]; then
    info "dry-run: 将 current 从 $current_target 切换到 $previous_target"
    exit 0
  fi
  swap_current "$previous_target"
  if ! systemctl restart "$service_name" || ! verify_running_health "$previous_target"; then
    info "回滚目标 health 失败，恢复原 current"
    if recover_release "$current_target"; then exit 1; else exit 2; fi
  fi
  swap_previous "$current_target"
  info "已回滚到 $(basename "$previous_target")"
  exit 0
fi

[[ -n "$release_dir" ]] || fail "部署时必须指定 --release-dir"
candidate="$(realpath "$release_dir")"
inside_releases "$candidate" || fail "release 必须是 $releases_dir 的直接子目录"
verify_release "$candidate"
verify_config_contract "$candidate"

if [[ "$dry_run" == true ]]; then
  info "dry-run: 将验证并安装依赖，然后切换 current 到 $candidate"
  exit 0
fi

# Dependency installation happens before any traffic switch. node_modules is not
# covered by the source digest, but npm ci verifies package-lock integrity.
npm --prefix "$candidate/server" ci --omit=dev

old_target=""
if old_target="$(resolved_link_target "$current_link")"; then
  inside_releases "$old_target" || fail "current 指向 releases/ 外部，拒绝操作"
  verify_release "$old_target"
  verify_config_contract "$old_target"
else
  [[ "$allow_initial" == true ]] || fail "首次发布没有回滚目标，必须显式传入 --allow-initial"
  [[ ! -e "$current_link" && ! -L "$current_link" && ! -e "$previous_link" && ! -L "$previous_link" ]] || fail "发布链接状态不完整，不能作为首次发布覆盖"
fi

swap_current "$candidate"
if ! systemctl restart "$service_name" || ! verify_running_health "$candidate"; then
  if [[ -n "$old_target" ]]; then
    info "新 release health 失败，正在恢复旧 release"
    if recover_release "$old_target"; then exit 1; else exit 2; fi
  else
    # Do not remove the only pointer to a still-running failed candidate.
    stop_service || exit 2
    rm -f -- "$current_link"
    info "首次发布失败，候选服务已停止；保留 release 与外部数据供排查"
  fi
  exit 1
fi

if [[ -n "$old_target" ]]; then
  swap_previous "$old_target"
fi
info "发布完成：$(basename "$candidate")"
