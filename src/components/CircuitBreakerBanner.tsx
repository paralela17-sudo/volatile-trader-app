import { useState, useEffect } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { operationsStatsService } from "@/services/operationsStatsService";

export const CircuitBreakerBanner = () => {
  const [isActive, setIsActive] = useState(false);
  const [minutesLeft, setMinutesLeft] = useState(0);
  const [reason, setReason] = useState("");

  useEffect(() => {
    checkCircuitBreaker();
    
    // Check every 10 seconds
    const interval = setInterval(() => {
      checkCircuitBreaker();
    }, 10000);

    return () => clearInterval(interval);
  }, []);

  const checkCircuitBreaker = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: config } = await supabase
        .from('bot_configurations')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();

      if (!config) return;

      const stats = await operationsStatsService.getTodayOperationsStats(user.id);
      const cbCheck = operationsStatsService.shouldActivateCircuitBreaker(
        stats,
        config.test_mode ? Number(config.test_balance) : 1000
      );

      setIsActive(cbCheck.shouldPause);
      setReason(cbCheck.reason);
      
      if (cbCheck.shouldPause && cbCheck.pauseUntil) {
        const minutes = Math.ceil((cbCheck.pauseUntil - Date.now()) / 60000);
        setMinutesLeft(Math.max(0, minutes));
      } else {
        setMinutesLeft(0);
      }
    } catch (error) {
      console.error('Error checking circuit breaker:', error);
    }
  };

  if (!isActive || minutesLeft <= 0) return null;

  return (
    <Alert variant="destructive" className="border-orange-500/50 bg-orange-500/10">
      <AlertCircle className="h-4 w-4" />
      <AlertDescription className="flex items-center justify-between">
        <span className="font-semibold">
          🚫 Circuit Breaker Ativo: {reason}
        </span>
        <span className="text-sm">
          Retomada em: {minutesLeft} minuto{minutesLeft !== 1 ? 's' : ''}
        </span>
      </AlertDescription>
    </Alert>
  );
};
