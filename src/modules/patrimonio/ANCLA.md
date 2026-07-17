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
  `crearActivo`, `actualizarActivo`, `darDeBajaActivo` (firma cambió — ver
  "Actualización 2026-07-17"), `transferirActivo`,
  `crearPasivo`, `refinanciarPasivo`, `registrarPagoPasivo`,
  `listarActivos`, `obtenerActivoPorId`, `listarPasivos`,
  `obtenerPasivoPorId`, `fichaPasivo` (agregados para la UI de Patrimonio —
  ver "Última actualización").

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

## Última actualización: 2026-07-17 (2) — Tanda B de UI (Pasivos): módulo cerrado, 11/11 pantallas de negocio
Sin cambios de contrato — `pasivoFormSchema`/`registrarPagoPasivoSchema` (nuevos, en `validation.ts`)
mapean 1:1 contra `DatosPasivo`/`registrarPagoPasivo` ya existentes, a diferencia de la Tanda A
(Activos) que sí necesitó `motivoBaja`. Pantallas: Listado de Pasivos, Ficha de Pasivo (con el
historial completo de pagos que ya exponía `fichaPasivo`), Alta/Refinanciar Pasivo (mismo
componente compartido, `src/components/shared/pasivo-form.tsx` — selector de Activo relacionado
como cards, incluye "Sin activo relacionado"), Registrar pago de Pasivo (modal con resumen
saldo-antes/después en vivo).

**Dos campos de la referencia visual NO se implementaron por no existir en el modelo de datos —
no se fabricaron:**
- **"Tasa (TEA)"** en la Ficha de Pasivo — el doc del módulo (`Modulo_05_patrimonio.md` sección
  6.1) confirma explícitamente "cuota fija sin desglose de interés/capital" para el MVP.
  `cuotaPeriodica` se carga directo, nunca se deriva de una tasa.
- **"Próxima cuota"/estado "Vencido"** en el Listado de Pasivos — no hay ninguna función que
  calcule la fecha de la próxima cuota a partir de `fechaInicio`/`frecuenciaCuota`/pagos
  registrados. Si se necesita esto en el futuro, es una función pura nueva (candidata a
  `calcularProximaCuota()`, mismo criterio que `calcularValorActual()`), no algo que ya exista.

**Dónde vive la UI de esta tanda:**
- `src/app/app/(shell)/patrimonio/pasivos/page.tsx` + `pasivos-cliente.tsx` (Listado — lista, no
  cards, `docs/design-system.md` §5.5)
- `src/app/app/(shell)/patrimonio/pasivos/[id]/page.tsx` + `ficha-pasivo-cliente.tsx` (Ficha, con
  el modal de Registrar pago inline)
- `src/app/app/(shell)/patrimonio/pasivos/nuevo/` y `pasivos/[id]/refinanciar/` (Alta/Refinanciar,
  ambos delgados sobre `pasivo-form.tsx`; a diferencia de Activos, Refinanciar es una **página
  completa**, no un modal — así lo mostraba la referencia)
- `src/app/app/(shell)/patrimonio/actions.ts` ganó `crearPasivoAction`/`refinanciarPasivoAction`/
  `registrarPagoPasivoAction`
- Verificado end-to-end en navegador: alta, registrar pago (saldo recalculado en vivo y
  persistido correctamente), refinanciar (pasivo anterior queda `refinanciado` con su saldo
  congelado, el nuevo arranca `activo` sin historial). Datos de prueba soft-eliminados
  (`eliminado_en`) al cerrar.

**Módulo Patrimonio completo: 11/11 pantallas de negocio construidas y verificadas.** Único
pendiente: el widget "Valor patrimonial total" (`consultarValorPatrimonialTotal`, ya existe la
acción) — se construye junto con el Dashboard de Reportes, no como pantalla propia de este
módulo. Ver `docs/ui/pantallas.md` sección 3 para el detalle completo y sección "Próxima tanda
sugerida" para lo que sigue (Proveedores/Compras).

