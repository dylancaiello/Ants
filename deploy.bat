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

REM --- Unblock files ---
powershell -NoLogo -NoProfile -Command ^
  "foreach($p in @('%SCRIPT%','%ZIP%')){ if(Test-Path $p){ try{ Unblock-File -LiteralPath $p -ErrorAction SilentlyContinue }catch{} } }"

REM --- Run the PowerShell deploy (no browser opening here) ---
powershell -NoLogo -NoProfile -ExecutionPolicy Bypass -File "%SCRIPT%" "%ZIP%"
if errorlevel 1 (
  echo Deploy failed. Press any key to exit.
  pause
  exit /b 1
)

REM --- Read VERSION.txt inside the ZIP (fallback to filename) ---
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

REM --- Build URL with fresh cache-buster ---
set "VER=%VER: =+%"
set "CB=%RANDOM%%RANDOM%"
set "URL=https://dylancaiello.github.io/Ants/?v=%VER%&cb=%CB%"

echo Opening: %URL%
start "" "%URL%"

echo.
echo Done.
pause
