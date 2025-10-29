import { RISK_SETTINGS } from './riskService';

/**
 * Momentum Trading Strategy Service
 * SRP: Responsável apenas pela lógica da estratégia de momentum
 * Compra em alta com volume forte, vende rápido (5-15 min)
 * SSOT: Usa RISK_SETTINGS para todos os thresholds
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
  // SSOT: Todos os parâmetros vêm de RISK_SETTINGS
  private readonly MIN_CONFIDENCE = 0.4; // Confiança mínima para trade

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

    // Determinar tendência alinhada ao threshold da estratégia (SSOT)
    let trend: 'BULLISH' | 'BEARISH' | 'NEUTRAL' = 'NEUTRAL';
    if (priceChangePercent >= RISK_SETTINGS.MOMENTUM_BUY_THRESHOLD) {
      trend = 'BULLISH';
    } else if (priceChangePercent <= -RISK_SETTINGS.MOMENTUM_BUY_THRESHOLD) {
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
    
    // Volatilidade = média dos retornos absolutos
    return this.average(returns);
  }

  /**
   * Gera sinal de compra baseado em momentum
   */
  generateBuySignal(
    symbol: string,
    momentum: MarketMomentum,
    quoteVolume24h?: number,
    recentPrices?: number[]
  ): MomentumSignal {
    let confidence = 0;
    const reasons: string[] = [];
    const rejectionReasons: string[] = [];

    // ===== NOVOS FILTROS INTELIGENTES (Quality Filters) =====
    
    // Filtro 1: Liquidez (evita slippage e manipulação)
    if (quoteVolume24h !== undefined) {
      if (quoteVolume24h < RISK_SETTINGS.MIN_QUOTE_VOLUME_24H_USDT) {
        rejectionReasons.push(`Baixa liquidez (${(quoteVolume24h / 1_000_000).toFixed(1)}M < 10M USDT)`);
        return {
          symbol,
          shouldBuy: false,
          confidence: 0,
          reason: rejectionReasons.join(', ')
        };
      }
      confidence += 0.15;
      reasons.push(`Liquidez OK (${(quoteVolume24h / 1_000_000).toFixed(1)}M USDT)`);
    }

    // Filtro 2: Volatilidade Intraday (evita mercados "chop")
    if (recentPrices && recentPrices.length >= RISK_SETTINGS.VOLATILITY_WINDOW_TICKS) {
      const windowPrices = recentPrices.slice(-RISK_SETTINGS.VOLATILITY_WINDOW_TICKS);
      const shortTermVol = this.calculateShortTermVolatility(windowPrices);
      
      if (shortTermVol < RISK_SETTINGS.MIN_VOLATILITY_PERCENT) {
        rejectionReasons.push(`Baixa volatilidade (${shortTermVol.toFixed(2)}% < 0.25%)`);
        return {
          symbol,
          shouldBuy: false,
          confidence: 0,
          reason: rejectionReasons.join(', ')
        };
      }
      confidence += 0.15;
      reasons.push(`Volatilidade adequada (${shortTermVol.toFixed(2)}%)`);
    }

    // ===== FILTROS ORIGINAIS DE MOMENTUM =====

    // Verificar momentum de preço positivo (SSOT)
    if (momentum.priceChangePercent >= RISK_SETTINGS.MOMENTUM_BUY_THRESHOLD) {
      confidence += 0.3;
      reasons.push(`Subida de ${momentum.priceChangePercent.toFixed(2)}%`);
    }

    // Verificar volume acima da média (SSOT)
    if (momentum.volumeRatio >= RISK_SETTINGS.MIN_VOLUME_RATIO) {
      confidence += 0.2;
      reasons.push(`Volume ${((momentum.volumeRatio - 1) * 100).toFixed(0)}% acima da média`);
    }

    // Verificar velocidade positiva (SSOT)
    if (momentum.priceVelocity >= RISK_SETTINGS.PRICE_VELOCITY_THRESHOLD) {
      confidence += 0.2;
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
    
    // Calcular variação percentual consecutiva (% por tick)
    const pctChanges: number[] = [];
    for (let i = 1; i < prices.length; i++) {
      const prev = prices[i - 1];
      if (prev === 0) continue;
      pctChanges.push(((prices[i] - prev) / prev) * 100);
    }

    // Velocidade = média das variações percentuais
    return this.average(pctChanges);
  }
}

export const momentumStrategyService = new MomentumStrategyService();
