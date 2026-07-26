export interface Customer {
  id: string;
  tenantId: string;
  name: string;
  doc: string | null;
  phone: string | null;
  email: string | null;
  notes?: string | null;
  createdAt?: string;
}

export async function searchCustomers(tenantId: string, q: string): Promise<Customer[]> {
  const params = new URLSearchParams({ tenantId, q });
  const res = await fetch(
    `${process.env.NEXT_PUBLIC_API_URL}/api/customers?${params.toString()}`,
    { credentials: 'include' },
  );
  if (!res.ok) throw new Error('Error al buscar clientes');
  return res.json() as Promise<Customer[]>;
}

export async function getCustomersByTenant(tenantId: string): Promise<Customer[]> {
  const params = new URLSearchParams({ tenantId });
  const res = await fetch(
    `${process.env.NEXT_PUBLIC_API_URL}/api/customers?${params.toString()}`,
    { credentials: 'include' },
  );
  if (!res.ok) throw new Error('Error al obtener clientes');
  return res.json() as Promise<Customer[]>;
}

export async function createCustomer(
  payload: Omit<Customer, 'id'>,
): Promise<Customer> {
  const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/customers`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const data: unknown = await res.json();
    throw new Error(
      data && typeof data === 'object' && 'message' in data
        ? String((data as { message: unknown }).message)
        : 'Error al crear cliente',
    );
  }
  return res.json() as Promise<Customer>;
}
