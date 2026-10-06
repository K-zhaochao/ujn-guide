#Requires -Version 5.1
<#
  济大教务 · 成绩导出 —— Windows 安装器
  ==========================================================
  双击 install.cmd 运行即可。它会：
    1. 让你选择安装位置（默认 %LOCALAPPDATA%\UJN\grade-export）
    2. 检查有没有 Node；没有就自动从国内镜像下载一份，解压到安装目录里的 runtime\
       —— 免管理员、不写注册表、不改系统 PATH
    3. 取回导出程序（优先从本站下载最新版）
    4. 生成启动器，并问你**要不要在桌面建快捷方式**
  卸载：直接删掉安装目录和桌面快捷方式即可，不留任何其他痕迹。

  无人值守用法（自动安装，用于测试/批量）：
    powershell -ExecutionPolicy Bypass -File install.ps1 -Yes -InstallDir D:\ujn -NoDesktopShortcut
#>
[CmdletBinding()]
param(
  [string]$InstallDir,
  [string]$NodeVersion = 'v22.23.2',
  [switch]$NoDesktopShortcut,
  [switch]$SkipRuntime,
  [switch]$Yes
)

$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'   # 让 Invoke-WebRequest 快很多
$Mirror = 'https://npmmirror.com/mirrors/node'
$CliUrl = 'https://ujn.matehub.top/assets/tools/jwgl-export.mjs'
$AppName = '济大成绩导出'

function Say($text, $color = 'Gray') { Write-Host $text -ForegroundColor $color }
function Ok($text) { Write-Host "  [√] $text" -ForegroundColor Green }
function Warn($text) { Write-Host "  [!] $text" -ForegroundColor Yellow }
function Die($text) { Write-Host "  [×] $text" -ForegroundColor Red; exit 1 }

function Ask($prompt, $default) {
  if ($Yes) { return $default }
  $answer = Read-Host "$prompt" + " [$default]"
  if ([string]::IsNullOrWhiteSpace($answer)) { return $default }
  return $answer.Trim()
}

function AskYesNo($prompt, $defaultYes) {
  if ($Yes) { return $defaultYes }
  $hint = if ($defaultYes) { 'Y/n' } else { 'y/N' }
  $answer = Read-Host "$prompt [$hint]"
  if ([string]::IsNullOrWhiteSpace($answer)) { return $defaultYes }
  return $answer.Trim().ToLower().StartsWith('y')
}

# ==================== 开场 ====================
Clear-Host
Say ''
Say '  ┌──────────────────────────────────────────────┐' Cyan
Say '  │   济大教务 · 成绩导出   安装程序（Windows）  │' Cyan
Say '  └──────────────────────────────────────────────┘' Cyan
Say ''
Say '  这是「本地全自动」版本：在你自己电脑上完成登录与导出。' 
Say '  账号密码只在本机内存里用一次，不写入磁盘、不发给任何第三方。'
Say '  全程免管理员权限，不改系统 PATH，卸载就是删目录。'
Say ''
Say '  参考实现来自一位不愿意透露信息的学长提供的说明文档。' DarkGray
Say ''

# ==================== 1. 安装位置 ====================
$defaultDir = Join-Path $env:LOCALAPPDATA 'UJN\grade-export'
if (-not $InstallDir) {
  Say '  [1/4] 选择安装位置' White
  Say "        直接回车使用默认位置：$defaultDir" DarkGray
  $InstallDir = Ask '        安装到' $defaultDir
}
$InstallDir = [System.IO.Path]::GetFullPath($InstallDir)
try {
  New-Item -ItemType Directory -Force -Path $InstallDir | Out-Null
} catch {
  Die "无法创建目录 $InstallDir（$($_.Exception.Message)）"
}
Ok "安装位置：$InstallDir"
Say ''

# ==================== 2. Node 运行时 ====================
Say '  [2/4] 检查 Node 运行环境' White
$nodeExe = $null
$systemNode = Get-Command node -ErrorAction SilentlyContinue
if ($systemNode) {
  $version = (& $systemNode.Source --version) 2>$null
  $major = 0
  if ($version -match '^v(\d+)') { $major = [int]$Matches[1] }
  if ($major -ge 18) {
    $nodeExe = $systemNode.Source
    Ok "已检测到 Node $version，直接使用（不重复下载）"
  } else {
    Warn "系统里的 Node 是 $version，太旧（需要 18 以上），将安装自带运行时"
  }
}

