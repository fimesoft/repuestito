export interface OrderItem {
  id: string;
  replacementId: string;
  description: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
}

export interface Order {
  id: string;
  tenantId: string;
  orderNumber: string;
  buyerName: string | null;
  buyerLastname: string | null;
  buyerDoc: string | null;
  buyerPhone: string | null;
  customerId: string | null;
  status: 'pending' | 'confirmed' | 'fulfilled' | 'cancelled';
  subtotal: number;
  taxRate: number;
  taxAmount: number;
  total: number;
  notes: string | null;
  invoiceId: string | null;
  createdAt: string;
  fulfilledAt: string | null;
  cancelledAt: string | null;
  items?: OrderItem[];
}

export interface CreateOrderPayload {
  branchId?: string;
  customerId?: string;
  buyerName?: string;
  buyerLastname?: string;
  buyerDoc?: string;
  buyerPhone?: string;
  taxRate?: number;
  notes?: string;
  items: {
    replacementId: string;
    description: string;
    quantity: number;
    unitPrice: number;
  }[];
}

const BASE = `${process.env.NEXT_PUBLIC_API_URL}/api/orders`;

function throwFromResponse(data: unknown, fallback: string): never {
  throw new Error(
    data && typeof data === 'object' && 'message' in data
      ? String((data as { message: unknown }).message)
      : fallback,
  );
}

export async function createOrder(payload: CreateOrderPayload): Promise<Order> {
  const res = await fetch(BASE, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(payload),
  });
  if (!res.ok) throwFromResponse(await res.json(), 'Error al crear el pedido');
  return res.json() as Promise<Order>;
}

export async function getOrder(id: string): Promise<Order> {
  const res = await fetch(`${BASE}/${id}`, { credentials: 'include' });
  if (!res.ok) throw new Error('Error al obtener el pedido');
  return res.json() as Promise<Order>;
}

export async function getOrders(params: {
  status?: string;
  from?: string;
  to?: string;
  page?: number;
  limit?: number;
}): Promise<{ data: Order[]; total: number }> {
  const qs = new URLSearchParams();
  if (params.status) qs.set('status', params.status);
  if (params.from) qs.set('from', params.from);
  if (params.to) qs.set('to', params.to);
  if (params.page != null) qs.set('page', String(params.page));
  if (params.limit != null) qs.set('limit', String(params.limit));

  const res = await fetch(`${BASE}?${qs.toString()}`, { credentials: 'include' });
  if (!res.ok) throw new Error('Error al obtener los pedidos');
  return res.json() as Promise<{ data: Order[]; total: number }>;
}

export async function confirmOrder(id: string): Promise<{ id: string; status: string }> {
  const res = await fetch(`${BASE}/${id}/confirm`, { method: 'PATCH', credentials: 'include' });
  if (!res.ok) throwFromResponse(await res.json(), 'Error al confirmar el pedido');
  return res.json() as Promise<{ id: string; status: string }>;
}

export async function fulfillOrder(id: string): Promise<{ id: string; status: string }> {
  const res = await fetch(`${BASE}/${id}/fulfill`, { method: 'POST', credentials: 'include' });
  if (!res.ok) throwFromResponse(await res.json(), 'Error al convertir pedido a factura');
  return res.json() as Promise<{ id: string; status: string }>;
}

export async function confirmOrderAndGenerateInvoice(id: string): Promise<Order> {
  try {
    await confirmOrder(id);
  } catch (error) {
    const current = await getOrder(id);
    if (current.status !== 'confirmed') throw error;
  }
  await fulfillOrder(id);
  return getOrder(id);
}

export async function cancelOrder(id: string): Promise<Order> {
  const res = await fetch(`${BASE}/${id}/cancel`, { method: 'PATCH', credentials: 'include' });
  if (!res.ok) throwFromResponse(await res.json(), 'Error al cancelar el pedido');
  return res.json() as Promise<Order>;
}
