# Módulo 8 — Proveedores / Compras

## 0. Propósito del módulo y alcance (qué NO cubre)

Es el punto de entrada de datos para todo lo que el negocio le compra a terceros — sea insumo (va a Inventario Operativo, Módulo 6) o producto para reventa directa (va a Productos e Inventario, Módulo 2). Es de **Core**, no de Nicho: todo rubro compra a alguien, exista o no un Módulo Operativo activo.

**Deslinde deliberado:**
- Este módulo **no decide el costo operativo** de un producto terminado — eso lo calcula el Módulo Operativo (Nicho) o se carga directo en Modo Básico.
- Este módulo **no es un gasto operativo** (eso es Costos y Gastos, Módulo 4) **ni un costo de venta** (eso es Ventas/Financiero vía COGS).
- **Fuera de alcance por ahora:** Órdenes de Compra formales y Landed Cost (prorrateo de flete) son funcionalidades específicas de Nicho 4 (Comercio Minorista), que no está en el roadmap actual — el foco sigue siendo Nicho 1 (SanttiCampo). Se documentan cuando se aborde ese Nicho, con la dirección de diseño que dejo esbozada en la sección 7.

---

## 1. Entidades y modelo de datos

### 1.1 Proveedor

| Campo | Tipo | Notas |
|---|---|---|
| `id` | uuid | PK |
| `tenant_id` | uuid | FK |
| `nombre` | text | |
| `contacto` | text, nullable | Teléfono/email |
| `notas` | text, nullable | |
| `creado_por` / `creado_en` | uuid / timestamp | |
| `eliminado_en` | timestamp, nullable | |

### 1.2 Compra

| Campo | Tipo | Notas |
|---|---|---|
| `id` | uuid | PK |
| `tenant_id` | uuid | FK |
| `sucursal_id` | uuid | FK — dónde se recibe la mercadería |
| `proveedor_id` | uuid, **nullable** | Permite compras informales sin proveedor fijo (ej. compra de mercado) |
| `tipo` | enum | `insumo` (va a Inventario Operativo, Módulo 6) / `reventa` (va a Productos e Inventario, Módulo 2) |
| `item_id` | uuid | Referencia al Insumo o al Producto, según `tipo` |
| `cantidad` | numeric | |
| `costo_unitario` | numeric, derivado | `monto_total ÷ cantidad` |
| `monto_total` | numeric | |
| `fecha_compra` | date | |
| `fecha_vencimiento` | date, nullable | Si el ítem es perecedero — viaja junto con `compra_registrada` hacia Inventario Operativo (que la usa o la auto-calcula por `vida_util_dias` si no se especifica, según regla 3.6 del Módulo 6) |
| `estado_pago` | enum, **derivado** | `pendiente` / `parcial` / `pagado` — mismo patrón que Ventas y Gastos (ver sección 3.1) |
| `creado_por` / `creado_en` | uuid / timestamp | |
| `eliminado_en` | timestamp, nullable | Soft delete — solo para errores de carga; una compra ya recibida y consumida se corrige con una Compra de ajuste (sección 3.3), no se borra |

### 1.3 Pago de Compra (ledger — mismo patrón que Pago de Venta y Pago de Gasto)

| Campo | Tipo | Notas |
|---|---|---|
| `id` | uuid | PK |
| `compra_id` | uuid | FK |
| `monto` | numeric | |
| `fecha_pago` | date | Fecha real en que sale la plata — puede ser posterior a `fecha_compra` (compra a crédito/consignación) |
| `creado_por` / `creado_en` | uuid / timestamp | |

### 1.4 Compra de Ajuste (corrección — mismo espíritu que AjusteVenta y Producción de ajuste)

| Campo | Tipo | Notas |
|---|---|---|
| `id` | uuid | PK |
| `compra_id` | uuid | FK a la Compra que ajusta |
| `tipo` | enum | `correccion`, `devolucion_a_proveedor`, `anulacion_total` |
| `monto_ajuste` | numeric | |
| `motivo` | text, obligatorio | |
| `creado_por` / `creado_en` | uuid / timestamp | |

---

## 2. Contrato de entrada/salida

**Entradas:** ninguna — es punto de entrada de datos, igual que en la arquitectura v3.

**Salidas que este módulo expone:**
- `historial_precio(item_id)` — lista de compras pasadas de ese ítem, ordenadas por fecha, para detectar variación de precio (dato disponible; el análisis proactivo de "subió el precio" es Tuki, a futuro).
- `ficha_proveedor(proveedor_id)` — resumen de compras a ese proveedor.
- Evento `compra_registrada(monto, item_id, tipo, fecha, sucursal_id)` — se dispara **al recibir la mercadería**, no al pagarla. Consumido por:
  - **Inventario Operativo** (Módulo 6), si `tipo = insumo` → genera `entrada_compra` en Movimiento de Insumo.
  - **Productos e Inventario** (Módulo 2), si `tipo = reventa` → genera `entrada_compra_reventa` en Movimiento de Stock.
- Hacia **Financiero** (Módulo 7): **no vía `compra_registrada` directo** — vía el ledger `Pago de Compra` (adenda de esta ronda, ver sección 3.1), igual criterio que ya se aplicó a Gastos.

---

## 3. Reglas de negocio clave

### 3.1 Recepción vs. pago — mismo patrón ya aplicado a Gastos (adenda al Módulo 7)

