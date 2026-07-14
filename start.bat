@echo off
setlocal
cd /d "%~dp0"
echo AI Learning Starmap - Windows CMD bootstrap

where py >nul 2>nul
if not errorlevel 1 (
  py -3.12 scripts\bootstrap.py %*
  call :check_result "py -3.12"
  endlocal
  exit /b
)

where python >nul 2>nul
if not errorlevel 1 (
  python scripts\bootstrap.py %*
  call :check_result "python"
  endlocal
  exit /b
)

echo Python was not found. Please install Python 3.12+ and enable "Add python.exe to PATH."
exit /b 1

:check_result
if not errorlevel 1 exit /b 0
echo Startup failed. Please follow the hints above and retry.
exit /b 1
