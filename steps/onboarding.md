# Onboarding (first login) — Plan de trabajo

> Creado: septiembre 2026. Implementado (frontend + backend), compila sin errores en ambos proyectos. Pendiente de probar el flujo completo en navegador.

---

## Problema

Un usuario recién registrado (`register` → `verify-email` → `login`) puede no tener `tenantId` ni `branchId` (`User.tenantId`/`User.branchId` son `nullable` en `repuestito-api/src/user/user.entity.ts`). Hoy nada distingue ese estado: `DashboardSidebar` (`components/features/dashboard/DashboardSidebar.tsx`) renderiza todo `NAV_SECTIONS` filtrando solo por rol (`hasRole`, vía `usePermissions`), sin mirar `currentUser.tenantId`/`branchId`. El usuario puede navegar a secciones que asumen un tenant (`replacement`, `bulk-upload`, `compatibility`, etc.) sin tenerlo, lo que rompe o produce comportamiento inconsistente en el backend (ver `steps/file-upload.md`: "El usuario no tiene un tenant asignado").

## Objetivo

Detectar *first login* (`tenantId === null` en `AuthUser`, expuesto por `getMeClient()`/`/api/auth/me`) y, mientras dure ese estado, restringir la navegación del dashboard a una única opción: crear su local + primera sucursal (flujo ya existente en `TenantBranchWizard`, hoy montado solo en `app/(main)/dashboard/stores/page.tsx`). Recién al completar ese wizard (backend crea `Tenant` + `Branch` en una transacción — ver `TenantBranchWizard.tsx:75-76`) se habilita el resto del menú.

## Por qué importa

- Evita estados rotos: secciones que dependen de `tenantId` (bulk-upload, listado de repuestos, compatibilidades, facturación) no tienen sentido — y en el backend fallan — sin un tenant asociado.
- Guía al usuario nuevo directo a la única acción que necesita hacer antes de operar, en vez de dejarlo elegir entre un menú completo donde la mayoría de las opciones no le sirven todavía.

## Cambios propuestos

### Frontend

- `hooks/usePermissions.ts`: exponer un derivado `needsOnboarding: boolean` (`currentUser !== null && currentUser.tenantId === null`), calculado a partir de lo que ya devuelve `getMeClient()` — `AuthUser` ya trae `tenantId`/`branchId` (`services/auth.service.ts:9-10`), no hace falta un endpoint nuevo.
- `components/features/dashboard/DashboardSidebar.tsx`: cuando `needsOnboarding` sea `true`, renderizar solo un item (p. ej. "Crear mi local", ícono `/icons/store.svg`) en vez de iterar `NAV_SECTIONS`.
- `app/(main)/dashboard/layout.tsx`: gate a nivel de layout — si `needsOnboarding`, forzar el `TenantBranchWizard` abierto (o redirigir a una ruta dedicada, ver "Decisión pendiente" abajo) y bloquear el render de `children`.
- `TenantBranchWizard`: hoy se cierra con `onClose` sin recargar `currentUser` — al completar el wizard exitosamente hay que refrescar `getMeClient()` (o invalidar el estado en `usePermissions`) para que `needsOnboarding` pase a `false` sin requerir un logout/login manual.

### Backend

- No requiere cambios: `tenantId`/`branchId` ya son nullable y `auth.controller.ts:85-89` (`me()`) devuelve el `User` completo (menos campos sensibles), así que ya incluye ambos campos — confirmado, `AuthUser` en el frontend no está adelantado al contrato real.

## Decisión pendiente — resuelta: gate en `layout.tsx`, no en `middleware.ts`

Revisé `middleware.ts` y el `login()` de `auth.service.ts:134-138`: el JWT solo firma `{ sub, email, role }` — **no lleva `tenantId`**. Eso descarta la opción de middleware sin cambios adicionales:

