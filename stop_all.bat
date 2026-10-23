@echo off
echo ===================================================
echo Stopping XFL-IoMT Clinical Decision Gateway
echo ===================================================

echo Stopping Node.js Dashboard (Port 3000)...
for /f "tokens=5" %%a in ('netstat -aon ^| findstr :3000') do taskkill /f /pid %%a 2>nul

echo Stopping Hospital A Node (Port 8001)...
for /f "tokens=5" %%a in ('netstat -aon ^| findstr :8001') do taskkill /f /pid %%a 2>nul

echo Stopping Hospital B Node (Port 8002)...
for /f "tokens=5" %%a in ('netstat -aon ^| findstr :8002') do taskkill /f /pid %%a 2>nul

echo ===================================================
echo All services stopped successfully!
echo ===================================================
pause
