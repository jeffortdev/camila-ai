# generate-keystore.ps1 — Create a new Android signing keystore
param(
  [string]$KeystorePath  = "camila-ai-release.keystore",
  [string]$Alias         = "camila-ai",
  [string]$StorePassword = "",
  [string]$KeyPassword   = "",
  [int]   $Validity      = 10000,
  [string]$Dname         = "CN=CamilaAI, OU=Mobile, O=CamilaAI, L=Unknown, ST=Unknown, C=US"
)
$ErrorActionPreference = 'Stop'

if (Test-Path $KeystorePath) {
  Write-Warning "Keystore already exists at '$KeystorePath'. Skipping generation."
  exit 0
}

if (-not $StorePassword) {
  $ss = Read-Host -AsSecureString "Enter keystore password"
  $StorePassword = [Runtime.InteropServices.Marshal]::PtrToStringAuto(
    [Runtime.InteropServices.Marshal]::SecureStringToBSTR($ss))
}
if (-not $KeyPassword) {
  $ks = Read-Host -AsSecureString "Enter key password"
  $KeyPassword = [Runtime.InteropServices.Marshal]::PtrToStringAuto(
    [Runtime.InteropServices.Marshal]::SecureStringToBSTR($ks))
}

Write-Host "Generating keystore at $KeystorePath ..." -ForegroundColor Cyan

keytool -genkeypair `
  -v `
  -keystore $KeystorePath `
  -alias $Alias `
  -keyalg RSA `
  -keysize 2048 `
  -validity $Validity `
  -storepass $StorePassword `
  -keypass $KeyPassword `
  -dname $Dname

Write-Host ""
Write-Host "✅ Keystore created: $KeystorePath" -ForegroundColor Green
Write-Host ""
Write-Host "Fingerprint:" -ForegroundColor Cyan
keytool -list -v -keystore $KeystorePath -alias $Alias -storepass $StorePassword | Select-String "SHA256:"