- Para que `middleware.ts` pudiera decidir el redirect sin un fetch extra, habría que agregar `tenantId` al payload del JWT. Pero la cookie dura 30 min (`COOKIE_OPTIONS.maxAge`, `auth.controller.ts:22`) y no se reemite sola — si el usuario completa el wizard, seguiría con un token "viejo" (`tenantId: null` embebido) hasta volver a loguearse o que expire la cookie. Requeriría re-emitir el token al completar el onboarding, complejidad no justificada para esto.
- La alternativa de hacer `fetch('/api/auth/me')` directo desde el middleware (Edge runtime) agrega un round-trip a la API en *cada* navegación dentro de `/dashboard/**`, no solo en la primera carga.

Por eso el gate va en `app/(main)/dashboard/layout.tsx`, client-side, apoyado en `usePermissions()` — como estaba planteado como primera opción.

### Resuelto: `AuthUserProvider` centraliza el fetch de `/me`

`usePermissions()` no cacheaba ni compartía el fetch: cada componente que lo llamaba disparaba su propio `useEffect` → `getMeClient()` (2+ llamadas a `/me` por carga de página, entre `DashboardSidebar` y la página activa). Se implementó `context/AuthUserContext.tsx`: `AuthUserProvider` resuelve `getMeClient()` una sola vez y expone `{ currentUser, loading, refetch }` vía contexto; `usePermissions()` (`hooks/usePermissions.ts`) ahora solo lee de `useAuthUser()` en vez de fetchear por su cuenta. El provider se montó en `app/(main)/dashboard/layout.tsx`, envolviendo `DashboardSidebar` + `children` — único lugar donde se usa `usePermissions()` en todo el frontend (confirmado por grep).

El `refetch` expuesto por el contexto es lo que el gate de onboarding va a usar: al cerrar `TenantBranchWizard` con éxito, llamar `refetch()` para que `needsOnboarding` pase a `false` sin recargar la página.

## Implementado

- `hooks/usePermissions.ts` — `needsOnboarding: boolean` (`currentUser !== null && currentUser.tenantId === null`).
- `components/features/tenants/TenantBranchWizard.tsx` — prop `onSuccess?: () => void`, se dispara tras `createTenant()` exitoso.
- `components/features/dashboard/OnboardingGate.tsx` (nuevo) — mientras `usePermissions().loading` muestra `Loading`; si `needsOnboarding`, renderiza el wizard forzado abierto (`onClose` no-op) en vez de `children`, y llama `refetch()` del `AuthUserContext` al completarlo.
- `app/(main)/dashboard/layout.tsx` — envuelve `children` con `OnboardingGate` (sidebar y `MobileBottomNav` quedan afuera para no perder el logout).
- `components/features/dashboard/DashboardSidebar.tsx` — si `needsOnboarding`, muestra un único ítem no clickeable ("Crear mi local") en vez de `NAV_SECTIONS`.

### Bug bloqueante encontrado y corregido: `POST /api/tenants` era `GOD`-only

El wizard llama a `createTenant()` → `POST /api/tenants`, pero ese endpoint tenía `@Roles(UserRole.GOD)` (`tenant.controller.ts:20`). Un usuario self-registrado es `MODERATOR` por default (`user.entity.ts:29`) — ningún usuario podía completar el onboarding que se acababa de construir, tiraba 403 siempre. Corregido:

- `tenant.controller.ts`: `@Roles(UserRole.GOD, UserRole.MODERATOR)`; el controller pasa `req.user` al service.
- `tenant.service.ts` `create(dto, requester)`: si `requester.role !== GOD` y ya tiene `tenantId`, `403 { code: TENANT_ALREADY_ASSIGNED }` (no puede crear un segundo tenant por esta vía). Si no, crea tenant+sucursal y, **en la misma transacción**, hace `queryRunner.manager.update(User, requester.id, { tenantId, branchId })` — sin esto, el wizard "funcionaba" pero el usuario quedaba con `tenantId: null` para siempre y el gate no se apagaba nunca.
- Un `GOD` sigue pudiendo crear tenants para terceros sin auto-asignárselos (comportamiento previo intacto).

### Formato de errores estandarizado

A pedido explícito: los 403 ahora tienen la misma forma `{ statusCode, code }` que ya usaba `login()` (`auth.service.ts:119`, `ErrorCodes.INVALID_CREDENTIALS`), en vez del shape default de Nest `{ statusCode, message, error }`.

