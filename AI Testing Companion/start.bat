@echo off
REM ================================================================
REM AI TESTING COMPANION - STARTUP SCRIPT (Windows Batch)
REM ================================================================
REM
REM This script starts the AI Testing Companion server
REM
REM ================================================================

echo.
echo ================================================================
echo    AI TESTING COMPANION - Starting Server
echo ================================================================
echo.

REM Check if Node.js is installed
where node >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Node.js is not installed or not in PATH
    echo Please install Node.js from https://nodejs.org
    pause
    exit /b 1
)

echo [INFO] Node.js found: 
node --version
echo.

REM Check if node_modules exists
if not exist "node_modules\" (
    echo [INFO] Installing dependencies...
    echo.
    call npm install
    if %ERRORLEVEL% NEQ 0 (
        echo [ERROR] Failed to install dependencies
        pause
        exit /b 1
    )
    echo.
)

REM Check if config.js exists
if not exist "backend\config.js" (
    echo [WARNING] config.js not found!
    echo Please copy backend\config.example.js to backend\config.js
    echo and update with your credentials.
    echo.
    pause
    exit /b 1
)

echo [INFO] Starting AI Testing Companion server...
echo.
echo Dashboard will be available at: http://localhost:3002
echo.
echo Press Ctrl+C to stop the server
echo.
echo ================================================================
echo.

REM Start the server
node backend\server.js

pause
