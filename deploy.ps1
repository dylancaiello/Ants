param (
    [string]$ZipPath = $null
)

function Fail($msg) {
    Write-Host ""
    Write-Host ("ERROR: " + $msg) -ForegroundColor Red
    Pause
    exit 1
}

# Accept drag & drop arg or CLI arg
if (-not $ZipPath) {
    if ($args.Count -gt 0) { $ZipPath = $args[0] } else { Fail "Drag a build zip onto deploy.ps1 OR run .\deploy.ps1 path\to\zip" }
}

# Normalize & validate
$ZipPath = [System.IO.Path]::GetFullPath($ZipPath)
if (-not (Test-Path -LiteralPath $ZipPath -PathType Leaf)) { Fail ("Zip not found: " + $ZipPath) }
if ([System.IO.Path]::GetExtension($ZipPath).ToLower() -ne ".zip") { Fail ("Not a .zip file: " + $ZipPath) }

# Work from script folder (repo root)
$RepoRoot = $PSScriptRoot
if (-not (Test-Path -LiteralPath $RepoRoot)) { Fail ("Repo root not found: " + $RepoRoot) }
Set-Location -LiteralPath $RepoRoot

# Extract to temp
$TmpRoot = Join-Path $env:TEMP ([System.Guid]::NewGuid().ToString())
New-Item -ItemType Directory -Path $TmpRoot | Out-Null
try { Expand-Archive -Path $ZipPath -DestinationPath $TmpRoot -Force } catch { Fail ("Failed to extract zip: " + $_) }

# Locate folder that contains index.html
$PkgDir = $null
if (Test-Path -LiteralPath (Join-Path $TmpRoot 'index.html')) {
    $PkgDir = Get-Item -LiteralPath $TmpRoot
} else {
    $PkgDir = Get-ChildItem -LiteralPath $TmpRoot -Directory | Where-Object {
        Test-Path -LiteralPath (Join-Path $_.FullName 'index.html')
    } | Select-Object -First 1
    if (-not $PkgDir) {
        $PkgDir = Get-ChildItem -LiteralPath $TmpRoot -Recurse -Directory | Where-Object {
            Test-Path -LiteralPath (Join-Path $_.FullName 'index.html')
        } | Select-Object -First 1
    }
    if (-not $PkgDir) { Fail "Could not find any extracted folder containing index.html" }
}

if (-not (Test-Path -LiteralPath (Join-Path $PkgDir.FullName 'index.html'))) {
    Fail ("index.html not found in package: " + $PkgDir.FullName)
}
if ($PkgDir.FullName -match '^[A-Za-z]:\\$') {
    Fail ("Safety stop: resolved package is drive root (" + $PkgDir.FullName + ")")
}

# Replace files in repo (keep meta)
$Keep = @('.git', '.gitignore', 'README.md', 'deploy.ps1', 'deploy.bat')
Get-ChildItem -LiteralPath $RepoRoot -Force | Where-Object { $Keep -notcontains $_.Name } |
    Remove-Item -Recurse -Force -ErrorAction SilentlyContinue

# Copy new build (use -Path so wildcard expands)
Copy-Item -Path (Join-Path $PkgDir.FullName '*') -Destination $RepoRoot -Recurse -Force -ErrorAction Stop

# Verify index.html landed
$IndexPath = Join-Path $RepoRoot 'index.html'
if (-not (Test-Path -LiteralPath $IndexPath)) { Fail ("Copy failed - index.html not found at " + $IndexPath) }

# Build commit message
$Ver = "update"
$VerMatch = Select-String -Path $IndexPath -Pattern 'v[0-9]+\.[0-9]+' -AllMatches
if ($VerMatch) { $Ver = ($VerMatch.Matches.Value | Select-Object -First 1) }

$Label = ""
if ($ZipPath -match '(?i)debug') { $Label = "debug" }
elseif ($ZipPath -match '(?i)prod|clean') { $Label = "prod" }

$CommitMsg = "deploy: " + $Ver
if ($Label -ne "") { $CommitMsg = $CommitMsg + " " + $Label }

# Commit & push
git add -A
git commit -m $CommitMsg
git push

# Build cache-busted URL (encode spaces only; avoid & by using %26)
$VerLabel = $Ver
if ($Label -ne "") { $VerLabel = $VerLabel + " " + $Label }
$VerParam = $VerLabel -replace ' ', '%20'
$CacheBuster = [int](Get-Date -UFormat %s)
$Url = 'https://dylancaiello.github.io/Ants/?v=' + $VerParam + '%26cb=' + $CacheBuster

Write-Host ""
Write-Host ("Deployed " + $CommitMsg)
Write-Host ("Opening " + $Url)
Start-Process $Url

Pause
