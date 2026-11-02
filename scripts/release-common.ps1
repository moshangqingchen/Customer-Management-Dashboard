$ErrorActionPreference = 'Stop'
$projectRoot = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot '..')).Path

function Get-ReleaseConfig {
  $package = Get-Content -Raw -Encoding UTF8 -LiteralPath (Join-Path $projectRoot 'package.json') | ConvertFrom-Json
  $config = Get-Content -Raw -Encoding UTF8 -LiteralPath (Join-Path $projectRoot 'src-tauri/tauri.conf.json') | ConvertFrom-Json
  $cargo = Get-Content -Raw -Encoding UTF8 -LiteralPath (Join-Path $projectRoot 'src-tauri/Cargo.toml')
  $cargoVersion = [regex]::Match($cargo, '(?ms)^\[package\].*?^version\s*=\s*"([^"]+)"').Groups[1].Value
  if ($package.version -ne $config.version -or $cargoVersion -ne $config.version) {
    throw 'Version mismatch between package.json, Cargo.toml and tauri.conf.json. Run scripts/set-version.ps1.'
  }
  return $config
}

function Enable-ReleaseProxy {
  # Environment is inherited only by tools launched by this script. No system settings change.
  $proxyPort = New-Object System.Net.Sockets.TcpClient
  try { $proxyPort.Connect('127.0.0.1', 10090) }
  catch { throw 'Required proxy http://127.0.0.1:10090 is unavailable. No direct fallback is allowed.' }
  finally { $proxyPort.Dispose() }
  $env:HTTP_PROXY = 'http://127.0.0.1:10090'
  $env:HTTPS_PROXY = 'http://127.0.0.1:10090'
  $env:ALL_PROXY = 'http://127.0.0.1:10090'
  $env:NO_PROXY = 'localhost,127.0.0.1,::1'
  $env:npm_config_proxy = $env:HTTP_PROXY
  $env:npm_config_https_proxy = $env:HTTPS_PROXY
}
