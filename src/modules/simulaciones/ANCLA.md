# ANCLA — Módulo: Simulaciones (Simular Precio + Punto de Equilibrio)

## Contrato (no romper sin actualizar este archivo)
- Responsabilidad: Simular Precio y Punto de Equilibrio, fusionados bajo un
  mismo módulo con un único motor matemático (`unidadesParaCubrir`, sección
  2.3 del doc). Se apoya casi enteramente en datos ya existentes en Ventas,
  Productos y Financiero — solo posee el historial de simulaciones y su
  propia configuración de umbral (sección 1.5, regla 1).
- NO hace: nunca calcula el costo por su cuenta cuando es automático (lo
  toma de Productos e Inventario). El ajuste manual de costo en una
  simulación **nunca persiste** ni modifica el costo real del producto
  (regla 3.3). **Nunca escribe en otro módulo** (regla 4) — ninguna función
  de acá llama a `actualizarProducto()`.
- Entradas que consume: `tienePermiso()` de Identidad (gate por
  `"simulaciones"` × acción — ya existía en el catálogo original de Módulo
  1, sin cambios de enum). `consultarCostoOperativo`/`consultarPrecioVenta`/
  `listarProductos` (Productos e Inventario), `consultarUnidadesVendidas-
  Periodo` (Ventas, **nueva en esta tarea**), `costoFijoTotal`/
  `calcularMargenPorcentaje` (Financiero, la segunda pura y reutilizada, no
  duplicada) — todo caja negra vía `actions.ts`.
- Salidas que expone (`actions.ts`): `simularPrecio`, `calcularPunto-
  Equilibrio`, `comparativoMultiSku`, `obtenerConfiguracion`,
  `actualizarUmbralAlerta`, `listarSimulaciones` + fórmulas puras
  (`calcularPrecioSugerido`, `calcularImpactoProyectado`,
  `calcularMargenContribucionUnitario`, `unidadesParaCubrir`).

## Estado actual
- [x] Schema Drizzle (`configuracion_simulaciones`, `simulaciones`) + RLS
      (`crudPolicy()` en ambas). `configuracion_simulaciones.tenant_id` **es
      la PK** (una fila por tenant, tal como lo especifica el doc, no un
      uuid separado). `simulaciones` **sin `eliminado_en`** a propósito —
      doc explícito: "no se corrige, se acumulan más simulaciones".
- [x] `repository.ts` + `actions.ts` con el contrato completo, gateado por
      `tienePermiso()` real.
- [x] `unidadesParaCubrir()` — el único motor genérico (sección 2.3):
      `montoACubrir / margenContribucionUnitario`, `null` si el margen no
      es positivo (caso borde 2), en vez de un número infinito/negativo sin
      sentido.
- [x] `simularPrecio`: costo automático por defecto (nunca manual por
      defecto — lección explícita del prototipo anterior que el doc
      corrige), rotación real vía `consultarUnidadesVendidasPeriodo`
      (Ventas, nueva). Caso borde 1 (sin ventas del producto):
      `impactoProyectadoBs: null`, sin pedir estimación manual.
- [x] `calcularPuntoEquilibrio`: reutiliza `costoFijoTotal` de Financiero.
      Caso borde 2 (margen de contribución ≤0): `puntoEquilibrioUnidades:
      null` + `advertencia` en lenguaje simple. Caso borde 3 (costo fijo en
      0 → resultado 0) no necesitó código especial, es válido matemáticamente.
- [x] `comparativoMultiSku`: **decisión confirmada con el usuario** (el doc
      no especifica de dónde sale el margen objetivo por fila, a diferencia
      de `simularPrecio` que sí lo pide como input) — usa el margen %
      **promedio del catálogo** como objetivo para `precioSugerido` de cada
      fila, coherente con que el umbral de alerta ya compara cada margen
      contra ese mismo promedio. Productos con `costoOperativoVigente=null`
      se excluyen del promedio y de la alerta.
- [x] Tests: `formulas.test.ts` (puro, 4 fórmulas + casos borde 2/3) +
      `simulaciones.test.ts` (integración contra Supabase Cloud real, 7
      casos: rotación real, sin ventas, costo manual sin persistir,
      punto de equilibrio normal, comparativo con alerta, umbral editable,
      margen de contribución negativo).
