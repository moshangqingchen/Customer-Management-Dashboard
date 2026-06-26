param(
  [Parameter(Mandatory = $true)]
  [ValidatePattern('^\d+\.\d+\.\d+$')]
  [string]$Version,

  [string]$UpdaterEndpoint = ""
)

$ErrorActionPreference = "Stop"
$projectRoot = Resolve-Path (Join-Path $PSScriptRoot "..")

Push-Location $projectRoot
try {
  npm.cmd version $Version --no-git-tag-version --allow-same-version | Out-Null

  $tauriConfigPath = Join-Path $projectRoot "src-tauri\tauri.conf.json"
  $tauriConfig = Get-Content -Raw -Encoding UTF8 -LiteralPath $tauriConfigPath | ConvertFrom-Json
  $tauriConfig.version = $Version
  if (![string]::IsNullOrWhiteSpace($UpdaterEndpoint)) {
    $endpointUri = [Uri]$UpdaterEndpoint
    if ($endpointUri.Scheme -ne "https") {
      throw "UpdaterEndpoint must use HTTPS: $UpdaterEndpoint"
    }
    $tauriConfig.plugins.updater.endpoints = @($UpdaterEndpoint)
  }
  $tauriJson = $tauriConfig | ConvertTo-Json -Depth 20
  $utf8NoBom = New-Object System.Text.UTF8Encoding $false
  [System.IO.File]::WriteAllText($tauriConfigPath, $tauriJson, $utf8NoBom)

  $cargoPath = Join-Path $projectRoot "src-tauri\Cargo.toml"
  $cargo = Get-Content -Raw -Encoding UTF8 -LiteralPath $cargoPath
  $packageStart = $cargo.IndexOf("[package]")
  if ($packageStart -lt 0) { throw "[package] section not found in Cargo.toml" }
  $nextSection = $cargo.IndexOf("`n[", $packageStart + 9)
  if ($nextSection -lt 0) { $nextSection = $cargo.Length }
  $packageSection = $cargo.Substring($packageStart, $nextSection - $packageStart)
  $versionPattern = '(?m)^version\s*=\s*"[^"]+"\s*$'
  if (![regex]::IsMatch($packageSection, $versionPattern)) {
    throw "Package version not found in Cargo.toml"
  }
  $updatedPackageSection = [regex]::Replace(
    $packageSection,
    $versionPattern,
    "version = `"$Version`"",
    1
  )
  $cargo = $cargo.Substring(0, $packageStart) + $updatedPackageSection + $cargo.Substring($nextSection)
  [System.IO.File]::WriteAllText($cargoPath, $cargo, $utf8NoBom)

  Write-Host "Version synchronized to $Version"
  if (![string]::IsNullOrWhiteSpace($UpdaterEndpoint)) {
    Write-Host "Updater endpoint set to $UpdaterEndpoint"
  }
}
finally {
  Pop-Location
}