- `common/error-codes.ts`: `INSUFFICIENT_PERMISSIONS` (403 genérico de rol insuficiente) y `TENANT_ALREADY_ASSIGNED`.
- `auth/guards/roles.guard.ts`: el 403 de `RolesGuard` (compartido por *todos* los endpoints con `@Roles`, no solo tenants) pasó de `ForbiddenException('No tienes permisos para esta acción')` a `ForbiddenException({ statusCode: 403, code: ErrorCodes.INSUFFICIENT_PERMISSIONS })`.
- `lib/api-errors.ts`: `ERROR_MESSAGES` con las traducciones de ambos códigos nuevos (`translateApiError` ya sabía priorizar `code` sobre `message`).

## Alcance no cubierto (por ahora)

- Qué pasa con un usuario `SELLER` invitado (`POST /api/auth/invite`) que ya viene con `tenantId`/`branchId` asignados por quien lo invita — ese caso no dispara onboarding, se asume cubierto por el chequeo de `tenantId === null`.
- Onboarding de sucursal adicional para un tenant que ya existe — fuera de alcance, eso ya lo cubre `stores/page.tsx` con `createBranch`.

---

# v2 — Wizard mejorado de primer ingreso

> Creado: 2026-09-22. Estado: **implementado** (backend + frontend), sin commitear. Backend probado contra la API local (ver "Verificación"); el wizard compila y pasa lint, falta probarlo en el navegador.

## Implementado (2026-09-22)

**Backend (`repuestito-api`)**
- `user.entity.ts`: `name`, `lastname`, `phone` (columnas de `AddUserContactFields`).
- `GET /api/countries?active=true` (`QueryCountryDto.active`).
- Módulo `document-type/` (entity, service, controller): `GET /api/document-types?countryId=X` → activos del país + globales, default primero.
- Migration `1790130300000-AddTenantDocumentType`: `tenants.document_type_id` (FK a `document_types`).
- `CreateTenantDto`: `country` requerido, `documentTypeId` requerido, `owner { name, lastname }` opcional (obligatorio salvo GOD, `TENANT_OWNER_REQUIRED`); `subdomain` eliminado.
- `tenant/subdomain.util.ts`: `toSubdomain`, `RESERVED_SUBDOMAINS`, `SUBDOMAIN_MIN_LENGTH`.
- `tenant.service.ts` `create()`: deriva el subdominio, valida largo/reservados/duplicado, valida tipo de documento (país o global) y formato del número, guarda `document_type_id` y `name`/`lastname` del usuario en la misma transacción; las violaciones de `UNIQUE` de subdominio y `taxId` dentro de la transacción salen como 409.

**Frontend (`repuestito`)**
- `lib/subdomain.ts` (copia de la lógica del backend), `services/document-type.service.ts`, `getCountries({ active })`.
- `services/tenant.service.ts`: payload nuevo; `createTenant` lanza `ApiError` con `code`, y ante 5xx o error de red un mensaje genérico.
- `Confirm`: prop `onError` + `Alert` con el error dentro del modal.
- `TenantBranchWizard`: 3 pasos (País → Local → Sucursal), prop `isOnboarding` (pide nombre/apellido, sin "Cancelar"), `Confirm` con resumen; errores `TENANT_*` vuelven al paso 2 marcando el campo. `OnboardingGate` pasa `isOnboarding`; `stores/page.tsx` (GOD) usa el wizard sin esos campos.

## Verificación

Script temporal contra la API local con un usuario `MODERATOR` sin tenant (creado y borrado por el script):

| Caso | Resultado |
|---|---|
| `GET countries?active=true`, `GET document-types` AR / BO / VE | 200 (BO solo trae Pasaporte) |
| Sin `owner` | 400 `TENANT_OWNER_REQUIRED` |
| Nombre `!!` | 400 `TENANT_NAME_TOO_SHORT` |
| Nombre `App` | 400 `TENANT_NAME_RESERVED` |
| DNI `12` | 400 `TENANT_TAX_ID_INVALID` |
| Tipo de documento de VE para un local AR | 400 `TENANT_DOCUMENT_TYPE_INVALID` |
| Nombre existente en mayúsculas | 409 `TENANT_NAME_TAKEN` |
| `taxId` existente | 409 `TENANT_TAX_ID_TAKEN` (por el índice, camino de la carrera) |
| Válido ("Zz Prueba Onboarding Peña & Co", DNI `12.345.678`) | 201; subdominio `zz-prueba-onboarding-pena-co`, `taxId` `12345678`, usuario con nombre/apellido y tenant |

