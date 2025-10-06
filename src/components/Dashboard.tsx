import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Play, Pause, Activity, ArrowUpRight, ArrowDownRight, Save, Key, Power } from "lucide-react";
import { StatsCard } from "./StatsCard";
import { CoinMonitor } from "./CoinMonitor";
import { TradeHistory } from "./TradeHistory";
import { toast } from "sonner";
import evolonLogo from "@/assets/evolon-bot-logo.jpg";

export const Dashboard = () => {
  const [botRunning, setBotRunning] = useState(false);
  const [tradingMode, setTradingMode] = useState<"test" | "real">("test");
  const [botPoweredOff, setBotPoweredOff] = useState(false);
  const [dailyProfitPercent, setDailyProfitPercent] = useState(0);
  const [pausedUntilMidnight, setPausedUntilMidnight] = useState(false);
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

  const stats = {
    totalTrades: 127,
    profitableTrades: 89,
    totalProfit: 48700,
    initialCapital: 10000.00,
    activePositions: 3,
    conversionRate: 82.42,
  };

  const profitPercentage = ((stats.profitableTrades / stats.totalTrades) * 100).toFixed(1);

  // Checar metas diárias e controlar o bot
  useEffect(() => {
    if (botPoweredOff) return;

    // Checar se atingiu take profit ou stop loss
    if (botRunning && (dailyProfitPercent >= 6 || dailyProfitPercent <= -3)) {
      setBotRunning(false);
      setPausedUntilMidnight(true);
      toast.warning(
        dailyProfitPercent >= 6 
          ? "Meta de Take Profit (6%) atingida! Bot pausado até meia-noite." 
          : "Stop Loss (3%) atingido! Bot pausado até meia-noite."
      );
    }

    // Checar se é meia-noite para resetar
    const checkMidnight = setInterval(() => {
      const now = new Date();
      if (now.getHours() === 0 && now.getMinutes() === 0 && pausedUntilMidnight) {
        setDailyProfitPercent(0);
        setPausedUntilMidnight(false);
        if (tradingMode === "real" && !botPoweredOff) {
          setBotRunning(true);
          toast.success("Meia-noite! Bot retomado automaticamente no modo real.");
        }
      }
    }, 60000); // Checar a cada minuto

    return () => clearInterval(checkMidnight);
  }, [botRunning, dailyProfitPercent, pausedUntilMidnight, tradingMode, botPoweredOff]);

  const handleSaveSettings = () => {
    toast.success("Configurações salvas com sucesso!");
  };

  const handlePowerToggle = () => {
    const newState = !botPoweredOff;
    setBotPoweredOff(newState);
    if (newState) {
      setBotRunning(false);
      toast.error("Bot desligado! Não realizará operações até ser ligado novamente.");
    } else {
      setPausedUntilMidnight(false);
      setDailyProfitPercent(0);
      toast.success("Bot ligado! Pronto para operar.");
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <main className="w-full p-8">
        <div className="max-w-7xl mx-auto space-y-8">
          {/* Header */}
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-6">
              <img src={evolonLogo} alt="Evolón Bot" className="h-48 w-auto" />
              <div className="flex items-center gap-2 bg-secondary/50 border border-border rounded-lg p-1">
                <Button
                  variant={tradingMode === "test" ? "default" : "ghost"}
                  size="sm"
                  onClick={() => {
                    setTradingMode("test");
                    setSettings({ ...settings, testMode: true });
                  }}
                  className="gap-2"
                  disabled={botPoweredOff}
                >
                  Modo Teste
                </Button>
                <Button
                  variant={tradingMode === "real" ? "default" : "ghost"}
                  size="sm"
                  onClick={() => {
                    setTradingMode("real");
                    setSettings({ ...settings, testMode: false });
                  }}
                  className="gap-2"
                  disabled={botPoweredOff}
                >
                  Modo Real
                </Button>
              </div>
              <Badge 
                variant={botPoweredOff ? "destructive" : (botRunning ? "default" : "secondary")} 
                className={`text-sm px-4 py-2 ${
                  botPoweredOff 
                    ? "bg-destructive/20 text-destructive border-destructive/50" 
                    : "bg-primary/10 text-primary border-primary/20"
                }`}
              >
                <Activity className="w-4 h-4 mr-2" />
                {botPoweredOff ? "🔴 DESLIGADO" : (botRunning ? "Ativo" : "Pausado")}
              </Badge>
              {pausedUntilMidnight && !botPoweredOff && (
                <Badge variant="secondary" className="text-sm px-4 py-2 bg-yellow-500/10 text-yellow-600 border-yellow-500/20">
                  ⏸️ Meta Diária Atingida - Retoma à 00:00
                </Badge>
              )}
            </div>
            <div className="flex items-center gap-3">
              <Button
                variant={botPoweredOff ? "default" : "destructive"}
                onClick={handlePowerToggle}
                className="gap-2"
              >
                <Power className="w-5 h-5" />
                {botPoweredOff ? "Ligar Bot" : "Desligar Bot"}
              </Button>
              <Button
                variant={botRunning ? "destructive" : "default"}
                onClick={() => {
                  if (botPoweredOff) {
                    toast.error("Bot está desligado! Ligue-o primeiro.");
                    return;
                  }
                  if (pausedUntilMidnight) {
                    toast.warning("Bot pausado até meia-noite por atingir meta diária.");
                    return;
                  }
                  setBotRunning(!botRunning);
                }}
                className="gap-2 shadow-glow-primary"
                disabled={botPoweredOff || pausedUntilMidnight}
              >
                {botRunning ? (
                  <>
                    <Pause className="w-5 h-5" />
                    Pausar Bot
                  </>
                ) : (
                  <>
                    <Play className="w-5 h-5" />
                    Iniciar Bot
                  </>
                )}
              </Button>
            </div>
          </div>

          {/* Bot Settings */}
          <Card className="p-6 bg-gradient-card border-border">
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <h2 className="text-2xl font-bold">Configurações do Bot</h2>
                <div className="flex items-center gap-3">
                  <Badge variant={tradingMode === "real" ? "destructive" : "secondary"} className="text-base px-4 py-2">
                    {tradingMode === "real" ? "🔴 MODO REAL ATIVO" : "Modo Teste"}
                  </Badge>
                  <Badge 
                    variant={dailyProfitPercent >= 6 ? "default" : (dailyProfitPercent <= -3 ? "destructive" : "secondary")} 
                    className="text-base px-4 py-2"
                  >
                    Profit Diário: {dailyProfitPercent > 0 ? "+" : ""}{dailyProfitPercent.toFixed(2)}%
                  </Badge>
                </div>
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
                      disabled
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
                <Button onClick={handleSaveSettings} className="gap-2">
                  <Save className="w-4 h-4" />
                  Salvar Configurações
                </Button>
              </div>
            </div>
          </Card>

          {/* Top Metrics Row */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            {/* Capital Inicial Card */}
            <Card className="p-5 bg-gradient-card border-border hover:border-primary/50 transition-all duration-300">
              <div className="space-y-2">
                <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Capital Inicial</p>
                <div className="flex items-end gap-2">
                  <p className="text-3xl font-bold text-primary tracking-tight">32.5k</p>
                  <ArrowUpRight className="w-5 h-5 text-success mb-1" />
                </div>
                <div className="flex items-center gap-1 text-success text-xs">
                  <ArrowUpRight className="w-3 h-3" />
                  <span>3.7%</span>
                </div>
              </div>
            </Card>

            {/* Taxa de Sucesso Card */}
            <Card className="p-5 bg-gradient-card border-border hover:border-primary/50 transition-all duration-300">
              <div className="space-y-2">
                <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Taxa de Sucesso</p>
                <div className="flex items-end gap-2">
                  <p className="text-3xl font-bold text-primary tracking-tight">{stats.conversionRate}%</p>
                  <ArrowDownRight className="w-5 h-5 text-danger mb-1" />
                </div>
                <div className="flex items-center gap-1 text-danger text-xs">
                  <ArrowDownRight className="w-3 h-3" />
                  <span>1.6%</span>
                </div>
              </div>
            </Card>

            {/* Total de Trades Card */}
            <Card className="p-5 bg-gradient-card border-border hover:border-primary/50 transition-all duration-300">
              <div className="space-y-2">
                <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Total de Trades</p>
                <div className="flex items-end gap-2">
                  <p className="text-3xl font-bold text-primary tracking-tight">{stats.totalTrades}</p>
                </div>
              </div>
            </Card>

            {/* Posições Ativas Card */}
            <Card className="p-5 bg-gradient-card border-border hover:border-primary/50 transition-all duration-300">
              <div className="space-y-2">
                <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Posições Ativas</p>
                <div className="flex items-end gap-2">
                  <p className="text-3xl font-bold text-primary tracking-tight">{stats.activePositions}</p>
                </div>
              </div>
            </Card>
          </div>

          {/* Profit Section */}
          <Card className="p-6 bg-gradient-card border-border">
            <div className="space-y-5">
              <div className="flex items-start justify-between">
                <div className="space-y-2">
                  <p className="text-sm text-muted-foreground font-medium uppercase tracking-wide">Profit</p>
                  <div className="flex items-end gap-3">
                    <p className="text-3xl font-bold text-primary tracking-tight">
                      ${(stats.totalProfit / 1000).toFixed(1)}k
                    </p>
                    <ArrowUpRight className="w-5 h-5 text-success mb-1" />
                  </div>
                  <div className="flex items-center gap-1 text-success text-sm">
                    <ArrowUpRight className="w-4 h-4" />
                    <span>1.8%</span>
                  </div>
                </div>
              </div>
              
              {/* Placeholder for chart */}
              <div className="h-64 bg-secondary/30 rounded-lg flex items-center justify-center border border-border">
                <p className="text-muted-foreground">Gráfico de Lucro (Em breve)</p>
              </div>
            </div>
          </Card>

          {/* Main Content Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <Card className="lg:col-span-2 p-6 bg-gradient-card border-border">
              <CoinMonitor isRunning={botRunning} />
            </Card>
            <Card className="p-6 bg-gradient-card border-border">
              <TradeHistory />
            </Card>
          </div>
        </div>
      </main>
    </div>
  );
};
