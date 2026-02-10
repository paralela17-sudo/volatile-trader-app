// Note: Imports are aliased to src/shims/node-shim.js in Vite for browser builds
import * as fs from 'fs';
import * as path from 'path';

const isBrowser = typeof window !== 'undefined';

// No Navegador, buscamos dados injetados via script externo dashboard_data.js
const getBrowserData = () => {
    return (window as any).BOT_DATA || { config: {}, trades: [], logs: [] };
};

export const localDb = {
    // Configurações do Bot
    getConfig: () => {
        if (isBrowser) {
            return getBrowserData().config || {};
        }

        try {
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
        } catch (e) {
            return {};
        }
    },

    saveConfig: (config: any) => {
        if (isBrowser) return false;

        try {
            const DATA_DIR = path.resolve(process.cwd(), 'data');
            const filePath = path.join(DATA_DIR, 'config.json');

            // Ensure data dir exists
            if (!fs.existsSync(DATA_DIR)) {
                fs.mkdirSync(DATA_DIR, { recursive: true });
            }

            fs.writeFileSync(filePath, JSON.stringify(config, null, 2));
            return true;
        } catch (e) {
            return false;
        }
    },

    // Histórico de Trades
    getTrades: (limit = 50) => {
        if (isBrowser) {
            const trades = getBrowserData().trades || [];
            return [...trades].reverse().slice(0, limit);
        }

        try {
            const DATA_DIR = path.resolve(process.cwd(), 'data');
            const filePath = path.join(DATA_DIR, 'trades.json');
            if (!fs.existsSync(filePath)) return [];
            const trades = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
            return (trades as any[]).slice(-limit).reverse();
        } catch (e) {
            return [];
        }
    },

    addTrade: (trade: any) => {
        if (isBrowser) return false;

        try {
            const DATA_DIR = path.resolve(process.cwd(), 'data');
            const filePath = path.join(DATA_DIR, 'trades.json');

            if (!fs.existsSync(DATA_DIR)) {
                fs.mkdirSync(DATA_DIR, { recursive: true });
            }

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
        } catch (e) {
            return false;
        }
    },

    // Logs do Bot
    addLog: (level: string, message: string, details?: any) => {
        if (isBrowser) return false;

        try {
            const DATA_DIR = path.resolve(process.cwd(), 'data');
            const filePath = path.join(DATA_DIR, 'logs.json');

            if (!fs.existsSync(DATA_DIR)) {
                fs.mkdirSync(DATA_DIR, { recursive: true });
            }

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
        } catch (e) {
            return false;
        }
    },

    getLogs: (limit = 100) => {
        if (isBrowser) {
            const logs = getBrowserData().logs || [];
            return [...logs].reverse().slice(0, limit);
        }

        try {
            const DATA_DIR = path.resolve(process.cwd(), 'data');
            const filePath = path.join(DATA_DIR, 'logs.json');
            if (!fs.existsSync(filePath)) return [];
            const logs = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
            return (logs as any[]).slice(-limit).reverse();
        } catch (e) {
            return [];
        }
    }
};
