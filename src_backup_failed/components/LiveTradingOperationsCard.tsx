import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Clock, TrendingUp, TrendingDown, Activity, ArrowRight } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

interface LiveTradingOperationsCardProps {
  lastOperationTime: string | null;
  totalOperationsToday: number;
  lastOperationProfit: number | null;
  lastOperationSide: string | null;
  lastOperationSymbol: string | null;
}

interface Operation {
  label: string;
  progress: number;
  color: string;
  nextAction: string;
  status: 'active' | 'completed' | 'waiting';
}

const ProgressSegment = ({ color, progress, status }: { 
  color: string; 
  progress: number; 
  status: 'active' | 'completed' | 'waiting';
}) => {
  const getGradient = () => {
    if (color.includes('blue')) return 'from-blue-400 to-blue-600';
    if (color.includes('green')) return 'from-green-400 to-green-600';
    if (color.includes('red')) return 'from-red-400 to-red-600';
    return 'from-gray-400 to-gray-600';
  };

  const getGlow = () => {
    if (color.includes('blue')) return 'shadow-blue-500/50';
    if (color.includes('green')) return 'shadow-green-500/50';
    if (color.includes('red')) return 'shadow-red-500/50';
    return 'shadow-gray-500/50';
  };

  return (
    <motion.div
      className={`h-3 rounded-full bg-gradient-to-r ${getGradient()} ${status === 'active' ? `shadow-lg ${getGlow()}` : ''}`}
      initial={false}
      animate={{ 
        width: `${progress}%`,
        opacity: status === 'waiting' ? 0.5 : 1
      }}
      transition={{ 
        duration: 1.5, 
        ease: 'easeOut',
        opacity: { duration: 0.3 }
      }}
    />
  );
};

/**
 * Componente de UI com barra de progresso animada em tempo real
 * Simula operações de trading em andamento com 3 segmentos simultâneos
 */
export const LiveTradingOperationsCard = ({
  lastOperationTime,
  totalOperationsToday,
  lastOperationProfit,
  lastOperationSide,
  lastOperationSymbol,
}: LiveTradingOperationsCardProps) => {
  const [operations, setOperations] = useState<Operation[]>([
    { 
      label: 'Análise de Mercado', 
      progress: 35, 
      color: 'bg-blue-500', 
      nextAction: 'Identificar oportunidades',
      status: 'active'
    },
    { 
      label: 'Execução de Trades', 
      progress: 60, 
      color: 'bg-green-500', 
      nextAction: 'Monitorar posições abertas',
      status: 'active'
    },
    { 
      label: 'Gestão de Risco', 
      progress: 20, 
      color: 'bg-red-500', 
      nextAction: 'Verificar stop loss',
      status: 'active'
    },
  ]);

  // Simulação de atualização em tempo real
  useEffect(() => {
    const interval = setInterval(() => {
      setOperations(prev =>
        prev.map(op => {
          // Simula progresso variável para cada operação
          const increment = Math.random() * 12;
          const newProgress = Math.min(op.progress + increment, 100);
          
          // Se completar, reinicia em modo "waiting"
          if (newProgress >= 100) {
            return {
              ...op,
              progress: 0,
              status: 'waiting' as const,
            };
          }
          
          // Ativa operações que estavam waiting
          if (op.status === 'waiting' && newProgress > 5) {
            return {
              ...op,
              progress: newProgress,
              status: 'active' as const,
            };
          }

          return {
            ...op,
            progress: newProgress,
          };
        })
      );
    }, 2500); // Atualiza a cada 2.5 segundos

    return () => clearInterval(interval);
  }, []);

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
          <Activity className="w-5 h-5 text-primary animate-pulse" />
          Operações em Andamento
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        {/* Barras de Progresso Animadas */}
        <div className="space-y-3">
          {operations.map((op, index) => (
            <div key={index} className="space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground font-medium">{op.label}</span>
                <motion.span 
                  className="text-primary font-semibold"
                  animate={{ opacity: [1, 0.5, 1] }}
                  transition={{ duration: 2, repeat: Infinity }}
                >
                  {Math.round(op.progress)}%
                </motion.span>
              </div>
              <div className="w-full bg-secondary/30 rounded-full overflow-hidden h-3">
                <ProgressSegment 
                  color={op.color} 
                  progress={op.progress}
                  status={op.status}
                />
              </div>
            </div>
          ))}
        </div>

        {/* Divisor */}
        <div className="border-t border-border/50" />

        {/* Detalhes da Última Operação */}
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Clock className="w-4 h-4" />
            <span className="font-medium">Última Operação</span>
          </div>
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-foreground">
              {formatTime(lastOperationTime)}
            </p>
            {lastOperationSide && (
              <Badge
                variant={lastOperationSide === "BUY" ? "default" : "secondary"}
                className={`text-xs ${
                  lastOperationSide === "BUY" 
                    ? "bg-green-500/20 text-green-600 border-green-500/30" 
                    : "bg-orange-500/20 text-orange-600 border-orange-500/30"
                }`}
              >
                {lastOperationSide === "BUY" ? "COMPRA" : "VENDA"}
              </Badge>
            )}
          </div>
          {lastOperationSymbol && (
            <p className="text-xs text-muted-foreground">
              Par: <span className="font-semibold text-primary">{lastOperationSymbol}</span>
            </p>
          )}
        </div>

        {/* Estatísticas do Dia */}
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">Operações Hoje</p>
            <p className="text-xl font-bold text-primary">
              {totalOperationsToday}
            </p>
          </div>

          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">Resultado Última Op.</p>
            {hasProfit ? (
              <div className={`flex items-center gap-1.5 text-lg font-bold ${
                isProfitable ? 'text-success' : 'text-danger'
              }`}>
                {isProfitable ? (
                  <TrendingUp className="w-4 h-4" />
                ) : (
                  <TrendingDown className="w-4 h-4" />
                )}
                <span>
                  {isProfitable ? '+' : ''}${lastOperationProfit.toFixed(2)}
                </span>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                Aguardando...
              </p>
            )}
          </div>
        </div>

        {/* Próxima Ação */}
        <div className="bg-primary/5 border border-primary/20 rounded-lg p-3">
          <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
            <ArrowRight className="w-3 h-3" />
            <span className="font-medium">Próxima Ação</span>
          </div>
          <p className="text-sm font-medium text-primary">
            {operations.find(op => op.status === 'active')?.nextAction || 'Aguardando sinais do mercado'}
          </p>
        </div>
      </CardContent>
    </Card>
  );
};
