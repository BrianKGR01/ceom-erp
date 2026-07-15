# ANCLA — Módulo Operativo: Nicho 1 (Alimentos y Bebidas por Lotes)

## Contrato (no romper sin actualizar este archivo)
- Responsabilidad: implementa la interfaz "Módulo Operativo" (Strategy
  Pattern, `CEOM_Arquitectura.md` sección 5.1) para el Nicho 1 — Inventario
  Operativo (insumos), Operaciones/Producción (recetas + lotes) y Capacidad
  Operativa (solo lectura). Caso real: SanttiCampo.
- NO hace: no calcula capacidad usada con alertas automáticas (solo
  consulta, MVP). No es dueño del activo, solo lee su capacidad desde
  Patrimonio. Nunca define el precio de venta (eso siempre es Módulo 2).
- Entradas que consume: `tienePermiso()`/`tieneCapacidadEspecial()` de
  Identidad (gate por `"operativo"` × acción, y `"producir_sin_stock_insumo"`
  — ambos ya existían en el catálogo de Identidad, sin cambios de enum).
  `fichaProducto()`, `enviarProductoAOperaciones()`, `registrarEntradaProduccion()`,
  `consultarStock()` de Productos e Inventario (Módulo 2, caja negra vía
  `actions.ts`, nunca su repository). `consultarCapacidad()` de Patrimonio
  (Módulo 5, solo lectura, caja negra vía `actions.ts`). `tenants`/`sucursales`
  de Identidad y `productos`/`activos` de Módulo 2/Patrimonio para FKs
  (dirección de dependencia esperada por `CEOM_Arquitectura.md` sección 7 —
  Operaciones depende de Productos e Inventario y de Patrimonio — no es la
  excepción de caja negra documentada para `plan_id`).
- Salidas que expone (`actions.ts`): CRUD de `Insumo`/`Receta`/`Vinculación
  Producto-Receta` + ledger de Insumo (`registrarEntradaCompraInsumo`,
  `registrarAjusteManualInsumo`, `registrarMermaAlmacenamiento`) +
  `registrarProduccion`, `registrarProduccionDeAjuste`, `listarProducciones`,
  `consultarMermaPeriodo` + `consultarCapacidadProduccionUsada`,
  `consultarCapacidadAlmacenamientoUsada` + fórmulas puras
  (`calcularCostoPromedioPonderado`, `calcularRendimientoTeorico`,
  `calcularMerma`, `calcularCostoOperativoProduccion`,
  `calcularCapacidadProduccionPeriodo`, `calcularPorcentajeCapacidadUsada`,
  `signoMovimientoInsumo`).

## Estado actual
- [x] Schema Drizzle (`insumos`, `movimientos_insumo`, `stock_insumo`,
      `recetas`, `receta_insumos`, `vinculaciones_producto_receta`,
      `producciones`, `producciones_ajuste`) + RLS (`crudPolicy()` en las
      tablas con `tenant_id` directo; policy vía subquery en las demás,
      mismo patrón que Módulo 2/Proveedores).
- [x] Costo promedio ponderado real (fórmula 3.1) — se recalcula en cada
      `registrarEntradaCompraInsumo`, usando el stock ANTES de esa entrada.
- [x] `registrarProduccion` calcula costo real con merma incorporada
      (fórmula 3.2), bloquea sin vinculación (regla 3.4) y sin insumo
      suficiente salvo `producir_sin_stock_insumo` (regla 3.5), auto-calcula
      `fecha_vencimiento_lote` desde `vida_util_dias` del producto (sección
      3.6) — **y acredita de verdad el stock/costo en Productos e
      Inventario** vía `registrarEntradaProduccion()` (Módulo 2). No es un
      stub: es la primera integración cross-módulo real del proyecto además
      del `plan_id`/FK de Identidad-Suscripción.
- [x] `vincularProductoAReceta` hace en un solo paso lo que el doc describe
      como "Vincular a proceso operativo": valida el producto vía
      `fichaProducto()`, llama a `enviarProductoAOperaciones()` de Módulo 2
      (pasa `tipo_origen_producto` a `produccion_nicho`), y recién ahí crea
      la fila de vinculación.
- [x] `consultarCapacidadProduccionUsada`/`Almacenamiento` (sección 4) leen
      `consultarCapacidad()` de Patrimonio + actividad real propia.
      Almacenamiento deriva qué productos se guardaron en un Activo desde el
      historial de `producciones` (decisión de esta tarea — Productos e
      Inventario no sabe nada de Activos, no había otro cruce posible sin
      tocar su contrato).
- [x] Tests: `formulas.test.ts` (puro, 6 fórmulas) + `operativo-nicho1.test.ts`
      (integración contra Supabase Cloud real, caso SanttiCampo).
- [ ] **Gap de atomicidad cruzada, aceptado a propósito** (decidido en el
      plan de esta tarea): `registrarProduccion` descuenta insumos y crea la
      `Producción` en una sola transacción propia, pero la llamada a
      `registrarEntradaProduccion()` de Módulo 2 ocurre DESPUÉS, fuera de
      esa transacción — cada módulo es una caja negra, no comparten el
      objeto de transacción de Drizzle. Si esa llamada falla, el stock de
      insumo ya quedó descontado sin que el producto terminado se acredite.
      No hay compensación automática; el resultado de `registrarProduccion`
      expone `acreditacionProductos` (`{ok, error}`) para que el caller
      pueda detectarlo y reintentar a mano. Mismo criterio que el usuario
      huérfano de Supabase Auth en Identidad.
