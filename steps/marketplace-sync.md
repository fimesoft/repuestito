# Sincronización de stock con Mercado Libre — Cómo funciona

> Estado: **implementado en el backend** (`repuestito-api/src/marketplace/`), sin commitear ni desplegar. **No hay UI en el frontend todavía.**
>
> Este doc describe lo que está en el código. El spec original (lo que se pidió) está en `marketplace-meli.md`; el plan de investigación de la API de MELI, en `integration-with-meli.md`.

---

## Qué hace

Cada tenant conecta **su propia cuenta** de Mercado Libre y mapea sus productos a publicaciones de ML. A partir de ahí:

- **Salida (flujo A):** cuando cambia el stock de un producto en la app, se empuja el stock total a la publicación de ML.
- **Entrada (flujo B):** cuando ML notifica una venta, se descuenta el stock local de la sucursal de e-commerce.

```
Flujo A (salida)
  PATCH /api/replacements/:id (con stock)
    └─ ReplacementService.update → MarketplaceSyncService.pushStock()   (fire-and-forget)
          └─ PUT https://api.mercadolibre.com/items/{id}  { available_quantity }

Flujo B (entrada)
  ML ──POST /api/webhooks/mercadolibre──► ml_notifications (status "pending")
  Cron cada minuto ──► MarketplaceWebhookProcessorService.processPending()
          └─ GET /orders/{id} en ML ──► UPDATE replacement SET stock = stock - qty
```

---

## Módulos

```
repuestito-api/src/
  marketplace/
    marketplace.module.ts                       exporta MarketplaceSyncService
    marketplace-oauth.controller.ts             connect, callback, PATCH branch
    marketplace-mapping.controller.ts           CRUD de mapeos
    marketplace-credentials.service.ts          guarda/refresca tokens, sucursal de e-commerce
    marketplace-mapping.service.ts              CRUD + findActiveMapping / findActiveByItem
    marketplace-sync.service.ts                 flujo A (pushStock)
    marketplace-webhook-processor.service.ts    flujo B (processPending / processOne)
    marketplace-cron.service.ts                 @Cron cada minuto → processPending
    mercadolibre-api.service.ts                 fetch a la API de ML (OAuth, PUT stock, GET order)
    mercadolibre-country-domains.ts             dominio de auth por país
    dto/                                        create/update mapping, set-ecommerce-branch
  mercadolibre-webhook/                         receptor público + entidad ml_notifications
  common/crypto.util.ts                         AES-256-GCM para los tokens
  migrations/20260929000000-create-marketplace-credentials.ts
  migrations/20260929000001-create-marketplace-mappings.ts
```

`ScheduleModule.forRoot()` se agregó en `app.module.ts` para el cron. `ReplacementModule` importa `MarketplaceModule` para inyectar `MarketplaceSyncService`.

---

## Variables de entorno (`.env.example`)

| Variable | Para qué |
|---|---|
| `MELI_CLIENT_ID` / `MELI_CLIENT_SECRET` | Credenciales de la app en ML (requeridas al arrancar: `getOrThrow`) |
| `MELI_REDIRECT_URI` | URL del callback OAuth registrada en ML (`.../api/marketplace/mercadolibre/callback`) |
| `MARKETPLACE_TOKEN_ENC_KEY` | Clave de **32 bytes en base64** para cifrar tokens. Si falta o no mide 32 bytes, cifrar/descifrar lanza error |
| `MELI_APP_ID` | Ya existía: el webhook descarta notificaciones cuyo `application_id` no coincida |
| `FRONTEND_URL` | A dónde redirige el callback (default `http://localhost:4000`) |

Si faltan `MELI_CLIENT_*`/`MELI_REDIRECT_URI`, **la API no arranca** (el servicio los exige en el constructor).

---

## Tablas

### `marketplace_credentials` — una fila por tenant y plataforma

| Columna | Notas |
|---|---|
| `tenant_id` | FK `tenants` (`ON DELETE CASCADE`), único junto con `platform` |
| `ml_user_id` | bigint, vendedor en ML (se usa para ubicar el tenant al llegar un webhook) |
| `access_token` / `refresh_token` | **cifrados** con AES-256-GCM, formato `iv:authTag:ciphertext` en base64 |
| `expires_at` | timestamptz |
| `invalid_reason` | si no es `null`, las credenciales se consideran inválidas |
| `ecommerce_branch_id` | FK `branches` (`ON DELETE SET NULL`): sucursal cuyo stock se descuenta con las ventas |

