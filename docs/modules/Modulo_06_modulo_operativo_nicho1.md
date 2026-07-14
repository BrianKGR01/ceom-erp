# Módulo 6 — Módulo Operativo: Nicho 1 (Alimentos y Bebidas por Lotes)

## 0. Propósito del módulo y alcance

Este es el primer (y, para el MVP, único) implementador concreto de la interfaz "Módulo Operativo" que la arquitectura v3 dejó definida como intercambiable por Nicho. Cubre los tres sub-módulos ya acordados:

- **Inventario Operativo** — insumos/materia prima.
- **Operaciones (Producción)** — recetas y registro de lotes/tandas.
- **Capacidad Operativa** — solo lectura en el MVP, cruza capacidad (de Patrimonio) contra actividad real.

Es el módulo directamente relevante para **SanttiCampo**, tu primer caso de uso real.

**Deslinde ya fijado, reafirmado acá:**
- Este módulo **calcula** el costo operativo y lo **sugiere** hacia Productos e Inventario (Módulo 2) — nunca define el precio de venta.
- **No calcula capacidad usada** de forma autónoma con alertas — en el MVP es solo consulta (eso es Tuki, a futuro).
- **No es dueño del activo** — solo lee su capacidad desde Patrimonio (Módulo 5).

---

## 1. Entidades y modelo de datos

### 1.1 Insumo (catálogo)

| Campo | Tipo | Notas |
|---|---|---|
| `id` | uuid | PK |
| `tenant_id` | uuid | FK |
| `nombre` | text | Ej. "Leche", "Crema de leche", "Mermelada de frutos rojos" |
| `unidad_medida` | enum | `litros`, `ml`, `kg`, `g`, `unidad`, `metros` — ampliable |
| `vida_util_dias` | integer, nullable | Vida útil típica del insumo, en días. `null` si no es perecedero. Se usa para auto-calcular `fecha_vencimiento` en cada `entrada_compra` (ver 3.6), sin dejar de poder sobreescribirla a mano si el proveedor da una fecha distinta |
| `costo_unitario_vigente` | numeric, **derivado** | Costo promedio ponderado (ver sección 3.1) — no se edita a mano, se recalcula en cada compra |
| `stock_minimo` | numeric, nullable | Para alertas de reposición |
| `eliminado_en` | timestamp, nullable | |

### 1.2 Movimiento de Insumo (ledger — mismo patrón que Movimiento de Stock, Módulo 2)

| Campo | Tipo | Notas |
|---|---|---|
| `id` | uuid | PK |
| `insumo_id` | uuid | FK |
| `sucursal_id` | uuid | FK |
| `tipo` | enum | `entrada_compra`, `salida_produccion`, `entrada_ajuste_manual`, `salida_ajuste_manual`, `salida_merma_almacenamiento` (insumo que se vence o se daña sin llegar a producción) |
| `cantidad` | numeric | |
| `costo_unitario_en_movimiento` | numeric | El costo al que entró o salió esta unidad específica — necesario para que el costo de producción refleje el costo real, no uno recalculado después |
| `fecha_vencimiento` | date, nullable | Solo en `entrada_compra`, si el insumo es perecedero. Se auto-calcula desde `vida_util_dias` del Insumo si no se ingresa manualmente (ver 3.6) |
| `motivo` | text, obligatorio si el tipo es `ajuste_manual` o `merma` | |
| `referencia_id` | uuid, nullable | Apunta a la Compra o a la Producción que originó el movimiento |
| `creado_por` / `creado_en` | uuid / timestamp | |

### 1.3 StockInsumo (saldo por Insumo × Sucursal — derivado del ledger)

| Campo | Tipo | Notas |
|---|---|---|
| `insumo_id` / `sucursal_id` | uuid / uuid | PK compuesta |
| `cantidad_actual` | numeric, derivado | Suma de movimientos, igual que en Módulo 2 |
| `actualizado_en` | timestamp | |

### 1.4 Receta (por sabor/preparación base, no por presentación de venta)

Resuelve directamente el caso real de SanttiCampo: varias presentaciones (Simple, Doble, Triple, Medio litro, Litro) comparten el mismo sabor/preparación base, pero consumen distinta cantidad de esa base. Modelar la receta a nivel de "preparación base" y no de "producto individual" evita duplicar la misma composición de insumos cinco veces.

