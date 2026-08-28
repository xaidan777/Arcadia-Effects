@echo off
rem Arcaidia Effector — редактор 2D эффектов
cd /d "%~dp0"
start "" cmd /c "timeout /t 2 >nul & start http://localhost:5179/"
node server.mjs
pause
