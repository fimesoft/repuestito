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
