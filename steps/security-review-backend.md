# Security review — backend (`repuestito-api`)

> Fecha: 2026-08-29. Alcance: `repuestito` (frontend) + `repuestito-api` (backend). El frontend no arrojó hallazgos de alta confianza (sin `dangerouslySetInnerHTML`, sin secretos hardcodeados, `middleware.ts` verifica JWT correctamente, sin SSRF). Los 5 hallazgos confirmados están todos en el backend NestJS y comparten una causa raíz: **falta de scoping por tenant** — muchos endpoints confían en un `tenantId` provisto por el cliente (query/body) en vez de derivarlo de `req.user`, y las rutas de gestión de usuarios no aplican jerarquía de roles.

---

## Vuln 1: Cross-tenant IDOR en Orders/Invoices/Customers

`src/order/orders.controller.ts:26-77`, `src/invoice/invoices.controller.ts:26-67`, `src/customer/customer.controller.ts:24-32`

- **Severity**: High
- **Category**: idor / broken-multi-tenancy
- **Confidence**: 9/10

**Descripción**: Los endpoints de `OrdersController`, `InvoicesController` y `CustomerController` (list, read, confirm, fulfill, cancel, summary) toman `tenantId` de `@Query('tenantId')`/`@Body('tenantId')` y lo pasan sin validar a los services, que lo usan directo en el `WHERE tenant_id = $X`. Nunca se compara contra `req.user.tenantId`. Los guards (`JwtAuthGuard` + `RolesGuard`) solo verifican rol, nunca tenant. `GET /tenants` (solo `JwtAuthGuard`, sin roles) permite enumerar tenants reales sin necesidad de adivinar UUIDs.

**Exploit**: Cualquier usuario autenticado con rol SELLER/MODERATOR/GOD (de cualquier tenant) llama `GET /tenants` para obtener el UUID de un competidor, y luego `GET /orders?tenantId=<víctima>`, `GET /invoices?tenantId=<víctima>&from=...&to=...`, `GET /invoices/summary?tenantId=<víctima>` y `GET /customers?tenantId=<víctima>` para leer su historial de ventas, facturación y PII de clientes; también puede mutar con `PATCH /orders/:id/confirm`, `POST /orders/:id/fulfill`, `PATCH /orders/:id/cancel` y `PATCH /invoices/:id/cancel` pasando el `tenantId` de la víctima.

**Fix**: Eliminar `tenantId` del query/body en estos endpoints; derivarlo exclusivamente de `req.user.tenantId` (como ya hace `ReplacementController`), y exigir rol `GOD` explícito para operar sobre un `tenantId` ajeno.

---

## Vuln 2: Auto-registro público permite unirse a cualquier tenant con rol elevado

`src/auth/dto/register.dto.ts:13-19`, `src/auth/auth.service.ts:63-70`, `src/user/user.entity.ts:29`

- **Severity**: High
- **Category**: privilege-escalation / broken-access-control
- **Confidence**: 9/10

**Descripción**: `POST /auth/register` es público (sin guards) y acepta `tenantId`/`branchId` opcionales (`@IsUUID() @IsOptional()`) que `AuthService.register` guarda tal cual, sin validarlos contra ninguna invitación. `User.role` tiene `default: MODERATOR`, rol que ya alcanza para pasar los guards `@Roles(GOD, MODERATOR)` de `UserController`, `ReplacementController`, `BranchController`, `UploadController` y bulk-upload. Existe un flujo de invitación real (`POST /auth/invite`, protegido con `@Roles(GOD)`), pero el registro público lo bypassea completamente.

**Exploit**: Un atacante envía `POST /auth/register {email, password, tenantId: "<uuid-tenant-víctima>"}`, verifica el email con el código recibido (paso normal, no una barrera) y obtiene un JWT válido con `role: MODERATOR` y `tenantId` de la víctima — acceso inmediato a operaciones de nivel dashboard de ese negocio (crear/borrar repuestos, subir imágenes, crear sucursales) sin haber sido invitado nunca.

**Fix**: El registro público no debería aceptar `tenantId`/`branchId` en absoluto; los usuarios deberían nacer sin tenant y sin rol elevado hasta que un admin los asigne explícitamente vía `/auth/invite` o `/users`.

---

## Vuln 3: Escalación de privilegios vía `UserController` (MODERATOR → GOD)

