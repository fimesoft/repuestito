# Evolución del catálogo — Multi-producto, tipos, marcas y SKU

> Estado: **implementado y verificado en local** (backend + frontend). Pendiente: probar la UI en el navegador, revisar producción y desplegar (ver «Estado de la implementación»).

---

## Estado de la implementación

**Hecho** (migración `src/migrations/1789851976724-EvolveCatalog.ts`, generada con `migration:generate` y editada a mano):

- Backend: entidad `ProductType` y módulo `product-type/` (`GET`, `POST`, `PUT`, `DELETE`, `merge`), rename `code_oem` → `sku`, `productTypeId` en el alta, `by-sku`, marcas (`409` con `existing`, alta para `MODERATOR`, `23505`), `create()` sin `orUpdate`, bulk-upload (alias `codeOem`, tipo «Repuestos»), validación de compatibilidad por tipo, auditoría, seed.
- Frontend: `CatalogPicker` (tipo y marca con autocompletable y creación), `Autocomplete` con `onCreate`, `ImageUpload` sin subida inmediata (se sube al guardar), formulario de alta con SKU y aviso de SKU existente, filtro por tipo en `dashboard/replacement`, pantalla `dashboard/admin/product-types`, textos de error en español, rename a SKU en todas las vistas y en la plantilla CSV, compatibilidad oculta para tipos que no la soportan.
- Documentación actualizada (Fase 7).
- Imágenes: `ProductImage` muestra «Imagen no disponible» cuando el producto no tiene imagen (por ejemplo, cargado por CSV) o la URL falla. En el modal de edición de `dashboard/replacement` se puede agregar una imagen (si no tenía) o reemplazarla; se sube al guardar (`PATCH /api/replacements/:id` acepta `imageUrl`). Como la imagen vive en el catálogo compartido, un `MODERATOR` solo puede **reemplazar** una imagen existente si ningún otro tenant tiene listado del mismo producto (`409 REPLACEMENT_IMAGE_SHARED`); agregar una cuando no hay ninguna siempre se permite, y `GOD` puede reemplazarla siempre. La imagen anterior queda en Cloudinary (no hay endpoint para borrarla).

**Diferencias respecto al plan original:**

- El SKU se **normaliza en el DTO** (`skuTransform`) en vez de rechazar los separadores: `15400-plm-a02` → `15400PLMA02`. Solo se rechaza (400) si no queda ningún carácter alfanumérico. Así los CSV existentes con guiones siguen funcionando.
- El alias `codeOem` del CSV se acepta **sin mostrar aviso** en el resultado del job.
- El modal «Crear marca» pide solo el nombre (sin logo); el logo se sigue editando en `admin/brands`.
- `GET /api/global-replacements/by-sku` responde `{ data: producto | null }` en vez de un 404.
- `idx_replacement_tenant` es `(tenant_id, "createdAt")` ascendente: TypeORM no declara índices descendentes y Postgres lo recorre en reverso igual.
- No existe una «Home» de marketplace con filtros (`app/page.tsx` es el login): el filtro por tipo está en `dashboard/replacement`.

**Verificado en local** (copia de la DB con 210 productos): `up`, `down` y `up` de la migración con los códigos intactos y `migration:generate` sin diferencias; 42 comprobaciones contra la API (duplicados y carrera, permisos, tipo de sistema, fusión, `by-sku`, compatibilidad, bulk-upload con ambos encabezados); `jest` (16 tests), `tsc`, `next build` y ESLint sin errores nuevos.

**No verificado:** el flujo en el navegador (formulario, autocompletables, pantalla de administración).

**Pendientes antes de desplegar:**

1. Probar la UI en el navegador con las migraciones aplicadas a la DB de desarrollo (`npm run migration:run` en `repuestito-api`).
2. **Revisado en producción (19/09/2026, solo lectura):** `replacement`, `global_replacements` y `brand_replacements` están vacías, no hay `code_oem` inválidos y la DB pesa 9 MB. Solo están aplicadas las 3 migraciones anteriores; falta `EvolveCatalog`. Con la DB vacía no hay riesgo de bloqueos por índices ni de fallos en el `CHECK` del SKU.
3. **La migración NO corre sola en el deploy** (ver «Compatibilidad y despliegue»): hay que agregar el paso a `/opt/piezify/deploy.sh` o ejecutarla a mano antes del `push` del backend.

**Datos en producción:** la migración solo crea la estructura y el tipo de sistema «Repuestos» (necesario para que los productos existentes tengan tipo). Los tipos y marcas creados en desarrollo **no viajan** a producción: viven en la DB de desarrollo y el deploy solo sincroniza código. El script `scripts/seed-replacements.ts` es solo de desarrollo y no se ejecuta en el deploy.

---

## Objetivo

