@echo off
title Adega - Backup
echo Criando backup...

cd /d "%~dp0"

:: Create backup directory
if not exist "data\backups" mkdir "data\backups"

:: Generate timestamp
for /f "tokens=2 delims==" %%I in ('wmic os get localdatetime /value') do set datetime=%%I
set timestamp=%datetime:~0,8%-%datetime:~8,6%

:: Copy database
copy "data\adega.db" "data\backups\backup-%timestamp%.db" >nul

if errorlevel 1 (
    echo ERRO: Falha ao criar backup!
) else (
    echo Backup criado: data\backups\backup-%timestamp%.db
)

:: Clean old backups (keep last 30)
set count=0
for /f %%a in ('dir /b /o-n "data\backups\backup-*.db" 2^>nul ^| find /c /v ""') do set count=%%a
if %count% gtr 30 (
    echo Limpando backups antigos...
    for /f "skip=30" %%f in ('dir /b /o-n "data\backups\backup-*.db"') do del "data\backups\%%f"
)

echo Concluido!