- [x] **UI real** (`src/app/app/(shell)/simulaciones/`, route actions.ts
      propio wrapper): Simulador (Simular Precio + Punto de Equilibrio en
      tabs, con mockup), Comparativo Multi-SKU (con mockup, umbral editable
      vía Dialog lanzado desde la propia pantalla), Historial de
      Simulaciones (sin mockup). Módulo 13 completo, 5/5 pantallas — ver
      `docs/ui/pantallas.md` sección 13. La previa automática al elegir
      producto (Modulo_09 sección 1.1) usa una Server Action de solo
      lectura nueva a nivel de ruta (`obtenerDatosPreviaAction`,
      compone `consultarCostoOperativo`/`consultarPrecioVenta`/
      `consultarUnidadesVendidasPeriodo`/`costoFijoTotal`) — a propósito
      NO reutiliza `simularPrecio`/`calcularPuntoEquilibrio` para esto,
      porque esas dos persisten un registro en `simulaciones` cada vez que
      se llaman; llamarlas en cada cambio de producto/margen ensuciaría el
      Historial con simulaciones no deliberadas.
- [ ] Proyección de inversión en activos (reutilización de
      `unidadesParaCubrir` con `montoACubrir = valorCompra`, sección 2.3) —
      documentada como reutilización futura, no se construye acá (le
      corresponde a Patrimonio/Producción cuando se aborde la parte
      proactiva de Tuki).

## Cambio de contrato en Ventas
- **Ventas** (`src/modules/ventas/actions.ts`):
  `consultarUnidadesVendidasPeriodo(solicitante, tenantId, productoId,
  periodo, opts?)` — nueva, agregado de solo lectura por período (mismo
  patrón que `consultarIngresosPeriodo`), gateada `"ventas","ver"`. Sin
  cambios de tablas ni comportamiento existente. Ver `ventas/ANCLA.md`.

## Dónde está cada cosa
- Esquema de BD (Drizzle): `src/modules/simulaciones/schema.ts`
- Repository: `src/modules/simulaciones/repository.ts`
- Server actions: `src/modules/simulaciones/actions.ts`
- Validation (zod, UI): `src/modules/simulaciones/validation.ts`
- Tests: `src/modules/simulaciones/formulas.test.ts`,
  `src/modules/simulaciones/simulaciones.test.ts`
- Migración relevante: `drizzle/migrations/0021` (tablas + RLS, todo en una
  sola migración).
- UI: `src/app/app/(shell)/simulaciones/` (route actions.ts +
  `page.tsx`/`simulador-cliente.tsx`, `comparativo/`, `historial/`,
  `margen-producto/` — este último consume `margenPorProducto` de
  Financiero, no de este módulo, pero vive acá por decisión de UI, ver
  `docs/ui/pantallas.md` sección 9).

## Decisiones tomadas que un agente no debe revertir
- **`calcularMargenPorcentaje` de Financiero se reutiliza tratando
  precio/costo de UNA unidad como "ingresos"/"costos"** — matemáticamente
  idéntico a `(precio-costo)/precio×100`, evita duplicar la fórmula de
  margen en un tercer lugar (ya existía en Financiero y en el propio
  `margenPorProducto`).
- **`configuracion_simulaciones` usa `tenant_id` como PK directa**, no un
  `id` uuid separado — sigue el modelo de datos exacto del doc (sección
  1.5). `upsertConfiguracion()` usa `onConflictDoUpdate` sobre esa PK.
- **`obtenerConfiguracion()` no inserta una fila si no existe** — devuelve
  el default `15` en memoria. La fila recién se crea cuando el Owner llama
  `actualizarUmbralAlerta()` por primera vez. No "sembrar" una fila
  default al leer — mismo criterio de no escribir por una simple consulta.
- **`vi.setConfig` necesita `hookTimeout` además de `testTimeout`** — el
  `beforeAll` de este módulo encadena bastantes pasos (tenant + canal +
  gasto fijo + 3 productos + stock + 1 venta) y superó el `hookTimeout`
  default de Vitest (10000ms) aunque `testTimeout` ya estuviera ampliado —
  son configs independientes. Bug real encontrado durante esta tarea.
- Los tests de integración corren contra el Supabase Cloud de desarrollo
  real (rol `postgres`, bypassea RLS), mismo criterio que los demás
  módulos.

## Última actualización: 2026-07-15 — implementación inicial (Fase 1, roadmap ítem #13)

## Última actualización: 2026-07-17 — UI completa (Módulo 13, 5/5) + Financiero — Margen por Producto (Módulo 9, cierra 3/3) sumado a esta tanda; sin cambios de contrato de `actions.ts`
