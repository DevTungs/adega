@echo off
echo Parando Adega Delivery System...
taskkill /FI "WindowTitle eq Adega Backend*" /F >nul 2>&1
taskkill /FI "WindowTitle eq Adega Frontend*" /F >nul 2>&1
taskkill /FI "WindowTitle eq node*" /F >nul 2>&1
echo Sistema parado.
pause
