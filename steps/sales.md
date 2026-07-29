# Facturación — Plan de trabajo

> Creado: julio 2026. Pendiente de implementación.

---

## Objetivo

Registrar las ventas de repuestos mediante un flujo completo de facturación en dos etapas: primero un `order` (pedido) que reserva intención sin comprometer stock, y luego un `invoice` (comprobante) que lo convierte en venta definitiva, descuenta stock de forma atómica y genera un comprobante imprimible. Las tablas crecerán de forma exponencial, por lo que se particionan por `tenant_id` usando `PARTITION BY LIST`.

---

## Modelo de datos

### `invoices` — cabecera del comprobante (particionada)

```sql
CREATE TABLE invoices (
    id              UUID          DEFAULT gen_random_uuid(),
    tenant_id       UUID          NOT NULL,                        -- clave de partición
    branch_id       UUID          REFERENCES branches(id)  ON DELETE SET NULL,
    seller_id       UUID          REFERENCES users(id)     ON DELETE SET NULL,
    customer_id     UUID,                                                                  -- opcional; FK compuesta abajo

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
    tax_amount      NUMERIC(12,2) GENERATED ALWAYS AS (ROUND(subtotal * tax_rate / 100, 2)) STORED,
    total           NUMERIC(12,2) GENERATED ALWAYS AS (subtotal + ROUND(subtotal * tax_rate / 100, 2)) STORED,
    issued_at       TIMESTAMPTZ   NOT NULL DEFAULT CURRENT_TIMESTAMP,
    cancelled_at    TIMESTAMPTZ,

    PRIMARY KEY (id, tenant_id),  -- tenant_id obligatorio en PK de tablas particionadas
    FOREIGN KEY (customer_id, tenant_id) REFERENCES customers (id, tenant_id) ON DELETE RESTRICT
) PARTITION BY LIST (tenant_id);

CREATE TABLE invoices_default PARTITION OF invoices DEFAULT;
```

### `invoice_items` — líneas del comprobante

```sql
CREATE TABLE invoice_items (
    id              UUID          DEFAULT gen_random_uuid(),
    tenant_id       UUID          NOT NULL,                        -- clave de partición
    invoice_id      UUID          NOT NULL,
    replacement_id  UUID          NOT NULL REFERENCES replacement(id) ON DELETE RESTRICT,
    description     VARCHAR(200)  NOT NULL,                        -- snapshot del nombre al momento de venta
    quantity        INT           NOT NULL CHECK (quantity > 0),
    unit_price      NUMERIC(12,2) NOT NULL,
    line_total      NUMERIC(12,2) GENERATED ALWAYS AS (quantity * unit_price) STORED,

    PRIMARY KEY (id, tenant_id),
    FOREIGN KEY (invoice_id, tenant_id) REFERENCES invoices (id, tenant_id) ON DELETE CASCADE
) PARTITION BY LIST (tenant_id);

CREATE TABLE invoice_items_default PARTITION OF invoice_items DEFAULT;
```

### `orders` — pedido previo a la factura (particionada)

```sql
CREATE TABLE orders (
    id              UUID          DEFAULT gen_random_uuid(),
    tenant_id       UUID          NOT NULL,                        -- clave de partición
    branch_id       UUID          REFERENCES branches(id)  ON DELETE SET NULL,
    seller_id       UUID          REFERENCES users(id)     ON DELETE SET NULL,
    customer_id     UUID,                                                                  -- opcional; FK compuesta abajo

    -- Snapshot del comprador al momento del pedido
    buyer_name      VARCHAR(120),
    buyer_doc       VARCHAR(30),
    buyer_phone     VARCHAR(30),

    order_number    VARCHAR(30)   NOT NULL,                        -- correlativo: ORD-00001
    status          VARCHAR(20)   NOT NULL DEFAULT 'pending',      -- 'pending' | 'confirmed' | 'fulfilled' | 'cancelled'
    notes           TEXT,
    subtotal        NUMERIC(12,2) NOT NULL DEFAULT 0,
    tax_rate        NUMERIC(5,2)  NOT NULL DEFAULT 0,
    tax_amount      NUMERIC(12,2) GENERATED ALWAYS AS (ROUND(subtotal * tax_rate / 100, 2)) STORED,
    total           NUMERIC(12,2) GENERATED ALWAYS AS (subtotal + ROUND(subtotal * tax_rate / 100, 2)) STORED,
    invoice_id      UUID,                                          -- se llena al convertir a factura
    created_at      TIMESTAMPTZ   NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at      TIMESTAMPTZ,
    fulfilled_at    TIMESTAMPTZ,
    cancelled_at    TIMESTAMPTZ,

    PRIMARY KEY (id, tenant_id),
    FOREIGN KEY (customer_id, tenant_id) REFERENCES customers (id, tenant_id) ON DELETE RESTRICT
) PARTITION BY LIST (tenant_id);

CREATE TABLE orders_default PARTITION OF orders DEFAULT;
```

