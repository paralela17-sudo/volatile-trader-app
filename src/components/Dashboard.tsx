import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Play, Activity, ArrowUpRight, ArrowDownRight, Save, Key, Power, LogOut, Settings, RotateCcw, TrendingUp, TrendingDown } from "lucide-react";
import { StatsCard } from "./StatsCard";
import { TradeHistory } from "./TradeHistory";
import { botConfigService } from "@/services/botService";
import { supabaseSync } from "@/services/supabaseSyncService";
import { MultiPairMonitor } from "./MultiPairMonitor";
import { LastRoundPerformance } from "./LastRoundPerformance";
import { TradeAdjustments } from "./TradeAdjustments";
import { CircuitBreakerBanner } from "./CircuitBreakerBanner";
import { CircuitBreakerReset } from "./CircuitBreakerReset";
import { toast } from "sonner";
import { localDb } from "@/services/localDbService";
import { pairSelectionService } from "@/services/pairSelectionService";
import { statsService, type AccountStats } from "@/services/statsService";
import { tradingService } from "@/services/tradingService";
import { operationsStatsService, type OperationStats } from "@/services/operationsStatsService";
import { resetService } from "@/services/resetService";
import { z } from "zod";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import evolonLogo from "@/assets/evolon-bot-logo.jpg";
import { DEFAULT_USER_ID, RISK_SETTINGS } from "@/constants";
import { computeDailyProfitPercent } from "@/services/riskService";
import { supabase } from "@/integrations/supabase/client";
import { AdminPanel } from "./AdminPanel";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

const userId = DEFAULT_USER_ID;

// Validation schema - chaves API são opcionais (podem estar salvas)
const botConfigSchema = z.object({
  apiKey: z.string().optional().default(""),
  apiSecret: z.string().optional().default(""),
  testMode: z.boolean(),
  quantity: z.number().min(0.001, "Quantidade mínima é 0.001").max(100000, "Quantidade muito alta"),
  takeProfit: z.number().min(0.1, "Take Profit mínimo é 0.1%").max(100, "Take Profit máximo é 100%"),
  stopLoss: z.number().min(0.1, "Stop Loss mínimo é 0.1%").max(100, "Stop Loss máximo é 100%"),
  dailyProfitGoal: z.number().min(1, "Meta diária mínima é 1").max(10000, "Meta muito alta"),
  testBalance: z.number().min(0, "Saldo não pode ser negativo").max(1000000, "Saldo muito alto"),
});

