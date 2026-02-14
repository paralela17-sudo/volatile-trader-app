import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { toast } from "sonner";
import { supabaseSync } from "@/services/supabaseSyncService";

interface CircuitBreakerResetProps {
  onReset?: () => void;
}

export const CircuitBreakerReset = ({ onReset }: CircuitBreakerResetProps) => {
  const [loading, setLoading] = useState(false);

  const handleClear = async () => {
    try {
      setLoading(true);
      // [FIX] Agora enviamos um sinal via Supabase para o Robô no VPS
      const success = await supabaseSync.requestCircuitBreakerReset();

      if (success) {
        toast.success("Solicitação Enviada", {
          description: "O robô receberá o comando de reset em instantes.",
        });
        onReset?.();
      } else {
        toast.error("Erro", {
          description: "Não foi possível enviar o comando de reset.",
        });
      }
    } catch (error) {
      console.error("Error clearing circuit breaker:", error);
      toast.error("Erro", {
        description: "Falha na comunicação com o serviço local.",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="border-warning/50 bg-warning/5">
      <CardHeader>
        <CardTitle className="text-warning text-lg flex items-center gap-2">
          Limpeza de Emergência
        </CardTitle>
        <CardDescription>
          Se o Circuit Breaker estiver travado, você pode forçar o reset aqui para voltar a operar imediatamente.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Alert className="bg-warning/10 border-warning/20">
          <AlertDescription className="text-xs text-warning-foreground">
            Atenção: Use apenas se tiver certeza de que as condições de mercado estabilizaram.
          </AlertDescription>
        </Alert>
        <Button
          variant="outline"
          className="w-full border-warning/50 hover:bg-warning/20 text-warning"
          onClick={handleClear}
          disabled={loading}
        >
          {loading ? "Limpando..." : "Resetar Circuit Breaker Local"}
        </Button>
      </CardContent>
    </Card>
  );
};