| Campo | Tipo | Notas |
|---|---|---|
| `id` | uuid | PK |
| `tenant_id` | uuid | FK |
| `nombre` | text | Ej. "Base Gelato Frutos Rojos" |
| `rendimiento_por_lote` | numeric | Ej. `3` |
| `unidad_rendimiento` | text | Ej. "litros" — debe ser compatible con la unidad en que luego se mida el consumo por presentación |
| `eliminado_en` | timestamp, nullable | |

### 1.5 Receta-Insumo (líneas — composición de la receta base)

| Campo | Tipo | Notas |
|---|---|---|
| `id` | uuid | PK |
| `receta_id` | uuid | FK |
| `insumo_id` | uuid | FK |
| `cantidad_por_lote` | numeric | Cantidad de este insumo necesaria para producir `rendimiento_por_lote` |

### 1.6 Vinculación Producto–Receta (la "vinculación explícita" ya fijada en el Módulo 1, sección 5, ahora con su modelo de datos concreto)

Vive acá, en el Módulo Operativo — no en Productos e Inventario (Módulo 2), para no ensuciar el Core con datos propios del Nicho.

| Campo | Tipo | Notas |
|---|---|---|
| `id` | uuid | PK |
| `producto_id` | uuid | FK a Producto (Módulo 2), debe tener `tipo_origen_producto = produccion_nicho` |
| `receta_id` | uuid | FK |
| `cantidad_base_consumida_por_unidad` | numeric | Ej. la presentación "Simple" consume `0.1` de la unidad de rendimiento de la receta (litros); "Litro" consume `1` |
| `eliminado_en` | timestamp, nullable | |

Con esto, **cada presentación calcula su propio costo operativo real**, aunque comparta receta con otras — resuelve exactamente el hallazgo de tu análisis inicial (Frutos Rojos y Vainilla, o distintas presentaciones, con costos que hoy se mezclan de forma inconsistente en el Excel).

### 1.7 Producción (registro de lote/tanda)

| Campo | Tipo | Notas |
|---|---|---|
| `id` | uuid | PK |
| `tenant_id` | uuid | FK |
| `sucursal_id` | uuid | FK |
| `producto_id` | uuid | FK — la presentación específica que se produjo |
| `activo_id` | uuid | FK a Patrimonio (Módulo 5) — qué equipo se usó |
| `fecha_produccion` | timestamp | |
| `cantidad_lotes_producidos` | numeric | Ej. `1.5` tandas |
| `cantidad_real_obtenida` | numeric | Unidades reales de esa presentación obtenidas — puede ser menor al rendimiento teórico por merma |
| `fecha_vencimiento_lote` | date, nullable | Se auto-calcula como `fecha_produccion + vida_util_dias` del Producto (ver 3.6, adenda al Módulo 2), sobreescribible a mano. Viaja hacia Productos e Inventario junto con el stock producido |
| `costo_operativo_calculado` | numeric, **derivado** | Ver fórmula en 3.2 |
| `merma_cantidad` | numeric, **derivado** | `rendimiento_teórico − cantidad_real_obtenida` |
| `merma_costo` | numeric, **derivado** | Costo de la merma, ya incorporado dentro de `costo_operativo_calculado` (ver 3.3) |
| `creado_por` / `creado_en` | uuid / timestamp | |
| `eliminado_en` | timestamp, nullable | Soft delete — para errores de carga; una producción real ya consumida no se "deshace" así, ver casos borde |

---

## 2. Contrato de entrada/salida

**Entradas que este módulo consume:**
- De **Productos e Inventario** (Módulo 2): la definición del producto que necesita vincularse a una receta (`tipo_origen_producto = produccion_nicho`).
- De **Proveedores/Compras**: `evento_compra_registrada` cuando el ítem comprado es un insumo → genera `entrada_compra` en Movimiento de Insumo y actualiza `costo_unitario_vigente`.
- De **Patrimonio** (Módulo 5, solo lectura): `consultar_capacidad(activo_id)` y `consultar_pasivo_de_activo(activo_id)` no se usan acá directamente — los consume la Capacidad Operativa (sección 4).

**Salidas que este módulo expone:**
- Hacia **Productos e Inventario**: al confirmar una Producción, `costo_operativo` (calculado) + `stock_producido` (= `cantidad_real_obtenida`) + `fecha_vencimiento_lote` — vía `entrada_produccion`.
- `consultar_capacidad_produccion_usada(periodo)`, `consultar_capacidad_almacenamiento_usada()` — para Reportes y el dashboard (sección 4).
- `consultar_merma_periodo(periodo)` (Módulo 10, adenda) — suma de `merma_costo` de todas las `Producción` del período, para el reporte de control de merma.
- **Nada se envía directo a Costos y Gastos.** La merma no es un gasto aparte — su costo ya queda incorporado en `costo_operativo_calculado`, y por lo tanto impacta el Estado de Resultados automáticamente cuando ese producto se vende (vía el COGS que ya viaja con la venta). Esto reproduce exactamente lo que confirman los flujos funcionales de La Nona: *"la merma no tiene módulo propio, vive dentro de Producción y alimenta a Reportes."*

