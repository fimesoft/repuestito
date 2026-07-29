export interface InvoiceItem {
  id: string;
  replacementId: string;
  description: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
}

export interface Invoice {
  id: string;
  tenantId: string;
  invoiceNumber: string;
  buyerName: string | null;
  buyerLastname: string | null;
  buyerDoc: string | null;
  buyerPhone: string | null;
  customerId: string | null;
  paymentMethod: string;
  status: string;
  subtotal: number;
  taxRate: number;
  taxAmount: number;
  total: number;
  notes: string | null;
  issuedAt: string;
  cancelledAt: string | null;
  items?: InvoiceItem[];
}

export interface CreateInvoicePayload {
  tenantId: string;
  branchId?: string;
  sellerId?: string;
  customerId?: string;
  buyerName?: string;
  buyerLastname?: string;
  buyerDoc?: string;
  buyerPhone?: string;
  paymentMethod?: string;
  taxRate?: number;
  notes?: string;
  items: {
    replacementId: string;
    description: string;
    quantity: number;
    unitPrice: number;
  }[];
}

const BASE = `${process.env.NEXT_PUBLIC_API_URL}/api/invoices`;

function throwFromResponse(data: unknown, fallback: string): never {
  throw new Error(
    data && typeof data === 'object' && 'message' in data
      ? String((data as { message: unknown }).message)
      : fallback,
  );
}

export async function createInvoice(payload: CreateInvoicePayload): Promise<Invoice> {
  const res = await fetch(BASE, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(payload),
  });
  if (!res.ok) throwFromResponse(await res.json(), 'Error al crear la factura');
  return res.json() as Promise<Invoice>;
}

export async function getInvoice(id: string, tenantId: string): Promise<Invoice> {
  const params = new URLSearchParams({ tenantId });
  const res = await fetch(`${BASE}/${id}?${params.toString()}`, {
    credentials: 'include',
  });
  if (!res.ok) throw new Error('Error al obtener la factura');
  return res.json() as Promise<Invoice>;
}

export async function getInvoices(params: {
  tenantId: string;
  from?: string;
  to?: string;
  page?: number;
  limit?: number;
}): Promise<{ data: Invoice[]; total: number }> {
  const qs = new URLSearchParams({ tenantId: params.tenantId });
  if (params.from) qs.set('from', params.from);
  if (params.to) qs.set('to', params.to);
  if (params.page != null) qs.set('page', String(params.page));
  if (params.limit != null) qs.set('limit', String(params.limit));

  const res = await fetch(`${BASE}?${qs.toString()}`, { credentials: 'include' });
  if (!res.ok) throw new Error('Error al obtener las facturas');
  return res.json() as Promise<{ data: Invoice[]; total: number }>;
}

export async function cancelInvoice(id: string, tenantId: string): Promise<Invoice> {
  const res = await fetch(`${BASE}/${id}/cancel`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ tenantId }),
  });
  if (!res.ok) throwFromResponse(await res.json(), 'Error al cancelar la factura');
  return res.json() as Promise<Invoice>;
}

export async function getInvoiceSummary(
  tenantId: string,
  from: string,
  to: string,
): Promise<{ total: number; count: number; topItems: { description: string; quantity: number }[] }> {
  const qs = new URLSearchParams({ tenantId, from, to });
  const res = await fetch(`${BASE}/summary?${qs.toString()}`, { credentials: 'include' });
  if (!res.ok) throw new Error('Error al obtener el resumen de facturación');
  return res.json() as Promise<{ total: number; count: number; topItems: { description: string; quantity: number }[] }>;
}