1. Clasificar cualquier artículo (celulares, componentes de PC, domótica, repuestos, etc.) mediante un **tipo de producto**, sin duplicados.
2. Reemplazar `code_oem` por **`sku`**: código único, alfanumérico o numérico, que identifica un producto en el catálogo compartido.
3. No alterar la tabla operativa `replacement` (precio, stock, sucursal) más allá de lo que herede del catálogo.

Todo el cambio de base de datos va en **una sola migración TypeORM** (`src/migrations/<timestamp>-EvolveCatalog.ts`) con `up` y `down`. `synchronize` está en `false`, así que no se ejecutan scripts SQL sueltos.

---

## Decisiones tomadas

| Tema | Decisión |
|---|---|
| Nombre del código | `code_oem` → `sku` (columna) y `codeOem` → `sku` (propiedad TS, DTOs, JSON, CSV). |
| Formato del SKU | Solo `A-Z` y `0-9`, en mayúsculas, máx. 64 caracteres. Es la misma normalización que ya se aplica hoy (`toUpperCase().replace(/[^A-Z0-9]/g, '')`), ahora reforzada con un `CHECK` en la DB. |
| Unicidad | `UNIQUE (sku, country_code)`, igual que hoy con `code_oem`. **No** incluye `product_type_id`: un SKU identifica el producto sin importar su tipo. |
| Obligatoriedad | Sigue siendo **opcional** (`NULL` permitido; los `NULL` no colisionan y esas filas nunca reutilizan catálogo). |
| `product_type_brands` | **Fuera del alcance inicial.** Ver Fase 2. |
| Nombres de tablas | `global_replacements` y `replacement` **no** se renombran en esta evolución. |
| Alta de tipos y marcas | Desde el formulario de producto, con autocompletable y creación en el momento (Fase 6). Nunca se duplican: ante un duplicado se avisa y se ofrece usar el existente. Nacen `is_verified = false`. **Un `MODERATOR` puede crearlos** (confirmado); editar y borrar sigue siendo solo `GOD`. |
| Administración de tipos | Pantalla `dashboard/admin/product-types` solo para `GOD`: editar, verificar, borrar (si no tiene productos) y **fusionar** un tipo en otro. El tipo "Repuestos" es de sistema (`is_system`) y no se puede tocar. |
| Imagen | Opcional. Se sube a Cloudinary al confirmar el formulario, no al seleccionar el archivo. |
| SKU ya existente | Se reutiliza el producto del catálogo sin modificarlo (se elimina el `orUpdate` de nombre e imagen). |

> Concern: en el comercio, un SKU suele ser un código *interno de cada vendedor*. Aquí se define como código *compartido del catálogo* (dos tenants con el mismo SKU comparten el mismo `global_replacements`). Si un tenant necesita además su código interno, va en `replacement` (por ejemplo `internal_code`), no en el catálogo global. Tampoco debe confundirse con `SELLER_SKU` de Mercado Libre (ver `integration-with-meli.md`).

---

## Fase 1 — Tabla `product_types`

Un solo `UNIQUE` sobre `normalized_name` (el de `name` era redundante), con los mismos flags de curaduría que `brand_replacements`.

```sql
CREATE TABLE product_types (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    normalized_name VARCHAR(100) NOT NULL,
    supports_vehicle_compatibility BOOLEAN NOT NULL DEFAULT false,
    is_system BOOLEAN NOT NULL DEFAULT false,
    is_verified BOOLEAN NOT NULL DEFAULT false,
    is_active BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
    CONSTRAINT unique_product_type_normalized UNIQUE (normalized_name)
);

INSERT INTO product_types (name, normalized_name, supports_vehicle_compatibility, is_system, is_verified)
VALUES ('Repuestos', 'REPUESTOS', true, true, true);
```

- `normalized_name` se guarda en **mayúsculas**, sin símbolos, **sin tildes**, con espacios colapsados y sin espacios en los extremos (`"Cámaras de Seguridad"` → `CAMARAS DE SEGURIDAD`). Se calcula con un util propio (`normalizeProductTypeName`): `NFD` + eliminar `\p{M}` + la misma limpieza de `normalizeBrandName`. **No** se modifica `normalizeBrandName`, porque los `normalized_name` ya guardados en `brand_replacements` dejarían de coincidir.
- `is_system` marca los tipos que el sistema necesita para funcionar. Hoy solo "Repuestos": es el default del formulario y del bulk-upload. No se puede renombrar, desactivar ni borrar.
- `supports_vehicle_compatibility` decide si un producto de ese tipo puede tener filas en `replacement_compatibility`. Solo "Repuestos" arranca en `true`.
- Quién crea tipos: solo `GOD` / `MODERATOR`. Un tipo nuevo nace `is_verified = false`.

## Fase 2 — Relación tipo ↔ marca

**No se crea `product_type_brands` por ahora.** `brand_replacements` es por país (`UNIQUE (normalized_name, country_code)`), así que "Samsung" AR y "Samsung" CO son filas distintas y habría que mantener el mapeo por cada una. Además la relación ya se deduce del propio catálogo:

```sql
SELECT DISTINCT product_type_id, brand_id FROM global_replacements;
```

Para filtros en el frontend (marcas disponibles según el tipo elegido) se consulta esa combinación, o se expone como vista si el rendimiento lo pide. Si más adelante se necesita una lista *curada* de marcas por tipo (independiente de lo cargado), se crea entonces la tabla intermedia:

```sql
CREATE TABLE product_type_brands (
    product_type_id INTEGER NOT NULL REFERENCES product_types(id) ON DELETE CASCADE,
    brand_id INTEGER NOT NULL REFERENCES brand_replacements(id) ON DELETE CASCADE,
    PRIMARY KEY (product_type_id, brand_id)
);
```

## Fase 3 — `global_replacements`: `sku` + `product_type_id`

Orden dentro de la misma migración:

1. **Verificar datos existentes** (si alguno no cumple, corregirlo antes de continuar):
   ```sql
   SELECT id, code_oem FROM global_replacements
   WHERE code_oem IS NOT NULL AND code_oem !~ '^[A-Z0-9]{1,64}$';
   ```
2. **Renombrar** columna y constraint único:
   ```sql
   ALTER TABLE global_replacements RENAME COLUMN code_oem TO sku;
   ALTER TABLE global_replacements
     RENAME CONSTRAINT "UQ_e1e81cd942ffd82a1b1891d16e3" TO "<nombre generado por TypeORM>";
   ```
   El nombre del constraint lo genera TypeORM a partir de tabla + columnas. Después de actualizar la entidad, correr `migration:generate` y verificar que **no produzca diff**; si lo produce, ajustar el nombre.
3. **Reforzar el formato:**
   ```sql
   ALTER TABLE global_replacements
     ADD CONSTRAINT ck_global_replacements_sku_format CHECK (sku ~ '^[A-Z0-9]{1,64}$');
   ```
4. **Agregar el tipo con backfill**, en este orden para no dejar filas huérfanas:
   ```sql
   ALTER TABLE global_replacements
     ADD COLUMN product_type_id INTEGER REFERENCES product_types(id) ON DELETE RESTRICT;
   UPDATE global_replacements
     SET product_type_id = (SELECT id FROM product_types WHERE normalized_name = 'REPUESTOS');
   ALTER TABLE global_replacements ALTER COLUMN product_type_id SET NOT NULL;
   CREATE INDEX idx_global_replacements_type_country
     ON global_replacements (product_type_id, country_code);
   CREATE INDEX idx_global_replacements_type_brand
     ON global_replacements (product_type_id, brand_id);
   CREATE INDEX idx_global_replacements_brand
     ON global_replacements (brand_id);
   ```
   Postgres no crea índice automático para una FK. Cada índice tiene un uso:
   - `(product_type_id, country_code)`: filtrar por tipo y país. Cubre también las consultas solo por tipo, por eso no hace falta un índice simple en `product_type_id`.
   - `(product_type_id, brand_id)`: la consulta "marcas disponibles por tipo" de la Fase 2.
   - `(brand_id)`: filtrar por marca y evitar un escaneo completo cuando Postgres valida el `ON DELETE RESTRICT` al borrar una marca. Hoy esta FK no tiene índice.
5. **Opcional, misma migración — índices en `replacement`.** Hoy la tabla solo tiene PK: `findAll` filtra por `tenant_id` en cada listado y el bulk-upload busca por `global_replacement_id`, ambos sin índice.
   ```sql
   CREATE INDEX idx_replacement_tenant ON replacement (tenant_id, "createdAt");
   CREATE INDEX idx_replacement_global ON replacement (global_replacement_id);
   ```
   `CREATE INDEX` bloquea las escrituras de la tabla mientras se construye (las ventas hacen `UPDATE` de stock sobre `replacement`). Antes de desplegar, ejecutar `SELECT count(*) FROM replacement;`: hasta ~100 mil filas el bloqueo es despreciable; por encima de eso, mover este paso a una migración aparte en un horario de poco tráfico. `CONCURRENTLY` no se puede usar dentro de la transacción de una migración TypeORM.

El `down` revierte en orden inverso (índices, columna `product_type_id`, `CHECK`, rename de vuelta, `DROP TABLE product_types`).

---

## Fase 4 — Backend (`repuestito-api/src/`)

### Rename `codeOem` → `sku`

