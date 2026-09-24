const BASE = `${process.env.NEXT_PUBLIC_API_URL}/api/exchange-rate`;

export interface ExchangeRate {
  fromCurrency: string;
  toCurrency: 'USD';
  rate: number | null;
  source: string | null;
  updatedAt: string | null;
  available: boolean;
  stale?: boolean;
}

export async function getUsdExchangeRate(): Promise<ExchangeRate> {
  const res = await fetch(`${BASE}/usd`, { credentials: 'include', cache: 'no-store' });
  if (!res.ok) throw new Error('No se pudo obtener la cotización');
  return res.json() as Promise<ExchangeRate>;
}
