param(
  [Parameter(Mandatory = $true)]
  [string]$DownloadUrl,

  [string]$Notes = "",

  [string]$OutputPath = "release\update\latest.json",

  [string]$AssetName = ""
)

$ErrorActionPreference = "Stop"

$projectRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
$tauriConfigPath = Join-Path $projectRoot "src-tauri\tauri.conf.json"
$tauriConfig = Get-Content -Raw -Encoding UTF8 -LiteralPath $tauriConfigPath | ConvertFrom-Json
$version = [string]$tauriConfig.version
$productName = [string]$tauriConfig.productName

$bundleDir = Join-Path $projectRoot "src-tauri\target\release\bundle\nsis"
$installerPattern = "{0}_{1}_x64-setup.exe" -f $productName, $version
$installer = Join-Path $bundleDir $installerPattern
$signatureFile = "$installer.sig"

if (!(Test-Path -LiteralPath $installer)) {
  throw "Installer not found: $installer. Run npm.cmd run tauri:build:signed first."
}

if (!(Test-Path -LiteralPath $signatureFile)) {
  throw "Signature not found: $signatureFile. Run npm.cmd run tauri:build:signed first."
}

$signature = (Get-Content -Raw -Encoding UTF8 -LiteralPath $signatureFile).Trim()
if ([string]::IsNullOrWhiteSpace($AssetName)) {
  $AssetName = "startup-customer-workbench-$version-x64-setup.exe"
}

$downloadUri = [Uri]$DownloadUrl
if ($downloadUri.Scheme -ne "https") {
  throw "DownloadUrl must use HTTPS: $DownloadUrl"
}

$manifest = [ordered]@{
  version = $version
  notes = $Notes
  pub_date = (Get-Date).ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ssZ")
  platforms = [ordered]@{
    "windows-x86_64" = [ordered]@{
      signature = $signature
      url = $DownloadUrl
    }
  }
}

$resolvedOutputPath = Join-Path $projectRoot $OutputPath
$outputDir = Split-Path -Parent $resolvedOutputPath
if ($outputDir -and !(Test-Path -LiteralPath $outputDir)) {
  New-Item -ItemType Directory -Path $outputDir | Out-Null
}

$json = $manifest | ConvertTo-Json -Depth 8
$utf8NoBom = New-Object System.Text.UTF8Encoding $false
[System.IO.File]::WriteAllText($resolvedOutputPath, $json, $utf8NoBom)
$releaseInstaller = Join-Path $outputDir $AssetName
Copy-Item -LiteralPath $installer -Destination $releaseInstaller -Force
Copy-Item -LiteralPath $signatureFile -Destination "$releaseInstaller.sig" -Force
Write-Host "Update manifest written to $resolvedOutputPath"
Write-Host "Release installer copied to $releaseInstaller"
