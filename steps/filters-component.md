# Componente `Filters` reutilizable — Plan de trabajo

> Creado: septiembre 2026. Implementado (frontend + backend), `tsc --noEmit` y `next build` sin errores en ambos proyectos.

---

## Objetivo

Extraer la barra de filtros que hoy se repite (con variaciones) en `dashboard/orders`, `dashboard/billing` y `dashboard/replacement` a un componente único `components/shared/Filters`, reutilizable por las 3 páginas con props propias de cada una.

## Por qué importa

- Los 3 filtros están duplicados con leves inconsistencias que ya generaron bugs (ver `steps/` — el `EmptyState` de `orders` no consideraba `statusFilter`, solo `billing` lo hacía bien).
- Cada página repite el layout (`<div className={styles.filters}>` + `Search` + `Label`/`Select` sueltos) y su propio `styles.filters` en el CSS module, con las mismas reglas (`display:flex; gap:12px; flex-wrap:wrap; align-items:flex-end`) copiadas 3 veces.
- Centralizar el layout facilita agregar filtros nuevos (ej. rango de fechas en pedidos, filtro por marca en repuestos) sin volver a copiar el patrón.

## Estado actual (relevado)

| Página | Filtros actuales | Fuente del filtro | Dónde filtra |
|---|---|---|---|
| `dashboard/orders` | `Search` (comprador) + `Select` Estado | Search: cliente (sobre `orders` ya paginado). Estado: servidor (`getOrders({status})`) | Mixto |
| `dashboard/billing` | `Search` (comprador) + `Desde`/`Hasta` (date) + `Select` Estado | Search y Estado: **cliente** (`visibleInvoices`). Fechas: servidor (`getInvoices({from,to})`) | Mixto |
| `dashboard/replacement` | `Search` (nombre) + `ViewToggle` (no es un filtro, es vista tabla/grid) | Search: servidor (`getReplacements({search})`) | Servidor |

No hay dos páginas con el mismo conjunto de filtros ni el mismo lugar de filtrado (cliente vs. servidor), así que el componente **no puede** encapsular el estado ni la lógica de filtrado — solo el layout y los controles. Cada página sigue siendo dueña de su estado (`useState`, `useDebounce`, `useCallback load`) y de si filtra en cliente o servidor.

### Ampliación: sumar rango de fechas + estado a `dashboard/replacement`

`dashboard/replacement` va a pasar a tener el mismo conjunto de filtros que `billing` (Search + Desde/Hasta + Estado). A diferencia de `orders`/`billing`, esto **no es solo frontend**: hoy el backend no soporta ninguno de los dos.

- `Replacement` (`repuestito-api/src/replacement/replacement.entity.ts`) tiene `active: boolean` (no un enum de estados como `orders`/`invoices`) y `createdAt: Date` (`@CreateDateColumn`), pero `QueryReplacementDto` (`repuestito-api/src/replacement/dto/query-replacement.dto.ts`) solo acepta `search`, `country`, `ids`, `page`, `limit` — no hay `active`, `from` ni `to`.
- `ReplacementService.findAll` (`replacement.service.ts:117-138`) construye el listado con `createQueryBuilder` + `andWhere` encadenados (mismo patrón que `OrdersService.findAll` en `orders.service.ts:178`) — agregar los filtros nuevos es análogo a como ya está `status` en `orders`.

**Cambios de backend necesarios:**
1. `QueryReplacementDto`: agregar `active?: boolean` (con `@Type(() => Boolean)` o transformar `'true'/'false'` de query string) y `from?: string` / `to?: string` (`@IsDateString`).
2. `ReplacementService.findAll`: agregar
   - `if (query.active !== undefined) qb.andWhere('r.active = :active', { active: query.active });`
   - `if (query.from) qb.andWhere('r.createdAt >= :from', { from: query.from });`
   - `if (query.to) qb.andWhere('r.createdAt <= :to', { to: query.to });`
3. `services/replacement.service.ts` (frontend): agregar `active`, `from`, `to` a los params de `getReplacements(query)`.

**Frontend (`dashboard/replacement/page.tsx`):** el filtro "Estado" es un `Select` de 2 opciones (`{ value: 'true', label: 'Activo' }` / `{ value: 'false', label: 'Inactivo' }'`), no una lista abierta como en `orders` — mapear el string del `Select` a boolean antes de mandarlo a `getReplacements`. El rango de fechas filtra por `createdAt` (fecha de alta del repuesto), igual patrón que `Desde`/`Hasta` en `billing`.

Con esto, las 3 páginas terminan con la misma forma de filtros (`Search` + `dateRange` + 1 `select` de Estado), lo que refuerza el caso de uso del componente `Filters` — ya no hace falta decidir si vale la pena migrar `replacement` (ver "Riesgos" más abajo, actualizado).

## Diseño propuesto

`components/shared/Filters/Filters.tsx` — componente de **layout + composición**, no de estado. Recibe slots ya armados (controlados por la página) en vez de reinventar cada tipo de filtro:

```tsx
interface FiltersProps {
  search?: {
    value: string;
    onChange: (value: string) => void;
    placeholder?: string;
  };
  dateRange?: {
    from: string;
    to: string;
    onFromChange: (value: string) => void;
    onToChange: (value: string) => void;
    fromLabel?: string; // default "Desde"
    toLabel?: string;   // default "Hasta"
  };
  selects?: {
    label: string;
    value: string;
    onChange: (value: string) => void;
    options: SelectOption[];
    placeholder?: string;
  }[];
  children?: ReactNode; // slot para controles page-specific (ej. ViewToggle en repuestos)
}
```

