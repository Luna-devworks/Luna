@echo off
title Luna Server
cd /d "%~dp0Server"
echo Starting Luna Server (needs Node.js 18+ from nodejs.org)
set /p OWN=Owner account name (the Luna account that earns Moon Dust): 
set /p CODE=Owner secret code (make one up): 
node server.js --owner "%OWN%" --owner-code "%CODE%"
pause