if (-not $nodeExe) {
  if ($SkipRuntime) { Die '没有可用的 Node，且指定了 -SkipRuntime' }
  $arch = switch -Wildcard ($env:PROCESSOR_ARCHITECTURE) {
    'ARM64' { 'arm64' }
    default { 'x64' }
  }
  $zipName = "node-$NodeVersion-win-$arch.zip"
  $url = "$Mirror/$NodeVersion/$zipName"
  $zipPath = Join-Path $env:TEMP $zipName
  $runtimeDir = Join-Path $InstallDir 'runtime'

  Say "        正在从国内镜像下载 Node（约 34 MB，只需一次）…" DarkGray
  Say "        $url" DarkGray
  try {
    Invoke-WebRequest -Uri $url -OutFile $zipPath -UseBasicParsing
  } catch {
    Die "下载失败：$($_.Exception.Message)`n        可以改用已经装好 Node 的电脑，或稍后重试。"
  }
  Ok ("下载完成：{0:N1} MB" -f ((Get-Item $zipPath).Length / 1MB))

  Say '        正在解压…' DarkGray
  if (Test-Path $runtimeDir) { Remove-Item $runtimeDir -Recurse -Force }
  Expand-Archive -Path $zipPath -DestinationPath $runtimeDir -Force
  Remove-Item $zipPath -Force -ErrorAction SilentlyContinue

  $nodeExe = Get-ChildItem -Path $runtimeDir -Filter node.exe -Recurse |
    Select-Object -First 1 -ExpandProperty FullName
  if (-not $nodeExe) { Die '解压后没找到 node.exe，安装中断' }
  Ok "自带运行时已就绪：$nodeExe"
}
Say ''

# ==================== 3. 导出程序 ====================
Say '  [3/4] 安装导出程序' White
$cliPath = Join-Path $InstallDir 'jwgl-export.mjs'
$localCopy = Join-Path $PSScriptRoot 'jwgl-export.mjs'   # 安装器旁边若已有，就离线用
$got = $false
try {
  Invoke-WebRequest -Uri $CliUrl -OutFile $cliPath -UseBasicParsing
  Ok '已从本站获取最新版导出程序'
  $got = $true
} catch {
  Warn "从本站下载失败（$($_.Exception.Message)）"
}
if (-not $got) {
  if (Test-Path $localCopy) {
    Copy-Item $localCopy $cliPath -Force
    Ok '已使用安装包内的导出程序'
  } else {
    Die '拿不到导出程序：请检查网络，或把 jwgl-export.mjs 放到安装器同目录后重试'
  }
}

# 启动器：双击即可运行（用绝对路径指向自带的 node，不依赖 PATH）
# 内容保持纯 ASCII 并用 ASCII 编码写出：带 BOM 的 .cmd 会让 cmd.exe 报错，
# 中文一律交给 Node 程序自己输出（启动器里那句 chcp 65001 就是为此）。
$launcher = Join-Path $InstallDir 'UJN-Grade-Export.cmd'
@"
@echo off
chcp 65001 >nul
title UJN Grade Export
"$nodeExe" "$cliPath" %*
if errorlevel 1 pause
"@ | Set-Content -Path $launcher -Encoding ASCII
Ok "启动器已生成：$launcher"
Say ''

# ==================== 4. 桌面快捷方式 ====================
Say '  [4/4] 桌面快捷方式' White
$wantShortcut = -not $NoDesktopShortcut
if (-not $NoDesktopShortcut -and -not $Yes) {
  $wantShortcut = AskYesNo '        要在桌面创建一个快捷方式吗？' $true
}
if ($wantShortcut) {
  $desktop = [Environment]::GetFolderPath('Desktop')
  $linkPath = Join-Path $desktop "$AppName.lnk"
  try {
    $shell = New-Object -ComObject WScript.Shell
    $shortcut = $shell.CreateShortcut($linkPath)
    $shortcut.TargetPath = $launcher
    $shortcut.WorkingDirectory = $InstallDir
    $shortcut.Description = '一键导出本人教务成绩（本地运行，不上传任何数据）'
    $shortcut.IconLocation = "$nodeExe,0"
    $shortcut.Save()
    Ok "桌面快捷方式已创建：$linkPath"
  } catch {
    Warn "创建快捷方式失败（$($_.Exception.Message)），可以手动把启动器拖到桌面"
  }
} else {
  Say '        已跳过桌面快捷方式' DarkGray
}

Say ''
Say '  ──────────────────────────────────────────────' DarkGray
Say '   安装完成！' Green
Say ''
Say "   以后双击桌面的「$AppName」，或在 $InstallDir 里双击启动器即可。" 
Say '   第一次运行会依次问你：学号 → 密码（输入时不显示）→ 学期。'
Say ''
Say '   卸载：删掉安装目录和那个快捷方式就行。' DarkGray
Say ''
if (-not $Yes) { Read-Host '   按回车关闭' | Out-Null }
