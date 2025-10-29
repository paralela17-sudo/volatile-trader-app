import { supabase } from "@/integrations/supabase/client";
import { z } from "zod";

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
    .regex(/^[A-Z0-9]{1,20}USDT$/, "Símbolo inválido. Use pares USDT, ex: BTCUSDT"),
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
  async getConfig(userId: string): Promise<BotConfig | null> {
    const { data, error } = await supabase
      .from('bot_configurations')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (error) {
      console.error('Error fetching bot config:', error);
      return null;
    }

    return data;
  },

  async updateConfig(userId: string, updates: Partial<BotConfig>): Promise<boolean> {
    const { error } = await supabase
      .from('bot_configurations')
      .update(updates)
      .eq('user_id', userId);

    if (error) {
      console.error('Error updating bot config:', error);
      return false;
    }

    return true;
  },

  async saveApiCredentials(userId: string, apiKey: string, apiSecret: string): Promise<boolean> {
    // Call server-side edge function to handle encryption securely
    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        console.error('User not authenticated');
        return false;
      }

      const { data, error } = await supabase.functions.invoke('store-api-credentials', {
        body: { apiKey, apiSecret }
      });

      if (error) {
        console.error('Error saving API credentials:', error);
        return false;
      }

      return data?.success === true;
    } catch (error) {
      console.error('Error calling store-api-credentials function:', error);
      return false;
    }
  }
};

// Serviço para gerenciar trades
export const tradeService = {
  async getTrades(userId: string, limit = 50): Promise<Trade[]> {
    const { data, error } = await supabase
      .from('trades')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      console.error('Error fetching trades:', error);
      return [];
    }

    return (data || []).map(trade => ({
      ...trade,
      side: trade.side as 'BUY' | 'SELL',
      type: trade.type as 'MARKET' | 'LIMIT',
      status: trade.status as 'PENDING' | 'EXECUTED' | 'FAILED' | 'CANCELLED'
    }));
  },

  async executeTrade(symbol: string, side: 'BUY' | 'SELL', quantity: number, testMode = true): Promise<any> {
    const { data: { session } } = await supabase.auth.getSession();
    
    if (!session) {
      throw new Error('User not authenticated');
    }

    // Normalize and validate input on client before network call (Fail Fast)
    const bodyCandidate = {
      symbol: normalizeSymbol(symbol),
      side,
      quantity,
      type: 'MARKET' as const,
      testMode,
    };

    const parsed = TradeRequestSchema.safeParse(bodyCandidate);
    if (!parsed.success) {
      const first = parsed.error.issues[0];
      const msg = first?.message || 'Invalid trade parameters';
      console.error('Client validation failed:', parsed.error.flatten());
      throw new Error(msg);
    }

    const { data, error } = await supabase.functions.invoke('binance-execute-trade', {
      body: parsed.data
    });

    if (error) {
      console.error('Error executing trade:', error);
      throw error;
    }

    return data;
  },

  async calculateProfit(trades: Trade[]): Promise<number> {
    return trades.reduce((total, trade) => {
      return total + (trade.profit_loss || 0);
    }, 0);
  }
};

// Serviço para gerenciar logs
export const logService = {
  async getLogs(userId: string, limit = 100): Promise<BotLog[]> {
    const { data, error } = await supabase
      .from('bot_logs')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      console.error('Error fetching logs:', error);
      return [];
    }

    return (data || []).map(log => ({
      ...log,
      level: log.level as 'INFO' | 'WARNING' | 'ERROR' | 'SUCCESS'
    }));
  },

  async addLog(userId: string, level: BotLog['level'], message: string, details?: any): Promise<boolean> {
    const { error } = await supabase
      .from('bot_logs')
      .insert({
        user_id: userId,
        level,
        message,
        details
      });

    if (error) {
      console.error('Error adding log:', error);
      return false;
    }

    return true;
  }
};
