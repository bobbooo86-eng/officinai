@echo off
echo =============================================
echo   OfficinAI Mobile - Avvio Expo
echo =============================================
echo.
set NODE20=C:\proyecto\node20\node-v20.19.0-win-x64
set PATH=%NODE20%;%PATH%
cd /d C:\proyecto\app\officinai\mobile
echo Avvio in corso... Attendi il QR code.
echo.
npx expo start --port 8081 --clear
pause
