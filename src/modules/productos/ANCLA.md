# ANCLA — Módulo: Productos e Inventario

## Contrato (no romper sin actualizar este archivo)
- Responsabilidad: es la única fuente de verdad de todo producto vendible —
  su ficha, su precio (siempre decisión del Owner/rol con permiso, nunca
  calculado), y su stock de producto terminado por sucursal.
- NO hace: no modela recetas, insumos ni procesos de producción (eso es
  Inventario Operativo/Operaciones, Módulo 6). No calcula costo operativo —
  solo lo recibe ya calculado (Nicho, Proveedores, o carga manual). Nunca
  decide el precio de venta a partir de un costo.
- Entradas que consume: `tienePermiso()`/`tieneCapacidadEspecial()` de
  `identidad/actions.ts` (gate real por `"productos"`/`"inventario"` ×
  acción, y por la capacidad especial `"vender_sin_stock"` — ambos ya
  existían en el catálogo de Identidad desde Módulo 1, no se tocó su enum).
  `tenants`/`sucursales` de `identidad/schema.ts` para las FK de
  `tenant_id`/`sucursal_id` (patrón esperado). Eventos de otros módulos
  (Módulo Operativo, Proveedores, Ventas) que hoy **nadie dispara todavía**
  — ver pendientes abajo.
- Salidas que expone (`actions.ts`): `consultarStock`, `consultarPrecioVenta`,
  `consultarCostoOperativo`, `enviarProductoAOperaciones` (contrato de
  Modulo_02 sección 3) + CRUD de catálogo (`crearCategoria`,
  `actualizarCategoria`, `eliminarCategoria`, `listarCategorias`,
  `listarCategoriasSugeridas`, `crearCategoriaSugerida`,
  `desactivarCategoriaSugerida`, `crearProducto`, `actualizarProducto`,
  `eliminarProducto`, `listarProductos`, `fichaProducto`,
  `configurarStockMinimo`) + entradas de ledger (`registrarEntradaProduccion`,
  `registrarEntradaCompraReventa`, `registrarAjusteManualStock`,
  `descontarStockVenta`, `registrarTransferenciaStock`) + `signoMovimiento()`
  pura, exportada.

## Estado actual
- [x] Schema Drizzle (`categorias_producto`, `categorias_sugeridas`,
      `productos`, `stock`, `movimientos_stock`) + RLS (`crudPolicy()` en
      `categorias_producto`/`productos`; policy vía subquery a
      `productos.tenant_id` en `stock`/`movimientos_stock`, mismo patrón que
      `pagos_compra`/`compras_ajuste` en Proveedores; policy de solo
      `select` para `authenticated` en `categorias_sugeridas`, mismo patrón
      que `planes` en Suscripción).
- [x] `repository.ts` + `actions.ts` con el contrato completo, gateado por
      `tienePermiso()`/`tieneCapacidadEspecial()` reales. Sin cambios al
      enum `modulo_permiso` de Identidad — `"productos"` e `"inventario"`
      ya estaban en el catálogo original de Módulo 1, y
      `"vender_sin_stock"` ya estaba en `capacidad_especial`.
- [x] `cantidad_actual` de `stock` se recalcula desde `movimientos_stock`
      (ledger append-only) dentro de la misma transacción que crea cada
      movimiento — nunca se edita a mano. `signoMovimiento()` (pura,
      exportada desde `repository.ts` y re-exportada en `actions.ts`) es la
      única fuente de verdad de qué tipos suman y cuáles restan.
- [x] Transferencia entre sucursales genera el par de movimientos
      (`salida_transferencia`/`entrada_transferencia`) con el mismo
      `referencia_id`, en una sola transacción.
- [x] `descontarStockVenta` bloquea por stock insuficiente salvo capacidad
      especial `vender_sin_stock` (regla 4). `registrarTransferenciaStock`
      **no** tiene esa excepción — bloquea siempre si no alcanza el stock de
      origen (decisión propia de este módulo, el doc no lo cubre
      explícitamente para transferencias).
- [x] `eliminarProducto` con stock positivo exige `confirmarConStock: true`
      explícito (caso borde 1).
- [x] `enviarProductoAOperaciones` ("Vincular a proceso operativo", sección
      4.3) es la única vía para que `tipo_origen_producto` pase a
      `produccion_nicho` — `crearProducto`/`actualizarProducto` lo rechazan
      directamente (tipado: `Exclude<TipoOrigenProducto, "produccion_nicho">`
      en `DatosProducto`). Una vez `produccion_nicho`, `actualizarProducto`
      rechaza ediciones manuales de `costo_operativo_vigente` (regla 2).
