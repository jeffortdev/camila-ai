# sign-apk.ps1 — Zipalign + sign a release APK with apksigner
param(
  [Parameter(Mandatory)][string]$UnsignedApk,
  [Parameter(Mandatory)][string]$KeystorePath,
  [Parameter(Mandatory)][string]$Alias,
  [Parameter(Mandatory)][string]$StorePassword,
  [Parameter(Mandatory)][string]$KeyPassword,
  [string]$OutputApk = ""
)
$ErrorActionPreference = 'Stop'

if (-not $OutputApk) {
  $OutputApk = [System.IO.Path]::ChangeExtension($UnsignedApk, $null).TrimEnd('.') + "-signed.apk"
}

if (-not $env:ANDROID_HOME) {
  Write-Error "ANDROID_HOME is not set."
  exit 1
}

# Find highest build-tools version
$BuildTools = Get-ChildItem "$env:ANDROID_HOME\build-tools" | Sort-Object Name -Descending | Select-Object -First 1 -ExpandProperty FullName
$Zipalign  = Join-Path $BuildTools "zipalign.exe"
$Apksigner = Join-Path $BuildTools "apksigner.bat"

$AlignedApk = [System.IO.Path]::ChangeExtension($UnsignedApk, $null).TrimEnd('.') + "-aligned.apk"

Write-Host "▶ Zipaligning..." -ForegroundColor Cyan
& $Zipalign -v 4 $UnsignedApk $AlignedApk

Write-Host "▶ Signing with apksigner..." -ForegroundColor Cyan
& $Apksigner sign `
  --ks $KeystorePath `
  --ks-key-alias $Alias `
  --ks-pass "pass:$StorePassword" `
  --key-pass "pass:$KeyPassword" `
  --out $OutputApk `
  $AlignedApk

Write-Host "▶ Verifying signature..." -ForegroundColor Cyan
& $Apksigner verify --verbose $OutputApk

# Cleanup
Remove-Item $AlignedApk -Force

Write-Host ""
Write-Host "✅ Signed APK: $OutputApk" -ForegroundColor Green
