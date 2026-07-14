# Módulo 3 — Ventas

## 0. Propósito del módulo

Registrar cada venta realizada, actualizar el stock de producto terminado, y ser la fuente que alimenta —sin que el usuario vuelva a cargar nada— tanto el costo operativo del período (COGS en Financiero) como las métricas de rotación, margen y desempeño por canal (Reportes y Simulaciones).

Este módulo consume Productos e Inventario (Módulo 2) y expone eventos hacia Clientes, Costos & Gastos y Financiero — nunca calcula precio ni costo por su cuenta, solo los toma prestados en el momento exacto de la venta y los congela.

---

## 1. Entidades y modelo de datos

### 1.1 Venta (cabecera)

| Campo | Tipo | Notas |
|---|---|---|
| `id` | uuid | PK |
| `tenant_id` | uuid | FK |
| `sucursal_id` | uuid | FK — determina de qué stock se descuenta (Módulo 2) |
| `cliente_id` | uuid, nullable | FK. `null` es una opción siempre disponible, sin permiso especial (ver 4.4) |
| `fecha_venta` | timestamp | Puede diferir de `creado_en` por captura offline (ver 6.1) |
| `canal_venta_id` | uuid | FK a `CanalVenta` (1.5) |
| `evento_id` | uuid, nullable | FK a `Evento` (1.6) — reemplaza el enfoque de un simple booleano, ver sección 4.1 |
| `origen_registro` | enum: `en_vivo`, `offline_sincronizado`, `importacion_historica` | Ver sección 6 — trazabilidad de cómo llegó el dato, sin afectar su validez |
| `estado_pago` | enum, **derivado** | `pendiente` / `parcial` / `pagado` — calculado a partir de los Pagos de Venta (1.4), nunca editado a mano |
| `creado_por` / `creado_en` | uuid / timestamp | Quién registró la venta y cuándo — puede diferir de `fecha_venta` |
| `modificado_por` / `modificado_en` | uuid / timestamp | Solo cambian campos no financieros (ej. corregir el canal); nunca el monto o el detalle de productos, eso pasa por Ajuste de Venta |

**Nota deliberada:** `Venta` **no tiene `eliminado_en`.** A diferencia de otras entidades del sistema, una venta nunca se "oculta" con soft-delete — su única vía de corrección o anulación es un `AjusteVenta` (1.3), coherente con el principio ya fijado de que ningún movimiento financiero se edita o se borra, se contrarresta.

### 1.2 Detalle de Venta (líneas)

| Campo | Tipo | Notas |
|---|---|---|
| `id` | uuid | PK |
| `venta_id` | uuid | FK |
| `producto_id` | uuid | FK |
| `cantidad` | numeric | |
| `precio_venta_snapshot` | numeric | Congelado del `precio_venta` vigente del producto al momento de la venta |
| `costo_unitario_snapshot` | numeric | Congelado del `costo_operativo_vigente` del producto al momento de la venta |
| `subtotal` | numeric, derivado | `cantidad × precio_venta_snapshot` |

### 1.3 Ajuste de Venta (nota de crédito / corrección — nunca se edita la venta original)

Implementa el patrón ya fijado en el Módulo 1 (pregunta 1 de la arquitectura general): **ambos, precio y costo, se congelan; cualquier corrección posterior es un contra-asiento referenciado, nunca una edición.**

| Campo | Tipo | Notas |
|---|---|---|
| `id` | uuid | PK |
| `venta_id` | uuid | FK a la venta que ajusta |
| `tipo` | enum | `correccion` (error de tipeo), `devolucion` (el cliente devuelve producto), `descuento_posterior` (promoción retroactiva), `anulacion_total` (equivalente a "eliminar" la venta, sin borrarla) |
| `monto_ajuste` | numeric | Puede ser negativo (devuelve dinero) o positivo (corrige un monto cobrado de menos) |
| `cantidad_producto_ajustada` | numeric, nullable | Si el ajuste involucra devolver stock, dispara un `entrada_ajuste_manual` en el Módulo 2 |
| `motivo` | text, **obligatorio** | Nunca se acepta un ajuste sin justificación escrita |
| `creado_por` / `creado_en` | uuid / timestamp | |

