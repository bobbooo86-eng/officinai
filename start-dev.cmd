@echo off
cd /d C:\proyecto\app\officinai
set PATH=C:\Program Files\nodejs;%PATH%
node node_modules\vite\bin\vite.js --port 5173
