@echo off
setlocal EnableExtensions EnableDelayedExpansion

set "SCRIPT=%~dp0deploy.ps1"
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

REM Unblock files (avoid Zone.Identifier issues)
powershell -NoLogo -NoProfile -Command ^
  "foreach($p in @('%SCRIPT%','%ZIP%')){ if(Test-Path $p){ try{ Unblock-File -LiteralPath $p -ErrorAction SilentlyContinue }catch{} } }"

REM Prepare log
set "LOG=%TEMP%\ants_deploy_%RANDOM%%RANDOM%.log"
set "ANTS_LOG=%LOG%"

REM Run PowerShell in a NEW window that stays open no matter what.
REM We write both stdout/stderr to %LOG% and then print it.
start "Ants Deploy" cmd /k ^
  "echo Writing log to: %LOG% && ^
   powershell -NoLogo -NoProfile -ExecutionPolicy Bypass -File "%SCRIPT%" "%ZIP%" 1>>"%LOG%" 2>&1 && ^
   echo. && ^
   echo ===== DEPLOY LOG ===== && ^
   type "%LOG%" && ^
   echo ===== END LOG ===== && ^
   echo. && ^
   echo If anything failed, scroll up to see the error. && ^
   echo. && ^
   echo Press any key here to continue... && pause >nul"

REM Give the deploy window a second to start
timeout /t 1 >nul

REM Build URL (read VERSION.txt from the ZIP; fallback to ZIP name)
for /f "usebackq delims=" %%V in (`
  powershell -NoLogo -NoProfile -Command ^
    "Add-Type -AssemblyName System.IO.Compression.FileSystem; ^
     $z='%ZIP%'; $ver=$null; ^
     try{ $fs=[IO.File]::OpenRead($z); $zip=New-Object IO.Compression.ZipArchive($fs); ^
          $e=$zip.GetEntry('VERSION.txt'); if($e){ $sr=New-Object IO.StreamReader($e.Open()); $ver=$sr.ReadLine(); $sr.Close() } ^
          $zip.Dispose(); $fs.Dispose() }catch{}; ^
     if(-not $ver){ ^
       $bn=[IO.Path]::GetFileNameWithoutExtension($z); ^
       if($bn -match 'v?(\d+)[._](\d+).*?DEBUG[_-\s]*(.*)$'){ ^
         if($matches[3]){ $ver = ($matches[1]+'.'+$matches[2]+' DEBUG '+$matches[3]) } else { $ver = ($matches[1]+'.'+$matches[2]+' DEBUG') } ^
       } else { $ver='6.10 DEBUG' } ^
     }; ^
     $ver"
`) do set "VER=%%V"

set "VER=%VER: =+%"
set "CB=%RANDOM%%RANDOM%"
set "URL=https://dylancaiello.github.io/Ants/?v=%VER%&cb=%CB%"

echo Opening: %URL%
start "" "%URL%"

echo.
echo Done. (The deploy window is still open—check it if anything looked off.)
pause
