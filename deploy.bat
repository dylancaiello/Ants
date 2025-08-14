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

REM Optional: sanity check the zip looks like a .zip
echo ZIP: "%ZIP%"
echo SCRIPT: "%SCRIPT%"
echo.

REM Run PowerShell with proper flags; keep window open on error
powershell -NoLogo -NoProfile -ExecutionPolicy Bypass -Command ^
  "try { & '%SCRIPT%' '%ZIP%' } catch { Write-Host 'PS ERROR:' $_ -ForegroundColor Red; Read-Host 'Press Enter to exit'; exit 1 }"

echo.
echo Done.
pause
