@echo off
rem 济大教务 · 成绩导出 —— Windows 双击入口
rem 双击本文件即可开始安装；这里只是用 Bypass 打开 PowerShell 脚本，
rem 免得用户被「禁止运行脚本」的执行策略挡住。
chcp 65001 >nul
setlocal
set "PS=powershell"
where pwsh >nul 2>nul && set "PS=pwsh"
"%PS%" -NoProfile -ExecutionPolicy Bypass -File "%~dp0install.ps1" %*
if errorlevel 1 (
  echo.
  echo 安装过程中出错，请把上面的信息截图反馈。
  pause
)
endlocal
