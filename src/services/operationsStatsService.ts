import { supabase } from "@/integrations/supabase/client";

export interface OperationStats {
  lastOperationTime: string | null;
  totalOperationsToday: number;
  lastOperationProfit: number | null;
  lastOperationSide: string | null;
  lastOperationSymbol: string | null;
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
        };
      }

      const allTrades = trades || [];
      
      // Última operação executada
      const lastOperation = allTrades.find((t: any) => t.status === 'EXECUTED');
      
      // Total de operações do dia
      const totalOperationsToday = allTrades.filter((t: any) => 
        t.status === 'EXECUTED'
      ).length;

      return {
        lastOperationTime: lastOperation?.executed_at || lastOperation?.created_at || null,
        totalOperationsToday,
        lastOperationProfit: lastOperation?.profit_loss || null,
        lastOperationSide: lastOperation?.side || null,
        lastOperationSymbol: lastOperation?.symbol || null,
      };
    } catch (error) {
      console.error('Exception in getTodayOperationsStats:', error);
      return {
        lastOperationTime: null,
        totalOperationsToday: 0,
        lastOperationProfit: null,
        lastOperationSide: null,
        lastOperationSymbol: null,
      };
    }
  }
};
