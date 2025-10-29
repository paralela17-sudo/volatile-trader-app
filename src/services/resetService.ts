/**
 * Reset Service - SSOT para resetar dados do bot
 * SRP: Responsável apenas por operações de reset/limpeza
 */

import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface ResetOptions {
  userId: string;
  resetTrades: boolean;
  resetBalance: boolean;
  newBalance?: number;
}

class ResetService {
  /**
   * Reseta completamente o bot para estado inicial
   */
  async resetBot(options: ResetOptions): Promise<boolean> {
    const { userId, resetTrades, resetBalance, newBalance = 1000 } = options;

    try {
      console.log("🔄 Iniciando reset do bot...");

      // 1. Deletar todos os trades do usuário
      if (resetTrades) {
        const { error: tradesError } = await supabase
          .from("trades")
          .delete()
          .eq("user_id", userId);

        if (tradesError) {
          console.error("Erro ao deletar trades:", tradesError);
          throw tradesError;
        }

        console.log("✅ Trades deletados");
      }

      // 2. Resetar configuração do bot
      if (resetBalance) {
        const { error: configError } = await supabase
          .from("bot_configurations")
          .update({
            test_balance: newBalance,
            is_running: false,
            is_powered_on: false,
            updated_at: new Date().toISOString()
          })
          .eq("user_id", userId);

        if (configError) {
          console.error("Erro ao atualizar configuração:", configError);
          throw configError;
        }

        console.log(`✅ Capital resetado para $${newBalance}`);
      }

      console.log("✅ Reset completo!");
      return true;
    } catch (error) {
      console.error("❌ Erro no reset:", error);
      return false;
    }
  }

  /**
   * Fecha todas as posições abertas manualmente
   */
  async closeAllPositions(userId: string): Promise<number> {
    try {
      // Marcar todos os trades pendentes como executados com lucro 0
      const { data: openTrades } = await supabase
        .from("trades")
        .select("*")
        .eq("user_id", userId)
        .eq("side", "BUY")
        .is("profit_loss", null);

      if (!openTrades || openTrades.length === 0) {
        console.log("Nenhuma posição aberta encontrada");
        return 0;
      }

      for (const trade of openTrades) {
        await supabase
          .from("trades")
          .update({
            status: "EXECUTED",
            profit_loss: 0,
            executed_at: new Date().toISOString()
          })
          .eq("id", trade.id);
      }

      console.log(`✅ ${openTrades.length} posições fechadas`);
      return openTrades.length;
    } catch (error) {
      console.error("Erro ao fechar posições:", error);
      return 0;
    }
  }

  /**
   * Verifica status atual do bot
   */
  async getBotStatus(userId: string): Promise<{
    openPositions: number;
    totalTrades: number;
    currentBalance: number;
  }> {
    try {
      // Contar posições abertas
      const { data: openTrades, count: openCount } = await supabase
        .from("trades")
        .select("*", { count: "exact" })
        .eq("user_id", userId)
        .eq("side", "BUY")
        .is("profit_loss", null);

      // Contar total de trades
      const { count: totalCount } = await supabase
        .from("trades")
        .select("*", { count: "exact" })
        .eq("user_id", userId);

      // Buscar balance atual
      const { data: config } = await supabase
        .from("bot_configurations")
        .select("test_balance")
        .eq("user_id", userId)
        .single();

      return {
        openPositions: openCount || 0,
        totalTrades: totalCount || 0,
        currentBalance: config?.test_balance || 0
      };
    } catch (error) {
      console.error("Erro ao obter status:", error);
      return {
        openPositions: 0,
        totalTrades: 0,
        currentBalance: 0
      };
    }
  }
}

export const resetService = new ResetService();
