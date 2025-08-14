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

set "CB=%RANDOM%%RANDOM%"
start "" "https://dylancaiello.github.io/Ants/?v=6.10+DEBUG+fixP&cb=%CB%"

echo.
echo Done.
pause
