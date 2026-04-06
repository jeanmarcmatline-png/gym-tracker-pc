@echo off
cd /d "%~dp0"
echo Installation des dependances...
pip install flask flask-cors --quiet
echo.
echo ============================================
echo  Gym Tracker - Serveur local
echo ============================================
echo.
echo PC    : http://localhost:5000
echo.
echo Mobile (WiFi) - utilise UNE de ces adresses :
echo.
echo   http://DESKTOP-QGMLMDK:5000/mobile
echo.
for /f "tokens=2 delims=:" %%a in ('ipconfig ^| findstr /i "IPv4" ^| findstr /v "127.0.0.1"') do (
    set IP=%%a
    goto :found
)
:found
set IP=%IP: =%
echo   http://%IP%:5000/mobile  (si le nom ne fonctionne pas)
echo.
echo Saisis l'une de ces adresses dans Config
echo de l'app mobile (le nom est plus stable).
echo.
echo Appuyez sur Ctrl+C pour arreter.
echo ============================================
echo.
start "" "http://localhost:5000"
python app.py
pause
