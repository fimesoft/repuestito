# Integración con Mercado Libre — Plan de trabajo

> Estado: propuesta. Nada implementado todavía.
>
> Nota: `code_oem` se renombró a `sku` y los productos del catálogo tienen tipo (`product_type_id`), ver `evolution-catalog.md`. Los ítems de MELI se mapean por `sku` y su categoría a un tipo de producto.

---

## Objetivo

Traer todas las publicaciones (ítems) de Mercado Libre de un tenant a nuestra DB y gestionar el stock desde la app: los cambios de stock locales se reflejan en MELI, y las ventas hechas en MELI descuentan el stock local.

Alcance de la fase 1: importar + empujar stock. Precio y edición de publicaciones quedan fuera.

---

## Qué dice la API de MELI (resumen relevante)

Fuente: devsite MELI (`autenticacion-y-autorizacion`, `items-y-busquedas`, `producto-sincroniza-modifica-publicaciones`, `productos-recibe-notificaciones`).

| Tema | Detalle |
|---|---|
| Auth | OAuth 2.0 Authorization Code (server side). `https://auth.mercadolibre.com.<tld>/authorization` → `code` → `POST https://api.mercadolibre.com/oauth/token`. El dominio de auth depende del país del seller. |
| Tokens | `access_token` dura **6 h**. `refresh_token` es de **un solo uso**: cada refresh devuelve uno nuevo y el anterior queda inválido. Expira a los 6 meses o si el seller revoca / cambia contraseña. |
| Quién puede autorizar | Solo el usuario **administrador** de la cuenta MELI. Un operador/colaborador falla con `invalid_operator_user_id`. |
| Listar ítems | `GET /users/{user_id}/items/search` → devuelve **solo IDs** (`limit` máx. 100). Para >1000 usar `search_type=scan` + `scroll_id` (expira en 5 min). Filtros: `status`, `sku`, `seller_sku`. |
| Detalle de ítems | `GET /items/bulk?ids=A,B,...` (máx. **20** por llamada). `/items?ids=` está deprecado, migrar antes del **25/10/2026**. En bulk, `code` pasó a `status_code` y los `attributes` llevan prefijo `body.`. |
| Actualizar stock | `PUT /items/{id}` con `{"available_quantity": N}`. `0` pausa el ítem (`out_of_stock`); `>0` lo reactiva si estaba en `out_of_stock`. Un ítem `paused_by_seller` no se reactiva solo. |
| Precio | Desde 18/03/2026, un PUT que solo cambia `price` en ítems con automatización de precios activa devuelve 400. Fuera de alcance. |
| Webhooks | Tópicos `items`, `orders_v2`, `stock-location`, entre otros. Se configuran en el panel de la app. Payload trae solo `resource` + `user_id`; hay que hacer GET al recurso. |
| Reglas del webhook | Responder **HTTP 200 en <500 ms**; si no, MELI reintenta 1 h y después desactiva el tópico. `missed_feeds` solo guarda 2 días. |
| `available_quantity` público | En recursos públicos viene en rangos referenciales (1, 50, 100…). Verificar que con el token del seller devuelva el valor real antes de confiar en él. |

Casos que complican el stock y que la fase 1 **no** cubre (se importan pero se marcan como no gestionables):
- Ítems con **variaciones** (stock por variación).
- **User Products / stock multi-origen / stock distribuido** (`stock_locations`).
- Ítems Full / Flex con stock gestionado por MELI.

---

## Cómo encaja con el esquema actual

```
GlobalReplacement (catálogo compartido)         Replacement (oferta del tenant)
  name, brandId (NOT NULL), sku, imageUrl     globalReplacementId (NOT NULL), price, stock,
  countryCode                                     tenantId, branchId?, active
  UNIQUE (sku, countryCode)
```

Un ítem de MELI **no** trae lo que exige el catálogo: la marca hay que resolverla contra `brand_replacements`, el SKU puede faltar o venir sucio, y `UNIQUE(sku, countryCode)` choca si dos publicaciones del mismo repuesto se importan. Por eso:

