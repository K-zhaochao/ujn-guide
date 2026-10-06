#!/usr/bin/env bash
# macOS 双击入口：Finder 里的 .command 文件双击即执行。
# 真正的逻辑在 install.sh（这份只是入口，顺便处理"双击后窗口立刻关掉"的问题）。
cd "$(dirname "$0")" || exit 1
bash ./install.sh "$@"
status=$?
if [ $status -ne 0 ]; then
  printf '\n安装出错（退出码 %s），把上面的信息截图反馈即可。\n' "$status"
  printf '按回车关闭…'
  read -r _
fi
exit $status
