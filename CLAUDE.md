# Reglas del proyecto

## Diseño y paleta de colores
- La paleta de colores del frontend está definida en `styles/theme.css` como variables CSS (`--color-primary`, etc.).
- Al escribir o modificar estilos, usar siempre las variables de `theme.css`. Prohibido hardcodear colores que ya existan como variable.
- Si se necesita un color nuevo, agregarlo primero en `theme.css` y luego consumirlo vía variable.

## Componentes UI
- Antes de escribir un `<input>`, `<button>` u otro elemento HTML crudo, revisar si existe un componente en `components/ui/` o `components/shared/` que cubra el caso.
- Solo crear HTML crudo si ningún componente existente sirve.
- Todo componente nuevo debe vivir en su propia carpeta (`ComponentName/ComponentName.tsx`) con un barrel (`ComponentName/index.ts` con `export { default } from './ComponentName'`).
- Los imports siempre apuntan al barrel: `@/components/ui/ComponentName`, nunca al archivo directo.

## TypeScript
- No usar el tipo `any`. Usar siempre tipos específicos, `unknown` con narrowing, o tipos de utilidad (`Partial`, `Pick`, `Record`, etc.).

## Next.js
- Usar exclusivamente App Router (`app/`). Prohibido usar Pages Router (`pages/`, `getServerSideProps`, `getStaticProps`, `getInitialProps`, `_app.tsx`, `_document.tsx`).
- Componentes del servidor por defecto; agregar `'use client'` solo cuando se usen hooks o eventos del browser.
- Metadata con `export const metadata` o `generateMetadata`, no con `<Head>` de `next/head`.
- Navegación con `useRouter` de `next/navigation`, no de `next/router`.

## 1. No programar sin contexto
- ANTES de escribir codigo: lee los archivos relevantes, revisa git log, entiende la arquitectura.
- Si no tienes contexto suficiente, pregunta. No asumas.

## 2. Respuestas cortas
- Responde en 1-3 oraciones. Sin preambulos, sin resumen final.
- No repitas lo que el usuario dijo. No expliques lo obvio.
- Codigo habla por si mismo: no narres cada linea que escribes.

## 3. No reescribir archivos completos
- Usa Edit (reemplazo parcial), NUNCA Write para archivos existentes salvo que el cambio sea >80% del archivo.
- Cambia solo lo necesario. No "limpies" codigo alrededor del cambio.

## 4. No releer archivos ya leidos
- Si ya leiste un archivo en esta conversacion, no lo vuelvas a leer salvo que haya cambiado.
- Toma notas mentales de lo importante en tu primera lectura.

## 5. Validar antes de declarar hecho
- Despues de un cambio: compila, corre tests, o verifica que funciona.
- Nunca digas "listo" sin evidencia de que funciona.

## 6. Cero charla aduladora
- No digas "Excelente pregunta", "Gran idea", "Perfecto", etc.
- No halagues al usuario. Ve directo al trabajo.

## 7. Soluciones simples
- Implementa lo minimo que resuelve el problema. Nada mas.
- No agregues abstracciones, helpers, tipos, validaciones, ni features que no se pidieron.
- 3 lineas repetidas > 1 abstraccion prematura.

## 8. No pelear con el usuario
- Si el usuario dice "hazlo asi", hazlo asi. No debatas salvo riesgo real de seguridad o perdida de datos.
- Si discrepas, menciona tu concern en 1 oracion y procede con lo que pidio.

## 9. Leer solo lo necesario
- No leas archivos completos si solo necesitas una seccion. Usa offset y limit.
- Si sabes la ruta exacta, usa Read directo. No hagas Glob + Grep + Read cuando Read basta.

## 10. No narrar el plan antes de ejecutar
- No digas "Voy a leer el archivo, luego modificar la funcion, luego compilar...". Solo hazlo.
- El usuario ve tus tool calls. No necesita un preview en texto.

## 11. Paralelizar tool calls
- Si necesitas leer 3 archivos independientes, lee los 3 en un solo mensaje, no uno por uno.
- Menos roundtrips = menos tokens de contexto acumulado.

