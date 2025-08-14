@echo off
REM Drag a zip onto this .bat, or double-click and it will prompt you.
setlocal
set ZIP=%1
if "%ZIP%"=="" (
  echo Drag a build zip onto this file to deploy.
  echo Or type the path now and press Enter:
  set /p ZIP=ZIP path: 
)
powershell -ExecutionPolicy Bypass -File "%~dp0deploy.ps1" "%ZIP%"
endlocal
