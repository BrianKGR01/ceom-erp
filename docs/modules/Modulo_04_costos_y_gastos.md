# Módulo 4 — Costos y Gastos

## 0. Propósito del módulo y alcance (qué NO cubre)

Un único módulo para todo gasto que **no es costo de producción de un producto vendido**. Concentra tres tipos de erogación (fijo, variable no productivo, único) y recibe —sin que el usuario las cargue a mano— dos cosas que ya se generan en otros módulos: la cuota de un pasivo (Patrimonio) y la comisión automática por venta/evento (Ventas).

**Deslinde deliberado, reafirmando la regla de los tres flujos de dinero (v3):**

- Este módulo **nunca recibe** compras de insumo ni de reventa directa — esas van del evento de Compra (Proveedores) directo a Financiero como salida de caja, sin pasar por acá.
- Este módulo **nunca recibe** el costo operativo/COGS de un producto — ese viaja congelado dentro de la venta (Módulo 3) hacia Financiero.
- Este módulo solo existe para lo que **no está atado a una venta ni a una compra de insumo**: alquiler, sueldos, marketing, transporte, comisiones, servicios, y compras puntuales que no son de reventa ni insumo.

---

## 1. Entidades y modelo de datos

### 1.1 Gasto

| Campo | Tipo | Notas |
|---|---|---|
| `id` | uuid | PK |
| `tenant_id` | uuid | FK |
| `sucursal_id` | uuid, nullable | `null` si el gasto es general del negocio (ej. marketing); con valor si es propio de una sucursal (ej. alquiler de un local específico) |
| `tipo` | enum | `fijo`, `variable_no_productivo`, `unico` |
| `categoria_id` | uuid | FK a `CategoriaGasto` (1.2) |
| `monto` | numeric | |
| `fecha_gasto` | date | |
| `proveedor_id` | uuid, nullable | FK opcional — no todo gasto tiene proveedor asociado |
| `origen` | enum: `manual`, `comision_venta_automatica`, `cuota_pasivo_automatica` | Ver sección 3 |
| `estado_pago` | enum, **derivado** | `pendiente` / `parcial` / `pagado` — calculado a partir de los Pagos de Gasto (1.5), igual criterio que `estado_pago` en Ventas (Módulo 3). Los de `origen` automático quedan siempre en `pagado`, con su Pago de Gasto generado en el mismo instante (ver 3.4) |
| `referencia_id` | uuid, nullable | Apunta a la Venta o al Pasivo que originó el registro, cuando `origen` no es `manual` |
| `descripcion` | text, nullable | |
| `creado_por` / `creado_en` | uuid / timestamp | |
| `modificado_por` / `modificado_en` | uuid / timestamp | Solo aplica a gastos de `origen = manual` (ver 3.3) |
| `eliminado_en` | timestamp, nullable | Soft delete — solo para gastos manuales |

### 1.2 CategoriaGasto (catálogo por tenant, editable)

| Campo | Tipo | Notas |
|---|---|---|
| `id` | uuid | PK |
| `tenant_id` | uuid | FK |
| `nombre` | text | Ej. "Insumos", "Mano de obra", "Transporte", "Marketing", "Servicios" |
| `categoria_gasto_sugerida_id` | uuid, nullable | FK a `CategoriaGastoSugerida`, si se adoptó una sugerencia. Puramente informativo |
| `eliminado_en` | timestamp, nullable | |

Se precarga con el set default global al crear el tenant (Insumos, Mano de obra, Transporte, Marketing, Servicios), y el usuario puede agregar categorías propias libremente.

### 1.3 CategoriaGastoSugerida (catálogo gestionado desde el Panel Administrativo CEOM)

Confirmado: **ambas cosas conviven**, igual que pediste — un set global sugerido para cualquier negocio, y además sugerencias específicas por Nicho, con el mismo mecanismo ya usado en Productos (Módulo 2, `CategoriaSugerida`).

| Campo | Tipo | Notas |
|---|---|---|
| `id` | uuid | PK |
| `nicho_id` | uuid, nullable | `null` = sugerencia global, válida para cualquier Nicho (ej. "Transporte", "Marketing", "Servicios" — gastos operativos que no dependen del rubro) |
| `nombre` | text | Ej. "Mano de obra de producción" (más específico de un Nicho de producción) |
| `activa` | boolean | |
| `creado_en` | timestamp | |

Al crear una categoría, el usuario ve tanto las sugerencias globales como las específicas del Nicho de su tenant — sin dejar de poder escribir su propia categoría libremente, igual que en Productos.

### 1.4 GastoRecurrente (plantilla)