### `marketplace_mappings` — producto del catálogo ↔ publicación de ML

`tenant_id`, `global_replacement_id` (FK `global_replacements`, `CASCADE`), `ml_item_id`, `ml_variation_id` (nullable), `sync_enabled` (default `true`). Único por `(tenant_id, global_replacement_id, ml_item_id)`; índices por `tenant_id` y `ml_item_id`.

### `ml_notifications` (ya existía)

Cola de webhooks. `status`: `pending` → `processed` | `failed`.

---

## Endpoints

Todos con `JwtAuthGuard` + `RolesGuard` (`GOD`/`MODERATOR`), salvo `callback` y el webhook. El `tenantId` sale del usuario (`resolveTenantId`); solo `GOD` puede pasar otro por query/body.

| Método y ruta | Qué hace |
|---|---|
| `GET /api/marketplace/mercadolibre/connect` | Redirige a ML para autorizar. Falla con 400 si el tenant no tiene país |
| `GET /api/marketplace/mercadolibre/callback` | Público. Valida `state`, intercambia `code` por tokens, guarda credenciales y redirige a `/dashboard/config?ml=connected` (o `?ml=error`) |
| `PATCH /api/marketplace/mercadolibre/branch` | Define la sucursal de e-commerce (`{ branchId }`). 404 si el tenant no conectó ML; valida que la sucursal sea del tenant |
| `POST/GET /api/marketplace/mappings` | Crear / listar mapeos. 409 si el producto ya está mapeado a esa publicación |
| `PATCH/DELETE /api/marketplace/mappings/:id` | Editar (ej. `syncEnabled: false`) / eliminar |
| `GET/POST /api/webhooks/mercadolibre` | Público y sin throttle. `GET` valida la URL; `POST` solo guarda la notificación como `pending` |

---

## Conexión OAuth

1. `connect` firma un `state` (JWT con `JWT_SECRET`, `{ tenantId, purpose: 'ml_oauth' }`, **expira en 10 min**) y redirige a `https://auth.<dominio-del-país>/authorization`. El dominio sale de `mercadolibre-country-domains.ts` (18 países); un país no listado lanza error.
2. `callback` verifica el `state`, hace `POST /oauth/token` y llama a `saveFromToken` (crea o actualiza la fila, limpia `invalid_reason`). Registra el evento de auditoría `marketplace.connected`.
3. Cualquier error del callback redirige a `?ml=error`, sin detalle.

### Refresh de tokens

`getValidAccessToken(tenantId)` se llama antes de cada request a ML:

- Sin credenciales, o con `invalid_reason` → devuelve `null`.
- Si faltan más de 60 s para `expires_at` → devuelve el token descifrado.
- Si no → refresca con `grant_type=refresh_token`, persiste el par nuevo (el `refresh_token` de ML es de un solo uso) y lo devuelve.
- Si el refresh falla → guarda `invalid_reason` (primeros 255 caracteres del error) y devuelve `null`. **Queda inválido hasta que el tenant vuelva a conectar** (`saveFromToken` lo limpia).

Los flujos tratan `null` como "omitir este tenant", nunca como excepción.

---

## Flujo A — empujar stock a ML

`MarketplaceSyncService.pushStock(globalReplacementId, tenantId)`:

1. Busca el mapeo activo: existe, mismo `tenant_id` y `sync_enabled = true`. Si no, sale con `Logger.debug`.
2. Obtiene un access token válido. Si es `null`, sale con `debug`.
3. Suma el stock **solo de ese tenant** en todas sus sucursales: `SUM(stock) FROM replacement WHERE global_replacement_id = $1 AND tenant_id = $2`. El catálogo es compartido entre tenants, por eso el filtro de tenant es obligatorio.
4. `PUT /items/{item}` (o `/items/{item}/variations/{variation}` si hay `ml_variation_id`) con `{ available_quantity }`.
5. Audita `marketplace.stock_pushed` con `after: { availableQuantity }`.

**Nunca lanza**: todo el método está en un `try/catch` que solo loguea. Se invoca con `void` (sin `await`) desde `ReplacementService.update`, así que un ML lento o caído no afecta la respuesta del PATCH.

