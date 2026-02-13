import { useState, useEffect } from "react";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, TrendingDown } from "lucide-react";

interface Coin {
  symbol: string;
  price: number;
  change: number;
  volume: number;
  trending: boolean;
}

interface CoinMonitorProps {
  isRunning: boolean;
}

export const CoinMonitor = ({ isRunning }: CoinMonitorProps) => {
  const [coins, setCoins] = useState<Coin[]>([
    { symbol: "BTCUSDT", price: 43250.50, change: 2.5, volume: 1250000, trending: false },
    { symbol: "ETHUSDT", price: 2280.75, change: 3.8, volume: 980000, trending: true },
    { symbol: "BNBUSDT", price: 315.20, change: 1.2, volume: 450000, trending: false },
    { symbol: "ADAUSDT", price: 0.58, change: 5.2, volume: 890000, trending: true },
    { symbol: "SOLUSDT", price: 98.45, change: -1.5, volume: 320000, trending: false },
    { symbol: "DOTUSDT", price: 7.32, change: 4.1, volume: 210000, trending: true },
  ]);

  useEffect(() => {
    // Monitoramento de moedas estático até integração real com broker service
    if (!isRunning) return;
    console.log("CoinMonitor ativo (Exibindo pares fixos configurados)");
  }, [isRunning]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Moedas Monitoradas</h2>
        <Badge variant="secondary" className="font-mono">
          {coins.length} pares ativos
        </Badge>
      </div>

      <div className="space-y-2">
        {coins.map((coin) => (
          <div
            key={coin.symbol}
            className={`p-4 rounded-lg border transition-all duration-300 ${coin.trending
                ? 'border-primary bg-primary/5 shadow-glow-success'
                : 'border-border bg-secondary/20'
              }`}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="font-bold text-lg">{coin.symbol}</div>
                {coin.trending && (
                  <Badge className="bg-primary/20 text-primary border-primary">
                    <TrendingUp className="w-3 h-3 mr-1" />
                    Volatilidade Alta
                  </Badge>
                )}
              </div>

              <div className="text-right space-y-1">
                <div className="font-mono font-bold text-lg">
                  ${coin.price.toFixed(2)}
                </div>
                <div className={`flex items-center justify-end gap-1 text-sm font-medium ${coin.change >= 0 ? 'text-success' : 'text-danger'
                  }`}>
                  {coin.change >= 0 ? (
                    <TrendingUp className="w-4 h-4" />
                  ) : (
                    <TrendingDown className="w-4 h-4" />
                  )}
                  {coin.change >= 0 ? '+' : ''}{coin.change.toFixed(2)}%
                </div>
              </div>
            </div>

            <div className="mt-3 flex items-center justify-between text-sm text-muted-foreground">
              <span>Volume 24h</span>
              <span className="font-mono">${(coin.volume / 1000).toFixed(0)}K</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
