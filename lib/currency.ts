export function convertLocalToUsd(value: number, rate: number): number {
  if (!Number.isFinite(rate) || rate <= 0) throw new Error('La cotización debe ser mayor a cero');
  return value / rate;
}

export function formatMoney(value: number, currencyCode: string): string {
  return new Intl.NumberFormat('es', {
    style: 'currency',
    currency: currencyCode,
    maximumFractionDigits: currencyCode === 'USD' ? 2 : 0,
  }).format(value);
}

/** Igual que `formatMoney`, pero separa el importe del código/símbolo de moneda para poder estilarlos aparte. */
export function formatMoneyParts(value: number, currencyCode: string): { amount: string; symbol: string } {
  const parts = new Intl.NumberFormat('es', {
    style: 'currency',
    currency: currencyCode,
    maximumFractionDigits: currencyCode === 'USD' ? 2 : 0,
  }).formatToParts(value);
  return {
    amount: parts.filter(p => p.type !== 'currency').map(p => p.value).join('').trim(),
    symbol: parts.filter(p => p.type === 'currency').map(p => p.value).join(''),
  };
}
