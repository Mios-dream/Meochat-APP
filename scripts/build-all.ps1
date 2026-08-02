<#
.SYNOPSIS
    一键构建 Windows 全部发布变体（lite / cpu / cuda）
.DESCRIPTION
    自动串联"准备内核资产包 + electron-builder 打包"两步，一条命令即可产出所需变体的安装包，
    无需再手动逐个执行 prepare-kernel-assets.ps1 与 build:win:*。

    三种变体（与后端 build-asset-bundle.ps1 的产物一一对应）：
    - lite：精简版（moechat-assets-*-lite.zip，无 wheels/数据），NSIS 安装包，
      依赖与模型由首次运行在线安装，体积 < 2GB，适用于 GitHub Release。
    - cpu：CPU wheels（moechat-assets-*-cpu.zip）+ 数据包，zip 压缩包，离线可用。
    - cuda：CUDA 12.13 wheels（moechat-assets-*-cu130.zip）+ 数据包，zip 压缩包，离线可用。

    变体选取规则：
    - 未指定任何开关（-Lite / -Cpu / -Cuda）时，默认构建全部三个变体；
    - 指定了任意开关时，仅构建所指定的变体（可选组合）。

.PARAMETER KernelSource
    包含 zip 包的后端 dist 目录路径（必填，如 D:\python\MoeChat\dist）。
    未提供时 PowerShell 会交互式提示输入。

.PARAMETER Lite
    是否构建精简版（NSIS 安装包）。
.PARAMETER Cpu
    是否构建 cpu 版（zip 压缩包，离线可用）。
.PARAMETER Cuda
    是否构建 cuda 版（zip 压缩包，离线可用）。

.EXAMPLE
    # 一键构建全部三个变体
    .\scripts\build-all.ps1 -KernelSource D:\python\MoeChat\dist
.EXAMPLE
    # 仅构建 cpu 与 cuda（跳过 lite）
    .\scripts\build-all.ps1 -KernelSource D:\python\MoeChat\dist -Cpu -Cuda
.EXAMPLE
    # 省略 -KernelSource 时 PowerShell 会交互式提示输入后端 dist 目录
    .\scripts\build-all.ps1
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
Write-Host "  MoeChat 一键构建" -ForegroundColor Cyan
Write-Host "============================================" -ForegroundColor Cyan
Write-Host "KernelSource : $KernelSource"
Write-Host "Variants     : $($selected -join ', ')"
Write-Host ""

# 校验内核 dist 目录存在
if (-not (Test-Path -LiteralPath $KernelSource)) {
    Write-Error "KernelSource 目录不存在: $KernelSource"
    exit 1
}

# [0] 编译一次（typecheck + electron-vite build），三个变体共享同一份 out/ 产物
Write-Host "==> [0] 编译前端与主进程 (npm run build)..." -ForegroundColor Yellow
& npm.cmd run build
if ($LASTEXITCODE -ne 0) {
    Write-Error "npm run build 失败（退出码 $LASTEXITCODE）"
    exit 1
}

foreach ($variant in $selected) {
    Write-Host ""
    Write-Host "========== 构建变体: $variant ==========" -ForegroundColor Cyan

    # [1] 准备该变体对应的内核资产包（自动写入 resources/kernel-assets）
    #     变体与 prepare-kernel-assets.ps1 参数的映射：
    #       lite → -Lite；cpu → -Variant cpu -IncludeData；cuda → -Variant cu130 -IncludeData
    #     注意：必须使用哈希表 splatting（@{}），switch 产出的数组/标量会被拆散成
    #     位置参数逐个字符传入，导致"找不到接受实际参数"的绑定错误。
    $prepareArgs = switch ($variant) {
        "lite" { @{ Lite = $true } }
        "cpu"  { @{ Variant = "cpu"; IncludeData = $true } }
        "cuda" { @{ Variant = "cu130"; IncludeData = $true } }
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
    Write-Host "==> [2/2] electron-builder 打包..." -ForegroundColor Yellow
    $env:MOECHAT_VARIANT = $variant
    & (Join-Path $ProjectRoot "node_modules\.bin\electron-builder.cmd") --win
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
            Where-Object { $_.Extension -in ".exe", ".zip" } |
            ForEach-Object { Write-Host "      - $($_.Name) ($([math]::Round($_.Length / 1MB, 1)) MB)" -ForegroundColor Gray }
    }
}
Write-Host ""
