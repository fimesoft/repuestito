# Global Replacement — Plan de trabajo

> Creado: julio 2026. Pendiente de implementación.

---

## Objetivo

Separar los datos **descriptivos** del repuesto (nombre, marca, OEM — compartidos globalmente) de los datos **comerciales** (precio, stock, ubicación — específicos por vendedor/país). Esto permite que varios vendedores ofrezcan el mismo producto sin duplicar su descripción.

---

## Modelo de datos objetivo

```
global_replacements
  id           SERIAL (autoincremental, no UUID)
  name
  brand_id     INT → brands.id  (FK, RESTRICT)
  codeOem      NULLABLE — NULL cuando el usuario no lo provee; en Postgres NULL != NULL, múltiples NULLs no colisionan
  imageUrl
  country_code ('AR' | 'VE')  ← país de origen del catálogo global
  is_verified  BOOLEAN DEFAULT FALSE — FALSE siempre en creación; un moderador lo activa al confirmar la info
  createdAt

  UNIQUE (codeOem, country_code)  ← NULLs no participan del constraint; solo OEM reales se deduplicam

       │  (global_replacement_id)
       ▼

replacement  (local — datos comerciales por vendedor)
  id          UUID
  globalReplacementId → global_replacements.id  (FK, RESTRICT)
  price
  stock
  latitude
  longitude
  tenantId
  branchId
  createdAt
  ← sin country: se obtiene vía JOIN a global_replacements.country_code
```

**Principios:**
- `global_replacements.id` es incremental (`SERIAL` / `int` con `@PrimaryGeneratedColumn()`), no UUID.
- `replacement` pasa a ser el registro "local" (comercial). Los campos descriptivos (`name`, `brand`, `codeOem`, `imageUrl`) se mueven a `global_replacements`.
- FK `globalReplacementId` con `onDelete: RESTRICT` — no se puede borrar un global que tenga locales asociados.
- Un mismo `global_replacement` puede tener muchos `replacement` (un repuesto, múltiples vendedores / países).
- `country_code` vive únicamente en `global_replacements`; filtrar repuestos por país = JOIN + `WHERE global_replacements.country_code = ?`.

---

## Flujo de inserción (transacción atómica)

Cuando el frontend crea un repuesto y el producto **no existe** en `global_replacements`:

```
POST /api/replacements
  body: { name, brand, codeOem, imageUrl, country_code, price, stock, lat, lng, storeId, sellerId }
         ↑ country_code solo viaja para identificar/crear el global; no se persiste en replacement
        │
        └─ ¿Existe en global_replacements? (match por codeOem + country_code)
              │
         NO  │
              ▼
        Transacción atómica:
          Paso A — INSERT global_replacements → devuelve globalId (autoincremental)
          Paso B — INSERT replacement { globalReplacementId: globalId, price, stock, ... }
              │
         SÍ  │
              ▼
        Solo Paso B — INSERT replacement con el globalId ya existente
```

La transacción usa `QueryRunner` de TypeORM para garantizar atomicidad: si el Paso B falla, el Paso A se revierte.

---

## Backend — cambios necesarios (`repuestito-api/src/`)

### 1. Nueva entidad `global_replacements`

```
src/global-replacement/
  entities/global-replacement.entity.ts
  dto/create-global-replacement.dto.ts
  global-replacement.module.ts
  global-replacement.service.ts   ← findOrCreate + findByCodeOem
  global-replacement.controller.ts
```

- `@PrimaryGeneratedColumn()` (int autoincremental)
- Columnas: `name`, `brandId` (FK → `brands.id`, `onDelete: RESTRICT`), `codeOem` (nullable), `imageUrl`, `countryCode`, `isVerified` (`DEFAULT false`)
- `@ManyToOne(() => Brand, { eager: false }) @JoinColumn()` para la relación con `brands`
- Unique: `(codeOem, countryCode)` — aplica solo cuando `codeOem` no es NULL (comportamiento nativo de Postgres)
- `@OneToMany(() => Replacement, r => r.globalReplacement)` (relación inversa)

### 2. Modificar entidad `replacement`

- Agregar `globalReplacementId: number` (FK → `global_replacements.id`, `onDelete: RESTRICT`)
- Agregar `@ManyToOne(() => GlobalReplacement, { eager: false })` con `@JoinColumn`
- Quitar columnas descriptivas que se mueven a global: `name`, `brand`, `codeOem`, `imageUrl`, `country`
- Crear migración TypeORM (no usar `synchronize: true` en prod)