| Archivo | Cambio |
|---|---|
| `global-replacement/global-replacement.entity.ts` | Propiedad `sku`, `name: 'sku'`, `@Unique(['sku', 'countryCode'])`. |
| `replacement/replacement.service.ts` | `cleanCodeOem` → `cleanSku`, `orUpdate([...], ['sku', 'country_code'])`. |
| `replacement/dto/create-replacement.dto.ts` | Propiedad `sku` con `@Matches(/^[A-Za-z0-9]+$/)` y `@MaxLength(64)`. |
| `replacement-bulk-upload/dto/bulk-upload-row.dto.ts` | Mismo cambio; descripción de Swagger actualizada. |
| `replacement-bulk-upload/replacement-bulk-upload.processor.ts` | Variables, mensajes de error ("Código OEM …" → "SKU …") y consultas. |
| `replacement-compatibility/replacement-compatibility.entity.ts` | Solo el comentario. |
| `scripts/seed-replacements.ts` | SQL con `sku` y `ON CONFLICT (sku, country_code)`. |
| `README.md` | Referencias. |

### Tipos de producto

- Nueva entidad `ProductType` y módulo `product-type/` (carpeta propia, como el resto).
- Entidad `GlobalReplacement`: `productTypeId` + relación `ManyToOne` a `ProductType` (`RESTRICT`).
- Endpoints:

  | Método | Ruta | Acceso |
  |---|---|---|
  | `GET` | `/api/product-types` | Autenticado (para selects y filtros) |
  | `POST` | `/api/product-types` | `GOD`, `MODERATOR` |

- Administración de tipos (`PUT`, `DELETE`, `merge` y listado paginado): ver Fase 6.
- `ReplacementService.create()`: recibe `productTypeId` en el DTO. **Mientras el frontend antiguo siga desplegado, si falta se asume "Repuestos"**; ese default se elimina cuando el frontend nuevo esté en producción.
- Bulk-upload: la columna de tipo **no** se agrega al CSV en esta fase; todas las filas cargan como "Repuestos". Documentarlo en `file-upload.md`.
- Compatibilidad vehicular: `ReplacementCompatibilityService` rechaza (400) cualquier alta si el `product_type` del global no tiene `supports_vehicle_compatibility = true`.
- `findAll()` del catálogo: aceptar filtro `productTypeId` y devolver `productType` en la respuesta.
- Eventos de auditoría (ver `audit-logging.md`) para alta de `product_type`.

## Fase 5 — Frontend (`repuestito/`)

- `services/replacement.service.ts`: `codeOem` → `sku` (tipo `GlobalReplacement` y payload de creación) y nuevo `product-type.service.ts`.
- Etiquetas "Código OEM" → "SKU" en:
  - `app/(main)/dashboard/replacement/page.tsx` (formulario de alta)
  - `app/(main)/dashboard/replacement/[id]/show/page.tsx`
  - `app/(main)/parts/[id]/page.tsx`
  - `components/features/replacements/EditReplacementForm.tsx`
  - `app/(main)/dashboard/compatibility/page.tsx` (búsqueda y la prop `oemCode` → `sku`)
- Formulario de alta con tipo, marca (autocompletables con creación) y SKU: ver Fase 6.
- Home / dashboard: filtro por tipo (ver `filters-component.md`).
- Ocultar la pantalla y las acciones de compatibilidad para productos cuyo tipo no la soporta.
- Plantilla CSV `public/templates/productos-ejemplo.csv`: encabezado `codeOem` → `sku`.

## Fase 6 — Alta de producto desde la UI (tipos, marcas y producto)

### Objetivo

Que el usuario cree un producto completo desde un solo formulario y, si el tipo o la marca no existen, los cree ahí mismo. Tipos y marcas **nunca se duplican**: si ya existen se avisa que ya están creados y se ofrece usar el existente. Se buscan con un autocompletable.

### Flujo del formulario (`dashboard/replacement`, modal de alta)

1. **Imagen**: `ImageUpload` (ya existe). Opcional. Solo se elige y se previsualiza; **se sube a Cloudinary al confirmar el formulario**, no al seleccionarla.
2. **Nombre** del producto.
3. **Tipo**: autocompletable + "Crear tipo".
4. **Marca**: autocompletable + "Crear marca".
5. **Precio** y **Stock**.
6. **SKU** (opcional).
7. **Local** y **Sucursal**: se mantienen como hoy (`tenantId` sigue siendo obligatorio).

Comportamiento de tipo y marca:

- Al escribir busca en el servidor (con debounce) y lista las coincidencias.
- Si no hay coincidencia exacta, la última opción es "Crear «texto»", que abre un mini-`Modal` con el nombre prellenado (marca: logo opcional con `ImageUpload`; tipo: solo el nombre).
- Al crear: `201` → queda seleccionado. `409` → `Alert` "La marca «Samsung» ya está creada" con un botón "Usar esta" que la selecciona (el `409` trae el registro existente en `existing`).
- El servidor decide qué es un duplicado con `normalized_name`, así que `"samsung "`, `"SAMSUNG"` y `"Samsung"` son la misma marca; en tipos, además, `"Cámaras"` y `"camaras"`.

### Backend

