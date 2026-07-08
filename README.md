# Repuestito — Frontend

Next.js App Router · TypeScript · CSS Modules

## Inicio rápido

```bash
npm install
npm run dev
```

Abre [http://localhost:3000](http://localhost:3000) en el browser.

---

## Arquitectura de componentes

La carpeta `components/` sigue una estructura modular de tres niveles:

```
components/
├── ui/                     # Componentes reutilizables y sin lógica de negocio
│   ├── Button/
│   │   ├── Button.tsx
│   │   ├── Button.module.css
│   │   └── index.ts
│   ├── Modal/
│   │   ├── Modal.tsx
│   │   ├── Modal.module.css
│   │   └── index.ts
│   ├── ImageUpload.tsx
│   └── Paginator.tsx
│
├── shared/                 # Componentes globales con algo de lógica propia
│   ├── Header.tsx
│   └── PageCount.tsx
│
└── features/               # Componentes específicos de una sección del producto
    ├── auth/
    │   └── LoginForm.tsx
    └── replacements/
        ├── PartCard.tsx
        └── PartMapWrapper.tsx
```

### `ui/`

Componentes puramente presentacionales. No conocen el dominio de la app, no hacen fetching, no dependen de contextos globales. Se pueden reutilizar en cualquier parte del proyecto.

- Cada componente con su propia carpeta + `index.ts` de barrel export cuando tiene múltiples archivos.
- Sin lógica de negocio. Solo props, estilos y eventos locales.

### `shared/`

Componentes que aparecen en múltiples páginas y pueden tener lógica propia (estado interno, hooks, acceso al router), pero no pertenecen a una sola feature.

Ejemplos: `Header`, `PageCount`, `Sidebar`.

### `features/`

Componentes acoplados a una sección específica del producto. Pueden hacer fetching, usar contextos o depender de servicios. Se agrupan por dominio.

```
features/
├── auth/          → login, registro, recuperación de contraseña
├── replacements/  → listado, detalle y edición de repuestos
└── tenants/       → wizard de creación de tenant + sucursales
```

---

## Estructura de rutas

La carpeta `app/` usa route groups para controlar qué layouts aplican a cada ruta:

```
app/
├── layout.tsx           # Root layout — html, body, providers globales (sin Header)
│
├── app/                 # Ruta /app — pantalla de autenticación (login, registro, recuperación)
│   ├── page.tsx
│   └── page.module.css
│
└── (main)/              # Route group — todas las rutas con Header
    ├── layout.tsx       # Inyecta el Header
    ├── page.tsx         → /
    ├── create/          → /create
    ├── edit/[id]/       → /edit/:id
    ├── parts/[id]/      → /parts/:id
    └── dashboard/       → /dashboard
```

### Por qué route groups

El Header solo debe mostrarse en las rutas del producto. La ruta `/app` (autenticación) usa un layout limpio sin Header. En lugar de condicionar el Header por pathname, se usa un route group `(main)` que inyecta el Header vía su propio `layout.tsx`. El paréntesis en el nombre del grupo no afecta las URLs.

---

## Servicios

La carpeta `services/` contiene las funciones de acceso a la API. Un archivo por recurso:

```
services/
├── replacement.service.ts
├── tenant.service.ts
└── branch.service.ts
```

Cada servicio exporta las funciones de fetch junto con sus tipos de request/response. Los componentes nunca llaman a `fetch` directamente.

---

## Convenciones

| Qué | Cómo |
|---|---|
| Componentes | PascalCase — `PartCard.tsx` |
| Archivos CSS | Mismo nombre + `.module.css` — `PartCard.module.css` |
| Servicios | camelCase + sufijo `.service.ts` |
| Páginas | `app/<ruta>/page.tsx` (App Router) |
| Server components | Por defecto. Agregar `'use client'` solo cuando se usen hooks o eventos. |
| Tipos `any` | Prohibido. Usar tipos específicos, `unknown` con narrowing o utilidades de TypeScript. |
