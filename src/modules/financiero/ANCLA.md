# ANCLA — Módulo: Financiero

## Contrato (no romper sin actualizar este archivo)
- Responsabilidad: capa de consulta/agregación pura sobre Ventas, Costos y
  Gastos, y Proveedores/Compras — combina los tres flujos de dinero
  (Compra, Costo operativo/COGS, Gasto) en `flujo_caja` (base caja) y
  `estado_resultados` (base devengado), sin duplicar ni reescribir nada.
- NO hace: **no tiene tablas propias, ni `schema.ts` ni `repository.ts`**
  (primer módulo del proyecto así) — cualquier corrección de datos ocurre en
  el módulo de origen. No calcula Punto de Equilibrio (eso es Simulaciones,
  Módulo 9) — solo expone los insumos (`costo_fijo_total`,
  `margen_por_producto`) que ese módulo necesitará.
- Entradas que consume: `tienePermiso()` de Identidad (gate por
  `"financiero"` × acción — **ya existía** en el catálogo, sin cambios de
  enum). Funciones de solo lectura de **Ventas**
  (`consultarIngresosPeriodo`, `consultarPagosVentaEnPeriodo`,
  `consultarAjustesVentaEnPeriodo`), **Gastos**
  (`consultarPagosGastoEnPeriodo`, `consultarTotalGastosEnPeriodo`,
  `consultarTotalCostosFijos`) y **Proveedores**
  (`consultarPagosCompraEnPeriodo` +
  `consultarCostoExtraAjustesCompraEnPeriodo`, esta última agregada al cerrar
  H-31) — **agregadas por período**, ver sección "Contrato tocado en 3
  módulos" abajo.
- Salidas que expone (`actions.ts`): `flujoCaja`, `estadoResultados`,
  `margenPorProducto`, `costoFijoTotal` + fórmulas puras
  (`calcularFlujoCaja`, `calcularEstadoResultados`,
  `calcularMargenPorcentaje`).

## Estado actual
- [x] `flujoCaja` = Σ Pago de Venta − Σ Pago de Compra − Σ Pago de Gasto,
      todos por `fecha_pago` (base caja). Verificado que una venta con
      `estado_pago=pendiente` **no** cuenta hasta que exista un pago real.
- [x] `estadoResultados` = ingresos − COGS − gastos ± ajustes de venta
      **− costo extra de ajustes de compra**, todos por su fecha de
      ocurrencia económica (base devengado). Verificado que una venta
      pendiente de cobro **sí** cuenta como ingreso (distinción caja vs.
      resultado, regla 3 del doc).
- [x] **H-31: el quinto término, `ajustesCompra`.** Es lo que las compras del
      período terminaron costando de MÁS de lo registrado — un costo que los
      `costo_unitario_snapshot` ya congelados no van a recoger nunca, así que
      si no resta acá no aparece en ningún lado. Llega **siempre ≥ 0** desde
      Proveedores (que agrupa por compra y descarta el neto negativo: una
      devolución o anulación baja el saldo de la compra, no sube la utilidad —
      en CEOM una compra nunca fue un gasto, entra al resultado recién como
      COGS al venderse). `calcularEstadoResultados` **vuelve a clampearlo**
      con `Math.max(0, …)`: hace estructuralmente imposible que un ajuste de
      compra le sume al resultado, pase lo que pase aguas arriba. Es la clase
      de error que ya costó H-30 y H-24 y una segunda red cuesta una línea.
      Parámetro opcional con default 0 — cualquier llamador viejo da el mismo
      número que antes.
- [x] **H-24: la comisión de canal entra por el término `gastos`**, sin
      lógica propia acá: `registrarVenta` la convierte en un `Gasto` real y
      `consultarTotalGastosEnPeriodo` la recoge sola. Financiero no cambió
      para eso — es el ejemplo de por qué el camino correcto de un costo
      nuevo es el ledger de Gastos y no un término más en esta fórmula.
- [x] `margenPorProducto` = (ingresos_ajustados − costos) ÷
      ingresos_ajustados × 100, con `AjusteVenta.monto_ajuste` sumado a los
      ingresos antes de calcular el porcentaje (decisión del plan — el doc
      no daba la fórmula exacta de cómo entra el ajuste).
- [x] `costoFijoTotal` **reutiliza directamente**
      `consultarTotalCostosFijos()` de Módulo 4 — no duplica la lógica,
      solo cambia el gate (`"financiero"` en vez de `"costos_gastos"`).
      Verificado con test que ambas funciones devuelven exactamente el
      mismo número.
- [x] Regla 3.1 del doc (devolución con dinero real genera
      automáticamente un `Pago de Venta` negativo) **ya estaba resuelta**
      desde Módulo 3 — `registrarAjusteVenta(..., generaPagoNegativo: true)`
      ya lo hacía; no hizo falta tocar nada acá.
- [x] Filtro `sucursalId` verificado en `estadoResultados` (y disponible en
      `flujoCaja`) — una venta en otra sucursal no se cuenta si se filtra
      por la primera.
