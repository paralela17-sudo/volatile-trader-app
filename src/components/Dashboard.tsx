import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Play, Pause, Activity, ArrowUpRight, ArrowDownRight, Save, Key, Power, LogOut } from "lucide-react";
import { StatsCard } from "./StatsCard";
import { CoinMonitor } from "./CoinMonitor";
import { TradeHistory } from "./TradeHistory";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { z } from "zod";
import evolonLogo from "@/assets/evolon-bot-logo.jpg";

// Validation schema
const botConfigSchema = z.object({
  apiKey: z.string().min(1, "API Key é obrigatória"),
  apiSecret: z.string().min(1, "API Secret é obrigatória"),
  testMode: z.boolean(),
  quantity: z.number().min(0.001, "Quantidade mínima é 0.001").max(100000, "Quantidade muito alta"),
  takeProfit: z.number().min(0.1, "Take Profit mínimo é 0.1%").max(100, "Take Profit máximo é 100%"),
  stopLoss: z.number().min(0.1, "Stop Loss mínimo é 0.1%").max(100, "Stop Loss máximo é 100%"),
  dailyProfitGoal: z.number().min(1, "Meta diária mínima é 1").max(10000, "Meta muito alta"),
  testBalance: z.number().min(0, "Saldo não pode ser negativo").max(1000000, "Saldo muito alto"),
});

