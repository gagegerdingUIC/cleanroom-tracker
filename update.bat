@echo off
title Cleanroom Tracker - Update
set "PROJECT=%~dp0"

echo ============================================
echo   Cleanroom Tracker - Update Dependencies
echo ============================================
echo.
echo Run this after "git pull" to install any new dependencies.
echo.

:: Backend
echo --- Updating backend ---
cd /d "%PROJECT%backend"
call .venv\Scripts\activate
pip install -r requirements.txt --quiet
if errorlevel 1 (
    echo [ERROR] Failed to update Python dependencies.
    pause
    exit /b 1
)
echo [OK] Backend dependencies up to date.

:: Frontend
echo.
echo --- Updating frontend ---
cd /d "%PROJECT%frontend"
call npm install --silent
if errorlevel 1 (
    echo [ERROR] Failed to update Node dependencies.
    pause
    exit /b 1
)
echo [OK] Frontend dependencies up to date.

echo.
echo ============================================
echo   Update complete! Run start.bat to launch.
echo ============================================
echo.
pause
