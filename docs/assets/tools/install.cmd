@echo off
rem ============================================================
rem  UJN Grade Export - Windows double-click entry
rem
rem  IMPORTANT: keep this whole file ASCII-only (comments included)
rem  and save it WITHOUT a BOM.
rem  cmd.exe parses .cmd line by line using the system OEM code page.
rem  If Chinese text or box-drawing characters appear anywhere - even in
rem  a "rem" comment - the bytes get mangled and cmd tries to execute the
rem  remains as commands. Bit us three times; all Chinese output is printed
rem  by install.ps1 instead, which has a UTF-8 BOM and is read correctly.
rem
rem  Three guarantees so a double-click always shows something:
rem    1) find a usable PowerShell (prefer pwsh)
rem    2) fetch install.ps1 automatically when it is missing
rem    3) always keep the window open, success or failure
rem ============================================================
chcp 65001 >nul
setlocal EnableExtensions

set "SITE=https://ujn.matehub.top"
if defined UJN_BASE_URL set "SITE=%UJN_BASE_URL%"
set "PS1=%~dp0install.ps1"

echo.
echo   UJN Grade Export - installer (Windows)
echo   -------------------------------------
echo.

set "PS=powershell"
where pwsh >nul 2>nul && set "PS=pwsh"
"%PS%" -NoProfile -Command "exit 0" >nul 2>nul
if errorlevel 1 (
  echo   [x] PowerShell not found on this computer.
  goto :hold
)

if not exist "%PS1%" (
  echo   [i] install.ps1 not found next to this file - downloading from site...
  "%PS%" -NoProfile -ExecutionPolicy Bypass -Command "$ProgressPreference='SilentlyContinue'; try { Invoke-WebRequest -Uri '%SITE%/assets/tools/install.ps1' -OutFile '%PS1%' -UseBasicParsing; exit 0 } catch { Write-Host ('   [x] download failed: ' + $_.Exception.Message); exit 1 }"
  if errorlevel 1 (
    echo        Manual fallback: download both files into the same folder:
    echo          %SITE%/assets/tools/install.cmd
    echo          %SITE%/assets/tools/install.ps1
    goto :hold
  )
  echo   [ok] install.ps1 downloaded
)

"%PS%" -NoProfile -ExecutionPolicy Bypass -File "%PS1%" %*
set "RESULT=%ERRORLEVEL%"
if not "%RESULT%"=="0" (
  echo.
  echo   [x] Installer exited with code %RESULT% - please send a screenshot of the text above.
)

:hold
echo.
echo   Press any key to close this window...
pause >nul
endlocal
