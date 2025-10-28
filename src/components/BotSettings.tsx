import { useState, useEffect } from "react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Save, Key } from "lucide-react";
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
    timeDifference: 5,
    changeInPrice: 3,
    stopLoss: 3,
    takeProfit: 6,
  });
  const [loading, setLoading] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    loadUserAndConfig();
  }, []);

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
          timeDifference: 5,
          changeInPrice: 3,
          stopLoss: Number(config.stop_loss_percent),
          takeProfit: Number(config.take_profit_percent),
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
      // Selecionar par ótimo baseado em volatilidade
      const optimalPair = await pairSelectionService.selectOptimalPair();
      
      const config = await botConfigService.getConfig(userId);
      
      if (config) {
        const success = await botConfigService.updateConfig(userId, {
          test_mode: settings.testMode,
          trading_pair: optimalPair,
          quantity: settings.quantity,
          stop_loss_percent: RISK_SETTINGS.STOP_LOSS_PERCENT,
          take_profit_percent: RISK_SETTINGS.TAKE_PROFIT_PERCENT,
        });

        if (success && settings.apiKey && settings.apiSecret) {
          await botConfigService.saveApiCredentials(userId, settings.apiKey, settings.apiSecret);
        }

        if (success) {
          toast.success(`Configurações salvas! Par selecionado: ${optimalPair}`);
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
            trading_pair: optimalPair,
            quantity: settings.quantity,
            take_profit_percent: RISK_SETTINGS.TAKE_PROFIT_PERCENT,
            stop_loss_percent: RISK_SETTINGS.STOP_LOSS_PERCENT,
            daily_profit_goal: 50,
            is_running: false,
            is_powered_on: true,
          });

        if (!error && settings.apiKey && settings.apiSecret) {
          await botConfigService.saveApiCredentials(userId, settings.apiKey, settings.apiSecret);
          toast.success(`Configurações criadas! Par selecionado: ${optimalPair}`);
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
          <div className="p-3 rounded-lg bg-primary/10 border border-primary/20">
            <p className="text-sm text-muted-foreground">
              <span className="font-semibold text-primary">🎯 Seleção Automática:</span> O bot escolhe automaticamente o par de negociação mais volátil e adequado para a estratégia.
            </p>
          </div>

          <div className="space-y-2">
            <Label>Quantidade por Trade (USDT)</Label>
            <Input
              type="number"
              value={settings.quantity}
              onChange={(e) => setSettings({ ...settings, quantity: Number(e.target.value) })}
            />
          </div>

          <div className="space-y-2">
            <Label>Intervalo de Tempo (minutos)</Label>
            <Input
              type="number"
              value={settings.timeDifference}
              onChange={(e) => setSettings({ ...settings, timeDifference: Number(e.target.value) })}
              disabled
            />
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-2">
              <Label className="text-xs">Variação %</Label>
              <Input
                type="number"
                value={settings.changeInPrice}
                onChange={(e) => setSettings({ ...settings, changeInPrice: Number(e.target.value) })}
                className="text-center"
                disabled
              />
            </div>

            <div className="space-y-2">
              <Label className="text-xs text-danger">Stop Loss %</Label>
              <Input
                type="number"
                value={settings.stopLoss}
                onChange={(e) => setSettings({ ...settings, stopLoss: Number(e.target.value) })}
                className="text-center"
                disabled
              />
            </div>

            <div className="space-y-2">
              <Label className="text-xs text-success">Take Profit %</Label>
              <Input
                type="number"
                value={settings.takeProfit}
                onChange={(e) => setSettings({ ...settings, takeProfit: Number(e.target.value) })}
                className="text-center"
                disabled
              />
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
