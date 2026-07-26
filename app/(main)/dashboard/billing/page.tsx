'use client';

import { useReducer, useState, useCallback } from 'react';
import { usePermissions } from '@/hooks/usePermissions';
import { getReplacements, Replacement } from '@/services/replacement.service';
import { searchCustomers, Customer } from '@/services/customers.service';
import { createInvoice, Invoice } from '@/services/billing.service';
import styles from './page.module.css';

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
          i.replacementId === action.item.replacementId
            ? { ...i, quantity: i.quantity + 1 }
            : i,
        );
      }
      return [...state, { ...action.item, quantity: 1 }];
    }
    case 'UPDATE_QTY':
      return state.map(i =>
        i.replacementId === action.replacementId
          ? { ...i, quantity: action.quantity }
          : i,
      );
    case 'REMOVE':
      return state.filter(i => i.replacementId !== action.replacementId);
    case 'CLEAR':
      return [];
    default:
      return state;
  }
}

export default function BillingPOSPage() {
  const { currentUser } = usePermissions();

  const [search, setSearch] = useState('');
  const [results, setResults] = useState<Replacement[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);

  const [cart, dispatch] = useReducer(cartReducer, []);

  const [customerQuery, setCustomerQuery] = useState('');
  const [customerSuggestions, setCustomerSuggestions] = useState<Customer[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [buyerName, setBuyerName] = useState('');
  const [buyerDoc, setBuyerDoc] = useState('');
  const [buyerPhone, setBuyerPhone] = useState('');

  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [taxRate, setTaxRate] = useState(0);
  const [notes, setNotes] = useState('');

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmedInvoice, setConfirmedInvoice] = useState<Invoice | null>(null);

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
  }, [currentUser?.tenantId]);

  const selectCustomer = (c: Customer) => {
    setSelectedCustomer(c);
    setCustomerQuery(c.name);
    setCustomerSuggestions([]);
    setBuyerName(c.name);
    setBuyerDoc(c.doc ?? '');
    setBuyerPhone(c.phone ?? '');
  };

  const subtotal = cart.reduce((s, i) => s + i.unitPrice * i.quantity, 0);
  const taxAmount = subtotal * taxRate / 100;
  const total = subtotal + taxAmount;

  async function handleSubmit() {
    if (!currentUser?.tenantId) { setError('Sin tenant'); return; }
    if (cart.length === 0) { setError('El carrito está vacío'); return; }
    setSubmitting(true);
    setError(null);
    try {
      const invoice = await createInvoice({
        tenantId: currentUser.tenantId,
        sellerId: currentUser.id,
        customerId: selectedCustomer?.id,
        buyerName: buyerName || undefined,
        buyerDoc: buyerDoc || undefined,
        buyerPhone: buyerPhone || undefined,
        paymentMethod,
        taxRate,
        notes: notes || undefined,
        items: cart.map(i => ({
          replacementId: i.replacementId,
          description: i.name,
          quantity: i.quantity,
          unitPrice: i.unitPrice,
        })),
      });
      setConfirmedInvoice(invoice);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al emitir la factura');
    } finally {
      setSubmitting(false);
    }
  }

  function handleNewSale() {
    dispatch({ type: 'CLEAR' });
    setSearch('');
    setResults([]);
    setCustomerQuery('');
    setSelectedCustomer(null);
    setBuyerName('');
    setBuyerDoc('');
    setBuyerPhone('');
    setPaymentMethod('cash');
    setTaxRate(0);
    setNotes('');
    setError(null);
    setConfirmedInvoice(null);
  }

  if (confirmedInvoice) {
    return (
      <main className={styles.page}>
        <div className={styles.confirmation}>
          <div className={styles.confirmIcon}>✓</div>
          <h2 className={styles.confirmTitle}>Factura emitida</h2>
          <p className={styles.confirmNumber}>{confirmedInvoice.invoiceNumber}</p>
          <p className={styles.confirmTotal}>Total: ${Number(confirmedInvoice.total).toFixed(2)}</p>
          <div className={styles.confirmActions}>
            <button className={styles.btnPrint} onClick={() => window.print()}>Imprimir</button>
            <button className={styles.btnPrimary} onClick={handleNewSale}>Nueva venta</button>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className={styles.page}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Punto de venta</h1>
          <p className={styles.subtitle}>Facturación rápida de repuestos</p>
        </div>
      </div>

      <div className={styles.panels}>
        {/* Left panel — product search */}
        <div className={styles.leftPanel}>
          <div className={styles.searchBox}>
            <input
              className={styles.input}
              placeholder="Buscar repuesto..."
              value={search}
              onChange={e => handleSearch(e.target.value)}
            />
          </div>

          {searchLoading && <p className={styles.hint}>Buscando...</p>}

          {results.length > 0 && (
            <div className={styles.resultList}>
              {results.map(r => (
                <div key={r.id} className={styles.resultItem}>
                  <div className={styles.resultInfo}>
                    <span className={styles.resultName}>{r.globalReplacement?.name}</span>
                    <span className={styles.resultMeta}>${Number(r.price).toFixed(2)} · Stock: {r.stock}</span>
                  </div>
                  <button
                    className={styles.btnAdd}
                    disabled={r.stock === 0}
                    onClick={() => dispatch({
                      type: 'ADD',
                      item: {
                        replacementId: r.id,
                        name: r.globalReplacement?.name ?? r.id,
                        unitPrice: Number(r.price),
                      },
                    })}
                  >
                    + Agregar
                  </button>
                </div>
              ))}
            </div>
          )}

          {!searchLoading && search && results.length === 0 && (
            <p className={styles.hint}>Sin resultados.</p>
          )}
        </div>

        {/* Right panel — cart + buyer info */}
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
                      {c.name}{c.doc ? ` · ${c.doc}` : ''}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div className={styles.fieldGroup}>
              <input className={styles.input} placeholder="Nombre" value={buyerName} onChange={e => setBuyerName(e.target.value)} />
              <input className={styles.input} placeholder="Documento" value={buyerDoc} onChange={e => setBuyerDoc(e.target.value)} />
              <input className={styles.input} placeholder="Teléfono" value={buyerPhone} onChange={e => setBuyerPhone(e.target.value)} />
            </div>
          </div>

          <div className={styles.section}>
            <label className={styles.fieldLabel}>
              Método de pago
              <select className={styles.select} value={paymentMethod} onChange={e => setPaymentMethod(e.target.value)}>
                <option value="cash">Efectivo</option>
                <option value="transfer">Transferencia</option>
                <option value="card">Tarjeta</option>
              </select>
            </label>
            <label className={styles.fieldLabel}>
              IVA (%)
              <input
                className={styles.input}
                type="number"
                min={0}
                max={100}
                value={taxRate}
                onChange={e => setTaxRate(parseFloat(e.target.value) || 0)}
              />
            </label>
            <label className={styles.fieldLabel}>
              Notas
              <textarea className={styles.textarea} rows={2} value={notes} onChange={e => setNotes(e.target.value)} />
            </label>
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
            onClick={handleSubmit}
          >
            {submitting ? 'Emitiendo...' : 'Emitir factura'}
          </button>
        </div>
      </div>
    </main>
  );
}
