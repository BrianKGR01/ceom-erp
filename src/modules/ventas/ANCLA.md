# ANCLA — Módulo: Ventas + Clientes

## Contrato (no romper sin actualizar este archivo)
- Responsabilidad: registra cada venta, congela el doble snapshot
  (precio/costo) por línea, descuenta stock real en Productos e Inventario,
  y calcula (sin disparar todavía un Gasto real) la comisión automática por
  canal o evento. Clientes vive dentro de este módulo (alta implícita al
  vender, sin pantalla propia) — no es un módulo aparte.
- NO hace: nunca calcula precio ni costo por su cuenta (los toma prestados
  de Productos e Inventario en el momento exacto de la venta). No genera un
  `Gasto` real por comisión (Costos y Gastos, Módulo 4, no existe todavía).
  No edita ni hace soft-delete de una Venta ya registrada — toda corrección
  pasa por `AjusteVenta`.
- Entradas que consume: `tienePermiso()`/`tieneCapacidadEspecial()` de
  Identidad (gate por `"ventas"` × acción, y por `"gestionar_eventos"`/
  `"importar_historico"` — los tres ya existían en el catálogo de Identidad,
  sin cambios de enum). `consultarPrecioVenta()`, `consultarCostoOperativo()`,
  **`descontarStockVenta()`** y `registrarAjusteManualStock()` de Productos e
  Inventario (Módulo 2, caja negra vía `actions.ts`) — el descuento de stock
  es real, no un stub. `tenants`/`sucursales` de Identidad y `productos` de
  Módulo 2 para FKs (dirección de dependencia esperada, `CEOM_Arquitectura.md`
  sección 7).
- Salidas que expone (`actions.ts`): CRUD de `Cliente`/`CanalVenta`/
  `MetodoPago`/`Evento` + `registrarVenta`, `registrarAjusteVenta`,
  `registrarPagoVenta`, `listarVentas`, `listarVentasConTotal` (agregada al
  construir el Listado de Ventas — `listarVentas` no trae el total por fila,
  este wrapper lo agrega con `obtenerTotalVenta` por fila, mismo patrón que
  `listarSucursalesPorTenant`/`listarMovimientosStock` de Identidad/
  Productos), `fichaVenta`, `importarVentaHistorica`
  + fórmulas puras (`calcularSubtotal`, `calcularComision`) +
  `consultarIngresosPeriodo`, `consultarPagosVentaEnPeriodo`,
  `consultarAjustesVentaEnPeriodo` (agregados de solo lectura por período,
  agregados en Módulo 7 para que Financiero consuma Ventas sin importar
  `ventas`/`detalles_venta` directo) + `consultarUnidadesVendidasPeriodo`
  (roadmap ítem #13, agregado de solo lectura para Simulaciones —
  "rotación" de un producto en un período) + `rankingProductos`,
  `historicoVentas`, `margenPorCanalYProducto` (roadmap ítem #14, agregados
  de solo lectura para Reportes — devuelven ingresos/costos crudos, **sin**
  `margenPct` calculado, ver `reportes/ANCLA.md` sección "Decisiones" para
  el motivo — evitar un ciclo de imports con Financiero).

## Estado actual
- [x] Schema Drizzle (`clientes`, `canales_venta`, `metodos_pago`, `eventos`,
      `ventas`, `detalles_venta`, `ajustes_venta`, `pagos_venta`) + RLS
      (`crudPolicy()` en las tablas con `tenant_id` directo; policy vía
      subquery en las demás, mismo patrón que los módulos anteriores).
      `ventas` **sin `eliminado_en`** a propósito (sección 1.1 del doc, nota
      deliberada) — su única corrección es `AjusteVenta`.
- [x] Snapshot doble real: `precio_venta_snapshot`/`costo_unitario_snapshot`
      se congelan al momento de `registrarVenta`, verificado con test que
      cambia el precio del producto después y confirma que la venta ya
      registrada no se altera.
- [x] `registrarVenta` **descuenta stock real** en Productos e Inventario vía
      `descontarStockVenta()` — no es un stub. El descuento ocurre DESPUÉS de
      confirmar la Venta (necesita su `id` como `referenciaId`), mismo gap de
      atomicidad cruzada ya documentado y aceptado en Módulo 6: si el
      descuento falla después de confirmada la Venta, no hay rollback
      automático — el resultado expone `descuentosStock` (`{ok, error}` por
      línea) para que el caller lo detecte.
