# ANCLA — Módulo: Egresos y Gastos

## Contrato (no romper sin actualizar este archivo)
- Responsabilidad: todo gasto que **no es** costo de producción de un
  producto vendido ni compra de insumo/reventa — fijo, variable no
  productivo, o único. Recibe automáticamente la cuota de un Pasivo
  (Patrimonio) y la comisión de una Venta (Ventas), sin reingreso manual.
- NO hace: nunca recibe compras de insumo/reventa (van directo de Proveedores
  a Financiero) ni el costo operativo/COGS de un producto (viaja congelado
  en la Venta hacia Financiero) — regla de los tres flujos de dinero (v3).
- Entradas que consume: `tienePermiso()` de Identidad (gate por
  `"costos_gastos"` × acción — **ya existía** en el catálogo de Identidad,
  sin cambios de enum). `registrarPagoPasivo()` de Patrimonio (Módulo 5,
  con `origen: "automatico"`) y `fichaVenta()` de Ventas (Módulo 3) — ambos
  caja negra vía `actions.ts`, **wiring real, no stubs**. `tenants`/
  `sucursales` de Identidad y `proveedores` de Proveedores para FKs
  (dirección esperada). **Reutiliza el enum `frecuencia_cuota` de
  Patrimonio** (import directo del tipo Postgres, no una copia).
- Salidas que expone (`actions.ts`): CRUD de `CategoriaGasto`/
  `GastoRecurrente` + `crearGastoManual`, `actualizarGastoManual`,
  `eliminarGastoManual`, `registrarPagoGasto`, `listarGastos`, `fichaGasto`
  + `generarGastoCuotaPasivo`, `generarGastoComisionVenta`,
  `generarGastoDesdeRecurrente` + `consultarTotalCostosFijos`,
  `consultarDistribucionPorCategoria` + `consultarPagosGastoEnPeriodo`,
  `consultarTotalGastosEnPeriodo` (agregados de solo lectura por período,
  agregados en Módulo 7 para que Financiero consuma Gastos sin importar
  `gastos`/`pagos_gasto` directo).

## Estado actual
- [x] Schema Drizzle (`categorias_gasto_sugeridas`, `categorias_gasto`,
      `gastos_recurrentes`, `gastos`, `pagos_gasto`) + RLS (`crudPolicy()`
      en las tablas con `tenant_id` directo; policy vía subquery en
      `pagos_gasto`; policy de solo `select` para `categorias_gasto_sugeridas`,
      mismo patrón que Módulo 2). `gastos.proveedor_id` tiene **FK real** a
      `proveedores.id` (Proveedores ya existía al construir este módulo, a
      diferencia de `activo.proveedor_id` en Patrimonio).
- [x] **`generarGastoCuotaPasivo` cierra un pendiente real de Patrimonio**:
      crea el `Gasto`+`Pago de Gasto` (nace pagado, regla 6) y llama de
      verdad a `registrarPagoPasivo(..., origen: "automatico")` —
      decrementa el saldo real del Pasivo. Verificado con test que confirma
      el saldo antes/después.
- [x] **`generarGastoComisionVenta` cierra un pendiente real de Ventas**:
      lee `comisionMontoCalculado` vía `fichaVenta()` y crea el `Gasto` ya
      pagado con ese monto exacto.
- [x] Regla 2 / caso borde 1: `actualizarGastoManual`/`eliminarGastoManual`
      rechazan sobre cualquier gasto de `origen ≠ manual` — verificado
      contra un gasto real generado por `generarGastoCuotaPasivo`.
- [x] Caso borde 6: `actualizarGastoManual` rechaza bajar `monto` por debajo
      de lo ya pagado (`Σ Pago de Gasto`).
- [x] `generarGastoDesdeRecurrente` genera un `Gasto` con `origen="manual"`
      (editable individualmente, decisión del plan — ver abajo),
      referenciando el `GastoRecurrente` vía `referencia_id`. Desactivar el
      recurrente no borra el historial ya generado (caso borde 3) y bloquea
      la generación de nuevos gastos desde esa plantilla.
