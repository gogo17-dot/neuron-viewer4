@echo off
cd /d "%~dp0"
cls
echo.
echo  ========================================
echo   Neuron viewer
echo   THIS folder is being served:
echo   %CD%
echo  ========================================
echo.
echo  Starting server on port 8765 ...
echo  Opening browser (refresh once if the page is blank).
echo  Press Ctrl+C in this window to stop the server.
echo.
start "" "http://127.0.0.1:8765/"
py -m http.server 8765
if errorlevel 1 python -m http.server 8765
pause
