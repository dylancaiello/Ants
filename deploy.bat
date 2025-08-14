@echo off
setlocal EnableExtensions EnableDelayedExpansion

REM --- paths ---
set "SCRIPT=%~dp0deploy.ps1"
set "ZIP=%~1"

REM --- get zip path (drag & drop or prompt) ---
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

REM --- run the PowerShell deploy (no browser open here) ---
powershell -NoLogo -NoProfile -ExecutionPolicy Bypass -File "%SCRIPT%" "%ZIP%"
if errorlevel 1 (
  echo Deploy failed.
