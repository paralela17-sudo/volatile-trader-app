import { useState, useEffect } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle } from "lucide-react";
import { operationsStatsService, type OperationStats } from "@/services/operationsStatsService";

export const CircuitBreakerBanner = () => {
  const [stats, setStats] = useState<OperationStats | null>(null);

  useEffect(() => {
    loadStatus();
    const interval = setInterval(loadStatus, 30000);
    return () => clearInterval(interval);
  }, []);

  const loadStatus = async () => {
    try {
      // Local mode bypass
      const currentStats = await operationsStatsService.getTodayOperationsStats("local-user");
      setStats(currentStats);
    } catch (error) {
      console.error("Error loading circuit breaker status:", error);
    }
  };

  if (!stats?.circuitBreakerActive) return null;

  return (
    <Alert variant="destructive" className="bg-destructive/10 border-destructive animation-pulse">
      <AlertCircle className="h-4 w-4" />
      <AlertDescription className="font-bold flex items-center justify-between">
        <span>
          ⚠️ CIRCUIT BREAKER ATIVADO: O bot parou temporariamente após sequência de perdas.
          {stats.circuitBreakerUntil && ` Reativação automática: ${new Date(stats.circuitBreakerUntil).toLocaleTimeString()}`}
        </span>
      </AlertDescription>
    </Alert>
  );
};
