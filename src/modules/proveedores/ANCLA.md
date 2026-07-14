# ANCLA — Módulo: Proveedores / Compras

## Contrato (no romper sin actualizar este archivo)
- Responsabilidad: es dueño de `Proveedor`, `Compra`, `Pago de Compra` y
  `Compra de Ajuste` — el punto de entrada de datos para todo lo que el
  negocio le compra a terceros (insumo o reventa directa).
- NO hace: no decide el costo operativo de un producto terminado (eso es
  el Módulo Operativo de Nicho). No es un gasto operativo (Costos y
  Gastos, Módulo 4) ni un costo de venta (Ventas/Financiero vía COGS). No
  dispara el evento `compra_registrada` hacia Inventario Operativo/
  Productos e Inventario/Financiero — ninguno de esos módulos existe
  todavía, así que nadie lo consume; el dato queda listo en `compras`
  para cuando se construyan. Landed Cost y Órdenes de Compra formales
  quedan explícitamente fuera (funcionalidad futura de Nicho 4, sección 6
  del propio módulo — hay una "dirección de diseño" esbozada ahí, no una
  implementación).
- Entradas que consume: `tienePermiso()` de `identidad/actions.ts` (gate
  real por `"proveedores"` × acción). `tenants`/`sucursales` de
  `identidad/schema.ts` para las FK de `tenant_id`/`sucursal_id` (patrón
  esperado).
- Salidas que expone (`actions.ts`): `crearProveedor`, `actualizarProveedor`,
  `eliminarProveedor`, `listarProveedores`, `fichaProveedor`,
  `registrarCompra` (+ `calcularCostoUnitario()` pura, exportada),
  `historialPrecio`, `registrarPagoCompra`, `registrarCompraDeAjuste`.

## Estado actual
- [x] Schema Drizzle (`proveedores`, `compras`, `pagos_compra`,
      `compras_ajuste`) + RLS (`crudPolicy()` en las dos primeras, policy
      a mano en las otras dos por no ser tenant-scoped directas).
- [x] `"proveedores"` agregado a `modulo_permiso` (enum de Identidad) —
      migración propia y aislada (`ALTER TYPE ... ADD VALUE` no puede
      compartir transacción con otro DDL).
- [x] `repository.ts` + `actions.ts` con el contrato completo, gateado por
      `tienePermiso()` real.
- [x] `costo_unitario` calculado una vez al crear (no recalculado bajo
      demanda, a diferencia de `valor_actual`/`saldo_pendiente` en
      Patrimonio — ver decisiones abajo). `estado_pago` transiciona
      pendiente→parcial→pagado dentro de `registrarPagoCompra`.
- [x] Tests: `costo-unitario.test.ts` (puro) + `proveedores.test.ts`
      (integración contra Supabase Cloud real).
- [ ] `item_id` sin FK — Insumo (Módulo 6) y Producto (Módulo 2) no
      existen todavía.
- [ ] Evento `compra_registrada` no se dispara a ningún lado — nadie lo
      consume aún.
- [ ] Landed Cost / Órdenes de Compra formales (Nicho 4) — fuera de
      alcance, ver sección 6 del documento del módulo.

## Dónde está cada cosa
- Esquema de BD (Drizzle): `src/modules/proveedores/schema.ts`
- Repository: `src/modules/proveedores/repository.ts`
- Server actions: `src/modules/proveedores/actions.ts`
- Tests: `src/modules/proveedores/costo-unitario.test.ts`,
  `src/modules/proveedores/proveedores.test.ts`
- Migraciones relevantes: `drizzle/migrations/0010` (solo
  `ALTER TYPE modulo_permiso ADD VALUE 'proveedores'`, aislada a
  propósito), `0011` (tablas + RLS de este módulo).

## Decisiones tomadas que un agente no debe revertir
- **`"proveedores"` se agregó al enum `modulo_permiso`** (antes solo
  productos/inventario/ventas/costos_gastos/patrimonio/operativo/
  financiero/simulaciones/reportes). A diferencia de "identidad" (que
  deliberadamente queda fuera de esa matriz porque es la base de todos),
  Proveedores/Compras es un módulo de negocio corriente y necesitaba el
  gate fino — mismo criterio que ya se usó para "patrimonio". Es un
  cambio de contrato de Identidad, documentado también en su `ANCLA.md`.
- **La migración que agrega el valor al enum va sola**, sin ninguna otra
  sentencia DDL en el mismo archivo — Postgres no permite usar (ni
  mezclar con otro DDL) un valor de enum recién agregado en la misma
  transacción en que se agregó. Si se necesita agregar otro valor al
  enum en el futuro, repetir este mismo patrón de migración aislada.
- **`costo_unitario` es una columna persistida, no un cálculo bajo
  demanda** — a diferencia de `valor_actual`/`saldo_pendiente` en
  Patrimonio, `monto_total ÷ cantidad` no cambia con el paso del tiempo:
  es fijo desde el momento en que se registra la Compra (las correcciones
  van por `Compra de Ajuste`, la `Compra` nunca se edita directamente).
- **`estado_pago` (Compra) es una columna que se recalcula** dentro de la
  transacción de `registrarPagoCompra()` — mismo patrón que
  `pasivo.estado` en Patrimonio, pero con tres estados en vez de dos
  (`pendiente`/`parcial`/`pagado`).
- **`proveedor_id` en `Compra` es nullable a propósito** (sección 3.4):
  compras informales sin proveedor fijo no fuerzan dar de alta un
  proveedor.
- Los tests siguen el mismo criterio que Identidad/Suscripción/Patrimonio:
  Supabase Cloud real, `describe.skipIf` sin credenciales, limpieza
  explícita en `afterAll` (orden: `compras_ajuste`/`pagos_compra` antes
  que `compras`, por las FK).

## Última actualización: 2026-07-14 — implementación inicial (Fase 1, Módulo 8)
