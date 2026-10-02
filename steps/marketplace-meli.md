Por favor, necesito implementar la integración del sistema con la API de Mercado Libre para sincronizar stock en tiempo real, utilizando PostgreSQL como base de datos. 

Para mantener la arquitectura limpia y escalable (multi-tenant y multi-sucursal), debemos seguir exactamente las siguientes pautas de diseño y flujos:

### 1. Autenticación OAuth por Tenant (Mercado Libre)
Es multi-tenant: no existe un token único de la app, cada negocio conecta **su propia cuenta** de Mercado Libre. Sin esto, los flujos 5A/5B no tienen con qué autenticarse contra la API.

Nueva tabla `marketplace_credentials`:
- id (UUID, Primary Key)
- tenant_id (UUID, not null, FK a `tenants(id)`, único junto con `platform`)
- platform (VARCHAR(50), default 'mercadolibre')
- ml_user_id (BIGINT, not null - ID del vendedor en ML)
- access_token (TEXT, guardado encriptado, no texto plano)
- refresh_token (TEXT, guardado encriptado)
- expires_at (TIMESTAMPTZ, not null)
- created_at / updated_at (TIMESTAMPTZ)

Flujo de conexión (Authorization Code, como exige la API de ML):
1. `GET /api/marketplace/mercadolibre/connect` (autenticado, rol GOD/MODERATOR del tenant): genera un `state` atado al `tenant_id` del usuario (con TTL corto) y redirige a `https://auth.mercadolibre.com/authorization?...`.
2. `GET /api/marketplace/mercadolibre/callback`: recibe `code` + `state`, valida el `state` contra lo emitido, intercambia el `code` por `access_token`/`refresh_token` (`POST /oauth/token`) y crea o actualiza la fila de `marketplace_credentials` para ese tenant.

Refresh de tokens:
- Antes de cada llamada a la API de ML (flujos 5A/5B), verificar `expires_at`; si está vencido o por vencer, refrescar con `refresh_token` (`grant_type=refresh_token`) y persistir el par nuevo.
- Si el refresh falla (token revocado desde ML, o expirado más allá del grace period), marcar las credenciales como inválidas y notificar al tenant para reconectar. Los flujos 5A/5B deben tolerar un tenant sin credenciales válidas sin romper el resto del sistema (loguear y saltar ese tenant, no tirar la sincronización completa).

### 2. Nueva Tabla de Mapeo (Marketplace Mappings)
Crear una tabla llamada `marketplace_mappings` para asociar nuestros productos globales con Mercado Libre sin alterar las tablas core:
- id (SERIAL o UUID, Primary Key)
- tenant_id (UUID, not null)
- global_replacement_id (INTEGER, Foreign Key referenciando a `global_replacements(id)`, not null)
- platform (VARCHAR(50), default 'mercadolibre')
- ml_item_id (VARCHAR(50), not null - ID de la publicación en ML, ej: MLA123456789)
- ml_variation_id (BIGINT, nullable - Para productos con variantes/talles/colores)
- sync_enabled (BOOLEAN, not null, default true)
- created_at (TIMESTAMP, default NOW())

Índice único o compuesto recomendado por `tenant_id` + `global_replacement_id` + `ml_item_id` para búsquedas rápidas.

### 3. Manejo de Exclusiones y Artículos No Sincronizados
No todos los productos del sistema se venden en Mercado Libre.
- La bandera `sync_enabled` de `marketplace_mappings` (arriba) permite pausar la sincronización de un mapeo puntual sin borrarlo (ej. el tenant sacó de pausa la publicación en ML pero quiere mantener la asociación).
- Las funciones de sincronización de stock (cambios locales en el flujo 5A, y el job de conciliación) deben validar **obligatoriamente**, antes de hacer cualquier petición HTTP a la API de ML:
  1. Que exista un mapeo en `marketplace_mappings` para ese `global_replacement_id` + `tenant_id`.
  2. Que el mapeo tenga `ml_item_id` no nulo/vacío.
  3. Que `sync_enabled = true`.
- Si alguna de las tres condiciones no se cumple, el proceso se omite silenciosamente (sin lanzar excepción ni loguear como error) — es un caso esperado, no una falla. Un `Logger.debug` (no `warn`/`error`) alcanza si se quiere trazar.
- Esto aplica también al flujo 5B en sentido inverso: si llega una notificación de venta de ML para un `ml_item_id` que no tiene mapeo activo (se desactivó la sync después de la venta, o nunca se completó el mapeo), la notificación queda registrada en `ml_notifications` pero no debe intentar descontar stock — se marca `status: 'failed'` con el motivo, para revisión manual, sin reintentar indefinidamente.

