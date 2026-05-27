param(
  [string]$InstallDir = "$env:USERPROFILE\codex-mobile-app-one-api-to-rule-them-all",
  [string]$Ref = 'main',
  [string]$RepoZipUrl = '',
  [string]$ServerUrl = '',
  [string]$AgentToken = '',
  [string]$ProxyApiKey = '',
  [string]$CodexHome = '',
  [string]$AllowedRoots = '',
  [switch]$RunNow,
  [switch]$NonInteractive,
  [switch]$ForceDownload
)

$ErrorActionPreference = 'Stop'

if (-not $RepoZipUrl) {
  $RepoZipUrl = "https://github.com/Ticmiro/codex-mobile-app-one-api-to-rule-them-all/archive/refs/heads/$Ref.zip"
}

function Require-Command([string]$Name, [string]$InstallHint) {
  if (-not (Get-Command $Name -ErrorAction SilentlyContinue)) {
    throw "$Name is required. $InstallHint"
  }
}

function Copy-DirectoryContents([string]$Source, [string]$Destination) {
  New-Item -ItemType Directory -Force -Path $Destination | Out-Null
  Get-ChildItem -LiteralPath $Source -Force | ForEach-Object {
    Copy-Item -LiteralPath $_.FullName -Destination $Destination -Recurse -Force
  }
}

Require-Command 'node' 'Install Node.js 22 LTS first: winget install OpenJS.NodeJS.LTS'

$installer = Join-Path $InstallDir 'scripts\install-windows-bridge.ps1'
$shouldDownload = $ForceDownload -or -not (Test-Path -LiteralPath $installer)

if ($shouldDownload) {
  $tempRoot = Join-Path $env:TEMP "codex-mobile-app-one-api-to-rule-them-all-$([guid]::NewGuid().ToString('N'))"
  $zipPath = Join-Path $tempRoot 'repo.zip'
  $extractDir = Join-Path $tempRoot 'extract'

  New-Item -ItemType Directory -Force -Path $tempRoot, $extractDir | Out-Null
  Write-Output "Downloading $RepoZipUrl"
  Invoke-WebRequest -Uri $RepoZipUrl -OutFile $zipPath
  Expand-Archive -LiteralPath $zipPath -DestinationPath $extractDir -Force

  $sourceRoot = Get-ChildItem -LiteralPath $extractDir -Directory | Select-Object -First 1
  if (-not $sourceRoot) {
    throw 'Downloaded archive did not contain a source folder.'
  }

  Write-Output "Installing source to $InstallDir"
  Copy-DirectoryContents -Source $sourceRoot.FullName -Destination $InstallDir
}

if (-not (Test-Path -LiteralPath $installer)) {
  throw "Installer was not found at $installer"
}

$params = @{}
if ($ServerUrl) { $params.ServerUrl = $ServerUrl }
if ($AgentToken) { $params.AgentToken = $AgentToken }
if ($ProxyApiKey) { $params.ProxyApiKey = $ProxyApiKey }
if ($CodexHome) { $params.CodexHome = $CodexHome }
if ($AllowedRoots) { $params.AllowedRoots = $AllowedRoots }
if ($RunNow) { $params.RunNow = $true }
if ($NonInteractive) { $params.NonInteractive = $true }

Write-Output "Running $installer"
& $installer @params

