# Telemetría con Sentry

## Objetivo

Incorporar observabilidad técnica en `repuestito` y `repuestito-api` para poder:

- detectar errores de frontend y backend antes de que sean reportados por usuarios;
- consultar stack traces legibles mediante source maps;
- medir latencia de navegación, requests HTTP y operaciones críticas;
- relacionar una petición del navegador con su procesamiento en la API;
- conocer versión, entorno, tenant y rol afectados sin enviar datos sensibles;
- recibir alertas accionables sin agotar innecesariamente el plan gratuito.

Sentry será telemetría operativa, no auditoría de negocio. No reemplaza
`audit_event`, logs legales ni métricas financieras.

## Alcance inicial

### Frontend Next.js

- excepciones no controladas en cliente, servidor y runtime edge;
- errores de renderizado del App Router;
- performance de navegaciones y requests hacia la API;
- releases y source maps de producción;
- contexto técnico del usuario autenticado;
- Session Replay únicamente para sesiones con error durante la primera etapa.

### Backend NestJS

- excepciones HTTP 5xx y errores no controlados;
- tracing de controladores, servicios, HTTP y base de datos soportados por el SDK;
- correlación con las trazas iniciadas en el frontend;
- spans manuales para operaciones críticas de pedidos, facturación, stock y carga
  masiva;
- release, entorno, tenant y request ID.

### Fuera del alcance inicial

- analítica de producto, funnels y experimentos;
- captura completa de cuerpos HTTP;
- grabación del 100% de las sesiones;
- profiling continuo;
- métricas de infraestructura del host o de PostgreSQL;
- reemplazar los mensajes de error visibles para el usuario.

## Restricciones de privacidad

La aplicación procesa datos de compradores y opera con múltiples tenants. Por
eso la integración debe aplicar estas reglas desde el primer commit:

- `sendDefaultPii: false` en frontend y backend;
- no enviar cookies, JWT, códigos de verificación, reset tokens ni headers de
  autorización;
- no adjuntar request/response bodies completos;
- no enviar nombre, documento, teléfono, domicilio ni notas del comprador;
- identificar al usuario con su UUID interno, nunca con su email como dato
  principal;
- usar `tenantId`, `branchId` y `role` sólo como tags de bajo volumen;
- no enviar IDs de repuestos, pedidos o facturas como tags de alta cardinalidad;
  esos valores pueden ir como contexto del evento cuando sean necesarios;
- en Replay, enmascarar texto e inputs por defecto y bloquear selectores que
  contengan información comercial o personal;
- implementar `beforeSend` y `beforeSendTransaction` para sanitizar URLs,
  headers y datos adicionales antes de transmitirlos.

## Security gate previo a producción

La instrumentación no debe ampliar ni ocultar los riesgos documentados en
[`security-review-backend.md`](./security-review-backend.md). Antes de habilitar
Sentry en producción se deben cerrar, o bloquear explícitamente mediante una
decisión de release, los hallazgos de aislamiento entre tenants, registro
público, jerarquía de roles y métricas globales.

- [ ] Derivar `tenantId`, `branchId` y `role` del scope de Sentry exclusivamente
  del usuario autenticado y verificado en `req.user`; nunca de query params,
  body, headers personalizados ni valores enviados por el frontend.
- [ ] Agregar el contexto de usuario sólo después de ejecutar autenticación y
  autorización. El contexto enviado desde Next.js es diagnóstico y nunca puede
  participar en decisiones de acceso del backend.
- [ ] Aislar y limpiar el scope por request para impedir que una petición del
  tenant A herede usuario o tags del tenant B, incluso con requests concurrentes
  o procesos asíncronos.
- [ ] No habilitar spans de pedidos, facturas, clientes o estadísticas hasta que
  sus consultas y mutaciones estén correctamente filtradas por tenant.
- [ ] No registrar parámetros de consultas SQL ni valores enlazados. Sanitizar
  también query strings, breadcrumbs de navegación, `fetch`/XHR y logs de
  consola, porque pueden contener email, documento, tokens o búsquedas libres.
- [ ] Excluir inicialmente de Session Replay las rutas de autenticación,
  administración de usuarios y pantallas con datos personales o financieros,
  además de aplicar enmascarado global.
- [ ] Configurar en Sentry reglas de scrubbing del lado del servidor y descarte
  de IP como segunda barrera, sin depender únicamente de `beforeSend`.
- [ ] Restringir el acceso a la organización y proyectos por mínimo privilegio,
  exigir MFA a sus miembros y no exponer Sentry directamente a usuarios de los
  tenants.
