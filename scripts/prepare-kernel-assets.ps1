<#
.SYNOPSIS
    预处理 resources/kernel-assets (kernel asset zip packages)
.DESCRIPTION
    复制指定的内核资产zip包（内核源+预构建包，可选数据模型）从后端的dist目录导入
    资源/内核资产，以便电子构建器可以将它们嵌入为
    额外资源。首次运行时，应用程序会将这些包提取到appData中
    （uv sync从车轮构建.vev），实现自举。

    三种资产包形态（由后端 build-asset-bundle.ps1 产出）：
    - 精简版（GitHub Release）：moechat-assets-*-lite.zip（仅源码，无 wheels/数据），
      依赖与模型首次运行时在线安装。用 -Lite 选取。
    - 完整版 CPU/CUDA（云盘）：moechat-assets-*-{cpu|cu130}.zip（源码+wheels）+
      moechat-data-*.zip 数据包；用 -Variant cpu|cu130 + -IncludeData 选取。

.PARAMETER KernelSource
    包含zip包的后端dist目录的路径
    (e.g. D:\python\MoeChat\dist).
.PARAMETER AssetsPackage
    内核资产包文件名（moechat-assets-*.zip）。
    当为空时自动选择最新匹配包。
    支持cpu / cu130 / cuda变体。
.PARAMETER DataPackage
    数据包文件名（数据模型+助手数据）。
    当为空时自动选择最新匹配包。
    仅在指定了-IncludeData时使用。
.PARAMETER Variant
    内核资产包筛选器：cpu | cu130 | cuda。
    cuda 为 cu130（CUDA 12.13 wheels）的别名，二者等价。
    当为空时自动选择最新匹配包。
    与 -Lite 互斥（精简版资产包不带变体后缀）。
.PARAMETER Lite
    精简版模式：仅选取内核源码资产包（moechat-assets-*-lite.zip，无 wheels）。
    依赖与模型由首次运行在线安装。与 -Variant 互斥。
.PARAMETER OutputDir
    输出目录，默认"resources/kernel-assets"。
.PARAMETER IncludeData
    是否包含数据包（模型+智能体）在内（完整模式）。
    当指定了-IncludeData时，会自动选择数据包文件名。
    # 精简版：仅内核源码资产包（moechat-assets-*-lite.zip），依赖与模型在线安装
    .\scripts\prepare-kernel-assets.ps1 -KernelSource D:\python\MoeChat\dist -Lite
.EXAMPLE
    # 完整版 CPU：内核资产包（cpu wheels）+ 数据包，离线可用
    .\scripts\prepare-kernel-assets.ps1 -KernelSource D:\python\MoeChat\dist -Variant cpu -IncludeData
.EXAMPLE
    # 完整版 CUDA：内核资产包（cu130 wheels）+ 数据包
    .\scripts\prepare-kernel-assets.ps1 -KernelSource D:\python\MoeChat\dist -Variant cu130 -IncludeData
#>

param(
    [Parameter(Mandatory = $true)]
    [string]$KernelSource,
    [string]$AssetsPackage = "",
    [string]$DataPackage = "",
    [string]$Variant = "",
    [string]$OutputDir = "resources/kernel-assets",
    [switch]$IncludeData,
    [switch]$Lite
)

$ErrorActionPreference = "Stop"

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$ProjectRoot = Resolve-Path (Join-Path $ScriptDir "..")
Set-Location -LiteralPath $ProjectRoot

<#
.SYNOPSIS
    从 dist 目录中按前缀筛选 zip 包，返回最新版本或精确指定的包。
.DESCRIPTION
    - Exact 非空时精确匹配文件名；
    - VariantFilter 非空时按 "-{variant}.zip" 后缀过滤（如 -cpu / -cu130）；
    - 默认按文件名中的 -vX.Y.Z 版本号倒序取最新。
