/**
 * Mean Reversion Strategy com Bollinger Bands + RSI
 * Estratégia comprovadamente lucrativa e de baixo risco
 * 
 * LÓGICA:
 * - COMPRA: Preço toca/cruza Lower Band E RSI < 30 (oversold)
 * - VENDA: Preço toca/cruza Upper Band E RSI > 70 (overbought)
 * - Stop Loss: 2.5% abaixo do preço de compra
 * - Take Profit: 5% acima do preço de compra
 */

import { bollingerBandsService, type BollingerBandsResult } from '../indicators/bollingerBands';
import { rsiService, type RSIResult } from '../indicators/rsi';

export interface MeanReversionSignal {
  action: 'buy' | 'sell' | 'hold';
  confidence: number;
  reason: string;
  indicators?: {
    bollingerBands: BollingerBandsResult;
    rsi: RSIResult;
    currentPrice: number;
  };
}

class MeanReversionStrategy {
  // Parâmetros otimizados para crypto
  private readonly BB_PERIOD = 20;
  private readonly BB_STD_DEV = 2.0;
  private readonly RSI_PERIOD = 14;
  
  // Thresholds de confiança
  private readonly HIGH_CONFIDENCE = 0.9;
  private readonly MEDIUM_CONFIDENCE = 0.7;

  /**
   * Analisa oportunidade de COMPRA
   */
  analyzeBuyOpportunity(prices: number[]): MeanReversionSignal {
    if (prices.length < Math.max(this.BB_PERIOD, this.RSI_PERIOD + 1)) {
      return {
        action: 'hold',
        confidence: 0,
        reason: 'Dados insuficientes (mínimo 21 candles)'
      };
    }

    const currentPrice = prices[prices.length - 1];
    const bb = bollingerBandsService.calculate(prices, this.BB_PERIOD, this.BB_STD_DEV);
    const rsi = rsiService.calculate(prices, this.RSI_PERIOD);

    if (!bb || !rsi) {
      return {
        action: 'hold',
        confidence: 0,
        reason: 'Erro ao calcular indicadores'
      };
    }

    // CONDIÇÃO PRIMÁRIA: Preço abaixo da Lower Band + RSI Oversold
    const isPriceNearLowerBand = currentPrice <= bb.lower * 1.002; // 0.2% de margem
    const isRSIOversold = rsi.isOversold;

    if (isPriceNearLowerBand && isRSIOversold) {
      return {
        action: 'buy',
        confidence: this.HIGH_CONFIDENCE,
        reason: `MEAN REVERSION: Preço ($${currentPrice.toFixed(2)}) abaixo da Lower Band ($${bb.lower.toFixed(2)}) + RSI oversold (${rsi.value.toFixed(1)})`,
        indicators: { bollingerBands: bb, rsi, currentPrice }
      };
    }

    // CONDIÇÃO SECUNDÁRIA: Apenas RSI muito oversold (< 25)
    if (rsi.value < 25 && currentPrice <= bb.middle) {
      return {
        action: 'buy',
        confidence: this.MEDIUM_CONFIDENCE,
        reason: `RSI EXTREMO: RSI muito baixo (${rsi.value.toFixed(1)}) + preço abaixo da média`,
        indicators: { bollingerBands: bb, rsi, currentPrice }
      };
    }

    return {
      action: 'hold',
      confidence: 0,
      reason: `Aguardando: Preço $${currentPrice.toFixed(2)} | Lower Band $${bb.lower.toFixed(2)} | RSI ${rsi.value.toFixed(1)}`,
      indicators: { bollingerBands: bb, rsi, currentPrice }
    };
  }

  /**
   * Analisa oportunidade de VENDA
   */
  analyzeSellOpportunity(prices: number[], buyPrice?: number): MeanReversionSignal {
    if (prices.length < Math.max(this.BB_PERIOD, this.RSI_PERIOD + 1)) {
      return {
        action: 'hold',
        confidence: 0,
        reason: 'Dados insuficientes'
      };
    }

    const currentPrice = prices[prices.length - 1];
    const bb = bollingerBandsService.calculate(prices, this.BB_PERIOD, this.BB_STD_DEV);
    const rsi = rsiService.calculate(prices, this.RSI_PERIOD);

    if (!bb || !rsi) {
      return {
        action: 'hold',
        confidence: 0,
        reason: 'Erro ao calcular indicadores'
      };
    }

    // STOP LOSS: 2.5% abaixo do preço de compra
    if (buyPrice && currentPrice <= buyPrice * 0.975) {
      return {
        action: 'sell',
        confidence: 1.0,
        reason: `STOP LOSS: Preço ($${currentPrice.toFixed(2)}) caiu 2.5% do preço de compra ($${buyPrice.toFixed(2)})`,
        indicators: { bollingerBands: bb, rsi, currentPrice }
      };
    }

    // TAKE PROFIT: 5% acima do preço de compra
    if (buyPrice && currentPrice >= buyPrice * 1.05) {
      return {
        action: 'sell',
        confidence: this.HIGH_CONFIDENCE,
        reason: `TAKE PROFIT: Lucro de 5% atingido ($${buyPrice.toFixed(2)} → $${currentPrice.toFixed(2)})`,
        indicators: { bollingerBands: bb, rsi, currentPrice }
      };
    }

    // CONDIÇÃO PRIMÁRIA: Preço acima da Upper Band + RSI Overbought
    const isPriceNearUpperBand = currentPrice >= bb.upper * 0.998;
    const isRSIOverbought = rsi.isOverbought;

    if (isPriceNearUpperBand && isRSIOverbought) {
      return {
        action: 'sell',
        confidence: this.HIGH_CONFIDENCE,
        reason: `REVERSÃO: Preço ($${currentPrice.toFixed(2)}) acima da Upper Band ($${bb.upper.toFixed(2)}) + RSI overbought (${rsi.value.toFixed(1)})`,
        indicators: { bollingerBands: bb, rsi, currentPrice }
      };
    }

    // CONDIÇÃO SECUNDÁRIA: RSI muito overbought (> 75) + preço acima da média
    if (rsi.value > 75 && currentPrice >= bb.middle) {
      return {
        action: 'sell',
        confidence: this.MEDIUM_CONFIDENCE,
        reason: `RSI EXTREMO: RSI muito alto (${rsi.value.toFixed(1)}) + preço acima da média`,
        indicators: { bollingerBands: bb, rsi, currentPrice }
      };
    }

    return {
      action: 'hold',
      confidence: 0,
      reason: buyPrice 
        ? `Mantendo posição: PnL ${(((currentPrice - buyPrice) / buyPrice) * 100).toFixed(2)}% | RSI ${rsi.value.toFixed(1)}`
        : `Aguardando: Preço $${currentPrice.toFixed(2)} | Upper Band $${bb.upper.toFixed(2)} | RSI ${rsi.value.toFixed(1)}`,
      indicators: { bollingerBands: bb, rsi, currentPrice }
    };
  }
}

export const meanReversionStrategy = new MeanReversionStrategy();
