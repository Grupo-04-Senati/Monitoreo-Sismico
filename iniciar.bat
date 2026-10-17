@echo off
chcp 65001 >nul 2>&1
setlocal EnableDelayedExpansion

echo.
echo ============================================
echo   MONITOREO SISMICO - Iniciar Frontend
echo ============================================
echo.

:: --- 1. Verificar Node.js ---
where node >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] Node.js no esta instalado o no esta en el PATH.
    echo.
    echo Descarguelo desde: https://nodejs.org/
    echo Instale la version LTS y vuelva a ejecutar este archivo.
    echo.
    pause
    exit /b 1
)

for /f "tokens=*" %%v in ('node --version') do set NODE_VER=%%v
echo [OK] Node.js detectado: %NODE_VER%

:: --- 2. Verificar npm ---
where npm >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] npm no esta instalado. Reinstale Node.js.
    pause
    exit /b 1
)

:: --- 3. Navegar al directorio del frontend ---
set "WEB_DIR=%~dp0apps\web"
if not exist "%WEB_DIR%" (
    echo [ERROR] No se encontro la carpeta: %WEB_DIR%
    echo Verifique que este archivo este en la raiz del proyecto sismo-platform.
    pause
    exit /b 1
)

cd /d "%WEB_DIR%"
echo [OK] Directorio: %CD%

:: --- 4. Instalar dependencias si falta node_modules ---
if not exist "node_modules" (
    echo.
    echo [INFO] node_modules no existe. Instalando dependencias por primera vez...
    echo Esto puede tardar varios minutos.
    echo.
    call npm install
    if !errorlevel! neq 0 (
        echo.
        echo [ERROR] npm install fallo. Verifique su conexion a internet.
        pause
        exit /b 1
    )
    echo [OK] Dependencias instaladas correctamente.
) else (
    echo [OK] Dependencias ya instaladas.
)

:: --- 5. Lanzar servidor de desarrollo ---
echo.
echo ============================================
echo   Iniciando servidor de desarrollo...
echo   URL: http://localhost:5173
echo   Presione Ctrl+C para detener.
echo ============================================
echo.

:: Abrir navegador automaticamente tras 3 segundos
start "" cmd /c "timeout /t 3 /nobreak >nul && start http://localhost:5173"

call npm run dev

pause
