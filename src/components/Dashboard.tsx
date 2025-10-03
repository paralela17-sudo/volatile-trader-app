import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Play, Pause, Settings, TrendingUp, TrendingDown, Activity, ArrowUpRight, ArrowDownRight } from "lucide-react";
import { StatsCard } from "./StatsCard";
import { CoinMonitor } from "./CoinMonitor";
import { TradeHistory } from "./TradeHistory";
import { BotSettings } from "./BotSettings";

export const Dashboard = () => {
  const [botRunning, setBotRunning] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [tradingMode, setTradingMode] = useState<"test" | "real">("test");

  const stats = {
    totalTrades: 127,
    profitableTrades: 89,
    totalProfit: 48700,
    initialCapital: 10000.00,
    activePositions: 3,
    conversionRate: 82.42,
  };

  const profitPercentage = ((stats.profitableTrades / stats.totalTrades) * 100).toFixed(1);

  return (
    <div className="min-h-screen bg-background">
      <main className="w-full p-8">
        <div className="max-w-7xl mx-auto space-y-8">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2 bg-secondary/50 border border-border rounded-lg p-1">
                <Button
                  variant={tradingMode === "test" ? "default" : "ghost"}
                  size="sm"
                  onClick={() => setTradingMode("test")}
                  className="gap-2"
                >
                  Modo Teste
                </Button>
                <Button
                  variant={tradingMode === "real" ? "default" : "ghost"}
                  size="sm"
                  onClick={() => setTradingMode("real")}
                  className="gap-2"
                >
                  Modo Real
                </Button>
              </div>
              <Badge 
                variant={botRunning ? "default" : "secondary"} 
                className="text-sm px-4 py-2 bg-primary/10 text-primary border-primary/20"
              >
                <Activity className="w-4 h-4 mr-2" />
                {botRunning ? "Ativo" : "Pausado"}
              </Badge>
            </div>
            <div className="flex items-center gap-3">
              <Button
                variant="outline"
                size="icon"
                onClick={() => setShowSettings(!showSettings)}
                className="border-border hover:border-primary"
              >
                <Settings className="w-5 h-5" />
              </Button>
              <Button
                variant={botRunning ? "destructive" : "default"}
                onClick={() => setBotRunning(!botRunning)}
                className="gap-2 shadow-glow-primary"
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

          {/* Settings Panel */}
          {showSettings && (
            <Card className="p-6 bg-gradient-card border-border animate-fade-in">
              <BotSettings />
            </Card>
          )}

          {/* Top Metrics Row */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            {/* Capital Inicial Card */}
            <Card className="p-6 bg-gradient-card border-border hover:border-primary/50 transition-all duration-300">
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground font-medium">Capital Inicial</p>
                <div className="flex items-end gap-3">
                  <p className="text-5xl font-bold text-primary tracking-tight">32.5k</p>
                  <ArrowUpRight className="w-6 h-6 text-success mb-2" />
                </div>
                <div className="flex items-center gap-1 text-success text-sm">
                  <ArrowUpRight className="w-4 h-4" />
                  <span>3.7%</span>
                </div>
              </div>
            </Card>

            {/* Taxa de Sucesso Card */}
            <Card className="p-6 bg-gradient-card border-border hover:border-primary/50 transition-all duration-300">
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground font-medium">Taxa de Sucesso</p>
                <div className="flex items-end gap-3">
                  <p className="text-5xl font-bold text-primary tracking-tight">{stats.conversionRate}%</p>
                  <ArrowDownRight className="w-6 h-6 text-danger mb-2" />
                </div>
                <div className="flex items-center gap-1 text-danger text-sm">
                  <ArrowDownRight className="w-4 h-4" />
                  <span>1.6%</span>
                </div>
              </div>
            </Card>

            {/* Total de Trades Card */}
            <Card className="p-6 bg-gradient-card border-border hover:border-primary/50 transition-all duration-300">
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground font-medium">Total de Trades</p>
                <div className="flex items-end gap-3">
                  <p className="text-5xl font-bold text-primary tracking-tight">{stats.totalTrades}</p>
                </div>
              </div>
            </Card>

            {/* Posições Ativas Card */}
            <Card className="p-6 bg-gradient-card border-border hover:border-primary/50 transition-all duration-300">
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground font-medium">Posições Ativas</p>
                <div className="flex items-end gap-3">
                  <p className="text-5xl font-bold text-primary tracking-tight">{stats.activePositions}</p>
                </div>
              </div>
            </Card>
          </div>

          {/* Profit Section */}
          <Card className="p-8 bg-gradient-card border-border">
            <div className="space-y-6">
              <div className="flex items-start justify-between">
                <div className="space-y-3">
                  <p className="text-lg text-muted-foreground font-medium">Profit</p>
                  <div className="flex items-end gap-4">
                    <p className="text-6xl font-bold text-primary tracking-tight">
                      ${(stats.totalProfit / 1000).toFixed(1)}k
                    </p>
                    <ArrowUpRight className="w-8 h-8 text-success mb-3" />
                  </div>
                  <div className="flex items-center gap-2 text-success text-base">
                    <ArrowUpRight className="w-5 h-5" />
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

          {/* Stats Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <StatsCard
              title="Capital Inicial"
              value={`$${stats.initialCapital.toFixed(2)}`}
              icon={<Activity className="w-5 h-5" />}
            />
            <StatsCard
              title="Total de Trades"
              value={stats.totalTrades.toString()}
              icon={<Activity className="w-5 h-5" />}
            />
            <StatsCard
              title="Taxa de Sucesso"
              value={`${profitPercentage}%`}
              icon={<TrendingUp className="w-5 h-5 text-success" />}
              trend="up"
            />
            <StatsCard
              title="Posições Ativas"
              value={stats.activePositions.toString()}
              icon={<TrendingDown className="w-5 h-5 text-primary" />}
            />
          </div>

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
