const isBrowser = typeof window !== 'undefined';

// No Navegador, buscamos dados injetados via script externo dashboard_data.js
const getBrowserData = () => {
    return (window as any).BOT_DATA || { config: {}, trades: [], logs: [] };
};

// Helper for Node-only imports that Vite should ignore
const nodeRequire = (mod: string) => {
    if (isBrowser) return null;
    try {
        return require(mod);
    } catch (e) {
        return null;
    }
};

export const localDb = {
    // Configurações do Bot
    getConfig: () => {
        if (isBrowser) {
            return getBrowserData().config || {};
        }

        const fs = nodeRequire('fs');
        const path = nodeRequire('path');
        if (!fs || !path) return {};

        const DATA_DIR = path.resolve(process.cwd(), 'data');
        const filePath = path.join(DATA_DIR, 'config.json');

        if (!fs.existsSync(filePath)) {
            return {
                is_powered_on: false,
                is_running: false,
                test_mode: true,
                test_balance: 1000,
                quantity: 100,
                take_profit_percent: 5,
                stop_loss_percent: 2.5,
                daily_profit_goal: 50,
                trading_pair: 'BTCUSDT'
            };
        }
        return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    },

    saveConfig: (config: any) => {
        if (isBrowser) {
            console.warn('Escrita de arquivos não disponível no navegador direto.');
            return false;
        }

        const fs = nodeRequire('fs');
        const path = nodeRequire('path');
        if (!fs || !path) return false;

        const DATA_DIR = path.resolve(process.cwd(), 'data');
        const filePath = path.join(DATA_DIR, 'config.json');
        fs.writeFileSync(filePath, JSON.stringify(config, null, 2));
        return true;
    },

    // Histórico de Trades
    getTrades: (limit = 50) => {
        if (isBrowser) {
            const trades = getBrowserData().trades || [];
            return [...trades].reverse().slice(0, limit);
        }

        const fs = nodeRequire('fs');
        const path = nodeRequire('path');
        if (!fs || !path) return [];

        const DATA_DIR = path.resolve(process.cwd(), 'data');
        const filePath = path.join(DATA_DIR, 'trades.json');
        if (!fs.existsSync(filePath)) return [];
        const trades = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
        return (trades as any[]).slice(-limit).reverse();
    },

    addTrade: (trade: any) => {
        if (isBrowser) return false;

        const fs = nodeRequire('fs');
        const path = nodeRequire('path');
        if (!fs || !path) return false;

        const DATA_DIR = path.resolve(process.cwd(), 'data');
        const filePath = path.join(DATA_DIR, 'trades.json');
        let trades = [];
        if (fs.existsSync(filePath)) {
            trades = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
        }
        trades.push({
            id: Math.random().toString(36).substr(2, 9),
            created_at: new Date().toISOString(),
            ...trade
        });
        fs.writeFileSync(filePath, JSON.stringify(trades, null, 2));
        return true;
    },

    // Logs do Bot
    addLog: (level: string, message: string, details?: any) => {
        if (isBrowser) return false;

        const fs = nodeRequire('fs');
        const path = nodeRequire('path');
        if (!fs || !path) return false;

        const DATA_DIR = path.resolve(process.cwd(), 'data');
        const filePath = path.join(DATA_DIR, 'logs.json');
        let logs = [];
        if (fs.existsSync(filePath)) {
            logs = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
        }
        logs.push({
            id: Math.random().toString(36).substr(2, 9),
            created_at: new Date().toISOString(),
            level,
            message,
            details
        });
        if (logs.length > 500) logs = logs.slice(-500);
        fs.writeFileSync(filePath, JSON.stringify(logs, null, 2));
        return true;
    },

    getLogs: (limit = 100) => {
        if (isBrowser) {
            const logs = getBrowserData().logs || [];
            return [...logs].reverse().slice(0, limit);
        }

        const fs = nodeRequire('fs');
        const path = nodeRequire('path');
        if (!fs || !path) return [];

        const DATA_DIR = path.resolve(process.cwd(), 'data');
        const filePath = path.join(DATA_DIR, 'logs.json');
        if (!fs.existsSync(filePath)) return [];
        const logs = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
        return (logs as any[]).slice(-limit).reverse();
    }
};