- [x] `consultarTotalCostosFijos`/`consultarDistribucionPorCategoria`
      (sección 2) listos para Simulaciones/Reportes cuando existan.
- [x] Tests: `gastos.test.ts` (integración contra Supabase Cloud real, 8
      casos de la prueba de caja negra, incluyendo las dos integraciones
      cruzadas reales).
- [x] Pre-carga automática de `CategoriaGasto` al crear el tenant (sección
      1.2) — **conectada el 2026-07-22** (DA-01 de `docs/deuda-aplazada.md`).
      `sembrarCategoriasGastoDefault()` llevaba ~8 días expuesta con cero
      llamadores; el motivo original del aplazamiento ("no hay onboarding UI
      todavía") ya no era cierto. Se invoca desde **la capa de composición**,
      no desde Identidad: `crearTenantAction`
      (`src/app/admin/(shell)/tenants/actions.ts`, el alta real) y
      `scripts/seed-tenant.ts`, que llama a `crearTenant()` directo sin pasar
      por esa Server Action. **No se puso dentro de `crearTenant()`** porque
      este módulo ya importa Identidad (`tienePermiso`) y hacerlo cerraría un
      ciclo entre dos cajas negras. En el alta real la siembra **no aborta el
      alta si falla** (el tenant y el usuario de Auth ya existen y no se
      pueden revertir); en el script sí corta, porque ahí sí se puede
      reintentar. La función sigue **sin dedupe** a propósito: se asume una
      sola invocación por tenant, y hoy los dos llamadores son mutuamente
      excluyentes.
- [ ] Sin scheduler real para `GastoRecurrente` ni para la cuota periódica
      de un Pasivo — ambas funciones de auto-generación existen y funcionan
      de verdad si se invocan, pero nada las dispara periódicamente todavía
      (mismo gap ya documentado en Patrimonio/Ventas/Módulo 6).
- [ ] `estado_pago_gasto` es un enum local, **no reutilizado** de
      `estado_pago_venta`/`estado_pago_compra` — mismo criterio que esos dos
      (cada módulo define el suyo, decisión distinta de la de
      `frecuencia_cuota`, ver decisiones abajo).

## Dónde está cada cosa
- Esquema de BD (Drizzle): `src/modules/gastos/schema.ts`
- Repository: `src/modules/gastos/repository.ts`
- Server actions: `src/modules/gastos/actions.ts`
- Tests: `src/modules/gastos/gastos.test.ts`
- Migración relevante: `drizzle/migrations/0015` (tablas + RLS, todo en una
  sola migración — reutiliza el tipo `frecuencia_cuota` ya existente, no
  genera un `CREATE TYPE` nuevo para eso).

## Decisiones tomadas que un agente no debe revertir
- **`gastos_recurrentes.frecuencia` reutiliza `frecuenciaCuotaEnum` de
  `patrimonio/schema.ts`** (import directo), en vez de duplicar los mismos
  4 valores en un enum local — decisión invitada explícitamente por el
  propio `ANCLA.md` de Patrimonio ("decidir si reutiliza este enum... no
  asumir que ya está resuelto"). Si se agrega un valor nuevo a este enum en
  el futuro, afecta a AMBOS módulos (`ALTER TYPE` aislado, mismo patrón que
  siempre) — no asumir que es un enum privado de Gastos.
- **`generarGastoComisionVenta` recibe `categoriaId` como parámetro
  obligatorio** — no autogenera ni busca una categoría reservada
  "Comisiones". El doc no especifica qué categoría usar; inventar una regla
  de negocio no pedida (nombre fijo, autocreación) se descartó a propósito.
- **Los gastos generados desde `GastoRecurrente` llevan `origen="manual"`**,
  no un cuarto valor de enum — decisión del plan de esta tarea: a
  diferencia de la cuota de pasivo o la comisión de venta (que sí
  representan una transacción ya registrada en otro módulo, con su propia
  fuente de verdad), un gasto recurrente como el alquiler puede necesitar
  una corrección puntual de un mes específico sin tocar la plantilla — se
  comporta como cualquier gasto manual editable (regla 3), y por eso
  también sigue el ciclo normal de `Pago de Gasto` (no nace pagado).
- **`generarGastoCuotaPasivo`/`generarGastoComisionVenta` reciben el
  monto/pasivoId/ventaId ya resueltos por el llamador** — no intentan
  releer todos los datos desde Patrimonio/Ventas internamente, porque
  ninguno de los dos expone una consulta pública de "un Pasivo individual
  por id" (`consultarPasivoDeActivo` es por `activoId`, no por `pasivoId`).
  El llamador ya tuvo que consultar el módulo de origen antes.
- **`registrarPagoGasto` rechaza sobre gastos de origen automático** — no
  está explícitamente prohibido por el doc, pero es coherente con la regla
  6 (ya nacen pagados por el monto completo) y con la regla 2 (no se toca
  nada de un gasto automático fuera de su módulo de origen).
- Los tests de integración corren contra el Supabase Cloud de desarrollo
  real (rol `postgres`, bypassea RLS), mismo criterio que los demás
  módulos. `testTimeout: 20000` para todo el archivo (`vi.setConfig`),
  mismo motivo que Módulo 3 — varias operaciones encadenan transacciones
  propias más una llamada cross-módulo real.

## Última actualización: 2026-07-17 — Tanda de UI completa: Egresos y Gastos, 6/6 pantallas
Módulo cerrado end-to-end. Sin gaps de backend — se confirmó antes de construir que todos los
wrappers públicos necesarios ya existían (`listarGastos`, `fichaGasto`, CRUD de
Gasto/CategoriaGasto/GastoRecurrente, `registrarPagoGasto`, `generarGastoDesdeRecurrente`). Ningún
cambio de contrato en `actions.ts`/`repository.ts`.

UI: `src/app/app/(shell)/gastos/` — Listado con 3 filtros client-side, Ficha con banner real de
bloqueo para gastos de origen automático (regla 3.2), `GastoForm` compartido (Alta/Editar,
`src/components/shared/gasto-form.tsx`) con Tipo bloqueado en modo Editar, Registrar Pago (mismo
patrón que Pasivo/Compra, saldo ya resuelto por `fichaGasto()`), Gestión de Categorías (Dialog,
mismo patrón que Productos + selector opcional de categoría sugerida), Gestión de Gastos
Recurrentes (stat strip + grid, "Próx. fecha"/"Proyección mensual" son cálculo puro de cliente,
no tocan el backend — el módulo sigue sin scheduler real).

**Bug real encontrado y corregido en la capa de Server Actions de ruta**
(`src/app/app/(shell)/gastos/actions.ts`): el formulario enviaba `sucursalId`/`proveedorId`
(columnas `uuid`) y `fechaFin` (columna `date`) como string vacío `""` en vez de `undefined`
cuando el campo quedaba sin completar — Postgres rechazaba el insert
(`invalid input syntax for type uuid: ""`). Mismo patrón de fix que ya usa
`src/app/app/(shell)/proveedores/actions.ts` para `proveedorId` opcional en Compra
(`campo || undefined` antes de llamar al módulo) — aplicado ahora también a
`crearGastoAction`/`actualizarGastoAction`/`crearGastoRecurrenteAction`/
`actualizarGastoRecurrenteAction`.

QA de esta tanda dejó una plantilla de `GastoRecurrente` desactivada como artefacto residual
inevitable: el módulo no expone ninguna acción de "reactivar" ni "eliminar" para
`GastoRecurrente` (por diseño, ver "Caso borde 3" arriba — desactivar es la única forma de
"remover" una plantilla), así que no había manera de limpiarla por completo sin inventar una
acción nueva no pedida. Queda pausada, sin efecto (no genera gastos), con una categoría que ya no
existe (soft-deleted) — cae al fallback "Sin categoría" en la UI si algún día se lista de nuevo.
Detalle completo de decisiones: `docs/ui/pantallas.md` sección 8.

## Última actualización anterior: 2026-07-14 — Módulo 7 (Financiero) agregó agregados de período de solo lectura (`consultarPagosGastoEnPeriodo`/`consultarTotalGastosEnPeriodo`)
