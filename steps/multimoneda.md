# Conversión de moneda en el dashboard — Plan de trabajo

> Actualizado: 2026-09-24. Estado: implementado en frontend y backend; pendiente de verificación visual contra los ambientes desplegados.

---

## Objetivo

Permitir que el usuario cambie temporalmente la visualización de los importes del dashboard entre:

- La moneda local del tenant, obtenida desde `countries.currencyCode`.
- Dólares estadounidenses (`USD`), usando una cotización actual de [DolarApi](https://dolarapi.com/).

El cambio se activa al presionar la tarjeta o indicador donde actualmente aparece la moneda local, por ejemplo `ARS`. Al volver a presionarlo, los importes regresan a la moneda local.

Este feature **no modifica los valores almacenados**, no cambia precios de productos y no afecta pedidos ni facturas. Es únicamente una conversión visual de las métricas del dashboard.

## Implementado

### Backend (`repuestito-api`)

- Nuevo `ExchangeRateModule` con `GET /api/exchange-rate/usd` autenticado.
- El tenant y su país se resuelven desde el usuario autenticado.
- Argentina: promedio blue `(compra + venta) / 2`.
- Venezuela: promedio paralelo, con fallback a `(compra + venta) / 2`.
- Chile y Colombia: cotización USD `venta`.
- Perú y dashboard global GOD: `available: false`.
- Caché en memoria por país de 10 minutos y fallback stale de una hora.
- Timeout de 5 segundos mediante `AbortController`.
- Respuestas de proveedor en objeto o lista soportadas.
- 7 pruebas unitarias del servicio y build de NestJS exitoso.

### Frontend (`repuestito`)

- Nuevo `services/exchange-rate.service.ts`.
- Nuevo `lib/currency.ts` con conversión y formato compartidos.
- La insignia de moneda de “Capital invertido” ahora es un botón `LOCAL ⇄ USD`.
- Capital, valor potencial, margen y ventas usan la misma cotización.
- `SalesChart` convierte total, puntos y tooltip sin modificar los datos originales.
- Se muestra tasa, fuente, fecha y estado stale.
- Preferencia guardada en `sessionStorage`.
- Fallback silencioso a moneda local si la tasa no está disponible.
- Selector deshabilitado para usuarios sin tenant.
- ESLint y TypeScript sin errores.

### Verificación pendiente

- Probar visualmente el dashboard con un tenant AR y otro VE.
- Confirmar conectividad de producción hacia los subdominios de DolarApi.
- Verificar el responsive del texto de cotización en la tarjeta.
- El build de Next.js llegó a “Creating an optimized production build” sin reportar errores, pero quedó detenido en esa fase y se interrumpió; `tsc --noEmit` y lint sí finalizaron correctamente.

## Experiencia esperada

Estado inicial para un tenant de Argentina:

```text
[ ARS ⇄ USD ]

Capital invertido           ARS 897.000
Valor potencial de ventas  ARS 1.331.988
Margen de ganancias        ARS 234.988
Ventas                     ARS 8.116
```

Después de presionar la tarjeta de moneda:

```text
[ USD ⇄ ARS ]

Capital invertido           USD 578,71
Valor potencial de ventas  USD 859,35
Margen de ganancias        USD 151,60
Ventas                     USD 5,24
```

Debajo del selector se puede mostrar información secundaria:

```text
1 USD = ARS 1.550 · Promedio dólar blue · Actualizado 17:59
```

La moneda elegida puede persistirse en `sessionStorage` para conservarse durante la sesión, pero debe volver a la moneda local en una sesión nueva.

## Alcance

### Incluido

- Tarjeta/selector interactivo `moneda local ⇄ USD`.
- Consulta de la cotización según el país del tenant.
- Conversión de métricas monetarias del dashboard.
- Indicador de carga al solicitar la cotización.
- Fecha de actualización y fuente de la tasa.
- Caché temporal para no consultar DolarApi en cada render.
- Fallback a moneda local si DolarApi falla.
- Formateo correcto con `Intl.NumberFormat`.

### No incluido

- Cambios en la base de datos.
- Nuevas tablas o migrations.
- Guardar precios en distintas monedas.
- Convertir valores en productos, pedidos o facturas.
- Modificar PDFs o comprobantes.
- Registrar tipos de cambio históricos.
- Permitir elegir cualquier moneda; inicialmente solo moneda local y USD.

## Situación actual

- `countries` ya contiene `currencyCode`.
- El país del tenant está disponible mediante `tenantCountry`/`CountryContext`.
- `app/(main)/dashboard/page.tsx` formatea importes con `ARS` hardcodeado.
- `components/features/dashboard/SalesChart/SalesChart.tsx` también usa `ARS` hardcodeado.
- La tarjeta de capital muestra visualmente la moneda local, pero todavía no funciona como selector.
- Los valores del dashboard provienen expresados en la moneda local; esta propuesta no cambia ese contrato.

## DolarApi

### Respuesta de Argentina

Endpoint solicitado:

```http
GET https://dolarapi.com/v1/dolares/blue
```

Respuesta observada:

```json
{
  "moneda": "USD",
  "casa": "blue",
  "nombre": "Blue",
  "compra": 1540,
  "venta": 1560,
  "fechaActualizacion": "2026-09-23T20:59:00.000Z"
}
```

El endpoint de DolarApi no devuelve un campo `promedio` para el dólar blue de Argentina. El adaptador propio debe calcularlo con `compra` y `venta`:

```text
promedioBlue = (compra + venta) / 2
promedioBlue = (1.540 + 1.560) / 2 = 1.550
```

Para convertir importes guardados en pesos argentinos a USD se utilizará ese promedio:

```text
importeUSD = importeARS / promedioBlue
```

La cotización utilizada debe mostrarse al usuario para que la conversión sea transparente.

### Endpoints por país

Mapa inicial:

| País | Código | Moneda local | Endpoint | Tasa elegida |
|---|---|---|---|---|
| Argentina | AR | ARS | `https://dolarapi.com/v1/dolares/blue` | promedio calculado: `(compra + venta) / 2` |
| Chile | CL | CLP | `https://cl.dolarapi.com/v1/cotizaciones/usd` | `venta` |
| Venezuela | VE | VES | `https://ve.dolarapi.com/v1/dolares/paralelo` | `promedio`; fallback a `(compra + venta) / 2` |
| Colombia | CO | COP | `https://co.dolarapi.com/v1/cotizaciones/usd` | `venta` |
| Perú | PE | PEN | Sin endpoint regional directo documentado | no habilitar todavía |

La documentación pública actual de DolarApi incluye Argentina, Chile, Venezuela y Colombia, pero no presenta una región directa para Perú. Aunque la API de Colombia publica una cotización del sol peruano respecto del peso colombiano, no debe usarse como reemplazo de una tasa USD/PEN sin definir y validar una conversión cruzada.

**Decisión pendiente:** definir una fuente confiable para Perú. Hasta entonces, el selector permanece en `PEN` y muestra “Conversión a USD no disponible”.

### Cotización seleccionada para Venezuela

DolarApi ofrece cotización oficial y paralela:

- `/v1/dolares/oficial`
- `/v1/dolares/paralelo`

Para el dashboard de Piezify se utilizará la cotización **paralela**. El adaptador consumirá `/v1/dolares/paralelo` y priorizará el campo `promedio`. Si la respuesta no lo incluye pero contiene `compra` y `venta` válidos, calculará `(compra + venta) / 2`.

## Arquitectura recomendada

### Backend como adaptador

Agregar un endpoint propio y simple para evitar que cada navegador dependa directamente de DolarApi:

```http
GET /api/exchange-rate/usd
```

El backend obtiene el país desde el tenant del usuario autenticado, elige el endpoint correspondiente y devuelve una respuesta normalizada:

```json
{
  "fromCurrency": "ARS",
  "toCurrency": "USD",
  "rate": 1560,
  "source": "DolarApi - Promedio Blue",
  "updatedAt": "2026-09-23T20:59:00.000Z",
  "available": true
}
```

Para un país sin proveedor disponible:

```json
{
  "fromCurrency": "PEN",
  "toCurrency": "USD",
  "rate": null,
  "source": null,
  "updatedAt": null,
  "available": false
}
```

Ventajas del adaptador:

- Unifica respuestas diferentes entre países.
- Evita lógica de endpoints y campos dentro del frontend.
- Permite aplicar timeout y caché en un solo lugar.
- Facilita reemplazar DolarApi sin modificar el dashboard.
- El país se obtiene de la sesión, no desde un parámetro manipulable.

No requiere persistencia ni una tabla de cotizaciones.

### Caché

- Caché en memoria del backend por país.
- TTL inicial recomendado: 10 minutos.
- Clave: `exchange-rate:{countryCode}:USD`.
- Si la caché está vigente, no llamar nuevamente a DolarApi.
- Si DolarApi falla y existe una tasa anterior, se puede devolver como `stale: true` durante un período limitado.
- Si no existe ninguna tasa, responder `available: false` sin romper el dashboard.

### Timeout

- Timeout recomendado: 3 a 5 segundos.
- No hacer retries ilimitados.
- Un fallo de DolarApi nunca debe impedir cargar las métricas locales.

## Backend — trabajo propuesto

### Servicio

Crear un módulo pequeño, por ejemplo:

```text
src/exchange-rate/
  exchange-rate.module.ts
  exchange-rate.controller.ts
  exchange-rate.service.ts
  exchange-rate.types.ts
```

Responsabilidades de `ExchangeRateService`:

1. Obtener el país y moneda del tenant autenticado.
2. Resolver la configuración del proveedor por país.
3. Consultar DolarApi con timeout.
4. Normalizar `venta`, `promedio` o el campo correspondiente como `rate`.
5. Validar que `rate` sea numérico y mayor a cero.
6. Cachear la respuesta.
7. Devolver `available: false` en países no soportados.

Configuración sugerida:

```ts
const DOLAR_API_BY_COUNTRY = {
  AR: {
    currency: 'ARS',
    url: 'https://dolarapi.com/v1/dolares/blue',
    source: 'DolarApi - Promedio Blue',
    getRate: (data) => (data.compra + data.venta) / 2,
  },
  CL: {
    currency: 'CLP',
    url: 'https://cl.dolarapi.com/v1/cotizaciones/usd',
    source: 'DolarApi - USD',
    getRate: (data) => data.venta,
  },
  VE: {
    currency: 'VES',
    url: 'https://ve.dolarapi.com/v1/dolares/paralelo',
    source: 'DolarApi - Promedio Paralelo',
    getRate: (data) => data.promedio ?? ((data.compra + data.venta) / 2),
  },
  CO: {
    currency: 'COP',
    url: 'https://co.dolarapi.com/v1/cotizaciones/usd',
    source: 'DolarApi - USD',
    getRate: (data) => data.venta,
  },
} as const;
```

### Endpoint

```http
GET /api/exchange-rate/usd
```

- Requiere `JwtAuthGuard`.
- No necesita restricción por rol: cualquier usuario del tenant puede cambiar la visualización.
- El tenant y su país se resuelven desde el usuario autenticado.
- El endpoint no acepta una URL externa ni el país por body/query.
- Debe documentarse en Swagger.

### Errores

El dashboard no necesita recibir un error técnico de DolarApi. El contrato puede devolver HTTP `200` con `available: false` para una tasa no soportada o temporalmente no disponible.

Los errores internos deben registrarse en Sentry/logs sin exponer detalles del proveedor al usuario.

## Frontend — trabajo propuesto

### Servicio

Crear:

```text
services/exchange-rate.service.ts
```

Contrato:

```ts
interface ExchangeRate {
  fromCurrency: string;
  toCurrency: 'USD';
  rate: number | null;
  source: string | null;
  updatedAt: string | null;
  available: boolean;
  stale?: boolean;
}

getUsdExchangeRate(): Promise<ExchangeRate>
```

### Estado del dashboard

Estado mínimo:

```ts
type DisplayCurrency = 'LOCAL' | 'USD';

const [displayCurrency, setDisplayCurrency] = useState<DisplayCurrency>('LOCAL');
const [exchangeRate, setExchangeRate] = useState<ExchangeRate | null>(null);
const [currencyLoading, setCurrencyLoading] = useState(false);
const [currencyError, setCurrencyError] = useState<string | null>(null);
```

Comportamiento del click:

1. Si está en USD, volver inmediatamente a moneda local.
2. Si está en moneda local y ya existe una tasa válida, cambiar a USD.
3. Si no hay tasa cargada, consultar `/api/exchange-rate/usd`.
4. Mientras carga, mantener visibles los importes locales y mostrar loading solo en el selector.
5. Si la tasa no está disponible, conservar la moneda local y mostrar un mensaje breve.

### Funciones compartidas

```ts
function convertLocalToUsd(value: number, rate: number): number {
  return value / rate;
}

function formatMoney(value: number, currency: string): string {
  return new Intl.NumberFormat('es', {
    style: 'currency',
    currency,
    maximumFractionDigits: currency === 'USD' ? 2 : 0,
  }).format(value);
}
```

Centralizar estas funciones para que `dashboard/page.tsx` y `SalesChart` utilicen exactamente la misma conversión y formato.

### Métricas que deben cambiar

- Capital invertido.
- Valor potencial de ventas.
- Margen de ganancias.
- Total de ventas del período.
- Valores monetarios del gráfico de ventas, incluidos eje, tooltip y resumen.

No deben cambiar:

- Cantidad de artículos.
- Cantidad de productos.
- Cantidad de pedidos.
- Cantidad de usuarios.
- Porcentajes.
- Stocks.

### Selector de moneda

La tarjeta o badge que hoy muestra `ARS`, `COP`, `CLP`, `VES` o `PEN` pasa a ser un botón accesible:

```text
ARS  ⇄  USD
```

Requisitos:

- Usar `<button type="button">`, no un `div` con `onClick`.
- `aria-label="Mostrar importes en dólares"` cuando está en moneda local.
- `aria-label="Mostrar importes en pesos argentinos"` cuando está en USD.
- Estado de carga visible y botón temporalmente deshabilitado.
- Mostrar la moneda activa con mayor énfasis.
- Tooltip o texto auxiliar con tasa, fuente y actualización.
- No depender únicamente del símbolo `$`; siempre mostrar `ARS`, `USD`, etc.

## Persistencia de preferencia

Para mantener el alcance sencillo:

- Guardar `LOCAL` o `USD` en `sessionStorage`.
- No agregar columnas a `users` ni `tenant_config`.
- La preferencia aplica solo al navegador y sesión actual.
- Si al restaurar `USD` la tasa falla, volver automáticamente a `LOCAL`.

Clave sugerida:

```text
piezify-dashboard-currency
```

## Manejo de errores

| Situación | Comportamiento |
|---|---|
| DolarApi responde correctamente | Convertir y mostrar USD |
| País no soportado | Mantener moneda local y avisar “Conversión a USD no disponible” |
| Timeout o error de red | Mantener moneda local; permitir reintentar |
| Tasa igual a cero, negativa o inválida | Rechazar la respuesta y mantener moneda local |
| Respuesta cacheada vencida pero utilizable | Mostrar USD con indicador “Cotización anterior” |
| Métrica `null` | Mantener su empty state; no convertirla a cero |

El dashboard debe seguir cargando normalmente aunque falle el proveedor externo.

## Pruebas

### Backend

- AR selecciona `/v1/dolares/blue` y calcula `(compra + venta) / 2`.
- CL selecciona `/v1/cotizaciones/usd`.
- VE selecciona `/v1/dolares/paralelo` y usa `promedio`, con fallback a `(compra + venta) / 2`.
- CO selecciona `/v1/cotizaciones/usd`.
- PE devuelve `available: false`.
- Rechaza tasa cero, negativa o no numérica.
- Respeta el TTL de caché.
- Timeout no rompe el endpoint ni expone el error del proveedor.
- El país se obtiene del tenant autenticado.

### Frontend

- Click en `ARS` consulta la tasa y cambia métricas a USD.
- Segundo click vuelve a ARS sin nueva consulta.
- El gráfico y las tarjetas usan la misma tasa.
- Las cantidades y porcentajes no se modifican.
- Loading afecta solo el selector.
- Un error conserva todos los importes locales.
- La preferencia de sesión se restaura correctamente.
- El botón funciona con teclado y lector de pantalla.

### Ejemplo verificable

Con:

```text
capitalInvertido = ARS 897.000
compra = 1.540 ARS por USD
venta = 1.560 ARS por USD
promedio = 1.550 ARS por USD
```

El resultado esperado es:

```text
897.000 / 1.550 = USD 578,71
```

## Fases de implementación

## Relevamiento técnico del proyecto

### Frontend actual

| Archivo | Estado relevante | Cambio previsto |
|---|---|---|
| `app/(main)/dashboard/page.tsx` | `formatCurrency()` usa `es-AR` y `ARS` fijos; la tarjeta de capital muestra `ARS` en un `<span>` | Recibir moneda local, administrar `LOCAL \| USD`, convertir la etiqueta de moneda en botón y aplicar conversión a las tres tarjetas monetarias |
| `components/features/dashboard/SalesChart/SalesChart.tsx` | Tiene su propio `formatCurrency()` con `ARS` fijo y carga la serie internamente | Recibir `currencyCode` y `exchangeRate` por props; convertir total, puntos y tooltip con la misma tasa del dashboard |
| `services/stats.service.ts` | Entrega valores numéricos sin información de moneda | Mantener contrato; la moneda se resuelve mediante el nuevo servicio de cotización |
| `context/CountryContext.tsx` | Expone el código alpha-2 del país, con default `AR` | Sirve para presentación, pero la tasa autoritativa debe resolverse desde el tenant autenticado en backend |
| `context/AuthUserContext.tsx` | Para usuarios no-GOD sincroniza `CountryContext` con `tenantCountry` | No requiere cambios para v1 |
| `app/(main)/dashboard/page.module.css` | `inventoryIcon` es actualmente solo visual | Agregar estados interactivo, loading, activo y no disponible |

### Backend actual

| Archivo | Estado relevante | Cambio previsto |
|---|---|---|
| `src/stats/stats.controller.ts` | Obtiene `tenantId` y `branchId` desde el usuario autenticado | Sin cambio para usuarios de tenant |
| `src/stats/stats.service.ts` | Devuelve sumas en la moneda en que están guardados los productos y facturas | No convertir aquí; conservar datos locales originales |
| `src/auth/auth.controller.ts` | `/auth/me` ya devuelve `tenantCountry` | No requiere cambios |
| `src/country/country.entity.ts` | `countries` contiene `currencyCode` | Usarlo para validar la moneda local del tenant |
| `src/tenant/tenant.entity.ts` | El tenant contiene `country` | El nuevo servicio resuelve país desde el tenant, no desde el cliente |
| `src/app.module.ts` | Registra los módulos de Nest | Registrar `ExchangeRateModule` |

### Hallazgo: dashboard de usuarios GOD

Cuando `tenantId` es `null`, `StatsService` agrega productos, pedidos y facturas de todos los tenants. Esos valores pueden pertenecer a ARS, COP, CLP, VES y PEN, por lo que actualmente no representan una única moneda convertible.

Para v1:

- Habilitar el selector de conversión únicamente cuando el usuario tenga `tenantId`.
- En el dashboard global de `GOD`, mantener las métricas sin conversión y no presentar una moneda única como si todos los importes fueran equivalentes.
- Tratar el filtrado/consolidación multimoneda del dashboard global como un feature separado.

No usar el país elegido visualmente en `CountryContext` para convertir una suma global: produciría resultados incorrectos.

## Plan ejecutable por archivo

### Backend — archivos nuevos

```text
repuestito-api/src/exchange-rate/
  exchange-rate.module.ts
  exchange-rate.controller.ts
  exchange-rate.service.ts
  exchange-rate.types.ts
  exchange-rate.service.spec.ts
```

#### `exchange-rate.types.ts`

- `SupportedExchangeCountry = 'AR' | 'CL' | 'VE' | 'CO'`.
- `ExchangeRateResponse` con `fromCurrency`, `toCurrency`, `rate`, `source`, `updatedAt`, `available` y `stale`.
- Tipos mínimos para las respuestas externas; no usar `any`.

#### `exchange-rate.service.ts`

- Inyectar `DataSource` para resolver `tenant.country` y `countries.currencyCode`.
- Mantener un `Map` privado con `{ value, expiresAt }` por país.
- TTL de 10 minutos.
- Usar `fetch` nativo de Node/Nest; el proyecto no tiene `HttpModule` ni Axios instalados.
- Implementar timeout con `AbortController`.
- Validar `Number.isFinite(rate) && rate > 0`.
- AR: promedio `(compra + venta) / 2`.
- VE: endpoint paralelo, priorizar `promedio` y usar `(compra + venta) / 2` como fallback.
- CL/CO: usar `venta`.
- PE: devolver `available: false` sin llamar a un proveedor.
- Nunca lanzar un error de proveedor hacia el dashboard si puede devolverse `available: false` o una tasa stale.

#### `exchange-rate.controller.ts`

```http
GET /api/exchange-rate/usd
```

- `JwtAuthGuard`.
- `requireTenantUnlessGod(user)`.
- Para v1, si `user.tenantId` es `null`, devolver `available: false` porque el dashboard GOD agrega monedas distintas.
- Documentar respuesta en Swagger.

#### `exchange-rate.module.ts`

- Declarar controller y service.
- Registrar en `src/app.module.ts`.
- No necesita entity, repository ni migration.

### Frontend — archivos nuevos

```text
services/exchange-rate.service.ts
lib/currency.ts
```

#### `services/exchange-rate.service.ts`

- Definir el contrato normalizado.
- Implementar `getUsdExchangeRate()` con `credentials: 'include'` y `cache: 'no-store'`.
- Traducir respuestas no exitosas a un mensaje genérico.

#### `lib/currency.ts`

- `convertLocalToUsd(value, rate)`.
- `formatMoney(value, currencyCode)`.
- Rechazar tasas inválidas.
- Mantener esta utilidad pura y testeable.

### Frontend — archivos a modificar

#### `app/(main)/dashboard/page.tsx`

- Leer `currentUser` desde `useAuthUser()` para saber si existe `tenantId`.
- Leer `country` desde `useCountry()` para la etiqueta local.
- Resolver el código de moneda local con un mapa pequeño inicial:

```ts
const LOCAL_CURRENCY_BY_COUNTRY = {
  AR: 'ARS',
  CL: 'CLP',
  VE: 'VES',
  CO: 'COP',
  PE: 'PEN',
} as const;
```

- Estado `displayCurrency`, `exchangeRate`, `currencyLoading` y `currencyError`.
- Extraer `displayAmount(value)` para aplicar una única conversión.
- Convertir el `inventoryIcon` actual en botón.
- Aplicar conversión a capital, valor potencial y monto de margen.
- Pasar moneda/tasa a `SalesChart`.
- Mantener `HIDDEN_AMOUNT` independiente de la moneda.
- No convertir cantidades, porcentajes ni stocks.

> Mejora posterior: evitar el mapa frontend haciendo que `/auth/me` o el endpoint de cotización devuelva siempre `fromCurrency`. Para el primer render puede mostrarse el código del país hasta cargar la respuesta, o derivarse del mapa anterior.

#### `components/features/dashboard/SalesChart/SalesChart.tsx`

Agregar props:

```ts
interface SalesChartProps {
  className?: string;
  currencyCode: string;
  exchangeRate?: number;
}
```

- La serie original continúa intacta.
- Crear `displayData` con totales convertidos solamente para renderizar.
- Aplicar `formatMoney` al total y tooltip.
- No disparar su propia consulta de cotización.

#### Estilos

Modificar:

```text
app/(main)/dashboard/page.module.css
```

- La moneda debe parecer interactiva sin aumentar demasiado la tarjeta.
- Estados `:hover`, `:focus-visible`, loading y disabled.
- Texto auxiliar para tasa/fuente sin romper el grid.
- Mantener objetivo táctil de al menos 44 px en móvil.

## Orden recomendado de ejecución

1. Implementar y probar `ExchangeRateService` en backend.
2. Exponer y probar `GET /api/exchange-rate/usd` con usuarios AR, VE y PE.
3. Crear `lib/currency.ts` y sus pruebas.
4. Crear el servicio frontend.
5. Implementar el toggle solo en tarjetas.
6. Extender `SalesChart` con props de moneda.
7. Agregar `sessionStorage` y estados de error.
8. Verificar responsive y accesibilidad.

---

### Fase 1 — Adaptador de DolarApi

- Crear `ExchangeRateModule` en el backend.
- Implementar mapa de endpoints AR, CL, VE y CO.
- Agregar timeout, validación y caché.
- Exponer `GET /api/exchange-rate/usd`.
- Documentar el endpoint.

### Fase 2 — Selector y conversión

- Crear el servicio del frontend.
- Convertir el indicador actual de moneda en botón.
- Agregar estado `LOCAL | USD`.
- Centralizar formato y conversión.
- Aplicarlo a las tarjetas monetarias.

### Fase 3 — Gráfico y resiliencia

- Aplicar moneda seleccionada a `SalesChart`.
- Agregar fecha, fuente y estado stale.
- Persistir preferencia en `sessionStorage`.
- Cubrir empty states, errores y accesibilidad.

## Criterios de aceptación

- El dashboard inicia mostrando la moneda local del tenant.
- Al presionar la tarjeta de moneda, los valores monetarios cambian a USD.
- Al volver a presionarla, regresan a la moneda local.
- La conversión utiliza la cotización configurada para el país del tenant.
- La tasa utilizada y su actualización son visibles.
- Ningún valor almacenado se modifica.
- Pedidos, facturas y productos permanecen fuera del alcance.
- La caída de DolarApi no rompe el dashboard.
- Argentina, Chile, Venezuela y Colombia tienen proveedor configurado.
- Perú permanece en moneda local hasta definir una fuente directa.

## Decisiones pendientes antes de implementar

1. Perú: qué proveedor directo utilizar para USD/PEN.
2. Confirmar si la preferencia dura solo la sesión o debe persistir entre sesiones.
