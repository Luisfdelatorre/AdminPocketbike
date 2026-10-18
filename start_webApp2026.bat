@echo off
setlocal
TITLE PocketBike Dev Launcher

set "PROJECT_DIR=C:\Users\luisd\Documents\1ABusines\Pocketbike\webApp2026"

if not exist "%PROJECT_DIR%" (
    echo ERROR: Project directory was not found: %PROJECT_DIR%
    pause
    exit /b 1
)

powershell -NoProfile -ExecutionPolicy Bypass -File "%PROJECT_DIR%\start_dev.ps1"

pause
endlocal
exit /b 0
