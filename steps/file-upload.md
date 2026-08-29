# Carga masiva de repuestos (bulk-upload) — Cómo funciona

> Estado: implementado y funcionando.

---

## Objetivo

Permitir a un `MODERATOR`/`GOD` cargar múltiples repuestos de una sola vez subiendo un CSV, en vez de crearlos uno por uno desde el formulario. El CSV pide solo datos que el usuario que hace la carga conoce (nombre, marca, código OEM, precio, stock); todo lo que depende de su cuenta (tenant, sucursal, país, ubicación) se resuelve del lado del servidor.

---

## Flujo end-to-end

```
Frontend (app/(main)/dashboard/replacement/bulk-upload/page.tsx)
  │
  ├─ FileDropzone (components/shared/FileDropzone) — selecciona/arrastra el .csv
  │
  ├─ POST /api/replacements/bulk-upload  (multipart/form-data, field "file")
  │     └─ 202 Accepted → { jobId, status: "queued" }
  │        (la respuesta es inmediata; el archivo se procesa en background)
  │
  └─ Poller cada 2s → GET /api/replacements/bulk-upload/:jobId/status
        └─ hasta status "done" o "failed"
```

El frontend nunca espera el procesamiento completo: sube el archivo, recibe un `jobId`, y hace polling del estado.

---

## Backend — módulo `replacement-bulk-upload`

```
repuestito-api/src/replacement-bulk-upload/
  replacement-bulk-upload.controller.ts   POST / y GET /:jobId/status
  replacement-bulk-upload.service.ts      valida archivo + usuario, resuelve tenant/país, crea el job, dispara el processor
  replacement-bulk-upload.processor.ts    parseo CSV, resolución de marca, validación de filas, inserts en batch
  dto/bulk-upload-row.dto.ts              shape + validaciones de cada fila del CSV

repuestito-api/src/brand-replacement/
  normalize-brand-name.util.ts            normalización de nombre de marca, compartida con BrandReplacementService
```

### Guards y límites

- `JwtAuthGuard` + `RolesGuard` con `@Roles(UserRole.GOD, UserRole.MODERATOR)` — solo esos roles pueden subir.
- `FileInterceptor` con `memoryStorage()`, `fileSize` máx. **5 MB**, y `fileFilter` que rechaza cualquier extensión que no sea `.csv`.
- `@Throttle` a 10 uploads/min por IP (más estricto que el límite global de 60/min).
- `ReplacementBulkUploadService.enqueue()` valida además `mimetype` (`text/csv`, `application/csv`, `text/plain`).

### Datos que vienen de la sesión, no del CSV

`tenantId`, `branchId`, `countryCode`, `latitude` y `longitude` **no son columnas del archivo**: son los mismos para todas las filas de una misma carga (dependen de quién sube el archivo, no de cada repuesto), así que se resuelven una sola vez en `enqueue()`/al arrancar el job, no por fila:

| Campo | De dónde sale | Si falta |
|---|---|---|
| `tenantId` | `req.user.tenantId` (entidad `User`, cargada por `JwtStrategy` en el guard) | 400 `El usuario no tiene un tenant asignado` |
| `branchId` | `req.user.branchId` | queda `null` (sucursal es opcional) |
| `countryCode` | `Tenant.country` del tenant del usuario (`TenantRepository`, en `enqueue()`) | 400 `El tenant no tiene país configurado` |
| `latitude`/`longitude` | `Branch.latitude`/`Branch.longitude` de la sucursal del usuario, si tiene `branchId` | quedan `null` |

Las validaciones de `tenantId`/`countryCode` cortan en `enqueue()` con un 400 síncrono, antes de encolar el job — el usuario se entera al toque, sin esperar el polling.

### Estado del job — en memoria, no en DB

```ts
const jobStore = new Map<string, JobState>();  // replacement-bulk-upload.processor.ts:39
```

- El estado (`queued` → `processing` → `done`/`failed`) vive en un `Map` del proceso Node, **no se persiste en Postgres**.
- Si el servidor se reinicia, todos los jobs en curso se pierden y sus `jobId` dejan de existir (`GET .../status` responde 404).
- No hay cola tipo BullMQ; el procesamiento corre fire-and-forget (`processAsync` no hace `await`).

