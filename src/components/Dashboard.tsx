import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Play, Pause, Settings, TrendingUp, TrendingDown, Activity } from "lucide-react";
import { StatsCard } from "./StatsCard";
import { CoinMonitor } from "./CoinMonitor";
import { TradeHistory } from "./TradeHistory";
import { BotSettings } from "./BotSettings";

export const Dashboard = () => {
  const [botRunning, setBotRunning] = useState(false);
  const [showSettings, setShowSettings] = useState(false);

  const stats = {
    totalTrades: 127,
    profitableTrades: 89,
    totalProfit: 1247.89,
    activePositions: 3,
  };

  const profitPercentage = ((stats.profitableTrades / stats.totalTrades) * 100).toFixed(1);

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-4xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
              Binance Volatility Bot
            </h1>
            <p className="text-muted-foreground mt-2">
              Monitora e negocia automaticamente as moedas mais voláteis
            </p>
          </div>
          <div className="flex items-center gap-4">
            <Badge variant={botRunning ? "default" : "secondary"} className="text-sm px-4 py-2">
              <Activity className="w-4 h-4 mr-2" />
              {botRunning ? "Ativo" : "Pausado"}
            </Badge>
            <Button
              variant="outline"
              size="icon"
              onClick={() => setShowSettings(!showSettings)}
            >
              <Settings className="w-5 h-5" />
            </Button>
            <Button
              variant={botRunning ? "destructive" : "default"}
              onClick={() => setBotRunning(!botRunning)}
              className="gap-2"
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
          <Card className="p-6 bg-gradient-card border-border">
            <BotSettings />
          </Card>
        )}

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
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
            title="Lucro Total"
            value={`$${stats.totalProfit.toFixed(2)}`}
            icon={<TrendingUp className="w-5 h-5 text-success" />}
            trend="up"
          />
          <StatsCard
            title="Posições Ativas"
            value={stats.activePositions.toString()}
            icon={<TrendingDown className="w-5 h-5 text-accent" />}
          />
        </div>

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Coin Monitor */}
          <Card className="lg:col-span-2 p-6 bg-gradient-card border-border">
            <CoinMonitor isRunning={botRunning} />
          </Card>

          {/* Trade History */}
          <Card className="p-6 bg-gradient-card border-border">
            <TradeHistory />
          </Card>
        </div>
      </div>
    </div>
  );
};
