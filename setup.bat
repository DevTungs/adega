@echo off
title Adega Delivery System - Setup
cd /d "%~dp0"

echo.
echo ============================================================
echo          ADEGA DELIVERY SYSTEM - SETUP
echo ============================================================
echo.

echo [1/6] Verificando Node.js...
node --version >nul 2>&1
if %errorlevel% neq 0 goto :install_node
for /f "tokens=*" %%v in ('node --version') do set NODE_VER=%%v
echo   Node.js %NODE_VER% encontrado
goto :step2

:install_node
echo.
echo   Node.js nao encontrado!
echo   Baixando e instalando Node.js LTS...
echo.
powershell -Command "& {$ProgressPreference='SilentlyContinue'; Invoke-WebRequest -Uri 'https://nodejs.org/dist/v22.16.0/node-v22.16.0-x64.msi' -OutFile '%TEMP%\node-installer.msi'}"
if not exist "%TEMP%\node-installer.msi" (
    echo   ERRO: Falha ao baixar Node.js!
    echo   Instale manualmente: https://nodejs.org
    pause
    exit /b 1
)
echo   Instalando Node.js...
msiexec /i "%TEMP%\node-installer.msi" /quiet /norestart
timeout /t 30 /nobreak >nul
set "PATH=%PATH%;%ProgramFiles%\nodejs"
node --version >nul 2>&1
if %errorlevel% neq 0 (
    echo   Node.js instalado. Reinicie o terminal e rode o setup novamente.
    pause
    exit /b 1
)
echo   Node.js instalado com sucesso!
del "%TEMP%\node-installer.msi" >nul 2>&1

:step2
echo.
echo [2/6] Instalando dependencias do backend...
cd backend
call npm install
if %errorlevel% neq 0 (
    echo   ERRO: Falha ao instalar dependencias do backend!
    pause
    exit /b 1
)
cd ..

echo.
echo [3/6] Compilando backend...
cd backend
call npm run build
if %errorlevel% neq 0 (
    echo   ERRO: Falha ao compilar backend!
    pause
    exit /b 1
)
cd ..

echo.
echo [4/6] Executando migracoes do banco...
cd backend
call npm run migrate
if %errorlevel% neq 0 (
    echo   ERRO: Falha ao executar migracoes!
    pause
    exit /b 1
)
cd ..

echo.
echo [5/6] Populando banco com dados iniciais...
cd backend
call npm run seed
cd ..

echo.
echo [6/6] Instalando dependencias do frontend...
cd frontend
call npm install
if %errorlevel% neq 0 (
    echo   ERRO: Falha ao instalar dependencias do frontend!
    pause
    exit /b 1
)
cd ..

echo.
echo Instalando ferramentas de inicializacao...
call npm install --save open >nul 2>&1

echo.
echo ============================================================
echo.
echo   Setup concluido com sucesso!
echo.
echo   Para iniciar o sistema:
echo   - Execute: start.bat
echo.
echo   Credenciais padrao:
echo   - Usuario: admin
echo   - Senha:   admin123
echo.
echo ============================================================
echo.
pause
