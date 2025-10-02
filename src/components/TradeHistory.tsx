import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { TrendingUp, TrendingDown } from "lucide-react";

interface Trade {
  id: string;
  symbol: string;
  type: "buy" | "sell";
  price: number;
  profit?: number;
  time: string;
}

export const TradeHistory = () => {
  const trades: Trade[] = [
    { id: "1", symbol: "ETHUSDT", type: "sell", price: 2280.75, profit: 6.2, time: "2 min atrás" },
    { id: "2", symbol: "ADAUSDT", type: "buy", price: 0.58, time: "5 min atrás" },
    { id: "3", symbol: "DOTUSDT", type: "sell", price: 7.32, profit: -2.1, time: "8 min atrás" },
    { id: "4", symbol: "BNBUSDT", type: "sell", price: 315.20, profit: 4.8, time: "12 min atrás" },
    { id: "5", symbol: "SOLUSDT", type: "buy", price: 98.45, time: "15 min atrás" },
  ];

  return (
    <div className="space-y-4 h-full flex flex-col">
      <h2 className="text-2xl font-bold">Histórico de Trades</h2>
      
      <ScrollArea className="flex-1 pr-4">
        <div className="space-y-3">
          {trades.map((trade) => (
            <div
              key={trade.id}
              className="p-4 rounded-lg border border-border bg-secondary/20 hover:bg-secondary/40 transition-colors"
            >
              <div className="flex items-start justify-between">
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Badge
                      variant={trade.type === "buy" ? "default" : "secondary"}
                      className={trade.type === "buy" ? "bg-accent" : "bg-warning"}
                    >
                      {trade.type === "buy" ? "COMPRA" : "VENDA"}
                    </Badge>
                    <span className="font-bold">{trade.symbol}</span>
                  </div>
                  
                  <div className="text-sm text-muted-foreground">
                    {trade.time}
                  </div>
                </div>

                <div className="text-right space-y-1">
                  <div className="font-mono font-bold">
                    ${trade.price.toFixed(2)}
                  </div>
                  
                  {trade.profit !== undefined && (
                    <div className={`flex items-center gap-1 text-sm font-medium ${
                      trade.profit >= 0 ? 'text-success' : 'text-danger'
                    }`}>
                      {trade.profit >= 0 ? (
                        <TrendingUp className="w-3 h-3" />
                      ) : (
                        <TrendingDown className="w-3 h-3" />
                      )}
                      {trade.profit >= 0 ? '+' : ''}{trade.profit.toFixed(2)}%
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </ScrollArea>
    </div>
  );
};
