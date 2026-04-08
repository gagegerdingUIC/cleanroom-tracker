@echo off
title Cleanroom Tracker - Setup
set "PROJECT=%~dp0"

echo ============================================
echo   Cleanroom Tracker - First Time Setup
echo ============================================
echo.

:: Check for Python
python --version >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Python is not installed or not in PATH.
    echo         Download it from https://www.python.org/downloads/
    echo         IMPORTANT: Check "Add Python to PATH" during install.
    echo.
    pause
    exit /b 1
)
echo [OK] Python found.

:: Check for Node
node --version >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Node.js is not installed or not in PATH.
    echo         Download it from https://nodejs.org/
    echo         The LTS version is recommended.
    echo.
    pause
    exit /b 1
)
echo [OK] Node.js found.

:: Backend setup
echo.
echo --- Setting up backend ---
cd /d "%PROJECT%backend"

if not exist ".venv" (
    echo Creating Python virtual environment...
    python -m venv .venv
)

call .venv\Scripts\activate
echo Installing Python dependencies (this may take a minute)...
pip install -r requirements.txt --quiet
if errorlevel 1 (
    echo [ERROR] Failed to install Python dependencies.
    pause
    exit /b 1
)
echo [OK] Backend dependencies installed.

:: Copy .env if it doesn't exist
if not exist ".env" (
    if exist ".env.example" (
        copy ".env.example" ".env" >nul
        echo [OK] Created backend .env from example (defaults are fine).
    )
) else (
    echo [OK] Backend .env already exists.
)

:: Frontend setup
echo.
echo --- Setting up frontend ---
cd /d "%PROJECT%frontend"

echo Installing Node dependencies (this may take a minute)...
call npm install --silent
if errorlevel 1 (
    echo [ERROR] Failed to install Node dependencies.
    pause
    exit /b 1
)
echo [OK] Frontend dependencies installed.

:: Done
echo.
echo ============================================
echo   Setup complete!
echo.
echo   To start the app, double-click: start.bat
echo ============================================
echo.
pause
