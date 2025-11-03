import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { RefreshCcw, TrendingUp, TrendingDown, AlertCircle } from "lucide-react";
import { lastRoundAnalysisService, type RoundAnalysis } from "@/services/lastRoundAnalysisService";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

export const LastRoundPerformance = () => {
  const [analysis, setAnalysis] = useState<RoundAnalysis | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadAnalysis = async () => {
    try {
      setRefreshing(true);
      const data = await lastRoundAnalysisService.analyzeLastRound();
      setAnalysis(data);
    } catch (error) {
      console.error("Erro ao carregar análise da rodada:", error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadAnalysis();
    
    // Atualiza a cada 2 minutos
    const interval = setInterval(loadAnalysis, 120000);
    return () => clearInterval(interval);
  }, []);

  if (loading || !analysis) {
    return (
      <Card className="p-6">
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
        </div>
      </Card>
    );
  }

  const { metrics, needsAttention, recommendations, suggestedChanges } = analysis;
  const hasRecommendations = recommendations.length > 0;
  const hasSuggestedChanges = Object.keys(suggestedChanges).length > 0;

  const formatDateTime = (dateStr: string | null) => {
    if (!dateStr) return "N/A";
    try {
      return format(new Date(dateStr), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR });
    } catch {
      return "N/A";
    }
  };

  const formatTime = (dateStr: string) => {
    try {
      return format(new Date(dateStr), "HH:mm:ss", { locale: ptBR });
    } catch {
      return "N/A";
    }
  };

  return (
    <Card className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-2xl font-bold">Performance da Última Rodada</h3>
          <div className="flex items-center gap-3 mt-2 text-sm text-muted-foreground">
            <span>{formatDateTime(metrics.lastRoundTime)}</span>
            <Badge variant="outline">{metrics.totalTrades} trades</Badge>
          </div>
        </div>
        <Button
          onClick={loadAnalysis}
          disabled={refreshing}
          variant="outline"
          size="sm"
        >
          <RefreshCcw className={`h-4 w-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
          Atualizar
        </Button>
      </div>

      {/* Alert */}
      {needsAttention && (
        <div className="flex items-center gap-2 p-3 rounded-lg bg-yellow-500/10 border border-yellow-500/30">
          <AlertCircle className="h-5 w-5 text-yellow-600 dark:text-yellow-400" />
          <span className="text-sm font-semibold text-yellow-700 dark:text-yellow-400">
            Rodada precisa de atenção
          </span>
        </div>
      )}

      {/* Metrics Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Win Rate */}
        <div className="p-4 rounded-lg border bg-card">
          <p className="text-xs text-muted-foreground mb-1">Win Rate</p>
          <div className="flex items-end gap-2">
            <p className="text-3xl font-bold">{metrics.winRate.toFixed(1)}%</p>
            <Badge 
              variant={metrics.winRate < 30 ? "destructive" : metrics.winRate < 50 ? "secondary" : "default"}
              className="mb-1"
            >
              {metrics.winRate < 30 ? "Baixo" : metrics.winRate < 50 ? "Médio" : "Bom"}
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground mt-2">
            {metrics.winningTrades}W / {metrics.losingTrades}L
          </p>
        </div>

        {/* P&L Total */}
        <div className="p-4 rounded-lg border bg-card">
          <p className="text-xs text-muted-foreground mb-1">P&L Total</p>
          <div className="flex items-center gap-2">
            {metrics.totalPnL >= 0 ? (
              <TrendingUp className="h-5 w-5 text-green-500" />
            ) : (
              <TrendingDown className="h-5 w-5 text-red-500" />
            )}
            <p className={`text-3xl font-bold ${metrics.totalPnL >= 0 ? 'text-green-500' : 'text-red-500'}`}>
              {metrics.totalPnL >= 0 ? '+' : ''}{metrics.totalPnL.toFixed(2)}
            </p>
          </div>
          <p className="text-xs text-muted-foreground mt-2">USDT</p>
        </div>

        {/* P&L Médio */}
        <div className="p-4 rounded-lg border bg-card">
          <p className="text-xs text-muted-foreground mb-1">P&L Médio</p>
          <p className={`text-3xl font-bold ${metrics.avgPnL >= 0 ? 'text-green-500' : 'text-red-500'}`}>
            {metrics.avgPnL >= 0 ? '+' : ''}{metrics.avgPnL.toFixed(2)}
          </p>
          <p className="text-xs text-muted-foreground mt-2">USDT/trade</p>
        </div>

        {/* Maior Ganho/Perda */}
        <div className="p-4 rounded-lg border bg-card">
          <p className="text-xs text-muted-foreground mb-1">Maior Ganho/Perda</p>
          <div className="space-y-1">
            <p className="text-lg font-bold text-green-500">
              +{metrics.maxGain.toFixed(2)} USDT
            </p>
            <p className="text-lg font-bold text-red-500">
              {metrics.maxLoss.toFixed(2)} USDT
            </p>
          </div>
        </div>
      </div>

      {/* Trade Details */}
      {metrics.trades.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <div className="h-px flex-1 bg-border"></div>
            <h4 className="text-sm font-semibold text-muted-foreground">Detalhes das Operações</h4>
            <div className="h-px flex-1 bg-border"></div>
          </div>

          <div className="space-y-2 max-h-64 overflow-y-auto">
            {metrics.trades.slice(0, 10).map((trade) => (
              <div
                key={trade.id}
                className="flex items-center justify-between p-3 rounded-lg border bg-card/50 hover:bg-card transition-colors"
              >
                <div className="flex items-center gap-3">
                  <Badge variant={trade.side === "BUY" ? "default" : "secondary"}>
                    {trade.side}
                  </Badge>
                  <div>
                    <p className="font-semibold">{trade.symbol}</p>
                    <p className="text-xs text-muted-foreground">
                      {trade.quantity} @ ${trade.price.toFixed(2)}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className={`font-bold ${(trade.profit_loss || 0) >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                    {(trade.profit_loss || 0) >= 0 ? '+' : ''}{(trade.profit_loss || 0).toFixed(2)} USDT
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {formatTime(trade.executed_at)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recommendations */}
      {hasRecommendations && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <div className="h-px flex-1 bg-border"></div>
            <h4 className="text-sm font-semibold text-muted-foreground flex items-center gap-2">
              <AlertCircle className="h-4 w-4" />
              Recomendações de Ajuste
            </h4>
            <div className="h-px flex-1 bg-border"></div>
          </div>

          <ul className="space-y-2">
            {recommendations.map((rec, idx) => (
              <li
                key={idx}
                className={`flex items-start gap-2 text-sm p-3 rounded-lg border ${
                  rec.type === 'danger' 
                    ? 'bg-red-500/10 border-red-500/30 text-red-700 dark:text-red-400' 
                    : rec.type === 'warning'
                    ? 'bg-yellow-500/10 border-yellow-500/30 text-yellow-700 dark:text-yellow-400'
                    : 'bg-blue-500/10 border-blue-500/30 text-blue-700 dark:text-blue-400'
                }`}
              >
                <span className="mt-0.5">•</span>
                <span>{rec.message}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Suggested Changes */}
      {hasSuggestedChanges && (
        <div className="p-4 rounded-lg bg-primary/10 border border-primary/20">
          <h4 className="font-semibold mb-3">Mudanças Sugeridas:</h4>
          <div className="space-y-2 text-sm">
            {suggestedChanges.takeProfit && (
              <p>• <span className="font-semibold">Take Profit:</span> {suggestedChanges.takeProfit}%</p>
            )}
            {suggestedChanges.stopLoss && (
              <p>• <span className="font-semibold">Stop Loss:</span> {suggestedChanges.stopLoss}%</p>
            )}
            {suggestedChanges.minConfidence && (
              <p>• <span className="font-semibold">Min Confidence:</span> {suggestedChanges.minConfidence}%</p>
            )}
          </div>
        </div>
      )}

      {/* No Data Message */}
      {metrics.totalTrades === 0 && (
        <div className="text-center py-12">
          <AlertCircle className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
          <p className="text-muted-foreground">Nenhuma operação realizada nas últimas 24 horas</p>
        </div>
      )}
    </Card>
  );
};
