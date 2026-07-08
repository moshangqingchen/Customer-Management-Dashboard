param(
  [Parameter(Mandatory = $true)]
  [ValidatePattern('^[^/\s]+/[^/\s]+$')]
  [string]$Repository,

  [Parameter(Mandatory = $true)]
  [ValidatePattern('^\d+\.\d+\.\d+$')]
  [string]$Version,

  [Parameter(Mandatory = $true)]
  [string]$Notes
)

$ErrorActionPreference = "Stop"
$projectRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
$gh = Get-Command gh -ErrorAction SilentlyContinue

function Get-GitHubHeaders {
  $credentialLines = "protocol=https`nhost=github.com`n`n" | git credential fill 2>$null
  $credential = @{}
  foreach ($line in $credentialLines) {
    if ($line -match '^([^=]+)=(.*)$') { $credential[$matches[1]] = $matches[2] }
  }
  if ([string]::IsNullOrWhiteSpace($credential.password)) {
    throw "No GitHub credential was found. Sign in to GitHub through Git Credential Manager first."
  }
  @{
    Authorization = "Bearer $($credential.password)"
    Accept = "application/vnd.github+json"
    "User-Agent" = "Customer-Management-Dashboard-Updater"
    "X-GitHub-Api-Version" = "2022-11-28"
  }
}

function Publish-WithGitHubApi(
  [string]$RepositoryName,
  [string]$Tag,
  [string]$ReleaseTitle,
  [string]$ReleaseNotes,
  [string[]]$Files
) {
  $headers = Get-GitHubHeaders
  $apiBase = "https://api.github.com/repos/$RepositoryName"
  $repo = Invoke-RestMethod -Headers $headers -Uri $apiBase
  if ($repo.visibility -ne "public") {
    throw "The updater repository must be public so installed apps can download updates without a login."
  }
  if ($repo.permissions.push -ne $true) {
    throw "The current GitHub credential cannot publish releases to $RepositoryName."
  }

  $releases = @(Invoke-RestMethod -Headers $headers -Uri "$apiBase/releases?per_page=100")
  $release = $releases | Where-Object { $_.tag_name -eq $Tag } | Select-Object -First 1
  $releaseBody = @{
    tag_name = $Tag
    name = $ReleaseTitle
    body = $ReleaseNotes
    draft = $false
    prerelease = $false
    make_latest = "true"
  } | ConvertTo-Json

  if ($release) {
    $release = Invoke-RestMethod -Method Patch -Headers $headers -ContentType "application/json" `
      -Uri "$apiBase/releases/$($release.id)" -Body $releaseBody
  }
  else {
    $release = Invoke-RestMethod -Method Post -Headers $headers -ContentType "application/json" `
      -Uri "$apiBase/releases" -Body $releaseBody
  }

  $assets = @(Invoke-RestMethod -Headers $headers -Uri "$apiBase/releases/$($release.id)/assets?per_page=100")
  foreach ($file in $Files) {
    $assetName = Split-Path -Leaf $file
    $existing = $assets | Where-Object { $_.name -eq $assetName }
    foreach ($asset in $existing) {
      Invoke-RestMethod -Method Delete -Headers $headers -Uri $asset.url
    }

    $escapedName = [Uri]::EscapeDataString($assetName)
    $contentType = if ($assetName -eq "latest.json") { "application/json" } else { "application/octet-stream" }
    Invoke-WebRequest -Method Post -Headers $headers -ContentType $contentType -InFile $file `
      -Uri "https://uploads.github.com/repos/$RepositoryName/releases/$($release.id)/assets?name=$escapedName" `
      -UseBasicParsing | Out-Null
    Write-Host "Uploaded $assetName"
  }
}

if ($gh) {
  & $gh.Source auth status | Out-Null
  if ($LASTEXITCODE -ne 0) { throw "GitHub CLI is not logged in. Run 'gh auth login' first." }
}

$endpoint = "https://github.com/$Repository/releases/latest/download/latest.json"
$assetName = "startup-customer-workbench-$Version-x64-setup.exe"
$downloadUrl = "https://github.com/$Repository/releases/download/v$Version/$assetName"

Push-Location $projectRoot
try {
  & (Join-Path $PSScriptRoot "set-version.ps1") -Version $Version -UpdaterEndpoint $endpoint
  npm.cmd run tauri:build:signed
  if ($LASTEXITCODE -ne 0) { throw "Signed Tauri build failed." }

  & (Join-Path $PSScriptRoot "create-update-manifest.ps1") `
    -DownloadUrl $downloadUrl `
    -Notes $Notes `
    -AssetName $assetName
  & (Join-Path $PSScriptRoot "verify-update-release.ps1")

  $releaseDir = Join-Path $projectRoot "release\update"
  $manifest = Join-Path $releaseDir "latest.json"
  $installer = Join-Path $releaseDir $assetName
  $signature = "$installer.sig"
  $tag = "v$Version"

  if ($gh) {
    & $gh.Source release view $tag --repo $Repository *> $null
    if ($LASTEXITCODE -eq 0) {
      & $gh.Source release upload $tag $manifest $installer $signature --repo $Repository --clobber
      if ($LASTEXITCODE -ne 0) { throw "Uploading update assets failed." }
      & $gh.Source release edit $tag --repo $Repository --title "版本 $Version" --notes $Notes --latest
    }
    else {
      & $gh.Source release create $tag $manifest $installer $signature `
        --repo $Repository `
        --title "版本 $Version" `
        --notes $Notes `
        --latest
    }
    if ($LASTEXITCODE -ne 0) { throw "Creating or updating the GitHub release failed." }
  }
  else {
    Publish-WithGitHubApi `
      -RepositoryName $Repository `
      -Tag $tag `
      -ReleaseTitle "版本 $Version" `
      -ReleaseNotes $Notes `
      -Files @($manifest, $installer, $signature)
  }

  Write-Host "Update $Version published. Existing installations will find it on next launch."
  Write-Host "Manifest: $endpoint"
}
finally {
  Pop-Location
}