### `order_items` — líneas del pedido

```sql
CREATE TABLE order_items (
    id              UUID          DEFAULT gen_random_uuid(),
    tenant_id       UUID          NOT NULL,                        -- clave de partición
    order_id        UUID          NOT NULL,
    replacement_id  UUID          NOT NULL REFERENCES replacement(id) ON DELETE RESTRICT,
    description     VARCHAR(200)  NOT NULL,                        -- snapshot del nombre al momento del pedido
    quantity        INT           NOT NULL CHECK (quantity > 0),
    unit_price      NUMERIC(12,2) NOT NULL,
    line_total      NUMERIC(12,2) GENERATED ALWAYS AS (quantity * unit_price) STORED,

    PRIMARY KEY (id, tenant_id),
    FOREIGN KEY (order_id, tenant_id) REFERENCES orders (id, tenant_id) ON DELETE CASCADE
) PARTITION BY LIST (tenant_id);

CREATE TABLE order_items_default PARTITION OF order_items DEFAULT;
```

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
-- unicidad del correlativo por tenant
ALTER TABLE invoices ADD CONSTRAINT uq_invoices_tenant_number UNIQUE (tenant_id, invoice_number);
ALTER TABLE orders  ADD CONSTRAINT uq_orders_tenant_number  UNIQUE (tenant_id, order_number);
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
-- orders: búsqueda por fecha dentro de un tenant
CREATE INDEX idx_orders_tenant_date     ON orders (tenant_id, created_at DESC);
-- orders: por estado (pedidos pendientes de un tenant)
CREATE INDEX idx_orders_tenant_status   ON orders (tenant_id, status);
-- orders: trazabilidad order → invoice
CREATE INDEX idx_orders_invoice         ON orders (tenant_id, invoice_id) WHERE invoice_id IS NOT NULL;
-- order_items: líneas de un pedido
CREATE INDEX idx_order_items_order      ON order_items (order_id);
-- order_items: cuánto se pedió de un repuesto
CREATE INDEX idx_order_items_replace    ON order_items (tenant_id, replacement_id);
```

---

## Relaciones clave

```
Tenant ──< orders (particionado por tenant_id)
              │
              ├── customer_id  → customers (particionado por tenant_id)
              ├── branch_id    → branches
              ├── seller_id    → users
              ├── invoice_id   → invoices (nullable; se llena al fulfil)
              └──< order_items (particionado por tenant_id)
                      └── replacement_id → replacement

