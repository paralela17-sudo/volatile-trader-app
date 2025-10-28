import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { TrendingUp, TrendingDown, Activity, DollarSign } from "lucide-react";
import { multiPairService, type PairMonitor } from "@/services/multiPairService";
import { capitalDistributionService, type CapitalAllocation } from "@/services/capitalDistributionService";

interface MultiPairMonitorProps {
  isActive: boolean;
  totalCapital: number;
  userId: string;
  testMode: boolean;
}

export const MultiPairMonitor = ({ isActive, totalCapital, userId, testMode }: MultiPairMonitorProps) => {
  const [pairs, setPairs] = useState<PairMonitor[]>([]);
  const [allocations, setAllocations] = useState<Map<string, CapitalAllocation>>(new Map());

  useEffect(() => {
    if (!isActive) return;

    const updatePairs = () => {
      const watchedPairs = multiPairService.getWatchedPairs();
      setPairs(watchedPairs);

      // Atualizar alocações de capital
      const symbols = watchedPairs.map(p => p.symbol);
      capitalDistributionService
        .distributeCapital(userId, totalCapital, symbols, testMode)
        .then(setAllocations);
    };

    updatePairs();
    const interval = setInterval(updatePairs, 10000); // Atualizar a cada 10s

    return () => clearInterval(interval);
  }, [isActive, totalCapital, userId, testMode]);

  if (!isActive) {
    return (
      <Card className="p-6 bg-secondary/20 border-border">
        <div className="text-center text-muted-foreground">
          <Activity className="w-12 h-12 mx-auto mb-3 opacity-50" />
          <p className="text-sm">Sistema Multi-Par inativo. Inicie o bot para monitorar múltiplos pares.</p>
        </div>
      </Card>
    );
  }

  if (pairs.length === 0) {
    return (
      <Card className="p-6 bg-secondary/20 border-border">
        <div className="text-center text-muted-foreground">
          <Activity className="w-12 h-12 mx-auto mb-3 opacity-50 animate-pulse" />
          <p className="text-sm font-semibold">Carregando pares para monitoramento...</p>
          <p className="text-xs mt-2">O sistema está identificando os melhores pares para trading.</p>
        </div>
      </Card>
    );
  }

  const totalAllocated = capitalDistributionService.getTotalAllocated(allocations);
  const availableCapital = totalCapital - totalAllocated;

  return (
    <div className="space-y-6">
      {/* Resumo de Alocação */}
      <Card className="p-6 bg-gradient-card border-border">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold">Distribuição de Capital</h3>
          <Badge variant="default" className="bg-primary/10 text-primary">
            {pairs.length} Pares Ativos
          </Badge>
        </div>
        
        <div className="grid grid-cols-3 gap-4 mb-4">
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">Capital Total</p>
            <p className="text-2xl font-bold text-primary">
              ${totalCapital.toFixed(2)}
            </p>
          </div>
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">Alocado</p>
            <p className="text-2xl font-bold text-green-500">
              ${totalAllocated.toFixed(2)}
            </p>
          </div>
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">Disponível</p>
            <p className="text-2xl font-bold text-blue-500">
              ${availableCapital.toFixed(2)}
            </p>
          </div>
        </div>

        <Progress 
          value={(totalAllocated / totalCapital) * 100} 
          className="h-2"
        />
        <p className="text-xs text-muted-foreground mt-2 text-right">
          {((totalAllocated / totalCapital) * 100).toFixed(1)}% do capital em uso
        </p>
      </Card>

      {/* Lista de Pares */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {pairs
          .sort((a, b) => b.volatility - a.volatility)
          .map((pair) => {
            const allocation = allocations.get(pair.symbol);
            const isOpportunity = pair.priceChangePercent <= -0.3 && pair.volatility >= 0.08;

            return (
              <Card 
                key={pair.symbol} 
                className={`p-4 border-border hover:border-primary/50 transition-all ${
                  isOpportunity ? 'ring-2 ring-primary/50 shadow-glow-primary' : ''
                }`}
              >
                <div className="space-y-3">
                  {/* Header */}
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="font-bold text-base">{pair.symbol}</h4>
                      <p className="text-xs text-muted-foreground">
                        {new Date(pair.lastAnalysis).toLocaleTimeString('pt-BR')}
                      </p>
                    </div>
                    {isOpportunity && (
                      <Badge variant="default" className="bg-primary/20 text-primary animate-pulse">
                        🎯 Oportunidade
                      </Badge>
                    )}
                  </div>

                  {/* Métricas */}
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <p className="text-xs text-muted-foreground">Volatilidade</p>
                      <div className="flex items-center gap-1">
                        <Activity className="w-3 h-3 text-primary" />
                        <span className="text-sm font-semibold">
                          {pair.volatility.toFixed(2)}%
                        </span>
                      </div>
                    </div>

                    <div className="space-y-1">
                      <p className="text-xs text-muted-foreground">Mudança 24h</p>
                      <div className="flex items-center gap-1">
                        {pair.priceChangePercent >= 0 ? (
                          <TrendingUp className="w-3 h-3 text-green-500" />
                        ) : (
                          <TrendingDown className="w-3 h-3 text-red-500" />
                        )}
                        <span className={`text-sm font-semibold ${
                          pair.priceChangePercent >= 0 ? 'text-green-500' : 'text-red-500'
                        }`}>
                          {pair.priceChangePercent >= 0 ? '+' : ''}
                          {pair.priceChangePercent.toFixed(2)}%
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Alocação */}
                  {allocation && (
                    <div className="pt-2 border-t border-border/50">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1">
                          <DollarSign className="w-3 h-3 text-primary" />
                          <span className="text-xs text-muted-foreground">Alocado:</span>
                        </div>
                        <span className="text-sm font-semibold text-primary">
                          ${allocation.allocatedAmount.toFixed(2)}
                        </span>
                      </div>
                      <Progress 
                        value={allocation.allocatedPercent} 
                        className="h-1 mt-2"
                      />
                      <p className="text-xs text-muted-foreground text-right mt-1">
                        {allocation.allocatedPercent.toFixed(1)}% do capital
                      </p>
                    </div>
                  )}

                  {/* Histórico de preços */}
                  {pair.lastPrices.length >= 10 && (
                    <div className="pt-2 border-t border-border/50">
                      <p className="text-xs text-muted-foreground mb-2">
                        Histórico ({pair.lastPrices.length} pontos)
                      </p>
                      <div className="flex items-end gap-0.5 h-8">
                        {pair.lastPrices.slice(-10).map((price, i) => {
                          const min = Math.min(...pair.lastPrices.slice(-10));
                          const max = Math.max(...pair.lastPrices.slice(-10));
                          const height = ((price - min) / (max - min)) * 100;
                          
                          return (
                            <div
                              key={i}
                              className="flex-1 bg-primary/30 rounded-t"
                              style={{ height: `${height}%` }}
                            />
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              </Card>
            );
          })}
      </div>
    </div>
  );
};
