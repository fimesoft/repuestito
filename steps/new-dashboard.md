# Nuevo dashboard — Costo, capital invertido, valor potencial y margen

> Creado: 20/09/2026. Estado: **Fases 1 a 5 implementadas** (backend verificado contra el API; frontend con `tsc` y `next build`, sin probar en el navegador).
> Alcance: backend (`repuestito-api`) en las Fases 1 a 4 y frontend (`repuestito`) en la Fase 5.

---

## Estado de la implementación

**Hecho** (todas las decisiones de la tabla de abajo se confirmaron tal como se propusieron):

- Migración `src/migrations/1789943409925-AddReplacementCost.ts`: columna `cost numeric(10,2)` nullable y `CHECK (cost IS NULL OR cost >= 0)`. Generada con `migration:generate`, sin ediciones manuales. Aditiva: el API anterior sigue funcionando con ella aplicada.
- `Replacement.cost` con `@Expose({ groups: ['cost'] })`: oculto por defecto. Los endpoints `GET /replacements` (listado), `POST` y `PATCH` usan `@SerializeOptions({ groups: ['cost'] })` y lo devuelven; `GET /replacements/:id` **no** lo devuelve.
- `cost` en alta (`CreateReplacementDto`), edición (`UpdateReplacementDto`, con `null` para borrarlo) y carga masiva (columna opcional del CSV, plantilla actualizada). Validación: `≥ 0`, máx. 2 decimales, máx. `99.999.999,99`.
- `GET /api/stats/dashboard`: una sola consulta agregada devuelve `totalStock`, `capitalInvested`, `potentialSalesValue`, `profitMargin { amount, percentage }` y `withoutCost`. `inventoryValue` se mantiene, deprecado (igual a `potentialSalesValue`). El cálculo vive en la función pura `buildReplacementStats`.

**Verificado en local** (copia de la DB de desarrollo, sin tocar la real):
- Migración: `up`, `down` y `up` sin pérdida de datos, `migration:generate` sin diferencias y el `CHECK` rechaza un costo negativo.
- 26 comprobaciones contra el API:
  - Métricas: sin productos, todos sin costo, mezcla con y sin costo, `stock = 0`, inactivos, decimales, aislamiento por tenant y `GOD` sin filtro. Los resultados coinciden con la misma cuenta hecha a mano con `psql`.
  - Costo: validaciones (negativo, 3 decimales, sobre el máximo), el costo aparece en el listado, en el alta y en el `PATCH` del propio tenant, no aparece en `GET /:id`, otro tenant no lo ve y `null` lo borra.
  - Carga masiva: con y sin columna `cost`, y con filas inválidas.
- `jest`: 22 tests (6 nuevos del cálculo: sin productos, porcentaje, sin costo, redondeo, `inventoryValue` y margen negativo). `tsc` sin errores.

**Bug corregido durante las pruebas:** en la carga masiva, una celda `cost` vacía quedaba en `0` en vez de `NULL` (`@Type(() => Number)` convierte `''` en `0` antes del `@Transform`). Ahora se mira el valor original de la celda.

**Pendiente antes de desplegar:** aplicar la migración en la DB de desarrollo (`npm run migration:run`) **antes** de reiniciar el API; el endpoint del dashboard ya consulta `cost` y fallaría sin ella. En producción la migración corre sola en el deploy del backend (`deploy.sh`).

---

## Seguridad: aislamiento por tenant

**Corregido (20/09/2026).** Los endpoints `GET /api/stats/dashboard` y `GET /api/stats/sales` filtraban por `user.tenantId`, y `null` significaba «sin filtro»: un usuario que no es GOD y todavía no tiene tenant (onboarding pendiente) veía los totales de **todos** los locales, incluidos capital invertido y margen. El mismo patrón estaba en `GET`, `PATCH` y `DELETE` de `/api/replacements`, donde ese usuario podía listar (con `cost`), editar y borrar productos de cualquier local.

- Nuevo `requireTenantUnlessGod(user)` (`src/common/tenant-scope.ts`): un usuario no GOD sin tenant recibe `400 TENANT_REQUIRED` (el mismo código y estado que ya usa `tenant-config`). GOD conserva la vista global.
- Aplicado en los dos endpoints de `stats` y en `findAll`, `update` y `remove` de `replacements`.
- **Cantidad de artículos totales** = `SUM(stock)` de **tu local** (`tenant_id`); si el usuario tiene sucursal, la de su sucursal más los productos sin sucursal.
- Verificado (18 comprobaciones contra el API y 3 tests): sin tenant → 400 en las cinco rutas y sin modificar datos ajenos; GOD ve la suma total; un local grande y uno chico ven cada uno solo su total (19.633 y 104 contra 19.832 global); un local no puede editar ni borrar productos de otro (404); con sucursal, el total es el de su sucursal más los productos sin sucursal.

