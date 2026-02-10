import { useState, useEffect } from "react";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { TrendingUp, TrendingDown } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { supabase } from "@/integrations/supabase/client";

interface Trade {
  id: string;
  symbol: string;
  type: "buy" | "sell";
  price: number;
  profit?: number;
  time: string;
  quantity: number;
}

const calculateRelativeTime = (date: string) => {
  try {
    return formatDistanceToNow(new Date(date), {
      addSuffix: true,
      locale: ptBR
    });
  } catch {
    return "agora";
  }
};

export const TradeHistory = () => {
  const [trades, setTrades] = useState<Trade[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadTrades();

    // Atualizar a cada 30 segundos
    const interval = setInterval(loadTrades, 30000);
    return () => clearInterval(interval);
  }, []);

  const loadTrades = async () => {
    try {
      const { data, error } = await supabase
        .from('trades')
        .select('*')
        .order('closed_at', { ascending: false })
        .limit(10);

      if (error) throw error;
      // Map Supabase data to the Trade interface
      setTrades(data.map((t: any) => ({
        id: t.id,
        symbol: t.symbol,
        type: (t.side || 'BUY').toLowerCase() as "buy" | "sell",
        price: Number(t.price),
        profit: t.profit_loss,
        time: new Date(t.created_at || new Date()).toLocaleTimeString(), // Assuming created_at from Supabase
        quantity: Number(t.quantity || 0)
      })) || []);
    } catch (error) {
      console.error("Erro ao carregar histórico de trades:", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4 h-full flex flex-col">
      <h2 className="text-2xl font-bold">Histórico de Trades</h2>

      <ScrollArea className="flex-1 pr-4">
        {loading ? (
          <div className="flex items-center justify-center py-8 text-muted-foreground">
            Carregando histórico...
          </div>
        ) : trades.length === 0 ? (
          <div className="flex items-center justify-center py-8 text-muted-foreground">
            Nenhum trade executado ainda
          </div>
        ) : (
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
                      <div className={`flex items-center gap-1 text-sm font-medium ${trade.profit >= 0 ? 'text-success' : 'text-danger'
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
        )}
      </ScrollArea>
    </div>
  );
};
