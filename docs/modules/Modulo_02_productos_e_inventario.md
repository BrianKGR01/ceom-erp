# Módulo 2 — Productos e Inventario

## 0. Propósito del módulo y alcance (importante: qué NO cubre)

Este módulo es la **única fuente de verdad de todo producto que se puede vender**: su ficha, su precio, y su stock de producto terminado. Es el módulo con el que arranca cualquier negocio en CEOM, exista o no un Nicho activo.

**Deslinde deliberado de alcance**, para que no haya ambigüedad con el Módulo 6 (Módulo Operativo/Nicho):

- Este módulo **no modela recetas, insumos ni procesos de producción**. Eso vive en *Inventario Operativo* y *Operaciones*, dentro del Módulo Operativo de cada Nicho (se detalla en el Módulo 6).
- Este módulo **no calcula costo operativo** — solo lo recibe, ya calculado, desde el Módulo Operativo (si existe Nicho) o desde una compra de reventa directa (Proveedores), o se carga manualmente si el negocio está en Modo Básico.
- Este módulo **nunca decide el precio de venta a partir de un costo** — el precio de venta es siempre una decisión comercial que carga el Owner o quien tenga permiso, en este módulo.

Esta separación viene de la arquitectura ya acordada (v3): *"el precio de venta siempre lo define el emprendedor en Productos; el costo operativo lo calcula el Nicho y se sugiere hacia Productos; nunca se mezclan."*

---

## 1. Decisión confirmada: stock por Sucursal, precio por Tenant

Con Sucursal ya definida como entidad en el Módulo 1, quedó resuelta la pregunta de si el stock es un número único por producto o distinto por sucursal.

**Confirmado (estándar de la industria — así lo resuelven Shopify POS, Square, Odoo con múltiples ubicaciones):**

- El **catálogo de Producto** (nombre, precio de venta, imagen, categoría) es **a nivel de tenant** — un mismo producto, un mismo precio, se vea desde la sucursal que se vea.
- El **stock** es **a nivel de sucursal** — cada sucursal tiene su propia cantidad disponible del mismo producto.
- En el plan Básico (sin sucursales), esto es transparente: todo el stock vive en la Sucursal principal creada automáticamente, sin que el usuario note ninguna diferencia.

---

## 2. Entidades y modelo de datos

### 2.1 Categoría de Producto

| Campo | Tipo | Notas |
|---|---|---|
| `id` | uuid | PK |
| `tenant_id` | uuid | FK |
| `nombre` | text | Libre, editable por el usuario (ej. "Gelato", "Empanadas", "Bebidas") |
| `categoria_sugerida_id` | uuid, nullable | FK a `CategoriaSugerida`, si el usuario adoptó una sugerencia en vez de escribir una propia. Puramente informativo — el usuario puede editar el nombre después sin romper nada |
| `eliminado_en` | timestamp, nullable | Soft delete |

### 2.2 CategoriaSugerida (catálogo gestionado desde el Panel Administrativo CEOM)

Resuelve la pregunta de cómo sugerir categorías: **por Nicho, no por producto individual.** El razonamiento es el que vos mismo diste — un Nicho es una categoría grande (ej. "Alimentos y Bebidas por Lotes") que agrupa subcategorías típicas del rubro (lácteos, bebidas, snacks, desayunos), y esas subcategorías no tienen sentido para un Nicho distinto (ej. Comercio Minorista de carteras). Sugerir por Nicho evita mostrarle a un negocio de gelato categorías de indumentaria, y viceversa.

| Campo | Tipo | Notas |
|---|---|---|
| `id` | uuid | PK |
| `nicho_id` | uuid, nullable | `null` = sugerencia genérica, válida para cualquier Nicho (ej. "Otros") |
| `nombre` | text | Ej. "Lácteos", "Snacks", "Bebidas" |
| `activa` | boolean | El equipo CEOM puede desactivar una sugerencia sin borrar el histórico de quién ya la usó |
| `creado_en` | timestamp | |