### 3. Modificar `ReplacementService.create()`

**Problema de concurrencia:** el patrón `findOne → if (!global) save()` tiene una race condition — dos requests simultáneos con el mismo `codeOem` pasan ambos el `findOne` con `null` e intentan insertar, reventando el segundo con `duplicate key value violates unique constraint`.

**Solución:** sanitizar el `codeOem` al inicio del método (`toUpperCase().replace(/[^A-Z0-9]/g, '')`) y delegar el upsert a Postgres con `INSERT ... ON CONFLICT DO UPDATE RETURNING id`. El `UNIQUE (codeOem, countryCode)` opera sobre el valor ya normalizado, por lo que `F-000-HE0-123`, `F000HE0123` y `f.000.he0.123` colisionan correctamente.

```ts
async create(dto: CreateReplacementDto): Promise<Replacement> {
  const cleanCodeOem = dto.codeOem
    ? dto.codeOem.toUpperCase().replace(/[^A-Z0-9]/g, '')
    : null;

  const queryRunner = this.dataSource.createQueryRunner();
  await queryRunner.connect();
  await queryRunner.startTransaction();
  try {
    let globalId: number;

    if (cleanCodeOem) {
      // Paso A (con OEM) — upsert atómico; ON CONFLICT deduplica OEM reales
      const result = await queryRunner.manager
        .createQueryBuilder()
        .insert()
        .into(GlobalReplacement)
        .values({
          name: dto.name,
          brandId: dto.brandId,
          codeOem: cleanCodeOem,
          imageUrl: dto.imageUrl,
          countryCode: dto.countryCode,
          isVerified: false,
        })
        .orUpdate(['name', 'image_url'], ['code_oem', 'country_code'])
        // ↑ orUpdate usa nombres de columna de la DB (snake_case), no propiedades de la entidad
        .returning('id')
        .execute();
      globalId = result.identifiers[0].id;
    } else {
      // Paso A (sin OEM) — insert directo; NULLs no colisionan en Postgres → siempre crea nuevo
      // is_verified = false: información incompleta hasta que un moderador la confirme
      const global = queryRunner.manager.create(GlobalReplacement, {
        name: dto.name,
        brandId: dto.brandId,
        codeOem: null,
        imageUrl: dto.imageUrl,
        countryCode: dto.countryCode,
        isVerified: false,
      });
      await queryRunner.manager.save(global);
      globalId = global.id;
    }

    // Paso B — insert local con el globalId resuelto
    const local = queryRunner.manager.create(Replacement, {
      globalReplacementId: globalId,
      price: dto.price,
      stock: dto.stock,
      latitude: dto.latitude,
      longitude: dto.longitude,
      tenantId: dto.tenantId,
      branchId: dto.branchId,
      // sin country — se obtiene vía global_replacements.country_code
    });
    await queryRunner.manager.save(local);

    await queryRunner.commitTransaction();
    return local;
  } catch (err) {
    await queryRunner.rollbackTransaction();
    throw err;
  } finally {
    await queryRunner.release();
  }
}
```

**Por qué `orUpdate` y no `orIgnore`:**
`ON CONFLICT DO NOTHING` con `RETURNING id` no retorna nada en la fila conflictiva — quedarías sin `globalId`. `DO UPDATE` (aunque sea un no-op como `SET name = EXCLUDED.name`) fuerza el `RETURNING` a devolver siempre el id, ya sea de la fila insertada o de la existente.

### 4. Modificar `ReplacementService.findAll()`

- JOIN con `global_replacements` para traer `name`, `brand`, `codeOem`, `imageUrl` en las queries de lista/búsqueda.
- El filtro `ILike` de `name` pasa a hacerse sobre `global_replacement.name`.

### 5. DTOs

| DTO | Cambio |
|---|---|
| `CreateReplacementDto` | `brandId: number` (FK seleccionado en dropdown), `name`, `codeOem`, `imageUrl`, `countryCode`, `price`, `stock`, `latitude`, `longitude`, `storeId`, `sellerId` |
| `ReplacementResponseDto` (nuevo) | Aplana global + local para no exponer el JOIN al cliente; incluye `brand: { id, name, logoUrl }` |

---

## Frontend — cambios necesarios (`repuestito/`)

