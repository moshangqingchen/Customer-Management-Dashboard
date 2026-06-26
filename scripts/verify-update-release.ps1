$ErrorActionPreference = "Stop"
$projectRoot = Resolve-Path (Join-Path $PSScriptRoot "..")

function Read-Json([string]$Path) {
  Get-Content -Raw -Encoding UTF8 -LiteralPath $Path | ConvertFrom-Json
}

$package = Read-Json (Join-Path $projectRoot "package.json")
$packageLockText = Get-Content -Raw -Encoding UTF8 -LiteralPath (Join-Path $projectRoot "package-lock.json")
$packageLockVersion = [regex]::Match($packageLockText, '(?m)^\s*"version"\s*:\s*"([^"]+)"').Groups[1].Value
$tauriConfig = Read-Json (Join-Path $projectRoot "src-tauri\tauri.conf.json")
$capability = Read-Json (Join-Path $projectRoot "src-tauri\capabilities\default.json")
$manifestPath = Join-Path $projectRoot "release\update\latest.json"
if (!(Test-Path -LiteralPath $manifestPath)) { throw "Update manifest not found: $manifestPath" }
$manifest = Read-Json $manifestPath

$version = [string]$tauriConfig.version
$versions = @(
  [string]$package.version,
  $packageLockVersion,
  [string]$manifest.version
)
if ($versions | Where-Object { $_ -ne $version }) {
  throw "Version mismatch. Expected every release file to use $version."
}

$cargo = Get-Content -Raw -Encoding UTF8 -LiteralPath (Join-Path $projectRoot "src-tauri\Cargo.toml")
$cargoPackage = [regex]::Match($cargo, '(?ms)^\[package\].*?^version\s*=\s*"([^"]+)"')
if (!$cargoPackage.Success -or $cargoPackage.Groups[1].Value -ne $version) {
  throw "Cargo.toml package version does not match $version."
}

if ($capability.permissions -notcontains "updater:default") {
  throw "The main window is missing updater:default permission."
}
if ($tauriConfig.bundle.createUpdaterArtifacts -ne $true) {
  throw "createUpdaterArtifacts must be enabled."
}

$endpoints = @($tauriConfig.plugins.updater.endpoints)
if ($endpoints.Count -ne 1) { throw "Exactly one updater endpoint is required." }
$endpoint = [Uri]$endpoints[0]
if ($endpoint.Scheme -ne "https" -or $endpoint.Host.EndsWith(".example")) {
  throw "Configure a real HTTPS updater endpoint before publishing: $endpoint"
}

$platform = $manifest.platforms.'windows-x86_64'
if (!$platform) { throw "latest.json is missing windows-x86_64." }
$downloadUri = [Uri]$platform.url
if ($downloadUri.Scheme -ne "https") { throw "The update download URL must use HTTPS." }
if ([string]::IsNullOrWhiteSpace([string]$platform.signature)) {
  throw "latest.json is missing the updater signature."
}

$assetName = [Uri]::UnescapeDataString((Split-Path -Leaf $downloadUri.AbsolutePath))
$releaseInstaller = Join-Path $projectRoot "release\update\$assetName"
$releaseSignature = "$releaseInstaller.sig"
if (!(Test-Path -LiteralPath $releaseInstaller)) { throw "Release installer not found: $releaseInstaller" }
if (!(Test-Path -LiteralPath $releaseSignature)) { throw "Release signature not found: $releaseSignature" }
if ((Get-Content -Raw -LiteralPath $releaseSignature).Trim() -ne ([string]$platform.signature).Trim()) {
  throw "The manifest signature does not match the release signature file."
}

$bundleName = "{0}_{1}_x64-setup.exe" -f $tauriConfig.productName, $version
$bundleInstaller = Join-Path $projectRoot "src-tauri\target\release\bundle\nsis\$bundleName"
if (!(Test-Path -LiteralPath $bundleInstaller)) { throw "Signed bundle not found: $bundleInstaller" }
$bundleHash = (Get-FileHash -Algorithm SHA256 -LiteralPath $bundleInstaller).Hash
$releaseHash = (Get-FileHash -Algorithm SHA256 -LiteralPath $releaseInstaller).Hash
if ($bundleHash -ne $releaseHash) { throw "The release installer does not match the signed bundle." }

Write-Host "Update release $version verified successfully."
Write-Host "Endpoint: $endpoint"
Write-Host "Installer SHA256: $releaseHash"