### 1.4 Pago de Venta (ledger de cobros — soporta pagos parciales)

| Campo | Tipo | Notas |
|---|---|---|
| `id` | uuid | PK |
| `venta_id` | uuid | FK |
| `monto` | numeric | |
| `metodo_pago_id` | uuid | FK a `MetodoPago` (1.7) |
| `fecha_pago` | timestamp | |
| `creado_por` / `creado_en` | uuid / timestamp | |

`estado_pago` de la Venta se deriva de la suma de sus Pagos frente al total de la venta: `0` pagado → `pendiente`; `> 0` y `< total` → `parcial`; `= total` → `pagado`. Igual que con el stock (Módulo 2), nunca se edita el estado directamente.

### 1.5 CanalVenta (catálogo por tenant)

| Campo | Tipo | Notas |
|---|---|---|
| `id` | uuid | PK |
| `tenant_id` | uuid | FK |
| `nombre` | text | Ej. "Feria", "WhatsApp", "Local físico", "Boca a boca" |
| `porcentaje_comision_default` | numeric, nullable | Valor **sugerido** al crear un Evento sobre este canal (ver 1.6) — ya no es un valor fijo e inamovible, porque en la práctica la comisión de una feria cambia de una vez a otra |
| `activo` | boolean | |
| `eliminado_en` | timestamp, nullable | |

Se **pre-carga automáticamente** con las etiquetas que el usuario eligió en el paso "¿Cuáles son tus principales canales de venta?" del onboarding (Módulo 1) — sin duplicar esa carga. El usuario puede agregar más canales después desde este módulo.

### 1.6 Evento (ventas rápidas de feria/pop-up, dinámicas por naturaleza)

Resuelve tanto la variabilidad real de la comisión (25% una vez, 20% otra) como el pedido de un apartado especial para ventas rápidas. Un Evento es una sesión acotada en el tiempo, vinculada a un canal, donde la comisión y otras condiciones se fijan **una vez por evento**, no de forma permanente en el catálogo de canales.

| Campo | Tipo | Notas |
|---|---|---|
| `id` | uuid | PK |
| `tenant_id` | uuid | FK |
| `sucursal_id` | uuid | FK |
| `canal_venta_id` | uuid | FK — normalmente "Feria", pero puede ser cualquier canal |
| `nombre` | text | Ej. "Feria UPSA — julio 2026" |
| `porcentaje_comision` | numeric, nullable | Se precarga con el `porcentaje_comision_default` del canal, pero es **editable por evento** — así se resuelve que una feria cobre 25% y la siguiente 20% |
| `fecha_inicio` / `fecha_fin` | timestamp | |
| `estado` | enum: `abierto` / `cerrado` | Mientras está `abierto`, se le pueden seguir cargando ventas; al cerrarlo, queda fijo para reportes |
| `creado_por` / `creado_en` | uuid / timestamp | |
| `cerrado_por` / `cerrado_en` | uuid / timestamp, nullable | |
| `eliminado_en` | timestamp, nullable | |

**Sobre quién puede crear/gestionar un Evento:** no se resuelve asignando un usuario fijo, sino con el mismo mecanismo de permisos especiales ya creado (`permisos_especiales_por_rol`, Módulo 2): una capacidad `gestionar_eventos`, activable por rol desde la gestión de roles del Módulo 1. Cualquier usuario con permiso `crear` en Ventas puede *registrar* ventas dentro de un evento ya abierto; abrir, editar la comisión o cerrar el evento requiere específicamente `gestionar_eventos`. Esto evita tanto "todo el mundo puede cambiar la comisión de una feria a mitad de evento" como "solo el Owner puede vender en una feria".

### 1.7 MetodoPago (catálogo por tenant)

| Campo | Tipo | Notas |
|---|---|---|
| `id` | uuid | PK |
| `tenant_id` | uuid | FK |
| `nombre` | text | Ej. "Efectivo", "QR", "Transferencia", "Tarjeta" |
| `activo` | boolean | |