### Parseo del CSV

Columnas esperadas (header obligatorio, orden no importa):

```
name, brand, codeOem, imageUrl, price, stock
```

| Campo | Tipo | Obligatorio | Notas |
|---|---|---|---|
| `name` | string | sí | |
| `brand` | string | sí | nombre de marca en texto libre — ver "Resolución de marca" abajo |
| `codeOem` | string | no | se normaliza a `A-Z0-9` mayúsculas antes de insertar |
| `imageUrl` | URL | no | |
| `price` | number positivo | sí | |
| `stock` | int ≥ 0 | no | default `0` |

- Parseo con `csv-parse` (`columns: true`, `skip_empty_lines: true`, `trim: true` — recorta espacios al borde de cada celda).
- **Celdas vacías se transforman a `undefined`** antes de validar (`emptyToUndefined` en el DTO) — así los campos opcionales realmente se tratan como ausentes en vez de fallar `IsUrl`/`IsNumber` sobre `""`.
- **Sanitización anti CSV-injection**: celdas que arrancan con `=`, `+`, `@` se prefijan con `'` para neutralizar fórmulas si el CSV se abre en Excel. Los campos numéricos (`price`, `stock`) están excluidos de esta sanitización porque un valor negativo legítimo arranca con `-` y se corrompería.

### Resolución de marca (`brand`) — get-or-create por `normalized_name`

En vez de pedir un `brandId` (dato que quien carga el CSV no tiene forma de conocer), `brand` es el nombre de la marca en texto libre. Se resuelve **una vez por job**, no por fila, para evitar N+1:

1. Se toman los nombres distintos de `brand` presentes en el archivo y se normalizan con `normalizeBrandName()` (`brand-replacement/normalize-brand-name.util.ts`, la misma función que usa `BrandReplacementService` al crear/editar marcas desde el panel): mayúsculas, símbolos y puntuación afuera (se conservan letras Unicode —incluidas tildes/Ñ— y números), espacios múltiples colapsados a uno, sin espacios al borde.
2. Se buscan en `brand_replacements` por `normalized_name` + el `countryCode` resuelto del tenant.
3. Los nombres que no matchean ninguna marca existente **se crean automáticamente** (`isVerified: false`), guardando el nombre tal como vino en el archivo (ya sanitizado) y ese `countryCode`.
4. Cada fila usa el `id` resuelto (existente o recién creado) como `brandId` al insertar en `global_replacement`.

Ejemplo: `"Bosch"`, `"bosch"` y `"Bosch!!"` normalizan al mismo `"BOSCH"` y comparten marca. Un nombre con un typo real (`"Boch"`) no matchea y crea una marca nueva sin verificar — no hay fuzzy matching, solo exact match sobre el nombre normalizado.

### Validación por fila

Por cada fila, en orden:
1. `class-validator` sobre `BulkUploadRowDto` (tipos, obligatoriedad, formato).
2. Duplicado de `codeOem` **dentro del mismo archivo** (mismo `codeOem` ya visto en una fila anterior; `countryCode` es el mismo para todo el archivo) → se rechaza, gana la primera ocurrencia.
3. La marca debe haberse podido resolver en el paso anterior (en la práctica siempre se resuelve, porque se crea si no existe).

Cualquier fila que falle en estos pasos se agrega a `errors[]` con `{ line, reason }` y no se intenta insertar.

### Inserción — `global_replacement` es catálogo compartido, `replacement` es tu listado

`global_replacement` identifica una pieza por `(codeOem, countryCode)` y **no pertenece a ningún tenant** — cualquier tenant/sucursal del mismo país puede vender la misma pieza. `replacement` es tu listado individual (precio, stock, sucursal) apuntando a ese catálogo. El bulk-upload sigue el mismo patrón que el alta individual (`ReplacementService.create()`):

