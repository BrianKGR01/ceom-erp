# Sucursales múltiples (H-02) — diagnóstico y diseño técnico

> Documento de diagnóstico, **sin código de producción tocado**. Generado el 2026-07-27 sobre `dev`,
> vía un barrido de 15 agentes (9 de mapeo de impacto módulo por módulo, 4 de diseño técnico, 2 de
> verificación adversarial de las dos decisiones de mayor riesgo). Cada afirmación de este documento
> está verificada contra el código real, con cita `archivo:línea` — no contra lo que el diseño
> original (Modulo_01, Modulo_02, `docs/architecture/CEOM_Arquitectura.md`) dice que *debería* pasar.
>
> Complementa [H-02 del manual de hallazgos](../manual/hallazgos.md#h-02) y la decisión **D2** de
> [04-camino-al-lanzamiento.md](04-camino-al-lanzamiento.md) ("Sucursales: ¿ABM ahora o esconder lo
> que las promete?"). Este documento asume la respuesta ya está tomada: **ABM ahora**, gateado por
> plan, con el comportamiento estándar de la industria (stock general + stock por sucursal). Lo que
> falta decidir es el *cómo*, no el *si*.

---

## 0. Resumen ejecutivo

**El hallazgo más importante de esta investigación contradice la intuición de partida.** H-02 se lee
como "falta construir sucursales múltiples". La realidad, verificada línea por línea, es otra: **el
75-80% del trabajo de datos y de lógica de negocio ya está construido, probado, y en producción —
simplemente nunca se ejercita porque no existe ningún camino de aplicación para crear una segunda
sucursal.** Todo lo que sigue está confirmado por lectura directa de código, no por el diseño
documentado:

- El ledger de stock (`stock`, `movimientos_stock`) ya es 100% sucursal-consciente desde su creación
  (migración 0012): `sucursal_id` es `NOT NULL` sin excepción, hay un índice único
  `(producto_id, sucursal_id)`, y las funciones de escritura agrupan y descuentan por sucursal
  correctamente. **No hace falta ninguna migración de schema para esto.**
- `ventas.sucursal_id`, `compras.sucursal_id`, `eventos.sucursal_id`, `producciones.sucursal_id`,
  `activos.sucursal_id`, `gastos.sucursal_id` y `gastos_recurrentes.sucursal_id` ya existen, ya se
  persisten, y en la mayoría de los casos ya se propagan correctamente hacia el módulo que descuenta
  stock o genera el gasto derivado.
- El traspaso de stock entre sucursales (`registrarTransferenciaStock`) y la transferencia de un bien
  de Patrimonio (`transferirActivo`) están **completos, atómicos y cubiertos por tests de
  integración reales** — la UI (botón, modal, selector) también existe. Ambos son hoy inalcanzables
  porque el único test que los ejercita tiene que insertar una segunda sucursal directo en la base de
  datos, ya que no existe ninguna acción de aplicación para hacerlo.
- La pantalla de Reportes ya tiene un selector de sucursal funcional de punta a punta contra
  `estadoResultados`/`flujoCaja` (Financiero) — es la pieza "ya construida pensando en varias
  sucursales" más completa del sistema.

**Lo que sí falta, concretamente:**

1. **No existe ninguna función para crear, renombrar, desactivar o cambiar la sucursal principal.**
   La única escritura a `sucursales` en todo el código de producción es el alta atómica de tenant
   (`identidad/repository.ts:202-239`), que siempre crea una única fila `"Principal"`. Este es el
   verdadero bloqueante P0 — sin él, todo lo demás sigue siendo "código real, testeado, pero
   inalcanzable", exactamente como hoy.
2. **El gating por plan es 100% decorativo.** `planes.incluye_sucursales` es un boolean que se
   persiste de punta a punta (schema → CRUD → dos pantallas de UI) pero ningún código de negocio lo
   lee para permitir o bloquear nada. Tampoco existe ningún tope numérico.
3. **Huecos de UI puntuales:** el POS no tiene selector de sucursal (la venta siempre cae en una
   sucursal fija); el formulario de Gasto no tiene el campo pese a que el backend ya lo acepta; 5 de
   8 funciones de Reportes ignoran el filtro en silencio.
4. **Dos bugs reales encontrados por la revisión adversarial, ninguno de los dos nuevo, pero ambos
   se vuelven mucho más probables con 2+ sucursales activas:** una condición de carrera en
   `stock.cantidad_actual` (§3.4) y una contaminación del costo promedio ponderado de insumos entre
   sucursales en Nicho 1 (§3.5). Ninguno de los dos rompe con un error visible — los dos dan un
   **número mal, en silencio**, que es exactamente el tipo de riesgo que este documento existe para
   prevenir antes de construir.
5. **Corrección a la premisa del encargo de esta tarea:** se pidió mapear si `pasivos` necesita
   `sucursal_id`, citándola como ejemplo de tabla que "probablemente lo necesite". La investigación
   confirma lo contrario: la ausencia de `sucursal_id` en `pasivos` es una **decisión de negocio ya
   tomada y documentada** (`patrimonio/ANCLA.md:86-91`: "una deuda es del negocio, no de un local"),
   con test que la fija. No hay que agregarla — el gap real ahí es que `registrarPagoPasivo` nunca
   propaga `activo.sucursalId` al Gasto que genera, pese a que la firma de Gastos ya lo acepta.

---

## 1. Mapa de impacto completo

Tabla por tabla, confirmado por lectura directa de `schema.ts`/`repository.ts`/`actions.ts` de cada
módulo. "Usa" significa que al menos una función de negocio real filtra o propaga la columna, no solo
que la persiste.

### 1.1 Productos e Inventario (`src/modules/productos/`)

| Tabla | `sucursal_id` | Se usa | Nota |
|---|:---:|:---:|---|
| `productos` | No | — | Precio y costo son **tenant-wide por diseño explícito** (Modulo_02 §1: "un mismo producto, un mismo precio, se vea desde la sucursal que se vea"). No es un gap. |
| `stock` | Sí | Sí | `uniqueIndex(producto_id, sucursal_id)`. `obtenerStock`/`actualizarStockMinimo` filtran por ambos; `sumarStockPorSucursal` agrupa por sucursal. |
| `movimientos_stock` | Sí | Sí | Ledger append-only real. `recalcularCantidadActualTx` agrupa siempre por `(producto_id, sucursal_id)`, nunca mezcla. |
| `categorias_producto` / `categorias_sugeridas` | No | — | Catálogo tenant-wide (o global), correcto así. |

`consultarStockTotalPorSucursal` (`actions.ts:364-374`) **existe de verdad y filtra por sucursal** —
no es aspiracional. Su único caller real es Nicho 4. La función que de verdad usan Ventas,
Proveedores y Nicho 1 es `consultarStock` (singular), indexada por `(productoId, sucursalId)`.

### 1.2 Ventas (`src/modules/ventas/`)

| Tabla | `sucursal_id` | Se usa | Nota |
|---|:---:|:---:|---|
| `ventas` | Sí (`NOT NULL`) | Sí | Validada contra el tenant en `registrarVenta` (`actions.ts:444-452`, fix explícito de auditoría), persistida, y propagada de verdad a `descontarStockVenta` y `generarGastoComisionVenta`. |
| `eventos` | Sí (`NOT NULL`) | Sí | `abrirEvento` la persiste, pero **no valida** que pertenezca al tenant (mismo tipo de hueco ya cerrado en `registrarVenta`, sigue abierto acá). |
| `detalles_venta` / `ajustes_venta` / `pagos_venta` | No | Vía `venta.sucursalId` | Correcto por diseño: heredan la sucursal de su venta. |
| `clientes` / `canales_venta` / `metodos_pago` | No | — | Tenant-wide, correcto. |

Los 4 agregados que Ventas expone a **Financiero** (`consultarIngresosPeriodo`,
`consultarPagosVentaEnPeriodo`, etc.) ya aceptan `opts.sucursalId` real. Los 3 que expone a
**Reportes** (`rankingProductos`, `historicoVentas`, `margenPorCanalYProducto`) **no** lo aceptan.

### 1.3 Patrimonio (`src/modules/patrimonio/`)

| Tabla | `sucursal_id` | Se usa | Nota |
|---|:---:|:---:|---|
| `activos` | Sí (nullable) | Sí | `null` = "aplica a todo el negocio" (ej. vehículo compartido). `transferirActivo()` ya existe, completo y probado. `listarActivosPorTenant` no filtra por sucursal (solo mezcla y muestra el nombre como texto). |
| `pasivos` | **No — a propósito** | — | Decisión de negocio documentada: una deuda es del negocio, no de un local. **No agregar.** |
| `pagos_pasivo` | No | Vía `pasivoId` | Hereda el nivel de su pasivo padre, correcto. |

### 1.4 Financiero y Gastos (`src/modules/financiero/`, `src/modules/gastos/`)

| Tabla / función | `sucursal_id` | Se usa | Nota |
|---|:---:|:---:|---|
| `gastos` | Sí (nullable) | Parcial | Se guarda bien en escritura. `sumarPagosGastoPeriodo`/`sumarTotalGastosPeriodo` sí filtran (alimentan a Financiero); `sumarGastosPorTipoEnPeriodo`/`PorCategoriaEnPeriodo` y el listado de UI **no**. |
| `gastos_recurrentes` | Sí (nullable) | Parcial | Se guarda y se propaga al Gasto generado, pero ninguna lectura filtra y **no hay campo en el formulario** para asignarla. |
| `flujoCaja` / `estadoResultados` (Financiero) | — | **Sí, end-to-end** | Ya propagan `sucursalId` a las 7 funciones de período que consumen (Ventas/Gastos/Proveedores). Probado con test de integración real. Es la pieza mejor terminada de todo el sistema. |
| `costoFijoTotal` / `margenPorProducto` (Financiero) | — | **No** | Ni siquiera tienen el parámetro en su firma. `costoFijoTotal` alimenta el Punto de Equilibrio de Simulaciones — con 2+ sucursales, ese número consolidaría costos fijos de todo el tenant aunque cada local tenga alquiler propio. |

**Gap de UI concreto:** `GastoForm` (`src/components/shared/gasto-form.tsx`) tiene `sucursalId` en su
estado interno pero **no renderiza ningún campo para elegirla** — todo gasto manual se guarda hoy sin
sucursal, sin importar cuántas existan.

### 1.5 Proveedores y Compras (`src/modules/proveedores/`)

| Tabla | `sucursal_id` | Se usa | Nota |
|---|:---:|:---:|---|
| `compras` | Sí (`NOT NULL`) | Sí | Decide de verdad dónde entra la mercadería: `recibirCompra`/`registrarCompra` pasan `compra.sucursalId` a `registrarEntradaCompraReventa`/`Insumo`, que lo exigen. |
| `pagos_compra` / `compras_ajuste` | No | Vía join a `compras` | `sumarPagosCompraPeriodo`/`sumarCostoExtraAjustesCompraPeriodo` sí filtran por sucursal cuando se les pasa. |
| `proveedores` | No | — | Correcto (entidad tenant-level), pero la ficha de proveedor no desglosa compras por sucursal. |

El formulario de Alta de Compra ya tiene un selector de sucursal real (auto-selecciona con 1, exige
elegir con 2+). El **listado de Compras y la Ficha de Proveedor no filtran ni muestran sucursal en
absoluto** — gap directo, no pieza a medias.

### 1.6 Reportes y Dashboard (`src/modules/reportes/`, sin tablas propias)

De las 8 funciones que expone `reportes/actions.ts`, solo **3 nombres (una sola capacidad real, la de
Financiero)** aceptan `sucursalId` de punta a punta. Las otras 5 —`rankingProductos`,
`distribucionGastos`, `historicoVentas`, `margenPorCanalYProducto`, `controlMerma`— no lo aceptan ni
en Reportes ni en el módulo de origen.

En el Dashboard, el selector de sucursal (`dashboard-resumen.tsx:129-155`) ya es funcional, pero solo
2 de 6 tarjetas lo respetan: "Resumen del período" y "Flujo de caja" sí; "Productos más vendidos",
"Gastos por categoría", "Merma registrada" y el widget de Capacidad de Almacenamiento de Nicho 4
(**no cubierto por H-16 hoy**) siguen mostrando el consolidado del tenant sin ningún aviso visual de
que el filtro no aplicó. De las 4 pantallas de "Reportes Detallados", solo Resumen Financiero
respeta el filtro — Margen, Histórico y Ranking no tienen ningún selector.

Esto contradice una regla de negocio ya documentada: `docs/modules/Modulo_10_reportes.md` §3 regla #2
dice textualmente *"todo reporte es filtrable por sucursal o consolidado a nivel tenant"* — hoy se
cumple en el 25% de los casos.

### 1.7 Identidad, Tenants, Roles (`src/modules/identidad/`) — dueño de `sucursales`

La tabla `sucursales` (`schema.ts:140-163`) está completa desde el día uno: `id`, `tenantId`,
`nombre`, `direccion`, `esPrincipal` (con índice único parcial que garantiza una sola principal por
tenant), `activa`, `eliminadoEn` — pero **le faltan `creadoEn`/`creadoPor`/`modificadoPor`/
`modificadoEn`**, pese a que Modulo_01 §2.2 la lista explícitamente como entidad que debe tenerlos.

`listarSucursalesPorTenant()` es la **única** función expuesta relacionada a sucursales. No existe
`crearSucursal`, `actualizarSucursal`, `desactivarSucursal` ni `cambiarSucursalPrincipal`. Tampoco
existe ninguna dimensión de sucursal en el modelo de permisos: `usuarios` no tiene columna de
sucursal, `moduloPermisoEnum` (11 valores) no incluye `"sucursales"`, y `tienePermiso()` no recibe
`sucursalId` como parámetro. Ver §4 para el análisis completo.

### 1.8 Suscripción y Planes (`src/modules/suscripcion/`)

`planes.incluyeSucursales` (`schema.ts:33`) es un boolean sin ningún campo de tope numérico. Se
persiste de punta a punta (CRUD completo, dos pantallas de UI) pero **cero código de negocio lo lee**
— ni en Suscripción ni en Identidad (que es donde tendría que gatearse). Es exactamente tan
decorativo como el resto de los atributos de plan que documenta H-36. Ver §5-6 para el diseño
propuesto.

### 1.9 Operativo — Nicho 1 (producción) y Nicho 4 (landed cost)

| Tabla | `sucursal_id` | Se usa | Nota |
|---|:---:|:---:|---|
| `movimientos_insumo` / `stock_insumo` | Sí (`NOT NULL`) | Sí | Bien particionado, mismo patrón que Productos. `stock_insumo` tiene índice único `(insumo_id, sucursal_id)`. |
| `producciones` | Sí (`NOT NULL`) | Sí | Consumo de insumos y producto terminado quedan atados a una sucursal. **Gap:** no valida que `activo.sucursalId` coincida con `input.sucursalId` de la producción. |
| `insumos` | No | Sí (parcial) | Catálogo tenant-wide, correcto — **pero `costo_unitario_vigente` (el promedio ponderado real) también es tenant-wide, y eso sí es un problema real: ver §3.5.** |
| `recetas` / `receta_insumos` / `vinculaciones_producto_receta` | No | — | Tenant-wide por diseño, correcto: la receta es la misma en todas las sucursales. |

Nicho 4 no tiene tablas propias; `consultarCapacidadAlmacenamientoUsada` recibe `sucursalId`
explícito, con un gap ya documentado por el propio equipo (`nicho-4/ANCLA.md:40-43`): un activo
compartido (`sucursalId = null`) no suma stock de todas las sucursales que lo usan, solo de una.

---

## 2. Qué está construido a medias (inventario completo)

Ordenado por qué tan cerca está de ser usable el día que exista una segunda sucursal:

**Completo y probado, solo inalcanzable:**
- Traspaso de stock entre sucursales — `registrarTransferenciaStock`/`crearTransferenciaStockTx`
  (`productos/actions.ts:597-638`, `repository.ts:352-398`), con UI completa en
  `ficha-cliente.tsx` y test de integración real.
- Transferencia de un bien entre sucursales — `transferirActivo()`
  (`patrimonio/actions.ts:349-366`, "Caso borde 4"), con `TransferirDialog` funcional y test real.
- Selector de sucursal en Reportes contra Financiero (`resumen-financiero-cliente.tsx:68-154`) y en
  Dashboard (`dashboard-resumen.tsx:129-155`) — ambos ya arman la lista real vía
  `listarSucursalesPorTenant()`.
- Selector de sucursal en Alta de Compra, Importar Histórico de Ventas y Nuevo Evento — los tres ya
  listan sucursales reales, con auto-selección solo cuando hay una.
- Selector de sucursal en el formulario de Activo (alta/edición) — ya alimentado con datos reales.

**Parcial — el dato ya viaja, pero no se lee del todo:**
- `gastos.sucursalId` / `gastos_recurrentes.sucursalId` — se guarda y en algunos casos se propaga,
  pero ni el listado de Gastos ni la distribución por categoría filtran, y el formulario de carga no
  tiene el campo.
- `flujoCaja`/`estadoResultados` funcionan de punta a punta; `costoFijoTotal`/`margenPorProducto` no
  tienen ni el parámetro.

**Documentado como intención, cero código:**
- El caso borde 3 de Modulo_02 (downgrade de plan con stock repartido entre sucursales) — solo
  mencionado en el doc, ningún código lo implementa.
- Las tres reglas de gating server-side de Modulo_01 (líneas 57, 251, 275: bloquear creación de 2ª
  sucursal sin plan, bloquear downgrade sin resolver el excedente) — son el plano, no hay ni un
  `if` que las implemente.

---

## 3. Modelo técnico: stock por sucursal vs. consolidado

### 3.1 Diagnóstico

El ledger de Productos **ya es sucursal-consciente al 100% a nivel de schema** desde la migración
0012: `movimientos_stock.sucursal_id` es `NOT NULL` sin excepción (nunca hubo un caso "sin
sucursal"), `stock` tiene `uniqueIndex(producto_id, sucursal_id)`, y `recalcularCantidadActualTx`/
`crearTransferenciaStockTx` ya agrupan y operan por esa combinación. **No hace falta ninguna
migración de datos para esto** — es exactamente lo que anticipaba `CEOM_Arquitectura.md` §6.4.

El gap real no es de modelo de datos sino de tres cosas puntuales:

1. No existe ninguna acción para crear una 2ª sucursal (bloqueante para todo lo demás, vive en
   Identidad — ver §5).
2. "Stock consolidado" hoy es una capacidad interna sin función pública documentada
   (`repo.obtenerStockTotalProducto` solo se usa para el aviso al eliminar un producto).
3. **Un hueco de autorización real, no reportado antes de esta investigación:** las 5 funciones que
   escriben al ledger de Productos (`registrarEntradaProduccion`, `registrarEntradaCompraReventa`,
   `registrarAjusteManualStock`, `descontarStockVenta`, `registrarTransferenciaStock`) validan que el
   `producto_id` pertenezca al tenant pero **nunca validan que el `sucursal_id` recibido también
   pertenezca a ese tenant.** Es el mismo tipo de bug ya corregido explícitamente en
   `ventas/registrarVenta` (`actions.ts:444-452`) — acá nunca se cerró. Con RLS bypaseada a nivel de
   aplicación (Drizzle corre con el rol `postgres`), este chequeo es hoy la única defensa real.

Sobre costo: `costo_operativo_vigente` en `productos` **no es un promedio ponderado** — es "último
valor gana", una sola columna sin `sucursal_id`, tenant-wide por diseño explícito (Modulo_02: "un
mismo producto, un mismo precio, se vea desde la sucursal que se vea"). El promedio ponderado real
vive en Nicho 1, sobre `insumos` — y ahí sí hay un problema real (§3.5).

### 3.2 Modelo propuesto

**No cambia el modelo de datos de Productos.** Se agregan dos funciones públicas y un helper de
autorización, reutilizando lo que ya existe:

```ts
// productos/actions.ts — junto a requireProductoDelTenant, mismo patrón
// que ya corrigió el hueco de autorización en ventas/registrarVenta.
async function requireSucursalDelTenant(
  solicitante: UsuarioConRol,
  tenantId: string,
  sucursalId: string
): Promise<{ ok: false; error: string } | null> {
  const res = await listarSucursalesPorTenant(solicitante, tenantId);
  if (!res.ok || !res.data.some((s) => s.id === sucursalId)) {
    return { ok: false, error: "La sucursal indicada no existe en este negocio." };
  }
  return null;
}
```

Llamarlo en las 5 funciones mutadoras del ledger, sobre `input.sucursalId` (y, en
`registrarTransferenciaStock`, sobre **ambos** `sucursalOrigenId`/`sucursalDestinoId` — un traspaso
mal validado podría vaciar stock hacia una sucursal ajena). No cambia ninguna firma pública, solo
agrega una rama de error donde hoy hay un hueco silencioso.

```ts
// Nueva: consolidado de UN producto en TODAS sus sucursales.
// Suma en SQL (no en JS con reduce) para no perder precisión con numeric(12,2)
// — corrección sobre el borrador original, señalada por la revisión adversarial.
export async function consultarStockConsolidado(
  solicitante: UsuarioConRol,
  productoId: string
): Promise<Resultado<{
  cantidadTotal: number;
  porSucursal: Array<{ sucursalId: string; cantidadActual: number; stockMinimo: number | null }>;
}>> {
  // cantidadTotal: repo.obtenerStockTotalProducto (ya existe, sql`coalesce(sum(...))`)
  // porSucursal: repo.listarStockPorProducto (ya existe, es lo que ya usa fichaProducto)
  // Sin query nueva — combina dos funciones de repository ya existentes.
}
```

Los otros dos ejes de agregación (`consultarStock` por sucursal, y `consultarStockTotalPorSucursal`
para todos los productos de una sucursal) **ya existen, sin cambios**. El cuarto casillero de la
matriz 2×2 —todos los productos, todas las sucursales, valor total de inventario del tenant— queda
fuera de Productos: es responsabilidad de Patrimonio/Reportes.

Los traspasos entre sucursales **no necesitan rediseño**: una vez resueltos los dos puntos de arriba,
`registrarTransferenciaStock` ya funciona de punta a punta. El gate de UI `sucursales.length > 1`
en `ficha-cliente.tsx` es la condición correcta tal como está — empieza a evaluar `true` el día que
exista la 2ª sucursal, sin tocar código.

### 3.3 Decisiones ya resueltas por esta propuesta (no reabrir)

- **`costo_operativo_vigente` se mantiene tenant-wide, sin ponderar.** Es una decisión de producto ya
  cerrada y documentada; además resuelve limpio el caso de traspasos (un traspaso no tiene que decidir
  qué costo "viaja" con la entrada en destino — es el mismo número en origen y destino). *Matiz
  importante encontrado por la revisión adversarial: ver riesgo en §3.4.*
- **Los traspasos siguen siendo atómicos/instantáneos** (salida+entrada en la misma transacción),
  sin modelar un estado "en tránsito" — el pedido es que lo que ya existe se vuelva alcanzable, no
  rediseñar el modelo de traspaso.

### 3.4 Riesgo confirmado por revisión adversarial — condición de carrera en `stock.cantidad_actual`

**Este es el hallazgo más importante de la verificación adversarial y debe resolverse antes de
habilitar 2+ sucursales en producción, no después.**

`recalcularCantidadActualTx` (`productos/repository.ts:223-265`) calcula `SUM(movimientos_stock)` y
después hace un `UPDATE` ciego sobre `stock.cantidad_actual`, sin `SELECT ... FOR UPDATE` ni
incremento atómico (`db/client.ts` no fija un nivel de aislamiento explícito — Postgres usa
`READ COMMITTED` por defecto). Dos escrituras concurrentes al **mismo** `(producto_id, sucursal_id)`
pueden producir un *lost update*: el ledger (`movimientos_stock`) queda siempre correcto porque es
append-only, pero la columna cacheada `stock.cantidad_actual` puede perder el efecto de una de las
dos transacciones, porque cada una calcula su suma antes de ver el commit de la otra.

**Este bug ya existe hoy** (dos ventas concurrentes del mismo producto en la única sucursal), pero
habilitar traspasos reales agrega una **segunda clase de escritor concurrente** sobre las mismas
filas que las ventas tocan — exactamente el objetivo declarado de esta propuesta ("que los traspasos
funcionen de verdad") es lo que sube la probabilidad real de dispararlo. Como `consultarStock`,
`descontarStockVenta` y la nueva `consultarStockConsolidado` leen todos la columna cacheada (no el
ledger), un stock consolidado calculado bajo esta condición **sí puede divergir del stock real**.

**Recomendación:** antes de habilitar 2+ sucursales en producción, pasar `recalcularCantidadActualTx`
a un `UPDATE ... SET cantidad_actual = cantidad_actual + $delta ... RETURNING` (incremento atómico) o
agregar `SELECT ... FOR UPDATE` antes de recalcular. Es un cambio acotado a una función.

**Riesgo relacionado, menor:** el costo tenant-wide "último valor gana" (§3.3) sí se corrompe de
forma concreta con 2+ sucursales operando de forma normal (no solo en traspasos): una compra en
Sucursal B pisa el costo vigente que ve una venta de stock viejo en Sucursal A. Se confirma con un
caso real ya en el código: `costoAdicionalTraslado` (landed cost, Proveedores) puede variar por
sucursal de destino pero solo se escribe en esa única columna tenant-wide. No bloquea esta propuesta,
pero debe quedar documentado como riesgo conocido y aceptado, no implícito.

### 3.5 Hallazgo crítico fuera de Productos, pero directamente relevante: costeo de insumo en Nicho 1

`crearEntradaCompraInsumoTx` (`nicho-1/repository.ts:183-242`) pondera `stockAntes` **filtrado por
sucursal** contra `costoUnitarioVigente`, que vive en `insumos` **sin** `sucursal_id` (tenant-wide).
Con 2+ sucursales comprando el mismo insumo, el promedio ponderado queda matemáticamente
contaminado — ejemplo concreto: Sucursal A tiene 100 unidades a Bs 10; la primera compra del mismo
insumo en Sucursal B (50 unidades a Bs 20) calcula `stockAntes=0` para B, da
`(0×10 + 50×20)/50 = 20`, y **sobrescribe el único `costo_unitario_vigente` del tenant a 20**,
perdiendo el historial de A aunque A siga teniendo 100 unidades reales a costo 10. Esto se propaga a
`registrarProduccion` — el costo de producción de una sucursal queda contaminado por compras de otra,
sin error ni aviso. Ningún test cubre este escenario hoy.

**Este es el único gap de schema con impacto financiero real** en todo el mapa de impacto. Se resuelve
moviendo el costo promedio ponderado a `stock_insumo` (que ya tiene `sucursal_id`), ver §7.3.

---

## 4. Sucursal como dimensión de permisos/RLS

Conviene separar dos cosas que hoy se confunden bajo el nombre "sucursal":

**(1) Sucursal como dato operativo** — ya resuelto por el modelo de §3, sin gap de diseño.

**(2) Sucursal como dimensión de autorización** — acá el gap es total, no parcial.
`tienePermiso(solicitante, tenantObjetivoId, modulo, accion)` no tiene parámetro de sucursal y **no
podría tenerlo hoy con sentido**: `usuarios` no tiene columna de sucursal ni tabla puente,
`moduloPermisoEnum` no incluye `"sucursales"`, y no existe (ni podría existir sin ambigüedad) un
`current_sucursal_id()` análogo a `current_tenant_id()` — porque `usuarios` no sabe hoy a qué
sucursal(es) está limitado un colaborador. Además, RLS en este proyecto es defensa en profundidad, no
el mecanismo primario: ninguna tabla de Identidad tiene `FORCE ROW LEVEL SECURITY`, y Drizzle corre
con el rol `postgres`, que la bypasea por completo — el filtrado real ocurre en la capa de
aplicación.

### 4.1 Propuesta — dos tracks separados

**Track A — alcance mínimo (necesario ya):**
1. ABM de sucursales en Identidad, siguiendo moldes que ya existen en el mismo módulo:
   `crearSucursal()`/`actualizarSucursal()` con el molde de `crearRolPersonalizado` (altas simples);
   `desactivarSucursal()`/`reactivarSucursal()` con el molde de `actualizarActivoUsuario`;
   `cambiarSucursalPrincipal()` con el molde de `transferirOwner()` — **dos `UPDATE` atómicos en la
   misma transacción**, porque `esPrincipal` está protegido por el mismo tipo de invariante de
   unicidad (índice único parcial) que `esOwner`, y un `UPDATE` de una sola fila podría violarlo
   transitoriamente bajo concurrencia.
2. Gate en `actions.ts`: `esOwner` directo (mismo patrón que `crearRolPersonalizado`), no
   `tienePermiso()` — `"sucursales"` no está ni debería estar en `moduloPermisoEnum` en esta etapa,
   mismo criterio ya aplicado a `"identidad"`.
3. Gate de plan server-side (§5) dentro de `crearSucursal()`.
4. Completar auditoría de la tabla (`creadoEn`/`creadoPor`/`modificadoPor`/`modificadoEn`).
5. **No tocar** `tienePermiso()`, `moduloPermisoEnum`, RLS, ni agregar columna de sucursal a
   `usuarios` en esta etapa. Todo colaborador sigue viendo/operando todas las sucursales de su
   tenant; solo elige cuál en cada pantalla — mismo patrón que ya usa Reportes hoy.

**Track B — extensión razonable de posponer (colaborador limitado a una sucursal):** solo se activa
si un tenant real lo pide. Implica una tabla puente `usuario_sucursal` (M:N, preferible a una columna
nullable en `usuarios` — "null = todas" es ambiguo con "no configurado todavía"), extender
`tienePermiso()` con un parámetro opcional de sucursal evaluado solo en los módulos
sucursal-sensibles, y recién ahí un `current_sucursal_id()` real + `AND` de sucursal en `crudPolicy()`
de las tablas concretas que lo necesiten. Por tamaño, amerita su propia sección grande en Modulo_01
(o un módulo satélite), no un agregado incremental.

---

## 5. Cómo se controla por plan

### 5.1 De boolean a tope numérico

Reemplazar `planes.incluyeSucursales: boolean` por **`planes.maxSucursales: integer nullable`**:

- `maxSucursales = 1` → equivalente exacto al `incluyeSucursales=false` de hoy (toda cuenta ya tiene
  la sucursal Principal).
- `maxSucursales = N` (N>1) → "hasta N sucursales".
- `maxSucursales = NULL` → ilimitadas.
- `CHECK (maxSucursales IS NULL OR maxSucursales >= 1)` — nunca 0, la Principal siempre existe.

Migración de datos: `incluyeSucursales=false → maxSucursales=1` es no ambiguo.
`incluyeSucursales=true → maxSucursales=?` **no lo puede decidir el código** — default seguro:
`NULL` (ilimitado), dejando que producto/ops corrija a mano el tope real de cada plan activo después.
Un helper `incluyeMultiSucursal(plan) = maxSucursales == null || maxSucursales > 1` cubre los
call-sites que solo necesitan sí/no (ej. "Mi Plan").

En `sucursales`, agregar una dimensión de estado distinta de `activa` (que hoy no la lee ningún
camino de escritura real — ver §6.4): `congeladaEn: timestamp nullable` +
`congeladaMotivo: text nullable`. Nunca se pisa con `UPDATE` arbitrario, mismo espíritu que
`eliminadoEn`.

### 5.2 Los dos puntos de gate

**a) Alta de sucursal** (`crearSucursal()`, a construir) — replica el único patrón real de
enforcement de un atributo de plan que existe en el proyecto, `generarCodigoAcceso`
(`consentimiento/actions.ts:390-428`): resolver tenant → `obtenerPlanPorId` → contar sucursales
activas no congeladas → si `count >= maxSucursales` (y no es null) → error.

**b) Downgrade de plan** (`cambiarPlanTenant`, ya existe) — antes de persistir el cambio, comparar
sucursales activas contra `maxSucursales` del plan destino. Si sobran, dispara el flujo de
congelamiento de §6 — **no aborta la operación** (ver por qué en §6.1).

---

## 6. Manejo del downgrade

### 6.1 Qué pasa con el excedente — recomendación

**Congelamiento operativo**, ni bloqueo duro del downgrade ni solo-lectura total:

- El cambio de plan **se completa igual** — no crea una dependencia circular donde staff no puede
  forzar que el dueño reaccione, y es consistente con cómo este proyecto ya resuelve casos análogos
  (H-45/H-46: "el sistema actúa, no bloquea").
- Las sucursales excedentes quedan **congeladas, no eliminadas ni ocultas**: siguen siendo 100%
  consultables (historial, stock, reportes — cumple soft-delete/ledger-append-only), pero bloqueadas
  para escritura transaccional nueva (ventas, movimientos de stock, altas asignadas a ellas).

### 6.2 Bordes resueltos

| Pregunta | Recomendación | Por qué |
|---|---|---|
| ¿La sucursal Principal puede congelarse? | **Nunca.** | El tope mínimo posible ya es 1 (la Principal la cubre sola); es el ancla de la que cuelgan otros módulos. Protegida además por el índice único parcial existente. |
| ¿Quién decide cuáles sucursales quedan activas si N→M<N? | Criterio objetivo (**más nuevas primero por fecha de creación**, excluyendo siempre Principal) como default, con **preview editable** antes de confirmar. | Dato que Identidad ya tiene sin cruzar módulos (a diferencia de "por actividad reciente", que rompería la caja negra). |
| ¿Reactivación automática al subir de plan? | **No — explícita, sucursal por sucursal, con aviso proactivo.** | Durante el congelamiento el dueño pudo haber cerrado esa sucursal por motivos propios; reactivar en automático arriesga reabrir algo con datos obsoletos sin decisión consciente. |
| ¿Cómo se avisa antes de confirmar? | `previsualizarCambioPlan()` de solo lectura, en el mismo diálogo de cambio de plan. | Barato, reutiliza `listarSucursalesPorTenant()`. Un aviso asíncrono (email) sería ideal pero depende de infraestructura que H-45 ya documenta como inexistente — se registra como dependencia, no bloquea esto. |

### 6.3 Huecos reales encontrados por la revisión adversarial — resolver antes de construir

La verificación adversarial confirma que la dirección general es sólida (tope numérico, congelamiento
operativo, exclusión de Principal, reactivación explícita: nada de eso hay que romper), pero encontró
huecos concretos, verificados contra el código, no especulativos:

1. **Atomicidad de la operación de downgrade+congelamiento.** `actualizarPlanTenant`
   (`identidad/repository.ts:249-260`) es hoy un `UPDATE` suelto, sin transacción. Si el cambio de
   `planId` y la escritura de `congeladaEn` en las sucursales excedentes no quedan en una sola
   transacción, un crash a mitad de camino deja al tenant en el plan nuevo con sucursales excedentes
   **sin congelar** — reproduciendo el patrón de H-47 ("downgrade que no reconcilia nada") un nivel
   más abajo. Usar el mismo molde de `transferirOwner()` (dos escrituras atómicas), no solo para
   cambiar la Principal.

2. **Venta a mitad de camino.** `registrarVenta` **no** es atómica con `descontarStockVenta`
   (gap de atomicidad ya documentado en `ventas/ANCLA.md`, sin compensación automática). Si una
   sucursal se congela justo en esa ventana, el gate rechazaría el descuento de stock pero la Venta
   ya estaría confirmada (con snapshot y deuda del cliente generada) sin stock descontado — la
   propuesta convierte un gap ya aceptado en un evento sistemático disparado por una decisión propia
   del sistema. No resuelto por esta propuesta; requiere envolver ambos pasos en una transacción o un
   lock de fila durante la ventana.

3. **Transferencia con un solo lado congelado.** `crearTransferenciaStockTx` mueve stock entre dos
   sucursales en una sola transacción. La regla "bloquear movimientos nuevos en una sucursal
   congelada" no dice qué pasa si **solo una** de las dos sucursales de la transferencia está
   congelada — tal como está escrita, ningún traspaso podría sacar stock de una sucursal recién
   congelada hacia una activa, que es justamente el único mecanismo natural para "liquidar" su
   inventario. Hay que permitir explícitamente **salida** desde una sucursal congelada, bloquear solo
   **entrada** hacia ella.

4. **`listarSucursalesPorTenant()` tiene dos usos opuestos hoy y una sola respuesta.** La usan tanto
   pantallas de reporte (deberían incluir congeladas) como selectores operativos de escritura
   (deberían excluirlas). Si se filtra para excluir congeladas, Reportes deja de poder filtrar por
   ellas pese a que §6.1 promete que siguen siendo consultables; si no se filtra, cualquier pantalla
   operativa sigue ofreciéndolas como destino válido y el rechazo llega recién al confirmar — con el
   mensaje engañoso "la sucursal no existe" (`registrarVenta` ya usa esa función y ese mensaje
   exacto) para una sucursal que sí existe, solo está congelada. **Hace falta bifurcar la función**
   (o agregar un parámetro `incluirCongeladas`), no reutilizarla tal cual.

5. **El precedente real de "pausada" es más duro que lo que esta propuesta construye, y el análogo
   correcto ya existe centralizado.** `calcularEstadoAcceso()` resuelve `pausada` → bloqueo TOTAL
   (H-46, sin período de gracia). El análogo estructural a "congelamiento operativo" (lectura sí,
   escritura no) es `estadoAcceso = 'solo_lectura'`, resuelto en un **único choke point**:
   `tienePermiso()` tiene la línea `if (estadoAcceso === 'solo_lectura' && accion !== 'ver') return
   false`, reutilizada automáticamente por todos los módulos sin código propio. Ese mecanismo opera
   solo a nivel tenant hoy (sin parámetro de entidad). **Recomendación revisada:** en vez de replicar
   el chequeo de congelamiento módulo por módulo (Ventas, Productos, y también Patrimonio y Gastos,
   que tienen `sucursal_id` propio y no estaban en el radar original de riesgos), evaluar extender
   `tienePermiso()` con un parámetro de entidad/sucursal — es el patrón que este proyecto ya
   demostró que escala, replicar checks locales no.

6. **`sucursales.activa` es hoy tan decorativo como `incluyeSucursales`.** Confirmado: ningún camino
   de escritura real lo lee (`registrarVenta` valida pertenencia al tenant, no `activa`; no existe
   `actualizarSucursal()` que lo togglee). El diseño de `congeladaEn` debe evitar el mismo destino:
   sin enganchar los módulos reales que escriben con `sucursal_id` (Ventas, Productos/Stock,
   Patrimonio, Gastos, Operativo Nicho 1), corre el riesgo de terminar tan decorativo como `activa` e
   `incluyeSucursales` hoy.

7. **El criterio "más nueva primero" depende de una columna (`creadoEn`) que no existe todavía.**
   Al agregarla (§7.2), todas las sucursales existentes al momento de la migración reciben el mismo
   timestamp (el de la migración, no su fecha de creación real, que nunca se guardó) — el criterio
   queda indefinido exactamente para la población más antigua, la más probable de tener un primer
   downgrade con exceso. No tiene una solución limpia sin un dato que hoy no existe; documentarlo
   como limitación conocida del criterio automático (el preview editable mitiga, no resuelve).

8. **H-47 es una pregunta de producto todavía abierta, no solo evidencia de "hoy no pasa nada".**
   Congelar automáticamente al bajar de plan elige un lado de esa pregunta (revocar acceso) sin
   señalar que, si CEOM resuelve H-47 hacia "respetar lo ya compartido" para Consentimiento,
   quedarían dos filosofías de downgrade opuestas conviviendo sin que nadie lo haya decidido en
   conjunto. Vale la pena resolver H-47 (decisión D6 de
   [04-camino-al-lanzamiento.md](04-camino-al-lanzamiento.md)) antes o junto con esto, no después.

---

## 7. Migración de negocios existentes

### 7.1 Corrección de premisa

El pedido original sugería `pasivos` como tabla que "probablemente necesite" `sucursal_id`. El mapa
de impacto (§1.3) dice lo contrario, con evidencia: es una decisión de negocio ya tomada y
documentada. **No se agrega.** El gap real ahí es de una línea de wiring: `registrarPagoPasivo` nunca
pasa `activo?.sucursalId` a `generarGastoCuotaPasivo` (Etapa 6, más abajo).

### 7.2 Migración A — `sucursales`: columnas de auditoría faltantes

Necesaria antes del ABM (Etapa 1) — no tiene sentido escribir `actualizarSucursal()` sin dónde
auditar el cambio. Agrega `creadoPor`/`creadoEn`/`modificadoPor`/`modificadoEn`, backfilleadas desde
`tenants.creadoEn` (la sucursal Principal nace en la misma transacción que el tenant) y el Owner
actual del tenant como mejor aproximación de `creadoPor` (caveat: si hubo `transferirOwner()`, apunta
al Owner vigente, no al fundador original — aceptable para auditoría retroactiva, no para uso legal).
Secuencia expand → backfill → contract (nullable, backfill, recién después `NOT NULL`), sin downtime
— la tabla tiene hoy una sola fila por tenant.

### 7.3 Migración B — costeo de insumo por sucursal (Nicho 1)

La única migración con carga financiera real (§3.5). Agrega `stock_insumo.costo_promedio_vigente`
(nullable, mismo criterio que `insumos.costo_unitario_vigente` hoy), backfilleada 1:1 desde
`insumos.costo_unitario_vigente` — hoy cada insumo tiene como máximo una fila en `stock_insumo` (una
sola sucursal por tenant), así que el backfill es exacto, sin pérdida ni ambigüedad. **Transición de
dos pasos, no big-bang:** en la Etapa 5 del rollout, `crearEntradaCompraInsumoTx` pasa a leer/escribir
la nueva columna como fuente de verdad pero sigue también escribiendo `insumos.costo_unitario_vigente`
(dual-write) mientras queden lectores no migrados. La migración de cierre que elimina la columna vieja
se agenda aparte, condicionada a verificar la nueva en producción con un tenant real de 2+ sucursales
— no en este mismo lote.

### 7.4 Lo que se decide no migrar ahora

`usuarios.sucursalId` / tabla puente (Track B de autorización), `moduloPermisoEnum` con valor
`"sucursales"`, `current_sucursal_id()` — ninguno tiene sentido sin resolver antes el Track B de §4,
y hoy no hay caso real que lo pida.

---

## 8. Plan de sub-etapas verificables por separado

Ordenado por riesgo real y dependencias — cada una mergeable a `dev` y verificable con `pnpm test`/
`pnpm typecheck` sin dejar nada roto a mitad de camino.

| Etapa | Contenido | Riesgo | Depende de |
|---|---|---|---|
| **0** | Migraciones A y B (§7.2-7.3). Solo agrega columnas, nadie las usa todavía. | Mínimo (aditivo puro) | — |
| **1** | ABM de Sucursales (`crearSucursal`/`actualizarSucursal`/`desactivarSucursal`/`reactivarSucursal`/`cambiarSucursalPrincipal`), **sin** gating de plan ni de stock — se prueba el ABM aislado primero. UI nueva en `/app/mi-negocio/sucursales`. | Bajo — no toca tablas operativas | Etapa 0 |
| **2** | Gating por plan: `crearSucursal`/`reactivarSucursal` validan `maxSucursales`. | Bajo | Etapa 1 |
| **3** | Cerrar el hueco de autorización de `sucursal_id` (§3.1) en Productos **y en Nicho 1** (`registrarEntradaCompraInsumo`, `registrarAjusteManualInsumo`, `registrarMermaAlmacenamiento`, `registrarProduccion`) y en `ventas/importarVentaHistorica` — la revisión adversarial confirmó que el mismo hueco existe ahí y no estaba en el alcance original. Despertar la UI ya construida (traspasos, transferencia de activo, selectores de Compra/Evento/Importar). Trabajo nuevo real: selector de sucursal en el POS, mostrar/filtrar sucursal en Historial y Ficha de Venta, `abrirEvento` validando tenant. | Medio (toca el POS) | Etapa 1 |
| **4** | Agregaciones por sucursal: `costoFijoTotal`/`margenPorProducto` (Financiero), distribución de Gastos, `rankingProductos`/`historicoVentas`/`margenPorCanalYProducto` (Ventas), listado de Compras/ficha de Proveedor, `listarActivosPorTenant`. `GastoForm` gana el selector. | Bajo-medio (parámetro opcional, aditivo) | Etapa 1 |
| **5** | Costeo de insumo por sucursal (Nicho 1, §3.5/§7.3): dual-write, `obtenerComposicionReceta` con `sucursalId` obligatorio, validación cruzada `activo.sucursalId` vs `producción.sucursalId`. | **Alto — toca un número financiero** | Etapa 0 (migración B) |
| **6** | `registrarPagoPasivo` propaga `activo?.sucursalId` a `generarGastoCuotaPasivo`. | Bajo | — |
| **7 (diferida)** | Fix del race condition de `stock.cantidad_actual` (§3.4) — recomendado **antes** de la Etapa 3 en producción, aunque el bug es preexistente y no depende estrictamente de sucursales. | Medio | — |
| **8 (diferida)** | Downgrade con excedente de sucursales (§6), condicionado a resolver primero los 8 huecos de §6.3. | — | Etapas 1-5 |
| **9 (diferida)** | Autorización por sucursal (Track B, §4.1) — solo si un tenant real la pide. | — | — |

---

## 9. Plan de tests

### 9.1 Molde a usar

`tenant-aislamiento.test.ts` (Patrimonio, Proveedores) **no es el molde correcto acá**: prueba
aislamiento cross-tenant vía RLS real, y hoy no existe ninguna dimensión de sucursal en RLS. El molde
correcto ya existe: el `beforeAll` de `productos.test.ts` y `patrimonio.test.ts` — crea el tenant vía
`crearTenantConOwner()` (da la Principal) e inserta la segunda sucursal directo con
`db.insert(sucursales)`, porque hoy no hay otra forma. Es lógica de negocio de aplicación, no RLS.
Regla de caja negra del proyecto: un test de Ventas que verifique stock de Productos usa solo la API
pública de Productos (`consultarStock`), nunca su schema/repository directo.

### 9.2 Los tres criterios pedidos, cada uno con su test

1. **El stock por sucursal suma exactamente el stock general.** Nuevo
   `productos/sucursal-aislamiento.test.ts`: cargar stock en sucursal A (30) y B (20) vía
   `registrarAjusteManualStock`, verificar `consultarStock` por cada una, y que
   `repo.listarStockPorProducto` sumado dé 50. Segundo caso: una transferencia de 15 de A a B mueve
   exactamente esa cantidad (A queda en 25, B en 35 — nunca más ni menos).
2. **Una venta en sucursal A no toca el stock de B.** Nuevo `ventas/sucursal-aislamiento.test.ts`:
   cargar 20 en cada sucursal, vender 5 en A vía `registrarVenta`, verificar A=15 y B=20 intacto —
   cruzando módulos solo por la API pública.
3. **Un negocio de una sola sucursal se comporta idéntico a hoy.** Dos capas: (a) regresión por
   no-modificación — si toda la suite existente sigue en verde sin tocar esos archivos después de cada
   sub-etapa (ninguno pasa hoy un `sucursalId` distinto de la Principal), eso ya es la prueba; (b) test
   explícito de equivalencia por cada función que gana `opts.sucursalId` en la Etapa 4 (ej.
   `costoFijoTotal(..., {})` === `costoFijoTotal(..., {sucursalId: principal})`), y uno para el
   costeo de insumo (Etapa 5: el número nuevo debe coincidir con el que daba el código viejo cuando
   solo hay una sucursal).

### 9.3 El test que prueba el hallazgo crítico (Etapa 5)

Extensión de `operativo-nicho1.test.ts`: comprar el mismo insumo en sucursal A (100 @ Bs10) y B
(50 @ Bs20, primera compra ahí) — el costo promedio de A debe seguir en 10, el de B debe ser 20; hoy,
sin el fix, ambos terminan en 20 (el bug de §3.5). Segundo caso: `registrarProduccion` debe rechazar
un `activoId` cuya `sucursalId` no coincida con la de la producción.

### 9.4 Extensión de moldes existentes (sin archivo nuevo)

- `financiero.test.ts` ya tiene el patrón exacto para `costoFijoTotal`/`margenPorProducto` en cuanto
  ganen `opts.sucursalId` (setup con 2ª sucursal en líneas 61-104, test de filtro en 376-402).
- `identidad.test.ts`: `crearSucursal` rechaza sin plan que la incluya y la acepta con uno que sí;
  `cambiarSucursalPrincipal` deja exactamente una fila `esPrincipal=true` (nunca 0 ni 2);
  `desactivarSucursal` rechaza si es la única activa o si es la Principal.

---

## 10. Decisiones abiertas — resumen con recomendación

| # | Decisión | Recomendación |
|---|---|---|
| 1 | ¿`costo_operativo_vigente` de Productos se vuelve por sucursal o ponderado? | **Mantener statu quo** (tenant-wide, "último valor gana") — decisión de producto ya cerrada, y resuelve limpio el caso de traspasos. |
| 2 | ¿Se corrige la contaminación de costo en Nicho 1 (§3.5)? | **Sí — es el único gap de schema con impacto financiero real.** Ver Migración B (§7.3) y Etapa 5. |
| 3 | ¿Dónde se gatea la creación de una 2ª sucursal? | `crearSucursal()` nueva en Identidad, gateada por `esOwner` + plan — no integrada al flujo de upgrade de Suscripción. |
| 4 | ¿Un colaborador puede quedar limitado a una sola sucursal? | **No en esta etapa** (Track A: todos ven todas). Documentar como Track B, activar solo si un tenant real lo pide. |
| 5 | Si hace falta scoping de usuario, ¿columna nullable o tabla puente? | Tabla puente `usuario_sucursal` (M:N) cuando llegue el momento — evita la ambigüedad de "null = todas". |
| 6 | ¿RLS gana una condición de sucursal ahora? | **No.** El filtro de sucursal queda a nivel de aplicación, igual que ya hace Reportes — agregar `current_sucursal_id()` sin una fuente real sería código muerto o una policy engañosa. |
| 7 | ¿Cómo se modela el tope de sucursales por plan? | Una sola columna `planes.maxSucursales` (integer nullable, 1=solo Principal, null=ilimitado) reemplazando el boolean — no dos columnas paralelas, no una tabla clave-valor genérica. |
| 8 | ¿Qué pasa con el excedente al bajar de plan? | **Congelamiento operativo** (lectura sí, escritura no) — nunca bloqueo duro del downgrade ni silencio. Ver §6.3 para los 8 huecos a resolver antes de construir. |
| 9 | ¿La sucursal Principal puede congelarse? | **Nunca.** |
| 10 | ¿Reactivación automática al subir de plan? | **No — explícita**, con aviso proactivo. |
| 11 | ¿Cómo se avisa antes de confirmar el downgrade? | `previsualizarCambioPlan()` de solo lectura como mínimo indispensable; notificación asíncrona es mejora futura dependiente de infraestructura que hoy no existe (H-45). |
| 12 | ¿El congelamiento se enforce módulo por módulo o extendiendo `tienePermiso()`? | **Extender `tienePermiso()`** con un parámetro de entidad/sucursal si es viable — es el patrón que ya escala en este proyecto (`solo_lectura`); replicar checks locales en 5+ módulos es la alternativa inferior. |
| 13 | ¿`insumos.costo_unitario_vigente` queda en dual-write permanente? | **No — agendar su eliminación** como migración de cierre explícita, condicionada a verificar la nueva columna en producción. |
| 14 | ¿El race condition de `stock.cantidad_actual` (§3.4) se corrige junto con esto? | **Sí, antes de la Etapa 3 en producción** — es preexistente, pero esta propuesta sube su probabilidad real. |
| 15 | ¿Se resuelve H-47 (downgrade vs. consentimientos) antes o junto con esto? | Antes o junto — congelar sucursales automáticamente elige un lado de esa pregunta de producto todavía abierta; resolverlas por separado arriesga dos filosofías de downgrade inconsistentes en el mismo sistema. |

---

## 11. Qué NO se resuelve en este documento (a propósito)

- El mecanismo exacto de notificación asíncrona del ciclo de suscripción (depende de H-45, fuera de
  alcance).
- Autorización por sucursal a nivel de usuario (Track B) — diferida hasta que exista un caso real.
- La migración de cierre que elimina `insumos.costo_unitario_vigente` — se agenda aparte, después de
  verificar la Etapa 5 en producción.
- Cualquier cambio de UI/UX de detalle (íconos, copy) — este documento se detiene en el contrato de
  datos y funciones; el diseño visual de las 6+ pantallas nuevas/tocadas queda para cuando se apruebe
  el alcance.