### Pedidos, facturas y clientes (corregido el 20/09/2026)

Los controladores de `orders`, `invoices` y `customers` recibían `tenantId` (y `sellerId`) del cliente: cualquier usuario autenticado podía leer o modificar pedidos, facturas y clientes de otro local, crear pedidos en su nombre y consumir el stock de sus productos.

- **Backend:** `resolveTenantId(user, requested?)` (`src/common/tenant-scope.ts`): un usuario normal opera **siempre** sobre su propio tenant y el `tenantId` que envíe se ignora; solo GOD debe indicar uno explícito (UUID válido, porque el id se usa para armar nombres de secuencias). Sin tenant → `400 TENANT_REQUIRED`. Aplicado a los 13 endpoints (pedidos ×6, facturas ×5, clientes ×2).
- `CreateOrderDto`, `CreateInvoiceDto` y `CreateCustomerDto`: `tenantId` opcional (solo GOD) y sin `sellerId`; el vendedor es siempre el usuario autenticado. Los tipos `CreateOrderInput` / `CreateInvoiceInput` reflejan que el servidor ya resolvió ambos.
- Descuento y restitución de stock acotados por tenant (`AND tenant_id = $n`); `branchId` y `customerId` se verifican contra el tenant (`assertOwnedByTenant`, 400 si no le pertenecen).
- **Bug de stock encontrado y corregido:** el control de stock insuficiente **nunca funcionó**. `queryRunner.query` de un `UPDATE` devuelve `[filas, cantidad]`, así que `updated.length === 0` era siempre falso: un pedido o factura por más unidades que el stock se creaba igual sin descontar nada, y al cancelarlo se **sumaba** stock que nunca se había descontado. Ahora se lee la cantidad afectada (`affectedRows`, `src/common/db-results.ts`) y se responde 400 sin dejar nada a medias. Dos pedidos simultáneos por todo el stock: prospera uno solo.
- **Frontend:** los servicios (`orders`, `billing`, `customers`) y las páginas de pedidos, facturas y `SaleForm` ya no envían `tenantId` ni `sellerId`, y los enlaces a los detalles ya no llevan `?tenantId=`.
- **Compatibilidad:** con `ValidationPipe({ whitelist: true })` el backend nuevo ignora los campos que envíe el frontend anterior, así que se despliega primero el backend y después el frontend sin ventana de fallo.
- **Verificado:** 49 comprobaciones contra el API con dos locales (suplantación de tenant y vendedor, productos, sucursales y clientes ajenos, lectura y modificación cruzadas, GOD, usuario sin tenant, control de stock y flujo normal completo) y 31 tests de `jest`.
- **Sin cambios (decisión):** `unitPrice` y `description` de cada ítem siguen viniendo del cliente.

---

## Objetivo

1. Agregar el **costo** (`cost`) a `replacement`, para saber cuánto le cuesta al tenant cada producto.
2. Calcular en `GET /api/stats/dashboard` (`getDashboardStats`):
   - **Capital invertido**: lo que costó el inventario que hay en stock.
   - **Valor potencial de venta**: lo que se recaudaría si se vendiera todo el inventario a precio de lista.
   - **Margen de ganancia**: la diferencia entre ambos, en monto y en porcentaje.
   - **Cantidad de artículos totales**: las unidades en stock.

---

## Punto de partida (revisado en el código)

| Hoy | Detalle |
|---|---|
| `replacement.price` | `numeric(10,2) NOT NULL`. No existe `cost`. |
| `stats.service.ts` | Una sola consulta sobre `replacement` calcula `total`, `active`, `inactive`, `inventoryValue = SUM(price * stock)` y `totalStock = SUM(stock)`, filtrada por `tenant_id` y `branch_id`. |
| Etiqueta equivocada | El dashboard muestra `inventoryValue` como **«Capital invertido»**, pero es `price * stock`, es decir, el *valor potencial de venta*. Con `cost` esa tarjeta pasa a mostrar el capital real. |
| Serialización | `ClassSerializerInterceptor` global: se usa `@Exclude()` para ocultar columnas. |
| `GET /api/replacements/:id` | `findOne` **no filtra por tenant**: cualquier usuario autenticado puede leer cualquier producto por id. Si `cost` se serializa siempre, se filtraría a otros tenants (ver Fase 2). |
| Ventas | `order_items` / `invoice_items` guardan `unit_price` pero no el costo de la venta. |

---

## Decisiones (confirmadas)

