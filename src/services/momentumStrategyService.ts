import { type Candle } from './binanceService';

/**
 * Three Min/Max Strategy Service
 * Estratégia baseada na média das 3 últimas mínimas e máximas
 * 
 * Compra: quando preço atual <= média das 3 últimas mínimas
 * Venda: quando preço atual >= média das 3 últimas máximas
 */

export interface MomentumSignal {
  symbol: string;
  shouldBuy: boolean;
  confidence: number; // 0-1
  reason: string;
}

export interface MarketMomentum {
  priceChangePercent: number;
  volumeRatio: number;
  priceVelocity: number;
  trend: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
  avgLows?: number;
  avgHighs?: number;
}

class MomentumStrategyService {
  private readonly MIN_CONFIDENCE = 0.7; // Alta confiança para sinais claros

  /**
   * Calcula a média das últimas 3 mínimas
   */
  private calcularMediaMinimas(candles: Candle[]): number {
    if (candles.length < 3) return 0;
    const ultimos3 = candles.slice(-3);
    const somaMinimas = ultimos3.reduce((acc, c) => acc + c.low, 0);
    return somaMinimas / 3;
  }

  /**
   * Calcula a média das últimas 3 máximas
   */
  private calcularMediaMaximas(candles: Candle[]): number {
    if (candles.length < 3) return 0;
    const ultimos3 = candles.slice(-3);
    const somaMaximas = ultimos3.reduce((acc, c) => acc + c.high, 0);
    return somaMaximas / 3;
  }

  /**
   * Função principal de decisão de trade
   */
  private avaliarEstrategia(candles: Candle[], precoAtual: number): 'comprar' | 'vender' | 'manter' {
    if (candles.length < 3) return 'manter';

    const mediaMinimas = this.calcularMediaMinimas(candles);
    const mediaMaximas = this.calcularMediaMaximas(candles);

    if (precoAtual <= mediaMinimas) {
      return 'comprar';
    }

    if (precoAtual >= mediaMaximas) {
      return 'vender';
    }

    return 'manter';
  }

  /**
   * Analisa momentum do mercado com base nos candles
   */
  analyzeMomentum(
    prices: number[],
    volumes?: number[],
    candles?: Candle[]
  ): MarketMomentum {
    if (!candles || candles.length < 3) {
      return {
        priceChangePercent: 0,
        volumeRatio: 0,
        priceVelocity: 0,
        trend: 'NEUTRAL'
      };
    }

    const avgLows = this.calcularMediaMinimas(candles);
    const avgHighs = this.calcularMediaMaximas(candles);
    const currentPrice = candles[candles.length - 1].close;

    // Calcular tendência baseada na posição do preço atual
    let trend: 'BULLISH' | 'BEARISH' | 'NEUTRAL' = 'NEUTRAL';
    const priceChangePercent = ((currentPrice - candles[0].close) / candles[0].close) * 100;

    if (currentPrice <= avgLows) {
      trend = 'BULLISH'; // Oportunidade de compra
    } else if (currentPrice >= avgHighs) {
      trend = 'BEARISH'; // Oportunidade de venda
    }

    // Calcular volume ratio se disponível
    let volumeRatio = 1.0;
    if (volumes && volumes.length >= 3) {
      const recentVolume = this.average(volumes.slice(-3));
      const avgVolume = this.average(volumes);
      volumeRatio = recentVolume / avgVolume;
    }

    return {
      priceChangePercent,
      volumeRatio,
      priceVelocity: 0,
      trend,
      avgLows,
      avgHighs
    };
  }

  /**
   * Calcula volatilidade realizada de curto prazo
   */
  calculateShortTermVolatility(prices: number[]): number {
    if (prices.length < 2) return 0;
    
    const returns: number[] = [];
    for (let i = 1; i < prices.length; i++) {
      const prev = prices[i - 1];
      if (prev === 0) continue;
      returns.push(Math.abs(((prices[i] - prev) / prev) * 100));
    }
    
    return this.average(returns);
  }

  /**
   * Gera sinal de compra baseado na estratégia de média das 3 mínimas
   */
  generateBuySignal(
    symbol: string,
    momentum: MarketMomentum,
    quoteVolume24h?: number,
    recentPrices?: number[],
    candles?: Candle[]
  ): MomentumSignal {
    if (!candles || candles.length < 3) {
      return {
        symbol,
        shouldBuy: false,
        confidence: 0,
        reason: 'Dados insuficientes (necessário 3+ candles)'
      };
    }

    const currentPrice = candles[candles.length - 1].close;
    const decision = this.avaliarEstrategia(candles, currentPrice);

    if (decision === 'comprar') {
      const avgLows = momentum.avgLows || 0;
      return {
        symbol,
        shouldBuy: true,
        confidence: 0.9,
        reason: `Preço atual ($${currentPrice.toFixed(2)}) ≤ Média das 3 mínimas ($${avgLows.toFixed(2)})`
      };
    }

    return {
      symbol,
      shouldBuy: false,
      confidence: 0,
      reason: decision === 'vender' 
        ? `Preço em zona de venda (≥ média das 3 máximas)` 
        : 'Aguardando preço atingir média das mínimas'
    };
  }

  /**
   * Verifica se deve manter posição ou sair (para vendas)
   */
  shouldHoldPosition(
    buyPrice: number,
    currentPrice: number,
    momentum: MarketMomentum,
    candles?: Candle[]
  ): boolean {
    if (!candles || candles.length < 3) return true;

    const decision = this.avaliarEstrategia(candles, currentPrice);

    // Se a decisão é vender (preço >= média das máximas), não manter
    if (decision === 'vender') {
      return false;
    }

    // Manter posição enquanto não atingir média das máximas
    return true;
  }

  /**
   * Verifica se deve vender posição (usado pelo tradingService)
   */
  shouldSell(candles: Candle[]): boolean {
    if (candles.length < 3) return false;
    
    const currentPrice = candles[candles.length - 1].close;
    const decision = this.avaliarEstrategia(candles, currentPrice);
    
    return decision === 'vender';
  }

  // Métodos auxiliares
  private average(values: number[]): number {
    if (values.length === 0) return 0;
    return values.reduce((sum, val) => sum + val, 0) / values.length;
  }
}

export const momentumStrategyService = new MomentumStrategyService();
