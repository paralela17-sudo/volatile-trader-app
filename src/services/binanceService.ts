import { supabase } from "@/integrations/supabase/client";

export interface PriceData {
  symbol: string;
  price: number;
  timestamp: number;
}

export interface MarketData {
  symbol: string;
  price: number;
  priceChange: number;
  priceChangePercent: number;
  volume: number;
  high: number;
  low: number;
}

// Serviço para interação com a Binance API
export const binanceService = {
  async getPrice(symbol: string): Promise<PriceData | null> {
    try {
      const { data, error } = await supabase.functions.invoke('binance-get-price', {
        body: { symbol }
      });

      if (error) {
        console.error('Error fetching price:', error);
        return null;
      }

      return data;
    } catch (error) {
      console.error('Exception in getPrice:', error);
      return null;
    }
  },

  async getMarketData(symbol: string): Promise<MarketData | null> {
    try {
      // Usar API pública da Binance para dados de 24h
      const response = await fetch(`https://api.binance.com/api/v3/ticker/24hr?symbol=${symbol}`);
      
      if (!response.ok) {
        throw new Error('Failed to fetch market data');
      }

      const data = await response.json();

      return {
        symbol: data.symbol,
        price: parseFloat(data.lastPrice),
        priceChange: parseFloat(data.priceChange),
        priceChangePercent: parseFloat(data.priceChangePercent),
        volume: parseFloat(data.volume),
        high: parseFloat(data.highPrice),
        low: parseFloat(data.lowPrice)
      };
    } catch (error) {
      console.error('Exception in getMarketData:', error);
      return null;
    }
  },

  async subscribeToPrice(symbol: string, callback: (price: number) => void): Promise<WebSocket | null> {
    try {
      const ws = new WebSocket(`wss://stream.binance.com:9443/ws/${symbol.toLowerCase()}@trade`);

      ws.onmessage = (event) => {
        const data = JSON.parse(event.data);
        callback(parseFloat(data.p));
      };

      ws.onerror = (error) => {
        console.error('WebSocket error:', error);
      };

      return ws;
    } catch (error) {
      console.error('Exception in subscribeToPrice:', error);
      return null;
    }
  },

  calculateProfitLoss(buyPrice: number, sellPrice: number, quantity: number): number {
    return (sellPrice - buyPrice) * quantity;
  },

  shouldTakeProfit(currentPrice: number, buyPrice: number, takeProfitPercent: number): boolean {
    const profitPercent = ((currentPrice - buyPrice) / buyPrice) * 100;
    return profitPercent >= takeProfitPercent;
  },

  shouldStopLoss(currentPrice: number, buyPrice: number, stopLossPercent: number): boolean {
    const lossPercent = ((buyPrice - currentPrice) / buyPrice) * 100;
    return lossPercent >= stopLossPercent;
  }
};
