@echo off
setlocal enabledelayedexpansion

REM === Battle Plan App - Production Server Start ===
REM Works with both Node 20.x and Node 22.x

REM Ensure working directory is the app folder (critical for Task Scheduler)
cd /d "%~dp0"

set PORT=4000

REM === Swap correct better-sqlite3 binary for current Node version ===
for /f "tokens=1 delims=." %%v in ('node -v') do set NODE_MAJOR=%%v
set NODE_MAJOR=%NODE_MAJOR:v=%

set PREBUILDS=node_modules\better-sqlite3\prebuilds
set TARGET=node_modules\better-sqlite3\build\Release\better_sqlite3.node

if "%NODE_MAJOR%"=="22" (
    if exist "%PREBUILDS%\better_sqlite3_node22.node" (
        copy /y "%PREBUILDS%\better_sqlite3_node22.node" "%TARGET%" >nul 2>&1
        echo Loaded better-sqlite3 binary for Node 22
    )
) else (
    if exist "%PREBUILDS%\better_sqlite3_node20.node" (
        copy /y "%PREBUILDS%\better_sqlite3_node20.node" "%TARGET%" >nul 2>&1
        echo Loaded better-sqlite3 binary for Node 20
    )
)

REM Check if already running
if exist bp-server.pid (
    set /p OLD_PID=<bp-server.pid
    tasklist /FI "PID eq !OLD_PID!" 2>nul | find "!OLD_PID!" >nul
    if not errorlevel 1 (
        echo Server is already running on PID !OLD_PID!
        echo Use stop-bp-server.bat to stop it first.
        exit /b 1
    ) else (
        del bp-server.pid 2>nul
    )
)

REM Build if .next directory doesn't exist
if not exist ".next" (
    echo Building production bundle...
    call npx next build --webpack
    if errorlevel 1 (
        echo Build failed!
        exit /b 1
    )
)

echo Starting Battle Plan App on port %PORT%...

REM Start the server in the background
start /b "" cmd /c "node node_modules\next\dist\bin\next start -p %PORT% > bp-server.log 2>&1 & echo Server stopped"

REM Wait briefly then capture PID
timeout /t 2 /nobreak >nul

REM Find the node process running on our port
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":%PORT%" ^| findstr "LISTENING"') do (
    echo %%a > bp-server.pid
    echo Server started with PID %%a
    echo Listening on http://localhost:%PORT%
    echo Log file: bp-server.log
    goto :done
)

echo Warning: Could not detect server PID. Check bp-server.log for errors.

:done
endlocal