- [x] Tests: `formulas.test.ts` (puro) + `financiero.test.ts` (integración
      contra Supabase Cloud real). Los dos casos de H-24/H-31 afirman
      **valores exactos calculados a mano**, no `>=`: la comisión usa una
      ventana propia (septiembre) para poder medir absolutos, y el ajuste de
      compra mide deltas exactos contra la medición inmediatamente anterior
      (no puede usar ventana propia: `compras_ajuste` se filtra por
      `creadoEn`, que el test no controla). Los dos se verificaron
      rompiéndolos a propósito — al desconectar el costo del resultado, el
      test se pone rojo.
- [ ] `AjusteVenta` no tiene un campo de fecha propio — se usa `creadoEn`
      (momento real de creación del registro, no controlable por quien
      llama a `registrarAjusteVenta`) como su fecha para el filtro de
      período. Los tests de este módulo tuvieron que ampliar su rango de
      período para cubrir la fecha real de ejecución, no solo las fechas
      ficticias de las Ventas — quedó documentado en el propio test.
- [ ] `Monitoreo Institucional`/Gateway de Consentimiento (sección 2, "hacia
      Monitoreo Institucional... filtradas por lo que el Owner haya
      aprobado") **no existe todavía** (roadmap ítems #10/#11) — las
      funciones de Financiero ya están gateadas por `tienePermiso()`, listas
      para que el Gateway las consuma cuando exista.
- [x] `margenPorProducto` — UI construida el 2026-07-17 en
      `/app/simulaciones/margen-producto` (no ruta propia de Financiero,
      mismo criterio que Flujo de Caja/Estado de Resultados: viven en
      Reportes/Simulaciones para no duplicar UI — ver
      `docs/ui/pantallas.md` sección 9). `calcularPuntoEquilibrio` de
      Simulaciones (Módulo 9) sí es un consumidor real desde el roadmap
      ítem #13, vía `costoFijoTotal`.

## Contrato tocado en 3 módulos (Ventas, Gastos, Proveedores)
Financiero necesitaba agregados por período que ningún módulo exponía
todavía — se agregaron funciones de **solo lectura**, sin tocar tablas ni
comportamiento existente, mismo patrón de gate que cada módulo ya usaba:

- **Ventas** (`src/modules/ventas/actions.ts`): `consultarIngresosPeriodo`,
  `consultarPagosVentaEnPeriodo`, `consultarAjustesVentaEnPeriodo`.
- **Gastos** (`src/modules/gastos/actions.ts`): `consultarPagosGastoEnPeriodo`,
  `consultarTotalGastosEnPeriodo` (suma TODOS los `Gasto`, a diferencia de
  `consultarTotalCostosFijos` que ya existía y solo suma `tipo=fijo`).
- **Proveedores** (`src/modules/proveedores/actions.ts`):
  `consultarPagosCompraEnPeriodo`.

## Dónde está cada cosa
- Server actions (todo el módulo — no hay `schema.ts` ni `repository.ts`):
  `src/modules/financiero/actions.ts`
- Tests: `src/modules/financiero/formulas.test.ts`,
  `src/modules/financiero/financiero.test.ts`
- Sin migración — este módulo no agrega tablas. Las tres funciones nuevas en
  otros módulos tampoco requirieron migración (son queries nuevas sobre
  tablas ya existentes).

## Decisiones tomadas que un agente no debe revertir
- **Financiero no tiene `schema.ts` ni `repository.ts`** — es la
  consecuencia directa de que el doc dice explícitamente "Financiero no
  tiene tablas propias". No crear una tabla ni un repository "por
  consistencia con el resto de módulos" — sería inventar estado que el
  propio diseño prohíbe.
- **`margenPorProducto` suma `monto_ajuste` a los ingresos brutos antes de
  calcular el %** — decisión explícita del plan (el doc no daba la fórmula
  exacta). Si en el futuro se decide otra interpretación (ej. ajustar
  proporcionalmente ingresos y costos), es un cambio de fórmula documentado,
  no un bug.
- **`consultarTotalGastosEnPeriodo` (Gastos) es distinta de
  `consultarTotalCostosFijos`** — la primera suma todos los tipos de Gasto
  (para `estado_resultados`), la segunda solo `tipo=fijo` (para
  `costo_fijo_total`, ya existía desde Módulo 4). No son la misma función
  con un alias — tienen semántica distinta.
- **`AjusteVenta` no tiene campo de fecha propio** — sus agregados de
  período en Ventas (`sumarAjustesVentaPeriodo`) usan `creado_en`. Si en el
  futuro se agrega un campo `fecha_ajuste` explícito a `ajustes_venta`, hay
  que migrar esta función también (y el test que depende de que el período
  cubra la fecha real de ejecución dejaría de ser necesario).
- Los tests de integración corren contra el Supabase Cloud de desarrollo
  real (rol `postgres`, bypassea RLS), mismo criterio que los demás
  módulos. `testTimeout: 20000` para todo el archivo, mismo motivo que
  Módulo 3/4 (varias llamadas cross-módulo encadenadas).

## Última actualización: 2026-07-14 — implementación inicial (Fase 1, Módulo 7, roadmap ítem #9)

## Última actualización: 2026-07-17 — Módulo Financiero completo a nivel de UI (3/3): Flujo de Caja/Estado de Resultados viven en Reportes, Margen por Producto vive en Simulaciones — sin ruta propia, sin cambios de contrato