| Método | Ruta | Acceso | Nota |
|---|---|---|---|
| `GET` | `/api/product-types?search=&limit=10` | Autenticado | Autocompletable. |
| `POST` | `/api/product-types` | `GOD`, `MODERATOR` | `409` con `existing`. |
| `GET` | `/api/brand-replacements?search=&countryCode=&limit=10` | Autenticado | Ya existe. |
| `POST` | `/api/brand-replacements` | `GOD` → **`GOD`, `MODERATOR`** | Hoy es solo `GOD`. `409` con `existing`. |
| `GET` | `/api/global-replacements/by-sku?sku=&countryCode=` | Autenticado | Nuevo (ver "SKU ya existente"). |

- **Permisos:** `MODERATOR` ya puede crear repuestos, así que también puede crear las marcas y tipos que necesita. `PUT` y `DELETE` siguen siendo `GOD`. Los registros creados desde la UI nacen `is_verified = false`; las marcas llevan el `countryCode` del tenant elegido en el formulario. Como el catálogo es compartido, una marca o tipo creado por un moderador lo ven todos los tenants: se mitiga con `is_verified = false` y auditoría.
- **`409` con el existente:** hoy responde solo `{ statusCode, code: 'BRAND_CONFLICT' }`. Debe incluir `existing` (`id`, `name`, ...) para que la UI lo pueda seleccionar. Agregar `PRODUCT_TYPE_CONFLICT` a `ErrorCodes`.
- **Carrera:** `BrandReplacementService.create()` hace `findOne` y luego `save`; dos peticiones simultáneas pueden pasar el chequeo. La garantía real es el `UNIQUE`: capturar el error Postgres `23505` y responder el mismo `409` (buscando y devolviendo el existente). Aplica a marcas y a tipos. `UNIQUE (normalized_name, country_code)` no protege cuando `country_code` es `NULL` (Postgres trata los `NULL` como distintos); las marcas creadas desde la UI siempre llevan país.
- **Validación del nombre:** `trim`, longitud 2–100 y rechazar (400) los nombres cuyo normalizado queda vacío (por ejemplo `"!!!"`).
- **Búsqueda de tipos:** normalizar el término con `normalizeProductTypeName` y buscar sobre `normalized_name`, para que `"cámara"` encuentre `"CAMARAS"`. `limit` máx. 10 para el autocompletable.
- `@Throttle` en los dos `POST`. Eventos de auditoría `brand.created` y `product_type.created` (ver `audit-logging.md`).
- **SKU ya existente:** hoy `ReplacementService.create()` usa `orUpdate(['name', 'image_url'])`. Si otro tenant crea un producto con un SKU que ya existe, **pisa el nombre y la imagen del producto compartido** y deja la marca y el tipo originales, que no coinciden con lo que eligió el usuario. Cambiar a: si `(sku, country_code)` existe, reutilizar ese `global_replacements` sin modificarlo. Para avisar *antes* de guardar, el endpoint `by-sku` (nuevo controlador en el módulo `global-replacement`) devuelve nombre, marca, tipo e imagen del producto existente.

### Frontend

- `services/product-types.service.ts` (nuevo, mismo patrón que `brands.service.ts`): `getProductTypes` y `createProductType`.
- En `brands.service.ts` y `product-types.service.ts`, ante un `409` lanzar un error tipado que conserve `existing` (hoy `req` solo conserva `code`).
- Componente nuevo `components/shared/CatalogPicker/` (`CatalogPicker.tsx` + `index.ts`), usado dos veces (tipo y marca). Props: nombre de la entidad, `search`, `create`, `getLabel`, `getKey`, `value`, `onChange`. Se construye sobre `components/ui/Autocomplete`, `Modal` y `Alert`.
- Ajustes a `components/ui/Autocomplete`:
  - Prop opcional `onCreate` que agrega la opción final "Crear «texto»".
  - Usar `minChars={2}` en este caso: el default (3) no encuentra marcas como "MG".
  - `onSearch` está en las dependencias de un `useEffect`; hay que pasarle una función estable (`useCallback`), si no el efecto se reinicia en cada render.
