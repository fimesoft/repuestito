# Reglas del proyecto

## Diseño y paleta de colores
- La paleta de colores del frontend está definida en `styles/theme.css` como variables CSS (`--color-primary`, etc.).
- Al escribir o modificar estilos, usar siempre las variables de `theme.css`. Prohibido hardcodear colores que ya existan como variable.
- Si se necesita un color nuevo, agregarlo primero en `theme.css` y luego consumirlo vía variable.

## Componentes UI
- Antes de escribir un `<input>`, `<button>` u otro elemento HTML crudo, revisar si existe un componente en `components/ui/` o `components/shared/` que cubra el caso.
- Solo crear HTML crudo si ningún componente existente sirve.

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

## 13. No usar Agent cuando Grep/Read basta
- Agent duplica todo el contexto en un subproceso. Solo usalo para busquedas amplias o tareas complejas.
- Para buscar una funcion o archivo especifico, usa Grep o Glob directo.

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
  ├─ /app          → LoginPage (AuthBlock: login/register/verify/reset)
  │
  ├─ / (main)      → Home: lista paginada de repuestos (Server Component)
  │    └─ Header + CountrySelect + Search + PageCount + PartCard + Paginator
  │
  └─ /dashboard/** → protegido por middleware.ts (verifica cookie `token` con jose)
                      redirige a /app si token inválido/ausente

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
  ├─ ReplacementCompatibilityModule  /api/compatibility   (junction Replacement ↔ Vehicle)
  ├─ TenantModule       POST /api/tenants                 (negocio con subdomain único)
  ├─ BranchModule       POST /api/branches                (sucursales de un Tenant)
  ├─ CountryModule      /api/countries                    (catálogo de países con código/moneda)
  ├─ UploadModule       POST /api/upload                  (Multer → Cloudinary)
  └─ CloudinaryModule   servicio interno de upload
```

### Modelo de datos (relaciones clave)

```
Country ──< Tenant ──< Branch
                │
               (storeId en Replacement — UUID directo, sin FK declarada aún)

Replacement >──< Vehicle   (vía ReplacementCompatibility, unique [replacementId, vehicleId])

User (SELLER) → sellerId en Replacement (UUID directo, sin FK declarada aún)

Replacement: id, name, brand, price, stock, country, latitude, longitude,
             codeOem, imageUrl, storeId, sellerId
Vehicle:     id, brand, model, year, country, engine, fuelType, transmission, bodyType
```

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
  - `app/(main)/` — layout con Header; página pública del marketplace
  - `app/app/` — página de auth (login/register)
  - `app/dashboard/` — área protegida (aún en construcción)
- `middleware.ts` — verifica JWT con `jose`; solo aplica a `/dashboard/**`