Ojo al limpiar tenants de prueba: las particiones de `invoices`/`orders` tienen FKs desde `*_items`, hay que hacer `DETACH PARTITION` antes de `DROP` (nunca `DROP ... CASCADE`, borra la FK del padre).

## Objetivo

Rehacer `TenantBranchWizard` (el que monta `OnboardingGate`) para pedir los datos en este orden:

1. **País** — primer paso, condiciona los tipos de documento del paso 2.
2. **Local** — nombre del local (tenant), nombre y apellido del usuario, tipo de documento + número (del tenant), subdominio autogenerado.
3. **Sucursal** — se mantiene el paso actual (nombre, dirección, teléfono) salvo que se decida lo contrario (ver "Decisiones pendientes").

Al pulsar "Guardar" se abre `Confirm` (`components/shared/Confirm`, el mismo de pedidos/facturación en `SaleForm.tsx:402`) con un resumen; `onConfirm` hace el `createTenant()` y `onSuccess` dispara el `refetch()` de `AuthUserContext`.

## Estado actual (relevado)

| Pieza | Estado |
|---|---|
| `GET /api/countries` | **Existe** (`country.controller.ts:40`), pero paginado (`limit` default 20), con `JwtAuthGuard` y **sin filtrar `active`**. Hay 20 países cargados (migration `SeedLatamCountries1790124020000`). |
| `document_types` | Tabla + seed en `1790130000000-CreateDocumentTypes.ts` (**sin commitear**). No hay entity, módulo ni endpoint. Seed solo para CO, PE, AR, VE, CL + `PASSPORT` global (`country_id NULL`). |
| `users.name` / `users.lastname` | Columnas en `1790130100000-AddUserContactFields.ts` (**sin commitear**), pero **no están en `user.entity.ts`**. |
| `tenants.taxId` | Existe (`varchar(50)`), sin referencia al tipo de documento. |
| `tenants.subdomain` | Único; `tenant.service.ts:32-33` ya devuelve 409 si está en uso. |
| `TenantBranchWizard` | 2 pasos (Local → Sucursal); el país sale de `useCountry()` (`CountryContext`, hardcodeado a AR/VE), taxId y subdominio se escriben a mano. |

## Cambios propuestos

### Backend (`repuestito-api`)

- **Countries:** en `findAll`, aceptar `active` en `QueryCountryDto` (o filtrar `active: true` siempre para no-admin). El wizard pide `?limit=100` para traer todo en una página. No hace falta endpoint nuevo.
- **Document types (nuevo módulo `document-type/`):**
  - `DocumentType` entity mapeando `document_types` (`countryId`, `code`, `name`, `pattern`, `placeholder`, `minLength`, `maxLength`, `isDefault`, `isActive`).
  - `GET /api/document-types?countryId=X` → activos del país **más** los globales (`country_id IS NULL`, p. ej. Pasaporte), ordenados con `is_default` primero. `JwtAuthGuard`, sin restricción de rol (lo usa un `MODERATOR` sin tenant).
- **Tenants:**
  - Migration: `tenants.document_type_id integer NULL` con FK a `document_types(id)`. Nullable porque los tenants existentes no lo tienen.
  - `CreateTenantDto`: `documentTypeId: number` (requerido) y `owner: { name, lastname }` (requeridos, `MaxLength(100)`).
  - `tenant.service.ts` `create()`: validar `taxId` contra `pattern`/`minLength`/`maxLength` del tipo elegido y que el tipo pertenezca al país del tenant o sea global (400 con `code` en `ErrorCodes`, mismo formato `{ statusCode, code }`). En la misma transacción que ya asigna `tenantId`/`branchId` al usuario, guardar también `name` y `lastname`.
  - El subdominio se deriva en el backend desde `businessName` (ver "Subdominio automático"); `subdomain` se quita del DTO.
