@echo off
title FaceAI - Launcher
cd /d "%~dp0"

echo ============================================
echo   FaceAI Photo Sharing - Launcher
echo ============================================
echo.

REM Ensure data folders exist
if not exist "data" mkdir "data"

REM --- 1. Start MongoDB (if portable install exists and not running) ---
set MONGO_BIN=C:\Users\Sevak\MongoDB\mongodb-win32-x86_64-windows-8.3.8\bin\mongod.exe
set MONGO_DP=C:\Users\Sevak\MongoDB\data\db

tasklist /FI "IMAGENAME eq mongod.exe" 2>NUL | find /I "mongod.exe" >NUL
if %ERRORLEVEL%==0 goto mongo_ok
if exist "%MONGO_BIN%" goto mongo_start
echo [!!] MongoDB binary not found. Running without DB (JSON files used).
goto deps
:mongo_start
echo [..] Starting MongoDB...
if not exist "%MONGO_DP%" mkdir "%MONGO_DP%"
start "FaceAI-MongoDB" "%MONGO_BIN%" --dbpath "%MONGO_DP%" --port 27017 --bind_ip 127.0.0.1
echo [OK] MongoDB started.
goto deps
:mongo_ok
echo [OK] MongoDB already running.

:deps
REM --- 2. Install dependencies if missing ---
if exist "node_modules\express" goto node_start
echo [..] Installing dependencies (first run)...
call npm install
echo [OK] Dependencies installed.

:node_start
REM --- 3. Start Node server (if not already running) ---
tasklist /FI "IMAGENAME eq node.exe" 2>NUL | find /I "node.exe" >NUL
if %ERRORLEVEL%==0 goto node_ok
echo [..] Starting server...
start "FaceAI-Server" /min node server.js
echo [OK] Server started.
goto open
:node_ok
echo [OK] Server already running.

:open
REM --- 4. Wait, then open in browser ---
echo [..] Opening browser...
timeout /t 3 /nobreak >NUL
start "" "http://localhost:3000"

echo.
echo ============================================
echo   Website: http://localhost:3000
echo   Owner  : abhishektiwari234000@gmail.com / owner123
echo   Admin  : admin@faceai.com / admin123
echo   User   : user@faceai.com / user123
echo ============================================
echo.
echo Closing this window is safe (server runs in background).
timeout /t 5 /nobreak >NUL