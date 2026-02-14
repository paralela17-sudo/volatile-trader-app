@echo off
echo ========================================
echo LIMPEZA TOTAL FORCADA
echo ========================================
echo.

echo [1/3] Deletando TODAS as trades do Supabase...
node -e "const {createClient} = require('@supabase/supabase-js'); require('dotenv').config(); const s = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_SERVICE_ROLE_KEY); (async () => { const {error} = await s.from('trades').delete().neq('id', '00000000-0000-0000-0000-000000000000'); if (error) { console.error('ERRO:', error.message); } else { console.log('OK - Trades deletadas'); const {data} = await s.from('trades').select('id'); console.log('Restantes:', data?.length || 0); } })();"

echo.
echo [2/3] Fechando TODOS os navegadores...
taskkill /F /IM chrome.exe 2>nul
taskkill /F /IM msedge.exe 2>nul
taskkill /F /IM firefox.exe 2>nul
taskkill /F /IM brave.exe 2>nul
echo OK - Navegadores fechados

echo.
echo [3/3] Abrindo Dashboard limpo em 5 segundos...
timeout /t 5 /nobreak

echo.
echo Abrindo https://volatile-trader-app.vercel.app/
start https://volatile-trader-app.vercel.app/

echo.
echo ========================================
echo INSTRUCOES IMPORTANTES:
echo ========================================
echo 1. O navegador vai abrir AGORA
echo 2. Abra o Console (F12)
echo 3. Procure por: "BOT_DATA limpo"
echo 4. Se aparecer trades, me mostre!
echo ========================================
pause
