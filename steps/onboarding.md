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
