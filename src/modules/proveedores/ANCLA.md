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
  `actions.ts`, disparadas al recibir una Compra. Y la misma flecha en el
  otro sentido al cerrar H-31: `consultarStock()` /
  `registrarAjusteManualStock()` (Módulo 2) y `consultarStockInsumo()` /
  `registrarAjusteManualInsumo()` (Nicho 1), para devolverle al proveedor la
  mercadería de un ajuste — ninguna de las cuatro recalcula costo, así que los
  snapshots de las ventas ya hechas y el costo promedio ponderado del insumo
  quedan intactos.
- Salidas que expone (`actions.ts`): `crearProveedor`, `actualizarProveedor`,
  `eliminarProveedor`, `listarProveedores`, `fichaProveedor`,
  `registrarCompra` (+ `calcularCostoUnitario()` pura, exportada),
  **`recibirCompra`** (roadmap ítem #12; extendida en la tanda de UI con un
  tercer parámetro `fechaRecepcion?` — default hoy si se omite, cambio
  aditivo), `historialPrecio`, `listarCompras` (agregada para la UI de
  "Listado de Compras"), `consultarSaldoCompra` (nueva, agregada para la UI
  de "Registrar pago de Compra" — mismo criterio que
  `consultarPasivoDeActivo` en Patrimonio — desde H-31 devuelve también
  `montoTotal`/`montoTotalEfectivo`/`totalPagado`, cambio aditivo),
  `registrarPagoCompra`, `registrarCompraDeAjuste` (desde H-31 devuelve
  `montoTotalEfectivo`/`estadoPago`/`saldoPendiente`, no solo el `ajusteId`),
  **`listarComprasConAjustes`** (H-31: el listado con los ajustes de cada
  compra y su monto efectivo, en 2 consultas para todo el tenant y no una por
  fila), **`listarProveedoresConCantidadCompras`** (2026-09-17: el directorio
  con el conteo de compras por fila en UNA consulta, reemplaza llamar
  `fichaProveedor` por proveedor — ver el incidente), `consultarPagosCompraEnPeriodo` y
  **`consultarCostoExtraAjustesCompraEnPeriodo`** (agregados de solo lectura
  por período, para que Financiero consuma Proveedores sin importar
  `compras`/`pagos_compra`/`compras_ajuste` directo).
  + `errorSignoAjusteCompra()`/`esTipoAjusteCompraAFavor()` en
  `validation.ts`, compartidas entre el schema de ruta y el guard del módulo.

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
- [x] **H-31 cerrado: la Compra de Ajuste tiene efecto observable.** Antes
      `registrarCompraDeAjuste` escribía una fila en `compras_ajuste` y nada
      más: no cambiaba el monto ni el estado de pago, no se mostraba en
      ninguna pantalla (la consulta de lectura existía en `repository.ts` sin
      exponerse en `actions.ts`) y no llegaba a ningún reporte. Ahora:
      - **`montoTotalEfectivo` = `montoTotal` + Σ ajustes** es contra lo que
        se derivan `saldoPendiente` y `estado_pago`
        (`derivarEstadoPago()`/`recalcularEstadoPagoTx()` en `repository.ts`,
        única fuente de verdad de esa regla, compartida con
        `registrarPagoCompraTx`). Una anulación total deja la compra sin
        saldo en vez de "pendiente" para siempre; una corrección a la baja la
        deja "pagado" si lo ya pagado cubre el monto nuevo. La `Compra` sigue
        sin editarse (regla 3.3): el monto original queda intacto y el
        efectivo se deriva.
      - **El signo se deriva del tipo** (`errorSignoAjusteCompra()`, misma
        lección que H-30): `devolucion_a_proveedor` y `anulacion_total` solo
        pueden ir a favor del negocio (monto negativo); `correccion` es la
        única bidireccional. Ningún ajuste puede dejar el monto efectivo por
        debajo de 0. El formulario ni ofrece la dirección imposible: pide un
        monto positivo y la dirección aparte.
      - **Llega al estado de resultados, solo en la dirección de costo.**
        `consultarCostoExtraAjustesCompraEnPeriodo` agrupa por compra, toma
        el neto del período y descarta lo negativo, así que lo que la compra
        terminó costando de MÁS resta en el resultado (ese excedente no puede
        llegar al COGS nunca: los `costo_unitario_snapshot` de las ventas ya
        están congelados) y lo que costó de MENOS **no suma utilidad** — en
        CEOM una compra nunca fue un gasto, así que deshacerla no es una
        ganancia. Decisión de negocio confirmada con el usuario, no un
        detalle de implementación.
      - **Revierte el stock** que había entrado, cuando el ajuste va a favor
        del negocio (`revertirStockDeAjuste`). `correccion` nunca mueve stock
        (es plata, no mercadería) y lo rechaza si se lo piden; una compra en
        `pedido` no tiene nada que revertir; `anulacion_total` sin cantidad
        explícita devuelve todo lo que quedaba por devolver.
        **Reversión PARCIAL, decisión de negocio confirmada:** si parte del
        stock ya se vendió o se consumió, vuelve solo lo que quedaba y el
        resultado trae un `aviso` con las dos cifras. Nunca deja el stock
        negativo — nada más en el sistema lo impide (no hay CHECK en `stock`,
        y `registrarAjusteManualStock` no mira disponibilidad: el único guard
        vive en `descontarStockVenta` y protege la venta, no el ajuste), así
        que si no se acotaba acá el error financiero silencioso se convertía
        en un error de inventario silencioso. Se descartaron **bloquear la
        anulación** (deja sin corregir el caso más común —mercadería ya
        vendida— y acopla la corrección de la plata a una condición del
        inventario) y **dejarlo en negativo** (ninguna pantalla muestra -7
        unidades con sentido y la próxima venta se bloquea con un mensaje
        incomprensible).
        `compras_ajuste.cantidad_devuelta` (migración
        `0042_compras_ajuste_cantidad_devuelta`) guarda cuánto volvió de
        verdad — sin eso un segundo ajuste devolvía stock de nuevo. Mismo
        patrón y misma razón que `ajustes_venta.cantidad_producto_ajustada`.
        Va fuera de la transacción del ajuste y su fallo NO lo anula (mismo
        gap de atomicidad cruzada aceptado que la entrada de stock al recibir
        la compra): viaja en `reversionStock` para que la pantalla lo muestre.
      - Los ajustes se ven en el listado de compras, con el monto original
        tachado cuando difiere del efectivo y las unidades devueltas por
        ajuste.
