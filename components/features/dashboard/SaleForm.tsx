'use client';

import { useReducer, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { usePermissions } from '@/hooks/usePermissions';
import { useStockThresholds } from '@/hooks/useStockThresholds';
import { getReplacements, Replacement } from '@/services/replacement.service';
import { searchCustomers, Customer } from '@/services/customers.service';
import { createInvoice } from '@/services/billing.service';
import { createOrder } from '@/services/orders.service';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import BackPage from '@/components/shared/BackPage';
import Confirm from '@/components/shared/Confirm';
import { getStockLevel, StockLevel } from '@/constants/replacement';
import styles from '@/app/(main)/dashboard/billing/page.module.css';
import Label from '@/components/ui/Label';

const STOCK_COLOR_CLASS: Record<StockLevel, string> = {
  low: 'stockLow',
  normal: 'stockNormal',
  full: 'stockFull',
};

type CartItem = {
  replacementId: string;
  name: string;
  unitPrice: number;
  quantity: number;
};

type CartAction =
  | { type: 'ADD'; item: Omit<CartItem, 'quantity'> }
  | { type: 'UPDATE_QTY'; replacementId: string; quantity: number }
  | { type: 'REMOVE'; replacementId: string }
  | { type: 'CLEAR' };

function cartReducer(state: CartItem[], action: CartAction): CartItem[] {
  switch (action.type) {
    case 'ADD': {
      const existing = state.find(i => i.replacementId === action.item.replacementId);
      if (existing) {
        return state.map(i =>
          i.replacementId === action.item.replacementId ? { ...i, quantity: i.quantity + 1 } : i,
        );
      }
      return [...state, { ...action.item, quantity: 1 }];
    }
    case 'UPDATE_QTY':
      return state.map(i =>
        i.replacementId === action.replacementId ? { ...i, quantity: action.quantity } : i,
      );
    case 'REMOVE':
      return state.filter(i => i.replacementId !== action.replacementId);
    case 'CLEAR':
      return [];
    default:
      return state;
  }
}

interface SaleFormProps {
  mode: 'invoice' | 'order';
}

interface ConfirmedResult {
  number: string;
  total: number;
}

export default function SaleForm({ mode }: SaleFormProps) {
  const { currentUser } = usePermissions();
  const stockThresholds = useStockThresholds();
  const router = useRouter();

  const [search, setSearch] = useState('');
  const [results, setResults] = useState<Replacement[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);

  const [cart, dispatch] = useReducer(cartReducer, []);

  const [customerQuery, setCustomerQuery] = useState('');
  const [customerSuggestions, setCustomerSuggestions] = useState<Customer[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [buyerName, setBuyerName] = useState('');
  const [buyerLastname, setBuyerLastname] = useState('');
  const [buyerDoc, setBuyerDoc] = useState('');
  const [buyerPhone, setBuyerPhone] = useState('');

  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [taxRate, setTaxRate] = useState(0);
  const [notes, setNotes] = useState('');

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmed, setConfirmed] = useState<ConfirmedResult | null>(null);
  const [createConfirmOpen, setCreateConfirmOpen] = useState(false);

  const handleSearch = useCallback(async (q: string) => {
    setSearch(q);
    if (!q.trim()) { setResults([]); return; }
    setSearchLoading(true);
    try {
      const res = await getReplacements({ search: q, limit: 10 });
      setResults(res.data);
    } finally {
      setSearchLoading(false);
    }
  }, []);

  const handleCustomerSearch = useCallback(async (q: string) => {
    setCustomerQuery(q);
    setSelectedCustomer(null);
    if (!q.trim() || !currentUser?.tenantId) { setCustomerSuggestions([]); return; }
    try {
      const list = await searchCustomers(currentUser.tenantId, q);
      setCustomerSuggestions(list);
    } catch {
      setCustomerSuggestions([]);
    }
  }, [currentUser]);

  const selectCustomer = (c: Customer) => {
    setSelectedCustomer(c);
    setCustomerQuery(c.name);
    setCustomerSuggestions([]);
    setBuyerName(c.name);
    setBuyerLastname(c.lastname ?? '');
    setBuyerDoc(c.doc ?? '');
    setBuyerPhone(c.phone ?? '');
  };

  const subtotal = cart.reduce((s, i) => s + i.unitPrice * i.quantity, 0);
  const taxAmount = subtotal * taxRate / 100;
  const total = subtotal + taxAmount;

  async function handleSubmit(): Promise<boolean> {
    if (!currentUser?.tenantId) { setError('Sin tenant'); return false; }
    if (cart.length === 0) { setError('El carrito está vacío'); return false; }
    setSubmitting(true);
    setError(null);

    const commonPayload = {
      tenantId: currentUser.tenantId,
      sellerId: currentUser.id,
      customerId: selectedCustomer?.id,
      buyerName: buyerName || undefined,
      buyerLastname: buyerLastname || undefined,
      buyerDoc: buyerDoc || undefined,
      buyerPhone: buyerPhone || undefined,
      taxRate,
      notes: notes || undefined,
      items: cart.map(i => ({
        replacementId: i.replacementId,
        description: i.name,
        quantity: i.quantity,
        unitPrice: i.unitPrice,
      })),
    };

    try {
      if (mode === 'invoice') {
        const inv = await createInvoice({ ...commonPayload, paymentMethod });
        setConfirmed({ number: inv.invoiceNumber, total: Number(inv.total) });
      } else {
        const ord = await createOrder(commonPayload);
        setConfirmed({ number: ord.orderNumber, total: Number(ord.total) });
      }
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al procesar');
      return false;
    } finally {
      setSubmitting(false);
    }
  }

  function handleReset() {
    dispatch({ type: 'CLEAR' });
    setSearch(''); setResults([]);
    setCustomerQuery(''); setSelectedCustomer(null);
    setBuyerName(''); setBuyerLastname(''); setBuyerDoc(''); setBuyerPhone('');
    setPaymentMethod('cash'); setTaxRate(0); setNotes('');
    setError(null); setConfirmed(null);
  }

  if (confirmed && mode === 'invoice') {
    return (
      <main className={styles.page}>
        <div className={styles.confirmation}>
          <div className={styles.confirmIcon}>✓</div>
          <h2 className={styles.confirmTitle}>
            {mode === 'invoice' ? 'Factura emitida' : 'Pedido creado'}
          </h2>
          <p className={styles.confirmNumber}>{confirmed.number}</p>
          <p className={styles.confirmTotal}>Total: ${confirmed.total.toFixed(2)}</p>
          <div className={styles.confirmActions}>
            {mode === 'invoice' ? (
              <>
                <button className={styles.btnPrint} onClick={() => router.push('/dashboard/billing')}>Ver facturas</button>
                <button className={styles.btnPrimary} onClick={handleReset}>Nueva venta</button>
              </>
            ) : (
              <>
                <button className={styles.btnPrint} onClick={() => router.push('/dashboard/orders')}>Ver pedidos</button>
                <button className={styles.btnPrimary} onClick={handleReset}>Nuevo pedido</button>
              </>
            )}
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className={styles.page}>
      <BackPage href={mode === 'invoice' ? '/dashboard/billing' : '/dashboard/orders'} />
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>
            {mode === 'invoice' ? 'Punto de venta' : 'Nuevo pedido'}
          </h1>
          <p className={styles.subtitle}>
            {mode === 'invoice' ? 'Facturación rápida de productos' : 'El stock se descuenta al crear el pedido'}
          </p>
        </div>
      </div>

      <div className={styles.panels}>
        <div className={styles.leftPanel}>
          <div className={styles.searchBox}>
            <input
              className={styles.input}
              placeholder="Buscar producto..."
              value={search}
              onChange={e => handleSearch(e.target.value)}
            />
          </div>

          {searchLoading && <p className={styles.hint}>Buscando...</p>}

          {results.length > 0 && (
            <div className={styles.resultsGrid}>
              {results.map(r => (
                <Card key={r.id} className={styles.resultCard}>
                  <div className={styles.resultImageWrapper}>
                    {r.globalReplacement?.imageUrl ? (
                      <Image
                        src={r.globalReplacement.imageUrl}
                        alt={r.globalReplacement.name}
                        fill
                        sizes="160px"
                        className={styles.resultImage}
                      />
                    ) : (
                      <div className={styles.resultImagePlaceholder} />
                    )}
                  </div>
                  <div className={styles.resultInfo}>
                    <span className={styles.resultName}>{r.globalReplacement?.name}</span>
                    <span className={styles.resultMeta}>Precio: ${Number(r.price).toFixed(2)}</span>
                    <span className={styles.resultMeta}>
                      Stock: <span className={styles[STOCK_COLOR_CLASS[getStockLevel(r.stock, stockThresholds)]]}>{r.stock}</span>
                    </span>
                  </div>
                  <Button
                    label="+ Agregar"
                    size="sm"
                    variant="outline"
                    fullWidth
                    disabled={r.stock === 0}
                    onClick={() => dispatch({
                      type: 'ADD',
                      item: { replacementId: r.id, name: r.globalReplacement?.name ?? r.id, unitPrice: Number(r.price) },
                    })}
                  />
                </Card>
              ))}
            </div>
          )}

          {!searchLoading && search && results.length === 0 && (
            <p className={styles.hint}>Sin resultados.</p>
          )}
        </div>

        <div className={styles.rightPanel}>
          <h2 className={styles.panelTitle}>Carrito</h2>

          {cart.length === 0 ? (
            <p className={styles.hint}>Sin ítems.</p>
          ) : (
            <table className={styles.cartTable}>
              <thead>
                <tr>
                  <th>Producto</th>
                  <th>Precio</th>
                  <th>Qty</th>
                  <th>Total</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {cart.map(item => (
                  <tr key={item.replacementId}>
                    <td className={styles.cartName}>{item.name}</td>
                    <td>${item.unitPrice.toFixed(2)}</td>
                    <td>
                      <div className={styles.qtyControls}>
                        <button
                          className={styles.qtyBtn}
                          onClick={() => {
                            if (item.quantity <= 1) dispatch({ type: 'REMOVE', replacementId: item.replacementId });
                            else dispatch({ type: 'UPDATE_QTY', replacementId: item.replacementId, quantity: item.quantity - 1 });
                          }}
                        >−</button>
                        <span>{item.quantity}</span>
                        <button
                          className={styles.qtyBtn}
                          onClick={() => dispatch({ type: 'UPDATE_QTY', replacementId: item.replacementId, quantity: item.quantity + 1 })}
                        >+</button>
                      </div>
                    </td>
                    <td>${(item.unitPrice * item.quantity).toFixed(2)}</td>
                    <td>
                      <button
                        className={styles.btnRemove}
                        onClick={() => dispatch({ type: 'REMOVE', replacementId: item.replacementId })}
                      >×</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          <div className={styles.section}>
            <h3 className={styles.sectionTitle}>Cliente</h3>
            <div className={styles.customerSearch}>
              <input
                className={styles.input}
                placeholder="Buscar cliente existente..."
                value={customerQuery}
                onChange={e => handleCustomerSearch(e.target.value)}
              />
              {customerSuggestions.length > 0 && (
                <div className={styles.suggestions}>
                  {customerSuggestions.map(c => (
                    <button key={c.id} className={styles.suggestion} onClick={() => selectCustomer(c)}>
                      {c.name}{c.lastname ? ` ${c.lastname}` : ''}{c.doc ? ` · ${c.doc}` : ''}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div className={styles.fieldGroup}>
              <input className={styles.input} placeholder="Nombre" value={buyerName} onChange={e => setBuyerName(e.target.value)} />
              <input className={styles.input} placeholder="Apellido" value={buyerLastname} onChange={e => setBuyerLastname(e.target.value)} />
              <input className={styles.input} placeholder="Documento" value={buyerDoc} onChange={e => setBuyerDoc(e.target.value)} />
              <input className={styles.input} placeholder="Teléfono" value={buyerPhone} onChange={e => setBuyerPhone(e.target.value)} />
            </div>
          </div>

          <div className={styles.section}>
            {mode === 'invoice' && (
              <Label text="Método de pago">
                <select className={styles.select} value={paymentMethod} onChange={e => setPaymentMethod(e.target.value)}>
                  <option value="cash">Efectivo</option>
                  <option value="transfer">Transferencia</option>
                  <option value="card">Tarjeta</option>
                </select>
              </Label>
            )}
            <Label text="IVA (%)">
              <input
                className={styles.input}
                type="number"
                min={0}
                max={100}
                value={taxRate}
                onChange={e => setTaxRate(parseFloat(e.target.value) || 0)}
              />
            </Label>
            <Label text="Notas">
              <textarea className={styles.textarea} rows={2} value={notes} onChange={e => setNotes(e.target.value)} />
            </Label>
          </div>

          <div className={styles.totals}>
            <div className={styles.totalRow}><span>Subtotal</span><span>${subtotal.toFixed(2)}</span></div>
            <div className={styles.totalRow}><span>IVA ({taxRate}%)</span><span>${taxAmount.toFixed(2)}</span></div>
            <div className={`${styles.totalRow} ${styles.totalFinal}`}><span>Total</span><span>${total.toFixed(2)}</span></div>
          </div>

          {error && <p className={styles.error}>{error}</p>}

          <button
            className={styles.btnSubmit}
            disabled={submitting || cart.length === 0}
            onClick={() => {
              if (mode === 'order') setCreateConfirmOpen(true);
              else void handleSubmit();
            }}
          >
            {submitting
              ? (mode === 'invoice' ? 'Emitiendo...' : 'Creando...')
              : (mode === 'invoice' ? 'Emitir factura' : 'Crear pedido')}
          </button>
        </div>
      </div>

      {mode === 'order' && (
        <Confirm
          isOpen={createConfirmOpen}
          onClose={() => setCreateConfirmOpen(false)}
          onSuccess={() => router.push('/dashboard/orders')}
          onConfirm={handleSubmit}
          isLoading={submitting}
          title="Crear pedido"
          message={`¿Estás seguro de que querés crear este pedido por un total de $${total.toFixed(2)}?`}
          confirmLabel="Crear pedido"
          loadingLabel="Creando pedido…"
          successTitle="Pedido creado"
          successMessage={confirmed
            ? `${confirmed.number} fue creado correctamente. Total: $${confirmed.total.toFixed(2)}`
            : 'El pedido fue creado correctamente.'}
          successDuration={1800}
        />
      )}
    </main>
  );
}