---

## Flujo B — ventas de ML descuentan stock

**Recepción.** El webhook solo valida y guarda (`pending`); descarta payloads sin `topic`/`resource` y los de otra `application_id`. Un `notification_id` repetido se ignora (violación de unicidad).

**Procesamiento.** `MarketplaceCronService` corre cada minuto (con un flag `running` para no solapar corridas) y toma hasta 20 notificaciones `pending` de topic `orders_v2`, de la más vieja a la más nueva. Para cada una:

| Situación | Resultado |
|---|---|
| `resource` no es `/orders/{id}` | `failed` |
| Sin `user_id` | `failed` |
| Ningún tenant tiene ese `ml_user_id` | `failed` |
| El tenant no configuró `ecommerce_branch_id` | `failed` |
| Sin credenciales válidas | `failed` |
| `GET /orders/{id}` falla (red/API) | queda `pending`, se **reintenta** en la próxima corrida |
| OK | transacción SQL; al terminar, `processed` |

Dentro de la transacción, por cada ítem de la orden:

- Si no hay mapeo activo para el `item.id` → se **omite** (con `debug`) y sigue con el siguiente ítem.
- Si lo hay, ejecuta de forma atómica:
  ```sql
  UPDATE replacement SET stock = stock - $qty
  WHERE global_replacement_id = $1 AND tenant_id = $2 AND branch_id = $3 AND stock >= $qty
  RETURNING id
  ```
  La condición `stock >= qty` evita stock negativo y no hace falta bloquear la fila.
- Audita `marketplace.stock_deducted_from_sale` dentro de la misma transacción, con `outcome` `succeeded` o `failed` según si el `UPDATE` afectó una fila.

---

## Auditoría

Eventos registrados con `AuditService`: `marketplace.connected`, `marketplace.stock_pushed`, `marketplace.stock_deducted_from_sale`. Los tokens nunca se pasan al audit.

---

## Diferencias con el spec (`marketplace-meli.md`) y límites actuales

- **Sin UI.** No hay pantalla para conectar la cuenta, elegir la sucursal de e-commerce ni mapear productos; hoy todo es por API. El callback redirige a `/dashboard/config?ml=...`, pero esa página no lo maneja todavía.
- **Sin job de conciliación.** El spec pedía uno; solo existe el cron que procesa webhooks.
- **Eventos de auditoría no implementados:** `marketplace.token_refreshed` y `marketplace.token_refresh_failed` (el fallo solo se loguea y se guarda en `invalid_reason`). No hay notificación al tenant para que reconecte.
- **Venta sin mapeo:** el spec decía marcar la notificación `failed`. En el código el ítem se omite y la notificación queda `processed`. Lo mismo si el descuento falla por stock insuficiente: queda `processed` y el fallo solo se ve en la auditoría (`outcome: failed`) y en el log.
- **Notificaciones `failed` no se reintentan** ni hay forma de reprocesarlas desde la app.
- **`pushStock` solo se dispara en `PATCH /replacements/:id` cuando viene `stock`.** No se llama al crear un producto, en la carga masiva, ni después de que una venta de ML descuente stock local (el stock en ML ya descontó por su lado).
- **Un `GET /orders` que falla se reintenta sin límite** (no hay contador de intentos propio).
- **El tópico procesado es solo `orders_v2`.** Otros topics se guardan pero nunca se procesan.
- **Sin tests** para el módulo `marketplace/` (solo existe el spec del controlador del webhook).
- `findActiveMapping` devuelve un solo mapeo: si un producto está mapeado a varias publicaciones, solo se sincroniza la primera que encuentre.

---

## Pendiente antes de desplegar

1. Correr las dos migraciones (`20260929000000`, `20260929000001`).
2. Configurar en el servidor `MELI_CLIENT_ID`, `MELI_CLIENT_SECRET`, `MELI_REDIRECT_URI`, `MARKETPLACE_TOKEN_ENC_KEY` y `FRONTEND_URL`. Generar la clave con `openssl rand -base64 32`.
3. Registrar en el panel de la app de ML la URL de callback y la de notificaciones (`/api/webhooks/mercadolibre`, tópico `orders_v2`).
4. `package.json` y `package-lock.json` cambiaron (se sumó `@nestjs/schedule`): reconstruir la imagen del `api`.