Tenant ──< invoices (particionado por tenant_id)
              │
              ├── customer_id  → customers (particionado por tenant_id)
              ├── branch_id    → branches
              ├── seller_id    → users
              └──< invoice_items (particionado por tenant_id)
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
src/orders/
  entities/
    order.entity.ts
    order-item.entity.ts
  dto/
    create-order.dto.ts
    order-response.dto.ts
  orders.module.ts
  orders.service.ts
  orders.controller.ts

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
        tax_amount NUMERIC(12,2) GENERATED ALWAYS AS (ROUND(subtotal * tax_rate / 100, 2)) STORED,
        total NUMERIC(12,2) GENERATED ALWAYS AS (subtotal + ROUND(subtotal * tax_rate / 100, 2)) STORED,
        issued_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
        cancelled_at TIMESTAMPTZ,
        PRIMARY KEY (id, tenant_id),
        FOREIGN KEY (customer_id, tenant_id) REFERENCES customers (id, tenant_id) ON DELETE RESTRICT
      ) PARTITION BY LIST (tenant_id);
    `);
    await queryRunner.query(`CREATE TABLE invoices_default PARTITION OF invoices DEFAULT;`);

    // orders
    await queryRunner.query(`
      CREATE TABLE orders (
        id UUID DEFAULT gen_random_uuid(), tenant_id UUID NOT NULL,
        branch_id UUID, seller_id UUID, customer_id UUID,
        buyer_name VARCHAR(120), buyer_doc VARCHAR(30), buyer_phone VARCHAR(30),
        order_number VARCHAR(30) NOT NULL,
        status VARCHAR(20) NOT NULL DEFAULT 'pending',
        notes TEXT, subtotal NUMERIC(12,2) NOT NULL DEFAULT 0,
        tax_rate NUMERIC(5,2) NOT NULL DEFAULT 0,
        tax_amount NUMERIC(12,2) GENERATED ALWAYS AS (ROUND(subtotal * tax_rate / 100, 2)) STORED,
        total NUMERIC(12,2) GENERATED ALWAYS AS (subtotal + ROUND(subtotal * tax_rate / 100, 2)) STORED,
        invoice_id UUID,
        created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMPTZ, fulfilled_at TIMESTAMPTZ, cancelled_at TIMESTAMPTZ,
        PRIMARY KEY (id, tenant_id),
        FOREIGN KEY (customer_id, tenant_id) REFERENCES customers (id, tenant_id) ON DELETE RESTRICT
      ) PARTITION BY LIST (tenant_id);
    `);
    await queryRunner.query(`CREATE TABLE orders_default PARTITION OF orders DEFAULT;`);

    // order_items
    await queryRunner.query(`
      CREATE TABLE order_items (
        id UUID DEFAULT gen_random_uuid(), tenant_id UUID NOT NULL,
        order_id UUID NOT NULL,
        replacement_id UUID NOT NULL REFERENCES replacement(id) ON DELETE RESTRICT,
        description VARCHAR(200) NOT NULL,
        quantity INT NOT NULL CHECK (quantity > 0),
        unit_price NUMERIC(12,2) NOT NULL,
        line_total NUMERIC(12,2) GENERATED ALWAYS AS (quantity * unit_price) STORED,
        PRIMARY KEY (id, tenant_id),
        FOREIGN KEY (order_id, tenant_id) REFERENCES orders (id, tenant_id) ON DELETE CASCADE
      ) PARTITION BY LIST (tenant_id);
    `);
    await queryRunner.query(`CREATE TABLE order_items_default PARTITION OF order_items DEFAULT;`);

    // invoice_items
    await queryRunner.query(`
      CREATE TABLE invoice_items (
        id UUID DEFAULT gen_random_uuid(), tenant_id UUID NOT NULL,
        invoice_id UUID NOT NULL,
        replacement_id UUID NOT NULL REFERENCES replacement(id) ON DELETE RESTRICT,
        description VARCHAR(200) NOT NULL,
        quantity INT NOT NULL CHECK (quantity > 0),
        unit_price NUMERIC(12,2) NOT NULL,
        line_total NUMERIC(12,2) GENERATED ALWAYS AS (quantity * unit_price) STORED,
        PRIMARY KEY (id, tenant_id),
        FOREIGN KEY (invoice_id, tenant_id) REFERENCES invoices (id, tenant_id) ON DELETE CASCADE
      ) PARTITION BY LIST (tenant_id);
    `);
    await queryRunner.query(`CREATE TABLE invoice_items_default PARTITION OF invoice_items DEFAULT;`);

    // índices
    await queryRunner.query(`ALTER TABLE invoices ADD CONSTRAINT uq_invoices_tenant_number UNIQUE (tenant_id, invoice_number);`);
    await queryRunner.query(`ALTER TABLE orders  ADD CONSTRAINT uq_orders_tenant_number  UNIQUE (tenant_id, order_number);`);
    await queryRunner.query(`CREATE INDEX idx_invoices_tenant_date  ON invoices (tenant_id, issued_at DESC);`);
    await queryRunner.query(`CREATE INDEX idx_invoices_number       ON invoices (tenant_id, invoice_number);`);
    await queryRunner.query(`CREATE INDEX idx_invoice_items_invoice ON invoice_items (invoice_id);`);
    await queryRunner.query(`CREATE INDEX idx_invoice_items_replace ON invoice_items (tenant_id, replacement_id);`);
    await queryRunner.query(`CREATE INDEX idx_customers_tenant      ON customers (tenant_id, name);`);
    await queryRunner.query(`CREATE INDEX idx_orders_tenant_date    ON orders (tenant_id, created_at DESC);`);
    await queryRunner.query(`CREATE INDEX idx_orders_tenant_status  ON orders (tenant_id, status);`);
    await queryRunner.query(`CREATE INDEX idx_order_items_order     ON order_items (order_id);`);
    await queryRunner.query(`CREATE INDEX idx_order_items_replace   ON order_items (tenant_id, replacement_id);`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS order_items CASCADE;`);
    await queryRunner.query(`DROP TABLE IF EXISTS orders CASCADE;`);
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
await queryRunner.query(`CREATE TABLE IF NOT EXISTS invoice_items_tenant_${safe} PARTITION OF invoice_items FOR VALUES IN ('${tenant.id}');`);
await queryRunner.query(`CREATE TABLE IF NOT EXISTS orders_tenant_${safe} PARTITION OF orders FOR VALUES IN ('${tenant.id}');`);
await queryRunner.query(`CREATE TABLE IF NOT EXISTS order_items_tenant_${safe} PARTITION OF order_items FOR VALUES IN ('${tenant.id}');`);
await queryRunner.query(`CREATE TABLE IF NOT EXISTS customers_tenant_${safe} PARTITION OF customers FOR VALUES IN ('${tenant.id}');`);
await queryRunner.query(`CREATE SEQUENCE IF NOT EXISTS invoice_seq_${safe} START 1;`);
await queryRunner.query(`CREATE SEQUENCE IF NOT EXISTS order_seq_${safe} START 1;`);
```

### `OrdersService` — métodos principales

```ts
// Crear pedido: inserta cabecera + líneas + descuenta stock de forma atómica
async create(dto: CreateOrderDto): Promise<Order>

