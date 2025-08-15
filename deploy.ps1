# deploy.ps1 — robust ZIP deploy (logs to %TEMP%, no browser; BAT opens URL)
param(
  [Parameter(Mandatory = $true)]
  [string]$ZipPath
)

$ErrorActionPreference = 'Stop'
$ProgressPreference    = 'SilentlyContinue'

function Fail { param($m) Write-Host "`nERROR: $m" -ForegroundColor Red; if($script:TranscriptStarted){ try{ Stop-Transcript | Out-Null }catch{} }; exit 1 }
function Info { param($m) Write-Host "[deploy] $m" -ForegroundColor Cyan }
function Warn { param($m) Write-Host "[deploy] $m" -ForegroundColor Yellow }

# Start transcript if ANTS_LOG is provided
$script:TranscriptStarted = $false
if($env:ANTS_LOG -and $env:ANTS_LOG -ne ''){
  try{ Start-Transcript -Path $env:ANTS_LOG -Force | Out-Null; $script:TranscriptStarted=$true }catch{}
}

try{
  # Resolve & validate inputs
  try { $ZipPath = (Resolve-Path $ZipPath).Path } catch { Fail "Zip not found: $ZipPath" }
  if ([IO.Path]::GetExtension($ZipPath).ToLower() -ne ".zip") { Fail "Not a .zip file: $ZipPath" }

  # Repo root = folder containing this script
  $RepoRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
  if (-not (Test-Path (Join-Path $RepoRoot ".git"))) { Fail "No .git folder at $RepoRoot" }

  # Sanity: git present?
  try { git --version | Out-Null } catch { Fail "Git not found in PATH" }

  # Temp staging
  $Staging = Join-Path ([IO.Path]::GetTempPath()) ("ants_deploy_" + [Guid]::NewGuid().ToString("N"))
  New-Item -ItemType Directory -Path $Staging | Out-Null

  # Extract ZIP to staging (try Expand-Archive, else ZipFile)
  Info ("Extracting " + $ZipPath)
  try {
    Expand-Archive -Path $ZipPath -DestinationPath $Staging -Force
  } catch {
    Add-Type -AssemblyName System.IO.Compression.FileSystem
    [IO.Compression.ZipFile]::ExtractToDirectory($ZipPath, $Staging)
  }

  # Find the folder that CONTAINS index.html (root or nested)
  $IndexFile = Get-ChildItem -LiteralPath $Staging -Recurse -File -Filter 'index.html' | Select-Object -First 1
  if (-not $IndexFile) { Fail "Package missing index.html" }
  $PkgDir = Split-Path -Parent $IndexFile.FullName
  Info ("Package folder: " + $PkgDir)

  # Version (from VERSION.txt if present; else from zip name)
  $Version = $null
  $VersionFile = Join-Path $PkgDir "VERSION.txt"
  if (Test-Path $VersionFile) { $Version = (Get-Content $VersionFile -TotalCount 1).Trim() }
  if (-not $Version) {
    $bn = [IO.Path]::GetFileNameWithoutExtension($ZipPath)
    $m  = [regex]::Match($bn, 'v?(\d+)[._](\d+).*?DEBUG[_\-\s]*(.*)$', 'IgnoreCase')
    if ($m.Success) {
      $suffix = $m.Groups[3].Value.Trim()
      if ($suffix) { $Version = "$($m.Groups[1]).$($m.Groups[2]) DEBUG $suffix" }
      else { $Version = "$($m.Groups[1]).$($m.Groups[2]) DEBUG" }
    } else {
      $Version = "6.10 DEBUG"
    }
  }
  Info ("Version: " + $Version)

  # Items to preserve in repo
  $Preserve = @(".git", ".gitignore", ".github", "deploy.ps1", "deploy.bat", "README.md", "LICENSE")

  # Clean repo (except preserved)
  Info "Cleaning repo"
  Get-ChildItem -LiteralPath $RepoRoot -Force | ForEach-Object {
    if ($Preserve -contains $_.Name) { return }
    try {
      if ($_.PSIsContainer) { Remove-Item -LiteralPath $_.FullName -Recurse -Force -ErrorAction Stop }
      else { Remove-Item -LiteralPath $_.FullName -Force -ErrorAction Stop }
    } catch { Warn ("Could not remove: " + $_.FullName + "  " + $_) }
  }

  # Copy staged build into repo (simple, robust)
  Info "Copying new build"
  Copy-Item -Path (Join-Path $PkgDir '*') -Destination $RepoRoot -Recurse -Force

  # Git commit/push
  Push-Location $RepoRoot
  try {
    Info "git add"
    git add -A | Out-Null

    $status = git status --porcelain
    if (-not $status) {
      Warn "No changes to commit (same contents as last deploy)."
    } else {
      $cb  = [int]((Get-Date).ToUniversalTime().Subtract([datetime]'1970-01-01')).TotalSeconds
      $msg = "deploy: $Version (cb $cb)"
      Info ('git commit -m "' + $msg + '"')
      git commit -m $msg | Out-Null
      Info "git push"
      git push | Out-Null
    }
  }
  finally {
    Pop-Location | Out-Null
  }

  Write-Host "Deploy complete." -ForegroundColor Green
  if($script:TranscriptStarted){ try{ Stop-Transcript | Out-Null }catch{} }
  exit 0
}
catch {
  Write-Host $_ -ForegroundColor Red
  if($script:TranscriptStarted){ try{ Stop-Transcript | Out-Null }catch{} }
  exit 1
}