Set inicial sugerido (Efectivo, QR) igual que en los casos reales relevados, ampliable libremente.

### 1.8 Cliente (ficha mínima — alta en el momento de la venta)

| Campo | Tipo | Notas |
|---|---|---|
| `id` | uuid | PK |
| `tenant_id` | uuid | FK |
| `nombre` | text | |
| `telefono` | text, nullable | |
| `email` | text, nullable | |
| `primera_compra_en` | timestamp, derivado | |
| `ultima_compra_en` | timestamp, derivado | |
| `eliminado_en` | timestamp, nullable | |

No requiere alta separada: si al registrar una venta el cliente no existe, se crea ahí mismo con nombre y teléfono como mínimo (confirmado en los flujos funcionales relevados).

---

## 2. Contrato de entrada/salida

**Entradas que este módulo consume (de Productos e Inventario, Módulo 2):**
- `consultar_precio_venta(producto_id)`
- `consultar_costo_operativo(producto_id)`
- `consultar_stock(producto_id, sucursal_id)` — para validar disponibilidad antes de vender

**Salidas que este módulo dispara hacia otros módulos:**
- Hacia **Productos e Inventario**: `descontar_stock(producto_id, sucursal_id, cantidad)` → genera `salida_venta` en el ledger de movimientos de stock.
- Hacia **Clientes**: alta o actualización de ficha si es necesario.
- Hacia **Costos & Gastos**: si corresponde comisión (del Evento o del canal, ver 4.3), se genera automáticamente un registro de gasto `variable_no_productivo` vinculado a esta venta — sin que el usuario lo calcule ni lo cargue a mano.
- Hacia **Financiero**: evento `venta_registrada` con el ingreso (`precio_venta_snapshot × cantidad`) y el costo (`costo_unitario_snapshot × cantidad`) — esto es lo que permite calcular el margen real por venta sin recalcular nada.
- Hacia **Reportes** (Módulo 10, adenda): `ranking_productos(periodo, canal_venta_id?, criterio: rotacion|margen)`, `historico_ventas(periodo, incluir_eventos)`, `margen_por_canal_y_producto(periodo)` — funciones de solo lectura agregadas sobre `Detalle de Venta`, sin tablas nuevas.

---

## 3. Reglas de negocio clave

1. **Snapshot doble, siempre.** Toda línea de venta congela `precio_venta_snapshot` y `costo_unitario_snapshot` en el momento exacto de la transacción. Cambios posteriores en el producto (precio o costo) no tocan ventas ya registradas.
2. **Corrección solo vía Ajuste de Venta.** Ninguna venta ya registrada se edita directamente en sus montos o productos. Toda corrección —incluyendo la "eliminación" de una venta— pasa por un `AjusteVenta` con motivo obligatorio y trazabilidad de quién lo hizo.
3. **No se permite vender sin stock suficiente**, salvo permiso especial `vender_sin_stock` (definido en el Módulo 2, adenda al Módulo 1).
4. **Alta de cliente implícita.** Registrar una venta con un cliente nuevo crea su ficha en el mismo acto, sin pantalla adicional.
5. **La comisión se calcula sola, por canal o por evento.** Si corresponde comisión (fija por canal, o puntual por Evento), el sistema genera el gasto correspondiente automáticamente al confirmar la venta — el usuario nunca hace ese cálculo manualmente (esto replica exactamente el caso real de comisión de feria en los datos de SanttiCampo, que varía de una ocasión a otra).
6. **Estado de acceso del tenant se respeta.** Si `estado_acceso = solo_lectura` (Módulo 1), no se puede registrar ni ajustar ninguna venta, solo consultarlas y exportarlas. Si `estado_acceso = bloqueado`, tampoco se puede consultar.
7. **Devolución con dinero real, adenda originada al construir el Módulo 7 (Financiero):** cuando un `AjusteVenta` de tipo `devolucion` implica devolver efectivo real al cliente (no solo un ajuste contable), debe generar automáticamente un `Pago de Venta` (1.4) con `monto` **negativo** — mismo ledger, mismo mecanismo. Esto es lo que permite que el Flujo de Caja (Módulo 7) refleje la salida de dinero sin lógica especial. Si la devolución es solo una nota de crédito sin entrega real de efectivo (ej. para una compra futura), no se genera ese `Pago de Venta` — la distinción la marca quien registra el ajuste.

