@echo off
setlocal
cd /d "%~dp0"
echo AI 学习星图 Windows CMD 启动脚本

where py >nul 2>nul
if %errorlevel%==0 (
  py -3.12 scripts\bootstrap.py %*
  goto :done
)

where python >nul 2>nul
if %errorlevel%==0 (
  python scripts\bootstrap.py %*
  goto :done
)

echo 未找到 Python。请安装 Python 3.12 或更高版本，并勾选 Add python.exe to PATH。
exit /b 1

:done
if not %errorlevel%==0 (
  echo 启动失败，请根据上方提示处理后重试。
  exit /b %errorlevel%
)
endlocal
