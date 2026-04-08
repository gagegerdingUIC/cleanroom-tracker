@echo off
title Cleanroom Tracker

set "PROJECT=%~dp0"

echo Starting Cleanroom Tracker...
echo.

:: Start backend
start "Backend - FastAPI" cmd /k "cd /d %PROJECT%\backend && .venv\Scripts\activate && python -m uvicorn app.main:app --reload"

:: Wait a moment for backend to begin starting
timeout /t 2 /nobreak >nul

:: Start frontend
start "Frontend - Vite" cmd /k "cd /d %PROJECT%\frontend && npm run dev"

:: Wait for Vite to be ready, then open browser
timeout /t 4 /nobreak >nul
start http://localhost:5173

echo Both servers are starting in separate windows.
echo   Backend:  http://localhost:8000
echo   Frontend: http://localhost:5173
echo.
echo Close the server windows to stop them.
pause