- `search`, `dateRange` y `selects` son opcionales: cada página pasa solo lo que necesita.
- `selects` es un array (no un solo campo) porque a futuro puede haber más de un select (ej. Estado + Marca en repuestos).
- El componente renderiza `Search` (ya existe en `components/ui/Search`), `Label` (`components/ui/Label`, ya creado) + `input type="date"` para `dateRange`, y `Label` + `Select` (`components/ui/Select`) por cada entrada de `selects`. `children` se renderiza al final para lo que no entra en el esquema (ej. `ViewToggle`).
- CSS: mueve `.filters` (flex, gap 12px, flex-wrap, align-items: flex-end) a `Filters.module.css`. Las páginas dejan de declarar su propio `.filters`.

### Lo que NO hace el componente (a propósito, por regla de soluciones simples)

- No gestiona debounce de búsqueda (`useDebounce` sigue en cada página — cada una decide el delay y cuándo filtra en cliente vs. servidor).
- No decide si el filtro pega al servidor o filtra el array en memoria — eso ya varía entre las 3 páginas y no es responsabilidad de un componente de layout.
- No incluye lógica de `EmptyState` — cada página sigue calculando su propio `hasFilters` para el mensaje vacío (ya corregido en `orders`, correcto en `billing`, no aplica en `replacement` porque no tiene selects).

## Migración por página (implementado)

1. ✅ **`components/shared/Filters/`**: creado `Filters.tsx`, `Filters.module.css`, `index.ts`. Usa `Label size="sm"` para todos los labels de filtro (fecha y selects), sin exponer esa prop en `FiltersProps` — es una decisión fija del componente, no algo que cada página deba pasar.
2. ✅ **`dashboard/orders/page.tsx`**: reemplazado el `<div className={styles.filters}>` por `<Filters search={{...}} selects={[{ label: 'Estado', ... }]} />`. Eliminadas `.filters` y `.input, .select` (sin otro uso) de `orders/page.module.css`.
3. ✅ **`dashboard/billing/page.tsx`**: igual + `dateRange={{ from, to, onFromChange: setFrom, onToChange: setTo }}`. Eliminada `.filters` de `billing/page.module.css` (`.input`/`.select` se mantienen: los sigue usando `SaleForm.tsx`, que importa el mismo módulo CSS).
4. ✅ **Backend — `replacement` (repuestito-api)**: `QueryReplacementDto` ahora acepta `active?: string` (`@IsIn(['true','false'])`) y `from?`/`to?` (`@IsDateString`). `ReplacementService.findAll` agrega los 3 `andWhere` análogos a `OrdersService`. `services/replacement.service.ts` (frontend) expone `active?: boolean`, `from?`, `to?` en `ReplacementQuery`.
5. ✅ **`dashboard/replacement/page.tsx`**: estado `from`/`to`/`activeFilter` sumado a los deps de los 2 `useEffect` (carga y reset de página) y a `getReplacements(...)`. `<div className={styles.controls}>` reemplazado por `<Filters search dateRange selects={[{label:'Estado', options: [Activo/Inactivo]}]}><ViewToggle/></Filters>`. Se perdió el `justify-content: space-between` que empujaba `ViewToggle` a la derecha — con más filtros en la fila, ahora queda en flujo normal (flex-wrap) junto al resto; visualmente aceptable dado que ya no es solo Search + ViewToggle. Eliminadas las 2 definiciones duplicadas de `.controls` (dead code, `page.module.css` tenía la clase declarada dos veces) y `.controls` en sí (sin otro uso).
6. ✅ `listEmptyMessage` en `replacement/page.tsx` ahora usa `hasFilters = Boolean(search || from || to || activeFilter)`, mismo fix que en `orders`.
7. ✅ Verificado: `tsc --noEmit` sin errores en frontend y backend, `next build` completo sin errores (19 rutas), `eslint` sobre los archivos tocados sin errores nuevos (los errores/warnings preexistentes de `react-hooks/set-state-in-effect` y memoización en `orders`/`billing`/`replacement` ya estaban antes de este cambio, confirmado con `git stash`). No hay tests de UI automatizados en el proyecto — falta probar manualmente en navegador.

## Riesgos / decisiones abiertas

- **Falta probar en navegador**: no se abrió Chrome para esta tarea (regla del proyecto: no usar el navegador sin que lo pidan). Antes de dar esto por terminado de verdad, probar manualmente los 3 filtros nuevos de `replacement` (fecha + activo/inactivo) contra datos reales, y el layout de `Filters` + `ViewToggle` en pantallas angostas.
- **"Estado" no significa lo mismo en cada página**: en `orders`/`billing` es un enum de varios valores filtrado tal cual viene del `Select`; en `replacement` es un boolean (`active`) mapeado desde 2 opciones fijas (`activeFilter === 'true'`). El componente `Filters` no necesita saber esto — recibe `options`/`value` ya armados — pero cada página hace su propio mapeo antes de pasarlo.
- Sumar `from`/`to`/`active` al listado de repuestos es un cambio de API pública (`GET /api/replacements`) — son todos opcionales, así que `compatibility` y `SaleForm` (los otros 2 consumidores de `getReplacements`) no se ven afectados al no enviarlos.
- El layout de `dashboard/replacement` cambió (ya no hay `justify-content: space-between` para `ViewToggle`) — si el diseño quiere mantener ese alineado a la derecha ahora que hay más filtros, hay que decidir un tratamiento visual específico (no se agregó una prop `align` al componente por no forzar una necesidad hipotética que hoy no pidió nadie más).
