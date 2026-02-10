import { useState, useEffect } from "react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Save, Key, TrendingUp } from "lucide-react";
import { toast } from "sonner";
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
  const [loadingPair, setLoadingPair] = useState(false);
  const [apiKeysConfigured, setApiKeysConfigured] = useState(false);
  const [tradingPair, setTradingPair] = useState("");
  const [currentPairs, setCurrentPairs] = useState<string[]>([]);

  useEffect(() => {
    loadConfig();
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

  const loadConfig = async () => {
    try {
      setLoading(true);
      const config = await botConfigService.getConfig("local-user");
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
        setTradingPair(config.trading_pair || "");

        if (config.api_key_encrypted && config.api_secret_encrypted) {
          setApiKeysConfigured(true);
        }
      }
    } catch (error) {
      console.error("Erro ao carregar configurações:", error);
      toast.error("Erro ao carregar configurações");
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    const userId = "local-user";

    if (!settings.apiKey && !apiKeysConfigured) {
      toast.error("Por favor, preencha a API Key");
      return;
    }

    setLoading(true);
    try {
      const optimalPairs = await pairSelectionService.selectMultipleOptimalPairs(settings.multiPairCount);
      setCurrentPairs(optimalPairs);

      const success = await botConfigService.updateConfig(userId, {
        test_mode: settings.testMode,
        trading_pair: optimalPairs[0],
        quantity: settings.quantity,
        stop_loss_percent: RISK_SETTINGS.STOP_LOSS_PERCENT,
        take_profit_percent: RISK_SETTINGS.TAKE_PROFIT_PERCENT,
      });

      if (success && settings.apiKey && settings.apiSecret) {
        await botConfigService.saveApiCredentials(userId, settings.apiKey, settings.apiSecret);
        setApiKeysConfigured(true);
      }

      if (success) {
        toast.success(`Configurações salvas localmente! Monitorando ${optimalPairs.length} pares.`);
        setSettings(prev => ({ ...prev, apiKey: "", apiSecret: "" }));
        setTradingPair(optimalPairs[0]);
      } else {
        toast.error("Erro ao salvar configurações");
      }
    } catch (error) {
      console.error("Erro ao salvar:", error);
      toast.error("Erro ao salvar configurações");
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateTradingPair = async () => {
    try {
      setLoadingPair(true);
      const newPair = await pairSelectionService.updateBotTradingPair("local-user");
      setTradingPair(newPair);
      toast.success(`Par de negociação atualizado para ${newPair}`);
    } catch (error) {
      console.error("Erro ao atualizar par de negociação:", error);
      toast.error("Erro ao atualizar par de negociação");
    } finally {
      setLoadingPair(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Configurações do Bot (Modo Local)</h2>
        <Badge variant={settings.testMode ? "secondary" : "destructive"}>
          {settings.testMode ? "Modo Teste" : "Modo Real"}
        </Badge>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="space-y-4">
          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <Key className="w-4 h-4" />
              Binance API Key {apiKeysConfigured && "(Configurada)"}
            </Label>
            <Input
              type="password"
              placeholder={apiKeysConfigured ? "●●●●●●●●●●" : "Sua API Key da Binance"}
              value={settings.apiKey}
              onChange={(e) => setSettings({ ...settings, apiKey: e.target.value })}
              className="font-mono"
            />
          </div>

          <div className="space-y-2">
            <Label>Binance API Secret</Label>
            <Input
              type="password"
              placeholder={apiKeysConfigured ? "●●●●●●●●●●" : "Sua API Secret da Binance"}
              value={settings.apiSecret}
              onChange={(e) => setSettings({ ...settings, apiSecret: e.target.value })}
              className="font-mono"
            />
          </div>

          <div className="flex items-center justify-between p-4 rounded-lg border border-border bg-secondary/20">
            <div className="space-y-1">
              <Label>Modo de Teste</Label>
              <p className="text-sm text-muted-foreground">
                Ativar para simular trades sem usar dinheiro real na VPS
              </p>
            </div>
            <Switch
              checked={settings.testMode}
              onCheckedChange={(checked) => setSettings({ ...settings, testMode: checked })}
            />
          </div>
        </div>

        <div className="space-y-4">
          <div className="p-4 rounded-lg bg-primary/10 border border-primary/20">
            <div className="flex items-center gap-2 mb-3">
              <TrendingUp className="w-4 h-4 text-primary" />
              <span className="font-semibold text-primary">📊 Estratégia: Mean Reversion Autonoma</span>
            </div>
            <div className="space-y-2 text-xs text-muted-foreground">
              <p>O bot agora opera 100% localmente via Node.js/Bun na VPS.</p>
              <p><strong>Proteção:</strong> Stop Loss {RISK_SETTINGS.STOP_LOSS_PERCENT}% | Take Profit {RISK_SETTINGS.TAKE_PROFIT_PERCENT}%</p>
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
            <Label>Quantidade por Trade (USDT)</Label>
            <Input
              type="number"
              value={settings.quantity}
              onChange={(e) => setSettings({ ...settings, quantity: Number(e.target.value) })}
              min="10"
            />
          </div>

          <div className="p-4 rounded-lg bg-yellow-500/10 border border-yellow-500/30">
            <p className="text-sm font-semibold text-yellow-700 dark:text-yellow-400 mb-2">
              🔒 Parâmetros de Risco
            </p>
            <div className="grid grid-cols-2 gap-3">
              <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/30">
                <Label className="text-xs text-red-600 dark:text-red-400 font-semibold">Stop Loss</Label>
                <p className="text-2xl font-bold text-red-600 dark:text-red-400 mt-1">{RISK_SETTINGS.STOP_LOSS_PERCENT}%</p>
              </div>
              <div className="p-3 rounded-lg bg-green-500/10 border border-green-500/30">
                <Label className="text-xs text-green-600 dark:text-green-400 font-semibold">Take Profit</Label>
                <p className="text-2xl font-bold text-green-600 dark:text-green-400 mt-1">{RISK_SETTINGS.TAKE_PROFIT_PERCENT}%</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="flex justify-end gap-3">
        <Button onClick={handleUpdateTradingPair} variant="outline" disabled={loading || loadingPair}>
          {loadingPair ? "Atualizando..." : "Trocar Par Agora"}
        </Button>
        <Button onClick={handleSave} className="gap-2" disabled={loading}>
          <Save className="w-4 h-4" />
          {loading ? "Salvando..." : "Salvar Localmente"}
        </Button>
      </div>
    </div>
  );
};