### Recomendación 1 — No importar directo a `global_replacements`

El catálogo global es compartido entre tenants y curado (`isVerified`). Meterle datos crudos de MELI lo contamina. Se importa primero a una tabla **staging propia** del tenant y recién después se vincula.

### Recomendación 2 — Tablas nuevas

```
meli_account                                  meli_item
  id uuid PK                                    id uuid PK
  tenant_id uuid UNIQUE                         tenant_id uuid
  meli_user_id bigint                           meli_item_id varchar        -- MLA123...
  site_id varchar(3)                            UNIQUE (tenant_id, meli_item_id)
  access_token_enc text                         replacement_id uuid NULL UNIQUE  -- FK replacement
  refresh_token_enc text                        title, price, currency_id
  expires_at timestamptz                        available_quantity int
  status  ('active'|'revoked'|'error')          status, sub_status
  last_import_at timestamptz                    seller_sku, part_number, brand_raw
                                                has_variations bool, manageable bool
                                                permalink, thumbnail
                                                sync_state ('synced'|'pending_push'|'error')
                                                last_synced_at, raw jsonb
```

- `replacement_id` es **UNIQUE**: un ítem MELI ↔ un `Replacement`. La sucursal (`branchId`) se elige al vincular.
- `meli_item.available_quantity` es el espejo de lo que MELI dice; `replacement.stock` sigue siendo la fuente de verdad local.
- Tokens cifrados en reposo (AES-256-GCM, llave en `MELI_TOKEN_ENC_KEY`). Nunca en logs ni en respuestas de la API.
- Migración nueva en `src/migrations/` con el mismo formato de timestamp que las existentes.

### Recomendación 3 — Importar en dos pasos: staging → vincular

1. **Importar**: recorre `items/search` (scan si hay >1000), pide detalles con `items/bulk` de a 20 y hace upsert en `meli_item`. No toca `replacement` ni `global_replacements`.
2. **Vincular** (por ítem o en lote), en este orden:
   1. Normalizar el SKU igual que `ReplacementService.create()` (`toUpperCase().replace(/[^A-Z0-9]/g, '')`) y buscar `GlobalReplacement` por `(sku, countryCode)`. Si existe, crear solo el `Replacement` apuntando a él.
   2. Si no existe pero hay marca resoluble (`normalizeBrandName` + `brand_replacements`), crear `GlobalReplacement` (`isVerified=false`) y el `Replacement`.
   3. Si falta SKU o marca, queda **sin vincular** en la UI para que el usuario lo complete a mano.

Dos cuidados al reutilizar la lógica existente:
- Al vincular no se debe pisar el global existente con el título de la publicación de MELI. `ReplacementService.create()` ya usa `orIgnore()` y reutiliza el global sin modificarlo (evolución del catálogo); mantener ese comportamiento.
- Reusar el chequeo `globalIdsWithOwnListing` del bulk-upload para no crear un segundo `Replacement` del mismo global en el mismo tenant.

Los atributos de MELI de donde sacar marca y código (`BRAND`, `PART_NUMBER`, `OEM`, `SELLER_SKU`) deben **verificarse contra un ítem real de autopartes** antes de codificar el mapeo; varían por categoría.

### Recomendación 4 — Stock: un solo escritor lógico, dos entradas

Hoy el stock local lo modifican `orders.service.ts` (descuenta al crear el pedido, restaura al cancelar) y el módulo `invoice`, además de la edición manual (`ReplacementService.update`). MELI también lo modifica cuando vende. Para no pelearse:

**Local → MELI (push)**
- Cada cambio de `replacement.stock` en un ítem vinculado marca `meli_item.sync_state = 'pending_push'` **dentro de la misma transacción** (outbox). Un job en background lee los pendientes y hace `PUT /items/{id}` con el **valor absoluto** actual de `replacement.stock` (no deltas), después de commit. Varios cambios seguidos se colapsan en un solo PUT.
- Si `stock = 0`, MELI pausa el ítem solo; al volver a `>0` se reactiva solo (salvo `paused_by_seller`).
- Errores 401 → refresh de token y reintento; 403/`invalid_grant` → `meli_account.status = 'revoked'` y aviso en la UI. 409 (optimistic locking) → reintento con backoff.