- Reemplaza el `Select` de marcas del formulario, que carga solo 100 marcas (`limit: 100`) y no escala.
- **SKU:** el campo acepta solo `A-Z` y `0-9` (pasa a mayúsculas al escribir) con máximo 64 caracteres. Al salir del campo consulta `by-sku`; si existe, muestra "Este SKU ya existe: «Nombre» — Marca" y un botón "Usar este producto", que rellena y bloquea nombre, tipo, marca e imagen (quedan editables precio, stock, local y sucursal).
- **Imagen: se sube al guardar, no al elegirla.** Hoy `ImageUpload` sube el archivo a `/api/upload` apenas se selecciona; si el usuario cancela el modal o el alta falla (por ejemplo con un `409`), la imagen queda huérfana en Cloudinary. Cambio:
  - `ImageUpload` deja de hacer el `fetch`: comprime, previsualiza (blob) y entrega el `File` al padre (`onChange(file | null)`). Agrega un botón "Quitar" y libera el blob con `URL.revokeObjectURL` al reemplazarlo o al desmontar (hoy no se libera).
  - Nuevo `services/upload.service.ts` con `uploadImage(file)`, que recibe el `fetch` que hoy vive dentro del componente.
  - `handleCreate`: primero valida los campos obligatorios, luego sube la imagen y después hace `POST /api/replacements` con `imageUrl`. La URL subida se guarda en estado para que un reintento tras un error del alta **no vuelva a subir** el mismo archivo; se invalida si el usuario elige otra imagen.
  - Si la subida falla, se muestra el error en el formulario y **no** se crea el producto (evita guardarlo sin imagen en silencio). El usuario puede reintentar o quitar la imagen.
  - Si el SKU ya existe y el usuario elige "Usar este producto", el archivo local se descarta sin subirlo (antes se subía y luego se ignoraba).
  - Caso residual: subida correcta, alta fallida y el usuario abandona el formulario → queda una imagen huérfana. Es mucho menos frecuente que hoy. La opción más robusta, fuera de alcance, es subir la imagen desde el backend dentro de `create()` (multipart) y borrarla si la transacción falla.
  - `/api/upload` no cambia (sigue para `GOD` y `MODERATOR`).
- El tipo **no** viene preseleccionado: el usuario debe elegirlo (o crearlo). `canCreate` exige tipo y marca. El backend conserva «Repuestos» como valor por defecto solo cuando el cliente no envía `productTypeId` (clientes anteriores y bulk-upload).
- Vista de edición: mostrar el tipo en solo lectura junto al nombre y la marca.
- Colores solo desde `styles/theme.css`.

### Administración de tipos (`GOD`)

Un `MODERATOR` puede crear tipos libremente, así que `GOD` necesita una pantalla para revisarlos y corregirlos, igual que `dashboard/admin/brands` con las marcas.

**Backend** (mismo módulo `product-type/`):

| Método | Ruta | Acceso | Nota |
|---|---|---|---|
| `GET` | `/api/product-types?page=&limit=&search=&isVerified=&isActive=` | Autenticado | Paginado igual que marcas; cada fila trae `productsCount`. El autocompletable usa `limit=10&isActive=true`. |
| `PUT` | `/api/product-types/:id` | `GOD` | Edita `name`, `isVerified`, `isActive`, `supportsVehicleCompatibility`. `409` si el nombre normalizado ya existe. |
| `DELETE` | `/api/product-types/:id` | `GOD` | `409 PRODUCT_TYPE_HAS_PRODUCTS` si tiene productos. |
| `POST` | `/api/product-types/:id/merge` | `GOD` | Body `{ targetId }`. Mueve los productos al tipo destino y elimina el origen. |

Reglas:

- Un tipo con `is_system = true` no se puede renombrar, desactivar, borrar ni usar como origen de una fusión (`409 PRODUCT_TYPE_IS_SYSTEM`). Sí puede ser destino.
- `merge` corre en una transacción: `UPDATE global_replacements SET product_type_id = :targetId WHERE product_type_id = :id` y luego borra el origen. Existe porque renombrar no alcanza cuando el nombre correcto ya existe (`"Celulres"` → `"Celulares"` daría `409`) y borrar está bloqueado mientras haya productos. Se rechaza (`409`) si el origen tiene productos con filas en `replacement_compatibility` y el destino no soporta compatibilidad vehicular.
- Apagar `supportsVehicleCompatibility` en un tipo cuyos productos ya tienen compatibilidades cargadas → `409`.
- Desactivar un tipo (`isActive = false`) lo oculta del autocompletable; los productos que ya lo tienen lo conservan.
- Auditoría: `product_type.updated`, `product_type.deleted` y `product_type.merged` (con `before` / `after` y la cantidad de productos movidos).

**Frontend:**

- `app/(main)/dashboard/admin/product-types/page.tsx` + `page.module.css`, con el mismo patrón y componentes que `admin/brands/page.tsx`: `MainTitle`, `Breadcrumbs`, `Search`, `Table`, `Badge`, `Dropdown`, `Modal`, `Toggle`, `Paginator`, `PageCount`, `Loading`. Acceso con `usePermissions().isAdmin`.
- Columnas: Nombre, Productos (`productsCount`), Compatibilidad vehicular, Verificado, Activo.
- Filtro rápido "Sin verificar", que sirve como cola de revisión de lo que crearon los moderadores.
- Acciones por fila (`Dropdown`): Editar, Fusionar en…, Eliminar (deshabilitada si `productsCount > 0` o si el tipo es de sistema).
- Modal de edición: nombre y `Toggle` para Verificado, Activo y Soporta compatibilidad vehicular.
- Modal de fusión: selector del tipo destino (autocompletable que excluye el origen) y confirmación "Se moverán N productos a «Destino» y se eliminará «Origen»".
- Entrada nueva en `components/features/dashboard/DashboardSidebar.nav.ts`, junto a "Marcas", con `minRole: 'ADMIN'` (reutilizar un icono existente de `public/icons`).
- `services/product-types.service.ts`: agregar `updateProductType`, `deleteProductType` y `mergeProductType`. Textos en español para `PRODUCT_TYPE_HAS_PRODUCTS` y `PRODUCT_TYPE_IS_SYSTEM`.

