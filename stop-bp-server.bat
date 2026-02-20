@echo off
setlocal

REM === Battle Plan App - Stop Server ===

if not exist bp-server.pid (
    echo No PID file found. Checking for processes on port 4000...
    for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":4000" ^| findstr "LISTENING"') do (
        echo Found process %%a on port 4000. Stopping...
        taskkill /PID %%a /F >nul 2>&1
        echo Server stopped.
        goto :done
    )
    echo No server found running on port 4000.
    goto :done
)

set /p PID=<bp-server.pid

tasklist /FI "PID eq %PID%" 2>nul | find "%PID%" >nul
if errorlevel 1 (
    echo Server process %PID% is not running.
    del bp-server.pid 2>nul
    goto :done
)

echo Stopping server (PID %PID%)...
taskkill /PID %PID% /T /F >nul 2>&1
del bp-server.pid 2>nul
echo Server stopped.

:done
endlocal
