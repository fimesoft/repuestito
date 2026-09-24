'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuthUser } from '@/context/AuthUserContext';
import { useCountry } from '@/context/CountryContext';
import { convertLocalToUsd, formatMoney } from '@/lib/currency';
import { getUsdExchangeRate, type ExchangeRate } from '@/services/exchange-rate.service';

const CURRENCY_PREFERENCE_KEY = 'piezify-currency';

const LOCAL_CURRENCY_BY_COUNTRY: Record<string, string> = {
  AR: 'ARS',
  CL: 'CLP',
  VE: 'VES',
  CO: 'COP',
  PE: 'PEN',
};

export type DisplayCurrency = 'LOCAL' | 'USD';

export interface UseCurrencyResult {
  displayCurrency: DisplayCurrency;
  localCurrency: string;
  activeCurrency: string;
  activeRate?: number;
  exchangeRate: ExchangeRate | null;
  loading: boolean;
  error: string | null;
  canConvert: boolean;
  toggleCurrency: () => void;
  formatAmount: (value: number) => string;
}

export function useCurrency(): UseCurrencyResult {
  const { currentUser } = useAuthUser();
  const { country } = useCountry();
  const [displayCurrency, setDisplayCurrency] = useState<DisplayCurrency>('LOCAL');
  const [exchangeRate, setExchangeRate] = useState<ExchangeRate | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canConvert = Boolean(currentUser?.tenantId);
  const localCurrency = exchangeRate?.fromCurrency ?? LOCAL_CURRENCY_BY_COUNTRY[country] ?? 'ARS';
  const activeCurrency = displayCurrency === 'USD' ? 'USD' : localCurrency;
  const activeRate = displayCurrency === 'USD' ? exchangeRate?.rate ?? undefined : undefined;

  const activateUsd = useCallback(async () => {
    if (!currentUser?.tenantId) return;

    setLoading(true);
    setError(null);

    try {
      const quote = await getUsdExchangeRate();
      if (!quote.available || quote.rate === null || quote.rate <= 0) {
        setError('Conversión a USD no disponible');
        setDisplayCurrency('LOCAL');
        window.sessionStorage.setItem(CURRENCY_PREFERENCE_KEY, 'LOCAL');
        return;
      }

      setExchangeRate(quote);
      setDisplayCurrency('USD');
      window.sessionStorage.setItem(CURRENCY_PREFERENCE_KEY, 'USD');
    } catch {
      setError('No pudimos cargar la cotización');
      setDisplayCurrency('LOCAL');
      window.sessionStorage.setItem(CURRENCY_PREFERENCE_KEY, 'LOCAL');
    } finally {
      setLoading(false);
    }
  }, [currentUser?.tenantId]);

  useEffect(() => {
    if (!currentUser?.tenantId || window.sessionStorage.getItem(CURRENCY_PREFERENCE_KEY) !== 'USD') return;

    getUsdExchangeRate()
      .then(quote => {
        if (!quote.available || quote.rate === null || quote.rate <= 0) {
          window.sessionStorage.setItem(CURRENCY_PREFERENCE_KEY, 'LOCAL');
          return;
        }

        setExchangeRate(quote);
        setDisplayCurrency('USD');
      })
      .catch(() => window.sessionStorage.setItem(CURRENCY_PREFERENCE_KEY, 'LOCAL'));
  }, [currentUser?.tenantId]);

  const toggleCurrency = useCallback(() => {
    if (displayCurrency === 'USD') {
      setDisplayCurrency('LOCAL');
      setError(null);
      window.sessionStorage.setItem(CURRENCY_PREFERENCE_KEY, 'LOCAL');
      return;
    }

    void activateUsd();
  }, [activateUsd, displayCurrency]);

  const formatAmount = useCallback(
    (value: number) => formatMoney(activeRate ? convertLocalToUsd(value, activeRate) : value, activeCurrency),
    [activeCurrency, activeRate],
  );

  return useMemo(
    () => ({
      displayCurrency,
      localCurrency,
      activeCurrency,
      activeRate,
      exchangeRate,
      loading,
      error,
      canConvert,
      toggleCurrency,
      formatAmount,
    }),
    [
      activeCurrency,
      activeRate,
      canConvert,
      displayCurrency,
      error,
      exchangeRate,
      formatAmount,
      loading,
      localCurrency,
      toggleCurrency,
    ],
  );
}
