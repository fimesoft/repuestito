const BASE = `${process.env.NEXT_PUBLIC_API_URL}/api/stats`;

export interface SaleDay { date: string; total: number }

export interface DashboardStats {
  users: { total: number; active: number };
  brands: { total: number; active: number };
  replacements: { total: number; active: number; inactive: number; inventoryValue?: number };
  orders: { total: number; pending: number; confirmed: number; fulfilled: number; cancelled: number };
  invoices: { total: number };
  compatibilities: { total: number; topModels: { model: string; brand: string; count: number }[] };
}

export async function getSalesTimeline(days: number): Promise<SaleDay[]> {
  const res = await fetch(`${BASE}/sales?days=${days}`, { credentials: 'include', cache: 'no-store' });
  if (!res.ok) throw new Error('Error al cargar ventas');
  return res.json() as Promise<SaleDay[]>;
}

export async function getDashboardStats(): Promise<DashboardStats> {
  const res = await fetch(`${BASE}/dashboard`, { credentials: 'include', cache: 'no-store' });
  if (!res.ok) throw new Error('Error al cargar estadísticas');
  return res.json() as Promise<DashboardStats>;
}
