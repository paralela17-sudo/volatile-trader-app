export const RISK_SETTINGS = {
  STOP_LOSS_PERCENT: 3,
  TAKE_PROFIT_PERCENT: 6,
} as const;

export function computeDailyProfitPercent(initialCapital: number, todaysProfit: number): number {
  if (!initialCapital || initialCapital <= 0) return 0;
  return (todaysProfit / initialCapital) * 100;
}
