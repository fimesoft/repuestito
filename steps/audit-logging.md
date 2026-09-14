# Auditoría de actividad

## Objetivo

Conservar una traza inmutable y consultable de las acciones de negocio que
modifican el sistema. La auditoría debe responder, sin depender de logs de
infraestructura:

- quién ejecutó una acción;
- cuándo y desde qué petición o proceso asíncrono;
- sobre qué usuario, repuesto, catálogo, tenant o sucursal;
- qué resultado tuvo;
- qué valores cambiaron, sin guardar secretos.

La fuente de verdad es el backend NestJS. El frontend nunca escribe eventos de
auditoría directamente.

## Alcance inicial

### Usuarios y autenticación

| Evento | Momento | Datos auditados |
|---|---|---|
| `user.registered` | se persiste el usuario en `AuthService.register` | id, email normalizado, rol asignado, tenantId, branchId, origen `public_register` |
| `user.email_verified` | finaliza `verifyEmail` | userId, email |
| `user.invited` | se crea una invitación | actor, nuevo userId, rol, tenantId, branchId |
| `user.password_reset` | finaliza `resetPassword` | userId; nunca contraseña, token ni código |
| `auth.login_succeeded` / `auth.login_failed` | resultado de `login` | userId cuando exista, email enmascarado, motivo seguro de fallo |
| `auth.logout` | se invalida/cierra sesión | actor y sesión/correlación |

El evento `user.registered` debe contener los datos administrativos del usuario
creado, pero excluir siempre `password`, hashes, `verificationCode`,
`resetToken`, JWT, cookies y códigos enviados por email.

### Repuestos creados individualmente

`POST /api/replacements` hoy crea un `global_replacement` y un `replacement`
local dentro de una transacción. Al confirmarla deben existir estos eventos:

| Evento | Cuándo se emite | Subject |
|---|---|---|
| `catalog.replacement_created` | se crea un `global_replacement` | globalReplacementId |
| `catalog.replacement_reused` | se reutiliza el catálogo por OEM + país | globalReplacementId |
| `replacement.created` | se crea el listado local | replacementId |

Los eventos de catálogo y listado comparten `correlationId`. Esto permite saber
que un catálogo global fue creado o reutilizado por el alta de un listado local,
sin atribuir el catálogo a un tenant que no le pertenece.

También se incorporan `replacement.updated` y `replacement.deleted` al tocar
`PATCH` y `DELETE`; en cambios se guardan sólo los campos modificados y su valor
anterior/nuevo permitido.

### Carga masiva de repuestos

La carga actual retorna `202`, guarda el estado del job en memoria y después
procesa los inserts de forma asíncrona. Para auditarla correctamente debe
persistirse un `bulk_upload_job` antes de devolver el `202`.

| Evento | Momento | Granularidad |
|---|---|---|
| `replacement.bulk_upload_queued` | archivo aceptado | un evento por job |
| `replacement.bulk_upload_started` | comienza el processor | un evento por job |
| `catalog.replacement_created` / `catalog.replacement_reused` | se procesa cada fila válida | un evento por catálogo afectado |
| `replacement.created` | se inserta cada listado local | un evento por repuesto insertado |
| `replacement.bulk_upload_batch_failed` | rollback de un batch | un evento por batch, con líneas y motivo seguro |
| `replacement.bulk_upload_completed` / `replacement.bulk_upload_failed` | termina el job | un evento por job, con totales |

`bulk_upload_job` conserva actor, tenant, sucursal, nombre/tamaño/hash del CSV,
estado, contadores y timestamps. No se almacena el CSV completo en la auditoría.
El processor recibe explícitamente `actorUserId` y `jobId`; hoy sólo recibe
tenant, sucursal y país, por lo que perdería quién inició el trabajo.

### Pedidos y facturación

Los cambios de estado de pedidos y facturas se registran dentro de la misma
transacción que modifica la entidad de negocio:

| Evento | Momento | Subject |
|---|---|---|
| `order.created` | se crea el pedido y se descuenta el stock | orderId |
| `order.confirmed` | el pedido pasa de `pending` a `confirmed` | orderId |
| `order.cancelled` | se cancela el pedido y se restaura el stock | orderId |
| `order.fulfilled` | el pedido confirmado queda asociado a una factura | orderId |
| `invoice.created` | se crea una factura directa o desde un pedido | invoiceId |
| `invoice.cancelled` | se cancela la factura y se restaura el stock | invoiceId |

