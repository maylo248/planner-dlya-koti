@echo off
title Планер для коти
cd /d "%~dp0"
echo Запуск сервера...
start http://localhost:8080
npx http-server -p 8080 -c-1