---

## 3. Reglas de negocio clave (con las fórmulas concretas)

### 3.1 Costeo de insumos: costo promedio ponderado

Resuelve directamente el hallazgo real de tu Excel de SanttiCampo (costo unitario inconsistente entre hojas). Se adopta **costo promedio ponderado** — el método estándar más simple y ampliamente usado en sistemas de inventario para PyMEs (frente a FIFO/LIFO, que exigen trazabilidad por lote y son más complejos de mantener):

```
nuevo_costo_promedio = (stock_actual × costo_promedio_actual + cantidad_comprada × costo_de_compra)
                        ÷ (stock_actual + cantidad_comprada)
```

Se recalcula automáticamente cada vez que entra una compra de ese insumo. `costo_unitario_vigente` en el Insumo siempre refleja este promedio — nunca se edita a mano.

### 3.2 Costo operativo real de una Producción

```
costo_operativo_calculado = (Σ cantidad_por_lote_insumo × costo_unitario_vigente_insumo × cantidad_lotes_producidos)
                             ÷ cantidad_real_obtenida
```

Al dividir por la cantidad **real** obtenida (no la teórica), la merma queda automáticamente incorporada: si hubo merma, el costo por unidad sube solo, sin que el usuario lo calcule aparte.

### 3.3 La merma no es un módulo aparte

`merma_cantidad` y `merma_costo` son campos derivados dentro de `Producción`, no una entidad separada — coherente con el patrón ya usado en los flujos funcionales relevados. Se exponen a Reportes para mostrar "costo de merma del período" sin necesitar un módulo propio.

### 3.4 Vinculación producto–receta, siempre explícita

Ningún producto con `tipo_origen_producto = produccion_nicho` puede registrar una Producción sin tener antes una fila en `Vinculación Producto–Receta` — reafirma la regla ya fijada en el Módulo 1 (sección 5) y en el Módulo 2 (sección 4, regla 3).

### 3.5 Producir sin insumo suficiente — permiso especial de excepción

**Confirmado que hace falta la excepción**, por el caso real que señalaste: no todo insumo llega registrado formalmente desde Proveedores (el emprendedor puede comprarlo él mismo sin cargarlo a tiempo), y exigir stock siempre bloquearía producción legítima por un simple atraso de carga de datos, no por falta real de insumo.

Se resuelve con el mismo mecanismo ya usado para `vender_sin_stock` (Módulo 2) y `gestionar_eventos`/`importar_historico` (Módulo 3): una capacidad especial `producir_sin_stock_insumo` en `permisos_especiales_por_rol` / `permisos_especiales_por_usuario` (adenda al Módulo 1), configurable por rol y con posibilidad de override puntual por usuario. Por defecto en `false` para todos los roles salvo el Owner, igual criterio que las demás capacidades especiales.

### 3.6 Vencimiento por vida útil — sin FIFO real, pero con fecha calculada automáticamente

Resuelto siguiendo tu planteo: en vez de exigir trazabilidad por lote (FIFO completo, que sería sobreingeniería para el MVP dado que el costeo ya es por promedio ponderado), cada **Insumo** y cada **Producto** tiene una `vida_util_dias` propia — reconoce que no todos los perecederos duran lo mismo (una mermelada dura más que la leche fresca, por ejemplo).

- Al registrar una `entrada_compra` de un Insumo, si no se ingresa manualmente una `fecha_vencimiento`, el sistema la calcula sola: `fecha_compra + vida_util_dias` del Insumo.
- Al registrar una `Producción`, `fecha_vencimiento_lote` se calcula igual: `fecha_produccion + vida_util_dias` del Producto (campo que se agrega como adenda al Módulo 2, ver más abajo).
- Esto no reemplaza una trazabilidad FIFO por lote real, pero cubre el caso práctico de alertar vencimientos próximos sin la complejidad de rastrear qué unidad física específica se consumió primero — coherente con seguir usando costo promedio ponderado en vez de costeo por lote.