### `services/replacement.service.ts`
- `createReplacement(payload)` envía `{ brandId, name, codeOem, imageUrl, countryCode, price, stock, ... }` — `brandId` viene del dropdown de marcas.
- Respuesta del servidor sigue siendo un `Replacement` aplanado (el JOIN lo hace el backend).

### Dashboard — formulario de creación de repuesto
- Ningún cambio visible para el usuario; internamente el campo `countryCode` se toma del país activo del contexto.
- Si se muestra `globalReplacementId` en la UI (opcional), agregarlo como campo de solo lectura en el detalle.

---

## Decisiones técnicas clave

| Decisión | Razón |
|---|---|
| `SERIAL` (int) en lugar de UUID para `global_replacements.id` | IDs incrementales son más compactos, legibles, y útiles para detectar el orden de inserción en el catálogo global |
| `unique(codeOem, countryCode)` en global | El mismo OEM puede tener distintos nombres/imágenes por país (diferencias de catálogo regional) |
| `onDelete: RESTRICT` en FK de replacement | Previene borrar un global que aún tenga locales activos |
| `QueryRunner` para la transacción | `EntityManager.transaction()` de TypeORM también funciona, pero `QueryRunner` da control explícito sobre rollback y es más claro para operaciones multi-paso |
| JOIN en `findAll` en vez de campo duplicado | La fuente de verdad descriptiva es `global_replacements`; duplicarla en `replacement` generaría inconsistencias |

---

## Tabla `brands`

Catálogo de marcas compartido por `global_replacements`. El campo `brand VARCHAR` en `global_replacements` se reemplaza por `brand_id INT REFERENCES brands(id)`.

```sql
CREATE TABLE brands (
    id              INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    name            VARCHAR(100) NOT NULL,
    normalized_name VARCHAR(100) NOT NULL UNIQUE, -- ej. 'BOSCH'; UNIQUE global previene que una marca local solape una global
    country_code    VARCHAR(2)   DEFAULT NULL,     -- NULL = global (Bosch, Brembo) | 'AR'/'VE' = local/regional
    logo_url        TEXT,
    is_verified     BOOLEAN      DEFAULT FALSE,
    is_active       BOOLEAN      DEFAULT TRUE,     -- soft-delete: evita bloqueos de FK al "borrar" una marca con repuestos asociados
    created_at      TIMESTAMPTZ  DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_brands_country_code ON brands (country_code);  -- queries de "todas las marcas locales de AR"
```

**Notas de diseño:**

| Decisión | Razón |
|---|---|
| `UNIQUE(normalized_name)` global (no por país) | NULL != NULL en Postgres: `UNIQUE(normalized_name, country_code)` permitiría una local 'AR' con el mismo normalized que una global — ambigüedad de catálogo. Un único namespace es más limpio. |
| `is_active` en lugar de `DELETE` | `ON DELETE RESTRICT` bloquea el hard-delete si hay `global_replacements` asociados; `is_active = false` desactiva sin tocar FKs. |
| `is_verified` | Permite moderar marcas creadas por usuarios antes de exponerlas en el catálogo público. |
| `logo_url TEXT` | Sin longitud máxima — las URLs de CDN pueden ser largas. |

**Impacto en `global_replacements`:**
- Quitar columna `brand VARCHAR`.
- Agregar `brand_id INT NOT NULL REFERENCES brands(id) ON DELETE RESTRICT`.
- Migración: poblar `brands` con los valores únicos de `brand` existentes antes de agregar la FK.

---

## Pendiente / Orden de implementación sugerido

1. Crear entidad `Brand` + módulo + migración de tabla `brands`
2. Migrar valores únicos de `global_replacements.brand` (VARCHAR) a `brands`, luego agregar FK `brand_id` + migración
3. Crear entidad `GlobalReplacement` + módulo + migración de tabla nueva (ya con `brand_id`)
4. Modificar entidad `Replacement`: agregar FK `globalReplacementId`, quitar columnas descriptivas + migración
5. Refactorizar `ReplacementService.create()` con `QueryRunner`
6. Refactorizar `ReplacementService.findAll()` con JOINs (global + brand)
7. Actualizar DTOs y ajustar el controller
8. Actualizar `replacement.service.ts` del frontend (agregar `countryCode`)
9. Smoke test: crear repuesto nuevo → verificar inserciones en `brands` (si aplica), `global_replacements` y `replacement`; crear segundo local del mismo OEM → verificar que reutiliza el global existente
