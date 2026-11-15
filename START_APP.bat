@echo off
title ExamCraft AI Launcher
chcp 65001 >nul
cls
echo ===================================================
echo           ExamCraft AI - Application Startup
echo ===================================================
echo.

:: Check Python installation
where python >nul 2>nul
if %errorlevel% neq 0 (
    echo [ERROR] Python is not found in your system PATH!
    echo Please install Python 3.10 or newer from https://www.python.org/
    echo Make sure to check "Add Python to PATH" during installation.
    echo.
    pause
    exit /b 1
)

:: Create virtual environment if not already present
if not exist ".venv\Scripts\python.exe" (
    echo [*] Creating virtual environment (.venv)...
    python -m venv .venv
    if %errorlevel% neq 0 (
        echo [ERROR] Failed to create virtual environment.
        pause
        exit /b 1
    )
    echo [*] Installing required dependencies...
    .\.venv\Scripts\pip install -r requirements.txt
    if %errorlevel% neq 0 (
        echo [!] Falling back to requirements-base.txt...
        .\.venv\Scripts\pip install -r requirements-base.txt
    )
)

:: Launch the application
echo.
echo [*] Starting ExamCraft AI backend and web server...
echo [*] Server will be available at: http://127.0.0.1:8000
echo.

:: Open browser after 2 seconds in background
start "" /b cmd /c "timeout /t 2 /nobreak >nul & start http://127.0.0.1:8000"

:: Start Uvicorn
.\.venv\Scripts\python.exe -m uvicorn app.main:app --app-dir apps/api --host 127.0.0.1 --port 8000

pause
