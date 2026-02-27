@echo off
TITLE YTDLox Local Launcher
echo ==========================================
echo       Starting YTDLox Development Server...
echo ==========================================
echo.
echo Installing underlying dependencies if missing...
call npm install

echo.
echo Launching the application...
call npm start

echo.
echo Application closed.
pause
