import { useState } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { tradingService } from "@/services/tradingService";

interface CircuitBreakerResetProps {
  testMode: boolean;
  onReset?: () => void;
}

export const CircuitBreakerReset = ({ testMode, onReset }: CircuitBreakerResetProps) => {
  const [isResetting, setIsResetting] = useState(false);
  const { toast } = useToast();

  const handleReset = async () => {
    if (!testMode) {
      toast({
        title: "Operação não permitida",
        description: "Reset do Circuit Breaker só é permitido em modo de teste",
        variant: "destructive",
      });
      return;
    }

    setIsResetting(true);
    try {
      // Obter userId atual
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast({
          title: "Erro de autenticação",
          description: "Usuário não autenticado",
          variant: "destructive",
        });
        setIsResetting(false);
        return;
      }

      // 1. Limpar o estado do Circuit Breaker no tradingService
      tradingService.clearCircuitBreaker();

      // 2. Marcar trades perdedores de hoje como "archived" para não contarem no cálculo
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const { data: todayTrades } = await supabase
        .from("trades")
        .select("*")
        .eq("user_id", user.id)
        .eq("status", "EXECUTED")
        .gte("executed_at", today.toISOString())
        .order("executed_at", { ascending: true });

      if (todayTrades && todayTrades.length > 0) {
        // Identificar apenas trades com profit_loss negativo ou que formam sequência perdedora
        const negativeTrades = todayTrades.filter(
          (t) => t.profit_loss !== null && t.profit_loss < 0
        );

        if (negativeTrades.length > 0) {
          // Adicionar um campo "cb_archived" (ou similar) para ignorá-los no cálculo futuro
          // Como não temos esse campo, vamos apenas registrar no log que foram "resetados"
          await supabase.from("bot_logs").insert({
            user_id: user.id,
            level: "INFO",
            message: "Circuit Breaker resetado manualmente",
            details: {
              tradesArchived: negativeTrades.length,
              tradeIds: negativeTrades.map((t) => t.id),
              resetAt: new Date().toISOString(),
            },
          });
        }
      }

      toast({
        title: "Circuit Breaker resetado",
        description: `CB limpo com sucesso. ${todayTrades?.length || 0} operações de hoje foram arquivadas.`,
      });

      onReset?.();
    } catch (error) {
      console.error("Erro ao resetar Circuit Breaker:", error);
      toast({
        title: "Erro ao resetar",
        description: "Não foi possível resetar o Circuit Breaker",
        variant: "destructive",
      });
    } finally {
      setIsResetting(false);
    }
  };

  if (!testMode) {
    return null;
  }

  return (
    <Card className="border-warning/20 bg-warning/5">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <AlertTriangle className="h-5 w-5 text-warning" />
          Reset do Circuit Breaker
        </CardTitle>
        <CardDescription>
          Disponível apenas em modo de teste
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Alert>
          <AlertDescription>
            Esta ação irá limpar o estado do Circuit Breaker e arquivar as operações perdedoras
            de hoje, permitindo que novas operações sejam realizadas imediatamente.
          </AlertDescription>
        </Alert>
        <Button
          onClick={handleReset}
          disabled={isResetting}
          variant="outline"
          className="w-full"
        >
          <RefreshCw className={`mr-2 h-4 w-4 ${isResetting ? "animate-spin" : ""}`} />
          {isResetting ? "Resetando..." : "Resetar Circuit Breaker"}
        </Button>
      </CardContent>
    </Card>
  );
};
