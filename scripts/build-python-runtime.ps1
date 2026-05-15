<#
.SYNOPSIS
    Download uv.exe to resources/python-runtime/ (for embedding in Electron app)
.DESCRIPTION
    uv can auto-manage Python versions. Only uv.exe is needed.
    Downloads the zip archive from GitHub, extracts uv.exe.
.PARAMETER OutputDir
    Output directory, default "resources/python-runtime"
.EXAMPLE
    .\scripts\build-python-runtime.ps1
#>

param(
    [string]$OutputDir = "resources/python-runtime"
)

$ErrorActionPreference = "Stop"
$ProgressPreference = "SilentlyContinue"

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$ProjectRoot = Resolve-Path (Join-Path $ScriptDir "..")
Set-Location -LiteralPath $ProjectRoot

Write-Host "============================================" -ForegroundColor Cyan
Write-Host "  MoeChat-APP Runtime Build (uv-only)" -ForegroundColor Cyan
Write-Host "============================================" -ForegroundColor Cyan
Write-Host "Output dir: $OutputDir"
Write-Host ""

if (-not (Test-Path $OutputDir)) {
    New-Item -ItemType Directory -Path $OutputDir -Force | Out-Null
}

$uvZipUrl = "https://github.com/astral-sh/uv/releases/latest/download/uv-x86_64-pc-windows-msvc.zip"
$uvZipPath = Join-Path $env:TEMP "uv-portable.zip"
$uvExtractDir = Join-Path $env:TEMP "uv-extract"

Write-Host "[1/2] Downloading uv (~20MB)..." -ForegroundColor Yellow
Write-Host "  URL: $uvZipUrl"

try {
    Invoke-WebRequest -Uri $uvZipUrl -OutFile $uvZipPath -UseBasicParsing
} catch {
    Write-Error "Failed to download uv: $_"
    Write-Host "Tip: download manually from:" -ForegroundColor Yellow
    Write-Host "  $uvZipUrl" -ForegroundColor Gray
    Write-Host "  Extract uv.exe and place in: $OutputDir" -ForegroundColor Gray
    exit 1
}

$zipSize = [math]::Round((Get-Item $uvZipPath).Length / 1MB, 1)
Write-Host "  Downloaded: ${zipSize}MB" -ForegroundColor Green

Write-Host "[2/2] Extracting uv.exe..." -ForegroundColor Yellow

if (Test-Path $uvExtractDir) {
    Remove-Item -Recurse -Force $uvExtractDir
}
New-Item -ItemType Directory -Path $uvExtractDir -Force | Out-Null

# Use Expand-Archive (built-in, PS 5.0+)
Expand-Archive -Path $uvZipPath -DestinationPath $uvExtractDir -Force

# Find uv.exe in extracted files
$extractedExe = Get-ChildItem -Path $uvExtractDir -Recurse -Filter "uv.exe" | Select-Object -First 1
if (-not $extractedExe) {
    Write-Error "uv.exe not found in extracted archive"
    Write-Host "Archive contents:" -ForegroundColor Gray
    Get-ChildItem -Path $uvExtractDir -Recurse | ForEach-Object { Write-Host "  $($_.FullName)" }
    exit 1
}

$uvDest = Join-Path $OutputDir "uv.exe"
Move-Item -Path $extractedExe.FullName -Destination $uvDest -Force

# Cleanup
Remove-Item -Force $uvZipPath -ErrorAction SilentlyContinue
Remove-Item -Recurse -Force $uvExtractDir -ErrorAction SilentlyContinue

$uvSize = [math]::Round((Get-Item $uvDest).Length / 1MB, 1)
Write-Host "  uv.exe: ${uvSize}MB" -ForegroundColor Green

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
Write-Host "  uv.exe: $(Resolve-Path $uvDest)" -ForegroundColor White
Write-Host ""
Write-Host "Next: run electron-builder to package." -ForegroundColor Cyan