## Última actualización: 2026-07-17 — Tanda A de UI (Activos): `motivoBaja` (cambio de contrato aditivo)
La referencia visual de "Dar de baja Activo" pedía un motivo obligatorio — el doc del módulo
(`Modulo_05_patrimonio.md`) no lo lista, es una adenda de esta tarea, mismo criterio que el motivo
obligatorio ya existente en `registrarAjusteVenta`/`registrarAjusteManualStock` (auditoría de una
acción irreversible). Se agregó la columna `activos.motivo_baja` (nullable, migración `0026`, solo
`ALTER TABLE ADD COLUMN` — schema-driven, no SQL a mano) y `darDeBajaActivo(solicitante, activoId,
motivo)` ahora **exige el tercer parámetro** (antes solo tomaba `activoId`) — rechaza si viene
vacío. `repo.actualizarEstadoActivo()` gana un cuarto parámetro opcional `motivoBaja` para
persistirlo. **Único caller a actualizar:** `patrimonio.test.ts` (ya corregido). Pantallas de esta
tanda: Listado de Activos, Ficha de Activo, Alta/Editar Activo (mismo componente), Dar de baja
Activo, Transferir Activo — ver `docs/ui/pantallas.md` sección 3 para el detalle completo.

**Dónde vive la UI de esta tanda:**
- `src/app/app/(shell)/patrimonio/page.tsx` + `activos-cliente.tsx` (Listado)
- `src/app/app/(shell)/patrimonio/[id]/page.tsx` + `ficha-activo-cliente.tsx` (Ficha, con los
  modales de Dar de baja/Transferir inline — Dialog, no rutas aparte)
- `src/app/app/(shell)/patrimonio/nuevo/` y `[id]/editar/` (Alta/Editar, ambos delgados sobre
  `src/components/shared/activo-form.tsx`, el componente compartido real)
- `src/app/app/(shell)/patrimonio/actions.ts` (wrappers de ruta) +
  `src/modules/patrimonio/validation.ts` (nuevo — el módulo no tenía schema de formulario todavía)
- `src/components/shared/app-shell.tsx` ganó el ítem "Patrimonio" en el sidebar real (entre
  Catálogo y Mi negocio) — las imágenes de referencia de esta tanda traían sidebars
  inconsistentes entre sí, se ignoraron por completo.
- **Esto es solo la Tanda A (Activos), 6/12 del módulo.** Pasivos (Tanda B) queda pendiente — el
  backend ya está listo (`listarPasivos`/`obtenerPasivoPorId`/`fichaPasivo`, actualización
  anterior), falta la UI. No cerrar el "Cierre de tanda" completo de `pantallas.md` hasta que
  Pasivos también esté construido y verificado.
- Verificado end-to-end en navegador (alta, ficha con depreciación calculada correctamente,
  editar con precarga completa de todos los campos, transferir, dar de baja con motivo
  persistido y botones ocultos post-baja). El activo de prueba quedó soft-eliminado
  (`eliminado_en`) al cerrar — caso real de "error de carga" que ese campo ya contemplaba.

## Última actualización anterior: 2026-07-16 — Gap de backend cerrado para la próxima tanda de UI
(`docs/ui/pantallas.md` sección 3): se agregaron los wrappers públicos que faltaban en
`actions.ts` — `listarActivos`, `obtenerActivoPorId`, `listarPasivos`, `obtenerPasivoPorId`
(los cuatro gateados por `tienePermiso(..., "patrimonio", "ver")`, mismo patrón que el resto del
módulo) — antes solo existían en `repository.ts`. También se agregó `fichaPasivo`, que combina el
pasivo + `saldoPendiente` (ya existía, agregado sobre `pagos_pasivo`) + el **historial completo de
pagos** (`repo.listarPagosPorPasivo`, nuevo — antes no había ninguna función que listara
`pagos_pasivo` fila por fila, solo el agregado de saldo). Sin cambios de contrato — todo aditivo,
no se tocó ninguna función existente. Cubierto por 2 tests nuevos en `patrimonio.test.ts`.

## Última actualización anterior: 2026-07-14 — FK real `activos.proveedor_id -> proveedores.id` cerrada (migración 0016)
