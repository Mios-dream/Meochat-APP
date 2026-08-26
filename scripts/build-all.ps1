<#
.SYNOPSIS
    构建包含 lite 内核资产包的 Windows 安装版。
.DESCRIPTION
    自动串联"准备 lite 内核资产包 + electron-builder 打包"两步。
    资产包格式为 moechat-assets-*-win-lite.zip；依赖与大模型由首次运行在线安装。

.PARAMETER KernelSource
    包含 zip 包的后端 dist 目录路径（必填，如 D:\python\MoeChat\dist）。

.EXAMPLE
    # 构建 Windows 安装包
    .\scripts\build-all.ps1 -KernelSource D:\python\MoeChat\dist
#>

param(
    [Parameter(Mandatory = $true)]
    [string]$KernelSource
)

$ErrorActionPreference = "Stop"

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$ProjectRoot = Resolve-Path (Join-Path $ScriptDir "..")
Set-Location -LiteralPath $ProjectRoot

Write-Host "============================================" -ForegroundColor Cyan
Write-Host "  MoeChat 一键构建" -ForegroundColor Cyan
Write-Host "============================================" -ForegroundColor Cyan
Write-Host "KernelSource : $KernelSource"
Write-Host "Assets       : moechat-assets-*-win-lite.zip"
Write-Host ""

# 校验内核 dist 目录存在
if (-not (Test-Path -LiteralPath $KernelSource)) {
    Write-Error "KernelSource 目录不存在: $KernelSource"
    exit 1
}

# [0] 编译前端与主进程
Write-Host "==> [0] 编译前端与主进程 (npm run build)..." -ForegroundColor Yellow
& npm.cmd run build
if ($LASTEXITCODE -ne 0) {
    Write-Error "npm run build 失败（退出码 $LASTEXITCODE）"
    exit 1
}

Write-Host "==> [1/2] 准备内核资产包 (prepare-kernel-assets)..." -ForegroundColor Yellow
& (Join-Path $ScriptDir "prepare-kernel-assets.ps1") -KernelSource $KernelSource
if ($LASTEXITCODE -ne 0) {
    Write-Error "内核资产准备失败（退出码 $LASTEXITCODE）"
    exit 1
}

Write-Host "==> [2/2] electron-builder 打包..." -ForegroundColor Yellow
& (Join-Path $ProjectRoot "node_modules\.bin\electron-builder.cmd") --win
if ($LASTEXITCODE -ne 0) {
    Write-Error "打包失败（退出码 $LASTEXITCODE）"
    exit 1
}

# 汇总产物路径
Write-Host ""
Write-Host "============================================" -ForegroundColor Green
Write-Host "  全部构建完成！产物如下:" -ForegroundColor Green
Write-Host "============================================" -ForegroundColor Green
Write-Host "  $ProjectRoot\dist" -ForegroundColor White
Get-ChildItem -LiteralPath (Join-Path $ProjectRoot "dist") -File -ErrorAction SilentlyContinue |
    Where-Object { $_.Extension -eq ".exe" } |
    ForEach-Object { Write-Host "      - $($_.Name) ($([math]::Round($_.Length / 1MB, 1)) MB)" -ForegroundColor Gray }
Write-Host ""
