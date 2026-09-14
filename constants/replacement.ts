const DEFAULT_LOW_STOCK_MAX = 4;
const DEFAULT_NORMAL_STOCK_MAX = 15;

export interface StockThresholds {
  lowStockMax: number;
  normalStockMax: number;
}

export const DEFAULT_STOCK_THRESHOLDS: StockThresholds = {
  lowStockMax: DEFAULT_LOW_STOCK_MAX,
  normalStockMax: DEFAULT_NORMAL_STOCK_MAX,
};

export type StockLevel = 'low' | 'normal' | 'full';

export function getStockLevel(stock: number, thresholds: StockThresholds = DEFAULT_STOCK_THRESHOLDS): StockLevel {
  if (stock <= thresholds.lowStockMax) return 'low';
  if (stock <= thresholds.normalStockMax) return 'normal';
  return 'full';
}
