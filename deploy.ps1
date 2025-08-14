param (
    [string]$ZipPath = $null
)

# --- Helpers ---
function Fail($msg) { Write-Host "`nERROR: $msg" -ForegroundColor Red; Pause; exit 1 }

# Accept drag-drop arg
if (-not $ZipPath) { if ($args.Count -gt 0) { $ZipPath = $args[0] } else { Fail "Drag a zip onto deploy.ps1 OR run .\deploy.ps1 path\to\zip" } }

# Normalize & validate zip
$ZipPath = [System.IO.Path]::GetFullPath($ZipPath)
if (-not (Test-Path -LiteralPath $ZipPath -PathType Leaf)) { Fail "Zip not found: $ZipPath" }
if ([System.IO.Path]::GetExtension($ZipPath).ToLower() -ne ".zip") { Fail "Not a .zip file: $ZipPath" }

# Work from the script's folder
$RepoRoot = $PSScriptRoot
if (-not (Test-Path -LiteralPath $RepoRoot)) { Fail "Repo root not found: $RepoRoot" }
Set-Location -LiteralPath $RepoRoot

# Temp dir
$TmpRoot = Join-Path $env:TEMP ([System.Guid]::NewGuid().ToString())
New-Item -ItemType Directory -Path $TmpRoot | Out-Null

# Extract
try {
    Expand-Archive -Path $ZipPath -DestinationPath $TmpRoot -Force
} catch {
    Fail "Failed to extract zip: $ZipPath. $_"
}

# Pick package folder (dir containing index.html). Our zips have a top-level folder.
$PkgDir = Get-ChildItem -LiteralPath $TmpRoot -Directory | Select-Object -First 1
if (-not $PkgDir) { 
    # maybe files are at root
    if (Test-Path (Join-Path $TmpRoot 'index.html')) {
        $PkgDir = Get-Item $TmpRoot
    } else {
        Fail "Couldn’t find extracted package folder with index.html"
    }
}
# sanity: ensure index.html exists in selected folder
if (-not (Test-Path (Join-Path $PkgDir.FullName 'index.html'))) {
    Fail "index.html not found in package: $($PkgDir.FullName)"
}
# extra sanity: never copy from drive root
if ($PkgDir.FullName -match '^[A-Za-z]:\\$') { Fail "Safety stop: resolved package is drive root ($($PkgDir.FullName))" }

# Keep only repo meta files
$Keep = @('.git', '.gitignore', 'README.md', 'deploy.ps1', 'deploy.bat')
Get-ChildItem -LiteralPath $RepoRoot -Force |
    Where-Object { $Keep -notcontains $_.Name } |
    Remove-Item -Recurse -Force -ErrorAction SilentlyContinue

# Copy new build
Copy-Item -LiteralPath (Join-Path $PkgDir.FullName '*') -Destination $RepoRoot -Recurse -Force

# Version + label
$IndexPath = Join-Path $RepoRoot 'index.html'
$Ver = (Select-String -Path $IndexPath -Pattern 'v[0-9]+\.[0-9]+' -AllMatches | ForEach-Object { $_.Matches.Value } | Select-Object -First 1)
if (-not $Ver) { $Ver = "update" }
$Label = if ($ZipPath -match '(?i)debug') { 'debug' } elseif ($ZipPath -match '(?i)prod|clean') { 'prod' } else { '' }
$CommitMsg = "deploy: $Ver" + ($(if ($Label) { " $Label" } else { "" }))

# Commit
git add -A
git commit -m $CommitMsg
git push

# Open cache-busted URL
Add-Type -AssemblyName System.Web
$VerParam = [System.Web.HttpUtility]::UrlEncode($Ver + ($(if ($Label) { " $Label" } else { "" })))
$CacheBuster = [int](Get-Date -UFormat %s)
$Url = "https://dylancaiello.github.io/Ants/?v=$VerParam&cb=$CacheBuster"

Write-Host "`nDeployed $CommitMsg"
Write-Host "Opening $Url"
Start-Process $Url

Pause