Al construir este módulo quedó en evidencia la misma inconsistencia que ya habíamos corregido en Costos y Gastos: **recibir mercadería y pagarla son dos eventos distintos**, y una compra a crédito o en consignación (común al comprar a mayoristas) no se paga necesariamente el mismo día que se recibe.

- El **stock y el costo se actualizan al recibir** la mercadería (`compra_registrada`, inmediato, sin importar el estado de pago) — porque el insumo o producto ya está físicamente disponible para producir o vender.
- El **Flujo de Caja se actualiza al pagar** (`Pago de Compra`, por `fecha_pago`) — no al recibir.

**Confirmado — adenda al Módulo 7 (Financiero):** la fórmula de `flujo_caja` deja de sumar `compra_registrada` directamente y pasa a sumar `Σ Pago de Compra (por fecha_pago)` — exactamente el mismo ajuste que se hizo para `Pago de Gasto`. Con esto, los tres flujos de dinero (Ventas, Gastos, Compras) quedan simétricos: cada uno con un ledger de pagos propio que separa "cuándo ocurrió" de "cuándo se cobró/pagó".

### 3.2 Alerta de variación de precio — solo dato disponible en el MVP

`historial_precio(item_id)` deja el dato listo para comparar, pero no genera alertas automáticas todavía — eso es Tuki, a futuro, tal como ya estaba anotado en los documentos funcionales.

### 3.3 Corrección de una Compra ya registrada

Mismo principio ya aplicado a Ventas y a Producción: una Compra no se edita directamente una vez que su stock ya fue consumido (vendido o usado en producción) — se corrige con una **Compra de Ajuste** (1.4) que referencia a la original, con motivo obligatorio.

### 3.4 Compra sin proveedor asociado

Se permite `proveedor_id = null` para compras informales (ej. comprar insumos en el mercado sin un proveedor fijo registrado) — no se fuerza dar de alta un proveedor solo para poder registrar una compra.

---

## 4. Casos de uso comunes

1. **Registrar una compra de insumo:** llega a Inventario Operativo, actualiza `costo_unitario_vigente` (promedio ponderado, Módulo 6).
2. **Registrar una compra de reventa directa:** llega a Productos e Inventario.
3. **Registrar el pago de una compra a crédito**, total o parcial, vía `Pago de Compra`.
4. **Consultar el historial de precios de un insumo**, para decidir si conviene cambiar de proveedor o ajustar el precio de venta del producto que lo usa.
5. **Consultar la ficha de un proveedor**, con su historial de compras.

---

## 5. Casos borde

1. **Compra a crédito pagada en varias cuotas:** soportado naturalmente por el ledger `Pago de Compra`, igual que en Gastos y Ventas.
2. **Ítem comprado que luego se elimina (soft-delete) del catálogo:** la Compra conserva su referencia histórica intacta — no se rompe el historial de precios ni el costo promedio ya calculado.
3. **Corrección de una compra con stock ya consumido:** resuelto con Compra de Ajuste (regla 3.3), nunca editando directamente.
4. **Compra registrada por error con el `tipo` equivocado** (ej. se cargó como reventa cuando era insumo): se corrige con una `anulacion_total` vía Compra de Ajuste y se vuelve a registrar con el tipo correcto — no se edita el campo `tipo` directamente, porque cambiar el tipo cambiaría a qué módulo ya se le disparó el evento `compra_registrada`.

---

## 6. Dirección de diseño para Nicho 4 (a futuro): lo más simple e intuitivo posible para el usuario

Pediste priorizar la experiencia del usuario por sobre la facilidad de construcción. Con ese criterio, cuando se aborde Nicho 4, propongo evitar crear conceptos nuevos que el usuario tenga que aprender, y en cambio **extender lo que ya existe** en este módulo:

- **Landed Cost, como un campo opcional dentro de la misma Compra**, no como una calculadora aparte: al registrar una Compra, un campo opcional "¿Tuviste algún costo extra de flete/transporte en esta compra?" (`costo_adicional_traslado`, numeric, nullable). Si se completa, el sistema prorratea solo: `costo_unitario = (monto_total + costo_adicional_traslado) ÷ cantidad`. El usuario nunca ve la palabra "landed cost" ni tiene que entender el concepto contable — solo contesta una pregunta simple con un número.
- **Órdenes de Compra formales, como un estado más de la misma Compra**, no como una entidad nueva y separada: en vez de que el usuario tenga que aprender la diferencia entre "Orden de Compra" y "Compra" (dos pantallas, dos conceptos, una relación entre ambos que hay que explicar), se propone que una `Compra` simplemente pueda nacer en estado `pedido` (se espera, todavía no llegó) y pasar a `recibido` cuando efectivamente entra la mercadería — un único concepto ("Compra"), con un estado de más, en vez de dos objetos distintos que el usuario tiene que relacionar mentalmente.

Esto es una dirección de diseño, no una implementación cerrada — se retoma con el detalle completo cuando se documente Nicho 4.

---

## 7. Confirmaciones de esta ronda

1. **Adenda al Módulo 7:** confirmada — ya aplicada, ver sección 3.1 y el Módulo 7 actualizado.
2. **Landed Cost y Órdenes de Compra formales:** quedan fuera de este módulo, con la dirección de diseño simple/intuitiva propuesta en la sección 7 como guía para cuando se retome Nicho 4.
3. **Corrección de una Compra ya registrada:** confirmado el patrón de "Compra de Ajuste" (regla 3.3), igual que Ventas y Producción.

Con esto, el Módulo 8 queda cerrado.

---

*Módulo 8 — cerrado y confirmado. Continúa el Módulo 9 (Simulaciones).*