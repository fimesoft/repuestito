export const STOCK_THRESHOLDS = {
  LOW_MAX: 4,
  NORMAL_MAX: 15,
} as const;

export type StockLevel = 'low' | 'normal' | 'full';

export function getStockLevel(stock: number): StockLevel {
  if (stock <= STOCK_THRESHOLDS.LOW_MAX) return 'low';
  if (stock <= STOCK_THRESHOLDS.NORMAL_MAX) return 'normal';
  return 'full';
}

export const STOCK_LEVEL_LABEL: Record<StockLevel, string> = {
  low: 'Stock bajo',
  normal: 'Stock normal',
  full: 'Stock completo',
};
