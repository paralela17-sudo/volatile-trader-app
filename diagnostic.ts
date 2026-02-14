
import { binanceService } from './src/services/binanceService';
import { bollingerBandsService } from './src/services/indicators/bollingerBands';
import { rsiService } from './src/services/indicators/rsi';
import { momentumStrategyService } from './src/services/momentumStrategyService';
import { RISK_SETTINGS } from './src/services/riskService';

async function diagnose() {
    const symbols = ['BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'BNBUSDT', 'XRPUSDT'];
    console.log('--- DIAGNÓSTICO DE INDICADORES ---');

    for (const symbol of symbols) {
        try {
            const candles = await binanceService.getCandles(symbol, '1m', 50);
            if (!candles || candles.length < 21) {
                console.log(`${symbol}: Dados insuficientes (${candles?.length || 0})`);
                continue;
            }

            const prices = candles.map(c => c.close);
            const currentPrice = prices[prices.length - 1];

            const bb = bollingerBandsService.calculate(prices, 20, 2.0);
            const rsi = rsiService.calculate(prices, 14);
            const volatility = momentumStrategyService.calculateShortTermVolatility(prices);

            const distToLower = ((currentPrice - bb.lower) / bb.lower) * 100;
            const distToUpper = ((bb.upper - currentPrice) / bb.upper) * 100;

            console.log(`\nPairs: ${symbol}`);
            console.log(`Preço: $${currentPrice.toFixed(2)}`);
            console.log(`RSI: ${rsi.value.toFixed(1)} ${rsi.value < 45 ? '(OVERSOLD)' : (rsi.value > 70 ? '(OVERBOUGHT)' : '(NEUTRO)')}`);
            console.log(`BB: Lower=$${bb.lower.toFixed(2)} | Middle=$${bb.middle.toFixed(2)} | Upper=$${bb.upper.toFixed(2)}`);
            console.log(`Dist p/ Lower: ${distToLower.toFixed(2)}% | Dist p/ Upper: ${distToUpper.toFixed(2)}%`);
            console.log(`Volatilidade: ${volatility.toFixed(4)}% (Limite: ${RISK_SETTINGS.MIN_VOLATILITY_PERCENT}%)`);

            const isVolatilityOk = volatility >= RISK_SETTINGS.MIN_VOLATILITY_PERCENT;
            const isPriceOk = currentPrice <= bb.lower * 1.015;
            const isRsiOk = rsi.value < 45;

            console.log(`Filtros: Volatilidade=${isVolatilityOk ? 'OK' : 'BAIXA'} | Preço p/ Compra=${isPriceOk ? 'OK' : 'ALTO'} | RSI p/ Compra=${isRsiOk ? 'OK' : 'ALTO'}`);
        } catch (e) {
            console.error(`Erro ao processar ${symbol}:`, e);
        }
    }
}

diagnose();
