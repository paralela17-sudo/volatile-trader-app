import { supabase } from "@/integrations/supabase/client";

export interface OperationStats {
  lastOperationTime: string | null;
  totalOperationsToday: number;
  lastOperationProfit: number | null;
  lastOperationSide: string | null;
  lastOperationSymbol: string | null;
  // Novos campos para circuit breakers
  lossStreak: number;
  dailyPnL: number;
  circuitBreakerActive: boolean;
  circuitBreakerUntil: number | null;
}

/**
 * Service responsável por buscar estatísticas das operações de trading
 * Seguindo SRP: apenas busca e processa dados de operações
 */
export const operationsStatsService = {
  /**
   * Busca estatísticas das operações do dia atual
   */
  async getTodayOperationsStats(userId: string): Promise<OperationStats> {
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      // Buscar todas as trades do dia
      const { data: trades, error } = await supabase
        .from('trades')
        .select('*')
        .eq('user_id', userId)
        .gte('created_at', today.toISOString())
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching operations stats:', error);
        return {
          lastOperationTime: null,
          totalOperationsToday: 0,
          lastOperationProfit: null,
          lastOperationSide: null,
          lastOperationSymbol: null,
          lossStreak: 0,
          dailyPnL: 0,
          circuitBreakerActive: false,
          circuitBreakerUntil: null,
        };
      }

      const allTrades = trades || [];
      
      // Última operação executada
      const lastOperation = allTrades.find((t: any) => t.status === 'EXECUTED');
      
      // Total de operações do dia
      const totalOperationsToday = allTrades.filter((t: any) => 
        t.status === 'EXECUTED'
      ).length;

      // Calcular loss streak (perdas consecutivas)
      let lossStreak = 0;
      for (const trade of allTrades) {
        if (trade.status !== 'EXECUTED') continue;
        
        const pnl = trade.profit_loss || 0;
        if (pnl < 0) {
          lossStreak++;
        } else if (pnl > 0) {
          break; // Para quando encontrar um lucro
        }
      }

      // Calcular PnL diário
      const dailyPnL = allTrades
        .filter((t: any) => t.status === 'EXECUTED')
        .reduce((sum: number, t: any) => sum + (t.profit_loss || 0), 0);

      return {
        lastOperationTime: lastOperation?.executed_at || lastOperation?.created_at || null,
        totalOperationsToday,
        lastOperationProfit: lastOperation?.profit_loss || null,
        lastOperationSide: lastOperation?.side || null,
        lastOperationSymbol: lastOperation?.symbol || null,
        lossStreak,
        dailyPnL,
        circuitBreakerActive: false,
        circuitBreakerUntil: null,
      };
    } catch (error) {
      console.error('Exception in getTodayOperationsStats:', error);
      return {
        lastOperationTime: null,
        totalOperationsToday: 0,
        lastOperationProfit: null,
        lastOperationSide: null,
        lastOperationSymbol: null,
        lossStreak: 0,
        dailyPnL: 0,
        circuitBreakerActive: false,
        circuitBreakerUntil: null,
      };
    }
  },

  /**
   * Verifica se circuit breaker deve ser ativado
   */
  shouldActivateCircuitBreaker(stats: OperationStats, initialCapital: number): {
    shouldPause: boolean;
    reason: string;
    pauseUntil: number;
  } {
    const now = Date.now();
    
    // Verificar se já está em pausa
    if (stats.circuitBreakerActive && stats.circuitBreakerUntil) {
      if (now < stats.circuitBreakerUntil) {
        const minutesLeft = Math.ceil((stats.circuitBreakerUntil - now) / 60000);
        return {
          shouldPause: true,
          reason: `Circuit breaker ativo (${minutesLeft} min restantes)`,
          pauseUntil: stats.circuitBreakerUntil
        };
      }
    }

    // Verificar loss streak
    const RISK_SETTINGS = require('./riskService').RISK_SETTINGS;
    if (stats.lossStreak >= RISK_SETTINGS.LOSS_STREAK_LIMIT) {
      const pauseUntil = now + (RISK_SETTINGS.CIRCUIT_BREAKER_PAUSE_MINUTES * 60000);
      return {
        shouldPause: true,
        reason: `${stats.lossStreak} perdas consecutivas detectadas`,
        pauseUntil
      };
    }

    // Verificar drawdown diário
    const drawdownPercent = (stats.dailyPnL / initialCapital) * 100;
    if (drawdownPercent <= -RISK_SETTINGS.DAILY_MAX_DRAWDOWN_PERCENT) {
      const pauseUntil = now + (RISK_SETTINGS.CIRCUIT_BREAKER_PAUSE_MINUTES * 60000);
      return {
        shouldPause: true,
        reason: `Drawdown diário de ${drawdownPercent.toFixed(2)}% atingido`,
        pauseUntil
      };
    }

    return {
      shouldPause: false,
      reason: '',
      pauseUntil: 0
    };
  }
};