- [ ] Crear el token de source maps con los permisos mínimos necesarios,
  documentar su rotación y revocarlo inmediatamente ante una filtración.
- [ ] Configurar dominios/orígenes permitidos, filtros de entrada y límites de
  abuso: el DSN del navegador es público y no debe considerarse un secreto.
- [ ] Si existe una CSP, agregar a `connect-src` únicamente los endpoints exactos
  de ingestión utilizados; no autorizar comodines para Sentry.
- [ ] Definir región, retención, responsables de acceso y proceso de borrado de
  datos de telemetría según la política de privacidad aplicable.

**Criterio de salida:** ningún dato de autorización proviene del cliente, los
scopes se mantienen aislados entre requests y los hallazgos de seguridad que
afectan las rutas instrumentadas no permanecen abiertos al habilitar producción.

## Estrategia de proyectos y entornos

Crear una organización de Sentry y dos proyectos separados:

| Proyecto | Plataforma | Servicio |
|---|---|---|
| `repuestito-web` | Next.js | frontend, server components y edge |
| `repuestito-api` | Node.js / NestJS | API y procesos asíncronos |

Separar los datos mediante `environment`:

- `development`: deshabilitado por defecto;
- `staging`: habilitado con muestreo alto para validar;
- `production`: habilitado con muestreo conservador.

No crear proyectos distintos por tenant. El tenant es contexto de un evento,
no una unidad de despliegue.

## Variables de entorno

### Frontend

```dotenv
NEXT_PUBLIC_SENTRY_DSN=
SENTRY_AUTH_TOKEN=
SENTRY_ORG=
SENTRY_PROJECT=repuestito-web
SENTRY_ENVIRONMENT=production
SENTRY_RELEASE=
NEXT_PUBLIC_API_URL=
```

`NEXT_PUBLIC_SENTRY_DSN` puede estar disponible en el navegador. El token de
autenticación es secreto y sólo se usa durante el build para subir source maps.
Nunca debe llevar el prefijo `NEXT_PUBLIC_`.

### Backend

```dotenv
SENTRY_DSN=
SENTRY_ENVIRONMENT=production
SENTRY_RELEASE=
SENTRY_TRACES_SAMPLE_RATE=0.10
```

Agregar las variables sin valores reales a `.env.example`. Los secretos se
configuran en el proveedor de despliegue y no se guardan en Git.

## Muestreo inicial

Configuración de partida para proteger rendimiento y cuota:

| Señal | Staging | Producción |
|---|---:|---:|
| Errores | 100% | 100% |
| Trazas frontend | 100% | 10% |
| Trazas backend | 100% | 10% |
| Replay de sesión normal | 0% | 0% |
| Replay asociado a error | 100% | 5% |

Antes de producción se debe ajustar `tracesSampler` para conservar siempre
operaciones críticas o lentas y descartar ruido:

- conservar confirmación/cancelación de pedidos y creación/cancelación de
  facturas;
- conservar errores y requests que superen el umbral de latencia acordado;
- reducir health checks, assets, polling y rutas internas de Next.js;
- no aplicar muestreo independiente en cada servicio cuando exista una decisión
  de muestreo propagada desde el padre.

El plan gratuito actual incluye 5.000 errores, 5 millones de spans, 5 GB de
logs, 50 replays y un monitor de uptime. Revisar la cuota real antes de modificar
estos porcentajes: <https://sentry.io/pricing/>.

## Fase 1 — Preparar Sentry

- [ ] Crear organización, equipo y proyectos `repuestito-web` y
  `repuestito-api`.
- [ ] Exigir MFA y asignar acceso por mínimo privilegio a organización, equipos
  y proyectos.
- [ ] Registrar DSN y credenciales exclusivamente en los secretos del entorno.
- [ ] Configurar alertas de cuota al 50%, 80% y 100%.
- [ ] Definir `staging` y `production` como entornos visibles.
- [ ] Configurar retención de IP para no almacenar direcciones cuando la
  política de Sentry lo permita.
- [ ] Documentar responsable de alertas y canal inicial de notificación.

**Criterio de salida:** ambos proyectos existen, no hay secretos en Git y una
persona responsable puede acceder a Issues y Performance.

## Fase 2 — Instrumentar Next.js

- [x] Instalar `@sentry/nextjs` con una versión fija compatible con Next.js 16.
- [ ] Ejecutar el wizard oficial sobre una rama limpia y revisar manualmente
  cada archivo generado:

  ```bash
  npx @sentry/wizard@latest -i nextjs
  ```