**Cómo se usa:** al crear una Categoría de Producto, el usuario ve como sugerencias las `CategoriaSugerida` cuyo `nicho_id` coincide con el Nicho de su tenant (más las genéricas), pero **no está limitado a ellas** — puede escribir su propia categoría libremente en cualquier momento. No hace falta un set inicial cargado desde el día uno del MVP; el equipo CEOM va sumando sugerencias por Nicho desde el Panel Administrativo a medida que se necesiten, sin tocar código.

### 2.3 Producto

| Campo | Tipo | Notas |
|---|---|---|
| `id` | uuid | PK |
| `tenant_id` | uuid | FK |
| `categoria_id` | uuid, nullable | FK |
| `nombre` | text | Ej. "Gelato Frutos Rojos — Doble" |
| `imagen_url` | text, nullable | Storage (Supabase Storage / Backblaze B2) |
| `unidad_venta` | enum | `unidad`, `kg`, `g`, `l`, `ml`, `docena` — catálogo ampliable |
| `precio_venta` | numeric | Definido siempre por el usuario en este módulo |
| `costo_operativo_vigente` | numeric, nullable | Valor **actual**, para calcular margen en pantalla. No es un histórico — cada venta congela su propio `costo_unitario_snapshot` (ver Módulo de Ventas), este campo es solo la referencia vigente |
| `origen_costo` | enum: `manual`, `nicho_sugerido`, `proveedor_reventa` | De dónde viene el `costo_operativo_vigente` actual |
| `tipo_origen_producto` | enum: `produccion_nicho`, `reventa_simple`, `manual` | Ver sección 6 — resuelve el caso de productos de reventa dentro de un negocio con Nicho de producción |
| `fecha_vencimiento_referencia` | date, nullable | Override manual puntual, cuando la vida útil calculada (ver `vida_util_dias`) no aplica a una unidad específica |
| `vida_util_dias` | integer, nullable | **Adenda originada en el Módulo 6.** Vida útil típica del producto, en días. `null` si no es perecedero. Se usa para auto-calcular la fecha de vencimiento tanto en compras de reventa directa como en producciones del Módulo Operativo, sin exigir trazabilidad FIFO por lote |
| `activo` | boolean | Visible/vendible o no — distinto de eliminado |
| `creado_por` / `creado_en` | uuid / timestamp | |
| `modificado_por` / `modificado_en` | uuid / timestamp | |
| `eliminado_en` | timestamp, nullable | Soft delete |

### 2.4 Stock (por Producto × Sucursal)

| Campo | Tipo | Notas |
|---|---|---|
| `id` | uuid | PK |
| `producto_id` | uuid | FK |
| `sucursal_id` | uuid | FK |
| `cantidad_actual` | numeric | **Campo derivado**, no editable directamente — se recalcula a partir de la suma de Movimientos de Stock (ver 2.4). Se cachea acá por performance, pero la fuente de verdad es el historial de movimientos |
| `stock_minimo` | numeric, nullable | Umbral para alertas |
| `actualizado_en` | timestamp | |

### 2.5 Movimiento de Stock (ledger — nunca se edita `cantidad_actual` a mano)

Aplicando la misma filosofía de auditoría ya fijada para Ventas y Financiero (nunca sobrescribir, siempre un asiento nuevo): el stock nunca se "edita", se registra un movimiento y el saldo se recalcula.

| Campo | Tipo | Notas |
|---|---|---|
| `id` | uuid | PK |
| `producto_id` | uuid | FK |
| `sucursal_id` | uuid | FK |
| `tipo` | enum | `entrada_produccion`, `entrada_compra_reventa`, `entrada_ajuste_manual`, `salida_venta`, `salida_merma`, `salida_ajuste_manual`, `salida_transferencia`, `entrada_transferencia` |
| `cantidad` | numeric | Siempre positiva; el signo lo determina el `tipo` |
| `motivo` | text, obligatorio si `tipo` contiene `ajuste_manual` | Ej. "Conteo físico — diferencia por merma no registrada" |
| `referencia_id` | uuid, nullable | Apunta a la Venta, Producción o Compra que originó el movimiento, si aplica |
| `creado_por` / `creado_en` | uuid / timestamp | Quién lo registró |

