@echo off
setlocal
set CSC_IDENTITY_AUTO_DISCOVERY=false
cd /d "%~dp0"
echo === Luna Windows build ===
where node >nul 2>nul
if errorlevel 1 (
  echo Node.js is not installed. Install the LTS version from https://nodejs.org then run this again.
  pause
  exit /b 1
)
if not exist shared\vendor mkdir shared\vendor
if not exist shared\vendor\three.min.js (
  echo Downloading three.js...
  powershell -NoProfile -Command "[Net.ServicePointManager]::SecurityProtocol=[Net.SecurityProtocolType]::Tls12; Invoke-WebRequest 'https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js' -OutFile 'shared\vendor\three.min.js'"
)
echo Syncing files...
call node sync-shared.js
if errorlevel 1 goto err
cd Client
echo Installing Electron (first time takes a few minutes)...
call npm install
if errorlevel 1 goto err
echo Building...
call npm run dist
if errorlevel 1 goto err
echo.
echo DONE. Your installer is in the Client\dist folder: LunaSetup.exe and Luna-Portable.exe
pause
exit /b 0
:err
echo.
echo BUILD FAILED. Scroll up and read the first red/error line, then send it to Claude.
pause
exit /b 1