| Campo | Tipo | Notas |
|---|---|---|
| `id` | uuid | PK |
| `tenant_id` | uuid | FK |
| `sucursal_id` | uuid, nullable | |
| `categoria_id` | uuid | FK |
| `monto` | numeric | |
| `frecuencia` | enum | `mensual`, `semanal`, `quincenal`, `anual` |
| `fecha_inicio` | date | |
| `fecha_fin` | date, nullable | `null` = sigue generando gastos indefinidamente hasta que se desactive |
| `activo` | boolean | Desactivar detiene la generación futura sin borrar los gastos ya generados |
| `creado_por` / `creado_en` | uuid / timestamp | |

### 1.5 Pago de Gasto (ledger de pagos — mismo patrón que Pago de Venta, Módulo 3)

Resuelve la necesidad real de registrar un gasto ya reconocido pero **pendiente de pago** (ej. una factura recibida hoy, pagadera a 30 días), sin perder la fecha en que el gasto se generó.

| Campo | Tipo | Notas |
|---|---|---|
| `id` | uuid | PK |
| `gasto_id` | uuid | FK |
| `monto` | numeric | |
| `fecha_pago` | date | La fecha **real** en que sale la plata — distinta de `fecha_gasto`, que es cuándo se reconoce el gasto |
| `creado_por` / `creado_en` | uuid / timestamp | |

`estado_pago` del Gasto se deriva de la suma de sus Pagos frente al `monto` total, igual criterio que en Ventas: `0` pagado → `pendiente`; `> 0` y `< monto` → `parcial`; `= monto` → `pagado`.

**Nota a futuro (confirmada, fuera de alcance del MVP):** más adelante se planea reemplazar la lista fija de `frecuencia` por una programación libre tipo calendario (elegir fechas específicas o una regla más flexible, similar a un programador de tareas). Para el MVP, el enum fijo (`mensual`/`semanal`/`quincenal`/`anual`) cubre los casos reales relevados (alquiler, sueldos, seguros/patentes anuales). El campo queda diseñado como enum ampliable para no complicar la implementación ahora, sabiendo que se reemplazará o extenderá después sin romper los `GastoRecurrente` ya creados.

---

## 2. Contrato de entrada/salida

**Entradas que este módulo consume:**
- De **Patrimonio**: cuota periódica de cualquier pasivo asociado a un activo (ej. la cuota de la máquina de gelato financiada) — se genera un `Gasto` con `tipo = fijo`, `origen = cuota_pasivo_automatica`, sin que el usuario la reingrese.
- De **Ventas**: comisión automática por canal o evento (Módulo 3, sección 4.3) — se genera un `Gasto` con `tipo = variable_no_productivo`, `origen = comision_venta_automatica`, referenciando la venta que la originó.

**Salidas que este módulo expone:**
- `consultar_total_costos_fijos(periodo)` — consumido directamente por **Simulaciones** (Punto de Equilibrio, Simular Precio), sin que el usuario lo reescriba.
- `consultar_distribucion_por_categoria(periodo)` — para el dashboard de este módulo y para **Reportes**.
- Evento `gasto_registrado(monto, categoria, tipo, fecha)` — consumido por **Financiero** para el Estado de Resultados.

---

## 3. Reglas de negocio clave

1. **Nunca se mezclan los tres flujos de dinero.** Este módulo jamás recibe compras de insumo/reventa ni costo operativo de producto — eso reafirma la separación ya fijada en la arquitectura general.
2. **Los gastos automáticos no se editan directamente.** Un `Gasto` con `origen = cuota_pasivo_automatica` solo puede corregirse modificando el Pasivo de origen en Patrimonio (ej. renegociar el crédito); un `Gasto` con `origen = comision_venta_automatica` solo se corrige mediante el `AjusteVenta` correspondiente en Ventas (que regenera o ajusta la comisión ligada). Esto evita que alguien "corrija a mano" un número que en realidad depende de otro módulo, perdiendo la trazabilidad.
3. **Los gastos manuales sí se editan directamente** (a diferencia de Ventas) porque no representan una transacción con contraparte externa que exija un rastro de ajuste — sí llevan soft-delete y auditoría (`modificado_por`/`modificado_en`), como el resto del sistema.
4. **El total de Costos Fijos del período se recalcula solo**, sin que el usuario lo transcriba a Simulaciones — es una simple consulta agregada sobre este módulo.
5. **Gasto pendiente de pago se resuelve con un ledger, no con un segundo campo de fecha.** En vez de agregar una simple "fecha de pago" al lado de `fecha_gasto` (que no soportaría pagos parciales ni un historial de cuándo se fue pagando de a poco), se reutiliza el mismo patrón ya construido para Ventas: un ledger de `Pago de Gasto` (1.5), con `estado_pago` derivado. Es el mismo costo de implementación que un segundo campo de fecha, pero además soporta pagos parciales y queda consistente con el resto del sistema — el estándar real de esto es el mismo par "cuenta por cobrar / cuenta por pagar" que ya usan Xero y QuickBooks, solo que aplicado del lado de los gastos en vez de las ventas.
6. **Los gastos de origen automático siempre nacen pagados.** Al generarse un `Gasto` con `origen = cuota_pasivo_automatica` o `comision_venta_automatica`, se crea en el mismo instante su `Pago de Gasto` por el monto completo — no tiene sentido rastrear "pendiente de pago" para algo que el propio sistema generó y ya contabilizó como ocurrido.

