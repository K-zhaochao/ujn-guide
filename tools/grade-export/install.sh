#!/usr/bin/env bash
# 济大教务 · 成绩导出 —— macOS / Linux 安装器
# ==========================================================
#   bash install.sh                 交互式安装
#   bash install.sh --yes --dir ~/ujn-grade --no-shortcut    无人值守
#
# 它会：
#   1. 让你选择安装位置（默认 ~/Applications/ujn-grade-export）
#   2. 检查有没有 Node；没有就从国内镜像下载一份解压到 <安装目录>/runtime
#      —— 不需要 root、不改系统 PATH
#   3. 取回导出程序（优先从本站下载最新版，失败则用同目录里的副本）
#   4. 生成启动器，并问要不要在桌面建快捷方式
# 卸载：删掉安装目录和桌面上的启动器即可。

set -u

MIRROR="https://npmmirror.com/mirrors/node"
NODE_VERSION="v22.23.2"
CLI_URL="https://ujn.matehub.top/assets/tools/jwgl-export.mjs"
APP_NAME="济大成绩导出"

INSTALL_DIR=""
ASSUME_YES=0
NO_SHORTCUT=0
SKIP_RUNTIME=0

while [ $# -gt 0 ]; do
  case "$1" in
    --dir) INSTALL_DIR="$2"; shift 2 ;;
    --yes|-y) ASSUME_YES=1; shift ;;
    --no-shortcut) NO_SHORTCUT=1; shift ;;
    --skip-runtime) SKIP_RUNTIME=1; shift ;;
    *) echo "未知参数：$1"; exit 1 ;;
  esac
done

say()  { printf '%s\n' "$1"; }
ok()   { printf '  [√] %s\n' "$1"; }
warn() { printf '  [!] %s\n' "$1"; }
die()  { printf '  [×] %s\n' "$1"; exit 1; }

ask() { # ask <提示> <默认值>
  if [ "$ASSUME_YES" = "1" ]; then printf '%s' "$2"; return; fi
  printf '%s [%s]: ' "$1" "$2" > /dev/tty
  read -r answer < /dev/tty || answer=""
  [ -n "$answer" ] && printf '%s' "$answer" || printf '%s' "$2"
}

ask_yes_no() { # ask_yes_no <提示> <默认 y|n>
  if [ "$ASSUME_YES" = "1" ]; then printf '%s' "$2"; return; fi
  printf '%s [%s]: ' "$1" "$2" > /dev/tty
  read -r answer < /dev/tty || answer=""
  [ -n "$answer" ] && printf '%s' "$answer" || printf '%s' "$2"
}

say ""
say "  ┌──────────────────────────────────────────────┐"
say "  │   济大教务 · 成绩导出   安装程序（macOS/Linux）│"
say "  └──────────────────────────────────────────────┘"
say ""
say "  这是「本地全自动」版本：在你自己的电脑上完成登录与导出。"
say "  账号密码只在本机内存里用一次，不写入磁盘、不发给任何第三方。"
say "  不需要 root，不改系统 PATH，卸载就是删目录。"
say ""
say "  参考实现来自一位不愿意透露信息的学长提供的说明文档。"
say ""

# ---------- 1. 安装位置 ----------
say "  [1/4] 选择安装位置"
default_dir="$HOME/Applications/ujn-grade-export"
[ -n "$INSTALL_DIR" ] || INSTALL_DIR="$(ask '        安装到' "$default_dir")"
mkdir -p "$INSTALL_DIR" || die "无法创建目录 $INSTALL_DIR"
INSTALL_DIR="$(cd "$INSTALL_DIR" && pwd)"
ok "安装位置：$INSTALL_DIR"
say ""

# ---------- 2. Node 运行时 ----------
say "  [2/4] 检查 Node 运行环境"
NODE_BIN=""
if command -v node > /dev/null 2>&1; then
  version="$(node --version 2>/dev/null || echo v0)"
  major="$(printf '%s' "$version" | sed 's/^v\([0-9]*\).*/\1/')"
  if [ "${major:-0}" -ge 18 ] 2>/dev/null; then
    NODE_BIN="$(command -v node)"
    ok "已检测到 Node $version，直接使用（不重复下载）"
  else
    warn "系统里的 Node 是 $version，太旧（需要 18 以上），将安装自带运行时"
  fi
fi

