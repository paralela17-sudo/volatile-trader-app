/**
 * Momentum Trading Strategy Service
 * SRP: Responsável apenas pela lógica da estratégia de momentum
 * Compra em alta com volume forte, vende rápido (5-15 min)
 */

export interface MomentumSignal {
  symbol: string;
  shouldBuy: boolean;
  confidence: number; // 0-1
  reason: string;
}

export interface MarketMomentum {
  priceChangePercent: number;
  volumeRatio: number; // Volume atual vs média
  priceVelocity: number; // Taxa de mudança de preço
  trend: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
}

class MomentumStrategyService {
  // Parâmetros da estratégia Momentum Trading (ajustados para mercado real)
  private readonly MOMENTUM_THRESHOLD = 0.15; // Comprar quando subir 0.15%+
  private readonly MIN_VOLUME_RATIO = 1.1; // Volume 10% acima da média
  private readonly PRICE_VELOCITY_THRESHOLD = 0.01; // Velocidade mínima de subida
  private readonly MIN_CONFIDENCE = 0.5; // Confiança mínima para trade

  /**
   * Analisa se há momentum de compra em um par
   */
  analyzeMomentum(
    prices: number[],
    volumes?: number[]
  ): MarketMomentum {
    if (prices.length < 5) {
      return {
        priceChangePercent: 0,
        volumeRatio: 0,
        priceVelocity: 0,
        trend: 'NEUTRAL'
      };
    }

    // Calcular mudança de preço (últimos vs primeiros 5 pontos)
    const recentPrices = prices.slice(-5);
    const olderPrices = prices.slice(-10, -5);
    const recentAvg = this.average(recentPrices);
    const olderAvg = this.average(olderPrices);
    const priceChangePercent = ((recentAvg - olderAvg) / olderAvg) * 100;

    // Calcular velocidade de mudança de preço (aceleração)
    const priceVelocity = this.calculateVelocity(prices.slice(-10));

    // Calcular volume ratio se disponível
    let volumeRatio = 1.0;
    if (volumes && volumes.length >= 10) {
      const recentVolume = this.average(volumes.slice(-5));
      const avgVolume = this.average(volumes);
      volumeRatio = recentVolume / avgVolume;
    }

    // Determinar tendência alinhada ao threshold da estratégia
    let trend: 'BULLISH' | 'BEARISH' | 'NEUTRAL' = 'NEUTRAL';
    if (priceChangePercent >= this.MOMENTUM_THRESHOLD && priceVelocity >= 0) {
      trend = 'BULLISH';
    } else if (priceChangePercent <= -this.MOMENTUM_THRESHOLD && priceVelocity <= 0) {
      trend = 'BEARISH';
    }
    return {
      priceChangePercent,
      volumeRatio,
      priceVelocity,
      trend
    };
  }

  /**
   * Gera sinal de compra baseado em momentum
   */
  generateBuySignal(
    symbol: string,
    momentum: MarketMomentum
  ): MomentumSignal {
    let confidence = 0;
    const reasons: string[] = [];

    // Verificar momentum de preço positivo
    if (momentum.priceChangePercent >= this.MOMENTUM_THRESHOLD) {
      confidence += 0.4;
      reasons.push(`Subida de ${momentum.priceChangePercent.toFixed(2)}%`);
    }

    // Verificar volume acima da média
    if (momentum.volumeRatio >= this.MIN_VOLUME_RATIO) {
      confidence += 0.3;
      reasons.push(`Volume ${((momentum.volumeRatio - 1) * 100).toFixed(0)}% acima da média`);
    }

    // Verificar velocidade positiva
    if (momentum.priceVelocity >= this.PRICE_VELOCITY_THRESHOLD) {
      confidence += 0.3;
      reasons.push('Aceleração positiva');
    }

    const shouldBuy = confidence >= this.MIN_CONFIDENCE && momentum.trend === 'BULLISH';

    return {
      symbol,
      shouldBuy,
      confidence,
      reason: reasons.join(', ') || 'Sem momentum'
    };
  }

  /**
   * Verifica se deve manter posição ou sair
   */
  shouldHoldPosition(
    buyPrice: number,
    currentPrice: number,
    momentum: MarketMomentum
  ): boolean {
    const profitPercent = ((currentPrice - buyPrice) / buyPrice) * 100;

    // Se está em lucro e momentum continua positivo, manter
    if (profitPercent > 0 && momentum.trend === 'BULLISH') {
      return true;
    }

    // Se momentum virou negativo, não manter
    if (momentum.trend === 'BEARISH') {
      return false;
    }

    return true;
  }

  // Métodos auxiliares
  private average(values: number[]): number {
    if (values.length === 0) return 0;
    return values.reduce((sum, val) => sum + val, 0) / values.length;
  }

  private calculateVelocity(prices: number[]): number {
    if (prices.length < 2) return 0;
    
    // Calcular diferenças consecutivas
    const differences: number[] = [];
    for (let i = 1; i < prices.length; i++) {
      differences.push(prices[i] - prices[i - 1]);
    }

    // Velocidade = média das diferenças (aceleração)
    return this.average(differences);
  }
}

export const momentumStrategyService = new MomentumStrategyService();
