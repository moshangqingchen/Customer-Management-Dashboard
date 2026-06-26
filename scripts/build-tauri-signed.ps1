$ErrorActionPreference = "Stop"

$projectRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
$privateKeyPath = Join-Path $projectRoot "src-tauri\updater-private.key"

$env:TAURI_SIGNING_PRIVATE_KEY = Get-Content -Raw -LiteralPath $privateKeyPath
$env:TAURI_SIGNING_PRIVATE_KEY_PASSWORD = ""

npm.cmd run tauri:build -- --ci
