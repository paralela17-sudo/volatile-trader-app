import { localDb } from "./localDbService";
import { supabaseSync } from "./supabaseSyncService";
import { z } from "zod";
import { generateBinanceSignature } from "@/utils/binance-auth";

export interface BotConfig {
  id: string;
  user_id: string;
  is_powered_on: boolean;
  is_running: boolean;
  test_mode: boolean;
  test_balance: number;
  quantity: number;
  take_profit_percent: number;
  stop_loss_percent: number;
  daily_profit_goal: number;
  trading_pair: string;
  api_key_encrypted?: string;
  api_secret_encrypted?: string;
}

export interface Trade {
  id: string;
  symbol: string;
  side: 'BUY' | 'SELL';
  type: 'MARKET' | 'LIMIT';
  quantity: number;
  price: number;
  status: 'PENDING' | 'EXECUTED' | 'FAILED' | 'CANCELLED';
  profit_loss?: number;
  executed_at?: string;
  created_at: string;
  binance_order_id?: string;
}

export interface BotLog {
  id: string;
  level: 'INFO' | 'WARNING' | 'ERROR' | 'SUCCESS';
  message: string;
  details?: any;
  created_at: string;
}

// Client-side validation schema to fail fast and keep SRP
const TradeRequestSchema = z.object({
  symbol: z
    .string()
    .trim()
    .transform((s) => s.toUpperCase())
    .pipe(
      z.string().regex(/^[A-Z0-9]{1,20}USDT$/, "Símbolo inválido. Use pares USDT, ex: BTCUSDT")
    ),
  side: z.enum(["BUY", "SELL"]),
  quantity: z.number().positive().max(10000),
  type: z.enum(["MARKET", "LIMIT"]).default("MARKET"),
  testMode: z.boolean().default(true),
});

function normalizeSymbol(symbol: string): string {
  const s = String(symbol || '').toUpperCase().trim();
  return s.endsWith('USDT') ? s : `${s}USDT`;
}

// Serviço para gerenciar configurações do bot
export const botConfigService = {
  async getConfig(_userId?: string): Promise<BotConfig | null> {
    return localDb.getConfig();
  },

  async updateConfig(_userId: string, updates: Partial<BotConfig>): Promise<boolean> {
    const current = localDb.getConfig();
    localDb.saveConfig({ ...current, ...updates });
    return true;
  },

  async saveApiCredentials(_userId: string, apiKey: string, apiSecret: string): Promise<boolean> {
    // In local mode, we store directly in .env or config.json
    const current = localDb.getConfig();
    localDb.saveConfig({
      ...current,
      api_key_encrypted: apiKey,
      api_secret_encrypted: apiSecret
    });
    return true;
  },

  async createConfig(userId: string, config: Partial<BotConfig>): Promise<boolean> {
    const current = localDb.getConfig();
    localDb.saveConfig({ ...current, ...config, user_id: userId });
    return true;
  }
};

// Serviço para gerenciar trades
export const tradeService = {
  async getTrades(_userId: string, limit = 50): Promise<Trade[]> {
    return localDb.getTrades(limit);
  },

  async executeTrade(symbol: string, side: 'BUY' | 'SELL', quantity: number, testMode = true): Promise<any> {
    // Normalize and validate input
    const bodyCandidate = {
      symbol: normalizeSymbol(symbol),
      side,
      quantity,
      type: 'MARKET' as const,
      testMode,
    };

    const parsed = TradeRequestSchema.safeParse(bodyCandidate);
    if (!parsed.success) {
      throw new Error(parsed.error.issues[0]?.message || 'Invalid trade parameters');
    }

    const { symbol: finalSymbol, side: finalSide, quantity: finalQuantity, type: finalType } = parsed.data;

    // LOCAL EXECUTION (Bypass Supabase)
    const apiKey = process.env.BINANCE_API_KEY || localDb.getConfig().api_key_encrypted;
    const apiSecret = process.env.BINANCE_API_SECRET || localDb.getConfig().api_secret_encrypted;

    console.log(`[TradeService] Executando ordem LOCAL: ${finalSide} ${finalQuantity} ${finalSymbol}`);

    // Obter preço atual para registro
    const responsePrice = await fetch(`https://api.binance.com/api/v3/ticker/price?symbol=${finalSymbol}`);
    const priceData = await responsePrice.json();
    const currentPrice = parseFloat(priceData.price);

    if (testMode) {
      const simulatedTrade: Trade = {
        id: Math.random().toString(36).substr(2, 9),
        symbol: finalSymbol,
        side: finalSide,
        type: finalType,
        quantity: finalQuantity,
        price: parseFloat(currentPrice.toString()), // Ensure currentPrice is a number
        status: finalSide === 'BUY' ? 'PENDING' : 'EXECUTED',
        created_at: new Date().toISOString(),
      };

      await supabaseSync.syncTrade(simulatedTrade);
      await supabaseSync.syncLog('SUCCESS', `Simulated trade executed: ${finalSide} ${finalQuantity} ${finalSymbol}`);
      return { success: true, testMode: true, trade: simulatedTrade };
    }

    if (!apiKey || !apiSecret) {
      throw new Error('API credentials not configured for real trading');
    }

    const timestamp = Date.now();
    const params: any = {
      symbol: finalSymbol,
      side: finalSide,
      type: finalType,
      quantity: finalQuantity.toString(),
      timestamp: timestamp.toString(),
    };

    const queryString = Object.entries(params).map(([k, v]) => `${k}=${v}`).join('&');
    const signature = generateBinanceSignature(queryString, apiSecret);
    const signedQuery = `${queryString}&signature=${signature}`;

    const response = await fetch(`https://api.binance.com/api/v3/order?${signedQuery}`, {
      method: 'POST',
      headers: { 'X-MBX-APIKEY': apiKey }
    });

    const data = await response.json();
    if (!response.ok) {
      await supabaseSync.syncLog('ERROR', `Binance Trade Failed: ${data.msg || 'Unknown error'}`, { data });
      throw new Error(data.msg || 'Binance Trade Error');
    }

    const realTrade: Trade = {
      id: data.orderId?.toString() || Math.random().toString(36).substr(2, 9),
      symbol: finalSymbol,
      side: finalSide,
      type: finalType,
      quantity: finalQuantity,
      price: parseFloat(data.price || currentPrice),
      status: finalSide === 'BUY' ? 'PENDING' : 'EXECUTED',
      binance_order_id: data.orderId?.toString(),
      executed_at: finalSide === 'SELL' ? new Date().toISOString() : undefined,
      created_at: new Date().toISOString()
    };

    await supabaseSync.syncTrade(realTrade);
    await supabaseSync.syncLog('SUCCESS', `Trade executed: ${finalSide} ${finalQuantity} ${finalSymbol}`, { testMode: false, trade: realTrade });

    return { success: true, testMode: false, trade: realTrade };
  },

  async calculateProfit(trades: Trade[]): Promise<number> {
    return trades.reduce((total, trade) => {
      return total + (trade.profit_loss || 0);
    }, 0);
  }
};

// Serviço para gerenciar logs
export const logService = {
  async getLogs(_userId: string, _limit = 100): Promise<BotLog[]> {
    // In local mode, logs can be read from files as well
    // For now returning empty or implementing a local file logger
    return [];
  },

  async addLog(level: 'INFO' | 'WARNING' | 'ERROR' | 'SUCCESS', message: string, details?: any): Promise<void> {
    await supabaseSync.syncLog(level, message, details);
  }
};
