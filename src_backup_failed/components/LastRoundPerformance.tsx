import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { RefreshCcw, TrendingUp, TrendingDown, Activity } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { lastRoundAnalysisService, type RoundAnalysis } from "@/services/lastRoundAnalysisService";

interface OpenPosition {
  id: string;
  symbol: string;
  side: "BUY" | "SELL";
  price: number;
  quantity: number;
  created_at: string;
}

export const LastRoundPerformance = () => {
  const [analysis, setAnalysis] = useState<RoundAnalysis | null>(null);
  const [loading, setLoading] = useState(true);
  const [openPositions, setOpenPositions] = useState<OpenPosition[]>([]);

  const loadData = async () => {
    try {
      setLoading(true);
      // Local mode bypass
      const result = await lastRoundAnalysisService.analyzeLastRound();
      setAnalysis(result);

      // MOCK or fetch open positions via localDb in a real scenario
      setOpenPositions([]);
    } catch (error) {
      console.error("Error loading analysis:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 60000);
    return () => clearInterval(interval);
  }, []);

  if (loading && !analysis) {
    return (
      <Card className="h-full">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <RefreshCcw className="h-5 w-5 animate-spin" />
            Analisando Performance...
          </CardTitle>
        </CardHeader>
      </Card>
    );
  }

  const metrics = analysis?.metrics;

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 h-full">
      {/* Resumo da Rodada */}
      <Card className="md:col-span-2">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg font-bold flex items-center gap-2">
              <Activity className="h-5 w-5 text-primary" />
              Última Rodada (24h)
            </CardTitle>
            {metrics?.winRate !== undefined && (
              <Badge variant={metrics.winRate >= 50 ? "default" : "destructive"}>
                Win Rate: {metrics.winRate.toFixed(1)}%
              </Badge>
            )}
          </div>
          <CardDescription>
            {metrics?.lastRoundTime
              ? `Último trade: ${format(new Date(metrics.lastRoundTime), "HH:mm 'de' d 'de' MMM", { locale: ptBR })}`
              : "Nenhum trade nas últimas 24h"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground uppercase font-semibold">Total PnL</p>
              <p className={`text-xl font-bold ${(metrics?.totalPnL || 0) >= 0 ? "text-green-500" : "text-red-500"}`}>
                ${metrics?.totalPnL.toFixed(2) || "0.00"}
              </p>
            </div>
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground uppercase font-semibold">Trades</p>
              <p className="text-xl font-bold">{metrics?.totalTrades || 0}</p>
            </div>
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground uppercase font-semibold">Máx Ganho</p>
              <p className="text-lg font-bold text-green-500">
                {metrics?.maxGain ? `+$${metrics.maxGain.toFixed(2)}` : "-"}
              </p>
            </div>
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground uppercase font-semibold">Máx Perda</p>
              <p className="text-lg font-bold text-red-500">
                {metrics?.maxLoss ? `$${metrics.maxLoss.toFixed(2)}` : "-"}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Recomendações */}
      <Card className="bg-secondary/10 border-primary/20">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-bold flex items-center gap-2">
            💡 IA MoltBot Intel
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {analysis?.recommendations && analysis.recommendations.length > 0 ? (
            analysis.recommendations.slice(0, 2).map((rec, i) => (
              <div key={i} className={`p-2 rounded text-xs border ${rec.type === 'danger' ? 'bg-red-500/10 border-red-500/30 text-red-700 dark:text-red-400' :
                  rec.type === 'warning' ? 'bg-yellow-500/10 border-yellow-500/30 text-yellow-700 dark:text-yellow-400' :
                    'bg-blue-500/10 border-blue-500/30 text-blue-700 dark:text-blue-400'
                }`}>
                {rec.message}
              </div>
            ))
          ) : (
            <p className="text-xs text-muted-foreground italic">
              Performance estável. Nenhuma recomendação crítica no momento.
            </p>
          )}
          {analysis?.suggestedChanges?.minConfidence && (
            <div className="flex items-center justify-between text-[10px] pt-2 border-t">
              <span className="text-muted-foreground">Filtro Sugerido:</span>
              <span className="font-bold text-primary">{analysis.suggestedChanges.minConfidence}% Confiança</span>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