**MELI → Local (webhooks)**
- `POST /api/meli/webhook` valida que `user_id` exista en `meli_account`, responde 200 de inmediato y encola el procesamiento. El payload no está firmado: se trata como una pista y **siempre** se hace GET al `resource`.
- `orders_v2`: por cada línea cuyo `item.id` esté vinculado, descontar el stock local por la cantidad vendida. Idempotencia obligatoria: tabla `meli_order_event (meli_order_id, meli_item_id) UNIQUE` para que un reintento no descuente dos veces. No se hace push de vuelta (MELI ya descontó de su lado).
- `items`: refrescar el espejo `meli_item` (status, precio, cantidad). Si `available_quantity` difiere de `replacement.stock` sin push pendiente → registrar drift (auditoría) en vez de sobrescribir en silencio.

**Reconciliación**: job nocturno con scan completo por tenant que compara espejo vs `replacement.stock`, corrige empujando el valor local y reporta diferencias. Cubre webhooks perdidos (`missed_feeds` solo retiene 2 días).

### Recomendación 5 — Conexión por tenant

Una `meli_account` por tenant (coincide con el modelo multi-tenant). Variables de entorno globales de la app: `MELI_APP_ID`, `MELI_CLIENT_SECRET`, `MELI_REDIRECT_URI`, `MELI_TOKEN_ENC_KEY`. La `redirect_uri` debe ser **estática** y coincidir exacta con la registrada en MELI; el tenant viaja en el parámetro `state`.

- `state` = valor aleatorio de un solo uso, guardado en servidor y atado al usuario/tenant que inició el flujo (anti-CSRF). Validarlo en el callback.
- Si la app tiene PKCE habilitado en MELI, enviar `code_challenge` / `code_verifier`.
- **Refresh concurrente**: como el refresh token es de un solo uso, dos requests refrescando a la vez invalidan la cuenta. Hacer el refresh dentro de una transacción con `SELECT ... FOR UPDATE` sobre la fila de `meli_account` y releer antes de refrescar.
- El sitio (`MLA`, `MLC`, `MCO`…) sale de `Tenant.country`.

---

## Backend — módulo `meli` (`repuestito-api/src/meli/`)

```
meli.module.ts
meli-auth.service.ts        authorize URL, callback (code→token), refresh con lock, cifrado
meli-api.client.ts          fetch a api.mercadolibre.com con token vigente, retry 401/429/409
meli-import.service.ts      scan + items/bulk → upsert meli_item (job en background)
meli-link.service.ts        auto-match SKU/marca → crear Replacement, vínculo manual
meli-stock.service.ts       outbox push + reconciliación
meli-webhook.controller.ts  POST /api/meli/webhook (público, sin JwtAuthGuard)
meli.controller.ts          endpoints autenticados (abajo)
entities/                   meli-account, meli-item, meli-order-event
```

| Método | Ruta | Descripción |
|---|---|---|
| `GET` | `/api/meli/connect` | Devuelve la URL de autorización (con `state`) |
| `GET` | `/api/meli/callback` | Recibe `code`, guarda tokens, redirige al dashboard |
| `DELETE` | `/api/meli/connection` | Desconectar (borra tokens) |
| `POST` | `/api/meli/import` | Encola importación → `{ jobId }` |
| `GET` | `/api/meli/import/:jobId/status` | Estado del job (mismo patrón de polling que bulk-upload) |
| `GET` | `/api/meli/items` | Lista paginada de `meli_item` con filtro `linked` / `unlinked` / `error` |
| `POST` | `/api/meli/items/:id/link` | Vincula a un `Replacement` existente o crea uno |
| `POST` | `/api/meli/items/auto-link` | Vincula en lote por SKU/marca |
| `POST` | `/api/meli/webhook` | Entrada de notificaciones de MELI |

