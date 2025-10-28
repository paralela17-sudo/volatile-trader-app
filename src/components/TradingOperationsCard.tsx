import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Clock, TrendingUp, TrendingDown, Activity } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

interface TradingOperationsCardProps {
  lastOperationTime: string | null;
  totalOperationsToday: number;
  lastOperationProfit: number | null;
  lastOperationSide: string | null;
  lastOperationSymbol: string | null;
}

/**
 * Componente puro de UI para exibir estatísticas de operações
 * Seguindo SRP: apenas renderiza dados, não busca ou processa
 */
export const TradingOperationsCard = ({
  lastOperationTime,
  totalOperationsToday,
  lastOperationProfit,
  lastOperationSide,
  lastOperationSymbol,
}: TradingOperationsCardProps) => {
  const formatTime = (time: string | null) => {
    if (!time) return "Nenhuma operação hoje";
    try {
      return formatDistanceToNow(new Date(time), { 
        addSuffix: true, 
        locale: ptBR 
      });
    } catch {
      return "Data inválida";
    }
  };

  const isProfitable = lastOperationProfit !== null && lastOperationProfit > 0;
  const hasProfit = lastOperationProfit !== null;

  return (
    <Card className="bg-gradient-card border-border hover:border-primary/50 transition-all duration-300">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg flex items-center gap-2">
          <Activity className="w-5 h-5 text-primary" />
          Andamento das Operações
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Horário da Última Operação */}
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Clock className="w-4 h-4" />
            <span>Última Operação</span>
          </div>
          <div className="flex items-center justify-between">
            <p className="text-base font-medium">
              {formatTime(lastOperationTime)}
            </p>
            {lastOperationSide && (
              <Badge
                variant={lastOperationSide === "BUY" ? "default" : "secondary"}
                className={lastOperationSide === "BUY" ? "bg-accent" : "bg-warning"}
              >
                {lastOperationSide === "BUY" ? "COMPRA" : "VENDA"}
              </Badge>
            )}
          </div>
          {lastOperationSymbol && (
            <p className="text-xs text-muted-foreground">
              Par: {lastOperationSymbol}
            </p>
          )}
        </div>

        {/* Quantidade de Operações */}
        <div className="space-y-2">
          <p className="text-sm text-muted-foreground">Operações Realizadas Hoje</p>
          <p className="text-2xl font-bold text-primary">
            {totalOperationsToday}
          </p>
        </div>

        {/* Lucro/Perda da Última Operação */}
        <div className="space-y-2">
          <p className="text-sm text-muted-foreground">Resultado da Última Operação</p>
          {hasProfit ? (
            <div className={`flex items-center gap-2 text-xl font-bold ${
              isProfitable ? 'text-success' : 'text-danger'
            }`}>
              {isProfitable ? (
                <TrendingUp className="w-5 h-5" />
              ) : (
                <TrendingDown className="w-5 h-5" />
              )}
              <span>
                {isProfitable ? '+' : ''}${lastOperationProfit.toFixed(2)}
              </span>
            </div>
          ) : (
            <p className="text-base text-muted-foreground">
              Aguardando operação
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
};
