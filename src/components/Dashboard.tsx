import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Play, Activity, ArrowUpRight, ArrowDownRight, Save, Key, Power, LogOut, Settings } from "lucide-react";
import { StatsCard } from "./StatsCard";
import { CoinMonitor } from "./CoinMonitor";
import { TradeHistory } from "./TradeHistory";
import { AdminPanel } from "./AdminPanel";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { pairSelectionService } from "@/services/pairSelectionService";
import { statsService, type AccountStats } from "@/services/statsService";
import { tradingService } from "@/services/tradingService";
import { z } from "zod";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import evolonLogo from "@/assets/evolon-bot-logo.jpg";
import { RISK_SETTINGS, computeDailyProfitPercent } from "@/services/riskService";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

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
  const [accountStats, setAccountStats] = useState<AccountStats>({
    initialCapital: 0,
    successRate: 0,
    totalTrades: 0,
    activePositions: 0,
    totalProfit: 0,
    profitHistory: []
  });
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
    loadAccountStats();
    
    // Auto-refresh stats every 30 seconds
    const statsInterval = setInterval(() => {
      loadAccountStats();
    }, 30000);
    
    return () => clearInterval(statsInterval);
  }, []);

  const loadAccountStats = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: config } = await supabase
        .from("bot_configurations")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();

      if (!config) return;

      const stats = await statsService.getAccountStats(
        user.id,
        config.test_mode,
        config.test_balance
      );
      setAccountStats(stats);

      // Atualiza o Profit Diário com base no capital inicial do dia
      const today = new Date().toLocaleDateString('pt-BR');
      const todayProfit = stats.profitHistory.find((p) => p.date === today)?.profit || 0;
      setDailyProfitPercent(computeDailyProfitPercent(stats.initialCapital, todayProfit));
    } catch (error) {
      console.error("Error loading account stats:", error);
    }
  };

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

      const optimalPair = await pairSelectionService.selectOptimalPair();

      const configData = {
        user_id: user.id,
        test_mode: settings.testMode,
        test_balance: settings.testBalance,
        trading_pair: optimalPair,
        quantity: settings.quantity,
        take_profit_percent: RISK_SETTINGS.TAKE_PROFIT_PERCENT,
        stop_loss_percent: RISK_SETTINGS.STOP_LOSS_PERCENT,
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
      
      // Reload account stats after saving
      loadAccountStats();
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

  const startAutomatedTrading = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: config } = await supabase
        .from("bot_configurations")
        .select("*")
        .eq("user_id", user.id)
        .single();

      if (!config) {
        toast.error("Configuração não encontrada. Configure o bot primeiro.");
        return;
      }

      await tradingService.start({
        userId: user.id,
        configId: config.id,
        symbol: config.trading_pair,
        quantity: Number(config.quantity),
        takeProfitPercent: Number(config.take_profit_percent),
        stopLossPercent: Number(config.stop_loss_percent),
        testMode: config.test_mode,
      });
    } catch (error) {
      console.error("Error starting trading:", error);
      toast.error("Erro ao iniciar trading automático");
    }
  };

  const stopAutomatedTrading = async () => {
    await tradingService.stop();
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
              <Dialog>
                <DialogTrigger asChild>
                  <Button
                    variant="outline"
                    className="gap-2"
                  >
                    <Settings className="w-5 h-5" />
                    Admin
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle>Painel Administrativo</DialogTitle>
                    <DialogDescription>
                      Configure a integração do bot com a Binance
                    </DialogDescription>
                  </DialogHeader>
                  <AdminPanel />
                </DialogContent>
              </Dialog>
              <Button
                variant="ghost"
                onClick={handleLogout}
                className="gap-2"
              >
                <LogOut className="w-5 h-5" />
                Sair
              </Button>
              <Button
                variant={botRunning ? "destructive" : "default"}
                onClick={async () => {
                  if (botRunning) {
                    // Desligar bot
                    await stopAutomatedTrading();
                    setBotRunning(false);
                    setBotPoweredOff(true);
                    saveBotState(false, true);
                    toast.error("Bot desligado!");
                  } else {
                    // Ligar bot
                    if (pausedUntilMidnight) {
                      toast.warning("Bot pausado até meia-noite por atingir meta diária.");
                      return;
                    }
                    setBotPoweredOff(false);
                    setBotRunning(true);
                    setPausedUntilMidnight(false);
                    setDailyProfitPercent(0);
                    saveBotState(true, false);
                    await startAutomatedTrading();
                    toast.success("Bot ligado e trading automático iniciado!");
                  }
                }}
                className="gap-2 shadow-glow-primary"
                disabled={pausedUntilMidnight && !botRunning}
              >
                {botRunning ? (
                  <>
                    <Power className="w-5 h-5" />
                    Desligar Bot
                  </>
                ) : (
                  <>
                    <Play className="w-5 h-5" />
                    Ligar Bot
                  </>
                )}
              </Button>
            </div>
          </div>

          {/* Top Metrics Row */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <Card className="p-5 bg-gradient-card border-border hover:border-primary/50 transition-all duration-300">
              <div className="space-y-2">
                <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Capital Inicial</p>
                <div className="flex items-end gap-2">
                  <p className="text-3xl font-bold text-primary tracking-tight">
                    ${accountStats.initialCapital.toFixed(2)}
                  </p>
                </div>
              </div>
            </Card>

            <Card className="p-5 bg-gradient-card border-border hover:border-primary/50 transition-all duration-300">
              <div className="space-y-2">
                <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Taxa de Sucesso</p>
                <div className="flex items-end gap-2">
                  <p className="text-3xl font-bold text-primary tracking-tight">
                    {accountStats.successRate.toFixed(1)}%
                  </p>
                </div>
              </div>
            </Card>

            <Card className="p-5 bg-gradient-card border-border hover:border-primary/50 transition-all duration-300">
              <div className="space-y-2">
                <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Total de Trades</p>
                <div className="flex items-end gap-2">
                  <p className="text-3xl font-bold text-primary tracking-tight">
                    {accountStats.totalTrades}
                  </p>
                </div>
              </div>
            </Card>

            <Card className="p-5 bg-gradient-card border-border hover:border-primary/50 transition-all duration-300">
              <div className="space-y-2">
                <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Posições Ativas</p>
                <div className="flex items-end gap-2">
                  <p className="text-3xl font-bold text-primary tracking-tight">
                    {accountStats.activePositions}
                  </p>
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
                      ${accountStats.totalProfit.toFixed(2)}
                    </p>
                    {accountStats.totalProfit > 0 && <ArrowUpRight className="w-5 h-5 text-success mb-1" />}
                    {accountStats.totalProfit < 0 && <ArrowDownRight className="w-5 h-5 text-destructive mb-1" />}
                  </div>
                  <div className={`flex items-center gap-1 text-sm ${accountStats.totalProfit >= 0 ? 'text-success' : 'text-destructive'}`}>
                    {accountStats.totalProfit >= 0 ? <ArrowUpRight className="w-4 h-4" /> : <ArrowDownRight className="w-4 h-4" />}
                    <span>Total Profit</span>
                  </div>
                </div>
              </div>
              
              <div className="h-64 rounded-lg border border-border bg-card p-4">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={accountStats.profitHistory.length > 0 ? accountStats.profitHistory : [
                    { date: "Day 1", profit: 0 },
                    { date: "Day 2", profit: 0 },
                    { date: "Day 3", profit: 0 },
                    { date: "Day 4", profit: 0 },
                    { date: "Day 5", profit: 0 }
                  ]}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} />
                    <XAxis 
                      dataKey="date" 
                      tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }}
                      tickLine={false}
                    />
                    <YAxis 
                      tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }}
                      tickLine={false}
                      axisLine={false}
                    />
                    <Tooltip 
                      contentStyle={{
                        backgroundColor: "hsl(var(--background))",
                        border: "1px solid hsl(var(--border))",
                        borderRadius: "6px"
                      }}
                      formatter={(value: number) => [`$${value.toFixed(2)}`, "Profit"]}
                    />
                    <Line 
                      type="monotone" 
                      dataKey="profit" 
                      stroke="hsl(var(--primary))" 
                      strokeWidth={2}
                      dot={{ fill: "hsl(var(--primary))", r: 4 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          </Card>

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
