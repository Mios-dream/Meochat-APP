<#
.SYNOPSIS
    准备单一 lite 内核资产包。
.DESCRIPTION
    从后端 dist 目录导入当前目标平台最新的
    moechat-assets-*-{win|linux}-lite.zip 到 resources/kernel-assets。
    打包目录中仅保留该资产包及其权威 manifest.json。

.PARAMETER KernelSource
    包含后端资产 zip 的 dist 目录。
.PARAMETER AssetsPackage
    可选：精确指定的 lite 资产包文件名。
.PARAMETER Platform
    目标平台：windows 或 linux；默认使用当前系统平台。
.PARAMETER OutputDir
    输出目录，默认 resources/kernel-assets。
#>

param(
    [Parameter(Mandatory = $true)]
    [string]$KernelSource,
    [string]$AssetsPackage = "",
    [ValidateSet("windows", "linux", "")]
    [string]$Platform = "",
    [string]$OutputDir = "resources/kernel-assets"
)

$ErrorActionPreference = "Stop"

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$ProjectRoot = Resolve-Path (Join-Path $ScriptDir "..")
Set-Location -LiteralPath $ProjectRoot

function Select-LitePackage {
    param(
        [string]$Dir,
        [string]$Exact,
        [string]$PlatformTag
    )

    $candidates = @(Get-ChildItem -LiteralPath $Dir -Filter "moechat-assets-*.zip" -File -ErrorAction SilentlyContinue |
        Where-Object { $_.Name -match "-$PlatformTag-lite\.zip$" })
    if ($Exact) {
        return $candidates | Where-Object { $_.Name -eq $Exact } | Select-Object -First 1
    }
    return $candidates | Sort-Object {
        if ($_.Name -match '-v(\d+(\.\d+)*)') {
            try { [version]$matches[1] } catch { [version]"0.0.0" }
        } else {
            [version]"0.0.0"
        }
    } -Descending | Select-Object -First 1
}

function Read-ZipManifest {
    param([string]$ZipPath)
    Add-Type -AssemblyName System.IO.Compression
    Add-Type -AssemblyName System.IO.Compression.FileSystem
    $zip = [System.IO.Compression.ZipFile]::OpenRead($ZipPath)
    try {
        $entry = $zip.GetEntry("manifest.json")
        if (-not $entry) { return $null }
        $reader = New-Object System.IO.StreamReader($entry.Open(), [System.Text.Encoding]::UTF8)
        try { return ($reader.ReadToEnd() | ConvertFrom-Json) } finally { $reader.Dispose() }
    } finally { $zip.Dispose() }
}

if (-not (Test-Path -LiteralPath $KernelSource)) {
    Write-Error "KernelSource 目录不存在: $KernelSource"
    exit 1
}

if (-not $Platform) {
    $Platform = if ($env:OS -match "Windows") { "windows" } else { "linux" }
}
$platformTag = if ($Platform -eq "windows") { "win" } else { "linux" }
$assets = Select-LitePackage -Dir $KernelSource -Exact $AssetsPackage -PlatformTag $platformTag
if (-not $assets) {
    Write-Error "未找到 lite 内核资产包: moechat-assets-*-$platformTag-lite.zip ($KernelSource)"
    exit 1
}

New-Item -ItemType Directory -Path $OutputDir -Force | Out-Null
Get-ChildItem -LiteralPath $OutputDir -File -ErrorAction SilentlyContinue |
    Where-Object { $_.Name -like '*.zip' -and $_.Name -ne $assets.Name } |
    Remove-Item -Force

$destination = Join-Path $OutputDir $assets.Name
if (-not (Test-Path -LiteralPath $destination) -or (Get-Item -LiteralPath $destination).Length -ne $assets.Length) {
    Copy-Item -LiteralPath $assets.FullName -Destination $destination -Force
}

$assetsManifest = Read-ZipManifest -ZipPath $destination
if (-not $assetsManifest) {
    Write-Error "资产包缺少 manifest.json: $($assets.Name)"
    exit 1
}
$declaration = @{
    assets = @{
        file     = $assets.Name
        version  = $assetsManifest.version
        build_id = $assetsManifest.build_id
    }
}
[System.IO.File]::WriteAllText(
    (Join-Path $OutputDir "manifest.json"),
    ($declaration | ConvertTo-Json -Depth 4),
    (New-Object System.Text.UTF8Encoding($false))
)

Write-Host "已准备资产包: $($assets.Name) ($([math]::Round($assets.Length / 1MB, 1)) MB)" -ForegroundColor Green