**Regla de integridad:** ninguna pantalla ni ningún otro módulo puede escribir directamente en `cantidad_actual` de Stock. Todo pasa por crear un Movimiento; un proceso interno (trigger o función de servidor) recalcula el saldo.

---

## 3. Contrato de entrada/salida (caja negra, según arquitectura v3)

**Entradas que este módulo consume:**

| Origen | Dato que recibe |
|---|---|
| Módulo Operativo (si hay Nicho) | `costo_operativo`, `stock_producido` (vía `entrada_produccion`), `fecha_vencimiento` por lote |
| Proveedores / Compras (reventa directa, sin transformación) | `costo_compra`, `stock_ingresado` (vía `entrada_compra_reventa`) |
| Ventas | `descontar_stock(producto_id, sucursal_id, cantidad)` (vía `salida_venta`) |

**Salidas que este módulo expone:**

- `consultar_stock(producto_id, sucursal_id)`
- `consultar_precio_venta(producto_id)`
- `consultar_costo_operativo(producto_id)`
- `enviar_producto_a_operaciones(producto_id)` — solo si el tenant tiene un Nicho activo y el producto es `tipo_origen_producto = produccion_nicho`

---

## 4. Reglas de negocio clave (heredadas de la arquitectura general, aplicadas aquí)

1. **El precio de venta nunca lo calcula el sistema.** Se carga o edita manualmente en este módulo, exista o no un Nicho.
2. **El costo operativo nunca se edita a mano si hay Nicho activo y el producto es de producción.** Solo se puede editar manualmente cuando `tipo_origen_producto` es `manual` o `reventa_simple`, o cuando el negocio está en Modo Básico.
3. **Vinculación producto–Nicho, siempre explícita** (ya fijado en el Módulo 1, sección 5): un producto cargado en Modo Básico no se asocia automáticamente a una receta/proceso al migrar a un Nicho. La vinculación es una acción deliberada dentro de este módulo: "Vincular a proceso operativo".
4. **No se permite vender sin stock suficiente**, salvo que el rol del usuario tenga el permiso específico `vender_sin_stock` (pensado para casos de pre-venta/pedido anticipado) — **confirmado para el MVP**, no se pospone. Por defecto, ningún rol lo tiene habilitado; se activa caso por caso desde la gestión de roles.

   > **Impacto sobre el Módulo 1:** este permiso no encaja en las 4 acciones genéricas de la matriz (`ver`/`crear`/`editar`/`anular_ajustar`). Se modela como un **permiso especial adicional**, no ligado a un módulo × acción genérico sino a una capacidad puntual del rol (similar a un "feature flag" por rol). Técnicamente: una tabla `permisos_especiales_por_rol` (rol_id, capacidad) separada de la matriz genérica, para no forzar que todos los módulos tengan una acción que solo aplica a Ventas/Productos. Esto queda como una adenda al Módulo 1 — lo señalo acá para no perder la trazabilidad de por qué aparece.
5. **Cambiar el precio de venta o el costo vigente de un producto nunca modifica ventas ya registradas** — coherente con el patrón de snapshot ya definido: cada venta guardó su propio `precio_venta_snapshot` y `costo_unitario_snapshot` en su momento.

---

## 5. Alertas de stock mínimo

- Cuando `cantidad_actual <= stock_minimo` para una combinación producto–sucursal, el sistema expone un indicador `bajo_stock_minimo = true` a través de `consultar_stock()`.
- Este módulo **no envía notificaciones por sí mismo** — es responsabilidad de la capa de Dashboard/Reportes (y del asistente Tuki, ya mencionado en los documentos funcionales) leer este indicador y presentarlo. Mantiene la regla de que cada módulo es dueño exclusivo de sus propios datos, sin lógica de notificación mezclada.

---

## 6. Reventa simple dentro de un Nicho de producción — decisión que estaba pendiente

Los documentos funcionales dejaban esto marcado explícitamente como pendiente de validar: *¿qué pasa con un negocio de Nicho 1 (producción) que además revende algún producto sin transformarlo (ej. vasos, botellas, un insumo de terceros)?*