- **User:** agregar `name` y `lastname` (nullable) a `user.entity.ts`, alineado con la migration existente.

### Frontend (`repuestito`)

- `services/country.service.ts`: reutilizar el listado existente con `limit=100` (y `active=true` si se agrega).
- `services/document-type.service.ts` (nuevo): `getDocumentTypes(countryId)`.
- `TenantBranchWizard` → 3 pasos:
  1. **País:** `Select` de `components/ui` con los países del API. Al cambiar de país se limpian tipo de documento y número.
  2. **Local:** `businessName`, `name`, `lastname`, `documentTypeId` (`Select`, preselecciona `isDefault`), `taxId` (usa `placeholder` del tipo y valida `pattern` en el cliente), `subdomain` en solo lectura, derivado del nombre del local.
  3. **Sucursal:** igual que hoy.
  - Reemplazar los `<input>` crudos por `Input`/`Select` de `components/ui` donde apliquen (regla de CLAUDE.md).
  - "Guardar" abre `Confirm` con el resumen (país, local, documento, subdominio, sucursal) en vez de llamar `createTenant()` directo. Errores del backend (409 de subdominio, 400 de documento) se muestran con `translateApiError`.
- `services/tenant.service.ts`: agregar `documentTypeId` y `owner` al payload de `createTenant`.

### Subdominio automático

Función pura en el wizard, recalculada en cada cambio del nombre del local:

```
"Repuestos Carlitos"  → "repuestos-carlitos"
"Autopartes Peña & Hijos" → "autopartes-pena-hijos"
```

`normalize('NFD')` + quitar diacríticos → minúsculas → todo lo que no sea `[a-z0-9]` pasa a `-` → colapsar guiones repetidos → recortar guiones de los extremos → cortar a 100 caracteres (límite de la columna).

**Nombres de local únicos (decidido):** no puede haber dos locales con el mismo nombre. La unicidad se aplica sobre el subdominio (ya tiene `UNIQUE`), no sobre `businessName`, porque nombres distintos pueden dar el mismo slug ("Repuestos Peña" / "Repuestos Pena" / "repuestos-peña" → `repuestos-pena`). Sin sufijos automáticos:

- `tenant.service.ts:33`: cambiar el 409 a `{ statusCode: 409, code: ErrorCodes.TENANT_NAME_TAKEN }` y traducirlo en `lib/api-errors.ts` ("Ya existe un local con ese nombre").
- El backend recalcula el slug desde `businessName` con la misma regla en vez de confiar en el `subdomain` que manda el cliente.
- En el wizard, el error se muestra en el paso 2 junto al nombre del local para que el usuario lo cambie.

### Validación del nombre del local (decidido)

Se aplica igual en frontend (antes de avanzar del paso 2) y backend (`CreateTenantDto` + `tenant.service.ts`), con una constante compartida por proyecto:

- **Caracteres permitidos:** el nombre del local acepta símbolos (`&`, `.`, `-`, `'`, etc.), p. ej. "Peña & Hijos". Los símbolos solo se eliminan al generar el subdominio, que queda en `[a-z0-9-]`.
- **Largo mínimo:** el slug debe tener al menos 3 caracteres alfanuméricos (sin contar guiones) → 400 `TENANT_NAME_TOO_SHORT`. Así "!!!" o "ñ" se rechazan aunque el nombre sí acepte símbolos.
- **Palabras reservadas:** se rechaza si el slug del nombre coincide con alguna → 400 `TENANT_NAME_RESERVED`. Aplica al nombre del local, y por consecuencia al subdominio.

```
www, app, api, admin, administrator, root, mail, email, smtp, ftp,
dashboard, docs, help, support, soporte, status, blog, static, assets,
cdn, auth, login, register, account, billing, piezify, repuestito,
test, dev, staging, demo
```

### Manejo de errores al guardar (decidido)

