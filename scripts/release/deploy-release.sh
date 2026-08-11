#!/usr/bin/env bash
set -euo pipefail

# Deploy only a fully generated release directory. Runtime secrets remain in
# /etc/ujn-guide/pet.env; this script never copies, prints or edits that file.
script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
release_root=""
release_dir=""
service_name="ujn-guide-pet.service"
health_url="http://127.0.0.1:3005/api/health"
env_file=""
nginx_config=""
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
  --env-file PATH      external production environment file, never copied or printed
  --nginx-config PATH  rendered Nginx virtual-host configuration to cross-check
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
    --env-file) env_file="${2:-}"; shift 2 ;;
    --nginx-config) nginx_config="${2:-}"; shift 2 ;;
    --allow-initial) allow_initial=true; shift ;;
    --dry-run) dry_run=true; shift ;;
    --rollback) rollback=true; shift ;;
    -h|--help) usage; exit 0 ;;
    *) usage >&2; fail "未知参数：$1" ;;
  esac
done

[[ -n "$release_root" ]] || fail "必须指定 --release-root"
[[ -n "$env_file" && -f "$env_file" ]] || fail "必须指定存在的 --env-file"
[[ -n "$nginx_config" && -f "$nginx_config" ]] || fail "必须指定存在的 --nginx-config"
[[ -d "$release_root/releases" ]] || fail "release 根目录中缺少 releases/：$release_root"
release_root="$(realpath "$release_root")"
releases_dir="$(realpath "$release_root/releases")"
current_link="$release_root/current"
previous_link="$release_root/previous"

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
  node "$script_dir/validate-production-config.js" --env-file "$env_file" --nginx-config "$nginx_config"
}

verify_running_health() {
  local target="$1"
  curl --fail --silent --show-error --max-time 15 "$health_url" | node "$script_dir/verify-running-release.js" "$target"
}

if [[ "$rollback" == true ]]; then
  [[ -z "$release_dir" ]] || fail "回滚时不要同时传入 --release-dir"
  previous_target="$(resolved_link_target "$previous_link")" || fail "不存在可回滚的 previous release"
  current_target="$(resolved_link_target "$current_link")" || fail "current release 不存在"
  inside_releases "$previous_target" || fail "previous 指向 releases/ 外部，拒绝操作"
  inside_releases "$current_target" || fail "current 指向 releases/ 外部，拒绝操作"
  verify_config_contract
  verify_release "$previous_target"
  if [[ "$dry_run" == true ]]; then
    info "dry-run: 将 current 从 $current_target 切换到 $previous_target"
    exit 0
  fi
  swap_current "$previous_target"
  if ! systemctl restart "$service_name" || ! verify_running_health "$previous_target"; then
    info "回滚目标 health 失败，恢复原 current"
    swap_current "$current_target"
    systemctl restart "$service_name" || true
    exit 1
  fi
  swap_previous "$current_target"
  info "已回滚到 $(basename "$previous_target")"
  exit 0
fi

[[ -n "$release_dir" ]] || fail "部署时必须指定 --release-dir"
candidate="$(realpath "$release_dir")"
inside_releases "$candidate" || fail "release 必须是 $releases_dir 的直接子目录"
verify_config_contract
verify_release "$candidate"

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
else
  [[ "$allow_initial" == true ]] || fail "首次发布没有回滚目标，必须显式传入 --allow-initial"
fi

swap_current "$candidate"
if ! systemctl restart "$service_name" || ! verify_running_health "$candidate"; then
  if [[ -n "$old_target" ]]; then
    info "新 release health 失败，正在恢复旧 release"
    swap_current "$old_target"
    systemctl restart "$service_name" || true
    verify_running_health "$old_target" || true
  else
    rm -f -- "$current_link"
  fi
  exit 1
fi

if [[ -n "$old_target" ]]; then
  swap_previous "$old_target"
fi
info "发布完成：$(basename "$candidate")"
