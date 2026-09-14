# Configuración por tienda (thresholds de stock) — Planificación

> Estado: implementado (backend + frontend), validado con `tsc`, `next build`, `eslint` y pruebas manuales de los endpoints (incluyendo permisos por rol). Falta verificación visual en navegador.

---

## Objetivo

Nueva sección "Configuración" en el dashboard. El ítem de menú y el form de niveles de stock son solo para `GOD`/`MODERATOR` (equivalente frontend: `minRole: 'MODERATOR'`, ver [lib/roles.ts](../../repuestito/lib/roles.ts)); permite a cada tenant customizar los umbrales que definen si un repuesto está en stock bajo/normal/completo. La misma página también incluye el selector de theme (claro/oscuro), que es una preferencia personal disponible para cualquier rol autenticado — ver sección "Theme del usuario" más abajo.

## Estado actual (hardcodeado, global, sin persistencia)

`constants/replacement.ts`:
```ts
export const STOCK_THRESHOLDS = { LOW_MAX: 4, NORMAL_MAX: 15 } as const;
export function getStockLevel(stock: number): 'low' | 'normal' | 'full' {
  if (stock <= STOCK_THRESHOLDS.LOW_MAX) return 'low';
  if (stock <= STOCK_THRESHOLDS.NORMAL_MAX) return 'normal';
  return 'full';
}
```
Usado en `dashboard/replacement/page.tsx` y `SaleForm.tsx` vía `Badge` (`stockLow` / `stockNormal` / `stockFull`).

Son 2 valores configurables en realidad (no 3): `LOW_MAX` y `NORMAL_MAX`. "Completo" es todo lo que supera `NORMAL_MAX`, no un umbral propio.

No existía ningún item "Configuración" en `DashboardSidebar.nav.ts` — agregado.

---

## Backend (`repuestito-api/src/`)

### Nuevo módulo `tenant-config/`

**Entidad** `tenant_config` (implementada tal cual, sin FK declarada — mismo estilo que `Replacement.storeId`/`sellerId` en este proyecto):
```
tenant_config
  id              uuid, PK
  tenantId        uuid, UNIQUE (sin FK, como el resto de las referencias a tenant en este proyecto)
  lowStockMax     int, default 4
  normalStockMax  int, default 15
  createdAt
  updatedAt
```
Un registro por tenant (`UNIQUE(tenantId)`). Si no existe fila para un tenant, el backend devuelve los defaults (4 / 15) en vez de fallar — verificado con curl.

**DTOs**: `UpdateTenantConfigDto` (`lowStockMax?: number`, `normalStockMax?: number`, ambos opcionales, `@IsInt() @Min(0)`; validar en servicio que `lowStockMax < normalStockMax`, si no `throw new BadRequestException` según formato de error del proyecto — código nuevo en `error-codes.ts`).

**Endpoints**:
- `GET /api/tenant-config` — devuelve la config del tenant del usuario autenticado (o defaults). Abierto a cualquier rol autenticado del tenant (`JwtAuthGuard` solamente) — SELLER también lo necesita para pintar el badge de stock.
- `PATCH /api/tenant-config` — upsert; `@Roles(UserRole.GOD, UserRole.MODERATOR)`.

`tenantId` sale siempre del JWT (`req.user.tenantId`), no se soporta por query param.

Actualizar Swagger (`@ApiOperation`, `@ApiResponse`, DTOs con `@ApiProperty()`) en el mismo commit, según regla del proyecto.

### Consumo del threshold en el backend

Si `getStockLevel` hoy solo vive en el frontend, evaluar si el backend también necesita clasificar stock (ej. para alertas, reportes). Si no hay uso backend actual, no migrar lógica que no se pidió — dejar `getStockLevel` en el frontend y que reciba los thresholds desde la nueva config en vez de la constante fija.

---

## Frontend (`repuestito/`)

### Nav
Agregar a `DashboardSidebar.nav.ts`, sección `admin`, `minRole: 'MODERATOR'`:
```ts
{ href: '/dashboard/config', label: 'Configuración', icon: '/icons/settings.svg', minRole: 'MODERATOR' }
```

### Servicio
`services/tenant-config.service.ts` — `getTenantConfig()`, `updateTenantConfig(payload)`, siguiendo el patrón de `tenant.service.ts` (fetch + `credentials: 'include'`).

### Página `/dashboard/config` — implementada
- Client component con dos secciones: "Niveles de stock" (form) y "Tema" (swatches).
- Dos `Input` (nuevo componente `components/ui/Input/`) numéricos: "Stock bajo hasta" (`lowStockMax`) y "Stock normal hasta" (`normalStockMax`).
- Botón guardar → `Button` de `components/ui/Button`.
- Errores traducidos vía `translateApiError` (`TENANT_CONFIG_INVALID_RANGE`, `TENANT_REQUIRED` agregados a `lib/api-errors.ts`).

### `getStockLevel` — implementado
Ahora acepta un segundo parámetro `thresholds` (default = 4/15, sin romper llamadas existentes sin ese argumento). Los únicos dos call-sites reales eran `dashboard/replacement/page.tsx` y `SaleForm.tsx` (orders/billing no lo usan pese a tener CSS `.stockLow/.stockNormal/.stockFull`, eran clases sin uso de `getStockLevel`). Ambos ahora usan el hook nuevo `hooks/useStockThresholds.ts`, que llama a `getTenantConfig()` una vez y devuelve `{ lowStockMax, normalStockMax }` (con fallback a los defaults si falla el fetch).

