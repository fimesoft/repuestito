# Facturación — Plan de trabajo

> Creado: julio 2026. Pendiente de implementación.

---

## Objetivo

Registrar las ventas de repuestos mediante un flujo completo de facturación: un comprobante (`invoice`) agrupa uno o varios repuestos vendidos en una sola transacción, se asocia a un comprador, descuenta stock de forma atómica y genera un comprobante imprimible. Las tablas crecerán de forma exponencial, por lo que se particionan por `tenant_id` usando `PARTITION BY LIST`.

---

## Modelo de datos

### `invoices` — cabecera del comprobante (particionada)

```sql
CREATE TABLE invoices (
    id              UUID          DEFAULT gen_random_uuid(),
    tenant_id       UUID          NOT NULL,                        -- clave de partición
    branch_id       UUID          REFERENCES branches(id)  ON DELETE SET NULL,
    seller_id       UUID          REFERENCES users(id)     ON DELETE SET NULL,
    customer_id     UUID          REFERENCES customers(id, tenant_id) ON DELETE SET NULL, -- opcional

    -- Datos del comprador (snapshot desnormalizado; se guarda aunque no haya customer_id)
    buyer_name      VARCHAR(120),
    buyer_doc       VARCHAR(30),                                   -- cédula / RIF / DNI
    buyer_phone     VARCHAR(30),

    invoice_number  VARCHAR(30)   NOT NULL,                        -- correlativo por tenant: INV-00001
    payment_method  VARCHAR(30)   NOT NULL DEFAULT 'cash',         -- 'cash' | 'transfer' | 'card'
    status          VARCHAR(20)   NOT NULL DEFAULT 'completed',    -- 'completed' | 'cancelled'
    notes           TEXT,
    subtotal        NUMERIC(12,2) NOT NULL DEFAULT 0,
    tax_rate        NUMERIC(5,2)  NOT NULL DEFAULT 0,              -- porcentaje IVA (ej. 16.00)
    tax_amount      NUMERIC(12,2) GENERATED ALWAYS AS (subtotal * tax_rate / 100) STORED,
    total           NUMERIC(12,2) GENERATED ALWAYS AS (subtotal + subtotal * tax_rate / 100) STORED,
    issued_at       TIMESTAMPTZ   NOT NULL DEFAULT CURRENT_TIMESTAMP,
    cancelled_at    TIMESTAMPTZ,

    PRIMARY KEY (id, tenant_id)   -- tenant_id obligatorio en PK de tablas particionadas
) PARTITION BY LIST (tenant_id);

CREATE TABLE invoices_default PARTITION OF invoices DEFAULT;
```

### `invoice_items` — líneas del comprobante

```sql
CREATE TABLE invoice_items (
    id              UUID          DEFAULT gen_random_uuid() PRIMARY KEY,
    invoice_id      UUID          NOT NULL,
    tenant_id       UUID          NOT NULL,                        -- desnormalizado para JOIN eficiente
    replacement_id  UUID          NOT NULL REFERENCES replacement(id) ON DELETE RESTRICT,
    description     VARCHAR(200)  NOT NULL,                        -- snapshot del nombre al momento de venta
    quantity        INT           NOT NULL CHECK (quantity > 0),
    unit_price      NUMERIC(12,2) NOT NULL,
    line_total      NUMERIC(12,2) GENERATED ALWAYS AS (quantity * unit_price) STORED,

    FOREIGN KEY (invoice_id, tenant_id) REFERENCES invoices (id, tenant_id) ON DELETE CASCADE
);
```

> **Por qué `invoice_items` no está particionada:** siempre se accede via `invoice_id`, nunca directamente por `tenant_id`. El índice en `invoice_id` es suficiente.

### `customers` — compradores recurrentes (particionada)

```sql
CREATE TABLE customers (
    id              UUID          DEFAULT gen_random_uuid(),
    tenant_id       UUID          NOT NULL,                        -- clave de partición
    name            VARCHAR(120)  NOT NULL,
    doc             VARCHAR(30),                                   -- cédula / RIF / DNI
    phone           VARCHAR(30),
    email           VARCHAR(120),
    notes           TEXT,
    created_at      TIMESTAMPTZ   NOT NULL DEFAULT CURRENT_TIMESTAMP,

    PRIMARY KEY (id, tenant_id)
) PARTITION BY LIST (tenant_id);

CREATE TABLE customers_default PARTITION OF customers DEFAULT;
```

> **Por qué guardar los datos del comprador también en `invoices`:**
> Si el comprador se elimina o sus datos cambian, el comprobante histórico debe reflejar lo que era al momento de la venta. El snapshot en `invoices` (`buyer_name`, `buyer_doc`, `buyer_phone`) garantiza inmutabilidad del registro.

### Índices

```sql
-- invoices: búsqueda por fecha dentro de un tenant
CREATE INDEX idx_invoices_tenant_date   ON invoices (tenant_id, issued_at DESC);
-- invoices: búsqueda por número correlativo
CREATE INDEX idx_invoices_number        ON invoices (tenant_id, invoice_number);
-- invoices: facturas por cliente
CREATE INDEX idx_invoices_customer      ON invoices (tenant_id, customer_id) WHERE customer_id IS NOT NULL;
-- invoice_items: líneas de una factura
CREATE INDEX idx_invoice_items_invoice  ON invoice_items (invoice_id);
-- invoice_items: cuánto se vendió de un repuesto en un local
CREATE INDEX idx_invoice_items_replace  ON invoice_items (tenant_id, replacement_id);
-- customers
CREATE INDEX idx_customers_tenant       ON customers (tenant_id, name);
```

---

## Relaciones clave

```
Tenant ──< invoices (particionado por tenant_id)
              │
              ├── customer_id  → customers (particionado por tenant_id)
              ├── branch_id    → branches
              ├── seller_id    → users
              └──< invoice_items
                      └── replacement_id → replacement
```

---

## Por qué `PARTITION BY LIST (tenant_id)`

Cada local tiene un volumen y ritmo de ventas completamente independiente. `LIST` aísla físicamente los datos de cada tenant en su propia partición, por lo que `WHERE tenant_id = $1` realiza un *partition pruning* perfecto — Postgres escanea solo esa partición ignorando el resto.

La partición `_default` captura inserciones de tenants que aún no tienen partición propia (edge case de race condition al registrar un tenant nuevo).

---

## Backend — cambios necesarios (`repuestito-api/src/`)

### Estructura de módulos

```
src/invoices/
  entities/
    invoice.entity.ts
    invoice-item.entity.ts
  dto/
    create-invoice.dto.ts
    invoice-response.dto.ts
  invoices.module.ts
  invoices.service.ts
  invoices.controller.ts

src/customers/
  entities/customer.entity.ts
  dto/
    create-customer.dto.ts
    customer-response.dto.ts
  customers.module.ts
  customers.service.ts
  customers.controller.ts
```

### Migración SQL (raw)

```ts
export class CreateInvoicesPartitioned implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // customers
    await queryRunner.query(`
      CREATE TABLE customers (
        id UUID DEFAULT gen_random_uuid(), tenant_id UUID NOT NULL,
        name VARCHAR(120) NOT NULL, doc VARCHAR(30), phone VARCHAR(30),
        email VARCHAR(120), notes TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (id, tenant_id)
      ) PARTITION BY LIST (tenant_id);
    `);
    await queryRunner.query(`CREATE TABLE customers_default PARTITION OF customers DEFAULT;`);

    // invoices
    await queryRunner.query(`
      CREATE TABLE invoices (
        id UUID DEFAULT gen_random_uuid(), tenant_id UUID NOT NULL,
        branch_id UUID, seller_id UUID, customer_id UUID,
        buyer_name VARCHAR(120), buyer_doc VARCHAR(30), buyer_phone VARCHAR(30),
        invoice_number VARCHAR(30) NOT NULL,
        payment_method VARCHAR(30) NOT NULL DEFAULT 'cash',
        status VARCHAR(20) NOT NULL DEFAULT 'completed',
        notes TEXT, subtotal NUMERIC(12,2) NOT NULL DEFAULT 0,
        tax_rate NUMERIC(5,2) NOT NULL DEFAULT 0,
        tax_amount NUMERIC(12,2) GENERATED ALWAYS AS (subtotal * tax_rate / 100) STORED,
        total NUMERIC(12,2) GENERATED ALWAYS AS (subtotal + subtotal * tax_rate / 100) STORED,
        issued_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
        cancelled_at TIMESTAMPTZ,
        PRIMARY KEY (id, tenant_id)
      ) PARTITION BY LIST (tenant_id);
    `);
    await queryRunner.query(`CREATE TABLE invoices_default PARTITION OF invoices DEFAULT;`);

    // invoice_items
    await queryRunner.query(`
      CREATE TABLE invoice_items (
        id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
        invoice_id UUID NOT NULL, tenant_id UUID NOT NULL,
        replacement_id UUID NOT NULL REFERENCES replacement(id) ON DELETE RESTRICT,
        description VARCHAR(200) NOT NULL,
        quantity INT NOT NULL CHECK (quantity > 0),
        unit_price NUMERIC(12,2) NOT NULL,
        line_total NUMERIC(12,2) GENERATED ALWAYS AS (quantity * unit_price) STORED,
        FOREIGN KEY (invoice_id, tenant_id) REFERENCES invoices (id, tenant_id) ON DELETE CASCADE
      );
    `);

    // índices
    await queryRunner.query(`CREATE INDEX idx_invoices_tenant_date  ON invoices (tenant_id, issued_at DESC);`);
    await queryRunner.query(`CREATE INDEX idx_invoices_number       ON invoices (tenant_id, invoice_number);`);
    await queryRunner.query(`CREATE INDEX idx_invoice_items_invoice ON invoice_items (invoice_id);`);
    await queryRunner.query(`CREATE INDEX idx_invoice_items_replace ON invoice_items (tenant_id, replacement_id);`);
    await queryRunner.query(`CREATE INDEX idx_customers_tenant      ON customers (tenant_id, name);`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS invoice_items CASCADE;`);
    await queryRunner.query(`DROP TABLE IF EXISTS invoices CASCADE;`);
    await queryRunner.query(`DROP TABLE IF EXISTS customers CASCADE;`);
  }
}
```

### Al registrar un Tenant — crear particiones + secuencia correlativa

```ts
const safe = tenant.id.replace(/-/g, '');
await queryRunner.query(`CREATE TABLE IF NOT EXISTS invoices_tenant_${safe} PARTITION OF invoices FOR VALUES IN ('${tenant.id}');`);
await queryRunner.query(`CREATE TABLE IF NOT EXISTS customers_tenant_${safe} PARTITION OF customers FOR VALUES IN ('${tenant.id}');`);
await queryRunner.query(`CREATE SEQUENCE IF NOT EXISTS invoice_seq_${safe} START 1;`);
```

### `InvoicesService` — métodos principales

```ts
// Crear factura: inserta cabecera + líneas + descuenta stock en una sola transacción
async create(dto: CreateInvoiceDto): Promise<Invoice>

// Listado paginado por tenant (partition pruning automático)
async findByTenant(tenantId: string, filters: { from?: Date; to?: Date; customerId?: string; page: number; limit: number })

// Detalle con líneas
async findOne(id: string, tenantId: string): Promise<Invoice>

// Cancelar: restaura stock de cada línea
async cancel(id: string, tenantId: string): Promise<Invoice>

// Resumen: total facturado, cantidad de facturas, top productos
async summary(tenantId: string, from: Date, to: Date): Promise<InvoiceSummary>
```

**Transacción de creación:**

```ts
// 1. Generar número correlativo
const seq = await queryRunner.query(`SELECT nextval('invoice_seq_${safe}') AS n`);
const invoiceNumber = `INV-${String(seq[0].n).padStart(5, '0')}`;

// 2. Insertar cabecera con subtotal calculado desde las líneas del DTO
// 3. Insertar invoice_items
// 4. Descontar stock por cada línea (rollback si stock insuficiente)
await queryRunner.query(
  `UPDATE replacement SET stock = stock - $1 WHERE id = $2 AND stock >= $1`,
  [item.quantity, item.replacementId],
);
// Si affected rows = 0 → throw → rollback automático
```

### Endpoints

| Método | Ruta | Descripción |
|---|---|---|
| `POST` | `/api/invoices` | Crear factura |
| `GET` | `/api/invoices?tenantId=&from=&to=&page=&limit=` | Historial paginado |
| `GET` | `/api/invoices/:id` | Detalle con líneas |
| `PATCH` | `/api/invoices/:id/cancel` | Cancelar + restaurar stock |
| `GET` | `/api/invoices/summary?tenantId=&from=&to=` | Resumen para dashboard |
| `GET` | `/api/customers?tenantId=&q=` | Buscar clientes (autocompletado en POS) |
| `POST` | `/api/customers` | Crear cliente |

---

## Frontend — cambios necesarios (`repuestito/`)

### Nuevas rutas del dashboard

```
app/(main)/dashboard/billing/
  page.tsx               ← POS: buscador de repuestos + carrito + checkout
  [id]/page.tsx          ← detalle / vista de impresión de factura
  history/page.tsx       ← historial con filtros de fecha, cliente, estado
