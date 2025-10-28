import { supabase } from "@/integrations/supabase/client";

export interface VolatilityData {
  symbol: string;
  priceChangePercent: number;
  volume: number;
  lastPrice: number;
}

export const pairSelectionService = {
  /**
   * Busca pares de negociação populares na Binance
   */
  async getTopVolatilePairs(limit = 10): Promise<VolatilityData[]> {
    try {
      const response = await fetch('https://api.binance.com/api/v3/ticker/24hr');
      
      if (!response.ok) {
        throw new Error(`Binance API error: ${response.statusText}`);
      }

      const data = await response.json();
      
      // Filtrar apenas pares USDT com volume significativo (reduzido para 5M)
      const usdtPairs = data
        .filter((ticker: any) => 
          ticker.symbol.endsWith('USDT') && 
          parseFloat(ticker.quoteVolume) > 5000000 // Volume mínimo de 5M USDT
        )
        .map((ticker: any) => ({
          symbol: ticker.symbol,
          priceChangePercent: Math.abs(parseFloat(ticker.priceChangePercent)),
          volume: parseFloat(ticker.quoteVolume),
          lastPrice: parseFloat(ticker.lastPrice)
        }))
        .sort((a: VolatilityData, b: VolatilityData) => 
          b.priceChangePercent - a.priceChangePercent
        )
        .slice(0, limit);

      return usdtPairs;
    } catch (error) {
      console.error('Erro ao buscar pares voláteis:', error);
      // Fallback para pares populares
      return [
        { symbol: 'BTCUSDT', priceChangePercent: 0, volume: 0, lastPrice: 0 }
      ];
    }
  },

  /**
   * Seleciona o melhor par baseado em volatilidade e estratégia
   */
  async selectOptimalPair(): Promise<string> {
    try {
      const volatilePairs = await this.getTopVolatilePairs(10);
      
      if (volatilePairs.length === 0) {
        return 'BTCUSDT'; // Fallback seguro
      }

      // Selecionar par com boa volatilidade (entre 1% e 20% de mudança em 24h) - Range mais amplo
      const optimalPair = volatilePairs.find(
        pair => pair.priceChangePercent >= 1 && pair.priceChangePercent <= 20
      );

      return optimalPair ? optimalPair.symbol : volatilePairs[0].symbol;
    } catch (error) {
      console.error('Erro ao selecionar par ótimo:', error);
      return 'BTCUSDT';
    }
  },

  /**
   * Seleciona múltiplos pares ótimos para trading simultâneo
   */
  async selectMultipleOptimalPairs(count: number = 5): Promise<string[]> {
    try {
      const volatilePairs = await this.getTopVolatilePairs(count * 2); // Buscar o dobro para ter opções
      
      if (volatilePairs.length === 0) {
        return ['BTCUSDT']; // Fallback seguro
      }

      // Filtrar pares com volatilidade adequada (1% a 20%)
      const goodPairs = volatilePairs
        .filter(pair => pair.priceChangePercent >= 1 && pair.priceChangePercent <= 20)
        .slice(0, count)
        .map(pair => pair.symbol);

      // Se não encontrar pares suficientes, usar os mais voláteis disponíveis
      if (goodPairs.length < count) {
        const additionalPairs = volatilePairs
          .slice(0, count)
          .map(pair => pair.symbol)
          .filter(symbol => !goodPairs.includes(symbol));
        
        return [...goodPairs, ...additionalPairs].slice(0, count);
      }

      return goodPairs;
    } catch (error) {
      console.error('Erro ao selecionar múltiplos pares:', error);
      return ['BTCUSDT'];
    }
  },

  /**
   * Atualiza o par de negociação do bot baseado na volatilidade
   */
  async updateBotTradingPair(userId: string): Promise<string> {
    try {
      const optimalPair = await this.selectOptimalPair();
      
      const { error } = await supabase
        .from('bot_configurations')
        .update({ trading_pair: optimalPair })
        .eq('user_id', userId);

      if (error) {
        console.error('Erro ao atualizar par de negociação:', error);
        return 'BTCUSDT';
      }

      return optimalPair;
    } catch (error) {
      console.error('Erro ao atualizar par de negociação do bot:', error);
      return 'BTCUSDT';
    }
  }
};
