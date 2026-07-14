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
- [ ] Pre-carga automática de `CategoriaGasto` al crear el tenant (sección
      1.2) **fuera de esta tarea** — no hay onboarding UI todavía; se
      expone `sembrarCategoriasGastoDefault(tenantId)` lista para
      invocarse, mismo criterio que `CanalVenta` en Ventas.
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

## Última actualización: 2026-07-14 — Módulo 7 (Financiero) agregó agregados de período de solo lectura (`consultarPagosGastoEnPeriodo`/`consultarTotalGastosEnPeriodo`)