Cuando `order.fulfilled` crea una factura, ambos eventos comparten el contexto
de la petición y su `correlationId`. Ningún evento de éxito persiste si la
transacción de pedido, factura o stock se revierte.

## Modelo de datos

Crear el módulo `audit` en `repuestito-api/src/audit/` y una entidad append-only
`audit_event`:

```text
audit_event PARTITION BY RANGE (occurred_at)
  id                 UUID NOT NULL
  occurred_at        timestamptz NOT NULL DEFAULT now()
  event_type         varchar(100) NOT NULL
  outcome            varchar(20) NOT NULL  -- succeeded | failed

  actor_user_id      UUID NULL
  actor_email        varchar(320) NULL  -- snapshot normalizado para lectura histórica
  actor_role         varchar(30) NULL
  tenant_id          UUID NULL
  branch_id          UUID NULL

  subject_type       varchar(50) NOT NULL  -- user | replacement | global_replacement | bulk_upload_job
  subject_id         varchar(64) NOT NULL
  correlation_id     UUID NOT NULL
  request_id         UUID NULL

  before             jsonb NULL
  after              jsonb NULL
  metadata           jsonb NOT NULL DEFAULT '{}'
  ip_hash            varchar(64) NULL
  user_agent         varchar(512) NULL

  PRIMARY KEY (occurred_at, id)
```

Índices mínimos:

```sql
CREATE INDEX idx_audit_event_subject
  ON audit_event (subject_type, subject_id, occurred_at DESC);
CREATE INDEX idx_audit_event_actor
  ON audit_event (actor_user_id, occurred_at DESC);
CREATE INDEX idx_audit_event_tenant
  ON audit_event (tenant_id, occurred_at DESC);
CREATE INDEX idx_audit_event_correlation
  ON audit_event (correlation_id, occurred_at);
CREATE INDEX idx_audit_event_type_time
  ON audit_event (event_type, occurred_at DESC);
```

## Particionamiento y retención

`audit_event` se particiona semestralmente por `occurred_at`, siempre en UTC. La
auditoría es una tabla de sólo inserción y puede crecer mucho más rápido que las
tablas de negocio; este esquema mantiene pequeñas las particiones activas y
permite eliminar datos vencidos sin ejecutar un `DELETE` masivo.

```sql
CREATE TABLE audit_event_2026_h2 PARTITION OF audit_event
  FOR VALUES FROM ('2026-07-01 00:00:00+00') TO ('2027-01-01 00:00:00+00');

CREATE TABLE audit_event_2027_h1 PARTITION OF audit_event
  FOR VALUES FROM ('2027-01-01 00:00:00+00') TO ('2027-07-01 00:00:00+00');
```