- Las filas válidas se procesan en **batches de 500** (`BATCH_SIZE`), cada batch en su propia transacción (`QueryRunner`).
- Por fila válida, si tiene `codeOem`:
  1. **Upsert** en `global_replacement` por `(code_oem, country_code)` (`.orUpdate(['name', 'image_url'], [...])`): si ya existe —la haya catalogado tu tenant, otro tenant, o vos en otra sucursal— se reutiliza su `id` y se le actualizan `name`/`image_url`; si no existe, se crea.
  2. **Chequeo propio**: ¿ya existe un `replacement` con ese `globalReplacementId` para **tu** `(tenantId, branchId)`? Si sí, la fila se rechaza (`Ya tenés un listado para el código OEM '...' en esta sucursal`) — evita que resubir el mismo archivo te duplique el listado a vos. Si no, sigue.
- Si no tiene `codeOem`: `INSERT` directo en `global_replacement` sin upsert (los `NULL` no colisionan en Postgres, así que siempre crea uno nuevo — no hay forma de reusar catálogo para piezas sin código OEM).
- En ambos casos: `INSERT` en `replacement` con `globalReplacementId` apuntando al registro (reusado o nuevo), más `price`/`stock` de la fila y `tenantId`/`branchId`/`latitude`/`longitude` resueltos del usuario (mismos valores para todas las filas del job).
- Si una fila del batch falla por otro motivo (ej. error de Postgres), se hace `rollbackTransaction()` de **todo el batch** y todas sus filas se marcan como `failed` con el mensaje del error.

### Respuesta del status endpoint

```json
{
  "jobId": "uuid",
  "status": "processing",
  "total": 100,
  "succeeded": 97,
  "failed": 3,
  "errors": [{ "line": 42, "reason": "Código OEM 'F-4781' duplicado en el archivo" }]
}
```

---

## Frontend

### `components/shared/FileDropzone`
Componente genérico de drag & drop + click-to-select, reutilizado también por `components/ui/ImageUpload`. Solo maneja selección de archivo (`onFileSelect(file)`); no sabe nada de CSV ni de imágenes — eso lo decide quien lo consume.

### `app/(main)/dashboard/replacement/bulk-upload/page.tsx`
- Estado local: `file`, `uploading`, `job`, `uploadError`.
- Al confirmar, hace `POST` con `FormData` (solo el archivo — no manda tenant/país/marca, eso lo resuelve el backend), guarda el `jobId` devuelto y arranca un `setInterval` de 2s que pollea el status hasta `done`/`failed`.
- Muestra contador de `total`/`succeeded`/`failed` y el detalle de `errors` por línea.
- Template descargable en `public/templates/repuestos-ejemplo.csv`.

### Template `public/templates/repuestos-ejemplo.csv`

```csv
name,brand,codeOem,imageUrl,price,stock
TEST CARGA MASIVA 1,Bosch,F-4781,,12500,50
TEST CARGA MASIVA 2,Fram,PF-1190,https://example.com/img.jpg,18900,20
TEST CARGA MASIVA 3,Bosch,CD-3320,,45000,
```

Solo las columnas que el usuario final puede completar sin ayuda: nombre, marca (texto libre), código OEM opcional, imagen opcional, precio, stock opcional. No incluye tenant, sucursal, país ni coordenadas — esos los pone el backend según la cuenta que hace la carga.

---

## Limitaciones conocidas

- **Estado de job no persistido**: reinicio de server = jobs perdidos, sin forma de recuperar el resultado de una carga en curso.
- **Sin reintento automático de filas fallidas**: hay que corregir el CSV y volver a subir el archivo completo. Las filas con `codeOem` no se duplican en un reintento (el chequeo `globalReplacementId`+`tenantId`+`branchId` las rechaza), pero las filas sin `codeOem` no tienen ninguna protección — un reintento las vuelve a insertar como piezas nuevas.
- **Un usuario `GOD` sin `tenantId` propio no puede usar bulk-upload**: el endpoint responde 400 (`El usuario no tiene un tenant asignado`) porque no hay forma de elegir a qué tenant pertenecen las filas cargadas.
- **Un tenant sin `country` configurado bloquea el bulk-upload** de todos sus usuarios: 400 (`El tenant no tiene país configurado`).
- **Auto-creación de marcas sin control de typos**: si el usuario escribe el nombre de la marca distinto entre subidas de forma no trivial (ej. "Bosch" vs "Boch"), se crean marcas separadas no verificadas — no hay sugerencia/autocompletado ni deduplicación fuzzy, solo exact match por `normalized_name`.
