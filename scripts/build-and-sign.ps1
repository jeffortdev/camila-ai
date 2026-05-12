# build-and-sign.ps1 — Full pipeline: build release APK → sign → verify
$ErrorActionPreference = 'Stop'

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$EnvFile   = Join-Path $ScriptDir ".env"

# ── Load .env ─────────────────────────────────────────────────────────────────
if (-not (Test-Path $EnvFile)) {
  Write-Error "Missing $EnvFile. Copy scripts\.env.example to scripts\.env and fill in your keystore credentials."
  exit 1
}

Get-Content $EnvFile | ForEach-Object {
  if ($_ -match '^\s*([^#=]+?)\s*=\s*(.*)\s*$') {
    [System.Environment]::SetEnvironmentVariable($Matches[1], $Matches[2], 'Process')
  }
}

$KeystorePath  = $env:KEYSTORE_PATH
$KeyAlias      = $env:KEY_ALIAS
$StorePassword = $env:STORE_PASSWORD
$KeyPassword   = $env:KEY_PASSWORD

foreach ($v in @($KeystorePath, $KeyAlias, $StorePassword, $KeyPassword)) {
  if (-not $v) { Write-Error "Missing required variable in .env"; exit 1 }
}

# ── Build release APK ─────────────────────────────────────────────────────────
Write-Host ""
Write-Host "═══════════════════════════════════════════════" -ForegroundColor Magenta
Write-Host " CamilaAI — Build & Sign Pipeline" -ForegroundColor Magenta
Write-Host "═══════════════════════════════════════════════" -ForegroundColor Magenta
Write-Host ""

& "$ScriptDir\build-apk.ps1" -Release

$ProjectRoot = Split-Path -Parent $ScriptDir
$AndroidDir  = Join-Path $ProjectRoot "android"
$UnsignedApk = Get-ChildItem "$AndroidDir\app\build\outputs\apk\release" -Filter "*.apk" |
               Sort-Object LastWriteTime -Descending | Select-Object -First 1 -ExpandProperty FullName
$OutputApk   = "$AndroidDir\app\build\outputs\apk\release\camila-ai-release-signed.apk"

# ── Sign ──────────────────────────────────────────────────────────────────────
& "$ScriptDir\sign-apk.ps1" `
  -UnsignedApk   $UnsignedApk `
  -KeystorePath  $KeystorePath `
  -Alias         $KeyAlias `
  -StorePassword $StorePassword `
  -KeyPassword   $KeyPassword `
  -OutputApk     $OutputApk

Write-Host ""
Write-Host "🚀 Final APK ready: $OutputApk" -ForegroundColor Green
