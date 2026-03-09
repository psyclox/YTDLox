@echo off
TITLE YTDLox Local Launcher
echo ==========================================
echo       Starting YTDLox...
echo ==========================================
echo.

echo Installing dependencies if missing...
call npm install

echo.
echo Launching YTDLox...
node_modules\electron\dist\electron.exe .

echo.
echo Application closed.
pause
