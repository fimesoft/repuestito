# Mejoras de seguridad — auditoría del backend (security-audit de Cloudflare)

## Contexto

Auditoría completa de `repuestito-api` hecha con la skill open source
[`cloudflare/security-audit-skill`](https://github.com/cloudflare/security-audit-skill)
(perfil `standard`, run-1, commit `557a005`).

- Solo se leyó el código: no se ejecutó nada ni se envió tráfico a producción.
  La ejecución local estaba bloqueada (macOS no permite imponer un límite de
  memoria y Docker no estaba corriendo). Por eso las 18 pistas quedaron como
  `needs_validation`, sin severidad asignada.
- Cada pista la revisaron dos agentes independientes. Ninguno encontró un
  control en el código que la impida.
- Reporte completo: `~/security-audit-skill/repuestito-api/run-1/`
  (`REPORT.md`, `NEEDS-VALIDATION.md`, `findings.json`).

El núcleo de órdenes, facturas y clientes está bien aislado por tenant. El
problema principal es la **gestión de identidades y roles**: todo registro
público recibe MODERATOR y ese rol no tiene límite de tenant ni de rol.

---

## Prioridad 0 — Secretos expuestos en git (hacer primero)

**Problema.** `.env` se commiteó en 35e4a47, 3c551c9, d91a760 y 10f330b. Esos
commits se pushearon: todos quedan en `origin/master`, y `origin/main` todavía
trackea el archivo. Contiene `JWT_SECRET`, `CLOUDINARY_API_KEY`,
`CLOUDINARY_API_SECRET` y `RESEND_API_KEY`. El `.env` local actual tiene los
mismos valores, así que nunca se rotaron.

**Impacto si producción usa esos valores.** Con `JWT_SECRET` cualquiera puede
firmar una cookie `token` para cualquier email, GOD incluido, sin contraseña:
`JwtStrategy.validate` busca al usuario solo por `payload.email`. Con la key de
Cloudinary se pueden subir o borrar medios, y con la de Resend enviar correos
como Piezify.

**Pasos.**
1. En el VPS, comparar el sha256 de cada secreto de
   `/opt/piezify/repuestito-deploy` contra `git show 10f330b:.env` y
   `git show origin/main:.env`, sin imprimir los valores.
2. Rotar los que coincidan: generar un `JWT_SECRET` nuevo (esto invalida todas
   las sesiones) y regenerar las keys de Cloudinary y Resend.
3. Borrar o resetear la rama `main` (local y `origin/main`).
4. Purgar `.env` del historial con `git filter-repo --path .env --invert-paths`
   y hacer force-push. Tratar los clones y forks existentes como comprometidos.
5. Opcional: agregar un escáner de secretos en pre-commit, como gitleaks.

---

## Prioridad 1 — De registro anónimo a GOD

### 1.1 Registro público otorga MODERATOR y acepta tenant del cliente

- **Archivos:** `src/auth/dto/register.dto.ts`, `src/auth/auth.service.ts` (`register`),
  `src/user/user.entity.ts:34`.
- **Problema:** `register()` no asigna rol, así que aplica el default
  `MODERATOR` de la columna. Además guarda los `tenantId` y `branchId` que manda
  el cliente. Resultado: cualquiera que verifique su propio email queda como
  dueño de un tenant ajeno.
- **Fix:**
  - quitar `tenantId` y `branchId` de `RegisterDto`;
  - asignar explícitamente un rol mínimo al registrarse;
  - dejar el tenant en `null` hasta el onboarding (`POST /tenants`) o una invitación.
- **Decisión pendiente:** hoy el self-onboarding necesita que el usuario sea
  MODERATOR. Hay dos opciones: crear un rol "sin tenant" que solo pueda hacer
  onboarding, o promover a MODERATOR dentro de `TenantService.create`.
- **Test:** `register` con `tenantId` → el usuario queda sin tenant y con el rol mínimo.

---

## Prioridad 2 — Autenticación y sesión

### 2.1 Códigos de 6 dígitos sin límite por cuenta

- **Archivos:** `src/auth/auth.service.ts` (`resetPassword`, `verifyEmail`),
  `src/user/user.entity.ts`.
- **Problema:** solo hay throttle por IP: 5 intentos cada 120 s, por handler.
  Con muchas IPs se puede adivinar el código de reset y tomar la cuenta.
- **Fix:**
  - agregar las columnas `resetAttempts` y `verificationAttempts`;
  - tras 5 fallos, invalidar el código y exigir uno nuevo;
  - guardar el hash del código en vez del texto plano;
  - revisar en nginx que `X-Forwarded-For` use `$remote_addr` o `$proxy_add_x_forwarded_for`.

### 2.2 JWT no se revoca

- **Archivos:** `src/auth/strategies/jwt.strategy.ts`, `src/auth/auth.service.ts`.
- **Problema:** después de un logout o un reset, el token viejo sigue sirviendo
  hasta 30 minutos. Además el usuario se busca por `email` y no por `sub`.
- **Fix:**
  - agregar `passwordChangedAt` (o un `tokenVersion`) al usuario;
  - en `validate()`, rechazar tokens cuyo `iat` sea anterior a ese valor;
  - buscar al usuario por `sub` y comparar el email.

### 2.3 `tenant.active` no se aplica

- **Problema:** marcar un tenant como inactivo no bloquea a sus usuarios. Solo
  se usa para contar en `stats`.
- **Fix:** si "Inactivo" significa suspensión, en `JwtStrategy.validate` (y en
  el login) cargar el tenant de los usuarios que no son GOD y rechazar el
  acceso cuando `active=false`.

### 2.4 Envío de emails sin tope

- **Problema:** register, resend-verification y forgot-password mandan un email
  en cada request. Una sola IP puede generar unos 15 envíos cada 2 minutos.
  Esto agota la cuota de Resend y permite bombardear a una víctima.
- **Fix:**
  - cooldown por destinatario (por ejemplo, no reenviar si el último código
    tiene menos de 60 s);
  - tope diario global de envíos;
  - opcional: Turnstile en register y forgot-password (skill `turnstile-spin`
    de Cloudflare);
  - devolver un código de error genérico en lugar de `sendError.message`.

---

## Prioridad 3 — Integridad de negocio

### 3.1 Transiciones de orden y factura no atómicas

- **Archivos:** `src/order/orders.service.ts` (`confirm`, `fulfill`, `cancel`),
  `src/invoice/invoices.service.ts` (`cancel`).
- **Problema:** el estado se valida fuera de la transacción y el UPDATE no
  filtra por estado. Dos cancels concurrentes devuelven el stock dos veces, y
  dos fulfills crean dos facturas. Un SELLER puede usarlo para inflar stock.
- **Fix:**
  - mover el chequeo dentro de la transacción;
  - usar `UPDATE ... WHERE id=$1 AND tenant_id=$2 AND status = '<esperado>'`;
  - si `affectedRows === 0`, abortar antes de cualquier efecto secundario;
  - alternativa: `SELECT ... FOR UPDATE`;
  - evaluar un índice único parcial en `orders.invoice_id`.
- **Test:** dos cancels con `Promise.all` → solo uno tiene éxito y el stock queda igual.

### 3.2 Onboarding de "un tenant por cuenta" con carrera

- **Archivo:** `src/tenant/tenant.service.ts:95`.
- **Fix:** `UPDATE users SET tenant_id=... WHERE id=$1 AND tenant_id IS NULL`,
  chequear las filas afectadas y hacer rollback si da 0.

### 3.3 HTML sin escapar en el email de invitación

- **Archivo:** `src/mail/templates/invite-email.ts:12` (y `logoUrl` en `email-layout.ts:19`).
- **Fix:** crear un helper `escapeHtml()` y aplicarlo a `businessName` y
  `logoUrl`, y validar `logoUrl` con `@IsUrl({ protocols: ['https'] })`.

---

## Prioridad 4 — Recursos y gasto del operador

| Pista | Archivo | Fix |
|---|---|---|
| El Map de jobs del bulk upload nunca se limpia (riesgo de OOM) | `replacement-bulk-upload.processor.ts:47` | TTL/eviction, tope de filas y errores por job, concurrencia máxima, atar el job al tenant |
| Un CSV crea hasta ~65k marcas compartidas sin auditoría | `processor.ts:277` | Tope de marcas nuevas por job y por tenant, evento de auditoría, filtrar marcas no verificadas para otros tenants |
| Upload a Cloudinary sin cuota | `upload.controller.ts`, `cloudinary.service.ts` | Exigir tenant, cuota por tenant, limpiar imágenes huérfanas, `allowed_formats` sin svg |
| Webhook de Mercado Libre anónimo y sin throttle | `mercadolibre-webhook.*` | Throttle propio (no `SkipThrottle` total), `application_id` obligatorio, límite de body chico, `notification_id NOT NULL` o `NULLS NOT DISTINCT`, retención |

Revisar además en el server: `client_max_body_size` y `limit_req` en nginx, y
`mem_limit` y `NODE_OPTIONS` en el `docker-compose.yml` de deploy.

---

## Hardening (no son hallazgos)

- [ ] `@Exclude()` en `password`, `verificationCode`, `resetToken` y sus expiraciones en `User`.
- [ ] `RolesGuard`: denegar por defecto cuando la ruta no tiene `@Roles`.
- [ ] Normalizar el email (trim y lowercase) en todos los flujos de auth, o usar un índice único sobre `lower(email)`.
- [ ] Arreglar la invitación: el token de 32 hex nunca se puede canjear porque `ResetPasswordDto` exige 6 caracteres.
- [ ] Cookie `secure` y `DEV_EMAIL_OVERRIDE`: que el valor por defecto sea el seguro, salvo que `NODE_ENV === 'development'`. Poner `NODE_ENV=production` en el Dockerfile.
- [ ] `stats.service.ts:80`: bindear `days` como parámetro y acotar su rango.
- [ ] Escapar `%` y `_` en los ILIKE y validar `ids` como UUID.
- [ ] `taxRate` con `@Min(0) @Max(100)`. Revisar si un SELLER puede fijar `unitPrice` libremente.
- [ ] Pasar `InvoicesBootstrapService` (`DROP TABLE` al arrancar) a una migración y usar un rol de DB sin permisos DDL.
- [ ] Agregar una partición DEFAULT o un job para `audit_event`: hoy solo hay particiones hasta 2027-07-01.
- [ ] `deploy.yml`: fijar `appleboy/ssh-action` por SHA y limitar la key a un forced command.
- [ ] `docker-compose.yml` del repo: bindear Postgres a `127.0.0.1` y no usar `postgres/postgres`.
- [ ] Generar `x-correlation-id` en el server o guardar el valor del cliente en un campo aparte.

## Lo que ya está bien

- `resolveTenantId` y `assertOwnedByTenant` en órdenes, facturas y clientes.
- Descuento de stock atómico (`stock >= $1` con chequeo de filas afectadas).
- SQL parametrizado en todo el código; lo único interpolado son UUID.
- Login con hash dummy de bcrypt contra timing; `timingSafeEqual` y `randomInt` para los códigos.
- `JWT_SECRET` con `getOrThrow`; Swagger solo en development; helmet; CORS con un solo origen.
- La imagen Docker corre como el usuario `node` y `.dockerignore` excluye `.env`.

## Próxima corrida

Para pasar las pistas de `needs_validation` a `confirmed` hace falta un sandbox
con límite de memoria. Por ejemplo, Docker con `--network none --memory`, más
imágenes locales de node y Postgres. Las corridas se acumulan: la run-2 usa el
ledger de la run-1 y revalida lo que haya cambiado.
