@echo off
echo Starting local web server for Baseball Pitching Counter...
echo.
echo The app will be available at: http://localhost:8000
echo.
echo Press Ctrl+C to stop the server
echo.
cd /d "%~dp0"
python -m http.server 8000