`GET /api/tenant-config` quedó abierto a cualquier rol autenticado del tenant (no solo GOD/MODERATOR) porque SELLER también necesita ver el badge de stock coloreado; sólo `PATCH` está restringido a GOD/MODERATOR.

---

## Decisiones ya cerradas

- `tenantId` sale solo del JWT, sin soporte por query param.
- `parts/[id]` y el home no usan `getStockLevel`/Badge de stock hoy (solo `DistanceBadge`) — los únicos dos call-sites reales de `getStockLevel` son `dashboard/replacement/page.tsx` y `SaleForm.tsx`, ambos con sesión. No hace falta resolver tenant sin JWT.
- Ícono/label del menú: "Configuración" / `/icons/settings.svg` — confirmado, existe en `public/icons/settings.svg`.
- Selector de theme va en la misma página `/dashboard/config` (no en un lugar separado tipo "Mi perfil").
- No existe componente `Input` en `components/ui/` — se crea uno nuevo (`components/ui/Input/Input.tsx` + barrel), siguiendo la regla de componentes del proyecto, para los dos numéricos de stock.

---

## Theme del usuario (por usuario, no por tenant)

A diferencia de los thresholds de stock (por tenant), el theme es una preferencia **por usuario**: cada usuario podrá elegir entre varios themes predefinidos.

Corrección sobre lo que se creía al planificar esta sección: **sí existe** un sistema de theming claro/oscuro completo y funcionando — `styles/theme.css` ya define un bloque `:root[data-theme='dark']` (línea 78) con toda la paleta oscura, y `components/shared/ThemeSelect/ThemeSelect.tsx` ya lo controla vía `localStorage` (`piezify-theme`) + `document.documentElement.dataset.theme`, usado en el `Header` público. Lo que faltaba era persistirlo por usuario en el backend y exponerlo también en `/dashboard/config`.

De momento van a ser **2 themes**, y el valor se envía desde el front hacia el back al cambiarlo (no es el back quien decide/calcula el theme).

### Backend
- Agregar columna `theme` a `users`: `@Column({ type: 'enum', enum: UserTheme, default: UserTheme.LIGHT })`.
- `enum UserTheme { LIGHT = 'LIGHT', DARK = 'DARK' }` en `user.entity.ts` (mismo patrón que `UserRole`).
- DTO de update valida `@IsEnum(UserTheme)` — nada de string libre.
- Endpoint en `UserModule`: `PATCH /api/users/me/theme`, body `{ theme: UserTheme }`. Implementado.
- Se resolvió el conflicto de guards: se bajó `@UseGuards(RolesGuard) @Roles(GOD, MODERATOR)` de nivel de clase a cada método existente en `UserController` (`findAll`, `findOne`, `create`, `update`, `remove`), dejando sólo `@UseGuards(JwtAuthGuard)` a nivel de clase. `me/theme` no lleva `RolesGuard`, así que cualquier rol autenticado puede cambiar su propio theme. Validado con curl: SELLER puede `PATCH /users/me/theme` pero sigue bloqueado (403) en `GET /users`.
- Incluir `theme` en el payload que devuelve login/`me`, para que el frontend lo aplique al cargar sesión sin pedirlo aparte.

### Frontend — implementado
- No se creó un `ThemeContext` nuevo: `AuthUserContext.tsx` ya hace polling de `/api/auth/me`, así que se le agregó un `useEffect` que, cuando cambia `currentUser.theme`, aplica `document.documentElement.dataset.theme` y sincroniza `localStorage['piezify-theme']` (mismo storage key que `ThemeSelect`, para que el marketplace público también respete la preferencia una vez logueado).
- Selector de theme en `/dashboard/config`: dos círculos (`.themeSwatch`, `border-radius: 50%`), el activo con `box-shadow`/`border` de `--color-primary`. Al hacer click llama a `updateMyTheme(theme)` (`services/user.service.ts`) y luego `refetch()` de `useAuthUser()`.
- No se tocó `ThemeSelect`/`Header` (selector público anónimo vía localStorage) — fuera de alcance de este pedido.

---

## Validación realizada

- `tsc --noEmit` limpio en `repuestito-api` y `repuestito`.
- `next build` (`repuestito`) genera `/dashboard/config` sin errores.
- `eslint` limpio en todos los archivos nuevos/tocados (deuda de lint preexistente en `user.service.ts`/`user.controller.ts`/`app.module.ts`/`dashboard/replacement/page.tsx` verificada como anterior a este cambio, no tocada).
- Backend levantado localmente contra Postgres real; `synchronize: true` creó `tenant_config` y `users.theme` sin migración manual.
- Probado con curl usando un usuario MODERATOR y uno SELLER (creados y borrados sólo para la prueba):
  - `GET /api/tenant-config` sin fila previa → defaults `4/15`.
  - `PATCH /api/tenant-config` con rango válido → persiste; con `lowStockMax >= normalStockMax` → `400 TENANT_CONFIG_INVALID_RANGE`.
  - SELLER: `GET /api/tenant-config` → 200; `PATCH /api/tenant-config` → 403; `PATCH /api/users/me/theme` → 200; `GET /api/users` → sigue en 403 (no se aflojó el resto del controller al mover los guards a nivel de método).
  - `theme` viaja correctamente en `GET /api/auth/me` tras cambiarlo.
- Pendiente: verificación visual en navegador de `/dashboard/config` (no se abrió el navegador porque hay una preferencia guardada de no hacerlo salvo pedido explícito).