- **409 (nombre tomado):** tanto el chequeo previo de `tenant.service.ts:32` como la violación del `UNIQUE` de `subdomain` en el `INSERT` (Postgres `23505`, carrera entre dos registros simultáneos) devuelven `{ statusCode: 409, code: ErrorCodes.TENANT_NAME_TAKEN }`. Se captura el `QueryFailedError` dentro de la transacción de `create()` antes de que Nest lo convierta en 500.
- **500 / error de red:** mensaje genérico ("No pudimos crear tu local, intentá de nuevo"), el modal queda abierto para reintentar sin perder lo cargado.
- Todos los códigos nuevos (`TENANT_NAME_TAKEN`, `TENANT_NAME_TOO_SHORT`, `TENANT_NAME_RESERVED`, más el de documento inválido) van en `common/error-codes.ts` y se traducen en `lib/api-errors.ts`.

### Handler de errores en `Confirm` (decidido)

Hoy `Confirm.handleConfirm` hace `catch {}` y deja al consumidor la responsabilidad de mostrar el error — el usuario ve el modal quieto sin explicación. Cambio en `components/shared/Confirm/Confirm.tsx`:

- Nueva prop opcional `onError?: (err: unknown) => string | void`.
- En el `catch`, guarda en estado el mensaje: el string que devuelva `onError`, o si no hay, `translateApiError(err)`; se renderiza con `Alert` (`components/ui/Alert`) dentro del modal, arriba de los botones.
- El error se limpia al reintentar y al cerrar el modal.
- Retrocompatible: pedidos y facturación (`SaleForm.tsx`) siguen funcionando sin pasar `onError`; ahora además ven el mensaje.
- El wizard usa `onError` para, ante `TENANT_NAME_*`, cerrar el `Confirm` y volver al paso 2 marcando el campo del nombre.

## Decisiones pendientes

- **Documento único entre locales — implementado (2026-09-22):** índice `UQ_tenants_taxId` sobre `tenants."taxId"` (migration `1790130200000-AddTenantTaxIdUnique`, `@Index` en `tenant.entity.ts`). Los DTO de create/update normalizan `taxId` (mayúsculas, solo `A-Z0-9`); `tenant.service.ts` traduce la violación del índice a 409 `TENANT_TAX_ID_TAKEN` en `create()` y `update()`, y `services/tenant.service.ts` del frontend ahora usa `translateApiError`. Pendiente: cuando exista `document_type_id`, decidir si el índice pasa a `(document_type_id, country, taxId)` (Pasaporte global, CUIT/CUIL con el mismo número).
- **Paso de sucursal:** ¿se mantiene como paso 3 o se crea automáticamente una sucursal con el nombre del local? El plan asume que se mantiene.
- **Tipos de documento por país — resuelto (2026-09-23):** `CreateDocumentTypes` ahora siembra los 20 países (42 tipos + Pasaporte global), con un default por país (cédula/documento personal, salvo MX → RFC y PR → EIN). Los patrones asumen el número normalizado (mayúsculas, solo `A-Z0-9`); PA usa un patrón laxo por la variedad de formatos de cédula/RUC.
- **`CountryContext` — resuelto:** solo lo cambia GOD (`CountrySelect` se muestra solo con `hasRole(..., 'ADMIN')` en `Header.tsx`). El wizard no lo lee ni lo modifica: el país del paso 1 no viene preseleccionado (el default del contexto es `AR` para todos).
  - **Implementado (2026-09-22):** para usuarios no-GOD el contexto toma el país de su local. `GET /api/auth/me` devuelve `tenantCountry` (`auth.controller.ts`); `AuthUserProvider` hace `setCountry(tenantCountry)` en el mismo render en que fija `currentUser`, así las páginas (`replacement`, `compatibility`) no llegan a pedir datos con el `AR` por default. `CountryCode` pasó de `'AR' | 'VE'` a `string`; `CountrySelect` (GOD) lista los países activos desde la API y `getCountryName` usa `Intl.DisplayNames`. Pendiente aparte: `lib/compatibility-countries.ts` sigue limitado a `['AR', 'VE']`.
- **Orden de migrations:** `CreateDocumentTypes` y `AddUserContactFields` siguen sin commitear; deben ir en el mismo deploy que esta feature, después de `SeedLatamCountries` (el seed de documentos hace `JOIN` con `countries`).