- [x] **`compras_ajuste` recibió `gatewayVigenciaBypassPolicy(..., "financiero")`**
      (migración `0041_gateway_vigencia_bypass_compras_ajuste`): desde que
      `financiero.estadoResultados()` la lee, la tabla quedó en el camino del
      Gateway igual que `compras`/`pagos_compra`. Sin esa policy el camino
      institucional leería 0 ajustes y devolvería un resultado MAYOR que el
      real, indistinguible de "no hubo ajustes" — la fuga silenciosa de
      §13.11 del backstop de RLS. Checklist de costo §16.10: la query real
      (`sumarCostoExtraAjustesCompraPeriodo`) trae su propio filtro de tenant
      vía `innerJoin(compras)`.
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
- **`requireSucursalOperable()` (H-02, 2026-07-27) — freeze de sucursal
  también acá.** `compras.sucursal_id` es `NOT NULL` en este módulo (a
  diferencia de Patrimonio/Gastos), así que el chequeo se llama siempre,
  sin atajo de null. `registrarCompra` rechaza antes de crear la fila;
  `recibirCompra` rechaza **antes** de llamar a
  `repo.marcarCompraRecibida()` — si la sucursal se congeló después de
  crear una Compra en estado `pedido`, la transición a `recibido` (que
  dispara entrada de stock) queda bloqueada, la compra se queda en
  `pedido` en vez de quedar a medio camino.
- **⛔ Nunca llamar, desde adentro del callback de `comoUsuario()`, a una
  función que toque la base por fuera del `tx`** — `tienePermiso()`,
  `listarSucursalesPorTenant()`, cualquier `actions.ts` de un módulo todavía
  no migrado. No es un problema de RLS ni de atomicidad: es de **conexiones**.
  Ver "Incidente del 2026-09-17" abajo. Los permisos por-id se resuelven con
  `preautorizarSobreRecurso()` **antes** de abrir la transacción, y adentro
  solo se evalúa la función pura que devuelve.
  **El "arreglo" que lo reintroduce:** mover el chequeo de permiso adentro del
  `tx` "para que quede junto a la lectura del recurso", o reemplazar
  `puedeVer(proveedor.tenantId)` por `await tienePermiso(solicitante,
  proveedor.tenantId, …)` porque "es más directo". Se lee más prolijo y vuelve
  a colgar el directorio con 10 proveedores. `src/db/agotamiento-pool.test.ts`
  lo detecta.

