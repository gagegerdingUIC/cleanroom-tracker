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
    echo         After installing, RESTART your computer then try again.
    echo.
    pause
    exit
)
for /f "tokens=*" %%i in ('python --version 2^>^&1') do echo [OK] %%i found.

:: Check for Node
node --version >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Node.js is not installed or not in PATH.
    echo         Download it from https://nodejs.org/
    echo         The LTS version is recommended.
    echo         After installing, RESTART your computer then try again.
    echo.
    pause
    exit
)
for /f "tokens=*" %%i in ('node --version 2^>^&1') do echo [OK] Node.js %%i found.

:: Check for npm
cmd /c "npm --version" >nul 2>&1
if errorlevel 1 (
    echo [ERROR] npm is not installed or not in PATH.
    echo         It should come with Node.js. Try reinstalling Node.js
    echo         and RESTART your computer.
    echo.
    pause
    exit
)
for /f "tokens=*" %%i in ('npm --version 2^>^&1') do echo [OK] npm %%i found.

:: Backend setup
echo.
echo --- Setting up backend ---
cd /d "%PROJECT%backend"

if not exist ".venv" (
    echo Creating Python virtual environment...
    python -m venv .venv
    if errorlevel 1 (
        echo [ERROR] Failed to create Python virtual environment.
        pause
        exit
    )
)

call .venv\Scripts\activate
echo Installing Python dependencies (this may take a minute)...
pip install -r requirements.txt
if errorlevel 1 (
    echo.
    echo [ERROR] Failed to install Python dependencies.
    pause
    exit
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
cmd /c "npm install"
if errorlevel 1 (
    echo.
    echo [ERROR] Failed to install Node dependencies.
    pause
    exit
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
echo Press any key to close this window...
pause >nul