Al ser una tabla particionada por fecha, PostgreSQL exige que toda clave
`PRIMARY KEY` o `UNIQUE` del padre incluya la clave de partición. Por eso la
clave primaria es `(occurred_at, id)`, no sólo `id`; no hay entidades que deban
referenciar un evento de auditoría mediante FK. El UUID sigue siendo el
identificador lógico del evento y el riesgo de colisión es despreciable, pero
no se declara un `UNIQUE (id)` global que PostgreSQL no podría garantizar entre
particiones. [PostgreSQL: partitioning](https://www.postgresql.org/docs/current/ddl-partitioning.html)

### Mantenimiento programado

Un job de base de datos o del pipeline de despliegue se ejecuta cada seis meses:

1. Crea la partición del próximo semestre si no existe; junto con la del
   semestre actual, mantiene seis meses de anticipación.
2. Comprueba que exista la partición del semestre actual antes de habilitar un
   despliegue.
3. A los 24 meses, desacopla la partición vencida para backup/legal hold o la
   elimina con `DROP TABLE audit_event_YYYY_H1` o `audit_event_YYYY_H2` si la
   política de retención lo
   permite.
4. Registra el resultado del mantenimiento en la observabilidad operativa, no
   dentro de `audit_event`.

No se crea una partición `DEFAULT`: si falta una partición semestral, el insert
debe fallar visiblemente en lugar de ocultar el error y concentrar datos fuera
de su rango. El `DROP TABLE` de una partición completa es mucho más rápido y
evita el costo de `VACUUM` de borrar filas una a una. [Mantenimiento de
particiones](https://www.postgresql.org/docs/current/ddl-partitioning.html)

Los índices definidos sobre el padre deben crearse por migración SQL para que
PostgreSQL los aplique a cada partición. Las consultas del futuro endpoint de
auditoría deben exigir un rango de `occurred_at`; así PostgreSQL descarta las
particiones que no corresponden antes de ejecutar la consulta.

TypeORM seguirá mapeando la entidad `AuditEvent` al padre, pero la creación del
padre, sus particiones e índices debe vivir en una migración SQL explícita, no
en `synchronize`. La entidad debe declararse con `synchronize: false`, incluso
en desarrollo, para que la configuración actual del proyecto no intente alterar
la jerarquía de particiones. `occurredAt` e `id` se mapean como columnas
primarias en la entidad, igual que la clave SQL. Esto evita que el ORM trate esa
jerarquía como una tabla convencional.

## Consulta y monitoreo para GOD

No se exponen endpoints de escritura. Se incorpora `GET /audit-events`, protegido
por `JwtAuthGuard`, `RolesGuard` y `@Roles(UserRole.GOD)`. El backend —no la
interfaz— es quien impone este permiso. `GOD` puede consultar eventos de todos
los tenants y usar `tenantId` como filtro; ningún otro rol recibe acceso a este
endpoint.

El endpoint exige `from` y `to` en UTC, con un máximo de 31 días por consulta,
y admite estos filtros opcionales:

| Filtro | Uso |
|---|---|
| `tenantId`, `branchId` | acotar organización y sucursal; la sucursal se valida contra el tenant elegido |
| `eventType`, `outcome` | tipo de acción y `succeeded` / `failed` |
| `actorUserId` | acción realizada por una persona concreta |
| `subjectType`, `subjectId` | historial de usuario, repuesto, catálogo o job |
| `correlationId`, `requestId` | seguir una operación o petición concreta |

Los resultados se ordenan por `occurred_at DESC, id DESC` y usan paginación por
cursor compuesto `(occurred_at, id)`, nunca `OFFSET`. La respuesta devuelve una
lista acotada (máximo 100), `nextCursor` y sólo los campos necesarios para la
tabla; `before`, `after` y `metadata` se solicitan por
`GET /audit-events/:id?occurredAt=<UTC>` con el mismo guard. `occurredAt` es
obligatorio en el detalle, porque la clave primaria física es compuesta.

La interfaz se ubica en `/dashboard/admin/audit` y agrega al sidebar el ítem
**Auditoría**, visible con `minRole: 'ADMIN'`. En el frontend actual `GOD` se
presenta como `ADMIN`, pero no debe usarse esa conversión como autorización.

La pantalla contiene:

- una barra fija de filtros: período (por defecto, últimos 7 días), tenant,
  sucursal dependiente, tipo de evento, resultado, actor, subject y IDs de
  correlación/petición; botones **Aplicar** y **Limpiar**;
- una tabla paginada con fecha UTC, evento, resultado, actor (email snapshot),
  tenant/sucursal, subject y correlación;
- filtros aplicados como chips removibles y estado vacío explícito;
- un panel lateral de detalle de sólo lectura para los snapshots permitidos,
  con JSON formateado y sin acciones de edición o exportación inicial.

No se incorpora búsqueda libre sobre `before`, `after` o `metadata`: impediría
el uso predecible de índices y podría exponer datos que no deberían convertirse
en criterio de búsqueda. El API aplica el rango temporal antes de consultar para
permitir el partition pruning.

## Contexto de auditoría

Un `AuditContext` se crea por petición después de validar JWT:

```ts
interface AuditContext {
  actorUserId: string | null;
  actorEmail: string | null;
  actorRole: string | null;
  tenantId: string | null;
  branchId: string | null;
  requestId: string;
  correlationId: string;
  ipHash: string | null;
  userAgent: string | null;
}
```

Un middleware asigna `requestId` y un interceptor construye el contexto desde
`req.user`. Para registro público se usa `actorUserId: null` y se asocia el
evento al usuario recién creado. Para tareas asíncronas, el contexto se serializa
en `bulk_upload_job` y se reconstruye al ejecutar el processor.

La IP se hashea con un secreto del servidor antes de guardarla. El `userAgent`
se trunca. No se almacenan headers, cuerpos HTTP completos ni archivos.

## Escritura atómica

`AuditService.record()` recibe el `EntityManager` de la operación cuando esta
ya tiene una transacción activa. La fila de `audit_event` se inserta dentro de la
misma transacción que el cambio de negocio:

```text
crear/actualizar repuesto + insertar evento de auditoría + commit
```

Si el commit falla, no queda ni el cambio ni un evento que diga falsamente que
fue exitoso. Los fallos previos al cambio se registran en una transacción breve
separada, sólo con su resultado y motivo seguro.

En la carga masiva, cada batch conserva su atomicidad actual y registra los
eventos de las filas insertadas con ese mismo `queryRunner.manager`. Si un batch
hace rollback, `replacement.bulk_upload_batch_failed` se inserta después del
rollback en una transacción breve separada; nunca dentro de la transacción que
se revierte. El evento final del job se persiste luego de actualizar su estado.

## Datos permitidos y datos prohibidos

`before` y `after` son snapshots acotados por evento, no copias genéricas de
entidades. Para un repuesto: precio, stock, branchId, active y referencias de
catálogo. Para un usuario: email, rol, tenantId, branchId e email verificado.

Nunca persistir en auditoría:

- contraseñas o hashes;
- códigos de verificación o recuperación;
- JWT, cookies, API keys o secretos;
- archivos CSV o imágenes;
- headers completos;
- datos personales que no sean necesarios para trazabilidad.

La retención inicial de `audit_event` es 24 meses para todos sus eventos,
incluidos los fallos de autenticación: una partición semestral no permite purgar
sólo ese subconjunto a los 90 días sin `DELETE` por fila. Si se requiere esa
retención corta, los fallos se duplican además en telemetría de seguridad
separada, sin payloads sensibles y con purga propia. Los eventos no se actualizan
ni eliminan desde la aplicación; la purga, si se aprueba, debe ser un proceso
administrativo documentado.

## Cobertura progresiva

La primera entrega cubre registro/invitación/verificación/login, altas y cambios
individuales de repuestos, y carga masiva. Después se extiende a tenant,
sucursal, usuarios, vehículos, compatibilidades, marcas, archivos, pedidos y
facturación. Cada endpoint que modifique estado debe definir su `event_type`,
subject y snapshot permitido antes de implementarse.

No se auditan lecturas normales de listados o detalle en esta tabla: eso produce
alto volumen y no aporta evidencia de cambios. Si se necesita telemetría de uso
o diagnóstico HTTP, se implementa separada de la auditoría de negocio, con
retención corta y sin payloads sensibles.

## Orden de implementación

1. Crear migración y `AuditModule` con `AuditEvent` y `AuditService`.
2. Agregar middleware/interceptor de `AuditContext` y `requestId`.
3. Instrumentar `AuthService.register`, verificación, invitación, login y reset.
4. Instrumentar `ReplacementService.create`, `update` y `remove` usando el
   `EntityManager` de sus transacciones.
5. Crear `bulk_upload_job`, reemplazar el estado efímero del `Map` y propagar
   actor/correlación al processor.
6. Instrumentar commits, rollbacks y cierre de la carga masiva.
7. Agregar pruebas de transacción, aislamiento por tenant, redacción de secretos
   y correlación entre job, catálogo y repuestos.
8. Exponer `GET /audit-events` y detalle, exclusivamente para `UserRole.GOD`,
   con rango, filtros e índices acordados.
9. Crear `/dashboard/admin/audit`, su barra de filtros, tabla paginada y panel
   de detalle de sólo lectura; mostrarla sólo a `ADMIN` en el frontend.

## Criterios de aceptación

- Un usuario creado deja un evento con su información administrativa, sin
  secretos.
- Un alta individual deja eventos correlacionados del catálogo y del listado
  local; si la transacción revierte, no quedan eventos de éxito.
- Una carga masiva conserva actor, job, totales, filas insertadas y fallos por
  batch aun si el proceso termina después del `202`.
- Todo evento es filtrable por tenant, actor, subject y rango temporal.
- Sólo `GOD` puede consultar auditoría; puede filtrar todos los tenants y los
  demás roles reciben `INSUFFICIENT_PERMISSIONS`.
- El visor aplica rango de fecha, filtros y cursor sin cargar snapshots hasta
  que se abre un evento.
- Ningún evento puede ser creado, editado o borrado desde el cliente.
- Las pruebas demuestran que no aparecen contraseñas, tokens, códigos ni
  contenido de archivos en `audit_event`.
