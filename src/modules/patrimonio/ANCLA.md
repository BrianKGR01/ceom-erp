# ANCLA — Módulo: Patrimonio (Activos y Pasivos)

## Contrato (no romper sin actualizar este archivo)
- Responsabilidad: es dueño de `Activo`, `Pasivo` y `Pago de Pasivo` — el
  dato crudo de qué tiene y qué debe un tenant, y su depreciación/saldo
  derivados bajo demanda.
- NO hace: no calcula porcentaje de uso de capacidad ni genera alertas
  (eso es Producción/Capacidad Operativa, en Módulo 6 —
  `src/modules/operativo/nichos/nicho-1/`, que ya consume `consultarCapacidad`
  de verdad — Patrimonio solo entrega el dato crudo). No genera automáticamente el
  `Gasto` periódico en Costos y Gastos cuando un Pasivo está activo (el
  modelo de datos ya lo soporta — `Pago de Pasivo.origen` admite
  `automatico`/`manual` — pero no hay scheduler ni Módulo 4 todavía; nadie
  llama `registrarPagoPasivo` con `origen: "automatico"` en este momento).
- Entradas que consume: `tienePermiso()` de `identidad/actions.ts` (gate
  real por `"patrimonio"` × acción — a diferencia de Identidad, este
  módulo sí está en el catálogo `modulo_permiso`, así que no hace falta un
  gate ad-hoc). `tenants`/`sucursales` de `identidad/schema.ts` para las FK
  reales de `tenant_id`/`sucursal_id` (patrón esperado, no una excepción).
- Salidas que expone (`actions.ts`): `consultarCapacidad`,
  `consultarValorActual` (+ `calcularValorActual()` pura, exportada),
  `consultarPasivoDeActivo`, `consultarValorPatrimonialTotal`,
  `crearActivo`, `actualizarActivo`, `darDeBajaActivo`, `transferirActivo`,
  `crearPasivo`, `refinanciarPasivo`, `registrarPagoPasivo`.

## Estado actual
- [x] Schema Drizzle (`activos`, `pasivos`, `pagos_pasivo`) + RLS
      (`crudPolicy()` en las dos primeras, policy a mano en la tercera por
      no ser tenant-scoped directa — mismo patrón que `permisos` en
      Identidad).
- [x] `repository.ts` + `actions.ts` con el contrato completo, gateado por
      `tienePermiso()` real.
- [x] Depreciación lineal (bajo demanda, satura en 0) y saldo pendiente
      (agregado sobre `pagos_pasivo`), transición automática a `pagado`,
      refinanciación con trazabilidad (nunca edita el original).
- [x] Tests: `valor-actual.test.ts` (puro) + `patrimonio.test.ts`
      (integración contra Supabase Cloud real).
- [x] `Activo.proveedor_id` **ahora con FK real** a `proveedores.id`
      (migración `0016`) — quedó sin FK durante la construcción de este
      módulo porque Proveedores (Módulo 8) todavía no existía; se cerró
      después, sin tocar la migración original (`0009`).
- [x] Generación automática de `Gasto`/`Pago de Pasivo` hacia Costos y
      Gastos — Módulo 4 (`src/modules/gastos/`) ya existe y
      `generarGastoCuotaPasivo()` llama de verdad a `registrarPagoPasivo(...,
      origen: "automatico")`. Sigue sin scheduler real que lo dispare
      periódicamente — hay que invocarlo a mano o desde un futuro
      scheduler, pero la integración en sí ya funciona.
- [x] `frecuencia_cuota` — resuelto al construir Módulo 4: en vez de
      duplicarlo, `gastos_recurrentes.frecuencia` (Módulo 4) **reutiliza este
      mismo enum** (`frecuenciaCuotaEnum`, import directo desde
      `patrimonio/schema.ts`). Si se agrega un valor nuevo a este enum en el
      futuro, afecta a ambos módulos — no es privado de Patrimonio.

## Dónde está cada cosa
- Esquema de BD (Drizzle): `src/modules/patrimonio/schema.ts`
- Repository: `src/modules/patrimonio/repository.ts`
- Server actions: `src/modules/patrimonio/actions.ts`
- Tests: `src/modules/patrimonio/valor-actual.test.ts`,
  `src/modules/patrimonio/patrimonio.test.ts`
- Migración relevante: `drizzle/migrations/0009` (tablas + RLS, todo en una
  sola migración porque no hay ninguna función SQL custom de la que
  depender, a diferencia de Identidad).

## Decisiones tomadas que un agente no debe revertir
- **Bug real encontrado y corregido durante esta tarea:** `calcularValorActual()`
  usa `getUTCFullYear()`/`getUTCMonth()`, nunca las versiones locales. Un
  `date` de Postgres (`fecha_adquisicion`) se parsea en JS como medianoche
  UTC; con métodos de fecha locales, en cualquier huso horario negativo
  (Bolivia es UTC-4) esa medianoche cae en el día/mes anterior y el cálculo
  de meses transcurridos queda corrido un mes entero. El test
  `valor-actual.test.ts` lo detectó — no volver a usar `getFullYear()`/
  `getMonth()` en cálculos sobre fechas de este tipo en ningún módulo.
- **`frecuencia_cuota` ya no es un enum solo de Patrimonio** — Módulo 4
  (`src/modules/gastos/schema.ts`) importa y reutiliza este mismo tipo de
  Postgres para `gastos_recurrentes.frecuencia`, en vez de duplicarlo. No
  eliminar ni renombrar este enum sin revisar el impacto en Módulo 4.
- **`activo.proveedor_id` tiene FK real desde la migración `0016`** — se
  agregó en una migración aparte, sin tocar `0009` (la que crea la tabla),
  siguiendo la misma regla de nunca editar una migración ya aplicada.
- **Patrón de autorización por recurso:** las acciones que reciben
  `activoId`/`pasivoId` primero buscan la fila (para conocer su
  `tenant_id` real) y recién ahí llaman a `tienePermiso()` — nunca confían
  en un `tenantId` que mande el llamador.
- **Transferencia entre sucursales no lleva ledger** (a diferencia de
  Stock, Módulo 2) — un activo es un bien físico único, no fungible;
  alcanza con `sucursal_id` + auditoría `modificado_por`/`modificado_en`
  (caso borde 4 del módulo).
- Los tests de este módulo siguen el mismo criterio que Identidad/
  Suscripción: pegan contra Supabase Cloud real, limpian explícitamente en
  `afterAll` (incluye borrar `pagos_pasivo` por cada `pasivo_id` antes de
  borrar los pasivos, por el orden de las FK).

## Última actualización: 2026-07-14 — FK real `activos.proveedor_id -> proveedores.id` cerrada (migración 0016)