## Última actualización: 2026-09-17 — Incidente en producción: el directorio se colgaba 300 s (pool agotado)

**Síntoma.** CAFIATTO (10 proveedores) no podía abrir `/app/proveedores`: la navegación del cliente
se quedaba en la pantalla anterior sin error (no hay `loading.tsx`), una carga directa terminaba en
`504 FUNCTION_INVOCATION_TIMEOUT`, y en el mismo intervalo se colgaban `/app`, `/app/productos`,
`/app/patrimonio` y `/app/proveedores/compras`. Logs de Vercel del 17/09 09:44–09:47 (hora Bolivia):
`Task timed out after 300 seconds`.

**Mecanismo, verificado y no solo razonado** (reproducción en `src/db/agotamiento-pool.test.ts`,
roja antes del fix):

1. `src/db/client.ts` crea el pool de postgres-js sin `max`: **10 conexiones** por instancia.
2. `comoUsuario()` (`src/db/contexto.ts`) abre una transacción → **reserva una conexión** hasta el
   commit. postgres-js no la presta a nadie más mientras tanto.
3. `fichaProveedor()` llamaba a `tienePermiso()` **dentro** del callback. `tienePermiso()` lee el
   tenant con `repo.obtenerTenantPorId()` de Identidad, que usa `db` crudo → pide **otra** conexión
   del mismo pool. (El plan de RLS ya lo había medido en §9.3: *"`pid` distinto"* — se evaluó rol,
   contexto y atomicidad, nunca agotamiento.)
4. El directorio (`(directorio)/layout.tsx`) hacía `Promise.all(proveedores.map(fichaProveedor))`:
   10 transacciones a la vez. Las 10 conexiones quedaban reservadas y las 10 esperaban una undécima.
   **postgres-js encola sin timeout**, así que no hay error: hay espera infinita, hasta que Vercel
   mata la función a los 300 s. Contra `postgres:16` efímero: `pg_stat_activity` muestra exactamente
   10 sesiones `idle in transaction` detenidas tras `obtenerProveedorPorId`.
5. **Por qué arrastra otras rutas.** Con Fluid Compute una instancia atiende varias requests con el
   mismo pool: una vez trabado, cualquier render de esa instancia que toque la base se cuelga (el
   layout del shell ya llama a `obtenerTenantPorId()`). Y hay una segunda capa, entre instancias:
   en modo transacción Supavisor fija un backend por transacción abierta, así que esas 10
   transacciones colgadas retienen 10 backends del pooler compartido. Los logs de Supavisor del
   mismo intervalo muestran `ECHECKOUTTIMEOUT: unable to check out connection from the pool after
   60000ms` (13:55:22Z) en otras conexiones — de ahí el "This page couldn't load" (un error, no un
   timeout) que vio otra usuaria.
6. **Por qué pega en Proveedores y no en Patrimonio:** misma trampa en `fichaPasivo` (Deudas), pero
   ningún tenant tiene hoy más de 2 pasivos. CAFIATTO cargó su proveedor número 10 el 2026-09-14.

**Fix (hotfix):** `tienePermiso(solicitante, recurso.tenantId, …)` adentro de la transacción →
`preautorizarSobreRecurso(solicitante, modulo, accion)` antes, y `puede(recurso.tenantId)` adentro
(pura, sin base). Equivalencia con el chequeo anterior demostrada caso por caso en
`identidad/preautorizar-recurso.test.ts` (validado rompiéndolo: los dos mutantes quedan en rojo). La
única diferencia es el Gateway de Consentimiento, que queda **más** restringido en funciones por-id
de este módulo — ningún camino del Gateway las alcanza. Aplicado a `actualizarProveedor`,
`eliminarProveedor`, `fichaProveedor`, `recibirCompra`, `consultarSaldoCompra`,
`registrarPagoCompra` y `registrarCompraDeAjuste`. **Sin cambio de firma en ninguna función.**