| # | Tema | Propuesta | Alternativa |
|---|---|---|---|
| 1 | **Qué suma el capital** | `SUM(cost × stock)`: costo unitario por unidades en stock. Es el mismo criterio que hoy usa `inventoryValue` con el precio. | La lectura literal, `SUM(cost)`, suma un solo costo por producto sin importar cuántas unidades haya. No refleja el dinero inmovilizado; solo tendría sentido si cada fila fuera una unidad. |
| 2 | **Qué suma el valor potencial** | `SUM(price × stock)`, mismo criterio que el punto 1. | `SUM(price)` literal, con el mismo problema. |
| 3 | **Productos sin costo** | `cost` **nullable**: `NULL` = costo desconocido. No cuentan como costo cero, porque inflarían el margen. Se reportan en `withoutCost`. | `NOT NULL DEFAULT 0`: más simple, pero un producto sin cargar parece regalado y distorsiona el margen. |
| 4 | **Base del porcentaje de margen** | Margen sobre el **precio de venta**: `(precio − costo) / precio`. | Markup sobre el costo: `(precio − costo) / costo`. |
| 5 | **Productos inactivos** | Se incluyen, igual que hoy `inventoryValue` y `totalStock`. | Solo activos (`active = true`). |
| 6 | **Quién ve el costo** | Solo miembros del tenant dueño del producto (Fase 2). | Cualquier usuario autenticado, con el riesgo de fuga descrito arriba. |

---

## Fase 1 — Columna `cost` en `replacement`

- Entidad `Replacement`: `cost: number | null`, `numeric(10,2)` (igual que `price`), nullable, con `@Check('ck_replacement_cost_nonnegative', '"cost" IS NULL OR "cost" >= 0')`.
- Una sola migración TypeORM (`src/migrations/<timestamp>-AddReplacementCost.ts`) generada con `migration:generate` a partir de la entidad y revisada a mano (mismo método que `EvolveCatalog`). Sin backfill: los productos existentes quedan con `cost = NULL`.
- Aditiva y nullable: mientras el backend nuevo y el frontend antiguo conviven durante el deploy, nada se rompe.
- El deploy ya ejecuta `migration:run` (paso agregado a `/opt/piezify/deploy.sh`).

## Fase 2 — Escribir y leer el costo

- `CreateReplacementDto` y `UpdateReplacementDto`: `cost?` (`@IsOptional() @Type(() => Number) @IsNumber() @Min(0)`, máximo 2 decimales).
- Carga masiva: columna opcional `cost` en el CSV (`BulkUploadRowDto`, plantilla `productos-ejemplo.csv` y `steps/file-upload.md`).
- **Visibilidad (decisión 6):** `cost` no debe salir en respuestas públicas.
  - En la entidad: `@Expose({ groups: ['cost'] })` y ocultarlo por defecto.
  - Los endpoints que ya están acotados al tenant (`GET /replacements` con `tenantId`, `POST`, `PATCH`) usan `@SerializeOptions({ groups: ['cost'] })` para incluirlo.
  - `GET /replacements/:id` sigue sin exponerlo mientras no filtre por tenant. Si se necesita el costo en el detalle, primero hay que scopear `findOne` por tenant.
  - `GOD` ve el costo de todos los tenants.
- Auditoría: los cambios de `cost` van en `before` / `after` del evento `replacement.updated` (ver `audit-logging.md`).

## Fase 3 — Métricas en `getDashboardStats`

Todo sale de **una sola consulta agregada** sobre `replacement`, con el mismo filtro de `tenant_id` y `branch_id` que ya existe (sin consultas nuevas):

```sql
SELECT COUNT(*)                                            AS total,
       COUNT(*) FILTER (WHERE active = true)               AS active,
       COUNT(*) FILTER (WHERE active = false)              AS inactive,
       COALESCE(SUM(stock), 0)                             AS total_stock,
       COALESCE(SUM(price * stock), 0)                     AS potential_sales_value,
       COALESCE(SUM(cost * stock), 0)                      AS capital_invested,
       COALESCE(SUM((price - cost) * stock), 0)            AS margin_amount,
       COALESCE(SUM(price * stock) FILTER (WHERE cost IS NOT NULL), 0) AS priced_with_cost,
       COUNT(*) FILTER (WHERE cost IS NULL)                AS without_cost
FROM replacement
WHERE ($1::uuid IS NULL OR tenant_id = $1)
  AND ($2::uuid IS NULL OR branch_id = $2 OR branch_id IS NULL)
```

`SUM` ignora los `NULL`, así que `capital_invested` y `margin_amount` solo consideran productos con costo. `priced_with_cost` es la base del porcentaje.

Respuesta (los campos nuevos son aditivos):

