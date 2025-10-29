/**
 * Risk Settings - SSOT para parâmetros de risco
 * Estratégia: Momentum Trading (5-15 min por operação)
 */
export const RISK_SETTINGS = {
  // Momentum Trading Strategy
  STOP_LOSS_PERCENT: 1.5, // 1.5% stop loss (proteção rápida)
  TAKE_PROFIT_PERCENT: 2.5, // 2.5% take profit (alvo agressivo)
  
  // Capital Management
  CAPITAL_PER_ROUND_PERCENT: 20, // 20% do capital total por rodada
  MAX_POSITIONS: 5, // Máximo de posições simultâneas
  
  // Momentum Parameters
  MOMENTUM_BUY_THRESHOLD: 0.5, // Comprar quando subir 0.5%+
  MIN_VOLUME_RATIO: 1.2, // Volume 20% acima da média
  
  // Reinvestment
  AUTO_REINVEST: true, // Reinvestir capital liberado automaticamente
} as const;

export function computeDailyProfitPercent(initialCapital: number, todaysProfit: number): number {
  if (!initialCapital || initialCapital <= 0) return 0;
  return (todaysProfit / initialCapital) * 100;
}
