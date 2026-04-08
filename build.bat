@echo off
setlocal
title Build Cleanroom Tracker
set "PROJECT=%~dp0"

echo ============================================
echo   Building Cleanroom Tracker Desktop App
echo ============================================
echo.

:: Step 1: Build the frontend
echo [1/3] Building frontend...
cd /d "%PROJECT%frontend"
call npm install --silent
set "VITE_API_URL="
call npm run build
if errorlevel 1 (
    echo [ERROR] Frontend build failed.
    pause
    exit /b 1
)
echo [OK] Frontend built.
echo.

:: Step 2: Copy frontend dist into backend for bundling
echo [2/3] Preparing files...
if exist "%PROJECT%backend\frontend_dist" rmdir /s /q "%PROJECT%backend\frontend_dist"
xcopy /e /i /q "%PROJECT%frontend\dist" "%PROJECT%backend\frontend_dist"
echo [OK] Frontend files staged.
echo.

:: Step 3: Run PyInstaller
echo [3/3] Running PyInstaller (this may take a minute)...
cd /d "%PROJECT%backend"
call .venv\Scripts\activate
python -m PyInstaller ^
    --name "CleanroomTracker" ^
    --noconfirm ^
    --console ^
    --add-data "frontend_dist;frontend_dist" ^
    --add-data "app;app" ^
    --hidden-import "uvicorn.logging" ^
    --hidden-import "uvicorn.loops" ^
    --hidden-import "uvicorn.loops.auto" ^
    --hidden-import "uvicorn.protocols" ^
    --hidden-import "uvicorn.protocols.http" ^
    --hidden-import "uvicorn.protocols.http.auto" ^
    --hidden-import "uvicorn.protocols.websockets" ^
    --hidden-import "uvicorn.protocols.websockets.auto" ^
    --hidden-import "uvicorn.lifespan" ^
    --hidden-import "uvicorn.lifespan.on" ^
    --hidden-import "uvicorn.lifespan.off" ^
    launcher.py

if errorlevel 1 (
    echo [ERROR] PyInstaller build failed.
    pause
    exit /b 1
)

:: Clean up temporary copy
rmdir /s /q "%PROJECT%backend\frontend_dist"

echo.
echo ============================================
echo   Build complete!
echo.
echo   Output: backend\dist\CleanroomTracker\
echo   Run:    backend\dist\CleanroomTracker\CleanroomTracker.exe
echo ============================================
echo.
pause
