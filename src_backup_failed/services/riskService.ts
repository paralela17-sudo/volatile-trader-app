/**
 * Risk Settings - SSOT para parâmetros de risco
 * Estratégia: Momentum Trading (5-15 min por operação)
 */
export const RISK_SETTINGS = {
  // Mean Reversion Strategy - Parâmetros Otimizados
  STOP_LOSS_PERCENT: 2.5, // 2.5% stop loss (mais conservador)
  TAKE_PROFIT_PERCENT: 5.0, // 5.0% take profit (ratio 1:2 realista)

  // Session/position management
  MAX_HOLD_MINUTES: 25, // Tempo máximo de posição aberta (aumentado para deixar momentum desenvolver)

  // Capital Management (percent values)
  CAPITAL_PER_ROUND_PERCENT: 10, // Máximo 10% do capital total por rodada
  MAX_ALLOCATION_PER_PAIR_PERCENT: 5, // Máximo 5% do capital total por par
  SAFETY_RESERVE_PERCENT: 5, // Reserva de segurança aplicada sobre o capital da rodada
  MAX_POSITIONS: 5, // Máximo de posições simultâneas

  // Momentum Parameters (percent units) - Entrada mais cedo
  MOMENTUM_BUY_THRESHOLD: 0.3, // Comprar quando subir 0.3%+ (entrada mais cedo)
  MIN_VOLUME_RATIO: 1.15, // Volume 15% acima da média (menos restritivo)
  PRICE_VELOCITY_THRESHOLD: 0.2, // Velocidade mínima (% por tick, mais sensível)

  // Cooldown & Protection
  PAIR_COOLDOWN_SECONDS: 45, // FASE 1: Reduzido de 90s para 45s (mais oportunidades)
  PROFIT_PROTECT_THRESHOLD: 1.5, // Proteger lucro quando atingir 1.5%+ (menos agressivo)

  // Reinvestment
  AUTO_REINVEST: true, // Reinvestir capital liberado automaticamente

  // ===== NOVOS FILTROS INTELIGENTES (Quality Over Quantity) =====

  // Filtro de Liquidez (evita slippage e falsos sinais)
  MIN_QUOTE_VOLUME_24H_USDT: 5_000_000, // FASE 1: Reduzido de 10M para 5M (mais pares disponíveis)

  // Filtro de Volatilidade Intraday (evita mercados "chop")
  MIN_VOLATILITY_PERCENT: 0.25, // Mínimo 0.25% de volatilidade realizada
  VOLATILITY_WINDOW_TICKS: 40, // Janela de 40 ticks para calcular volatilidade

  // Circuit Breakers (proteção contra drawdowns)
  LOSS_STREAK_LIMIT: 3, // Pausar após 3 perdas consecutivas
  DAILY_MAX_DRAWDOWN_PERCENT: 3.0, // Pausar se perda diária ≥ 3%
  CIRCUIT_BREAKER_PAUSE_MINUTES: 60, // Tempo de pausa após circuit breaker

  // Cooldown Dinâmico por Perda (aprende com erros)
  LOSS_COOLDOWN_BASE_MINUTES: 10, // Base: 10 min após cada stop loss
  LOSS_COOLDOWN_MULTIPLIER: 1.0, // Multiplica por número de perdas recentes
};

export function computeDailyProfitPercent(initialCapital: number, todaysProfit: number): number {
  if (!initialCapital || initialCapital <= 0) return 0;
  return (todaysProfit / initialCapital) * 100;
}
