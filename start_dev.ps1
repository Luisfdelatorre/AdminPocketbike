# PocketBike Dev Launcher con Posicionamiento de Ventanas en Pantalla

$PROJECT_DIR = "C:\Users\luisd\Documents\1ABusines\Pocketbike\webApp2026"
Set-Location $PROJECT_DIR

$code = @"
using System;
using System.Runtime.InteropServices;
public class Window {
    [DllImport("user32.dll")]
    public static extern bool MoveWindow(IntPtr hWnd, int X, int Y, int nWidth, int nHeight, bool bRepaint);
}
"@
Add-Type -TypeDefinition $code

function Start-PositionedConsole {
    param(
        [string]$Title,
        [string]$Command,
        [int]$X,
        [int]$Y,
        [int]$W,
        [int]$H
    )
    $p = Start-Process cmd.exe -ArgumentList "/k", "title $Title && cd /d ""$PROJECT_DIR"" && $Command" -PassThru
    Start-Sleep -Milliseconds 600
    [Window]::MoveWindow($p.MainWindowHandle, $X, $Y, $W, $H, $true)
}

Write-Host "[INFO] Iniciando entorno de desarrollo PocketBike..." -ForegroundColor Green

# =========================================================================
# CONFIGURACION DE POSICIONES EN PANTALLA (X, Y, Ancho, Alto en pixeles)
# =========================================================================
# 1. Mongo Tunnel -> Arriba Izquierda
Start-PositionedConsole -Title "PocketBike Mongo Tunnel" -Command "npm run dev:db-tunnel" -X 3800 -Y 0 -W 500 -H 200

Write-Host ""
Write-Host "[SSH TUNNEL] Por favor ingresa la contrasena en la ventana del tunel SSH..." -ForegroundColor Yellow
Read-Host "Presiona [ENTER] aqui cuando el tunel este conectado para continuar"
Write-Host ""

# 2. API Server -> Arriba Derecha
Start-PositionedConsole -Title "PocketBike API Server"  -Command "npm run dev:api"     -X 3800 -Y 200 -W 500 -H 200

# 3. Cron Server -> Abajo Izquierda
Start-PositionedConsole -Title "PocketBike Cron Server"  -Command "npm run dev:cron"    -X 3800 -Y 400 -W 500 -H 200

# 4. Frontend Vite -> Abajo Derecha
Start-PositionedConsole -Title "PocketBike Front Dev"   -Command "npm run dev"         -X 3800 -Y 600 -W 500 -H 200

Write-Host "[OK] Consolas iniciadas y organizadas en pantalla." -ForegroundColor Cyan
