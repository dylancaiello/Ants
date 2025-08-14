# deploy.ps1 — robust ZIP deploy (no browser open; BAT handles URL)
param(
  [Parameter(Mandatory = $true)]
  [string]$ZipPath
)

$ErrorActionPreference = 'Stop'
$ProgressPreference    = 'SilentlyContinue'

function Fail($msg){ Write-Host "`nERROR: $msg" -ForegroundColor Red; exit 1 }
function Info($msg){ Write-Host "[deploy] $msg" -ForegroundColor Cyan }
function Warn($msg){ Write-Host "[deploy] $msg" -ForegroundColor Yellow }

# Resolve & validate inputs
try {
  $ZipPath = (Resolve-Path $ZipPath).Path
} catch { Fail "Zip not found: $ZipPath" }
if ([IO.Path]::GetExtension($ZipPath).ToLower() -ne ".zip") { Fail "Not a .zip file: $ZipPath" }

# Repo root = folder containing this script (must be a git repo)
$RepoRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
if (-not (Test-Path (Join-Path $RepoRoot ".git"))) { Fail "No .git folder at $RepoRoot" }

# Temp staging
$Staging = Join-Path ([IO.Path]::GetTempPath()) ("ants_deploy_" + [Guid]::NewGuid().ToString("N"))
New-Item -ItemType Directory -Path $Staging | Out-Null

# Extract ZIP to staging (try Expand-Archive, then .NET ZipFile)
Info "Extracting $ZipPath"
try {
  Expand-Archive -Path $ZipPath -DestinationPath $Staging -Force
} catch {
  Add-Type -AssemblyName System.IO.Compression.FileSystem
  [System.IO.Compression.ZipFile]::ExtractToDirectory($ZipPath, $Staging)
}

# Find the folder that CONTAINS index.html (works for root or nested)
$IndexFile = Get-ChildItem -LiteralPath $Staging -Recurse -File -Filter 'index.html' | Select-Object -First 1
if (-not $IndexFile) { Fail "Package missing index.html" }
$PkgDir = Split-Path -Parent $IndexFile.FullName
Info "Package folder: $PkgDir"

# Read VERSION.txt (optional, first line only)
$Version = $null
$VersionFile = Join-Path $PkgDir "VERSION.txt"
if (Test-Path $VersionFile) {
  $Version = (Get-Content $VersionFile -TotalCount 1).Trim()
}
if (-not $Version) {
  # Fallback like Ants_v6_10_DEBUG_fixU.zip -> 6.10 DEBUG fixU
  $bn = [IO.Path]::GetFileNameWithoutExtension($ZipPath)
  $m  = [regex]::Match($bn, 'v?(\d+)[._](\d+).*?DEBUG[_\-\s]*(.*)$', 'IgnoreCase')
  if ($m.Success) {
    $suffix = $m.Groups[3].Value.Trim()
    $Version = if ($suffix) { "$($m.Groups[1]).$($m.Groups[2]) DEBUG $suffix" } else { "$($m.Groups[1]).$($m.Groups[2]) DEBUG" }
  } else { $Version = "6.10 DEBUG" }
}
Info "Version: $Version"

# Preserve these repo items
$Preserve = @(".git", ".gitignore", ".github", "deploy.ps1", "deploy.bat", "README.md", "LICENSE")

# Clean repo (except preserved)
Info "Cleaning repo"
Get-ChildItem -LiteralPath $RepoRoot -Force | ForEach-Object {
  if ($Preserve -contains $_.Name) { return }
  try {
    if ($_.PSIsContainer) { Remove-Item -LiteralPath $_.FullName -Recurse -Force -ErrorAction Stop }
    else { Remove-Item -LiteralPath $_.FullName -Force -ErrorAction Stop }
  } catch { Warn "Could not remove: $($_.FullName)  $_" }
}

# Copy staged build into repo, preserving structure from $PkgDir
Info "Copying new build"
# Create directories
Get-ChildItem -LiteralPath $PkgDir -Recurse | Where-Object { $_.PSIsContainer } | ForEach-Object {
  $rel  = $_.FullName.Substring($PkgDir.Length).TrimStart('\','/')
  if ($rel -eq "") { return }
  $dest = Join-Path $RepoRoot $rel
  if (-not (Test-Path $dest)) { New-Item -ItemType Directory -Path $dest | Out-Null }
}
# Copy files
Get-ChildItem -LiteralPath $PkgDir -Recurse -File | ForEach-Object {
  $rel  = $_.FullName.Substring($PkgDir.Length).TrimStart('\','/')
  $dest = Join-Path $RepoRoot $rel
  Copy-Item -LiteralPath $_.FullName -Destination $dest -Force
}

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
    Info "git commit -m `"$msg`""
    git commit -m "$msg" | Out-Null
    Info "git push"
    git push | Out-Null
  }
}
finally {
  Pop-Location | Out-Null
}

# Cleanup
try { Remove-Item -LiteralPath $Staging -Recurse -Force } catch {}

Write-Host "Deploy complete." -ForegroundColor Green
exit 0