- [x] Configurar inicialización de cliente en `instrumentation-client.ts`.
- [x] Configurar servidor y edge mediante `instrumentation.ts` y los archivos
  generados por la versión actual del SDK.
- [x] Incorporar `app/global-error.tsx` sin reemplazar el diseño de error de la
  aplicación.
- [x] Envolver `next.config.ts` con `withSentryConfig`. En la versión instalada,
  la opción vigente es `sourcemaps.deleteSourcemapsAfterUpload: true`; reemplaza
  al antiguo `hideSourceMaps` y elimina los mapas luego de subirlos.
- [x] Activar Replay sólo con enmascarado estricto y grabación al producirse un
  error. Usar `replaysSessionSampleRate: 0` y
  `replaysOnErrorSampleRate: 0.05` en producción para proteger la cuota de 50
  replays; staging puede conservar `replaysOnErrorSampleRate: 1.0` durante la
  validación.
- [x] Propagar trazas únicamente hacia el dominio real de la API mediante
  `tracePropagationTargets`; no usar un patrón global.
- [x] Asociar el usuario después de cargar la sesión:

  ```ts
  Sentry.setUser({ id: currentUser.id });
  Sentry.setTag('tenant.id', currentUser.tenantId ?? 'none');
  Sentry.setTag('user.role', currentUser.role);
  ```

- [x] Limpiar el scope al cerrar sesión con `Sentry.setUser(null)`.
- [ ] Definir un evento de prueba controlado sólo para staging.

Guía oficial: <https://docs.sentry.io/platforms/javascript/guides/nextjs/>.

**Criterio de salida:** un error de cliente, uno de Server Component y uno de
Route Handler aparecen en staging con release y stack trace original.

## Fase 3 — Instrumentar NestJS

- [ ] Instalar `@sentry/nestjs` en `repuestito-api`.
- [ ] Crear `src/instrument.ts` e inicializar Sentry antes de importar módulos
  de Nest o de base de datos.
- [ ] Importar el archivo de instrumentación como primera importación del punto
  de entrada.
- [ ] Registrar el manejador de errores de Nest recomendado por la versión
  instalada del SDK.
- [ ] Configurar DSN, environment, release y muestreo desde variables de
  entorno.
- [ ] Agregar `requestId`, `tenantId`, `branchId`, rol y ruta normalizada al
  scope aislado de cada petición mediante interceptor o middleware. Obtener los
  datos de identidad sólo de `req.user`, después de los guards, y limpiar el
  scope al finalizar.
- [ ] Capturar sólo errores inesperados. El filtro global de excepciones debe
  omitir explícitamente todos los `HttpException` con status `400–499`,
  incluyendo 400, 401, 403, 404 y errores de validación esperados, para no
  saturar la cuota de 5.000 errores. Agregar tests que comprueben que un 4xx no
  llega a Sentry y que un 5xx sí se captura.
- [ ] Confirmar auto-instrumentación de HTTP y TypeORM/PostgreSQL; no asumir que
  una query está instrumentada sin comprobar una traza real. Deshabilitar la
  captura de parámetros SQL o sanitizarlos antes de enviarlos.
- [ ] Incluir explícitamente `sentry-trace` y `baggage` en la lista blanca de
  `allowedHeaders` de CORS de la API, junto con los headers actuales, y aceptar
  esos headers sólo desde los orígenes autorizados del frontend.
- [ ] Verificar que procesos asíncronos y bulk uploads hagan `flush` antes de
  finalizar cuando corresponda.

Guía oficial: <https://docs.sentry.io/platforms/javascript/guides/nestjs/>.

**Criterio de salida:** una petición iniciada en el navegador produce una traza
que contiene frontend, API y acceso a datos, y un error 500 llega una sola vez.

## Fase 4 — Instrumentación de negocio

Agregar spans manuales únicamente donde ayuden a localizar problemas de
rendimiento. Usar nombres estables y atributos acotados:

| Operación | Span sugerido | Atributos permitidos |
|---|---|---|
| Crear pedido | `order.create` | tenant, cantidad de ítems, resultado |
| Confirmar y facturar | `order.confirm_and_fulfill` | tenant, resultado |
| Cancelar pedido | `order.cancel` | tenant, resultado |
| Crear factura | `invoice.create` | tenant, cantidad de ítems, resultado |
| Carga masiva | `replacement.bulk_upload` | tenant, cantidad de filas, resultado |
| Buscar repuestos | `replacement.search` | tenant, cantidad de resultados; no término libre |

No usar número de pedido, factura, usuario o repuesto en el nombre del span. La
cardinalidad variable dificulta agrupar resultados y consume cuota.