## Fase 7 — Documentación

Actualizar en el mismo cambio (regla del proyecto: `file-upload.md` debe seguir el flujo de bulk-upload):

- `steps/file-upload.md` (encabezado del CSV, mensajes de error, tipo por defecto)
- `steps/global-replacement.md`
- `steps/vehicle-compatibility.md`
- `steps/audit-logging.md`
- `steps/integration-with-meli.md` (mapeo por `sku`, tipos por categoría)
- `CLAUDE.md`, sección "Modelo de datos" (ya está desactualizada respecto al esquema real)

---

## Compatibilidad y despliegue

- **CSV existentes:** los usuarios pueden tener archivos con encabezado `codeOem`. Aceptar `codeOem` como alias de `sku` durante una versión y mostrar un aviso; retirarlo después.
- **Cómo se despliega realmente** (revisado en el VPS): cada repo tiene un workflow de GitHub Actions (`.github/workflows/deploy.yml`) que, ante un `push` a `master`, entra por SSH al VPS y ejecuta `/opt/piezify/deploy.sh api` (o `frontend`). Ese script hace `git fetch origin master && git reset --hard origin/master` en `/opt/piezify/<repo>` (repos git con `origin` en GitHub) y luego `docker compose build` + `up -d` del servicio. **Un `push` a `master` despliega a producción**; commitear en local no. Los dos repos se despliegan por separado y en paralelo, sin orden garantizado.
- **Las migraciones no se ejecutan en el deploy:** el `Dockerfile` del API termina en `CMD ["node", "dist/main"]`, y ni `docker-compose.yml`, ni `deploy.sh`, ni los workflows corren `migration:run`. En producción están aplicadas solo `InitialSchema`, `CreateOrdersBilling` y `CreateAuditEvent`. Si se hace `push` del backend sin aplicar `EvolveCatalog`, el API nuevo consulta `sku` y `product_type_id`, que no existen, y falla.
- **Propuesta:** agregar a `deploy_api()` en `/opt/piezify/deploy.sh`, entre el `build` y el `up -d`, `docker compose run --rm api npm run migration:run`. La imagen incluye `src/` y las dependencias de desarrollo (`npm ci` sin `--omit=dev`) y recibe las variables `DB_*` de `api.env`, por lo que debería funcionar; falta probarlo. Pendiente de aprobación: es un cambio en producción.
- **Orden:** migración → backend → frontend. Entre que la migración renombra la columna y el contenedor nuevo arranca, el API anterior falla unos segundos; con la DB vacía no afecta a nadie.
- **Sin backups de la DB:** no hay cron ni volcados (`pg_dump`) en el servidor, solo copias `*.rsync-backup-*` del código. Conviene un `pg_dump` antes de cada migración y uno periódico.
- **Probar `up` y `down` en local antes** (Fase 8): el rename y el `NOT NULL` no tienen rollback automatizado en el deploy, y si la migración falla queda el backend nuevo sin esquema compatible.

## Verificación (Fase 8)