// Listado paginado por tenant con filtro de estado
async findByTenant(tenantId: string, filters: { status?: string; from?: Date; to?: Date; page: number; limit: number })

// Detalle con líneas
async findOne(id: string, tenantId: string): Promise<Order>

// Confirmar pedido (pending → confirmed)
async confirm(id: string, tenantId: string): Promise<Order>

// Fulfil: convierte order → invoice (descuenta stock, crea invoice + invoice_items, actualiza order.invoice_id y fulfilled_at)
async fulfill(id: string, tenantId: string): Promise<Invoice>

// Cancelar pedido: restaura stock de cada línea
async cancel(id: string, tenantId: string): Promise<Order>
```

**Transacción de creación de order:**

```ts
// 1. Generar order_number con nextval('order_seq_${safe}')
// 2. Insertar cabecera (orders)
// 3. Insertar order_items
// 4. Descontar stock por cada línea (rollback si stock insuficiente)
await queryRunner.query(
  `UPDATE replacement SET stock = stock - $1 WHERE id = $2 AND stock >= $1`,
  [item.quantity, item.replacementId],
);
// Si affected rows = 0 → throw → rollback automático
```

**Transacción de cancel:**

```ts
// Restaurar stock por cada order_item
await queryRunner.query(
  `UPDATE replacement SET stock = stock + $1 WHERE id = $2`,
  [item.quantity, item.replacementId],
);
// UPDATE orders SET status = 'cancelled', cancelled_at = now()
```

**Transacción de fulfil (`orders → invoices`):**

```ts
// 1. Verificar que order.status === 'confirmed'
// 2. Generar invoice_number con nextval('invoice_seq_${safe}')
// 3. Insertar invoice (copiando buyer snapshot, customer_id, branch_id, seller_id, tax_rate del order)
// 4. Insertar invoice_items desde order_items
// 5. Stock NO se toca (ya fue descontado al crear el order)
// 6. UPDATE orders SET status = 'fulfilled', invoice_id = $invoiceId, fulfilled_at = now()
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
| `POST` | `/api/orders` | Crear pedido |
| `GET` | `/api/orders?tenantId=&status=&from=&to=&page=&limit=` | Listado paginado de pedidos |
| `GET` | `/api/orders/:id` | Detalle con líneas |
| `PATCH` | `/api/orders/:id/confirm` | Confirmar pedido |
| `POST` | `/api/orders/:id/fulfill` | Convertir pedido a factura |
| `PATCH` | `/api/orders/:id/cancel` | Cancelar pedido |
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

