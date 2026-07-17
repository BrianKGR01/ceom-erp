# ANCLA — Módulo: Proveedores / Compras

## Contrato (no romper sin actualizar este archivo)
- Responsabilidad: es dueño de `Proveedor`, `Compra`, `Pago de Compra` y
  `Compra de Ajuste` — el punto de entrada de datos para todo lo que el
  negocio le compra a terceros (insumo o reventa directa).
- NO hace: no decide el costo operativo de un producto terminado (eso es
  el Módulo Operativo de Nicho). No es un gasto operativo (Costos y
  Gastos, Módulo 4) ni un costo de venta (Ventas/Financiero vía COGS).
- Entradas que consume: `tienePermiso()` de `identidad/actions.ts` (gate
  real por `"proveedores"` × acción). `tenants`/`sucursales` de
  `identidad/schema.ts` para las FK de `tenant_id`/`sucursal_id` (patrón
  esperado). `insumos` (Módulo 6) y `productos` (Módulo 2) para las FK
  reales de `insumoId`/`productoId` (roadmap ítem #12, ver abajo).
  `registrarEntradaCompraReventa()` (Módulo 2) y
  `registrarEntradaCompraInsumo()` (Operativo Nicho 1) — caja negra vía
  `actions.ts`, disparadas al recibir una Compra.
- Salidas que expone (`actions.ts`): `crearProveedor`, `actualizarProveedor`,
  `eliminarProveedor`, `listarProveedores`, `fichaProveedor`,
  `registrarCompra` (+ `calcularCostoUnitario()` pura, exportada),
  **`recibirCompra`** (roadmap ítem #12; extendida en la tanda de UI con un
  tercer parámetro `fechaRecepcion?` — default hoy si se omite, cambio
  aditivo), `historialPrecio`, `listarCompras` (agregada para la UI de
  "Listado de Compras"), `consultarSaldoCompra` (nueva, agregada para la UI
  de "Registrar pago de Compra" — mismo criterio que
  `consultarPasivoDeActivo` en Patrimonio), `registrarPagoCompra`,
  `registrarCompraDeAjuste`, `consultarPagosCompraEnPeriodo` (agregado de
  solo lectura por período, agregado en Módulo 7 para que Financiero
  consuma Proveedores sin importar `compras`/`pagos_compra` directo).

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
- [x] **`item_id` sin FK — cerrado (roadmap ítem #12).** Reemplazado por
      `insumoId`/`productoId` tipados (FK real a `insumos.id`/
      `productos.id`), exactamente uno según `tipo`, reforzado por un CHECK
      constraint en la base (no solo en `actions.ts`). Migraciones `0019`
      (columnas nuevas) + `0020` (drop de `item_id`) — separadas en dos
      pasadas porque drizzle-kit pide confirmación interactiva de
      rename/drop+add sin TTY disponible.
- [x] **Landed Cost simple — cerrado (roadmap ítem #12).** Campo opcional
      `costoAdicionalTraslado` en `Compra`; `calcularCostoUnitario()` ahora
      es `(montoTotal + costoAdicionalTraslado) / cantidad`. Dirección de
      diseño ya propuesta en la sección 6 del propio módulo, ahora
      implementada tal cual (sin calculadora aparte, el usuario solo
      contesta "¿tuviste algún costo extra de flete/transporte?").
- [x] **Orden de Compra como estado — cerrado (roadmap ítem #12).** `Compra`
      gana `estado` (`pedido`/`recibido`, default `recibido` — preserva el
      comportamiento histórico de quien no usa este flujo) y
      `fechaRecepcion`. No es una entidad nueva — mismo criterio ya
      propuesto en la sección 6: un único concepto ("Compra") con un
      estado de más. `recibirCompra()` transiciona `pedido → recibido`.
- [x] **Evento `compra_registrada` — cerrado (roadmap ítem #12).** Al
      transicionar (o nacer) `estado="recibido"`, `registrarCompra()`/
      `recibirCompra()` disparan de verdad `registrarEntradaCompraReventa()`
      (Módulo 2, `tipo="reventa"`) o `registrarEntradaCompraInsumo()`
      (Operativo Nicho 1, `tipo="insumo"`) — cierra el pendiente
      documentado en 3 `ANCLA.md` distintos (este, Módulo 2, Nicho 1).
      Mismo criterio de "gap de atomicidad cruzada aceptado a propósito"
      que Ventas/Producción: si esa llamada falla, la Compra ya quedó
      `recibido` igual; el resultado expone `entradaStock: {ok, error}`
      para reintentar a mano.
- [ ] Landed Cost / Órdenes de Compra formales, versión completa (multi-
      línea, un solo pedido con varios ítems) — lo implementado es la
      versión "simple" ya propuesta (una Compra = un ítem = un pedido). Si
      Nicho 4 necesita pedidos multi-ítem más adelante, es una extensión
      nueva, no un bug de esta.

## Dónde está cada cosa
- Esquema de BD (Drizzle): `src/modules/proveedores/schema.ts`
- Repository: `src/modules/proveedores/repository.ts`
- Server actions: `src/modules/proveedores/actions.ts`
- Tests: `src/modules/proveedores/costo-unitario.test.ts`,
  `src/modules/proveedores/proveedores.test.ts`
- Migraciones relevantes: `drizzle/migrations/0010` (solo
  `ALTER TYPE modulo_permiso ADD VALUE 'proveedores'`, aislada a
  propósito), `0011` (tablas + RLS de este módulo), `0019` (roadmap #12:
  `estado`, `costoAdicionalTraslado`, `fechaRecepcion`, `insumoId`/
  `productoId` nuevos + CHECK), `0020` (drop de `item_id`).

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
- **`insumoId`/`productoId` importan las tablas `insumos`
  (`../operativo/nichos/nicho-1/schema`) y `productos`
  (`../productos/schema`) directo en `schema.ts`** — mismo patrón ya usado
  por `patrimonio/schema.ts` importando `proveedores` para
  `activos.proveedorId` (migración `0016`), no es una excepción nueva a la
  caja negra.
- **`dispararEntradaStock()` (interno, no exportado) es el único lugar que
  decide "reventa → Módulo 2, insumo → Nicho 1"** — tanto
  `registrarCompra()` (cuando nace `recibido`) como `recibirCompra()`
  (cuando transiciona) lo reutilizan, no hay dos copias de esa lógica.
- **`registrarCompra()` valida `insumoId` xor `productoId` según `tipo` en
  `actions.ts`**, no solo confiando en el CHECK de la base — mismo criterio
  que la validación de `motivo` en Compra de Ajuste (mensaje de error claro
  antes de tocar la base).
- `vi.setConfig({ testTimeout: 20000 })` agregado a `proveedores.test.ts`
  (no lo tenía antes) — `registrarCompra`/`recibirCompra` ahora encadenan
  una llamada cross-módulo real, igual motivo que Módulo 3/4/7.

## Última actualización: 2026-07-17 (2) — Tanda de UI completa: Proveedores/Compras, 9/9 pantallas
Módulo cerrado end-to-end. Backend: `consultarSaldoCompra` nueva (saldo pendiente de una Compra,
para el resumen en vivo del modal de pago); `recibirCompra` extendida con `fechaRecepcion?`
opcional (default hoy). Ninguna otra función de `actions.ts` cambió de contrato — todo aditivo.
UI: `src/app/app/(shell)/proveedores/` — maestro-detalle de Proveedores vía route group
`(directorio)` (para que el layout compartido de Listado+Ficha no se filtre a `compras/*`,
sibling fuera del grupo), Listado de Compras con 3 modales acoplados a la fila (Recibir/Pagar/
Ajustar), Alta de Compra. La capa de Server Actions de ruta
(`src/app/app/(shell)/proveedores/actions.ts`) usa `revalidatePath()` en las mutaciones de
Proveedores en vez de depender solo de `router.refresh()` del cliente — un layout.tsx padre
compartido entre la ruta vieja y la nueva a la que se navega tras crear/editar/eliminar hacía que
`router.push()`+`router.refresh()` compitieran por la misma transición de React (bug real
encontrado y corregido en esta tanda). "Historial de precios de un ítem" del contrato original se
resolvió reusando `historialPrecio()` en una sección nueva de la Ficha de Producto existente, sin
ruta propia. Detalle completo de decisiones: `docs/ui/pantallas.md` sección 4.

## Última actualización: 2026-07-17 — Gap de backend cerrado para la tanda de UI de Proveedores/Compras
`docs/ui/pantallas.md` sección 4 documentaba que no existía un listado general de Compras — solo
indirectos (`fichaProveedor()` → `compras[]` por proveedor, `historialPrecio()` por ítem). Se
agregó `repo.listarComprasPorTenant(tenantId, { estadoPago?, estado? })` + el wrapper público
`listarCompras(solicitante, tenantId, opts)`, gateado por `tienePermiso(..., "proveedores",
"ver")` igual que el resto del módulo. Más reciente primero (`orderBy(desc(fechaCompra))`). Sin
cambios de contrato en ninguna función existente — todo aditivo. Cubierto por un test nuevo en
`proveedores.test.ts` que verifica el filtro por `estado` (pedido/recibido) y por `estadoPago`.

## Última actualización anterior: 2026-07-15 — roadmap ítem #12 (Nicho 4): Landed Cost simple, Orden de Compra como estado, FK real de insumo/producto, evento compra_registrada real