- [x] Tests: `signo-movimiento.test.ts` (puro) + `productos.test.ts`
      (integración contra Supabase Cloud real, "modo punto de venta puro,
      sin Nicho" — roadmap ítem #5).
- [ ] `enviarProductoAOperaciones` **no valida que el tenant tenga un Nicho
      activo** — Identidad no expone hoy una consulta pública de
      `tenants.nicho_id` (su `actions.ts` no tiene un `obtenerTenant`), y
      agregarla es un cambio de contrato de Identidad que no se declaró al
      empezar esta tarea. Queda documentado, no silencioso.
- [x] `registrarEntradaProduccion` **ya tiene caller real**: Módulo 6
      (`src/modules/operativo/nichos/nicho-1/`) lo llama desde
      `registrarProduccion()` al confirmar un lote — primera integración
      cross-módulo real del proyecto vía `actions.ts` (además del
      `plan_id`/FK de Identidad-Suscripción). Ver el gap de atomicidad
      cruzada documentado en `src/modules/operativo/nichos/nicho-1/ANCLA.md`.
- [ ] `registrarEntradaCompraReventa`, `descontarStockVenta` siguen **sin
      caller real** — Proveedores (evento `compra_registrada`) y Ventas no
      disparan nada todavía. Mismo criterio que `compra_registrada` quedó
      documentado en Proveedores.
- [ ] `compras.item_id` (Proveedores) **sigue sin FK** a `productos.id` —
      decisión deliberada de esta tarea, no un olvido: un FK directo solo
      cubriría `tipo = "reventa"`, no `tipo = "insumo"` (que apunta a Insumo,
      Módulo 6, inexistente). Cerrar ese FK parcialmente se descartó por no
      resolver el caso completo; se revisa cuando exista Módulo 6.
- [ ] Categorías sugeridas: no hay set inicial cargado (el doc no lo exige
      para el MVP) — el catálogo queda vacío hasta que alguien con
      `ROL_CEOM_ADMIN_ID` cargue sugerencias.

## Dónde está cada cosa
- Esquema de BD (Drizzle): `src/modules/productos/schema.ts`
- Repository: `src/modules/productos/repository.ts`
- Server actions: `src/modules/productos/actions.ts`
- Tests: `src/modules/productos/signo-movimiento.test.ts`,
  `src/modules/productos/productos.test.ts`
- Migración relevante: `drizzle/migrations/0012` (tablas + RLS, todo en una
  sola migración — no depende de ninguna función SQL custom).

## Decisiones tomadas que un agente no debe revertir
- **Separación de permisos `"productos"` vs `"inventario"`**: catálogo y
  precio (categorías, productos, consultas de precio/costo) gateados por
  `"productos"`; movimientos de stock (ajustes, transferencias, entradas,
  descuentos, consulta de stock) gateados por `"inventario"`. Ambos valores
  ya existían en el enum `modulo_permiso` desde el diseño original de
  Módulo 1 — la separación explícita en el código es la que hace real esa
  intención del enum, que hasta ahora nadie usaba.
- **`cantidad_actual` se recalcula agregando `movimientos_stock` agrupado
  por `tipo`, no con un `CASE` en SQL crudo** — `signoMovimiento(tipo)` (en
  `repository.ts`) es la única fuente de verdad de qué tipos suman/restan;
  si se agrega un tipo nuevo al enum `tipo_movimiento_stock`, hay que
  sumarlo también a `TIPOS_ENTRADA` en `repository.ts` o el signo por
  defecto (resta) puede quedar mal para ese tipo nuevo.
- **`registrarAjusteManualStock` valida `motivo` en `actions.ts`, no como
  constraint de DB** — mismo criterio que `Compra de Ajuste` en Proveedores.
- **`categorias_sugeridas.nicho_id` sin FK** — mismo criterio que
  `tenants.nicho_id`/`planes.nicho_id`: el módulo de Nicho no existe
  todavía. Revisar los tres juntos cuando se construya.
- **`configurarStockMinimo` no estaba en la lista de "salidas que expone"
  del doc (sección 3)** — se agregó porque `stock_minimo` es un campo real
  del schema (sección 2.4) y no existía ninguna otra forma de cargarlo. No
  crea movimiento ni toca `cantidad_actual`, solo el umbral de alerta.
- **Owner y `tieneCapacidadEspecial()`**: a diferencia de `tienePermiso()`
  (que el Owner bypassea vía `esOwner`), `tieneCapacidadEspecial()` no tiene
  ese bypass — ni el Owner tiene `vender_sin_stock` habilitado por defecto,
  hay que otorgárselo explícitamente vía `permisos_especiales_por_usuario`
  o `permisos_especiales_por_rol`, igual que a cualquier otro usuario (ver
  `productos.test.ts`, caso "regla 4").
- Los tests de integración corren contra el Supabase Cloud de desarrollo
  real (rol `postgres`, bypassea RLS), mismo criterio que los otros tres
  módulos. Dos tests (`vender_sin_stock` y transferencia) necesitan
  `20000`ms de timeout explícito — hacen varias transacciones secuenciales
  y superan el default de Vitest (5000ms) contra la latencia real de red.

## Última actualización: 2026-07-14 — Módulo 6 (Operativo Nicho 1) conectó `registrarEntradaProduccion` como caller real (Fase 1)
