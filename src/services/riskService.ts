/**
 * Risk Settings - SSOT para parâmetros de risco
 * Estratégia: Momentum Trading (5-15 min por operação)
 */
export const RISK_SETTINGS = {
  // Mean Reversion Strategy - Parâmetros Otimizados (Turbo Scalping)
  STOP_LOSS_PERCENT: 1.0, // Reduzido para 1% (proteção rápida)
  TAKE_PROFIT_PERCENT: 1.5, // Reduzido para 1.5% (lucros rápidos e frequentes)

  // Session/position management
  MAX_HOLD_MINUTES: 15, // Tempo máximo reduzido (giro rápido de capital)

  // Capital Management (percent values)
  CAPITAL_PER_ROUND_PERCENT: 10, // Reduzido para 10% por rodada (mais conservador)
  MAX_ALLOCATION_PER_PAIR_PERCENT: 5, // Reduzido para 5% por par (mais seguro)
  SAFETY_RESERVE_PERCENT: 10, // Reserva maior para segurança
  MAX_POSITIONS: 3, // Reduzido para 3 posições simultâneas (mais controle)

  // Momentum Parameters (percent units) - Entrada "Gatilho Rápido"
  MOMENTUM_BUY_THRESHOLD: 0.15, // Reduzido de 0.3 para 0.15 (qualquer movimento de reversão ativa)
  MIN_VOLUME_RATIO: 1.05, // Volume apenas 5% acima da média já serve
  PRICE_VELOCITY_THRESHOLD: 0.1, // Velocidade mínima reduzida

  // Cooldown & Protection
  PAIR_COOLDOWN_SECONDS: 300, // Aumentado para 5 min (evita spam)
  PROFIT_PROTECT_THRESHOLD: 0.8, // Proteger lucro a partir de 0.8%

  // Reinvestment
  AUTO_REINVEST: true,

  // ===== NOVOS FILTROS INTELIGENTES (Quality Over Quantity) =====

  // Filtro de Liquidez
  MIN_QUOTE_VOLUME_24H_USDT: 2_000_000, // Reduzido para 2M (aceita mid-caps voláteis)

  // Filtro de Volatilidade Intraday
  MIN_VOLATILITY_PERCENT: 0.03, // Reduzido drasticamente para 0.03% (mercado calmo)
  VOLATILITY_WINDOW_TICKS: 20, // Janela mais curta (20 ticks)

  // Circuit Breakers
  LOSS_STREAK_LIMIT: 4, // Relaxado para 4 perdas
  DAILY_MAX_DRAWDOWN_PERCENT: 5.0, // Relaxado para 5%
  CIRCUIT_BREAKER_PAUSE_MINUTES: 30, // Pausa menor (30 min)

  // Cooldown Dinâmico
  LOSS_COOLDOWN_BASE_MINUTES: 5, // Apenas 5 min após loss
  LOSS_COOLDOWN_MULTIPLIER: 1.0,
};

export function computeDailyProfitPercent(initialCapital: number, todaysProfit: number): number {
  if (!initialCapital || initialCapital <= 0) return 0;
  return (todaysProfit / initialCapital) * 100;
}