- [x] `registrarEntradaCompraInsumo` **ya tiene caller real (roadmap ítem
      #12)** — `registrarCompra()`/`recibirCompra()` de Proveedores lo
      llaman de verdad cuando una Compra `tipo="insumo"` llega a
      `estado="recibido"`. Ver `proveedores/ANCLA.md`.
- [ ] `Movimiento de Insumo.costo_unitario_en_movimiento` para
      `entrada_ajuste_manual`/`salida_ajuste_manual`/`salida_merma_almacenamiento`
      usa `insumo.costo_unitario_vigente` (o `0` si nunca hubo compra) como
      mejor estimación disponible — el doc no especifica qué costo usar en
      esos tipos de movimiento fuera de `entrada_compra`/`salida_producción`.
- [ ] `vinculaciones_producto_receta` no tiene un constraint de "un producto
      = una vinculación activa a la vez" a nivel de DB — se confía en que
      `vincularProductoAReceta`/`obtenerVinculacionPorProducto` lo traten
      como tal en la práctica; revisar si hace falta un índice único parcial
      cuando se construya la UI.

## Dónde está cada cosa
- Esquema de BD (Drizzle): `src/modules/operativo/nichos/nicho-1/schema.ts`
- Repository: `src/modules/operativo/nichos/nicho-1/repository.ts`
- Server actions: `src/modules/operativo/nichos/nicho-1/actions.ts`
- Tests: `src/modules/operativo/nichos/nicho-1/formulas.test.ts`,
  `src/modules/operativo/nichos/nicho-1/operativo-nicho1.test.ts`
- Migración relevante: `drizzle/migrations/0013` (tablas + RLS, todo en una
  sola migración).

## Decisiones tomadas que un agente no debe revertir
- **Ubicación fuera de `src/modules/<módulo>/` plano** — vive en
  `src/modules/operativo/nichos/nicho-1/`, tal como fija `AGENTS.md` regla 1
  ("Esa lógica vive solo en `src/modules/operativo/nichos/<nicho>/`"). Si se
  construye Nicho 4 (roadmap ítem #12), va en
  `src/modules/operativo/nichos/nicho-4/`, como implementación hermana de la
  misma interfaz "Operaciones" — cualquier función pública nueva acá debería
  existir también, aunque sea como stub, en Nicho 4 (Strategy Pattern, no se
  puede romper esa simetría sin decirlo explícitamente — ver plantilla de
  `AGENTS.md` por módulo en `dev-practices.md` sección 3).
- **`costo_unitario_en_movimiento` es un snapshot por movimiento, no el
  promedio recalculado** — igual criterio que `costo_unitario` en Compras
  (Proveedores): fijo desde el momento del movimiento, nunca se recalcula
  retroactivamente. Una Producción usa siempre `costo_unitario_vigente`
  **al momento de producir** (caso borde 3) — no se recalculan producciones
  pasadas cuando cambia el costo del insumo.
- **`merma_cantidad`/`merma_costo` nunca negativos** — `calcularMerma()`
  satura en 0 (`Math.max(0, ...)`), mismo espíritu que la depreciación en
  Patrimonio.
- **`actualizarComposicionReceta` reemplaza toda la composición** (delete +
  insert en una transacción), no hay CRUD incremental de líneas — mismo
  patrón que `reemplazarPermisosRol` en Identidad.
- **`registrarProduccionDeAjuste` no revierte movimientos de stock/insumo**
  — es corrección contable/de trazabilidad únicamente (caso borde 5: puede
  haber ventas posteriores sobre ese stock). Si en el futuro se necesita
  reversión física real, es una función nueva, no una extensión de esta.
- Los tests de integración corren contra el Supabase Cloud de desarrollo
  real (rol `postgres`, bypassea RLS), mismo criterio que los demás módulos.
  Dos tests (insumo insuficiente y producción de ajuste) necesitan
  `20000`ms de timeout explícito por las mismas razones que en Módulo 2.

- **Nicho 4 (roadmap ítem #12) ya existe** en
  `src/modules/operativo/nichos/nicho-4/` — pero NO es un espejo completo:
  no tiene Insumo/Receta/Producción (ese dominio no aplica, Nicho 4 no
  produce, solo revende). La única función compartida es
  `calcularPorcentajeCapacidadUsada()` (pura), que Nicho 4 importa
  directamente desde acá en vez de duplicarla. La regla de "toda función
  pública nueva debe existir aunque sea como stub en la otra
  implementación" (sección 3 de `dev-practices.md`) no aplicó tal cual acá
  porque el dominio de ambos nichos no tiene el mismo shape — decisión
  confirmada explícitamente con el usuario antes de implementar Nicho 4, no
  un desvío silencioso.

## Última actualización: 2026-07-15 — roadmap ítem #12 (Nicho 4) conectó `registrarEntradaCompraInsumo` como caller real; Nicho 4 reutiliza `calcularPorcentajeCapacidadUsada()`