#>
function Select-Package {
    param(
        [string]$Dir,
        [string]$Prefix,
        [string]$Exact,
        [string]$VariantFilter
    )
    $pattern = "${Prefix}-*.zip"
    $candidates = @(Get-ChildItem -LiteralPath $Dir -Filter $pattern -File -ErrorAction SilentlyContinue)
    if ($candidates.Count -eq 0) {
        return $null
    }
    if ($Exact) {
        return $candidates | Where-Object { $_.Name -eq $Exact } | Select-Object -First 1
    }
    if ($VariantFilter) {
        $escaped = [regex]::Escape($VariantFilter)
        $candidates = $candidates | Where-Object { $_.Name -match "-${escaped}\.zip$" }
        if ($candidates.Count -eq 0) {
            return $null
        }
    }
    # 解析文件名中的版本号（-vX.Y.Z）并倒序取最新
    return $candidates | Sort-Object {
        if ($_.Name -match '-v(\d+(\.\d+)*)') {
            try { [version]$matches[1] } catch { [version]"0.0.0" }
        } else {
            [version]"0.0.0"
        }
    } -Descending | Select-Object -First 1
}

<#
.SYNOPSIS
    将源 zip 同步到输出目录：仅当目标缺失或大小不一致时才复制。
.DESCRIPTION
    支持一键构建 cpu→cuda 等连续变体时复用已就绪的数据包，避免反复拷贝 GB 级大文件。
    以"文件名 + 文件大小"作为一致性判据（包名内嵌版本号，同名同大小即可认为内容一致）。
.PARAMETER Source
    源包文件对象（需带 .Name / .FullName / .Length）。
.PARAMETER DestDir
    目标目录。
.RETURNS
    $true 表示本次发生了复制；$false 表示目标已存在且一致，直接复用。
#>
function Copy-IfChanged {
    param(
        [Parameter(Mandatory = $true)]
        [System.IO.FileInfo]$Source,
        [Parameter(Mandatory = $true)]
        [string]$DestDir
    )
    $dest = Join-Path $DestDir $Source.Name
    if (Test-Path -LiteralPath $dest) {
        $existing = Get-Item -LiteralPath $dest
        if ($existing.Length -eq $Source.Length) {
            # 目标已存在且大小一致，直接复用，跳过拷贝
            return $false
        }
        Write-Host "  文件大小不一致，重新复制: $($Source.Name)" -ForegroundColor DarkYellow
    }
    Copy-Item -LiteralPath $Source.FullName -Destination $dest
    return $true
}

# 校验内核 dist 目录
if (-not (Test-Path -LiteralPath $KernelSource)) {
    Write-Error "KernelSource 目录不存在: $KernelSource"
    exit 1
}

# 规范化变体参数：cuda 为 cu130（CUDA 12.13 wheels 后缀）的别名，二者等价
$Variant = $Variant.ToLower()
if ($Variant -eq "cuda") {
    $Variant = "cu130"
}

# 校验参数：-Lite 与 -Variant 互斥（精简版资产包不带变体后缀）
if ($Lite -and $Variant) {
    Write-Error "参数冲突：-Lite 与 -Variant 不能同时指定（精简版为 moechat-assets-*-lite.zip，无变体后缀）"
    exit 1
}

# 确定资产包筛选器：-Lite 匹配 lite 包；-Variant 匹配 cpu/cu130；否则取最新版本
$assetFilter = ""
if ($Lite) {
    $assetFilter = "lite"
} elseif ($Variant) {
    $assetFilter = $Variant
}

# 选择资产包（内核源码 + wheels；精简版仅源码）
$assets = Select-Package -Dir $KernelSource -Prefix "moechat-assets" -Exact $AssetsPackage -VariantFilter $assetFilter
if (-not $assets) {
    $hint = if ($Lite) { "精简版内核资产包 (moechat-assets-*-lite.zip)" } else { "内核资产包 (moechat-assets-*.zip，筛选: '$assetFilter')" }
    Write-Error "未找到${hint}: $KernelSource"
    exit 1
}

# 未指定筛选且 dist 中存在多个变体包时提示，避免静默选错
if (-not $AssetsPackage -and -not $Lite -and -not $Variant) {
    $variantCount = @(Get-ChildItem -LiteralPath $KernelSource -Filter "moechat-assets-*.zip" -File -ErrorAction SilentlyContinue |
        Where-Object { $_.Name -match '-(lite|cpu|cu130)\.zip$' }).Count
    if ($variantCount -gt 1) {
        Write-Host "提示：未指定 -Lite / -Variant，将选取最新版本资产包 $($assets.Name)。建议显式指定变体。" -ForegroundColor DarkYellow
    }
}