export const Dashboard = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false); // Start as not loading to avoid stuck states
  const [configId, setConfigId] = useState<string | null>(null);
  const [botRunning, setBotRunning] = useState(false);
  const [tradingMode, setTradingMode] = useState<"test" | "real">("test");
  const [botPoweredOff, setBotPoweredOff] = useState(false);
  const [apiKeysConfigured, setApiKeysConfigured] = useState(false);
  const [dailyProfitPercent, setDailyProfitPercent] = useState(0);
  const [pausedUntilMidnight, setPausedUntilMidnight] = useState(false);
  const [showResetDialog, setShowResetDialog] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [accountStats, setAccountStats] = useState<AccountStats>({
    initialCapital: 0,
    successRate: 0,
    totalTrades: 0,
    activePositions: 0,
    totalProfit: 0,
    profitHistory: [],
    dailyProfit: 0,
    dailyProfitPercent: 0,
    currentBalance: 0,
    winRate24h: 0,
    monthlyProfit: 0,
    activeTrades: [],
  });
  const [operationStats, setOperationStats] = useState<OperationStats>({
    lastOperationTime: null,
    totalOperationsToday: 0,
    lastOperationProfit: null,
    lastOperationSide: null,
    lastOperationSymbol: null,
    lossStreak: 0,
    dailyPnL: 0,
    circuitBreakerActive: false,
    circuitBreakerUntil: null,
  });
  const [settings, setSettings] = useState({
    apiKey: "",
    apiSecret: "",
    testMode: true,
    pairWith: "USDT",
    quantity: 100,
    timeDifference: 5,
    changeInPrice: 3,
    stopLoss: RISK_SETTINGS.STOP_LOSS_PERCENT,
    takeProfit: RISK_SETTINGS.TAKE_PROFIT_PERCENT,
    testBalance: 1000,
    dailyProfitGoal: 50,
  });

  // Estatísticas dinâmicas (Removido objeto stats hardcoded legado)


  // Load configuration from database
  useEffect(() => {
    const initSync = async () => {
      await supabaseSync.initialize();
      console.log("☁️ Supabase Sync initialized in Browser");
      loadBotConfiguration();
      loadAccountStats();
    };
    initSync();

    // Auto-refresh stats every 30 seconds
    const statsInterval = setInterval(() => {
      loadAccountStats();
    }, 30000);

    return () => clearInterval(statsInterval);
  }, []);

  const loadAccountStats = async () => {
    try {
      // Bypassing Supabase for local mode
      const stats = await statsService.getAccountStats(
        userId,
        settings.testMode,
        settings.testBalance
      );
      setAccountStats(stats);

      // Buscar estatísticas de operações
      const opStats = await operationsStatsService.getTodayOperationsStats(userId);
      setOperationStats(opStats);

      // Atualiza o Profit Diário
      const today = new Date().toLocaleDateString('pt-BR');
      const todayProfit = stats.profitHistory.find((p) => p.date === today)?.profit || 0;
      setDailyProfitPercent(computeDailyProfitPercent(stats.initialCapital, todayProfit));
    } catch (error) {
      console.error("Error loading account stats:", error);
    }
  };

  const loadBotConfiguration = async () => {
    try {
      setLoading(true);
      const config = await botConfigService.getConfig(userId);

      if (config) {
        setSettings({
          apiKey: "", // Nunca mostramos a chave real por segurança
          apiSecret: "",
          testMode: config.test_mode,
          pairWith: "USDT",
          quantity: Number(config.quantity) || 100,
          timeDifference: 5,
          changeInPrice: 3,
          stopLoss: config.stop_loss_percent || RISK_SETTINGS.STOP_LOSS_PERCENT,
          takeProfit: config.take_profit_percent || RISK_SETTINGS.TAKE_PROFIT_PERCENT,
          testBalance: config.test_balance || 1000,
          dailyProfitGoal: config.daily_profit_goal || 50,
        });

        setTradingMode(config.test_mode ? "test" : "real");
        setBotRunning(config.is_running);
        setBotPoweredOff(!config.is_powered_on);
        setConfigId(config.id);

        if (config.api_key_encrypted && config.api_secret_encrypted) {
          setApiKeysConfigured(true);
        }
      }
      console.log("Configuração carregada via serviço centralizado");
    } catch (error: any) {
      console.error("Error loading configuration:", error);
    } finally {
      setLoading(false);
    }
  };

  // [FIXED] Limpar a KEY CORRETA do LocalStorage ('BOT_DATA' é a chave real)
  useEffect(() => {
    // Não limpar mais o LocalStorage para preservar chaves API e configurações
    // O código anterior apagava os dados ao carregar, causando perda das chaves
  }, []);

  // [NEW] Auto-sync com DELAY para evitar crash
  useEffect(() => {
    let mounted = true;
    const timer = setTimeout(async () => {
      if (!mounted) return;

      try {
        console.log('🔄 [Auto-Sync] Aguardando 2s antes de sincronizar...');
        const { supabaseSync } = await Promise.race([
          import("@/services/supabaseSyncService"),
          new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error('Import timeout')), 3000)
          )
        ]);

        if (!mounted) return;

        await Promise.race([
          supabaseSync.initClientSync(),
          new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error('Sync timeout')), 8000)
          )
        ]);

        console.log('✅ [Auto-Sync] Sincronização automática OK');
      } catch (err) {
        console.warn('⚠️ [Auto-Sync] Falhou mas não quebrou:', err);
      }
    }, 2000); // Espera 2 segundos antes de tentar

    return () => {
      mounted = false;
      clearTimeout(timer);
    };
  }, []);

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
      setLoading(true);
      console.log("[Dashboard] Iniciando salvamento de configurações...");

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

      const optimalPair = await pairSelectionService.selectOptimalPair();

      // USAR O SERVIÇO CENTRALIZADO (Isso garante sincronização com Supabase e VPS)
      const success = await botConfigService.updateConfig(userId, {
        test_mode: settings.testMode,
        test_balance: settings.testBalance,
        trading_pair: optimalPair,
        quantity: settings.quantity,
        take_profit_percent: settings.takeProfit,
        stop_loss_percent: settings.stopLoss,
        daily_profit_goal: settings.dailyProfitGoal,
        is_powered_on: !botPoweredOff,
      });

      if (success) {
        // Salvar credenciais - permite salvar individualmente
        if (settings.apiKey || settings.apiSecret) {
          console.log("[Dashboard] Salvando novas credenciais API...");
          await botConfigService.saveApiCredentials(userId, settings.apiKey, settings.apiSecret);
        }

        // Limpar campos de senha após salvar
        setSettings({ ...settings, apiKey: "", apiSecret: "" });
        toast.success("Configurações salvas e sincronizadas com sucesso!");

        // Recarregar dados - incluindo configuração para atualizar status das chaves
        loadBotConfiguration();
        loadAccountStats();
      } else {
        toast.error("Erro ao salvar configurações no serviço");
      }
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        const firstError = error.issues[0];
        toast.error(firstError.message);
      } else {
        console.error("[Dashboard] Erro fatal no salvamento:", error);
        toast.error(`Erro ao salvar: ${error.message || "Erro desconhecido"}`);
      }
    } finally {
      setLoading(false);
    }
  };

  const startAutomatedTrading = async () => {
    try {
      const { data: config } = await supabase
        .from("bot_configurations")
        .select("*")
        .eq("user_id", userId)
        .single();

      if (!config) {
        toast.error("Configuração não encontrada. Configure o bot primeiro.");
        return;
      }

      // Selecionar múltiplos pares para trading
      const { pairSelectionService } = await import("@/services/pairSelectionService");
      const symbols = await pairSelectionService.selectMultipleOptimalPairs(5);

      await tradingService.start({
        userId: userId,
        configId: config.id,
        symbols: symbols,
        totalCapital: config.test_mode ? Number(config.test_balance) : accountStats.initialCapital,
        takeProfitPercent: Number(config.take_profit_percent),
        stopLossPercent: Number(config.stop_loss_percent),
        testMode: config.test_mode,
        maxPositions: 5,
      });

      toast.success("Trading iniciado (Local Mode)");
    } catch (error) {
      console.error("Error starting trading:", error);
      toast.error("Erro ao iniciar trading automático");
    }
  };

  const stopAutomatedTrading = async () => {
    await tradingService.stop();
  };

  const handleLogout = async () => {
    toast.info("Autenticação está desativada para este robô.");
  };

  const handleResetBot = async () => {
    if (!configId) {
      toast.error("Configuração não encontrada");
      return;
    }

    setResetting(true);

    try {
      const userId = DEFAULT_USER_ID; // Autenticação removida permanentemente

      // Parar bot se estiver rodando
      if (botRunning) {
        await stopAutomatedTrading();
        setBotRunning(false);
      }

      // Resetar bot no banco de dados
      const success = await resetService.resetBot({
        userId: userId,
        resetTrades: true,
        resetBalance: true,
        newBalance: 1000
      });

      if (success) {
        // Resetar estados locais imediatamente
        setAccountStats({
          initialCapital: 1000,
          successRate: 0,
          totalTrades: 0,
          activePositions: 0,
          totalProfit: 0,
          profitHistory: [],
          dailyProfit: 0,
          dailyProfitPercent: 0,
          currentBalance: 1000,
          winRate24h: 0,
          monthlyProfit: 0,
        });

        setOperationStats({
          lastOperationTime: null,
          totalOperationsToday: 0,
          lastOperationProfit: null,
          lastOperationSide: null,
          lastOperationSymbol: null,
          lossStreak: 0,
          dailyPnL: 0,
          circuitBreakerActive: false,
          circuitBreakerUntil: null,
        });

        setDailyProfitPercent(0);

        // Atualizar settings com novo balance
        setSettings(prev => ({
          ...prev,
          testBalance: 1000
        }));

        toast.success("🔄 Bot resetado! Capital inicial: $1,000.00");

        // Recarregar dados do banco com delay para garantir propagação
        setTimeout(async () => {
          await loadAccountStats();
          await loadBotConfiguration();
        }, 500);

        setShowResetDialog(false);
      } else {
        toast.error("Erro ao resetar bot");
      }
    } catch (error) {
      console.error("Erro no reset:", error);
      toast.error("Erro ao resetar bot");
    } finally {
      setResetting(false);
    }
  };

  const handleForceSync = async () => {
    try {
      setLoading(true);
      console.log("🔄 [Manual Sync] Iniciando sincronização completa...");

      // 1. Sincronizar com Cloud (se disponível)
      const cloud = await supabaseSync.getCloudConfig();
      if (cloud) {
        localDb.saveConfig(cloud);
        await loadBotConfiguration();
        console.log("✅ Configuração Cloud sincronizada");
      }

      // 2. Tentar reconciliação forçada no TradingService (se o bot estiver rodando)
      if (botRunning) {
        await tradingService.reconcile();
      }

      // 3. Atualizar estatísticas locais
      await loadAccountStats();

      toast.success("✅ Dashboard 100% Sincronizado!");
    } catch (error) {
      console.error("Erro na sincronização:", error);
      toast.error("Falha ao sincronizar dados.");
    } finally {
      setLoading(false);
    }
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
                className={`text-sm px-4 py-2 ${botPoweredOff
                  ? "bg-destructive/20 text-destructive border-destructive/50"
                  : (tradingMode === "test" ? "bg-amber-500/10 text-amber-600 border-amber-500/20" : "bg-primary/10 text-primary border-primary/20")
                  }`}
              >
                <Activity className="w-4 h-4 mr-2" />
                {botPoweredOff ? "🔴 DESLIGADO" : (botRunning ? (tradingMode === "test" ? "⚡ Simulação Ativa" : "Ativo") : "Pausado")}
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
                variant="outline"
                onClick={handleForceSync}
                className="gap-2 border-primary/30 hover:border-primary"
                title="Sincronizar configurações e estatísticas"
              >
                <RotateCcw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
                Sincronizar
              </Button>

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

          {/* Circuit Breaker Banner */}
          <CircuitBreakerBanner />

          {/* Test Mode Persistent Banner */}
          {tradingMode === "test" && (
            <div className="w-full bg-amber-500/10 border border-amber-500/20 rounded-lg p-3 flex items-center justify-between animate-pulse">
              <div className="flex items-center gap-3 text-amber-600 font-semibold">
                <span className="text-xl">⚠️</span>
                <span>MODO TESTE ATIVO - Paper Trading com Dados Reais da Binance</span>
              </div>
              <Badge variant="outline" className="border-amber-500/50 text-amber-600 bg-amber-500/5">
                Sem Risco Financeiro
              </Badge>
            </div>
          )}

          {/* Paper Trading Info (quando bot está desligado em modo teste) */}
          {tradingMode === "test" && !botRunning && (
            <div className="w-full bg-blue-500/10 border border-blue-500/20 rounded-lg p-4 space-y-2">
              <div className="flex items-center gap-2 text-blue-600 font-semibold">
                <span className="text-xl">📊</span>
                <span>Paper Trading Configurado - Pronto Para Começar!</span>
              </div>
              <p className="text-sm text-blue-600/80 ml-7">
                O bot está configurado para analisar <strong>dados REAIS</strong> da Binance e executar <strong>trades SIMULADAS</strong>.
                Quando você clicar em "LIGAR BOT", ele começará a monitorar o mercado e mostrar lucros/perdas realistas sem gastar dinheiro real.
                <strong> Perfeito para testar estratégias antes de operar com dinheiro de verdade!</strong>
              </p>
            </div>
          )}

          {tradingMode === "real" && (
            <div className="w-full bg-emerald-500/10 border border-emerald-500/20 rounded-lg p-3 flex items-center justify-between">
              <div className="flex items-center gap-3 text-emerald-600 font-semibold">
                <span className="text-xl">🛡️</span>
                <span>MODO REAL ATIVO - Operações Reais na Binance</span>
              </div>
              <Badge variant="outline" className="border-emerald-500/50 text-emerald-600 bg-emerald-500/5">
                Risco Real Ativado
              </Badge>
            </div>
          )}

          {/* Circuit Breaker Reset (Test Mode Only) */}
          <CircuitBreakerReset
            onReset={() => {
              loadAccountStats();
            }}
          />

          {/* Top Metrics Row */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {/* Saldo Inicial */}
            <Card className={`p-5 bg-gradient-card border-border hover:border-primary/50 transition-all duration-300 ${tradingMode === "test" ? "border-amber-500/30" : ""}`}>
              <div className="space-y-2">
                <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">
                  {tradingMode === "test" ? "Saldo Virtual Inicial" : "Saldo Inicial"}
                </p>
                <div className="flex items-end gap-2">
                  <p className={`text-3xl font-bold tracking-tight ${tradingMode === "test" ? "text-amber-600" : "text-primary"}`}>
                    ${(Number(accountStats.initialCapital) || 0).toFixed(2)}
                  </p>
                </div>
                <p className="text-xs text-muted-foreground">Configurado para o dia</p>
              </div>
            </Card>

            {/* Lucro Total do Dia */}
            <Card className="p-5 bg-gradient-card border-border hover:border-primary/50 transition-all duration-300">
              <div className="space-y-2">
                <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Lucro Total do Dia</p>
                <div className="flex items-end gap-2">
                  <p className={`text-3xl font-bold tracking-tight ${accountStats.dailyProfit >= 0 ? 'text-success' : 'text-destructive'
                    }`}>
                    ${(Number(accountStats.dailyProfit) || 0).toFixed(2)}
                  </p>
                </div>
                <p className={`text-xs ${accountStats.dailyProfitPercent >= 0 ? 'text-success' : 'text-destructive'
                  }`}>
                  {accountStats.dailyProfitPercent >= 0 ? '+' : ''}{(Number(accountStats.dailyProfitPercent) || 0).toFixed(2)}% hoje
                </p>
              </div>
            </Card>

            {/* Saldo Atual */}
            <Card className="p-5 bg-gradient-card border-border hover:border-primary/50 transition-all duration-300">
              <div className="space-y-2">
                <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Saldo Atual</p>
                <div className="flex items-end gap-2">
                  <p className="text-3xl font-bold text-primary tracking-tight">
                    ${(Number(accountStats.currentBalance) || 0).toFixed(2)}
                  </p>
                </div>
                <p className="text-xs text-muted-foreground">Saldo atualizado</p>
              </div>
            </Card>

            {/* Alocação Real e Monitoramento */}
            <Card className="p-5 bg-gradient-card border-border hover:border-primary/50 transition-all duration-300">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Alocação Real (Em Trade)</p>
                  <Badge variant="outline" className={`${accountStats.activePositions > 0 ? 'border-primary text-primary animate-pulse' : 'opacity-50'}`}>
                    {accountStats.activePositions} Ativo(s)
                  </Badge>
                </div>
                <div className="flex items-end gap-2">
                  <p className="text-3xl font-bold text-primary tracking-tight">
                    ${(accountStats.activeTrades.reduce((sum, t) => sum + (Number(t.price) * Number(t.quantity)), 0)).toFixed(2)}
                  </p>
                </div>
                <p className="text-xs text-muted-foreground">Capital em mercado agora</p>
              </div>
            </Card>

            {/* Taxa de Vitória */}
            <Card className="p-5 bg-gradient-card border-border hover:border-primary/50 transition-all duration-300">
              <div className="space-y-2">
                <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Taxa de Vitória</p>
                <div className="flex items-end gap-2">
                  <p className="text-3xl font-bold text-primary tracking-tight">
                    {(Number(accountStats.winRate24h) || 0).toFixed(1)}%
                  </p>
                </div>
                <p className="text-xs text-muted-foreground">Últimas 24h</p>
              </div>
            </Card>

            {/* Lucro Acumulado no Mês */}
            <Card className="p-5 bg-gradient-card border-border hover:border-primary/50 transition-all duration-300">
              <div className="space-y-2">
                <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Lucro Acumulado no Mês</p>
                <div className="flex items-end gap-2">
                  <p className={`text-3xl font-bold tracking-tight ${accountStats.monthlyProfit >= 0 ? 'text-success' : 'text-destructive'
                    }`}>
                    ${(Number(accountStats.monthlyProfit) || 0).toFixed(2)}
                  </p>
                </div>
                <p className="text-xs text-muted-foreground">Lucro mensal</p>
              </div>
            </Card>
          </div>

          {/* [RE-ENABLED] Seção de Operações em Andamento - COM PROTEÇÃO MÁXIMA */}
          {(() => {
            try {
              const trades = accountStats?.activeTrades;
              if (!trades || !Array.isArray(trades) || trades.length === 0) return null;

              return (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xl font-bold flex items-center gap-2">
                      <Activity className="w-5 h-5 text-primary" />
                      Operações em Andamento
                    </h3>
                    <Badge variant="outline" className="animate-pulse border-primary/50 text-primary">
                      {trades.length} Ativo(s)
                    </Badge>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {trades.map((trade) => {
                      try {
                        if (!trade?.id) return null;
                        const symbol = trade.symbol || 'N/A';
                        const price = trade.price ? Number(trade.price) : 0;
                        const quantity = trade.quantity || 0;
                        const profitLoss = trade.profit_loss !== undefined && trade.profit_loss !== null ? Number(trade.profit_loss) : null;
                        const createdAt = trade.created_at ? new Date(trade.created_at).toLocaleTimeString() : '--:--';
                        const type = trade.type || 'MARKET';
                        const side = trade.side || 'BUY';
                        const isBuy = side === 'BUY';

                        return (
                          <Card key={trade.id} className="p-4 bg-gradient-card border-primary/20 hover:border-primary/50 transition-all">
                            <div className="space-y-3">
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                  <Badge className={isBuy ? 'bg-primary text-primary-foreground' : 'bg-success text-success-foreground'}>
                                    {isBuy ? 'COMPRA' : 'VENDA'}
                                  </Badge>
                                  <span className="font-bold text-lg">{symbol}</span>
                                </div>
                                <span className="text-xs text-muted-foreground">{createdAt}</span>
                              </div>

                              <div className="grid grid-cols-2 gap-2 text-sm">
                                <div className="space-y-1">
                                  <p className="text-xs text-muted-foreground uppercase">Preço Entrada</p>
                                  <p className="font-mono font-bold">
                                    ${price.toFixed(symbol.includes('USDT') ? 4 : 2)}
                                  </p>
                                </div>
                                <div className="space-y-1 text-right">
                                  <p className="text-xs text-muted-foreground uppercase">PnL Atual</p>
                                  <div className={`flex items-center justify-end gap-1 font-bold ${(profitLoss || 0) >= 0 ? 'text-success' : 'text-destructive'
                                    }`}>
                                    {(profitLoss || 0) >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                                    {profitLoss !== null ? `${profitLoss >= 0 ? '+' : ''}${profitLoss.toFixed(2)}%` : 'Calculando...'}
                                  </div>
                                </div>
                              </div>

                              <div className="pt-2 border-t border-border/50 flex items-center justify-between text-xs">
                                <span className="text-muted-foreground">Qtd: {quantity}</span>
                                <Badge variant="outline" className="text-[10px] opacity-70">{type}</Badge>
                              </div>
                            </div>
                          </Card>
                        );
                      } catch (tradeErr) {
                        console.warn('⚠️ Erro ao renderizar trade:', tradeErr);
                        return null;
                      }
                    })}
                  </div>
                </div>
              );
            } catch (sectionErr) {
              console.warn('⚠️ Erro na seção de trades ativos:', sectionErr);
              return null;
            }
          })()}

          {/* Profit Section */}
          <Card className="p-6 bg-gradient-card border-border">
            <div className="space-y-5">
              <div className="flex items-start justify-between">
                <div className="space-y-2">
                  <p className="text-sm text-muted-foreground font-medium uppercase tracking-wide">Profit</p>
                  <div className="flex items-end gap-3">
                    <p className="text-3xl font-bold text-primary tracking-tight">
                      ${(Number(accountStats.totalProfit) || 0).toFixed(2)}
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

          {/* Performance da Última Rodada */}
          <LastRoundPerformance />

          {/* Ajustes de Configuração */}
          <TradeAdjustments />

          {/* Multi-Pair Monitor */}
          {botRunning && !botPoweredOff && (
            <MultiPairMonitor
              isActive={botRunning}
              totalCapital={settings.testMode ? settings.testBalance : accountStats.initialCapital}
              userId={configId || ""}
              testMode={settings.testMode}
              quantityPerTrade={settings.quantity}
            />
          )}

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
                      placeholder={apiKeysConfigured ? "●●●●●●●●●●●●●●●●" : "Digite para atualizar a API Key"}
                      value={settings.apiKey}
                      onChange={(e) => setSettings({ ...settings, apiKey: e.target.value })}
                      className="font-mono"
                    />
                    <p className="text-xs text-muted-foreground">
                      {apiKeysConfigured ? "✅ Chave configurada no banco de dados" : "⚠️ Necessário para operar"}
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
                  <div className="p-4 rounded-lg bg-primary/10 border border-primary/20">
                    <div className="flex items-center gap-2 mb-3">
                      <span className="font-semibold text-primary">📊 Estratégia: Mean Reversion</span>
                    </div>
                    <div className="space-y-2 text-xs text-muted-foreground">
                      <p><strong>Indicadores:</strong> Bollinger Bands (20, 2.0) + RSI (14)</p>
                      <p><strong>Entrada:</strong> Preço ≤ Lower Band + RSI &lt; 35 (oversold)</p>
                      <p><strong>Saída:</strong> Preço ≥ Upper Band + RSI &gt; 70 (overbought)</p>
                      <p><strong>Proteção:</strong> Stop Loss {RISK_SETTINGS.STOP_LOSS_PERCENT}% | Take Profit {RISK_SETTINGS.TAKE_PROFIT_PERCENT}%</p>
                    </div>
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
                    <p className="text-xs text-muted-foreground">
                      Capital por rodada, distribuído entre múltiplos pares
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

                      <Dialog open={showResetDialog} onOpenChange={setShowResetDialog}>
                        <DialogTrigger asChild>
                          <Button
                            variant="outline"
                            className="gap-2 border-yellow-500/50 hover:bg-yellow-500/10 w-full mt-3"
                          >
                            🔄 Resetar Bot
                          </Button>
                        </DialogTrigger>
                        <DialogContent>
                          <DialogHeader>
                            <DialogTitle>⚠️ Resetar Bot</DialogTitle>
                            <DialogDescription>
                              Esta ação irá:
                            </DialogDescription>
                          </DialogHeader>
                          <div className="space-y-3 py-4">
                            <div className="flex items-center gap-2 text-sm">
                              <span className="text-red-500">•</span>
                              <span>Deletar TODAS as operações (trades)</span>
                            </div>
                            <div className="flex items-center gap-2 text-sm">
                              <span className="text-red-500">•</span>
                              <span>Fechar todas as posições abertas</span>
                            </div>
                            <div className="flex items-center gap-2 text-sm">
                              <span className="text-green-500">•</span>
                              <span>Restaurar capital inicial para $1,000.00</span>
                            </div>
                            <div className="flex items-center gap-2 text-sm">
                              <span className="text-blue-500">•</span>
                              <span>Preparar para nova estratégia Momentum Trading</span>
                            </div>
                          </div>
                          <div className="p-4 rounded-lg bg-yellow-500/10 border border-yellow-500/30">
                            <p className="text-sm font-semibold text-yellow-700 dark:text-yellow-400">
                              ⚠️ Esta ação é irreversível!
                            </p>
                            <p className="text-xs text-muted-foreground mt-1">
                              Todo o histórico de operações será perdido.
                            </p>
                          </div>
                          <div className="flex gap-3 justify-end">
                            <Button
                              variant="outline"
                              onClick={() => setShowResetDialog(false)}
                              disabled={resetting}
                            >
                              Cancelar
                            </Button>
                            <Button
                              variant="destructive"
                              onClick={handleResetBot}
                              disabled={resetting}
                              className="gap-2"
                            >
                              {resetting ? "Resetando..." : "Confirmar Reset"}
                            </Button>
                          </div>
                        </DialogContent>
                      </Dialog>
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
          <div className="grid grid-cols-1 gap-6">
            <Card className="p-6 bg-gradient-card border-border">
              <TradeHistory />
            </Card>
          </div>
        </div>
      </main>
    </div>
  );
};