**Segundo commit de la tanda — las otras llamadas cruzadas, fuera del `tx`.** Mismo bug, disparado
por concurrencia de escrituras en vez de un `Promise.all` de lecturas (reproducido: 12
`registrarCompra` recibidas, 12 `recibirCompra` y 12 `transferirActivo` simultáneos se colgaban aun
con el hotfix, `src/db/agotamiento-pool-escrituras.test.ts`):
- `registrarCompra`: la Compra se comitea y **después** corre `dispararEntradaStock`.
- `recibirCompra`: tres pasos — transacción de lectura y autorización, `requireSucursalOperable`
  sin transacción abierta, transacción de escritura que **vuelve a mirar el estado** antes de marcar
  `recibido` (una recepción concurrente sigue rechazada), y la entrada de stock después del commit.
- `registrarCompraDeAjuste`: el ajuste y el estado de pago se comitean, después corre
  `revertirStockDeAjuste`, y `cantidad_devuelta` se persiste en una transacción propia.

**Qué cambia en la semántica, y por qué es la correcta.** Antes, una **excepción** (no un
`{ ok: false }`) de la entrada de stock hacía rollback de la Compra o del ajuste — mientras el movimiento
de stock de la otra conexión podía haber quedado comiteado. Ahora la Compra/el ajuste quedan y la
excepción se propaga. Es exactamente lo que este archivo ya documentaba ("si esa llamada falla, la
Compra ya quedó `recibido` igual"; "su fallo NO anula el ajuste"), y cierra la ventana de §9.3 del
plan de RLS: ya no puede quedar un movimiento de stock apuntando a una Compra revertida.

**Tercer commit — el N+1.** El directorio hacía 1 + 4N consultas y N transacciones para mostrar un
contador. Ahora `listarProveedoresConCantidadCompras()` (`repository.ts`, `LEFT JOIN compras` +
`count` con el mismo filtro `eliminado_en is null` que `resumenComprasPorProveedor`) lo resuelve en
una. Equivalencia con `fichaProveedor` probada con valores distinguibles —compra eliminada,
proveedor sin compras— en `src/db/agregados-listado.test.ts`, validada con un mutante sin el filtro
de eliminadas. El orden del listado pasa a ser explícito (`creado_en`); antes no tenía `ORDER BY`.
**⛔ No volver a llamar una ficha por fila desde un listado**, aunque el hotfix ya impida el cuelgue:
son N transacciones que ocupan N conexiones a la vez.

Lo que la concurrencia destapó y **no** es de este módulo: el caché de stock de Productos pierde
movimientos simultáneos del mismo producto (DA-45 en `docs/deuda-aplazada.md`).

## Última actualización: 2026-07-27 (2) — H-02 completado: freeze de sucursal también en escritura
`requireSucursalOperable()` (ver "Decisiones tomadas") ahora gatea `registrarCompra`/`recibirCompra`.
Antes del cierre de esta tanda, una sucursal congelada por downgrade de plan rechazaba escritura en
Productos/Ventas pero la aceptaba acá — modo de falla silencioso señalado en la revisión del usuario
antes de mergear H-02. Test nuevo en `proveedores.test.ts`, incluye el caso de una Compra `pedido`
creada antes de congelar que debe seguir bloqueada al intentar `recibirCompra`. Sin cambio de
contrato — ninguna firma cambió, solo se agregó un rechazo temprano.

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


## Última actualización: 2026-07-27 — H-49: `sumarCostoExtraAjustesCompraPeriodo` alineada con el resto

Esta función había sido la primera en cerrar el borde superior (commit `2ea20e5`, sumándole un día a
`hasta` en UTC), pero había dejado el borde **inferior** anclado a medianoche UTC — o sea seguía
colando las últimas 4 horas de la noche anterior a `desde`. Ahora recibe `(inicio, fin)` de
`rangoInstantes()`, igual que todos los agregados por período: los dos bordes salen del mismo lugar.

`sumarPagosCompraPeriodo` **no** cambia y no hay que "arreglarla": `pagos_compra.fecha_pago` es
columna `date`, un día calendario sin instante ni huso, y su `lte` es correcto. Queda documentado en
el código para que nadie lo migre por simetría.

Contexto completo: `docs/auditoria-prelanzamiento/antiguo/05-dia-local-y-reportes.md`.
