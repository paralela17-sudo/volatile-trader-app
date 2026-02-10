import 'dotenv/config';
import { tradingService } from './services/tradingService';
import { moltBotIntelService } from './services/moltBotIntelService';
import { RISK_SETTINGS } from './services/riskService';
import { supabaseSync } from './services/supabaseSyncService';
import * as http from 'http';
import * as fs from 'fs';
import * as path from 'path';
import { localDb } from './services/localDbService';

/**
 * HEADLESS RUNNER - Volatile Trader
 * Execução 24/7 adaptada para VPS, integrada com MoltBot, Guardian e Supabase Cloud Sync.
 */

async function startHeadlessBot() {
    console.log('----------------------------------------------------');
    console.log('   VOLATILE TRADER - HEADLESS ENGINE (24/7)         ');
    console.log('----------------------------------------------------');
    console.log(`🕒 Início: ${new Date().toLocaleString()}`);

    // 1. Initialize Supabase Cloud Sync
    console.log('📡 Initializing Supabase cloud sync...');
    await supabaseSync.initialize();

    // 2. Configurações Iniciais
    const isTestMode = process.env.VITE_TRADING_MODE !== 'real';
    const initialBalance = Number(process.env.VITE_INITIAL_BALANCE) || 1000;

    console.log(`🛠️ Config: Modo=${isTestMode ? 'TESTE' : 'REAL'} | Saldo=$${initialBalance}`);

    // 2. Health Check Server (para o Guardian/Watchdog)
    const HEALTH_PORT = 8001;
    http.createServer((req, res) => {
        if (req.url === '/api/status') {
            const stats = {
                is_running: tradingService.getIsRunning(),
                connected_to_blockchain: true, // Binance API connection check conceptually
                last_heartbeat: new Date().toISOString()
            };
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(stats));
        } else {
            res.writeHead(404);
            res.end();
        }
    }).listen(HEALTH_PORT);

    console.log(`🛡️ Guardian Bridge ativo na porta ${HEALTH_PORT}`);

    // 2.5. Sincronizador de Dados - Modo Injeção Direta (100% Offline)
    const syncDashboardData = () => {
        try {

            const data = {
                config: localDb.getConfig(),
                trades: localDb.getTrades(100),
                logs: localDb.getLogs(100),
                lastUpdate: new Date().toISOString()
            };

            const rootDir = path.resolve(process.cwd(), '..', '..');
            const htmlPath = path.join(rootDir, 'PAINEL_VOLATILE.html');

            if (fs.existsSync(htmlPath)) {
                let html = fs.readFileSync(htmlPath, 'utf8');
                const marker = '/* BOT_DATA_START */';
                const endMarker = '/* BOT_DATA_END */';
                const newData = `window.BOT_DATA = ${JSON.stringify(data)};`;

                // Regex para encontrar e substituir o bloco de dados entre os marcadores
                const regex = new RegExp(`${marker.replace(/\*/g, '\\*')}[\\s\\S]*?${endMarker.replace(/\*/g, '\\*')}`);
                const updatedHtml = html.replace(regex, `${marker}${newData}${endMarker}`);

                fs.writeFileSync(htmlPath, updatedHtml);
            }
        } catch (error) {
            console.error('❌ Erro ao sincronizar dados (Injeção Direta):', error);
        }
    };

    // Sincronizar imediatamente e depois a cada 30 segundos
    syncDashboardData();
    setInterval(syncDashboardData, 30000);

    // 3. Heartbeat Loop (Cloud Monitor)
    setInterval(() => {
        supabaseSync.heartbeat();
    }, 300000); // Check every 5 mins

    // 4. Remote Config Polling Loop (Control via Vercel Dashboard)
    setInterval(async () => {
        const remoteConfig = await supabaseSync.fetchRemoteConfig();
        if (remoteConfig) {
            // Apply powered on/off switch
            if (remoteConfig.is_powered_on === false && tradingService.getIsRunning()) {
                console.log('🛑 [Remote] Shutdown command received from cloud.');
                await tradingService.stop();
            } else if (remoteConfig.is_powered_on === true && !tradingService.getIsRunning()) {
                console.log('🚀 [Remote] Startup command received from cloud.');
                // Re-start logic here if needed
            }
        }
    }, 30000); // Check every 30 seconds

    // 5. Intelligence Integration Loop (MoltBot AI)
    setInterval(() => {
        const intel = moltBotIntelService.getLatestIntel();
        if (intel) {
            console.log(`🧠 [MoltBot] Applying Intelligence optimize parameters...`);
            const adaptiveParams = moltBotIntelService.applyIntelToRisk(tradingService.getSettings());
            tradingService.updateParameters(adaptiveParams);
        }
    }, 600000); // Check every 10 min

    // 4. Iniciar Trading Service
    try {
        // Mocking do par de trading (No futuro buscar do pairSelectionService)
        const symbols = ['BTCUSDT', 'ETHUSDT', 'SOLUSDT'];

        console.log(`🚀 Iniciando monitoramento para: ${symbols.join(', ')}`);

        await tradingService.start({
            userId: 'local-admin', // ID estático para bypass de DB
            configId: 'local-config',
            symbols: symbols,
            totalCapital: initialBalance,
            takeProfitPercent: RISK_SETTINGS.TAKE_PROFIT_PERCENT,
            stopLossPercent: RISK_SETTINGS.STOP_LOSS_PERCENT,
            testMode: isTestMode,
            maxPositions: RISK_SETTINGS.MAX_POSITIONS
        });

    } catch (error) {
        console.error('❌ Erro crítico ao iniciar trading:', error);
        process.exit(1);
    }
}

// Lidar com encerramento gracioso
process.on('SIGINT', async () => {
    console.log('\n👋 Encerrando bot com segurança...');
    await tradingService.stop();
    process.exit(0);
});

startHeadlessBot();
