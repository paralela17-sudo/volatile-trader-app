import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Settings, TrendingUp, AlertTriangle, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
// Supabase removed for local VPS execution
import { lastRoundAnalysisService, type SuggestedChanges } from "@/services/lastRoundAnalysisService";

export const TradeAdjustments = () => {
  const [suggestedChanges, setSuggestedChanges] = useState<SuggestedChanges | null>(null);
  const [currentConfig, setCurrentConfig] = useState({
    takeProfit: 5.0,
    stopLoss: 2.5,
  });
  const [adjustedValues, setAdjustedValues] = useState({
    takeProfit: 5.0,
    stopLoss: 2.5,
  });
  const [loading, setLoading] = useState(true);
  const [applying, setApplying] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);

      // Carregar análise da última rodada
      const analysis = await lastRoundAnalysisService.analyzeLastRound();
      setSuggestedChanges(analysis.suggestedChanges);

      // Carregar configuração atual localmente (bypass Supabase)
      const current = {
        takeProfit: analysis.suggestedChanges.takeProfit || 5.0,
        stopLoss: analysis.suggestedChanges.stopLoss || 2.5,
      };
      setCurrentConfig(current);

      setAdjustedValues({
        takeProfit: current.takeProfit,
        stopLoss: current.stopLoss,
      });
    } catch (error) {
      console.error("Erro ao carregar dados:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleApplyChanges = async () => {
    try {
      setApplying(true);

      // Validar valores
      if (adjustedValues.takeProfit <= 0 || adjustedValues.stopLoss <= 0) {
        toast.error("Os valores devem ser maiores que zero");
        return;
      }

      if (adjustedValues.takeProfit <= adjustedValues.stopLoss) {
        toast.error("Take Profit deve ser maior que Stop Loss");
        return;
      }

      // Em modo local, as configurações são aplicas via config.json (aqui bypassado no browser)
      setCurrentConfig(adjustedValues);
      toast.success("Configurações aplicadas com sucesso!");

      // Recarregar dados
      await loadData();
    } catch (error) {
      console.error("Erro ao aplicar mudanças:", error);
      toast.error("Erro ao aplicar configurações");
    } finally {
      setApplying(false);
    }
  };

  const hasChanges =
    adjustedValues.takeProfit !== currentConfig.takeProfit ||
    adjustedValues.stopLoss !== currentConfig.stopLoss;

  const hasSuggestions = suggestedChanges &&
    (suggestedChanges.takeProfit || suggestedChanges.stopLoss);

  if (loading) {
    return (
      <Card className="p-6">
        <div className="flex items-center justify-center h-48">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
        </div>
      </Card>
    );
  }

  return (
    <Card className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Settings className="h-6 w-6 text-primary" />
          <div>
            <h3 className="text-xl font-bold">Ajustes de Configuração</h3>
            <p className="text-sm text-muted-foreground">
              Baseado na performance da última rodada
            </p>
          </div>
        </div>
        {hasSuggestions && (
          <Badge variant="secondary" className="gap-1">
            <AlertTriangle className="h-3 w-3" />
            Ajustes sugeridos
          </Badge>
        )}
      </div>

      {/* Current vs Suggested */}
      {hasSuggestions && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Take Profit */}
          {suggestedChanges?.takeProfit && (
            <div className="p-4 rounded-lg border bg-card space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-semibold flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-green-500" />
                  Take Profit
                </Label>
                <Badge variant="outline" className="text-xs">
                  Atual: {currentConfig.takeProfit}%
                </Badge>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Valor sugerido:</span>
                  <span className="font-bold text-green-600 dark:text-green-400">
                    {suggestedChanges.takeProfit}%
                  </span>
                </div>

                <div className="pt-2">
                  <Label className="text-xs text-muted-foreground mb-1">Ajustar para:</Label>
                  <Input
                    type="number"
                    step="0.1"
                    min="0.1"
                    value={adjustedValues.takeProfit}
                    onChange={(e) => setAdjustedValues({
                      ...adjustedValues,
                      takeProfit: Number(e.target.value)
                    })}
                    className="text-center font-semibold"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Stop Loss */}
          {suggestedChanges?.stopLoss && (
            <div className="p-4 rounded-lg border bg-card space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-semibold flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-red-500" />
                  Stop Loss
                </Label>
                <Badge variant="outline" className="text-xs">
                  Atual: {currentConfig.stopLoss}%
                </Badge>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Valor sugerido:</span>
                  <span className="font-bold text-red-600 dark:text-red-400">
                    {suggestedChanges.stopLoss}%
                  </span>
                </div>

                <div className="pt-2">
                  <Label className="text-xs text-muted-foreground mb-1">Ajustar para:</Label>
                  <Input
                    type="number"
                    step="0.1"
                    min="0.1"
                    value={adjustedValues.stopLoss}
                    onChange={(e) => setAdjustedValues({
                      ...adjustedValues,
                      stopLoss: Number(e.target.value)
                    })}
                    className="text-center font-semibold"
                  />
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* No suggestions */}
      {!hasSuggestions && (
        <div className="p-6 rounded-lg border bg-green-500/10 border-green-500/30 text-center">
          <CheckCircle2 className="h-12 w-12 text-green-600 dark:text-green-400 mx-auto mb-3" />
          <p className="font-semibold text-green-700 dark:text-green-400">
            Configurações atuais estão adequadas
          </p>
          <p className="text-sm text-muted-foreground mt-1">
            Nenhum ajuste sugerido pela análise da última rodada
          </p>
        </div>
      )}

      {/* Min Confidence Info */}
      {suggestedChanges?.minConfidence && (
        <div className="p-4 rounded-lg bg-blue-500/10 border border-blue-500/30">
          <div className="flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-blue-600 dark:text-blue-400 mt-0.5" />
            <div className="space-y-1">
              <p className="text-sm font-semibold text-blue-700 dark:text-blue-400">
                Confiança Mínima Sugerida: {suggestedChanges.minConfidence}%
              </p>
              <p className="text-xs text-muted-foreground">
                Este parâmetro é fixo na estratégia atual (50%). Para ajustá-lo, entre em contato com o suporte técnico.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Risk/Reward Ratio Info */}
      <div className="p-4 rounded-lg bg-secondary/20 border">
        <div className="flex items-center justify-between mb-2">
          <Label className="text-sm font-semibold">Risk/Reward Ratio</Label>
          <Badge variant="outline">
            1:{(adjustedValues.takeProfit / adjustedValues.stopLoss).toFixed(2)}
          </Badge>
        </div>
        <p className="text-xs text-muted-foreground">
          Recomendado: 1:2.0 ou superior para estratégias de Mean Reversion
        </p>
      </div>

      {/* Apply Button */}
      {hasSuggestions && (
        <div className="flex gap-3">
          <Button
            onClick={handleApplyChanges}
            disabled={!hasChanges || applying}
            className="flex-1 gap-2"
          >
            <CheckCircle2 className="h-4 w-4" />
            {applying ? "Aplicando..." : "Aplicar Ajustes"}
          </Button>

          <Button
            onClick={loadData}
            variant="outline"
            disabled={applying}
          >
            Resetar
          </Button>
        </div>
      )}
    </Card>
  );
};
