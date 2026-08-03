<#
.SYNOPSIS
    一键构建 Linux 全部发布变体（lite / cpu / cuda）
.DESCRIPTION
    自动串联"准备内核资产包 + electron-builder 打包"两步，产出 Linux 平台的各变体产物，
    与 build-all.ps1（Windows）对应。产物统一走 Linux 平台分支：
    - lite：moechat-assets-*-linux-lite.zip，产物为 AppImage + deb 安装包。
    - cpu：moechat-assets-*-linux-cpu.zip（linux wheels）+ 数据包，产物为 zip 归档，离线可用。
    - cuda：moechat-assets-*-linux-cu130.zip（linux CUDA wheels）+ 数据包，产物为 zip 归档。

    前置要求：
    - 本脚本应在 Linux 本机（或 Linux CI）上运行，确保原生模块（node-pty/robotjs/uiohook/koffi）
      按 Linux 平台编译，后端资产包也需由 build-asset-bundle.ps1 -Platform linux 产出。
    - 依赖 python-runtime 中已放置 Linux 版 uv（uv 二进制，非 uv.exe），
      可由 build-python-runtime.ps1 -Platform linux 准备。

    变体选取规则：
    - 未指定任何开关（-Lite / -Cpu / -Cuda）时，默认构建全部三个变体；
    - 指定了任意开关时，仅构建所指定的变体（可选组合）。

.PARAMETER KernelSource
    包含 zip 包的后端 dist 目录路径（必填，如 D:\python\MoeChat\dist）。
    未提供时 PowerShell 会交互式提示输入。
.PARAMETER Lite
    是否构建精简版（AppImage + deb）。
.PARAMETER Cpu
    是否构建 cpu 版（zip 压缩包，离线可用）。
.PARAMETER Cuda
    是否构建 cuda 版（zip 压缩包，离线可用）。

.EXAMPLE
    # 一键构建全部三个变体（Linux）
    pwsh .\scripts\build-all-linux.ps1 -KernelSource D:\python\MoeChat\dist
.EXAMPLE
    # 仅构建 cpu 与 cuda（跳过 lite）
    pwsh .\scripts\build-all-linux.ps1 -KernelSource D:\python\MoeChat\dist -Cpu -Cuda
#>

param(
    [Parameter(Mandatory = $true)]
    [string]$KernelSource,
    [switch]$Lite,
    [switch]$Cpu,
    [switch]$Cuda
)

$ErrorActionPreference = "Stop"

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$ProjectRoot = Resolve-Path (Join-Path $ScriptDir "..")
Set-Location -LiteralPath $ProjectRoot

# 解析本次要构建的变体：未指定任何开关时默认全部，否则仅构建显式指定的组合
$selected = @()
if ($Lite) { $selected += "lite" }
if ($Cpu) { $selected += "cpu" }
if ($Cuda) { $selected += "cuda" }
if ($selected.Count -eq 0) {
    $selected = @("lite", "cpu", "cuda")
}

Write-Host "============================================" -ForegroundColor Cyan
Write-Host "  MoeChat 一键构建 (Linux)" -ForegroundColor Cyan
Write-Host "============================================" -ForegroundColor Cyan
Write-Host "KernelSource : $KernelSource"
Write-Host "Variants     : $($selected -join ', ')"
Write-Host "Platform     : linux"
Write-Host ""

# 校验内核 dist 目录存在
if (-not (Test-Path -LiteralPath $KernelSource)) {
    Write-Error "KernelSource 目录不存在: $KernelSource"
    exit 1
}

# [0] 编译一次（typecheck + electron-vite build），三个变体共享同一份 out/ 产物
Write-Host "==> [0] 编译前端与主进程 (npm run build)..." -ForegroundColor Yellow
& npm run build
if ($LASTEXITCODE -ne 0) {
    Write-Error "npm run build 失败（退出码 $LASTEXITCODE）"
    exit 1
}

foreach ($variant in $selected) {
    Write-Host ""
    Write-Host "========== 构建变体: $variant ==========" -ForegroundColor Cyan

    # [1] 准备该变体对应的内核资产包（自动写入 resources/kernel-assets）
    #     变体与 prepare-kernel-assets.ps1 参数的映射（附加 -Platform linux 匹配 linux 资产包）：
    #       lite → -Lite -Platform linux；cpu → -Variant cpu -IncludeData -Platform linux；
    #       cuda → -Variant cu130 -IncludeData -Platform linux
    $prepareArgs = switch ($variant) {
        "lite" { @{ Lite = $true; Platform = "linux" } }
        "cpu"  { @{ Variant = "cpu"; IncludeData = $true; Platform = "linux" } }
        "cuda" { @{ Variant = "cu130"; IncludeData = $true; Platform = "linux" } }
    }
    Write-Host "==> [1/2] 准备内核资产包 (prepare-kernel-assets)..." -ForegroundColor Yellow
    try {
        & (Join-Path $ScriptDir "prepare-kernel-assets.ps1") -KernelSource $KernelSource @prepareArgs
    } catch {
        Write-Error "变体 [$variant] 内核资产准备失败：$_"
        exit 1
    }
    if ($LASTEXITCODE -ne 0) {
        Write-Error "变体 [$variant] 内核资产准备失败（退出码 $LASTEXITCODE）"
        exit 1
    }

    # [2] 以对应变体身份打包（electron-builder 读取 MOECHAT_VARIANT 区分产物）
    Write-Host "==> [2/2] electron-builder 打包 (--linux)..." -ForegroundColor Yellow
    $env:MOECHAT_VARIANT = $variant
    & (Join-Path $ProjectRoot "node_modules\.bin\electron-builder") --linux
    if ($LASTEXITCODE -ne 0) {
        Write-Error "变体 [$variant] 打包失败（退出码 $LASTEXITCODE）"
        exit 1
    }
    Write-Host "变体 [$variant] 构建完成。" -ForegroundColor Green
}

# 清理环境变量，避免影响后续调用
Remove-Item Env:\MOECHAT_VARIANT -ErrorAction SilentlyContinue

# 汇总产物路径
Write-Host ""
Write-Host "============================================" -ForegroundColor Green
Write-Host "  全部构建完成！产物如下:" -ForegroundColor Green
Write-Host "============================================" -ForegroundColor Green
foreach ($variant in $selected) {
    $outDir = Join-Path $ProjectRoot "dist\$variant"
    Write-Host "  [$variant] $outDir" -ForegroundColor White
    if (Test-Path -LiteralPath $outDir) {
        Get-ChildItem -LiteralPath $outDir -File -ErrorAction SilentlyContinue |
            Where-Object { $_.Extension -in ".AppImage", ".deb", ".zip" } |
            ForEach-Object { Write-Host "      - $($_.Name) ($([math]::Round($_.Length / 1MB, 1)) MB)" -ForegroundColor Gray }
    }
}
Write-Host ""