> **Adenda al Módulo 2:** se agrega el campo `vida_util_dias` (integer, nullable) a la entidad `Producto`, con el mismo propósito — aplica tanto si el producto viene de este Módulo Operativo como si es de reventa directa o Modo Básico (cualquier producto puede ser perecedero, no solo los de producción). Reemplaza en la práctica al uso de `fecha_vencimiento_referencia` para el caso general; ese campo queda como override manual puntual cuando la vida útil calculada no aplica a una unidad específica.

---

## 4. Capacidad Operativa (solo consulta en el MVP — sin alertas automáticas)

No es una entidad persistida — es un cálculo bajo demanda que cruza el dato crudo de Patrimonio con la actividad real registrada en este módulo. Confirmado en los documentos funcionales: **se calculan dos indicadores en paralelo, sin asumir cuál es el cuello de botella**, porque en SanttiCampo el límite real es el almacenamiento (la heladera), no la velocidad de producción de la máquina.

| Indicador | Fórmula |
|---|---|
| **Capacidad de producción del período** | `(disponibilidad_horaria_semanal del Activo ÷ tiempo_estimado_por_ciclo_minutos) × capacidad_produccion_cantidad del Activo`, ajustado al período consultado |
| **% de capacidad de producción usada** | `producción real registrada en el período ÷ capacidad de producción del período` |
| **Capacidad de almacenamiento** | `capacidad_almacenamiento_cantidad del Activo` (dato crudo de Patrimonio) |
| **% de capacidad de almacenamiento usada** | `stock de producto terminado actual ÷ capacidad de almacenamiento del Activo` |

En el MVP esto es **solo consulta** — el dashboard puede mostrar ambos porcentajes, pero no hay alertas automáticas ni proyecciones de inversión (eso queda para una fase posterior con Tuki, tal como ya estaba anotado en los documentos funcionales).

---

## 5. Casos de uso comunes

1. **Registrar la compra de un insumo:** llega desde Proveedores, genera `entrada_compra`, recalcula `costo_unitario_vigente`.
2. **Crear una receta base** y sus insumos (ej. "Base Gelato Frutos Rojos").
3. **Vincular cada presentación de venta a la receta**, con su `cantidad_base_consumida_por_unidad` (Simple = 0.1L, Doble = 0.2L, etc.).
4. **Registrar una Producción:** se descuentan los insumos, se calcula el costo real (con merma incorporada), se envía el stock y costo sugerido a Productos e Inventario.
5. **Consultar capacidad de producción y almacenamiento usadas**, para decidir si conviene invertir en un nuevo equipo (la proyección de inversión en sí es una función de Simulaciones/Tuki, fuera de este módulo).

---

## 6. Casos borde

1. **Producción con merma:** el costo operativo por unidad sube automáticamente (fórmula 3.2) — no requiere ningún ajuste manual.
2. **Insumo insuficiente para completar la producción planeada:** bloqueado por defecto (regla 3.5).
3. **Variación de precio de un insumo a mitad de un período:** el costo promedio ponderado se recalcula con cada compra; una Producción usa siempre el costo vigente **al momento de producir**, nunca se recalculan producciones pasadas — mismo principio de snapshot que en Ventas.
4. **Producto sin receta vinculada:** bloqueado para registrar Producción (regla 3.4).
5. **Corrección de una Producción ya registrada, con stock ya consumido en ventas posteriores:** no se edita ni se hace soft-delete directo — se corrige con una Producción de ajuste (mismo espíritu que `AjusteVenta`): un registro nuevo que referencia a la Producción original y corrige la cantidad o el costo, preservando la trazabilidad. Ver pregunta abierta 2.
6. **Insumo perecedero que se vence sin llegar a producción:** se registra `salida_merma_almacenamiento` en Movimiento de Insumo, con motivo obligatorio — distinto de la merma de producción (que se mide en 3.3).

---

## 7. Confirmaciones de esta ronda

1. **Producir sin insumo suficiente:** confirmado — se agrega la capacidad especial `producir_sin_stock_insumo` (sección 3.5), como adenda al catálogo de capacidades especiales del Módulo 1.
2. **Corrección de una Producción ya registrada:** confirmado el enfoque de "Producción de ajuste" (nuevo registro que referencia al original), mismo espíritu que `AjusteVenta`.
3. **Alertas de vencimiento:** resuelto con `vida_util_dias` por Insumo y por Producto (sección 3.6), que auto-calcula la fecha de vencimiento sin exigir trazabilidad FIFO por lote — mantiene la simplicidad del costeo por promedio ponderado, cubriendo igual el caso real de que distintos insumos/productos duren tiempos muy distintos.

Con esto, el Módulo 6 queda cerrado.

---

*Módulo 6 — cerrado y confirmado. Continúa el Módulo 7 (Financiero).*