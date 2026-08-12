# Parque automotor por país

## Objetivo
Modelar el catálogo de vehículos de forma escalable: marcas y modelos son entidades globales (no se duplican por país), y las versiones son el punto de entrada del país y la fuente externa.

## Esquema de base de datos

```sql
-- Marca: entidad global (no se duplica por país)
brand (
  id    bigint PRIMARY KEY,
  slug  text UNIQUE,             -- generado: 'alfa-romeo'
  name  text NOT NULL            -- tal como viene de la fuente: 'ALFA ROMEO'
);

-- Modelo: cuelga de marca, global
model (
  id        bigint PRIMARY KEY,
  brand_id  bigint REFERENCES brand,
  name      text NOT NULL,
  UNIQUE (brand_id, name)
);

-- Versión: acá entra el país
version (
  id              bigint PRIMARY KEY,
  model_id        bigint REFERENCES model,
  country_id      smallint REFERENCES countries,
  external_id     text NOT NULL,        -- id original de la fuente (ej: 210172 de argautos)
  name            text NOT NULL,
  available_years int[] NOT NULL DEFAULT '{}',
  UNIQUE (country_id, external_id)
);

CREATE INDEX idx_version_years ON version USING GIN (available_years);
CREATE INDEX idx_version_model ON version (model_id);
```

## Relaciones clave

```
countries (existente) ──< version >── model >── brand
```

- `brand` y `model` son globales: una sola fila por marca/modelo sin importar el país.
- `version` es donde se ancla el país vía `country_id` (FK a la tabla `countries` existente) y la fuente externa vía `external_id`.
- `available_years` es un array de enteros indexado con GIN para consultas del tipo "¿qué versiones aplican al año 2018?".
- Los `name` se almacenan tal como vienen de la fuente (mayúsculas); la normalización para display se hace en el frontend.

## Fuentes de datos

| País | Fuente | Endpoint base |
|------|--------|---------------|
| AR   | argautos / infoauto | `https://argautos.com/api/v1/infoauto` |

## Flujo de seed

1. Insertar `brand` desde `/brands` (paginado) — deduplicar por `slug`
3. Insertar `model` desde `/brands/{id}/models` — deduplicar por `(brand_id, slug)`
4. Insertar `version` desde `/models/{id}/versions` — `external_id` = id de la fuente, `country_id` = país de la fuente

## Fases de implementación

### Fase 1 — Base de datos y seed
- [ ] Crear entidades NestJS/TypeORM: `Brand`, `Model`, `Version`
- [ ] Crear módulos y endpoints REST (`/brands`, `/models`, `/versions`)
- [ ] Escribir script de seed que lea los JSON generados por `scrape-argautos-models.ts`

### Fase 2 — CRUD en el frontend (solo rol GOD)
- [ ] Agregar ítem "Parque automotor" en el menú del dashboard, visible únicamente para `UserRole.GOD`
- [ ] Página de marcas: listar, crear, editar, eliminar (`Brand`)
- [ ] Página de modelos: listar por marca, crear, editar, eliminar (`Model`)
- [ ] Página de versiones: listar por modelo, crear, editar, eliminar (`Version`) — incluye selector de `available_years`

### Fase 3 — Compatibilidad al crear repuesto
- [ ] Al crear/editar un `Replacement`, agregar sección "Vehículos compatibles"
- [ ] Selector jerárquico: Marca → Modelo → Versión + año
- [ ] Tabla de compatibilidad:
  ```sql
  replacement_compatibility (
    replacement_id  uuid REFERENCES replacement,
    version_id      bigint REFERENCES version,
    years           smallint[] NOT NULL,  -- años seleccionados del available_years de la versión
    PRIMARY KEY (replacement_id, version_id)
  );
  CREATE INDEX idx_compat_years ON replacement_compatibility USING GIN (years);
  ```
- [ ] Endpoints: `POST /replacements/:id/compatibility`, `PATCH /replacements/:id/compatibility/:versionId`, `DELETE /replacements/:id/compatibility/:versionId`
- [ ] Mostrar vehículos compatibles en la página pública del repuesto (`parts/[id]`)