- [x] Comisión automática (regla 5/4.3): por `evento.porcentajeComision` si
      la venta pertenece a un Evento, si no por `canal.porcentajeComisionDefault`
      — se calcula y **persiste** en la propia `Venta`
      (`comisionPorcentajeAplicado`/`comisionMontoCalculado`). No dispara un
      `Gasto` real (Módulo 4 no existe) — decisión del plan de esta tarea, el
      dato queda listo para cuando ese módulo exista.
- [x] `registrarAjusteVenta`: motivo obligatorio, nunca edita la Venta
      original; si `cantidadProductoAjustada` viene, dispara un
      `entrada_ajuste_manual` **real** en Módulo 2 (requiere `productoId`,
      adenda no explícita del doc — ver decisiones abajo); si
      `tipo=devolucion` y `generaPagoNegativo=true`, crea un `Pago de Venta`
      con `monto` negativo en la misma operación (regla 7).
- [x] `registrarPagoVenta` transiciona `estado_pago`
      pendiente→parcial→pagado, calculado contra el total derivado de
      `detalles_venta` (`Venta` no persiste un `monto_total` propio).
- [x] `importarVentaHistorica` (sección 6.2, caso borde 4): gateada a Owner o
      capacidad `importar_historico`, **no** consulta ni descuenta stock en
      Módulo 2, **no** calcula comisión — snapshots vienen directo del
      input, `origen_registro=importacion_historica`.
- [x] Regla 6 (estado de acceso `solo_lectura`/`bloqueado`) **no requirió
      código propio** — ya la resuelve `tienePermiso()` de Identidad para
      cualquier módulo que la use correctamente; verificado con test.
- [x] Tests: `formulas.test.ts` (puro) + `ventas.test.ts` (integración
      contra Supabase Cloud real, 9 casos de la prueba de caja negra).
- [ ] **Gap de atomicidad cruzada, aceptado a propósito** (mismo criterio que
      Módulo 6): la Venta se confirma antes de descontar stock en Módulo 2;
      si esa llamada falla, queda una Venta sin el stock correspondiente
      descontado. Sin compensación automática.
- [x] Comisión calculada y persistida en `Venta` **ya tiene consumidor real**:
      Módulo 4 (`src/modules/gastos/`) — `generarGastoComisionVenta()` lee
      `comisionMontoCalculado` vía `fichaVenta()` y crea el `Gasto`
      correspondiente ya pagado. Sigue sin un trigger automático que la
      llame justo después de `registrarVenta()` (eso tocaría el contrato de
      Ventas, no declarado en la tarea de Módulo 4) — hay que invocarla a
      mano o desde un futuro orquestador.
- [ ] Pre-carga automática de `CanalVenta` desde el onboarding (sección 1.5)
      **fuera de esta tarea** — la UI de onboarding no existe todavía
      (pendiente ya documentado en `identidad/ANCLA.md`).
- [ ] Captura offline real (sección 6.1, `origen_registro=offline_sincronizado`)
      no tiene mecanismo de sincronización propio — el enum acepta el valor
      y `registrarVenta` lo admite como parámetro opcional, pero no hay app
      offline todavía que lo dispare solo.

## Dónde está cada cosa
- Esquema de BD (Drizzle): `src/modules/ventas/schema.ts`
- Repository: `src/modules/ventas/repository.ts`
- Server actions: `src/modules/ventas/actions.ts`
- Tests: `src/modules/ventas/formulas.test.ts`, `src/modules/ventas/ventas.test.ts`
- Migración relevante: `drizzle/migrations/0014` (tablas + RLS, todo en una
  sola migración).

## Decisiones tomadas que un agente no debe revertir
- **`ajustes_venta.producto_id` es una adenda no explícita del doc**
  (`Modulo_03_ventas.md` sección 1.3 no lo lista) — decisión del plan de
  esta tarea: sin él, no hay forma de saber a qué línea corresponde
  `cantidad_producto_ajustada` en una venta con varios productos (caso
  borde 2). Nullable, obligatorio en la práctica solo cuando
  `cantidadProductoAjustada` viene en el input (`actions.ts` lo valida).
  Mismo criterio que `vida_util_dias` en Módulo 2 (adenda originada en otro
  módulo).