export const Dashboard = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [configId, setConfigId] = useState<string | null>(null);
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
    testBalance: 1000,
    dailyProfitGoal: 50,
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

  // Load configuration from database
  useEffect(() => {
    loadBotConfiguration();
  }, []);

  const loadBotConfiguration = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        navigate("/auth");
        return;
      }

      const { data, error } = await supabase
        .from("bot_configurations")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();

      if (error) throw error;

      if (data) {
        setConfigId(data.id);
        setSettings({
          apiKey: "", // Don't load actual keys for security
          apiSecret: "",
          testMode: data.test_mode,
          pairWith: data.trading_pair || "USDT",
          quantity: Number(data.quantity) || 100,
          timeDifference: 5,
          changeInPrice: 3,
          stopLoss: Number(data.stop_loss_percent) || 3,
          takeProfit: Number(data.take_profit_percent) || 6,
          testBalance: Number(data.test_balance) || 1000,
          dailyProfitGoal: Number(data.daily_profit_goal) || 50,
        });
        setTradingMode(data.test_mode ? "test" : "real");
        setBotRunning(data.is_running || false);
        setBotPoweredOff(!data.is_powered_on);
      }
    } catch (error: any) {
      console.error("Error loading configuration:", error);
      toast.error("Erro ao carregar configurações");
    } finally {
      setLoading(false);
    }
  };

  // Checar metas diárias e controlar o bot
  useEffect(() => {
    if (botPoweredOff) return;

    if (botRunning && (dailyProfitPercent >= settings.takeProfit || dailyProfitPercent <= -settings.stopLoss)) {
      setBotRunning(false);
      setPausedUntilMidnight(true);
      saveBotState(false, botPoweredOff);
      toast.warning(
        dailyProfitPercent >= settings.takeProfit
          ? `Meta de Take Profit (${settings.takeProfit}%) atingida! Bot pausado até meia-noite.`
          : `Stop Loss (${settings.stopLoss}%) atingido! Bot pausado até meia-noite.`
      );
    }

    const checkMidnight = setInterval(() => {
      const now = new Date();
      if (now.getHours() === 0 && now.getMinutes() === 0 && pausedUntilMidnight) {
        setDailyProfitPercent(0);
        setPausedUntilMidnight(false);
        if (tradingMode === "real" && !botPoweredOff) {
          setBotRunning(true);
          saveBotState(true, false);
          toast.success("Meia-noite! Bot retomado automaticamente no modo real.");
        }
      }
    }, 60000);

    return () => clearInterval(checkMidnight);
  }, [botRunning, dailyProfitPercent, pausedUntilMidnight, tradingMode, botPoweredOff, settings.takeProfit, settings.stopLoss]);

  const saveBotState = async (isRunning: boolean, isPoweredOff: boolean) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      if (configId) {
        await supabase
          .from("bot_configurations")
          .update({
            is_running: isRunning,
            is_powered_on: !isPoweredOff,
          })
          .eq("id", configId);
      }
    } catch (error) {
      console.error("Error saving bot state:", error);
    }
  };

  const handleSaveSettings = async () => {
    try {
      // Validate inputs
      botConfigSchema.parse({
        apiKey: settings.apiKey || "placeholder", // Allow empty if not changed
        apiSecret: settings.apiSecret || "placeholder",
        testMode: settings.testMode,
        quantity: settings.quantity,
        takeProfit: settings.takeProfit,
        stopLoss: settings.stopLoss,
        dailyProfitGoal: settings.dailyProfitGoal,
        testBalance: settings.testBalance,
      });

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        navigate("/auth");
        return;
      }

      const configData = {
        user_id: user.id,
        test_mode: settings.testMode,
        test_balance: settings.testBalance,
        trading_pair: settings.pairWith,
        quantity: settings.quantity,
        take_profit_percent: settings.takeProfit,
        stop_loss_percent: settings.stopLoss,
        daily_profit_goal: settings.dailyProfitGoal,
        is_running: botRunning,
        is_powered_on: !botPoweredOff,
        // Only update API credentials if they were entered
        ...(settings.apiKey && { api_key_encrypted: settings.apiKey }),
        ...(settings.apiSecret && { api_secret_encrypted: settings.apiSecret }),
      };

      if (configId) {
        const { error } = await supabase
          .from("bot_configurations")
          .update(configData)
          .eq("id", configId);

        if (error) throw error;
      } else {
        const { data, error } = await supabase
          .from("bot_configurations")
          .insert([configData])
          .select()
          .single();

        if (error) throw error;
        if (data) setConfigId(data.id);
      }

      // Clear API key fields after saving
      setSettings({ ...settings, apiKey: "", apiSecret: "" });
      toast.success("Configurações salvas com sucesso!");
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        const firstError = error.issues[0];
        toast.error(firstError.message);
      } else {
        console.error("Error saving settings:", error);
        toast.error("Erro ao salvar configurações");
      }
    }
  };

  const handlePowerToggle = () => {
    const newState = !botPoweredOff;
    setBotPoweredOff(newState);
    if (newState) {
      setBotRunning(false);
      saveBotState(false, true);
      toast.error("Bot desligado! Não realizará operações até ser ligado novamente.");
    } else {
      setPausedUntilMidnight(false);
      setDailyProfitPercent(0);
      saveBotState(false, false);
      toast.success("Bot ligado! Pronto para operar.");
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/auth");
    toast.success("Logout realizado com sucesso!");
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-lg">Carregando configurações...</div>
      </div>
    );
  }

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
                variant="ghost"
                onClick={handleLogout}
                className="gap-2"
              >
                <LogOut className="w-5 h-5" />
                Sair
              </Button>
              <Button
                variant={botPoweredOff ? "default" : "destructive"}
                onClick={handlePowerToggle}
                className="gap-2"
              >
                <Power className="w-5 h-5" />
                {botPoweredOff ? "Ligar Bot" : "Desligar Bot"}
              </Button>
              <Button
                variant={botRunning ? "default" : "outline"}
                onClick={() => {
                  if (botPoweredOff) {
                    toast.error("Bot está desligado! Ligue-o primeiro.");
                    return;
                  }
                  if (pausedUntilMidnight) {
                    toast.warning("Bot pausado até meia-noite por atingir meta diária.");
                    return;
                  }
                  const newState = !botRunning;
                  setBotRunning(newState);
                  saveBotState(newState, botPoweredOff);
                }}
                className={`gap-2 ${botRunning ? 'shadow-glow-primary' : 'border-warning text-warning hover:bg-warning/10 bg-warning/5'}`}
                disabled={botPoweredOff || pausedUntilMidnight}
              >
                {botRunning ? (
                  <>
                    <Pause className="w-5 h-5" />
                    Pausar Bot
                  </>
                ) : (
                  <>
                    <Pause className="w-5 h-5" />
                    ⏸️ PAUSADO
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
                    variant={dailyProfitPercent >= settings.takeProfit ? "default" : (dailyProfitPercent <= -settings.stopLoss ? "destructive" : "secondary")} 
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
                      placeholder="Digite para atualizar a API Key"
                      value={settings.apiKey}
                      onChange={(e) => setSettings({ ...settings, apiKey: e.target.value })}
                      className="font-mono"
                    />
                    <p className="text-xs text-muted-foreground">
                      {configId ? "Deixe em branco para manter a chave atual" : "Obrigatório para operar"}
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label>Binance API Secret</Label>
                    <Input
                      type="password"
                      placeholder="Digite para atualizar a API Secret"
                      value={settings.apiSecret}
                      onChange={(e) => setSettings({ ...settings, apiSecret: e.target.value })}
                      className="font-mono"
                    />
                    <p className="text-xs text-muted-foreground">
                      {configId ? "Deixe em branco para manter a secret atual" : "Obrigatório para operar"}
                    </p>
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
                      min="0.001"
                      max="100000"
                      step="0.001"
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
                        min="0.1"
                        max="100"
                        step="0.1"
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
                        min="0.1"
                        max="100"
                        step="0.1"
                        disabled
                      />
                    </div>
                  </div>

                  {settings.testMode && (
                    <div className="space-y-2 pt-2">
                      <Label>Saldo de Demonstração (USDT)</Label>
                      <Input
                        type="number"
                        value={settings.testBalance}
                        onChange={(e) => setSettings({ ...settings, testBalance: Number(e.target.value) })}
                        placeholder="1000"
                        step="100"
                        min="0"
                        max="1000000"
                      />
                      <p className="text-xs text-muted-foreground">
                        Valor inicial para simulação de trades no modo teste
                      </p>
                    </div>
                  )}
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

            <Card className="p-5 bg-gradient-card border-border hover:border-primary/50 transition-all duration-300">
              <div className="space-y-2">
                <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Total de Trades</p>
                <div className="flex items-end gap-2">
                  <p className="text-3xl font-bold text-primary tracking-tight">{stats.totalTrades}</p>
                </div>
              </div>
            </Card>

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
