# Rediseño de correos transaccionales — Planificación

> Estado: implementado (backend). Falta UI de subida de logo por tenant y prueba de envío real.

---

## Objetivo

Los correos que envía la plataforma (verificación de email, reset de contraseña, invitación de usuario) son la única parte del flujo de auth que hoy no tiene ninguna identidad visual: es HTML plano inline, sin logo, sin colores de marca, sin layout. El resto de la interfaz (login, register, dashboard) ya está diseñado — esto rediseña esa pieza faltante.

## Estado actual (`repuestito-api/src/auth/auth.service.ts`)

3 envíos vía `this.resend.emails.send({ ..., html: '...' })`, cada uno con el string armado inline en el método:
- `register` (línea ~113): código de verificación.
- `forgotPassword` (línea ~183): código de reset.
- `inviteUser` (línea ~218): invitación con código + link.

Sin layout compartido, sin logo, sin estilos — texto negro sobre fondo blanco por defecto del cliente de correo.

## Alcance — implementado

- `repuestito-api/src/mail/templates/email-layout.ts` — `renderEmailLayout(logoUrl, bodyHtml)`: header con `<img>` del logo, footer con copyright + link de soporte. Colores de marca como constantes (`EMAIL_COLORS`, referencia estática de `theme.css`, no se puede consumir directo por límites de los clientes de correo).
- `verification-email.ts`, `reset-password-email.ts`, `invite-email.ts` — cada uno arma solo el `bodyHtml` (título, texto, bloque de código, y en invitación botón CTA) y llama a `renderEmailLayout`.
- `auth.service.ts` consume las 3 funciones en vez de tener el HTML inline; ya no importa estilos propios.
- Diseño visual: mockup previo armado en Claude Design (3 artboards) usado como referencia 1:1 para el HTML final.

### Logo personalizado por tenant (con fallback al default) — implementado

- Columna `logoUrl: string | null` agregada a `Tenant` (`tenant.entity.ts`), sin migración manual (`synchronize: true`).
- `UpdateTenantDto.logoUrl` agregado — seteable vía `PATCH /api/tenants/:id` (endpoint ya existente).
- Logo default: `piezify-logo.svg` convertido a PNG 2x (320×80) con `sips`, subido a Cloudinary (`branding/piezify-logo-email`). `defaultLogoUrl` en `AuthService` es esa URL de Cloudinary hardcodeada (no `${FRONTEND_URL}/...`: en dev `FRONTEND_URL` es `localhost`, no accesible por el proxy de imágenes de Gmail — el logo llegaba roto).
- `AuthService.resolveLogoUrl(tenantId)`: si no hay `tenantId` o el tenant no tiene `logoUrl`, cae al default; si lo tiene, lo usa. Usado en `register` y `forgotPassword` (vía `user.tenantId`); `inviteUser` resuelve el tenant directo por `dto.tenantId` (también trae `businessName` para el copy de la invitación).
- `AuthModule` ahora importa `TenantModule` para inyectar `TenantService` en `AuthService`.

## Pendiente

- UI para que el tenant suba su logo (no construida aún). Candidato: `/dashboard/config`, sección nueva "Marca", reutilizando `ImageUpload` (`components/ui/ImageUpload/`) → `POST /api/upload` → Cloudinary → `updateTenant({ logoUrl })`.
- Validación: no se probó envío real todavía (`tsc --noEmit` en `repuestito-api` limpio, sin más). Falta correr `RESEND_API_KEY` real o `DEV_EMAIL_OVERRIDE` y revisar renderizado en Gmail/Outlook web.

## Validación pendiente

No implementado. Al implementar: `tsc --noEmit` en `repuestito-api`, y enviar un correo de prueba real (Resend en modo dev, `DEV_EMAIL_OVERRIDE`) para revisar renderizado en Gmail/Outlook web antes de dar por terminado.