Guards: todo excepto `webhook` con `JwtAuthGuard` + `RolesGuard` (`GOD`, `MODERATOR`); `tenantId` siempre desde `req.user`, nunca del body. `@Throttle` en `import`. Emitir eventos de auditoría (ver `audit-logging.md`) para conectar/desconectar, importar, vincular y drift de stock, sin guardar tokens.

El `callback` es un GET que llega desde el navegador del usuario: debe autenticarse por la cookie de sesión existente y validar `state` contra ese usuario.

## Frontend — `repuestito/`

- `services/meli.service.ts`: wrappers de fetch con `credentials: 'include'`, como `auth.service.ts`.
- `app/dashboard/integrations/meli/page.tsx` (Server Component) + un componente cliente para conexión, importación con polling y tabla de ítems.
- Estados en UI: **No conectado** → botón "Conectar Mercado Libre"; **Conectado** → cuenta, última importación, botón "Importar"; tabla con badge de estado (`vinculado`, `sin vincular`, `no gestionable` por variaciones, `error de sync`).
- Reusar `components/ui/` y `components/shared/` (tablas, botones, badges, paginador) antes de escribir HTML crudo; colores solo desde `styles/theme.css`.
- En el detalle de un repuesto vinculado, mostrar el estado de sync y el link (`permalink`) a la publicación.

## Deploy / infra

- Registrar la app en el panel de desarrolladores de MELI con `redirect_uri` `https://app.piezify.com/api/meli/callback` y `notification callback URL` `https://app.piezify.com/api/meli/webhook`, tópicos `items` y `orders_v2`.
- Agregar las 4 variables de entorno al `.env` del server en `/opt/piezify/repuestito-deploy/` (no van al repo).
- nginx ya rutea `/api/*` al backend; no requiere cambios. MELI notifica desde IPs fijas (lista en la doc) si se quiere filtrar.

---

## Orden de implementación sugerido

1. **Cuenta**: entidades + migración, `meli-auth` (connect, callback, refresh con lock, cifrado), desconectar. Probar con un usuario de test de MELI.
2. **Importar**: `meli-api.client`, importación con scan + bulk, endpoint de estado y listado. Verificar en un ítem real qué atributos traen marca/OEM y si `available_quantity` llega real.
3. **Vincular**: auto-match por SKU/marca, vínculo manual, UI de la tabla.
4. **Push de stock**: outbox en los puntos donde cambia `replacement.stock` (orders, invoice, update manual), job de envío, manejo de errores/revocación.
5. **Webhooks**: endpoint, `orders_v2` idempotente, `items` para el espejo.
6. **Reconciliación** nocturna + reporte de drift.
7. Precio, variaciones y stock multi-origen: fase 2.

## Riesgos y decisiones abiertas

- **Doble descuento**: si una venta MELI llega por `orders_v2` y además `items` trae la cantidad nueva, no aplicar ambas. Regla propuesta: `orders_v2` descuenta; `items` solo detecta drift.
- **Ventas locales y MELI a la vez** con stock 1: el `PUT` puede llegar tarde y MELI vende igual. Es inherente a la sincronización asíncrona; se mitiga con el push inmediato y, si se desea, un stock de seguridad (publicar `stock - N`). Decisión de negocio pendiente.
- **Ítems sin SKU**: pueden ser una parte grande del inventario. Definir si se permite crear `Replacement` con `sku = null` (el modelo lo permite) o se exige completar antes de vincular.
- **Sucursales**: un `Replacement` es de una sola sucursal (o null). Si el tenant tiene stock repartido, el ítem MELI representa el total y hay que decidir a qué sucursal se asigna.
- **Límite de la API**: MELI aplica rate limiting (`local_rate_limited 429`); la importación debe hacer backoff y ser reanudable.
- **Cuenta operador**: el flujo falla si quien autoriza no es el administrador de la cuenta MELI; mostrar el error de forma clara en la UI.
