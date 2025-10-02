import { useState } from "react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Save, Key } from "lucide-react";
import { toast } from "sonner";

export const BotSettings = () => {
  const [settings, setSettings] = useState({
    apiKey: "",
    apiSecret: "",
    testMode: true,
    pairWith: "USDT",
    quantity: 100,
    timeDifference: 5,
    changeInPrice: 3,
    stopLoss: 3,
    takeProfit: 6,
  });

  const handleSave = () => {
    toast.success("Configurações salvas com sucesso!");
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
          <div className="space-y-2">
            <Label>Par de Negociação</Label>
            <Input
              value={settings.pairWith}
              onChange={(e) => setSettings({ ...settings, pairWith: e.target.value })}
              placeholder="USDT"
            />
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
              />
            </div>

            <div className="space-y-2">
              <Label className="text-xs text-danger">Stop Loss %</Label>
              <Input
                type="number"
                value={settings.stopLoss}
                onChange={(e) => setSettings({ ...settings, stopLoss: Number(e.target.value) })}
                className="text-center"
              />
            </div>

            <div className="space-y-2">
              <Label className="text-xs text-success">Take Profit %</Label>
              <Input
                type="number"
                value={settings.takeProfit}
                onChange={(e) => setSettings({ ...settings, takeProfit: Number(e.target.value) })}
                className="text-center"
              />
            </div>
          </div>
        </div>
      </div>

      <div className="flex justify-end">
        <Button onClick={handleSave} className="gap-2">
          <Save className="w-4 h-4" />
          Salvar Configurações
        </Button>
      </div>
    </div>
  );
};
