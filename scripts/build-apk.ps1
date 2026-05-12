# build-apk.ps1 — Build the Ionic web assets and assemble the Android APK
param(
  [switch]$Release
)
$ErrorActionPreference = 'Stop'

$ScriptDir   = Split-Path -Parent $MyInvocation.MyCommand.Path
$ProjectRoot = Split-Path -Parent $ScriptDir
$AndroidDir  = Join-Path $ProjectRoot "android"

# ── Validate environment ──────────────────────────────────────────────────────
if (-not $env:ANDROID_HOME) {
  Write-Error "ANDROID_HOME is not set. Set it to your Android SDK path."
  exit 1
}
if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
  Write-Error "Node.js is not installed or not in PATH."
  exit 1
}

Set-Location $ProjectRoot

Write-Host "▶ Building Ionic web assets (--configuration=production)..." -ForegroundColor Cyan
npx ionic build --prod

Write-Host "▶ Syncing Capacitor..." -ForegroundColor Cyan
npx cap sync android

Set-Location $AndroidDir

if ($Release) {
  Write-Host "▶ Assembling release APK..." -ForegroundColor Cyan
  .\gradlew.bat assembleRelease
  $ApkPath = Get-ChildItem "$AndroidDir\app\build\outputs\apk\release" -Filter "*.apk" | Select-Object -First 1 -ExpandProperty FullName
} else {
  Write-Host "▶ Assembling debug APK..." -ForegroundColor Cyan
  .\gradlew.bat assembleDebug
  $ApkPath = Get-ChildItem "$AndroidDir\app\build\outputs\apk\debug" -Filter "*.apk" | Select-Object -First 1 -ExpandProperty FullName
}

Write-Host ""
Write-Host "✅ APK built: $ApkPath" -ForegroundColor Green