## 12. No duplicar codigo en la respuesta
- Si ya editaste un archivo, no copies el resultado en tu respuesta. El usuario lo ve en el diff.
- Si creaste un archivo, no lo muestres entero en texto tambien.

//## 13. No usar Agent cuando Grep/Read basta
//- Agent duplica todo el contexto en un subproceso. Solo usalo para busquedas amplias o tareas complejas.
//- Para buscar una funcion o archivo especifico, usa Grep o Glob directo.

---

## Arquitectura Big Picture

### Stack
| Capa | Tech |
|---|---|
| Frontend | Next.js 16 (App Router), React 19, TypeScript, CSS Modules, Leaflet/React-Leaflet |
| Backend | NestJS, TypeORM, PostgreSQL |
| Auth | JWT en httpOnly cookie, bcrypt, Resend (emails), `jose` (verificación en middleware) |
| Storage | Cloudinary (imágenes de repuestos) |
| Docs API | Swagger en `/docs` |

### Flujo general

```
Browser
  │
  ├─ /             → LoginPage (AuthBlock: login/register/verify/reset)
  │
  ├─ /parts/[id]   → detalle público de un repuesto
  │
  └─ /dashboard/**, /edit/** → protegidos por middleware.ts (verifica cookie `token` con jose)
                      redirige a / si token inválido/ausente

Frontend → NEXT_PUBLIC_API_URL (http://localhost:3000)
              └─ /api/** → NestJS (puerto 3000)
```

### Módulos NestJS (`repuestito-api/src/`)

```
AppModule
  ├─ AuthModule         POST /api/auth/{register,verify-email,login,logout,forgot-password,reset-password}
  │    └─ usa Resend para emails de verificación y reset
  ├─ UserModule         entidad User (roles: ADMIN | MODERATOR | SELLER)
  ├─ ReplacementModule  GET/POST/PATCH /api/replacements  (búsqueda paginada por nombre + country)
  ├─ VehicleModule      GET/POST /api/vehicles            (catálogo: brand/model/year/country/enums)
  ├─ ReplacementCompatibilityModule  /api/compatibility   (junction GlobalReplacement ↔ VehicleModel/VehicleVersion)
  ├─ TenantModule       POST /api/tenants                 (negocio con subdomain único)
  ├─ BranchModule       POST /api/branches                (sucursales de un Tenant)
  ├─ CountryModule      /api/countries                    (catálogo de países con código/moneda)
  ├─ UploadModule       POST /api/upload                  (Multer → Cloudinary)
  └─ CloudinaryModule   servicio interno de upload
```

### Modelo de datos (relaciones clave)

```
Tenant ──< Branch                       users → tenant_id, branch_id (FK)
Tenant ──< customers, orders, invoices  (particionadas por tenant_id; sin FK al replacement)

BrandReplacement ──< GlobalReplacement >── ProductType   (catálogo compartido, único por [sku, country_code])
GlobalReplacement ──< Replacement (oferta del tenant: price, stock, branch_id, tenant_id)
GlobalReplacement >──< VehicleModel/VehicleVersion   (vía ReplacementCompatibility, unique [globalReplacementId, modelId, versionId];
                                                       solo si ProductType.supportsVehicleCompatibility)
VehicleBrand ──< VehicleModel ──< VehicleVersion >── Country

GlobalReplacement: id, name, brand_id, product_type_id, sku (A-Z0-9, opcional), image_url, country_code, is_verified
Replacement:       id, global_replacement_id, price, stock, tenant_id, branch_id, active, latitude, longitude
ProductType:       id, name, normalized_name (único), supports_vehicle_compatibility, is_system, is_verified, is_active
```

Detalle y decisiones en `steps/evolution-catalog.md`.

### Servicios del frontend (`repuestito/services/`)

| Archivo | Qué hace |
|---|---|
| `auth.service.ts` | Wraps de fetch para todos los endpoints de auth; maneja cookie via `credentials: 'include'` |
| `replacement.service.ts` | `getReplacements(query)` paginado, `getReplacement(id)` individual |
| `tenant.service.ts` | `createTenant(payload)` |
| `branch.service.ts` | `createBranch(payload)` |