# 选择数据包（仅完整版）
$data = $null
if ($IncludeData) {
    $data = Select-Package -Dir $KernelSource -Prefix "moechat-data" -Exact $DataPackage -VariantFilter ""
    if (-not $data) {
        Write-Error "未找到数据包 (moechat-data-*.zip): $KernelSource"
        exit 1
    }
}

Write-Host "============================================" -ForegroundColor Cyan
Write-Host "  Prepare kernel-assets bundle" -ForegroundColor Cyan
Write-Host "============================================" -ForegroundColor Cyan
Write-Host "Source : $KernelSource"
Write-Host "Output : $OutputDir"
Write-Host "Assets : $($assets.Name) ($([math]::Round($assets.Length / 1MB, 1)) MB)"
if ($data) {
    Write-Host "Data   : $($data.Name) ($([math]::Round($data.Length / 1MB, 1)) MB)"
} else {
    Write-Host "Data   : 未包含（精简版）" -ForegroundColor DarkYellow
}
Write-Host ""

# 同步模式（不做全量清空，避免连续变体构建时重复拷贝大文件）：
# 1) 清理输出目录中不属于当前变体的残留 zip，防止旧变体包混入本次构建；
# 2) 仅复制缺失或大小不一致的目标包，数据包在 cpu→cuda 切换时可直接复用。
New-Item -ItemType Directory -Path $OutputDir -Force | Out-Null

# 当前变体应保留的目标包集合（按文件名索引，用于清理残留）
$targets = @{}
if ($assets) { $targets[$assets.Name] = $assets }
if ($data) { $targets[$data.Name] = $data }

# 清理不属于当前变体的残留 zip（避免 electron-builder 把旧变体包一并打进产物）
Get-ChildItem -LiteralPath $OutputDir -File -ErrorAction SilentlyContinue |
    Where-Object { $_.Name -like '*.zip' -and -not $targets.ContainsKey($_.Name) } |
    Remove-Item -Force

# 同步资产包（已存在且大小一致则复用，否则复制）
Write-Host "[1/2] 同步资产包..." -ForegroundColor Yellow
if (Copy-IfChanged -Source $assets -DestDir $OutputDir) {
    Write-Host "  完成: $($assets.Name)" -ForegroundColor Green
} else {
    Write-Host "  已存在，复用: $($assets.Name)" -ForegroundColor DarkGray
}

# 同步数据包（仅完整版；精简版不保留数据包）
if ($data) {
    Write-Host "[2/2] 同步数据包..." -ForegroundColor Yellow
    if (Copy-IfChanged -Source $data -DestDir $OutputDir) {
        Write-Host "  完成: $($data.Name)（离线可用）" -ForegroundColor Green
    } else {
        Write-Host "  已存在，复用: $($data.Name)" -ForegroundColor DarkGray
    }
} else {
    Write-Host "[2/2] 精简版：跳过数据包（模型由后端首次运行自动下载）" -ForegroundColor DarkYellow
}

$totalSize = [math]::Round(((Get-ChildItem -LiteralPath $OutputDir -Recurse -File | Measure-Object -Property Length -Sum).Sum) / 1MB, 1)
Write-Host ""
Write-Host "============================================" -ForegroundColor Green
Write-Host "  Done! 总大小: ${totalSize} MB" -ForegroundColor Green
Write-Host "  Output: $(Resolve-Path $OutputDir)" -ForegroundColor White
Write-Host ""
if ($data) {
    $nextScript = if ($Variant -eq "cu130") { "npm run build:win:cuda" } else { "npm run build:win:cpu" }
    Write-Host "Next: $nextScript  ($Variant 版：zip 压缩包，含离线数据)" -ForegroundColor Cyan
} else {
    Write-Host "Next: npm run build:win  (精简版：NSIS 安装包，模型首次运行自动下载)" -ForegroundColor Cyan
}
Write-Host "一键构建全部变体: .\scripts\build-all.ps1 -KernelSource $KernelSource" -ForegroundColor DarkCyan
