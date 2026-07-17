# Sistema de compatibilidad de vehículos — Estado actual

> Última actualización: julio 2026. Todo implementado y compilando sin errores.

---

## Arquitectura implementada

```
vehicle_model
  id
  brand
  model
  yearFrom  (requerido)
  yearTo    (requerido)
  country   ('AR' | 'VE')
  UNIQUE(brand, model, yearFrom, yearTo, country)
       │
       ├──────────────────────────────────────────┐
       ▼                                          ▼
    vehicle                         replacement_compatibility
      id                              id
      vehicleModelId ──→ vm.id        vehicleModelId ──→ vm.id  (RESTRICT)
      country                         replacementId  ──→ replacement.id
      engine                          country  ('AR' | 'VE')
      fuelType                        UNIQUE(replacementId, vehicleModelId, country)
      transmission                    INDEX(replacementId)
      bodyType                        INDEX(vehicleModelId)

replacement  (tabla unificada — antes era replacement_arg + replacement_ven)
  id, name, brand, price, stock, country, latitude, longitude,
  codeOem, imageUrl, storeId, sellerId
  INDEX(country)
```

**Principios:**
- `vehicle_model` es la única fuente de verdad para brand/model. El `country` en `vehicle_model` significa que el mismo auto puede tener entradas por país.
- `replacement_compatibility` es una sola tabla para todos los países. Agregar un país = agregar una entrada en `COMPATIBILITY_COUNTRIES`.
- `RESTRICT` en los FKs de `vehicleModelId` previene borrados accidentales.
- `replacement` es una sola tabla con columna `country` — elimina la duplicación de `replacement_arg`/`replacement_ven`.

---

## Backend — `repuestito-api/src/`

### `vehicle-model/`
- **Entidad** `vehicle_model`: `id`, `brand`, `model`, `yearFrom`, `yearTo`, `country`, `createdAt`
- **Unique**: `(brand, model, yearFrom, yearTo, country)` — permite el mismo modelo en distintos países
- **DTOs**: `CreateVehicleModelDto` (todos requeridos, incluyendo `country`), `UpdateVehicleModelDto` (todos opcionales), `QueryVehicleModelDto` (filtra por `brand`, `model`, `country`)
- **Endpoints**: `GET /api/vehicle-models`, `POST`, `PATCH /:id`, `DELETE /:id`
- **DELETE**: captura error `23503` de Postgres y responde `409 Conflict`

### `vehicle/`
- **Entidad** `vehicle`: eliminados `brand` y `model`; ahora tiene `vehicleModelId` (FK → `vehicle_model`, `onDelete: RESTRICT`)
- **Relación**: `relations: { vehicleModel: true }` (sintaxis objeto de TypeORM 0.3)

### `replacement/`
- **Entidad** `replacement`: tabla unificada (`@Entity('replacement')`), columna `country` con `@Index('idx_replacement_country', ['country'])`
- **Servicio**: usa un solo repo; `findAll` filtra por `country`, `name` (ILike), o `ids` (comma-separated UUIDs para búsqueda inversa)
- **DTO query**: campo `ids?: string` para filtrar por múltiples IDs

### `replacement-compatibility/`
- **Entidad** `replacement_compatibility`: `id`, `replacementId`, `vehicleModelId` (eager → `vehicleModel`), `country`, `createdAt`
- **Índices**: `idx_compat_replacement`, `idx_compat_vehicle_model`
- **Servicio**: `create()` recarga con `findOne({ relations: { vehicleModel: true } })` después de `save()` (eager no se popula en save)
- **Pipe**: `CountryValidationPipe` valida `['AR', 'VE']` antes de llegar al servicio; responde `400` si inválido
- **Endpoints**: `POST /api/compatibility/:country`, `GET /:country/replacement/:id`, `GET /:country/vehicle-model/:id`, `DELETE /:country/:replacementId/:vehicleModelId`

### `app.module.ts`
- Registra `VehicleModelModule` y `ReplacementCompatibilityModule`

---

## Frontend — `repuestito/`

### `lib/compatibility-countries.ts`
```ts
export const COMPATIBILITY_COUNTRIES = ['AR', 'VE'] as const;
export type CompatibilityCountry = typeof COMPATIBILITY_COUNTRIES[number];
export const countryToCompatibility: Record<string, CompatibilityCountry> = { AR: 'AR', VE: 'VE' };
```
Agregar un país = una línea aquí; tabs y filtros se actualizan solos.

