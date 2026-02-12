@echo off
cd /d "%~dp0"
echo ===================================================
echo   CRIANDO DEPLOY MANUAL NO VERCEL (VERSAO SIMPLE)
echo ===================================================
echo.
echo 1. Verificando Login...
call npx vercel whoami
echo.
echo 2. Construindo o Site (Build)...
call npx vercel build --prod --yes
if %ERRORLEVEL% NEQ 0 (
    echo.
    echo ERRO NO BUILD! VERIFIQUE ACIMA.
    pause
    exit /b 1
)

echo.
echo 3. Enviando para Vercel (Deploy)...
call npx vercel deploy --prebuilt --prod --yes
if %ERRORLEVEL% NEQ 0 (
    echo.
    echo ERRO NO DEPLOY! VERIFIQUE ACIMA.
    pause
    exit /b 1
)

echo.
echo ===================================================
echo   FIM DO PROCESSO: SUCESSO!
echo ===================================================
pause
