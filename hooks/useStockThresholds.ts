'use client';

import { useEffect, useState } from 'react';
import { DEFAULT_STOCK_THRESHOLDS, StockThresholds } from '@/constants/replacement';
import { getTenantConfig } from '@/services/tenant-config.service';

export function useStockThresholds(): StockThresholds {
  const [thresholds, setThresholds] = useState<StockThresholds>(DEFAULT_STOCK_THRESHOLDS);

  useEffect(() => {
    getTenantConfig()
      .then(config => setThresholds({ lowStockMax: config.lowStockMax, normalStockMax: config.normalStockMax }))
      .catch(() => setThresholds(DEFAULT_STOCK_THRESHOLDS));
  }, []);

  return thresholds;
}