`src/user/user.controller.ts:13-14,32-45`, `src/user/dto/create-user.dto.ts:15-18`, `src/user/dto/update-user.dto.ts:17-20`, `src/user/user.service.ts:47-70`

- **Severity**: High
- **Category**: privilege-escalation
- **Confidence**: 9/10

**Descripción**: `UserController` está guardado a nivel de clase con `@Roles(GOD, MODERATOR)`, sin override a nivel de método, así que un MODERATOR pasa el guard en `POST /users` y `PATCH /users/:id`. Ambos DTOs aceptan `role` validado solo con `@IsEnum(UserRole)` (GOD incluido), sin restricción según el rol del caller. `UserService.createUser`/`updateUser` aplican el `role`/`tenantId`/`branchId` recibidos sin ningún chequeo de jerarquía, y `updateUser` tampoco compara el `id` objetivo contra el usuario autenticado.

**Exploit**: Un MODERATOR autoregistrado (Vuln 2) llama `PATCH /users/<su-propio-id>` con `{role: "GOD"}` (o crea un usuario GOD nuevo vía `POST /users`), convirtiéndose en administrador total de la plataforma.

**Fix**: Enforce una jerarquía de roles en `RolesGuard` o `UserService`: un caller solo puede asignar/modificar roles iguales o inferiores al propio, solo GOD puede otorgar GOD, y nunca permitir que un usuario cambie su propio rol.

---

## Vuln 4: Tenant/Branch sin scoping de ownership en lectura y mutación

`src/tenant/tenant.controller.ts:39-52`, `src/branch/branch.controller.ts:27-52`, `src/branch/branch.service.ts:20-35`, `src/branch/dto/update-branch.dto.ts:34-35`

- **Severity**: High
- **Category**: idor / information-disclosure
- **Confidence**: 9/10

**Descripción**: `TenantController.findAll/findOne` y `BranchController.findAll/findOne` solo exigen `JwtAuthGuard` (sin `@Roles`), así que cualquier usuario autenticado (incluido SELLER) puede listar todos los tenants (`businessName`, `taxId`, `subdomain`) y todas las branches (`nombre`, `dirección`, `teléfono`, `tenantId`) de toda la plataforma sin filtro. Además, aunque `BranchController.update/remove` sí exigen rol `GOD/MODERATOR`, `BranchService.update/findOne` buscan la branch solo por `id` sin comparar `tenantId` del caller, y `UpdateBranchDto` permite reasignar `tenantId` libremente.

**Exploit**: Un MODERATOR de cualquier tenant llama `GET /tenants` y `GET /branches` para enumerar todos los negocios y sucursales de la plataforma, y luego `PUT /branches/<id-de-un-competidor>` con `{tenantId: "<mi-tenant>"}` para secuestrar la sucursal de otro negocio.

**Fix**: Restringir el listado sin filtro a rol `GOD`; para el resto de roles forzar el filtro a `req.user.tenantId`. `BranchService.update/remove/findOne` deben exigir `tenantId` coincidente para callers no-GOD, replicando el patrón ya usado en `ReplacementService`.

---

## Vuln 5: `/stats` filtra métricas de negocio de toda la plataforma, no solo del tenant

`src/stats/stats.controller.ts:22-27`, `src/stats/stats.service.ts:20-31,33-111`

- **Severity**: Medium
- **Category**: information-disclosure / broken-multi-tenancy
- **Confidence**: 9/10

**Descripción**: `GET /stats/sales` solo exige `JwtAuthGuard`, y `getSalesTimeline` suma `invoices.total` sin ningún `WHERE tenant_id`, devolviendo revenue diario agregado de toda la plataforma. `getDashboardStats` escopea correctamente el conteo de `customers` por `tenantId` (tomado de `req.user`, fuente segura), pero las queries de `brand_replacements`, `replacement` (valuación de inventario), `orders` e `invoices` no tienen filtro de tenant alguno, mezclando datos globales con el resultado.

**Exploit**: Cualquier usuario autenticado (SELLER incluido) de un tenant pequeño llama `GET /stats/dashboard` o `GET /stats/sales?days=30` con su propio JWT y obtiene revenue agregado, valuación de inventario y volumen de órdenes de todos los negocios de la plataforma combinados, no solo del propio.

**Fix**: Propagar `req.user.tenantId` a cada sub-query de `getDashboardStats` y agregar el filtro de `tenant_id` faltante en `getSalesTimeline`; reservar una vista "toda la plataforma" solo para rol `GOD`.