```

### Nuevo servicio

```
services/billing.service.ts
  createInvoice(payload)
  getInvoice(id)
  getInvoices(query)
  cancelInvoice(id)
  getSummary(query)

services/customers.service.ts
  searchCustomers(tenantId, q)
  createCustomer(payload)
```

### Flujo del POS (`/dashboard/billing`)

```
Paso 1 — Selección de productos
  Buscador de repuestos con filtro live (≥3 chars)
  Lista de resultados con stock disponible
  [+ Agregar] por cada ítem

Paso 2 — Carrito (sidebar derecho)
  Ítem | Qty [─][+] | Precio unit. | Subtotal | [eliminar]
  Subtotal | IVA (%) editable | TOTAL

Paso 3 — Datos del comprador + pago
  Buscador de cliente existente (autocompletado por nombre/doc)
  O ingresar datos nuevos: nombre, documento, teléfono
  Opción: guardar como cliente nuevo
  Método de pago | Notas

Paso 4 — Comprobante
  Factura #INV-00042, logo del local, tabla de ítems, totales
  [Imprimir] → window.print()  |  [Nueva venta] → limpia carrito
```

### Estado del carrito (`useReducer` local)

```ts
type CartItem = {
  replacementId: string;
  name: string;
  unitPrice: number;
  quantity: number;
};

type CartAction =
  | { type: 'ADD';        item: Omit<CartItem, 'quantity'> }
  | { type: 'UPDATE_QTY'; replacementId: string; quantity: number }
  | { type: 'REMOVE';     replacementId: string }
  | { type: 'CLEAR' };
```

### Vista de impresión (`/dashboard/billing/[id]`)

- `@media print` oculta sidebar y header — solo se imprime el comprobante.
- Muestra: logo del local, datos del comprador, tabla de ítems, subtotal, IVA, total, número de factura, fecha.
- `window.print()` → "Guardar como PDF" del navegador sin dependencias externas.

---

## Decisiones técnicas clave

| Decisión | Razón |
|---|---|
| `PARTITION BY LIST (tenant_id)` en `invoices` y `customers` | Partition pruning perfecto; cada local escanea solo su partición |
| `_default` en cada tabla particionada | Evita error de inserción ante race condition al registrar un tenant |
| Snapshot `buyer_name/doc/phone` en `invoices` | El comprobante histórico no cambia si el cliente actualiza sus datos |
| `customer_id` nullable en `invoices` | La venta sin identificar al comprador es válida; el cliente es opcional |
| `line_total`, `tax_amount`, `total` como columnas generadas `STORED` | Se calculan una vez en escritura; nunca hay inconsistencia entre cantidad, precio y total |
| Secuencia Postgres por tenant para `invoice_number` | `nextval()` es atómico; imposible duplicar el correlativo bajo concurrencia |
| Descuento de stock en la misma transacción | Si el stock es insuficiente en cualquier línea, toda la factura hace rollback |
| `invoice_items` no particionada | Acceso siempre via `invoice_id`; el índice es suficiente sin particionado adicional |

---

## Pendiente / Orden de implementación sugerido

1. Migración SQL raw: `customers`, `invoices`, `invoice_items`, particiones default, índices
2. Modificar `TenantService.create()`: particiones de `invoices` y `customers` + secuencia correlativa
3. Entidades TypeORM `Invoice`, `InvoiceItem`, `Customer`
4. `CustomersService` + `CustomersController` (CRUD básico + búsqueda)
5. `InvoicesService`: `create()` con transacción atómica, `findByTenant()`, `findOne()`, `cancel()`, `summary()`
6. `InvoicesController` + DTOs + Swagger
7. `billing.service.ts` y `customers.service.ts` en el frontend
8. `/dashboard/billing`: pantalla POS completa (buscador + carrito + checkout + comprobante)
9. `/dashboard/billing/[id]`: vista de detalle con `@media print`
10. `/dashboard/billing/history`: historial paginado con filtros
11. Agregar ítem "Facturación" al sidebar (`DashboardSidebar`)
12. Smoke test: crear factura con 2+ ítems y cliente → verificar `invoices`, `invoice_items`, descuento de stock; cancelar → verificar restauración de stock y `cancelled_at`