- **Comisión persistida en `Venta`, no en una tabla "Gasto" propia** — se
  descartó explícitamente modelar una entidad `Gasto` dentro de Ventas (eso
  pertenece a Costos y Gastos, Módulo 4). Cuando ese módulo exista, lee
  `ventas.comisionMontoCalculado` para crear su propio registro — no hay
  que migrar el dato, ya está en el lugar correcto para consultarse.
- **`metodos_pago` sin `eliminado_en`** — la baja es el booleano `activo`,
  mismo criterio que `planes` en Suscripción (el doc no lista `eliminado_en`
  para esta entidad, a diferencia de las demás del módulo).
- **`registrarVenta` calcula TODOS los snapshots antes de crear la Venta**,
  y descuenta stock DESPUÉS de crearla (necesita el `id` como
  `referenciaId`) — este orden es intencional, no accidental: si el cálculo
  de un snapshot falla a mitad de una venta con varias líneas, no queda una
  Venta a medio crear.
- **`importarVentaHistorica` no reutiliza `consultarPrecioVenta`/
  `consultarCostoOperativo` de Módulo 2** — los snapshots vienen directo del
  input a propósito, porque el doc asume que el producto podría ya no
  existir. En la práctica, como `detalles_venta.producto_id` tiene FK real
  a `productos.id`, un producto **soft-eliminado** sigue sirviendo (la fila
  sigue existiendo), pero uno borrado físicamente (no ocurre en este
  proyecto, `AGENTS.md` regla 5 prohíbe `DELETE` físico) rompería la
  importación igual — limitación teórica, no real dado el resto de reglas
  del proyecto.