**Resuelto con el campo `tipo_origen_producto`:** en vez de forzar un segundo Nicho (que ya descartamos — un tenant tiene un solo Nicho), cada producto individual puede marcarse como:

- `produccion_nicho` — pasa por Operaciones, recibe costo sugerido, tal como describe el Módulo Operativo.
- `reventa_simple` — se carga con costo y precio directo (como en Modo Básico), aunque el tenant tenga un Nicho activo. Recibe stock/costo desde Proveedores si aplica.
- `manual` — mismo comportamiento que `reventa_simple`, para el caso de Modo Básico puro (sin Nicho en absoluto).

Esto resuelve el caso mixto sin romper la regla de "un tenant, un Nicho", y sin necesitar un segundo Módulo Operativo.

---

## 7. Casos de uso comunes

1. **Crear un producto en Modo Básico:** se carga nombre, precio, costo y stock inicial manualmente (vía un primer Movimiento de tipo `entrada_ajuste_manual` con motivo "Carga inicial").
2. **Crear un producto en un negocio con Nicho activo:** se define nombre y precio; el usuario decide si es `produccion_nicho` (se envía a Operaciones para asociar receta) o `reventa_simple`.
3. **Registrar una venta:** Ventas llama a `descontar_stock()`, se crea un `salida_venta`, se recalcula `cantidad_actual`.
4. **Recibir una producción:** Operaciones dispara `entrada_produccion` con el `stock_producido` y el `costo_operativo` calculado; se actualiza `costo_operativo_vigente` del producto.
5. **Recibir una compra de reventa:** Proveedores dispara `entrada_compra_reventa` con `costo_compra` y `stock_ingresado`.
6. **Ajuste por conteo físico o merma:** se crea un `entrada_ajuste_manual` o `salida_ajuste_manual` con `motivo` obligatorio — nunca se edita `cantidad_actual` directamente.
7. **Transferencia de stock entre sucursales** (solo en planes con multi-sucursal): genera un par de movimientos ligados — `salida_transferencia` en la sucursal origen y `entrada_transferencia` en la sucursal destino, con el mismo `referencia_id` para poder rastrearlos como una sola operación.

---

## 8. Casos borde

1. **Eliminar (soft-delete) un producto con stock positivo:** el sistema advierte y requiere confirmación explícita — no se pierde el valor de inventario de los reportes históricos, y el producto sigue existiendo (solo oculto) para que las ventas pasadas mantengan su referencia íntegra.
2. **Actualización de costo por variación de precio de un insumo (ej. sube el precio de la leche):** el Módulo Operativo recalcula y sugiere un nuevo `costo_operativo_vigente`; esto **no reescribe** el histórico de ventas ya hechas con el costo anterior — coherente con el patrón de snapshot.
3. **Downgrade de plan que quita soporte multi-sucursal, con stock repartido en varias sucursales:** análogo a la regla ya fijada para cofundadores en el Módulo 1 — el sistema no elimina ni consolida stock automáticamente; exige que el Owner decida y transfiera el stock a la sucursal que quedará activa antes de completar el downgrade.
4. **Intento de vender más cantidad de la que hay en stock:** bloqueado por defecto (regla 4 de la sección 4), salvo permiso explícito `vender_sin_stock`.
5. **Un mismo insumo comparte varios productos** (ej. la leche se usa en 4 sabores de gelato): esto se resuelve enteramente dentro de Inventario Operativo/Operaciones (Módulo 6) — este módulo solo recibe el `costo_operativo` ya calculado por producto individual, nunca gestiona el insumo compartido directamente.

---

## 9. Confirmaciones de esta ronda

1. **Stock por sucursal / precio por tenant:** confirmado (sección 1).
2. **`vender_sin_stock`:** confirmado para el MVP, con la adenda al Módulo 1 ya señalada en la sección 4.
3. **Categorías:** confirmado el esquema de sugerencias por Nicho desde el Panel CEOM (`CategoriaSugerida`), con libertad total del usuario para crear las suyas — sin necesidad de un set inicial cerrado desde el lanzamiento.

Con esto, el Módulo 2 queda cerrado.

---

*Módulo 2 — cerrado y confirmado. Continúa el Módulo 3 (Ventas).*