### `hooks/usePermissions.ts`
```ts
{ currentUser, isAdmin, canManage, loading }
// canManage = ADMIN | MODERATOR
// SELLER no puede crear/editar/eliminar usuarios, locales, ni repuestos
```
Usado en `/dashboard/users`, `/dashboard/stores`, `/dashboard/replacement`, `/dashboard/vehicles`, `/dashboard/replacement/[id]`.

### Servicios (`services/`)
| Archivo | Qué hace |
|---|---|
| `vehicle-model.service.ts` | CRUD completo; `getVehicleModels` acepta `{ brand?, model?, country? }`; todas las firmas incluyen `country` |
| `compatibility.service.ts` | `addCompatibility`, `removeCompatibility`, `getCompatibilityByReplacement`, `getCompatibilityByVehicleModel`; todos tipados con `CompatibilityCountry` |
| `replacement.service.ts` | `getReplacements` acepta `ids?: string` para búsqueda inversa |

### Dashboard pages

**`/dashboard/vehicles`** — CRUD de catálogo de modelos
- Tabla: Marca / Modelo / Año desde / Año hasta / País / Acciones
- Filtro de búsqueda (brand/model) + filtro de país por dropdown
- Modales de crear y editar incluyen selector de país (`COMPATIBILITY_COUNTRIES`)
- Botones de editar/eliminar ocultos para SELLER (`canManage`)

**`/dashboard/replacement`** — Lista de repuestos
- Columna extra "Compatibilidades" con `<Link href="/dashboard/replacement/${r.id}">` por fila

**`/dashboard/replacement/[id]`** — Gestión de compatibilidades de un repuesto
- Tabs por país generados desde `COMPATIBILITY_COUNTRIES`
- Al cambiar tab: resetea búsqueda, resultados y modelo seleccionado
- Búsqueda de modelos con debounce 300ms; filtra por `activeCountry`
- Sugerencias → click → muestra "✓ Brand Model (yearFrom–yearTo)"
- Botón eliminar por fila; botón "+ Agregar modelo" solo para `canManage`

### Vistas públicas

**`/parts/[id]`** — Detalle de repuesto (Server Component)
- Verifica si `part.country` está en `COMPATIBILITY_COUNTRIES`
- Si sí: muestra lista "Compatible con: Toyota Corolla (2013–2019)..."
- Si no: "Sin datos de compatibilidad para este país."

**`/` (home)** — Lista paginada
- Acepta `vehicleModelId` en searchParams
- Si `vehicleModelId` + país válido: fetch compat → IDs → fetch replacements con `ids`
- Componente `VehicleFilter`: dropdown Brand → Model (cascading), actualiza URL con `vehicleModelId`, botón "✕ Limpiar"

---

## Decisiones técnicas clave

| Decisión | Razón |
|---|---|
| `yearFrom`/`yearTo` requeridos (no nullable) | NULL != NULL en Postgres rompe el UNIQUE — dos NULLs no colisionan |
| `onDelete: 'RESTRICT'` en FKs de vehicleModel | Previene borrar un modelo que tenga vehicles o compatibilidades asignadas |
| `repo.save()` + `findOne` en `create` de compatibility | `eager: true` no se popula tras `save()` — hay que recargar explícitamente |
| `relations: { vehicleModel: true }` (objeto, no array) | TypeORM 0.3 requiere sintaxis objeto; array genera TypeError en runtime |
| Tabla `replacement` unificada con columna `country` | Elimina duplicación de código y repos; queries simples con filtro `where: { country }` |
| `CountryValidationPipe` a nivel de controller | Valida antes de llegar al servicio; evita lógica defensiva en múltiples métodos |

---

## Pendiente / Próximos pasos

- Dropear manualmente las tablas `replacement_arg` y `replacement_ven` en DB (ya no las usa TypeORM)
- `app/(main)/edit/[id]/page.tsx` — restringir acceso para SELLER (aún sin control de permisos)
- `VehicleFilter` en home solo funciona si hay país activo en URL — evaluar mostrar u ocultar el filtro cuando no hay país seleccionado