1. Correr `up` y `down` en una copia de la DB local; ambos sin errores.
2. `SELECT count(*) FROM global_replacements WHERE product_type_id IS NULL;` → `0`.
3. `migration:generate` no produce diff.
4. Crear un repuesto desde el formulario y por bulk-upload (CSV con `sku`, y otro con `codeOem` para probar el alias); ambos deben quedar como "Repuestos".
5. Intentar un SKU inválido (`AB-12`, más de 64 caracteres) → rechazado por DTO y por `CHECK`.
6. Crear dos tipos nuevos ("Smartphones", "Componentes de PC"), un producto maestro de cada uno con su marca, y confirmar que la compatibilidad vehicular se rechaza para ellos y se acepta para "Repuestos".
7. Home y dashboard filtran por tipo y por país.
8. Crear una marca nueva desde el formulario: queda seleccionada, con `is_verified = false` y el país del tenant elegido. Igual para un tipo nuevo.
9. Crear `"samsung "` existiendo `"Samsung"` → `409`, aviso "ya está creada", "Usar esta" la selecciona y no se crea ninguna fila. Igual para tipos (`"camaras"` contra `"Cámaras"`).
10. Dos `POST` simultáneos con el mismo nombre → una sola fila y un `409`.
11. Nombre `"!!!"` → 400.
12. El autocompletable encuentra `"cámara"` y `"camara"`, y encuentra una marca que no estaba entre las primeras 100.
13. SKU existente: aviso al salir del campo y, al guardar, el producto compartido no cambia de nombre, imagen, marca ni tipo.
14. Un usuario `SELLER` no puede crear marcas ni tipos (403).
15. Elegir una imagen y cancelar el modal → ninguna petición a `/api/upload` (verificar en la pestaña Network).
16. Elegir una imagen y guardar → una sola subida y luego el `POST` del producto con `imageUrl`. Si el alta falla y se reintenta, no hay una segunda subida.
17. Alta sin imagen → el producto se crea sin `imageUrl` y sin llamar a `/api/upload`.
18. `MODERATOR` recibe 403 en `PUT`, `DELETE` y `merge` de tipos; `GOD` puede.
19. Fusionar "Celulres" (3 productos) en "Celulares": los 3 productos quedan en "Celulares", "Celulres" desaparece y el `productsCount` de "Celulares" sube en 3.
20. Borrar un tipo con productos → `409` con mensaje en español; sin productos → se borra.
21. "Repuestos" no se puede renombrar, desactivar, borrar ni fusionar como origen.
22. Un tipo desactivado no aparece en el autocompletable del formulario, pero los productos que ya lo tenían lo siguen mostrando.

## Orden de implementación

Un commit por paso y por repo (recuerda que el `push` a `master` despliega):

1. **Backend — esquema:** entidades (`ProductType`, cambios en `GlobalReplacement`), generar y editar la migración, probar `up` y `down` en local.
2. **Backend — lógica:** rename a `sku`, módulo `product-type` (con `PUT`, `DELETE` y `merge`), cambios en marcas (`409` con `existing`, permisos, `23505`), `create()` sin `orUpdate`, `by-sku`, bulk-upload y seed.
3. **Frontend:** rename, services, `CatalogPicker`, ajustes a `Autocomplete` e `ImageUpload`, formulario, filtros por tipo y pantalla `admin/product-types`.
4. **Documentación** (Fase 7).
5. **Verificación completa** en local (Fase 8), `pg_dump` de producción, migración, `push` del backend y después del frontend.

## Pendientes antes de empezar

1. **Cómo se genera la migración.** TypeORM compara las entidades contra la DB; si la entidad no declara lo mismo que la migración, `migration:generate` propone borrarlo o recrearlo (y la verificación 3 de la Fase 8 falla). Por eso:
   - Declarar en las entidades el `@Check` del SKU, los `@Index` nuevos (con los mismos nombres) y el `@ManyToOne` a `ProductType`.
   - No escribir los constraints a mano con nombres propios (`unique_product_type_normalized`, FK inline): TypeORM usa nombres con hash. Lo más simple es escribir las entidades, correr `migration:generate` y **editar a mano** solo lo que TypeORM no puede inferir: el `INSERT` de "Repuestos", el backfill y `RENAME COLUMN code_oem TO sku`. Sin esa edición, `generate` haría `DROP` + `ADD` de la columna y **se perderían los códigos OEM existentes**. Con este método el `<nombre generado por TypeORM>` de la Fase 3 deja de ser un placeholder.
   - `package.json` solo tiene `migration:run` y `migration:revert`: agregar `migration:generate`.
   - El proyecto usa TypeORM `^1.0.0`. Verificar en esa versión el comportamiento anterior antes de darlo por hecho.
2. **Mensajes de error en el frontend.** Los services lanzan `Error(body.code)` y las pantallas muestran `err.message`; no encontré ningún mapeo de `BRAND_CONFLICT` a texto en el frontend. Definir los textos en español de los códigos nuevos (`PRODUCT_TYPE_CONFLICT`, nombre inválido) para que el usuario no vea el código crudo.
3. **Datos de producción.** Ejecutar contra la DB real los dos `count(*)` (Fase 3, paso 5) y la consulta de verificación del SKU (Fase 3, paso 1) antes de escribir la migración; si algún `code_oem` no cumple el formato, hay que limpiarlo primero.
4. **Tests automáticos (opcional).** `jest` está configurado. Cubrir al menos `normalizeProductTypeName` (tildes, espacios, símbolos, nombre vacío tras normalizar) y el `409` por duplicado, que son las reglas que más se rompen sin que nadie lo note.

## Fuera de alcance / futuro

- Atributos específicos por tipo (RAM, almacenamiento, color): decidir entre columna `attributes jsonb` en `global_replacements` o tabla de atributos.
- Jerarquía de tipos (`parent_id` en `product_types`, p. ej. "Celulares > Smartphones").
- Renombrar `global_replacements` / `replacement` a nombres genéricos.
- Columna de tipo en el CSV del bulk-upload.
- `meli_category_id` en `product_types` para mapear categorías de Mercado Libre.
