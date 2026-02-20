@echo off
setlocal

REM === Battle Plan App - Development Server ===
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

echo Starting Battle Plan App in development mode on port %PORT%...
echo Press Ctrl+C to stop.
echo.

REM Use --webpack to avoid Turbopack junction point issues on some Windows servers
npx next dev -p %PORT% --webpack