app/(main)/dashboard/orders/
  page.tsx               ← lista de pedidos con filtro de estado
  new/page.tsx           ← crear pedido (mismo flujo de carrito que POS)
  [id]/page.tsx          ← detalle del pedido + botones Confirmar / Fulfil / Cancelar
```

### Nuevos servicios

```
services/billing.service.ts
  createInvoice(payload)
  getInvoice(id)
  getInvoices(query)
  cancelInvoice(id)
  getSummary(query)

services/orders.service.ts
  createOrder(payload)
  getOrder(id)
  getOrders(query)
  confirmOrder(id)
  fulfillOrder(id)      ← llama a POST /api/orders/:id/fulfill; retorna la invoice creada
  cancelOrder(id)

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
| Secuencia Postgres por tenant para `invoice_number` y `order_number` | `nextval()` es atómico; imposible duplicar el correlativo bajo concurrencia |
| Descuento de stock al crear el order, no en fulfill | El pedido reserva stock real desde el inicio; evita sobreventa bajo concurrencia. Cancelar restaura el stock. |
| `orders.invoice_id` nullable | Trazabilidad opcional: cuando el order se fulfil, apunta a la invoice generada |
| `invoice_items` y `order_items` particionadas por `tenant_id` | Criterio multi-tenant uniforme en las 4 tablas; partition pruning consistente en queries que filtran por tenant |
| `PARTITION BY LIST (tenant_id)` en `orders` | Misma razón que `invoices`: partition pruning perfecto por tenant |

---

## Pendiente / Orden de implementación sugerido

1. Migración SQL raw: `customers`, `orders`, `order_items`, `invoices`, `invoice_items`, particiones default, índices
2. Modificar `TenantService.create()`: particiones de `invoices`, `orders` y `customers` + secuencias correlativas (`invoice_seq_*`, `order_seq_*`)
3. Entidades TypeORM `Order`, `OrderItem`, `Invoice`, `InvoiceItem`, `Customer`
4. `CustomersService` + `CustomersController` (CRUD básico + búsqueda)
5. `OrdersService`: `create()`, `confirm()`, `fulfill()` con transacción atómica (descuento de stock + creación de invoice), `cancel()`
6. `OrdersController` + DTOs + Swagger
7. `InvoicesService`: `findByTenant()`, `findOne()`, `cancel()`, `summary()`
8. `InvoicesController` + DTOs + Swagger
9. `orders.service.ts`, `billing.service.ts` y `customers.service.ts` en el frontend
10. `/dashboard/orders`: lista de pedidos con filtro de estado + acciones inline
11. `/dashboard/orders/new`: formulario de pedido (buscador + carrito)
12. `/dashboard/orders/[id]`: detalle + botones Confirmar / Fulfil / Cancelar
13. `/dashboard/billing`: historial de facturas con filtros de fecha, cliente, estado
14. `/dashboard/billing/[id]`: vista de detalle con `@media print`
15. Agregar ítems "Pedidos" y "Facturación" al sidebar (`DashboardSidebar`)
16. Smoke test end-to-end: crear order → confirmar → fulfil → verificar invoice generada, `invoice_items`, descuento de stock, `order.invoice_id`; cancelar invoice → verificar restauración de stock y `cancelled_at`
