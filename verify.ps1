#!/usr/bin/env pwsh
[CmdletBinding()]
param(
    [ValidateSet("site", "server", "all")]
    [string]$Target = "all",
    [switch]$SkipInstall,
    [switch]$SkipAudit
)

$ErrorActionPreference = "Stop"
# Native tools can legitimately write progress and warnings to stderr. Their exit
# code remains the verification contract, so do not turn those streams into throws.
if ($PSVersionTable.PSVersion.Major -ge 7) { $PSNativeCommandUseErrorActionPreference = $false }
$ProjectRoot = Split-Path -Parent $MyInvocation.MyCommand.Path

function Invoke-CheckedCommand {
    param(
        [string]$Label,
        [scriptblock]$Command
    )

    Write-Host "[verify] $Label" -ForegroundColor Cyan
    $previousErrorActionPreference = $ErrorActionPreference
    try {
        $ErrorActionPreference = "Continue"
        & $Command
        $exitCode = $LASTEXITCODE
    }
    finally {
        $ErrorActionPreference = $previousErrorActionPreference
    }
    if ($exitCode -ne 0) {
        throw "$Label failed with exit code $exitCode."
    }
}

function Invoke-NpmCommand {
    param(
        [string]$Label,
        [string]$LogFile,
        [string[]]$Arguments
    )

    Write-Host "[verify] $Label" -ForegroundColor Cyan
    if ($env:OS -eq "Windows_NT") {
        $commandLine = "npm.cmd $($Arguments -join ' ') > `"$LogFile`" 2>&1"
        & $env:ComSpec /d /s /c $commandLine
    }
    else {
        & npm @Arguments *> $LogFile
    }
    $exitCode = $LASTEXITCODE
    Get-Content -Path $LogFile
    if ($exitCode -ne 0) {
        throw "$Label failed with exit code $exitCode."
    }
}

function Invoke-SiteVerification {
    Push-Location $ProjectRoot
    try {
        $reportRoot = Join-Path $ProjectRoot "reports/site"
        New-Item -ItemType Directory -Force -Path $reportRoot | Out-Null

        if (-not $SkipInstall) {
            Invoke-NpmCommand "install site Node dependencies" (Join-Path $reportRoot "npm-install.log") @("ci")
            Invoke-CheckedCommand "install site Python dependencies" { python -m pip install -r requirements.txt "pip-audit==2.10.1" }
        }

        Invoke-NpmCommand "run site build unit tests" (Join-Path $reportRoot "unit-tests.log") @("run", "test:build")
        Invoke-NpmCommand "run local site proxy unit tests" (Join-Path $reportRoot "local-proxy-tests.log") @("run", "test:dev")
        Invoke-NpmCommand "run frontend unit tests" (Join-Path $reportRoot "frontend-unit-tests.log") @("run", "test:frontend")
        # server/ 是私有后端（在 .gitignore 里），公开仓库不含它；release 工具测试依赖
        # server/upload-policy.js，缺了必然 MODULE_NOT_FOUND。有就照常跑，没有就跳过。
        if (Test-Path -LiteralPath (Join-Path $ProjectRoot "server/upload-policy.js")) { Invoke-NpmCommand "run release tool unit tests" (Join-Path $reportRoot "release-tool-tests.log") @("run", "test:release") } else { Write-Host "[verify] skip release tool unit tests (server/ not present)" -ForegroundColor Yellow }
        Invoke-NpmCommand "run strict site build" (Join-Path $reportRoot "build.log") @("run", "build")

        if (-not $SkipAudit) {
            Invoke-NpmCommand "audit site Node dependencies" (Join-Path $reportRoot "npm-audit.json") @("audit", "--omit=dev", "--audit-level=high", "--json")

            Invoke-CheckedCommand "audit site Python dependencies" {
                # pip-audit 自己的退出码在 CI 上不可靠（报告无漏洞却返回非 0），
                # 判据交给 check_pip_audit.py 解析报告：任一依赖的 vulns 非空才算失败。
                $auditReport = Join-Path $reportRoot "pip-audit.json"
                python -X utf8 -m pip_audit --requirement requirements.txt --format json --output $auditReport --progress-spinner off
                if ($LASTEXITCODE -ne 0) {
                    Write-Host "[verify] pip-audit 退出码 $LASTEXITCODE，以报告内容为准" -ForegroundColor Yellow
                }
                $env:PYTHONUTF8 = "1"
                python scripts/security/check_pip_audit.py $auditReport
            }
        }
    }
    finally {
        Pop-Location
    }
}

function Invoke-ServerVerification {
    $serverScript = Join-Path $ProjectRoot "server\verify.ps1"
    if (-not (Test-Path -LiteralPath $serverScript)) {
        throw "The independent server repository is required for Target=server or Target=all."
    }

    $arguments = @{}
    if ($SkipInstall) { $arguments.SkipInstall = $true }
    if ($SkipAudit) { $arguments.SkipAudit = $true }
    Invoke-CheckedCommand "run server verification" { & $serverScript @arguments }
}

if ($Target -eq "site" -or $Target -eq "all") { Invoke-SiteVerification }
if ($Target -eq "server" -or $Target -eq "all") { Invoke-ServerVerification }
