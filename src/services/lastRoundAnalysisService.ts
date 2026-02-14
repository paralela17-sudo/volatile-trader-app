import { localDb } from "./localDbService";
import { RISK_SETTINGS } from "./riskService";

export interface TradeDetail {
  id: string;
  symbol: string;
  side: string;
  quantity: number;
  price: number;
  profit_loss: number;
  executed_at: string;
}

export interface RoundMetrics {
  lastRoundTime: string | null;
  totalTrades: number;
  winningTrades: number;
  losingTrades: number;
  winRate: number;
  totalPnL: number;
  avgPnL: number;
  maxGain: number;
  maxLoss: number;
  trades: TradeDetail[];
}

export interface AdjustmentRecommendation {
  message: string;
  type: 'warning' | 'danger' | 'info';
}

export interface SuggestedChanges {
  takeProfit?: number;
  stopLoss?: number;
  minConfidence?: number;
}

export interface RoundAnalysis {
  metrics: RoundMetrics;
  needsAttention: boolean;
  recommendations: AdjustmentRecommendation[];
  suggestedChanges: SuggestedChanges;
}

class LastRoundAnalysisService {
  /**
   * Busca os trades da última rodada (última 1 hora para fresh start)
   */
  async fetchLastRoundTrades(): Promise<TradeDetail[]> {
    try {
      // Busca trades da última 1 hora apenas (para fresh start)
      const oneHourAgo = Date.now() - 60 * 60 * 1000;
      const trades = localDb.getTrades(200);

      const lastRoundTrades = trades.filter((t: any) =>
        new Date(t.executed_at || t.created_at).getTime() >= oneHourAgo
      );

      return lastRoundTrades as unknown as TradeDetail[];
    } catch (error) {
      console.error("Erro ao buscar trades:", error);
      return [];
    }
  }

  /**
   * Calcula as métricas da última rodada
   */
  calculateRoundMetrics(trades: TradeDetail[]): RoundMetrics {
    if (trades.length === 0) {
      return {
        lastRoundTime: null,
        totalTrades: 0,
        winningTrades: 0,
        losingTrades: 0,
        winRate: 0,
        totalPnL: 0,
        avgPnL: 0,
        maxGain: 0,
        maxLoss: 0,
        trades: [],
      };
    }

    const winningTrades = trades.filter(t => (t.profit_loss || 0) > 0);
    const losingTrades = trades.filter(t => (t.profit_loss || 0) < 0);
    const totalPnL = trades.reduce((sum, t) => sum + (t.profit_loss || 0), 0);
    const avgPnL = totalPnL / trades.length;

    const allProfits = trades.map(t => t.profit_loss || 0);
    const maxGain = allProfits.length > 0 ? Math.max(...allProfits) : 0;
    const maxLoss = allProfits.length > 0 ? Math.min(...allProfits) : 0;

    const winRate = trades.length > 0
      ? (winningTrades.length / trades.length) * 100
      : 0;

    return {
      lastRoundTime: trades[0]?.executed_at || null,
      totalTrades: trades.length,
      winningTrades: winningTrades.length,
      losingTrades: losingTrades.length,
      winRate,
      totalPnL,
      avgPnL,
      maxGain,
      maxLoss,
      trades,
    };
  }

  /**
   * Analisa as métricas e gera recomendações
   */
  generateRecommendations(metrics: RoundMetrics): AdjustmentRecommendation[] {
    const recommendations: AdjustmentRecommendation[] = [];

    // Win rate muito baixo
    if (metrics.winRate < 30 && metrics.totalTrades >= 5) {
      recommendations.push({
        message: "Win rate muito baixo nesta rodada. Considere aumentar o filtro de confiança mínima.",
        type: 'danger'
      });
    } else if (metrics.winRate < 50 && metrics.totalTrades >= 5) {
      recommendations.push({
        message: "Win rate abaixo do ideal. Revise os critérios de entrada nas operações.",
        type: 'warning'
      });
    }

    // Resultado negativo
    if (metrics.totalPnL < 0) {
      recommendations.push({
        message: "Rodada resultou em perda. Revise sua estratégia de Stop Loss e Take Profit.",
        type: 'danger'
      });
    }

    // Perda máxima muito grande
    if (Math.abs(metrics.maxLoss) > Math.abs(metrics.avgPnL) * 3 && metrics.totalTrades > 0) {
      recommendations.push({
        message: "Stop Loss muito distante. Reduza para proteger seu capital.",
        type: 'warning'
      });
    }

    // Take Profit conservador
    if (metrics.maxGain > 0 && metrics.maxGain < Math.abs(metrics.maxLoss) * 0.5) {
      recommendations.push({
        message: "Take Profit pode estar muito conservador. Considere aumentar.",
        type: 'info'
      });
    }

    // Perda média alta
    if (metrics.avgPnL < -10 && metrics.totalTrades >= 3) {
      recommendations.push({
        message: "Perda média por trade muito alta. Ajuste o tamanho das posições.",
        type: 'danger'
      });
    }

    return recommendations;
  }

  /**
   * Gera sugestões de mudanças baseadas na análise
   */
  generateSuggestedChanges(metrics: RoundMetrics, recommendations: AdjustmentRecommendation[]): SuggestedChanges {
    const changes: SuggestedChanges = {};

    // Se há muitas perdas, sugerir ajustes mais conservadores
    if (metrics.winRate < 30 && metrics.totalTrades >= 5) {
      changes.minConfidence = 85;
    } else if (metrics.winRate < 50 && metrics.totalTrades >= 5) {
      changes.minConfidence = 75;
    }

    // Ajustar Stop Loss se as perdas forem muito grandes
    if (Math.abs(metrics.maxLoss) > 50) {
      changes.stopLoss = 2.0;
    }

    // Ajustar Take Profit se os ganhos forem muito pequenos
    if (metrics.maxGain < Math.abs(metrics.maxLoss) * 0.7 && metrics.winRate > 0) {
      changes.takeProfit = 5.0;
    }

    return changes;
  }

  /**
   * Realiza a análise completa da última rodada
   */
  async analyzeLastRound(): Promise<RoundAnalysis> {
    const trades = await this.fetchLastRoundTrades();
    const metrics = this.calculateRoundMetrics(trades);
    const recommendations = this.generateRecommendations(metrics);
    const suggestedChanges = this.generateSuggestedChanges(metrics, recommendations);

    const needsAttention =
      metrics.winRate < 50 ||
      metrics.totalPnL < 0 ||
      recommendations.some(r => r.type === 'danger');

    return {
      metrics,
      needsAttention,
      recommendations,
      suggestedChanges,
    };
  }
}

export const lastRoundAnalysisService = new LastRoundAnalysisService();