```jsonc
"replacements": {
  "total": 214, "active": 210, "inactive": 4,
  "totalStock": 19832,                 // cantidad de artículos totales
  "capitalInvested": 3200000.00,       // SUM(cost × stock)
  "potentialSalesValue": 5405135.84,   // SUM(price × stock)
  "profitMargin": {
    "amount": 1800000.00,              // SUM((price − cost) × stock), solo productos con costo
    "percentage": 36.0                 // amount / SUM(price × stock con costo) × 100; null si no hay base
  },
  "withoutCost": 12,                   // productos sin costo cargado
  "inventoryValue": 5405135.84         // DEPRECADO: igual a potentialSalesValue; se elimina en la Fase 5
}
```

- Redondeo a 2 decimales en el servicio (`numeric` llega como texto); `percentage` a 1 decimal.
- `percentage = null` cuando la base es 0 (evita división por cero y el `NaN`).
- El margen de la respuesta se calcula solo sobre productos con costo, por eso el frontend debe mostrar `withoutCost` para que el usuario sepa cuánto del inventario no entra en la cuenta.
- Tipos: `DashboardStats` en `stats.service.ts` y en el frontend.

## Fase 4 — Pruebas

- Copia de la DB de desarrollo (nunca la DB real), con la migración aplicada y el API en otro puerto, como en `EvolveCatalog`.
- Casos de las métricas:
  - Sin productos.
  - Todos los costos `NULL`: capital 0, margen 0, `percentage: null`, `withoutCost = total`.
  - Mezcla de con y sin costo.
  - `stock = 0`.
  - Productos inactivos.
  - Decimales (`19.99 × 3`).
  - Alcance por tenant y por sucursal, y `GOD` sin filtro.
- Casos del costo:
  - `cost` negativo → 400.
  - Más de 2 decimales → 400.
  - El costo **no** aparece en `GET /replacements/:id`, y sí en el listado del propio tenant.
  - Un tenant no ve el costo de otro.
- Cálculo verificado contra la misma cuenta hecha a mano con `psql`.
- `jest`: pruebas del cálculo del porcentaje y del redondeo (función pura, sin DB).

## Fase 5 — Frontend (implementada)

- `dashboard/page.tsx`: las tarjetas usan datos reales del endpoint.
  - **Capital invertido** → `capitalInvested`. Si `withoutCost > 0` muestra debajo «N productos sin costo (no entran en capital ni margen)».
  - **Valor potencial de ventas** → `potentialSalesValue`.
  - **Margen de ganancias** → `profitMargin.amount` y, debajo, el porcentaje sobre el precio (o «Sin costos cargados» si es `null`).
  - **Cantidad de artículos totales** → `totalStock`.
- `services/stats.service.ts`: tipos nuevos; el frontend ya no usa `inventoryValue`. Los campos nuevos son opcionales en el tipo y se leen con `?? 0`, por si el frontend se despliega antes que el backend.
- `services/replacement.service.ts`: `cost` en `Replacement` (llega como texto decimal), en el alta (`cost?: number`) y en la edición (`cost?: number | null`; `null` borra el costo).
- `dashboard/replacement/page.tsx`:
  - Campo **Costo (opcional)** junto al precio, en el alta y en la edición. Acepta hasta 2 decimales; vaciarlo en la edición borra el costo.
  - Filas reordenadas: Precio | Costo, Stock | SKU y Local | Sucursal (alta); Precio | Costo, Stock y Local | Sucursal (edición).
- La plantilla CSV descargable ya incluye la columna `cost` (Fase 2).
- **Costo obligatorio en el frontend:** el formulario de alta exige el costo (acepta `0`) y la carga masiva valida el CSV en el navegador antes de subirlo (columnas obligatorias `name`, `brand`, `price` y `cost`, y formato de precio, costo, stock, SKU y marca; ver `file-upload.md`), con las líneas con error a la vista. La edición sigue con el costo opcional. **El backend no cambió**: el API y `BulkUploadRowDto` siguen aceptando el costo vacío; exigirlo allí queda pendiente.

**Pendiente:**
- Probar el dashboard y los formularios en el navegador con el API reiniciado.
- Quitar `inventoryValue` del backend (`stats.service.ts`) cuando el frontend nuevo ya esté desplegado.
- Marcar «sin costo» en la tabla de productos y mostrar el margen por producto (no incluido).

---

## Fuera de alcance / futuro

- **Costo en las ventas:** guardar `unit_cost` en `order_items` e `invoice_items` para calcular la ganancia **real** de lo vendido (hoy solo hay margen potencial). Sin ese dato, el gráfico de ventas no puede mostrar ganancia.
- Historial de cambios de costo y actualización masiva de costos.
- Moneda: el dashboard formatea todo en ARS fijo; con más países habría que usar la moneda del tenant (`countries.currency_code`).
- Métricas por marca, por tipo de producto o por sucursal.
- Si `replacement` crece a cientos de miles de filas, cachear o precalcular estas agregaciones.