if [ -z "$NODE_BIN" ]; then
  [ "$SKIP_RUNTIME" = "1" ] && die "没有可用的 Node，且指定了 --skip-runtime"
  os="$(uname -s)"
  arch="$(uname -m)"
  case "$os" in
    Darwin) platform="darwin" ;;
    Linux)  platform="linux" ;;
    *) die "不支持的系统：$os（Windows 请用 install.cmd）" ;;
  esac
  case "$arch" in
    arm64|aarch64) cpu="arm64" ;;
    x86_64|amd64)  cpu="x64" ;;
    *) die "不支持的架构：$arch" ;;
  esac
  if [ "$platform" = "darwin" ]; then
    pkg="node-$NODE_VERSION-$platform-$cpu.tar.gz"
  else
    pkg="node-$NODE_VERSION-$platform-$cpu.tar.xz"
  fi

  say "        正在从国内镜像下载 Node（约 30 MB，只需一次）…"
  say "        $MIRROR/$NODE_VERSION/$pkg"
  tmp="$(mktemp -d)"
  if command -v curl > /dev/null 2>&1; then
    curl -fL --progress-bar "$MIRROR/$NODE_VERSION/$pkg" -o "$tmp/$pkg" || die "下载失败（curl）"
  elif command -v wget > /dev/null 2>&1; then
    wget -q --show-progress "$MIRROR/$NODE_VERSION/$pkg" -O "$tmp/$pkg" || die "下载失败（wget）"
  else
    die "系统里既没有 curl 也没有 wget，请先装一个再运行"
  fi
  ok "下载完成：$(du -h "$tmp/$pkg" | cut -f1)"

  say "        正在解压…"
  rm -rf "$INSTALL_DIR/runtime"
  mkdir -p "$INSTALL_DIR/runtime"
  tar -xf "$tmp/$pkg" -C "$INSTALL_DIR/runtime" || die "解压失败"
  rm -rf "$tmp"
  NODE_BIN="$(find "$INSTALL_DIR/runtime" -type f -name node -perm -u+x | head -n 1)"
  [ -n "$NODE_BIN" ] || die "解压后没找到 node 可执行文件"
  ok "自带运行时已就绪：$NODE_BIN"
fi
say ""

# ---------- 3. 导出程序 ----------
say "  [3/4] 安装导出程序"
cli_path="$INSTALL_DIR/jwgl-export.mjs"
got=""
if command -v curl > /dev/null 2>&1; then
  curl -fsSL "$CLI_URL" -o "$cli_path" && got=1
elif command -v wget > /dev/null 2>&1; then
  wget -q "$CLI_URL" -O "$cli_path" && got=1
fi
if [ -n "$got" ]; then
  ok "已从本站获取最新版导出程序"
else
  warn "从本站下载失败"
  if [ -f "$(dirname "$0")/jwgl-export.mjs" ]; then
    cp "$(dirname "$0")/jwgl-export.mjs" "$cli_path"
    ok "已使用安装包内的导出程序"
  else
    die "拿不到导出程序：请检查网络，或把 jwgl-export.mjs 放到安装器同目录后重试"
  fi
fi

launcher="$INSTALL_DIR/$APP_NAME.command"
cat > "$launcher" <<EOF
#!/usr/bin/env bash
cd "\$(dirname "\$0")"
"$NODE_BIN" "$cli_path" "\$@"
status=\$?
if [ \$status -ne 0 ] && [ -t 0 ]; then
  printf '\n按回车关闭…'
  read -r _
fi
exit \$status
EOF
chmod +x "$launcher"
ok "启动器已生成：$launcher"
say ""

# ---------- 4. 桌面快捷方式 ----------
say "  [4/4] 桌面快捷方式"
want="y"
[ "$NO_SHORTCUT" = "1" ] && want="n"
[ "$NO_SHORTCUT" = "1" ] || want="$(ask_yes_no '        要在桌面创建一个快捷方式吗？' y)"
if [ "$want" = "y" ] || [ "$want" = "Y" ]; then
  desktop="$HOME/Desktop"
  mkdir -p "$desktop"
  # Linux 用 .desktop（可从桌面启动），macOS 直接放一个 .command
  if [ "$(uname -s)" = "Darwin" ]; then
    cp "$launcher" "$desktop/$APP_NAME.command"
    chmod +x "$desktop/$APP_NAME.command"
    ok "桌面快捷方式已创建：$desktop/$APP_NAME.command"
  else
    desktop_file="$desktop/ujn-grade-export.desktop"
    cat > "$desktop_file" <<EOF
[Desktop Entry]
Type=Application
Name=$APP_NAME
Comment=一键导出本人教务成绩（本地运行，不上传任何数据）
Exec="$launcher"
Terminal=true
Categories=Utility;Education;
EOF
    chmod +x "$desktop_file"
    # 同时放进应用菜单，方便从启动器里搜到
    apps_dir="$HOME/.local/share/applications"
    mkdir -p "$apps_dir" && cp "$desktop_file" "$apps_dir/"
    ok "桌面快捷方式已创建：$desktop_file"
  fi
else
  say "        已跳过桌面快捷方式"
fi

say ""
say "  ──────────────────────────────────────────────"
say "   安装完成！"
say ""
say "   以后双击桌面的「$APP_NAME」，或直接运行："
say "     $launcher"
say "   第一次运行会依次问你：学号 → 密码（输入时不显示）→ 学期。"
say ""
say "   卸载：删掉安装目录和那个快捷方式就行。"
say ""