- **`gestionar_eventos` no tiene bypass de Owner** — igual que
  `tieneCapacidadEspecial()` en general (ver ANCLA de Módulo 2/6), el Owner
  necesita el override explícito en `permisos_especiales_por_usuario` o
  `permisos_especiales_por_rol`, no lo tiene gratis. `importar_historico` sí
  tiene bypass expreso para Owner (`solicitante.esOwner ||`), porque el doc
  lo pide explícitamente en la sección 6.2 ("restringida al rol Owner, o a
  un rol con la capacidad especial...").
- Los tests de integración corren contra el Supabase Cloud de desarrollo
  real (rol `postgres`, bypassea RLS), mismo criterio que los demás módulos.
  Este archivo fija `testTimeout: 20000` para todo el archivo (`vi.setConfig`)
  en vez de por-test — `registrarVenta` hace varias transacciones
  secuenciales y la mayoría de los tests del archivo lo necesitan, a
  diferencia de Módulo 2/6 donde era la excepción puntual.

## Última actualización: 2026-07-16 — Rediseño visual de POS/Historial/Ficha de venta: `registrarPagoVentaSchema` (ruta) ahora reenvía `fechaPago` (el módulo ya lo aceptaba, faltaba el wiring — mismo caso que `listarVentasConTotal`). Sin cambios de contrato. Se agregó `scripts/seed-demo-data.ts` (`pnpm seed:demo`) para poblar un tenant existente con categorías/productos/stock/canales/métodos/clientes/ventas/ajustes de prueba usando siempre las funciones de negocio reales de este módulo y de Productos.

## Actualización 2026-07-16 (2) — Gestión de Clientes (CRUD completo)
- Pantalla `/app/ventas/clientes` (`page.tsx` + `clientes-cliente.tsx`): listado con buscador,
  alta/edición vía Dialog (react-hook-form + zod), eliminar (soft delete) con confirmación inline.
  Mismo patrón visual que Historial de Ventas (lista de filas, `docs/design-system.md` §5.5).
- `clienteFormSchema` (`validation.ts`) se extendió con `email` (ya existía en `DatosCliente`/
  `actions.ts`, solo faltaba exponerlo en el formulario) — no es un cambio de contrato del módulo.
- Se agregaron `actualizarClienteAction`/`eliminarClienteAction` en la ruta
  (`src/app/app/(shell)/ventas/actions.ts`), delgadas sobre `actualizarCliente`/`eliminarCliente`
  ya existentes en `actions.ts` del módulo — sin lógica nueva de negocio.
- Verificado end-to-end en navegador (alta, edición, eliminación, búsqueda) contra el tenant de
  prueba (`owner@ceom.local`). Nota de herramienta: el diálogo de Base UI queda con
  `data-closed` pero visualmente montado cuando la pestaña del navegador de automatización está
  en `document.visibilityState = "hidden"` (la animación de salida depende de `animationend`, que
  Chrome no dispara en pestañas en segundo plano) — confirmado como artefacto de la herramienta,
  reproducible también en el Dialog ya existente de "Gestionar categorías" (Catálogo), no es un
  bug de esta pantalla ni del componente `Dialog` compartido en un navegador real en primer plano.

## Actualización 2026-07-16 (3) — Gestión de Canales de Venta (CRUD completo)
- Pantalla `/app/ventas/canales` (`page.tsx` + `canales-cliente.tsx`): grid de cards
  (`docs/design-system.md` §5.3), `Switch` de `activo` inline en cada card, alta/edición de
  `nombre`/`porcentajeComisionDefault` vía Dialog, eliminar (soft delete, `canales_venta` sí tiene
  `eliminado_en`) con confirmación inline.
- **Cambio de contrato aditivo** (no rompe callers existentes): `DatosCanalVenta` y
  `actualizarCanalVenta` (`actions.ts`) ahora aceptan `activo?: boolean` — antes solo permitían
  tocar `nombre`/`porcentajeComisionDefault`. Necesario para el toggle de la card; `activo` ya
  existía en el schema/repository, solo faltaba el wrapper público.
- De paso se agregó `reactivarMetodoPago` (simétrico a `desactivarMetodoPago` ya existente) para
  la próxima pantalla (Métodos de Pago) — mismo criterio, aditivo.
- Se agregaron `actualizarCanalVentaAction`/`toggleCanalVentaActivoAction`/
  `eliminarCanalVentaAction` en la ruta (`src/app/app/(shell)/ventas/actions.ts`).
- Verificado end-to-end en navegador (alta, edición vía toggle, eliminar) contra el tenant de
  prueba — datos de demo restaurados a su estado original tras la prueba.

## Actualización 2026-07-16 (4) — Gestión de Métodos de Pago (CRUD completo)
- Pantalla `/app/ventas/metodos-pago` (`page.tsx` + `metodos-pago-cliente.tsx`): filas simples
  (ícono + nombre) con `Switch` de `activo` inline, alta/edición de `nombre` vía Dialog. Sin
  eliminar (`metodos_pago` no tiene `eliminado_en` a propósito, sección 1.7 del doc) — la baja es
  el toggle, usando `reactivarMetodoPago` agregado en la actualización anterior.
- Se agregaron `actualizarMetodoPagoAction`/`toggleMetodoPagoActivoAction` en la ruta.
- Verificado end-to-end en navegador (alta, edición, toggle activo/inactivo) contra el tenant de
  prueba — el método de prueba quedó desactivado al cerrar (no se puede eliminar, por diseño).

## Actualización 2026-07-16 (5) — Gestión de Eventos
- Pantalla `/app/ventas/eventos` (`page.tsx` + `eventos-cliente.tsx`): filas con nombre/sucursal/
  canal, fechas, comisión, badge de estado, botón Cerrar/Reabrir. Alta vía Dialog — el canal
  elegido precarga `porcentajeComisionDefault` en el campo de comisión (editable).
- Se agregó `eventoFormSchema` (`validation.ts`) y las rutas
  `abrirEventoAction`/`actualizarComisionEventoAction`/`cerrarEventoAction`/`reabrirEventoAction`.
  Sin cambios de contrato del módulo — `abrirEvento`/`cerrarEvento`/`reabrirEvento` ya existían.
- **No implementado en esta tanda:** editar la comisión de un evento ya abierto en la UI (la
  acción `actualizarComisionEvento` existe pero no se conectó — no era parte de los campos
  mínimos de la referencia visual de esta tanda).
- **Bug real encontrado y corregido:** `fechaInicio`/`fechaFin` son rangos de días completos
  (cargados desde `<input type="date">`, sin componente horario significativo), pero el módulo ya
  los persistía con `new Date(input.fechaInicio)` (ancla a medianoche UTC) desde su construcción
  original (Módulo 3). Formatear eso con `toLocaleDateString` en huso horario local corre un día
  hacia atrás en cualquier huso detrás de UTC — **incluido Bolivia (UTC-4), el mercado real del
  producto**. Corregido en la UI forzando `timeZone: "UTC"` al formatear (no se tocó el
  almacenamiento, que sigue igual). Cualquier otra pantalla futura que muestre estas fechas debe
  usar el mismo criterio.
- Verificado end-to-end en navegador (alta, cerrar, reabrir) — la capacidad especial
  `gestionar_eventos` (sin bypass de Owner, por diseño) se otorgó temporalmente al Owner de
  prueba vía un script descartable (`otorgarCapacidadEspecialPorUsuario`, ya existente) y se
  revocó al terminar. El evento de prueba ("Feria QA") quedó en el tenant de demo — no hay acción
  de eliminar Evento en el contrato del módulo, y al ser una fecha futura sin ventas asociadas no
  genera efectos secundarios.

## Actualización 2026-07-16 (6) — Importación de Venta Histórica
- Pantalla `/app/ventas/importar` (`page.tsx` + `importar-cliente.tsx`): dropzone de `.csv` con
  parser propio (sin librería nueva — encabezado fijo
  `fecha,canal,producto,cantidad,precioVenta,costoUnitario,cliente`, split por coma), resuelve
  `canal`/`producto`/`cliente` por nombre contra los ya cargados del tenant. Vista previa marca
  filas inválidas con motivo explícito (canal/producto no encontrado, cantidad/precio/costo
  inválido). Un selector de sucursal aplica a todo el lote. "Confirmar importación" llama al nuevo
  wrapper de ruta `importarVentaHistoricaLoteAction(sucursalId, filas)`, que itera una llamada a
  `importarVentaHistorica` por fila válida (cada fila = una Venta de una sola línea — la
  granularidad real del contrato del módulo, no la de "Total" simplificado de la referencia
  visual) y devuelve `{ importadas, errores[] }`.
- **Decisión de esta tanda:** sin UI de mapeo interactivo de columnas (el doc lo dejaba como
  "probablemente") — encabezado fijo, más simple y suficiente para el uso real (import puntual,
  gateado a Owner/capacidad especial). Se documenta acá para no re-litigar la decisión.
- Se agregó `importarVentaHistoricaFilaSchema` (`validation.ts`) para validar cada fila ya resuelta
  en el servidor antes de llamar `importarVentaHistorica`.
- **Bug real encontrado y corregido (afecta también a `registrarVenta`):** el módulo ya persistía
  `fechaVenta` con `new Date(input.fechaVenta)` (ancla a medianoche UTC) cuando el input es una
  fecha de solo-día (`"YYYY-MM-DD"`) — típico de esta importación y también posible en
  `registrarVenta` si algún caller pasa `fechaVenta` explícito sin hora. Mostrado luego con
  `toLocaleDateString` en huso horario local, corre un día hacia atrás en cualquier huso detrás de
  UTC — **incluida Bolivia (UTC-4), el mercado real del producto** (mismo tipo de bug que en
  Eventos, pero acá la fecha si tiene un componente horario real en otros usos — `registrarVenta`
  sin `fechaVenta` explícito usa `new Date()` con hora real — así que el fix no puede ir en el
  display como en Eventos sin romper esos casos). **Fix real:** nueva función
  `parsearFechaVentaSoloFecha()` en `ventas/actions.ts` — si el string es exactamente
  `YYYY-MM-DD` lo ancla a mediodía UTC (no medianoche), lo que mantiene el día calendario correcto
  en cualquier huso horario real (UTC-12 a UTC+13); si ya trae hora/timezone, se respeta tal cual.
  Aplicado en `registrarVenta` y en `importarVentaHistorica`. Los 143 tests siguen en verde
  (los rangos de período de los tests existentes cortan por día completo, un corrimiento de 12h
  dentro del mismo día UTC no los afecta).
- Verificado end-to-end simulando una carga real de archivo (`File`/`DataTransfer` sintéticos,
  ya que la automatización de navegador no puede manejar el diálogo nativo de selección de
  archivo): 2 filas válidas + 1 con error de canal inexistente, detectado y mostrado
  correctamente. Las 2 ventas de prueba quedaron anuladas (`Ajuste de Venta` tipo
  `anulacion_total`, motivo explícito) en vez de un `DELETE` — no existe (ni debe existir,
  regla de ledger append-only) una forma de eliminar una Venta.

## Cierre de tanda (2026-07-16) — Clientes/Canales/Métodos de Pago/Eventos/Importación
Las 5 pantallas que quedaban pendientes del módulo Ventas + Clientes quedan `[x]` en
`docs/ui/pantallas.md` (sección 7) — el módulo queda **10/10 construido**. Próxima tanda:
Patrimonio (Activos/Pasivos) — requiere cerrar primero un gap chico de backend
(`listarActivos`/`listarPasivos`/fichas completas sin wrapper público en `actions.ts`), ver
`docs/ui/pantallas.md` sección "Próxima tanda sugerida".