---

## 4. Casos particulares que ya estaban relevados en los documentos funcionales

### 4.1 Modo evento/feria — apartado especial para ventas rápidas

Para ferias o eventos (confirmado en los casos de SanttiCampo y La Nona), el usuario con permiso `gestionar_eventos` abre un `Evento` (1.6) antes de empezar a vender, fijando el canal y, si corresponde, el porcentaje de comisión de esa ocasión puntual. Durante el evento, cualquier venta registrada puede asociarse a ese `evento_id`, ya sea:
- Venta por venta, en tiempo real, si hay margen para hacerlo, o
- En modo de **cierre agregado**: al finalizar, se ingresa el total vendido por producto y el monto recibido por método de pago, generando las Ventas correspondientes de una sola vez.

Al terminar, se **cierra el Evento** (`estado = cerrado`) y queda fijo para reportes — no se pueden cargar más ventas contra un evento cerrado, salvo que alguien con `gestionar_eventos` lo reabra explícitamente (acción auditada).

**Regla importante:** las ventas con `evento_id` no nulo **no se mezclan con la demanda regular** en los cálculos de rotación que alimentan Simulaciones (Simular Precio, Punto de Equilibrio) — Reportes y Simulaciones deben filtrar por `evento_id` según corresponda al análisis. Sí cuentan, en cambio, para el ingreso total y el Estado de Resultados, porque el dinero entró igual.

### 4.2 Presentación/variante que afecta el margen (ej. precocido vs. horneado)

Cuando el mismo producto base tiene variantes con distinto costo real (caso La Nona: empanada precocida vs. horneada, mismo sabor), esto no se resuelve en Ventas — cada variante es un Producto distinto en el Módulo 2 (con su propio `costo_operativo_vigente`), y Ventas simplemente registra cuál de esos productos se vendió. Ventas no necesita lógica especial para esto, ya queda resuelto en el modelado de Producto.

### 4.3 Comisión automática por canal o evento

Si la venta pertenece a un `Evento`, se usa el `porcentaje_comision` de ese evento puntual; si la venta no pertenece a ningún evento (canal regular, sin sesión asociada), se usa el `porcentaje_comision_default` del `CanalVenta`. En cualquiera de los dos casos, al confirmar la venta se crea automáticamente un registro en Costos & Gastos (tipo `variable_no_productivo`), vinculado (`referencia_id`) a esa venta específica — reproduce exactamente el caso real de la comisión de feria (que varía entre 20% y 25% según la ocasión) y de la comisión al hermano en La Nona.

### 4.4 Venta sin cliente identificado

**Confirmado como opción siempre disponible**, sin permiso especial: cualquier usuario con permiso `crear` en Ventas puede registrar una venta con `cliente_id = null`. Tiene sentido de negocio real — en mostrador o en una feria, en la mayoría de los casos no se llega a identificar al cliente, y exigirlo sería fricción injustificada para el caso más común, no la excepción.

---

## 5. Casos borde

1. **Ajuste de una venta de un período ya cerrado en Reportes:** se permite igual — el `AjusteVenta` lleva su propia fecha (`creado_en`), y los reportes de períodos pasados no se "recalculan silenciosamente"; el ajuste aparece en el período en que realmente ocurrió, mantiene la integridad histórica.
2. **Devolución parcial de una venta con varios productos:** el `AjusteVenta` de tipo `devolucion` se asocia a la venta completa pero con `cantidad_producto_ajustada` específica de la línea devuelta — permite devolver un producto sin anular toda la venta.
3. **Venta con `estado_pago = parcial` que nunca se termina de cobrar:** queda visible en Reportes como cuenta por cobrar pendiente (alimenta al Módulo Financiero como parte del análisis de flujo de caja); no se fuerza ningún cierre automático.
4. **Carga retroactiva de historial** (caso real y directo: SanttiCampo migrando su historial de mayo-junio desde Excel): se resuelve con la función de Importación de Historial (sección 6.2), no editando la fecha libremente en el formulario normal de venta.

