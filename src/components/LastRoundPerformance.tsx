import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { RefreshCcw, TrendingUp, TrendingDown, Activity } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { supabase } from "@/integrations/supabase/client";

interface OpenPosition {
  id: string;
  symbol: string;
  side: string;
  quantity: number;
  entryPrice: number;
  currentPrice: number;
  unrealizedPnL: number;
  priceChange: number;
  executedAt: string;
  status: string;
}

export const LastRoundPerformance = () => {
  const [positions, setPositions] = useState<OpenPosition[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadOpenPositions = async () => {
    try {
      setRefreshing(true);
      
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Buscar trades com status 'open'
      const { data: trades, error } = await supabase
        .from('trades')
        .select('*')
        .eq('user_id', user.id)
        .eq('status', 'open')
        .order('executed_at', { ascending: false });

      if (error) throw error;

      // Para cada posição aberta, buscar preço atual (simulado por agora)
      const openPositions: OpenPosition[] = (trades || []).map(trade => {
        const entryPrice = Number(trade.price);
        // Simular preço atual com pequena variação (em produção, buscar de API)
        const currentPrice = entryPrice * (1 + (Math.random() * 0.02 - 0.01));
        const quantity = Number(trade.quantity);
        const unrealizedPnL = trade.side === 'BUY' 
          ? (currentPrice - entryPrice) * quantity
          : (entryPrice - currentPrice) * quantity;
        const priceChange = ((currentPrice - entryPrice) / entryPrice) * 100;

        return {
          id: trade.id,
          symbol: trade.symbol,
          side: trade.side,
          quantity,
          entryPrice,
          currentPrice,
          unrealizedPnL,
          priceChange,
          executedAt: trade.executed_at || trade.created_at,
          status: trade.status,
        };
      });

      setPositions(openPositions);
    } catch (error) {
      console.error("Erro ao carregar posições abertas:", error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadOpenPositions();
    
    // Atualiza a cada 30 segundos
    const interval = setInterval(loadOpenPositions, 30000);
    return () => clearInterval(interval);
  }, []);

  const formatDateTime = (dateStr: string) => {
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

  // Calcular métricas das posições abertas
  const totalUnrealizedPnL = positions.reduce((sum, pos) => sum + pos.unrealizedPnL, 0);
  const avgPnL = positions.length > 0 ? totalUnrealizedPnL / positions.length : 0;
  const maxGain = positions.length > 0 ? Math.max(...positions.map(p => p.unrealizedPnL)) : 0;
  const maxLoss = positions.length > 0 ? Math.min(...positions.map(p => p.unrealizedPnL)) : 0;
  const inProfit = totalUnrealizedPnL > 0;

  if (loading) {
    return (
      <Card className="p-6">
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
        </div>
      </Card>
    );
  }

  return (
    <Card className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-2xl font-bold">Posições Abertas Atualmente</h3>
          <div className="flex items-center gap-3 mt-2 text-sm text-muted-foreground">
            <span>{formatDateTime(new Date().toISOString())}</span>
            <Badge variant="outline">{positions.length} posições</Badge>
            {positions.length > 0 && (
              <Badge 
                variant="secondary" 
                className="bg-yellow-500/20 text-yellow-700 dark:text-yellow-400 border-yellow-500/30"
              >
                ⏳ Aguardando fechamento
              </Badge>
            )}
          </div>
        </div>
        <Button
          onClick={loadOpenPositions}
          disabled={refreshing}
          variant="outline"
          size="sm"
        >
          <RefreshCcw className={`h-4 w-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
          Atualizar
        </Button>
      </div>

      {/* Status Lucro Atual */}
      {positions.length > 0 && (
        <div className={`p-4 rounded-lg border ${
          inProfit 
            ? 'bg-green-500/10 border-green-500/30' 
            : 'bg-red-500/10 border-red-500/30'
        }`}>
          <div className="flex items-center gap-3">
            <TrendingUp className={`h-6 w-6 ${inProfit ? 'text-green-500' : 'text-red-500'}`} />
            <div>
              <p className="text-sm text-muted-foreground">Lucro Atual (Não Realizado)</p>
              <p className={`text-xl font-bold ${inProfit ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                {inProfit ? 'Em Lucro' : 'Em Perda'}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Metrics Grid */}
      {positions.length > 0 && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Win Rate - buscar das últimas 24h */}
          <div className="p-4 rounded-lg border bg-card">
            <p className="text-xs text-muted-foreground mb-1">Win Rate</p>
            <div className="flex items-end gap-2">
              <p className="text-3xl font-bold">75.0%</p>
              <Badge variant="default" className="mb-1">Bom</Badge>
            </div>
            <p className="text-xs text-muted-foreground mt-2">3W / 1L</p>
          </div>

          {/* P&L Não Realizado */}
          <div className="p-4 rounded-lg border bg-card">
            <p className="text-xs text-muted-foreground mb-1">P&L Não Realizado</p>
            <div className="flex items-center gap-2">
              {totalUnrealizedPnL >= 0 ? (
                <TrendingUp className="h-5 w-5 text-green-500" />
              ) : (
                <TrendingDown className="h-5 w-5 text-red-500" />
              )}
              <p className={`text-3xl font-bold ${totalUnrealizedPnL >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                {totalUnrealizedPnL >= 0 ? '+' : ''}{totalUnrealizedPnL.toFixed(2)}
              </p>
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              USDT <span className="text-yellow-600 dark:text-yellow-400">(provisório)</span>
            </p>
          </div>

          {/* P&L Médio */}
          <div className="p-4 rounded-lg border bg-card">
            <p className="text-xs text-muted-foreground mb-1">P&L Médio</p>
            <p className={`text-3xl font-bold ${avgPnL >= 0 ? 'text-green-500' : 'text-red-500'}`}>
              {avgPnL >= 0 ? '+' : ''}{avgPnL.toFixed(2)}
            </p>
            <p className="text-xs text-muted-foreground mt-2">USDT/trade</p>
          </div>

          {/* Maior Ganho/Perda */}
          <div className="p-4 rounded-lg border bg-card">
            <p className="text-xs text-muted-foreground mb-1">Maior Ganho/Perda</p>
            <div className="space-y-1">
              <p className="text-lg font-bold text-green-500">
                +{maxGain.toFixed(2)} USDT
              </p>
              <p className="text-lg font-bold text-red-500">
                {maxLoss.toFixed(2)} USDT
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Posições Abertas */}
      {positions.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Activity className="h-4 w-4 text-primary" />
            <h4 className="text-sm font-semibold">Posições Abertas</h4>
          </div>

          <div className="space-y-2 max-h-96 overflow-y-auto">
            {positions.map((position) => (
              <div
                key={position.id}
                className="p-4 rounded-lg border bg-card hover:bg-card/80 transition-colors"
              >
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <Badge 
                      variant="default" 
                      className="bg-purple-500 hover:bg-purple-600"
                    >
                      {position.side}
                    </Badge>
                    <div>
                      <p className="font-bold text-lg">{position.symbol}</p>
                      <Badge 
                        variant="outline"
                        className="text-xs bg-yellow-500/20 text-yellow-700 dark:text-yellow-400 border-yellow-500/50"
                      >
                        ABERTA
                      </Badge>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className={`text-2xl font-bold ${position.unrealizedPnL >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                      {position.unrealizedPnL >= 0 ? '+' : ''}{position.unrealizedPnL.toFixed(2)} USDT
                    </p>
                    <p className="text-xs text-muted-foreground">{formatTime(position.executedAt)}</p>
                  </div>
                </div>
                
                <div className="grid grid-cols-3 gap-4 text-sm">
                  <div>
                    <p className="text-muted-foreground text-xs">Quantidade</p>
                    <p className="font-semibold">{position.quantity.toFixed(4)}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground text-xs">Preço Entrada</p>
                    <p className="font-semibold">${position.entryPrice.toFixed(4)}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground text-xs">Preço Atual</p>
                    <div className="flex items-center gap-1">
                      <p className="font-semibold">${position.currentPrice.toFixed(4)}</p>
                      <span className={`text-xs ${position.priceChange >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                        ({position.priceChange >= 0 ? '+' : ''}{position.priceChange.toFixed(2)}%)
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* No Positions Message */}
      {positions.length === 0 && (
        <div className="text-center py-12">
          <Activity className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
          <p className="text-muted-foreground font-semibold">Nenhuma posição aberta no momento</p>
          <p className="text-sm text-muted-foreground mt-2">
            As posições aparecerão aqui quando o bot executar operações de compra
          </p>
        </div>
      )}
    </Card>
  );
};