---

## 4. Auto-generación de gastos fijos recurrentes — confirmado

Confirmado: se extiende la auto-generación más allá de las cuotas de pasivo, siguiendo la misma filosofía de "sin reingreso manual" que ya aplica al resto del sistema. El usuario configura una sola vez el `GastoRecurrente` (ej. "Alquiler, Bs 800, mensual, desde el 1 de julio") y el sistema genera automáticamente el `Gasto` correspondiente en cada período, hasta que se desactive.

---

## 5. Casos de uso comunes

1. **Registrar un gasto único:** ej. una reparación puntual — `tipo = unico`, `origen = manual`.
2. **Configurar un gasto fijo recurrente:** ej. alquiler mensual — se crea un `GastoRecurrente`, que genera automáticamente el `Gasto` de cada período (sujeto a la decisión de la sección 4).
3. **Ver aparecer automáticamente la cuota de un pasivo:** sin acción del usuario, cada período que corresponda.
4. **Ver aparecer automáticamente la comisión de una venta o evento:** igual, sin acción del usuario.
5. **Crear una categoría personalizada:** ej. "Empaques", si las categorías sugeridas no alcanzan.
6. **Consultar la distribución de gastos por categoría del período**, vía el dashboard de este módulo.

---

## 6. Casos borde

1. **Intento de editar o eliminar directamente un gasto de origen automático:** bloqueado por el sistema — se redirige al módulo de origen (Patrimonio o el `AjusteVenta` en Ventas) según corresponda.
2. **Eliminar (soft-delete) una categoría en uso:** los gastos ya registrados con esa categoría mantienen la referencia (no se rompen), pero la categoría deja de estar disponible para gastos nuevos — mismo criterio que las categorías de Producto (Módulo 2).
3. **Desactivar un `GastoRecurrente`** (ej. se cancela el alquiler): se detiene la generación futura; el historial de gastos ya generados permanece intacto, coherente con "nunca borrar el pasado".
4. **Tenant con `estado_acceso = solo_lectura` o `bloqueado`:** se aplican las mismas restricciones ya fijadas en el Módulo 1 — en solo lectura se puede consultar pero no registrar ni editar gastos manuales; en bloqueado, tampoco se puede consultar.
5. **Un pasivo se termina de pagar:** Patrimonio deja de emitir la cuota automática; el histórico de `Gasto` con `origen = cuota_pasivo_automatica` de ese pasivo queda intacto para Reportes.
6. **Editar el monto de un Gasto que ya tiene pagos parciales registrados:** no se permite bajar el `monto` por debajo de lo ya pagado (`Σ Pago de Gasto`) — evitaría un estado inconsistente donde se pagó más de lo que el gasto dice costar.

---

## 7. Confirmaciones de esta ronda

1. **Auto-generación de gastos fijos recurrentes:** confirmado (sección 4).
2. **Frecuencia de `GastoRecurrente`:** se agrega `anual` al enum (para seguros, patentes). Queda anotado como decisión a futuro (no MVP) reemplazar el enum fijo por una programación libre tipo calendario — el diseño actual no bloquea esa evolución.
3. **Categorías de Gasto:** confirmado que conviven ambos esquemas — un set global sugerido para cualquier negocio, más sugerencias específicas por Nicho desde el Panel CEOM (`CategoriaGastoSugerida`), igual que en Productos.

**Adenda posterior (originada al construir el Módulo 7 — Financiero):** se agregó el ledger `Pago de Gasto` (1.5) y el campo derivado `estado_pago` en `Gasto`, para soportar gastos pendientes de pago sin romper el Flujo de Caja. Ver secciones 1.5 y 3.5–3.6.

Con esto, el Módulo 4 queda cerrado.

---

## 8. Nota de navegación (UX, no arquitectura)

Investigado en Xero y QuickBooks: ninguno de los dos fusiona los datos de Gastos con los Reportes financieros — cada uno los mantiene como módulos separados de captura vs. consulta, exactamente como está diseñado este documento. Lo que sí conviene ajustar es la **agrupación visual en el menú**, siguiendo el patrón de Xero: un ítem de menú **"Financiero"** que despliegue Costos y Gastos, Reportes y Simulaciones juntos, para que el usuario no tenga que buscar en varios lugares — sin que esto implique ningún cambio en el modelo de datos ni en el contrato de este módulo. Se retoma con más detalle al definir la estructura de navegación general y el Módulo Financiero.

---

*Módulo 4 — cerrado y confirmado.*