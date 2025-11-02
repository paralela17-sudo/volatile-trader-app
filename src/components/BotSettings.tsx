import { useState, useEffect } from "react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Save, Key, TrendingUp } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { botConfigService } from "@/services/botService";
import { pairSelectionService } from "@/services/pairSelectionService";
import { RISK_SETTINGS } from "@/services/riskService";

export const BotSettings = () => {
  const [settings, setSettings] = useState({
    apiKey: "",
    apiSecret: "",
    testMode: true,
    quantity: 100,
    stopLoss: RISK_SETTINGS.STOP_LOSS_PERCENT,
    takeProfit: RISK_SETTINGS.TAKE_PROFIT_PERCENT,
    multiPairCount: 5,
  });
  const [loading, setLoading] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [currentPairs, setCurrentPairs] = useState<string[]>([]);

  useEffect(() => {
    loadUserAndConfig();
    loadCurrentPairs();
  }, []);

  const loadCurrentPairs = async () => {
    try {
      const pairs = await pairSelectionService.selectMultipleOptimalPairs(settings.multiPairCount);
      setCurrentPairs(pairs);
    } catch (error) {
      console.error("Erro ao carregar pares:", error);
    }
  };

  const loadUserAndConfig = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error("Usuário não autenticado");
        return;
      }
      
      setUserId(user.id);
      
      const config = await botConfigService.getConfig(user.id);
      if (config) {
        setSettings({
          apiKey: "",
          apiSecret: "",
          testMode: config.test_mode,
          quantity: Number(config.quantity),
          stopLoss: RISK_SETTINGS.STOP_LOSS_PERCENT,
          takeProfit: RISK_SETTINGS.TAKE_PROFIT_PERCENT,
          multiPairCount: 5,
        });
      }
    } catch (error) {
      console.error("Erro ao carregar configurações:", error);
      toast.error("Erro ao carregar configurações");
    }
  };

  const handleSave = async () => {
    if (!userId) {
      toast.error("Usuário não autenticado");
      return;
    }

    if (!settings.apiKey || !settings.apiSecret) {
      toast.error("Por favor, preencha a API Key e API Secret");
      return;
    }

    setLoading(true);
    try {
      // Selecionar múltiplos pares baseados em volatilidade
      const optimalPairs = await pairSelectionService.selectMultipleOptimalPairs(settings.multiPairCount);
      setCurrentPairs(optimalPairs);
      
      const config = await botConfigService.getConfig(userId);
      
        if (config) {
        const success = await botConfigService.updateConfig(userId, {
          test_mode: settings.testMode,
          trading_pair: optimalPairs[0], // Usar o primeiro par como referência
          quantity: settings.quantity,
          stop_loss_percent: RISK_SETTINGS.STOP_LOSS_PERCENT,
          take_profit_percent: RISK_SETTINGS.TAKE_PROFIT_PERCENT,
        });

        if (success && settings.apiKey && settings.apiSecret) {
          await botConfigService.saveApiCredentials(userId, settings.apiKey, settings.apiSecret);
        }

        if (success) {
          toast.success(`Configurações salvas! Monitorando ${optimalPairs.length} pares: ${optimalPairs.join(", ")}`);
          setSettings(prev => ({ ...prev, apiKey: "", apiSecret: "" }));
        } else {
          toast.error("Erro ao salvar configurações");
        }
      } else {
        const { error } = await supabase
          .from('bot_configurations')
          .insert({
            user_id: userId,
            test_mode: settings.testMode,
            test_balance: 1000,
            trading_pair: optimalPairs[0],
            quantity: settings.quantity,
            take_profit_percent: RISK_SETTINGS.TAKE_PROFIT_PERCENT,
            stop_loss_percent: RISK_SETTINGS.STOP_LOSS_PERCENT,
            daily_profit_goal: 50,
            is_running: false,
            is_powered_on: true,
          });

        if (!error && settings.apiKey && settings.apiSecret) {
          await botConfigService.saveApiCredentials(userId, settings.apiKey, settings.apiSecret);
          toast.success(`Configurações criadas! Monitorando ${optimalPairs.length} pares: ${optimalPairs.join(", ")}`);
          setSettings(prev => ({ ...prev, apiKey: "", apiSecret: "" }));
        } else {
          toast.error("Erro ao criar configurações");
        }
      }
    } catch (error) {
      console.error("Erro ao salvar:", error);
      toast.error("Erro ao salvar configurações");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Configurações do Bot</h2>
        <Badge variant={settings.testMode ? "secondary" : "destructive"}>
          {settings.testMode ? "Modo Teste" : "Modo Real"}
        </Badge>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* API Configuration */}
        <div className="space-y-4">
          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <Key className="w-4 h-4" />
              Binance API Key
            </Label>
            <Input
              type="password"
              placeholder="Sua API Key da Binance"
              value={settings.apiKey}
              onChange={(e) => setSettings({ ...settings, apiKey: e.target.value })}
              className="font-mono"
            />
          </div>

          <div className="space-y-2">
            <Label>Binance API Secret</Label>
            <Input
              type="password"
              placeholder="Sua API Secret da Binance"
              value={settings.apiSecret}
              onChange={(e) => setSettings({ ...settings, apiSecret: e.target.value })}
              className="font-mono"
            />
          </div>

          <div className="flex items-center justify-between p-4 rounded-lg border border-border bg-secondary/20">
            <div className="space-y-1">
              <Label>Modo de Teste</Label>
              <p className="text-sm text-muted-foreground">
                Ativar para simular trades sem usar dinheiro real
              </p>
            </div>
            <Switch
              checked={settings.testMode}
              onCheckedChange={(checked) => setSettings({ ...settings, testMode: checked })}
            />
          </div>
        </div>

                {/* Trading Parameters */}
                <div className="space-y-4">
                  <div className="p-4 rounded-lg bg-primary/10 border border-primary/20">
                    <div className="flex items-center gap-2 mb-3">
                      <TrendingUp className="w-4 h-4 text-primary" />
                      <span className="font-semibold text-primary">📊 Estratégia: Mean Reversion</span>
                    </div>
                    <div className="space-y-2 text-xs text-muted-foreground">
                      <p><strong>Indicadores:</strong> Bollinger Bands (20, 2.0) + RSI (14)</p>
                      <p><strong>Entrada:</strong> Preço ≤ Lower Band + RSI &lt; 35 (oversold)</p>
                      <p><strong>Saída:</strong> Preço ≥ Upper Band + RSI &gt; 70 (overbought)</p>
                      <p><strong>Proteção:</strong> Stop Loss 2.5% | Take Profit 5.0%</p>
                    </div>
                    {currentPairs.length > 0 && (
                      <div className="space-y-1 mt-3 pt-3 border-t border-primary/20">
                        <p className="text-xs font-semibold text-primary">Pares Monitorados:</p>
                        <div className="flex flex-wrap gap-1">
                          {currentPairs.map(pair => (
                            <Badge key={pair} variant="secondary" className="text-xs">
                              {pair}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label>Número de Pares Simultâneos</Label>
                    <Input
                      type="number"
                      value={settings.multiPairCount}
                      onChange={(e) => {
                        const count = Number(e.target.value);
                        setSettings({ ...settings, multiPairCount: count });
                        if (count >= 5 && count <= 10) {
                          loadCurrentPairs();
                        }
                      }}
                      min="5"
                      max="10"
                    />
                    <p className="text-xs text-muted-foreground">
                      Recomendado: 5-10 pares para melhor diversificação
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label>Quantidade por Trade (USDT)</Label>
                    <Input
                      type="number"
                      value={settings.quantity}
                      onChange={(e) => setSettings({ ...settings, quantity: Number(e.target.value) })}
                      min="10"
                    />
                    <p className="text-xs text-muted-foreground">
                      Capital por rodada, distribuído entre {settings.multiPairCount} pares
                    </p>
                  </div>

          <div className="p-4 rounded-lg bg-yellow-500/10 border border-yellow-500/30">
            <p className="text-sm font-semibold text-yellow-700 dark:text-yellow-400 mb-2">
              🔒 Parâmetros Fixos de Risco
            </p>
            <p className="text-xs text-muted-foreground mb-3">
              Valores otimizados para Mean Reversion (ratio 1:2 risk/reward):
            </p>
            <div className="grid grid-cols-2 gap-3">
              <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/30">
                <Label className="text-xs text-red-600 dark:text-red-400 font-semibold">Stop Loss</Label>
                <p className="text-2xl font-bold text-red-600 dark:text-red-400 mt-1">{RISK_SETTINGS.STOP_LOSS_PERCENT}%</p>
                <p className="text-xs text-muted-foreground mt-1">por operação</p>
              </div>
              <div className="p-3 rounded-lg bg-green-500/10 border border-green-500/30">
                <Label className="text-xs text-green-600 dark:text-green-400 font-semibold">Take Profit</Label>
                <p className="text-2xl font-bold text-green-600 dark:text-green-400 mt-1">{RISK_SETTINGS.TAKE_PROFIT_PERCENT}%</p>
                <p className="text-xs text-muted-foreground mt-1">por operação</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="flex justify-end">
        <Button onClick={handleSave} className="gap-2" disabled={loading}>
          <Save className="w-4 h-4" />
          {loading ? "Salvando..." : "Salvar Configurações"}
        </Button>
      </div>
    </div>
  );
};
