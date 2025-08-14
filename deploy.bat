@echo off
setlocal EnableExtensions EnableDelayedExpansion

REM Path to the PowerShell script (same folder as this BAT)
set "SCRIPT=%~dp0deploy.ps1"

REM ZIP argument (supports drag & drop)
set "ZIP=%~1"

if "%ZIP%"=="" (
  echo Drag a build zip onto this file, or type the path and press Enter:
  set /p "ZIP=ZIP path: "
)

if not exist "%SCRIPT%" (
  echo ERROR: deploy.ps1 not found at "%SCRIPT%"
  echo.
  pause
  exit /b 1
)

echo ZIP: "%ZIP%"
echo SCRIPT: "%SCRIPT%"
echo.

powershell -NoLogo -NoProfile -ExecutionPolicy Bypass -Command ^
  "try { & '%SCRIPT%' '%ZIP%' } catch { Write-Host 'PS ERROR:' $_ -ForegroundColor Red; exit 1 }"

REM Open page only if deploy succeeded
if errorlevel 1 (
  echo Deploy failed. Press any key to exit.
  pause
  exit /b 1
)

REM --- Build the URL with version + cache buster, then open it ---
powershell -NoLogo -NoProfile -ExecutionPolicy Bypass -Command ^
  "$z = '%ZIP%';" ^
  "$cb = [int]((Get-Date).ToUniversalTime().Subtract([datetime]'1970-01-01')).TotalSeconds);" ^
  "Add-Type -AssemblyName System.IO.Compression.FileSystem;" ^
  "$ver = $null;" ^
  "try {" ^
  "  $fs = [System.IO.File]::OpenRead($z);" ^
  "  $zip = New-Object System.IO.Compression.ZipArchive($fs);" ^
  "  $entry = $zip.GetEntry('VERSION.txt');" ^
  "  if($entry){ $sr = New-Object IO.StreamReader($entry.Open()); $line = $sr.ReadLine(); $sr.Close(); $ver = $line }" ^
  "} catch {} finally { if($zip){$zip.Dispose()} if($fs){$fs.Dispose()} }" ^
  "if(-not $ver) {" ^
  "  $bn = [System.IO.Path]::GetFileNameWithoutExtension($z);" ^
  "  $m = [regex]::Match($bn, 'v?(\d+\.\d+)[ _-]*DEBUG[ _-]*(.*)$');" ^
  "  if($m.Success) {" ^
  "    $suffix = $m.Groups[2].Value.Trim();" ^
  "    if($suffix){ $ver = ($m.Groups[1].Value + ' DEBUG ' + $suffix) } else { $ver = ($m.Groups[1].Value + ' DEBUG') }" ^
  "  } else { $ver = 'v6.10 DEBUG' }" ^
  "}" ^
  "$vparam = ($ver -replace '\s+','+');" ^
  "$url = 'https://dylancaiello.github.io/Ants/?v=' + $vparam + '&cb=' + $cb;" ^
  "Start-Process $url"

echo.
echo Done.
pause
