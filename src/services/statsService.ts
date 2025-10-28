import { supabase } from "@/integrations/supabase/client";
import { Trade } from "./botService";

export interface AccountStats {
  initialCapital: number;
  successRate: number;
  totalTrades: number;
  activePositions: number;
  totalProfit: number;
  profitHistory: { date: string; profit: number }[];
}

export const statsService = {
  /**
   * Busca o saldo real da conta Binance
   */
  async getRealBalance(): Promise<number | null> {
    try {
      const { data, error } = await supabase.functions.invoke('binance-get-balance');
      
      if (error || !data) {
        console.error('Error fetching real balance:', error);
        return null;
      }

      return data.balance || null;
    } catch (error) {
      console.error('Exception in getRealBalance:', error);
      return null;
    }
  },

  /**
   * Calcula as estatísticas reais da conta baseado nas trades
   */
  async getAccountStats(userId: string, testMode: boolean, testBalance: number): Promise<AccountStats> {
    try {
      // Buscar todas as trades do usuário
      const { data: trades, error } = await supabase
        .from('trades')
        .select('*')
        .eq('user_id', userId);

      if (error) {
        console.error('Error fetching trades for stats:', error);
        return {
          initialCapital: testMode ? testBalance : 0,
          successRate: 0,
          totalTrades: 0,
          activePositions: 0,
          totalProfit: 0,
          profitHistory: []
        };
      }

      const allTrades = trades || [];

      // Capital inicial
      let initialCapital = testBalance;
      if (!testMode) {
        const realBalance = await this.getRealBalance();
        initialCapital = realBalance || 0;
      }

      // Total de trades
      const totalTrades = allTrades.length;

      // Taxa de sucesso (trades com lucro / total de trades executadas)
      const executedTrades = allTrades.filter((t: any) => 
        t.status === 'EXECUTED' && t.profit_loss !== null
      );
      const profitableTrades = executedTrades.filter((t: any) => 
        (t.profit_loss || 0) > 0
      );
      const successRate = executedTrades.length > 0 
        ? (profitableTrades.length / executedTrades.length) * 100 
        : 0;

      // Posições ativas (trades pendentes)
      const activePositions = allTrades.filter((t: any) => 
        t.status === 'PENDING'
      ).length;

      // Lucro total (soma dos profit_loss das trades executadas)
      const totalProfit = executedTrades.reduce((sum: number, t: any) => 
        sum + (t.profit_loss || 0), 0
      );

      // Histórico de lucro (agregado por dia)
      const profitByDate = executedTrades.reduce((acc: any, t: any) => {
        const date = new Date(t.created_at).toLocaleDateString('pt-BR');
        if (!acc[date]) acc[date] = 0;
        acc[date] += t.profit_loss || 0;
        return acc;
      }, {});

      const profitHistory = Object.entries(profitByDate).map(([date, profit]) => ({
        date,
        profit: profit as number
      }));

      return {
        initialCapital,
        successRate,
        totalTrades,
        activePositions,
        totalProfit,
        profitHistory
      };
    } catch (error) {
      console.error('Exception in getAccountStats:', error);
      return {
        initialCapital: testMode ? testBalance : 0,
        successRate: 0,
        totalTrades: 0,
        activePositions: 0,
        totalProfit: 0,
        profitHistory: []
      };
    }
  }
};
