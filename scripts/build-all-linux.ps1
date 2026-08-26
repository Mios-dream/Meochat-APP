<#
.SYNOPSIS
    构建包含 lite 内核资产包的 Linux 安装版。
.DESCRIPTION
    自动串联"准备 lite 内核资产包 + electron-builder 打包"两步。
    资产包格式为 moechat-assets-*-linux-lite.zip；依赖与大模型由首次运行在线安装。

    本脚本应在 Linux 本机或 Linux CI 中运行，以便原生模块按 Linux 平台编译。

.PARAMETER KernelSource
    包含 zip 包的后端 dist 目录路径（必填）。

.EXAMPLE
    pwsh ./scripts/build-all-linux.ps1 -KernelSource /path/to/MoeChat/dist
#>

param(
    [Parameter(Mandatory = $true)]
    [string]$KernelSource
)

$ErrorActionPreference = "Stop"

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$ProjectRoot = Resolve-Path (Join-Path $ScriptDir "..")
Set-Location -LiteralPath $ProjectRoot

if (-not (Test-Path -LiteralPath $KernelSource)) {
    Write-Error "KernelSource 目录不存在: $KernelSource"
    exit 1
}

Write-Host "==> [0] 编译前端与主进程 (npm run build)..." -ForegroundColor Yellow
& npm run build
if ($LASTEXITCODE -ne 0) {
    Write-Error "npm run build 失败（退出码 $LASTEXITCODE）"
    exit 1
}

Write-Host "==> [1/2] 准备内核资产包 (moechat-assets-*-linux-lite.zip)..." -ForegroundColor Yellow
& (Join-Path $ScriptDir "prepare-kernel-assets.ps1") -KernelSource $KernelSource -Platform linux
if ($LASTEXITCODE -ne 0) {
    Write-Error "内核资产准备失败（退出码 $LASTEXITCODE）"
    exit 1
}

Write-Host "==> [2/2] electron-builder 打包 (--linux)..." -ForegroundColor Yellow
& (Join-Path $ProjectRoot "node_modules/.bin/electron-builder") --linux
if ($LASTEXITCODE -ne 0) {
    Write-Error "打包失败（退出码 $LASTEXITCODE）"
    exit 1
}

Write-Host "全部构建完成：$(Join-Path $ProjectRoot 'dist')" -ForegroundColor Green
