@echo off
title Delivery System
cd /d "%~dp0"
node --version >nul 2>&1
if %errorlevel% neq 0 (
    echo Node.js nao encontrado! Rode setup.bat primeiro.
    pause
    exit /b 1
)
if not exist "frontend\node_modules" (
    echo Instalando dependencias do frontend...
    cd frontend
    call npm install
    cd ..
)
node start.js
pause