### 4. Lógica de Sincronización de Stock (Multi-sucursal)
Nuestra segunda tabla maneja stock e inventario por sucursal (`branch_id`) vinculada al `global_replacement_id` y `tenant_id`. 
Para la sincronización con Mercado Libre, el stock disponible a publicar o actualizar debe calcularse **sumando el stock total disponible de todas las sucursales** (o de un depósito central asignado para e-commerce, según se configure).

**Importante — scope por tenant:** `global_replacement_id` pertenece al catálogo compartido (`global_replacements`), no a un tenant. La suma de stock para ese cálculo tiene que filtrar siempre por `tenant_id` (`SUM(stock) WHERE global_replacement_id = X AND tenant_id = Y`), nunca sumar entre todos los tenants que listan el mismo producto del catálogo — si no, el stock que se publica en la cuenta de ML de un negocio terminaría reflejando también el inventario de otros negocios que ni se conocen entre sí.

### 5. Flujos a Desarrollar

#### A. Salida: Actualizar stock en Mercado Libre desde nuestro sistema
- Cuando ocurra un movimiento de stock en la segunda tabla (venta física, ajuste, ingreso), el sistema debe:
  1. Identificar el `global_replacement_id` afectado.
  2. Consultar la tabla `marketplace_mappings` para obtener el `ml_item_id` (y `ml_variation_id` si aplica) — aplicando las validaciones de la sección 3 (mapeo existente, `ml_item_id` válido, `sync_enabled = true`) antes de seguir.
  3. Calcular el stock consolidado actual para ese producto.
  4. Realizar una petición `PUT` a la API de Mercado Libre (`/items/{ITEM_ID}` o `/items/{ITEM_ID}/variations/{VARIATION_ID}`) enviando el nuevo `available_quantity`, usando el `access_token` vigente del tenant (sección 1).

#### B. Entrada: Webhook de Ventas de Mercado Libre (Descuento de stock local)
- Crear un endpoint receptor de webhooks (`/api/webhooks/mercadolibre`) para el tópico `orders`.
- Al recibir una notificación de venta (`order_id`):
  1. Consultar la API de Mercado Libre (`GET /orders/{ORDER_ID}`) para extraer los ítems y cantidades compradas, usando el `access_token` del tenant correspondiente.
  2. Cruzar el `item_id` y `variation_id` con la tabla `marketplace_mappings` para obtener el `global_replacement_id` — si no hay mapeo activo (sección 3), marcar la notificación como `failed` para revisión manual y no continuar.
  3. Descontar el stock en la segunda tabla de inventario afectando a la sucursal de comercio electrónico o depósito central correspondiente, manejando transacciones SQL (`BEGIN` / `COMMIT` / `ROLLBACK`) para evitar sobreventa o inconsistencias.

### 6. Auditoría
El proyecto ya tiene un `AuditService` (`src/audit/`) usado en el resto de los módulos para registrar altas, bajas y cambios sensibles — reusarlo acá en vez de loguear solo con `Logger`:
- Registrar un evento de auditoría en cada sincronización de stock hacia ML (flujo 5A: `marketplace.stock_pushed`, con `before`/`after` de `available_quantity`) y en cada descuento disparado por una venta de ML (flujo 5B: `marketplace.stock_deducted_from_sale`, con el `order_id` de ML y el `global_replacement_id`/`branch_id` afectado).
- Registrar también los eventos de conexión/reconexión de credenciales (sección 1): `marketplace.connected`, `marketplace.token_refreshed`, `marketplace.token_refresh_failed` — sin loguear nunca `access_token`/`refresh_token` en texto plano (el `AuditService` ya sanitiza claves como `token`, pero conviene no pasarlas ni siquiera bajo otro nombre de campo).
- Esto da trazabilidad por tenant de qué sincronizó qué y cuándo, clave para debuggear discrepancias de stock entre el sistema y ML.

Por favor, implementa los servicios, controladores y endpoints necesarios para manejar esta arquitectura asegurando el manejo correcto de errores de red y concurrencia.

Por favor, implementa la lógica de sincronización bidireccional y de conciliación de stock con Mercado Libre utilizando la tabla de mapeo `marketplace_mappings` y nuestra tabla de stock multisucursal:
