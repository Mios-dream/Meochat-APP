<#
.SYNOPSIS
    Download uv runtime (uv.exe / uv) to resources/python-runtime/ (for embedding in Electron app)
.DESCRIPTION
    uv can auto-manage Python versions. Only the uv binary is needed.
    Downloads the platform-specific archive from GitHub and extracts it.

    Platform selection (via -Platform):
    - windows (default on win32): uv-x86_64-pc-windows-msvc.zip  → uv.exe
    - linux   (default on linux): uv-x86_64-unknown-linux-gnu.tar.gz → uv
    The extracted binary is placed at resources/python-runtime/uv[.exe].
.PARAMETER OutputDir
    Output directory, default "resources/python-runtime".
.PARAMETER Platform
    Target platform: "windows" | "linux". Defaults to current OS platform.
.EXAMPLE
    .\scripts\build-python-runtime.ps1
.EXAMPLE
    # 构建 Linux 目标所需的 uv 二进制（在 Windows 上交叉准备资源）
    .\scripts\build-python-runtime.ps1 -Platform linux
#>

param(
    [string]$OutputDir = "resources/python-runtime",
    [ValidateSet("windows", "linux", "")]
    [string]$Platform = ""
)

$ErrorActionPreference = "Stop"
$ProgressPreference = "SilentlyContinue"

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$ProjectRoot = Resolve-Path (Join-Path $ScriptDir "..")
Set-Location -LiteralPath $ProjectRoot

# 未显式指定平台时，以当前运行系统为准（在对应平台上构建）
if (-not $Platform) {
    $Platform = if ($env:OS -match "Windows") { "windows" } else { "linux" }
}

# 平台 → 二进制文件名 与 GitHub release 资产映射
$isWindows = ($Platform -eq "windows")
$uvFileName = if ($isWindows) { "uv.exe" } else { "uv" }
$uvAssetName = if ($isWindows) { "uv-x86_64-pc-windows-msvc.zip" } else { "uv-x86_64-unknown-linux-gnu.tar.gz" }
$uvUrl = "https://github.com/astral-sh/uv/releases/latest/download/$uvAssetName"

Write-Host "============================================" -ForegroundColor Cyan
Write-Host "  MoeChat-APP Runtime Build (uv-only)" -ForegroundColor Cyan
Write-Host "============================================" -ForegroundColor Cyan
Write-Host "Platform  : $Platform"
Write-Host "Output dir: $OutputDir"
Write-Host "Asset     : $uvAssetName"
Write-Host ""

if (-not (Test-Path $OutputDir)) {
    New-Item -ItemType Directory -Path $OutputDir -Force | Out-Null
}

$uvArchivePath = Join-Path $env:TEMP "uv-portable.$($uvAssetName.Split('.')[-1])"
$uvExtractDir = Join-Path $env:TEMP "uv-extract-$Platform"

Write-Host "[1/2] Downloading uv (~20MB)..." -ForegroundColor Yellow
Write-Host "  URL: $uvUrl"

try {
    Invoke-WebRequest -Uri $uvUrl -OutFile $uvArchivePath -UseBasicParsing
} catch {
    Write-Error "Failed to download uv: $_"
    Write-Host "Tip: download manually from:" -ForegroundColor Yellow
    Write-Host "  $uvUrl" -ForegroundColor Gray
    Write-Host "  Extract $uvFileName and place in: $OutputDir" -ForegroundColor Gray
    exit 1
}

$archiveSize = [math]::Round((Get-Item $uvArchivePath).Length / 1MB, 1)
Write-Host "  Downloaded: ${archiveSize}MB" -ForegroundColor Green

Write-Host "[2/2] Extracting $uvFileName ..." -ForegroundColor Yellow

if (Test-Path $uvExtractDir) {
    Remove-Item -Recurse -Force $uvExtractDir
}
New-Item -ItemType Directory -Path $uvExtractDir -Force | Out-Null

if ($isWindows) {
    # Windows 为 zip 归档，使用内置 Expand-Archive
    Expand-Archive -Path $uvArchivePath -DestinationPath $uvExtractDir -Force
} else {
    # Linux 为 tar.gz 归档，PowerShell 5.1 无内置 tar，调用系统 tar 解压
    if (-not (Get-Command "tar" -ErrorAction SilentlyContinue)) {
        Write-Error "tar not found, cannot extract Linux uv archive"
        exit 1
    }
    & tar -xzf $uvArchivePath -C $uvExtractDir
    if ($LASTEXITCODE -ne 0) {
        Write-Error "tar extraction failed (exit code $LASTEXITCODE)"
        exit 1
    }
}

# 在解压产物中查找目标二进制（uv.exe / uv）
$extractedExe = Get-ChildItem -Path $uvExtractDir -Recurse -Filter $uvFileName | Select-Object -First 1
if (-not $extractedExe) {
    Write-Error "$uvFileName not found in extracted archive"
    Write-Host "Archive contents:" -ForegroundColor Gray
    Get-ChildItem -Path $uvExtractDir -Recurse | ForEach-Object { Write-Host "  $($_.FullName)" }
    exit 1
}

$uvDest = Join-Path $OutputDir $uvFileName
Move-Item -Path $extractedExe.FullName -Destination $uvDest -Force

# Linux 下赋予可执行权限
if (-not $isWindows) {
    & chmod +x $uvDest 2>$null
}

# Cleanup
Remove-Item -Force $uvArchivePath -ErrorAction SilentlyContinue
Remove-Item -Recurse -Force $uvExtractDir -ErrorAction SilentlyContinue

$uvSize = [math]::Round((Get-Item $uvDest).Length / 1MB, 1)
Write-Host "  ${uvFileName}: ${uvSize}MB" -ForegroundColor Green

try {
    $uvVersionOutput = & $uvDest --version 2>&1
    Write-Host "  uv version: $uvVersionOutput" -ForegroundColor Green
} catch {
    Write-Warning "uv version check failed, but file exists: $_"
}

Write-Host ""
Write-Host "============================================" -ForegroundColor Green
Write-Host "  Done!" -ForegroundColor Green
Write-Host "============================================" -ForegroundColor Green
Write-Host "  ${uvFileName}: $(Resolve-Path $uvDest)" -ForegroundColor White
Write-Host ""
Write-Host "Next: run electron-builder to package." -ForegroundColor Cyan