---

## 6. Registro offline y carga retroactiva — estándar de la industria

Investigado en sistemas POS de referencia (Lightspeed, SpotOn, Microsoft Dynamics 365 Commerce): el patrón consistente **no es "permitir elegir cualquier fecha pasada libremente"**, sino distinguir dos situaciones muy distintas:

### 6.1 Captura offline (conexión caída durante la operación)

- La venta se registra en el dispositivo con su **hora real de ocurrencia** (`fecha_venta`), aunque el guardado en el servidor (`creado_en`) suceda minutos u horas después, cuando vuelve la conexión.
- La sincronización es **automática**, sin intervención manual, y conserva quién la registró — nunca se trata como una "edición" de fecha, es simplemente la naturaleza de una operación que ocurrió sin conexión.
- Esto ya queda cubierto por el diseño de `fecha_venta` vs. `creado_en` que ya tenía el módulo — no hace falta ninguna regla ni permiso especial para esto, es el comportamiento normal esperado de una app que puede perder conexión brevemente. Se marca con `origen_registro = offline_sincronizado`.

### 6.2 Carga masiva de historial viejo (ej. migrar el Excel de SanttiCampo)

Esto **no es lo mismo** que una venta offline puntual — es una operación de migración de datos, y así la trata la industria: separada de la pantalla normal de "registrar venta", con más control.

- Se resuelve con una función de **Importación de Historial** (carga por lote, ej. desde CSV/Excel), distinta del formulario de venta individual.
- Restringida al rol Owner, o a un rol con la capacidad especial `importar_historico` (mismo mecanismo de permisos especiales ya usado para `vender_sin_stock` y `gestionar_eventos`) — no cualquier colaborador puede reescribir el pasado del negocio.
- Cada registro importado así queda marcado `origen_registro = importacion_historica`, visible en auditoría, y **no dispara** los efectos automáticos que sí dispara una venta en vivo (no genera comisión automática retroactiva, no descuenta stock si ya no existe ese producto/insumo) — se trata como carga de datos históricos de referencia, no como una transacción nueva que mueve stock o caja hoy.

Con este esquema, el formulario normal de "registrar venta" **no permite elegir libremente cualquier fecha pasada** — solo admite la hora real (con margen de minutos/horas para el caso offline). Para historial genuinamente antiguo, existe la vía de Importación, más controlada y auditable.

---

## 7. Confirmaciones de esta ronda

1. **Comisión por canal:** confirmado que no es fija — se resuelve con la entidad `Evento`, que fija la comisión puntual de cada ocasión (sección 1.6).
2. **Carga retroactiva de historial:** resuelto con el estándar de la industria — captura offline con hora real (sin permiso especial) vs. Importación de Historial restringida y auditada para migraciones de datos viejos (sección 6).
3. **Venta sin cliente identificado:** confirmado como opción siempre disponible para cualquier usuario con permiso de crear ventas, sin restricción de rol.
4. **`gestionar_eventos` — activable por rol, por usuario específico, o por varios usuarios puntuales:** resuelto con el override por usuario agregado como adenda 13.1 del Módulo 1 (`permisos_especiales_por_usuario`), que aplica no solo a `gestionar_eventos` sino a las tres capacidades especiales existentes (`vender_sin_stock`, `gestionar_eventos`, `importar_historico`) de forma consistente. El Owner puede fijar el default por rol y otorgar o quitar la excepción usuario por usuario cuando haga falta.

Con esto, el Módulo 3 queda cerrado.

---

*Módulo 3 — cerrado y confirmado. Continúa el Módulo 4 (Costos y Gastos).*