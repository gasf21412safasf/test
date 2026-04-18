@echo off
setlocal
cd /d "%~dp0"

where go >nul 2>nul
if errorlevel 1 (
  echo [ERROR] Go is not installed or not in PATH.
  echo Install Go from https://go.dev/dl/
  pause
  exit /b 1
)

where npm >nul 2>nul
if errorlevel 1 (
  echo [ERROR] npm is not installed or not in PATH.
  echo Install Node.js from https://nodejs.org/
  pause
  exit /b 1
)

if not exist "node_modules" (
  echo Installing frontend dependencies...
  call npm install
  if errorlevel 1 goto :fail
)

echo Building frontend TypeScript...
call npm run build:ts
if errorlevel 1 goto :fail

echo Starting Go server on http://localhost:8080/captcha/
go run .\cmd\server
if errorlevel 1 goto :fail

exit /b 0

:fail
echo.
echo Startup failed.
pause
exit /b 1
