$ErrorActionPreference = "Stop"

$projectRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
$privateKeyPath = Join-Path $projectRoot "src-tauri\updater-private.key"

if (!(Test-Path -LiteralPath $privateKeyPath) -and [string]::IsNullOrWhiteSpace($env:TAURI_SIGNING_PRIVATE_KEY)) {
  throw "Updater signing key not found. Set TAURI_SIGNING_PRIVATE_KEY or create $privateKeyPath."
}

$previousPrivateKey = $env:TAURI_SIGNING_PRIVATE_KEY
$previousPassword = $env:TAURI_SIGNING_PRIVATE_KEY_PASSWORD
$loadedPrivateKey = [string]::IsNullOrWhiteSpace($env:TAURI_SIGNING_PRIVATE_KEY)
if ($loadedPrivateKey) {
  $env:TAURI_SIGNING_PRIVATE_KEY = Get-Content -Raw -LiteralPath $privateKeyPath
}
if ($null -eq $env:TAURI_SIGNING_PRIVATE_KEY_PASSWORD) {
  Write-Warning "TAURI_SIGNING_PRIVATE_KEY_PASSWORD is not set; continuing only for an unencrypted/empty-password local key."
  $env:TAURI_SIGNING_PRIVATE_KEY_PASSWORD = ""
}

try {
  npm.cmd run tauri:build -- --ci
  if ($LASTEXITCODE -ne 0) { throw "Signed Tauri build failed." }
}
finally {
  if ($null -eq $previousPrivateKey) { Remove-Item Env:TAURI_SIGNING_PRIVATE_KEY -ErrorAction SilentlyContinue }
  else { $env:TAURI_SIGNING_PRIVATE_KEY = $previousPrivateKey }
  if ($null -eq $previousPassword) { Remove-Item Env:TAURI_SIGNING_PRIVATE_KEY_PASSWORD -ErrorAction SilentlyContinue }
  else { $env:TAURI_SIGNING_PRIVATE_KEY_PASSWORD = $previousPassword }
}