### Contexto y rutas del frontend

- `context/CountryContext.tsx` — país seleccionado globalmente (filtro de búsqueda)
- Rutas App Router:
  - `app/page.tsx` — página de auth (login/register/verify/reset)
  - `app/(main)/` — layout con Header; contiene `parts/[id]` (detalle público), `create`, `edit/[id]` y `dashboard/`
  - `app/(main)/dashboard/` — área protegida con `DashboardSidebar` (productos, pedidos, facturación, locales, usuarios, catálogos de admin, configuración)
- `middleware.ts` — verifica JWT con `jose`; aplica a `/dashboard/**` y `/edit/**` y redirige a `/`

### Deploy

No hay CI/CD: el deploy sincroniza por `rsync` el working directory local al VPS y
reconstruye ahí la imagen Docker del servicio que cambió. El servidor **no** usa
`git pull` — el rsync copia el directorio tal cual esté, con o sin commitear.

- Servidor: `root@2.25.65.69` (hostname `srv1975100`), SSH con key ya configurada.
- Todo vive en `/opt/piezify/<repo>/` — carpetas planas, no son repos git.
- `/opt/piezify/repuestito-deploy/` tiene el `docker-compose.yml` real, los `.env` del
  server y el secret de Sentry (no es un repo git tampoco).

**0. Detectar qué repo(s) cambiaron** — `git status --short` en `repuestito` (frontend)
y en `repuestito-api` (backend). Si el usuario no especifica, deployar el/los que
tengan commits nuevos desde el último deploy.

**1. Confirmar commit limpio (obligatorio)** — `git status --short` debe estar vacío
en cada repo a deployar. Si hay cambios sin commitear, parar y avisar.

**2. Sync al servidor**

Frontend:
```
rsync -az --delete \
  --exclude='.git' --exclude='node_modules' --exclude='.next' --exclude='out' \
  --exclude='coverage' --exclude='.env' --exclude='.env.*' --exclude='.DS_Store' \
  /Users/diegoquintero/repuestito/ root@2.25.65.69:/opt/piezify/repuestito/
```

Backend:
```
rsync -az --delete \
  --exclude='.git' --exclude='node_modules' --exclude='dist' \
  --exclude='.env' --exclude='.env.*' --exclude='.DS_Store' \
  /Users/diegoquintero/repuestito-api/ root@2.25.65.69:/opt/piezify/repuestito-api/
```

**3. Rebuild + restart en el servidor** (todo desde `/opt/piezify/repuestito-deploy`):
```
ssh root@2.25.65.69 "cd /opt/piezify/repuestito-deploy && docker compose build frontend && docker compose up -d frontend"
```
Cambiar `frontend` por `api` para el backend, o correr ambos si cambiaron los dos repos.

Servicios del compose: `postgres`, `api` (build `../repuestito-api`, expone
`127.0.0.1:3002->3000`) y `frontend` (build `../repuestito`, expone
`127.0.0.1:3001->3000`, con build args `NEXT_PUBLIC_API_URL`, `NEXT_PUBLIC_SENTRY_DSN`,
`NEXT_PUBLIC_SENTRY_ENVIRONMENT`, `SENTRY_ORG`, `SENTRY_PROJECT` y el secret
`sentry_auth_token`). nginx (fuera de Docker) rutea `app.piezify.com`: `/api/*` →
`127.0.0.1:3002`, todo lo demás → `127.0.0.1:3001`, HTTPS vía certbot.

**4. Smoke test**
```
ssh root@2.25.65.69 "docker ps --format 'table {{.Names}}\t{{.Status}}'"
curl -s -o /dev/null -w "%{http_code}\n" https://app.piezify.com/
curl -s -o /dev/null -w "%{http_code}\n" -L https://app.piezify.com/dashboard
```
Verificar que los 3 contenedores estén `Up`/`healthy`. Ajustar las rutas del `curl`
según lo que efectivamente cambió.

No hay rollback automatizado — si un deploy rompe algo, preguntar al usuario cómo
proceder en vez de asumir un comando.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