- [ ] Instrumentar una operación por vez.
- [ ] Comparar latencia antes y después de instrumentar.
- [ ] Eliminar spans que no conduzcan a una decisión o alerta.
- [ ] Mantener auditoría y Sentry desacoplados: un fallo de Sentry nunca revierte
  una transacción de negocio.

## Fase 5 — Releases y source maps

- [ ] Definir el mismo identificador de release en frontend y backend usando el
  SHA completo del commit.
- [ ] Subir source maps durante CI, nunca en runtime.
- [ ] Inyectar `SENTRY_AUTH_TOKEN` exclusivamente como Build Secret del pipeline
  o mediante Docker BuildKit (`--mount=type=secret`). No declararlo con `ARG` o
  `ENV`, no copiar archivos que lo contengan y comprobar que no permanezca en
  las capas, historial ni variables de la imagen final de producción.
- [ ] Eliminar `SENTRY_AUTH_TOKEN` del entorno disponible para la aplicación
  una vez terminado el build.
- [ ] Asociar commits al release cuando el proveedor de Git esté conectado.
- [ ] Marcar deploys de staging y producción.
- [ ] Hacer fallar el pipeline si la subida de source maps falla en producción,
  salvo una decisión explícita documentada.

## Fase 6 — Alertas y tableros

Alertas iniciales, con umbrales conservadores:

- [ ] nuevo error en producción;
- [ ] regresión de una Issue resuelta;
- [ ] incremento sostenido de errores 5xx;
- [ ] p95 de confirmación/facturación por encima del objetivo acordado;
- [ ] caída del endpoint público de salud mediante el monitor de uptime incluido;
- [ ] consumo de cuota al 50%, 80% y 100%.

No enviar todas las Issues a todos los usuarios. Empezar con email a una persona
responsable y ampliar canales sólo cuando el proceso de atención esté definido.

## Validación

Realizar estas pruebas en staging antes de habilitar producción:

1. Error controlado en un Client Component.
2. Error controlado en un Server Component o Route Handler.
3. Excepción 500 controlada en NestJS.
4. Request frontend → API con una única traza distribuida.
5. Stack trace de frontend y backend resuelto contra el código TypeScript.
6. Evento con usuario, tenant, branch, role, environment y release esperados.
7. Evento inspeccionado sin JWT, cookies, email, documento, teléfono ni body.
8. Replay asociado a error con inputs y texto sensible enmascarados.
9. Verificación de que un fallo de red hacia Sentry no afecta la respuesta de la
   aplicación.
10. Revisión del volumen generado durante 24 horas y ajuste del muestreo.
11. Request con `tenantId`, `branchId` o `role` falsificados en query/body sin
    alterar los tags derivados de `req.user`.
12. Requests consecutivos y concurrentes de dos tenants sin fuga de usuario,
    tags, breadcrumbs ni contexto entre sus eventos.
13. URLs, breadcrumbs, parámetros SQL y logs inspeccionados sin secretos ni PII.
14. Rutas de autenticación, usuarios y datos personales excluidas de Replay.
15. Source maps no accesibles públicamente y `SENTRY_AUTH_TOKEN` ausente de la
    imagen, sus capas y el entorno de runtime.

## Despliegue gradual

1. Instrumentar únicamente staging.
2. Validar privacidad, source maps y correlación.
3. Habilitar producción con errores al 100%, trazas al 10%, Replay normal al 0%
   y Replay asociado a errores al 5%.
4. Observar cuota y ruido durante siete días.
5. Afinar filtros y alertas antes de agregar spans de negocio adicionales.

## Definición de terminado

- frontend y backend reportan bajo proyectos separados;
- errores tienen stack trace original, environment y release;
- las trazas atraviesan navegador y API cuando corresponde;
- no se detecta PII ni secretos en una muestra manual de eventos y replays;
- existe al menos una alerta comprobada de error y otra de cuota;
- el overhead se mide con datos reales y queda dentro del presupuesto acordado;
- el README operativo explica cómo deshabilitar Sentry y cómo rotar tokens;
- las cuotas se revisan antes de aumentar muestreo o habilitar nuevas señales.

## Referencias

- Sentry para Next.js: <https://docs.sentry.io/platforms/javascript/guides/nextjs/>
- Sentry para NestJS: <https://docs.sentry.io/platforms/javascript/guides/nestjs/>
- Precios y cuotas: <https://sentry.io/pricing/>
- Propagación de trazas y CORS:
  <https://docs.sentry.io/platforms/javascript/guides/nextjs/tracing/trace-propagation/dealing-with-cors-issues/>
