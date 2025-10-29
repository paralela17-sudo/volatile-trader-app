/**
 * Risk Settings - SSOT para parâmetros de risco
 * Estratégia: Momentum Trading (5-15 min por operação)
 */
export const RISK_SETTINGS = {
  // Momentum Trading Strategy (Risk/Reward 1:3 otimizado)
  STOP_LOSS_PERCENT: 1.0, // 1.0% stop loss (reduzido para melhor ratio)
  TAKE_PROFIT_PERCENT: 3.0, // 3.0% take profit (aumentado para ratio 1:3)
  
  // Session/position management
  MAX_HOLD_MINUTES: 25, // Tempo máximo de posição aberta (aumentado para deixar momentum desenvolver)
  
  // Capital Management (percent values)
  CAPITAL_PER_ROUND_PERCENT: 10, // Máximo 10% do capital total por rodada
  MAX_ALLOCATION_PER_PAIR_PERCENT: 5, // Máximo 5% do capital por par
  SAFETY_RESERVE_PERCENT: 5, // Reserva de segurança aplicada sobre o capital da rodada
  MAX_POSITIONS: 5, // Máximo de posições simultâneas
  
  // Momentum Parameters (percent units) - Entrada mais cedo
  MOMENTUM_BUY_THRESHOLD: 0.3, // Comprar quando subir 0.3%+ (entrada mais cedo)
  MIN_VOLUME_RATIO: 1.15, // Volume 15% acima da média (menos restritivo)
  PRICE_VELOCITY_THRESHOLD: 0.2, // Velocidade mínima (% por tick, mais sensível)
  
  // Cooldown & Protection
  PAIR_COOLDOWN_SECONDS: 90, // Aguardar 90s após venda antes de reentrar no mesmo par
  PROFIT_PROTECT_THRESHOLD: 1.5, // Proteger lucro quando atingir 1.5%+ (menos agressivo)
  
  // Reinvestment
  AUTO_REINVEST: true, // Reinvestir capital liberado automaticamente
} as const;

export function computeDailyProfitPercent(initialCapital: number, todaysProfit: number): number {
  if (!initialCapital || initialCapital <= 0) return 0;
  return (todaysProfit / initialCapital) * 100;
}
