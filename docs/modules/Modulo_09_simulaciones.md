# Módulo 9 — Simulaciones (Simular Precio + Punto de Equilibrio)

## 0. Propósito del módulo y alcance

Al igual que Financiero (Módulo 7), este módulo se apoya casi enteramente en datos ya existentes en Ventas, Productos y Financiero — pero, a diferencia de Financiero, sí termina necesitando dos tablas propias mínimas: el **historial de simulaciones** (para poder comparar en el tiempo) y una **configuración del umbral de alerta** del comparativo multi-SKU (sección 1.4). Se detallan en la sección 1.5.

Confirmado en los documentos funcionales: Simular Precio y Punto de Equilibrio **se fusionan bajo un mismo módulo**, y comparten un único motor matemático (no se duplica la fórmula entre ambos, ni con la futura alerta proactiva de inversión en activos).

**Lección explícita de un prototipo anterior, que este diseño corrige:** el costo de producción en Simular Precio **es automático por defecto**, con opción de ajuste manual — nunca manual-por-defecto, que era justamente el problema del prototipo viejo (el usuario "simulaba a ciegas").

---

## 1. Simular Precio

### 1.1 Datos que se muestran automáticamente al elegir un producto (sin que el usuario los pida)

- Rotación del último período (de Ventas).
- Margen actual (de Financiero, `margen_por_producto()`).
- Costo real más reciente (de Productos e Inventario / Módulo Operativo).

### 1.2 Inputs del usuario

| Input | Notas |
|---|---|
| `frecuencia` | `semanal` / `mensual` |
| `periodo` | Rango de tiempo a proyectar |
| `margen_deseado_pct` | % de margen que el usuario quiere lograr |
| `costo_produccion` | **Automático por defecto** (el costo real vigente del producto), con opción de sobreescribirlo manualmente **solo para esta simulación puntual** — no persiste ni modifica el costo real del producto en Productos e Inventario (ver regla 3.3) |

### 1.3 Output

```
precio_sugerido = costo_produccion ÷ (1 − margen_deseado_pct)

impacto_proyectado_bs = (precio_sugerido − precio_venta_actual) × rotación_histórica_del_período
```

`impacto_proyectado_bs` muestra cuánto más (o menos) ganaría el negocio al mes si aplicara ese precio, calculado **contra la rotación real histórica**, no una rotación inventada — esa es la diferencia clave frente al prototipo anterior.

### 1.4 Comparativo multi-SKU

Una tabla con todos los productos del catálogo: costo, precio actual, margen %, precio sugerido — **resaltando automáticamente la fila donde el margen se aleja "mucho" del promedio del catálogo** (resuelve directamente el caso real de SanttiCampo: Frutos Rojos y Vainilla al mismo precio con costos distintos).

**Confirmado:** el umbral default es **15 puntos porcentuales** de diferencia respecto al promedio del catálogo, pero es **regulable por el Owner o un rol con permiso de editar en este módulo** — no queda fijo en el código. Queda anotado como mejora futura (no ahora) la posibilidad de ofrecer un método más preciso como desviación estándar, como alternativa opcional al porcentaje fijo, sin quitarle al usuario la opción simple por defecto.

### 1.5 Entidades propias (mínimas)

**ConfiguracionSimulaciones** (una fila por tenant):

| Campo | Tipo | Notas |
|---|---|---|
| `tenant_id` | uuid | PK |
| `umbral_margen_alerta_pct` | numeric | Default `15`. Editable por cualquier rol con permiso `editar` en el módulo `simulaciones` (matriz genérica ya existente, Módulo 1 — no hace falta un permiso especial nuevo) |
| `modificado_por` / `modificado_en` | uuid / timestamp | |

**Simulacion** (historial — permite comparar en el tiempo, como pediste):

| Campo | Tipo | Notas |
|---|---|---|
| `id` | uuid | PK |
| `tenant_id` | uuid | FK |
| `producto_id` | uuid | FK |
| `tipo` | enum | `simular_precio` / `punto_equilibrio` |
| `frecuencia` / `periodo` | text / text | Los inputs elegidos |
| `margen_deseado_pct` | numeric, nullable | Solo si `tipo = simular_precio` |
| `costo_usado` | numeric | El costo real usado en esa simulación puntual |
| `costo_es_manual` | boolean | Si el usuario sobreescribió el costo automático para esa simulación |
| `precio_sugerido` / `impacto_proyectado_bs` | numeric, nullable | Resultado, si `tipo = simular_precio` |
| `punto_equilibrio_unidades` | numeric, nullable | Resultado, si `tipo = punto_equilibrio` |
| `creado_por` / `creado_en` | uuid / timestamp | |

No tiene `eliminado_en` — es un registro histórico de consulta, no un dato operativo que se corrija; simplemente se acumulan más simulaciones.

---

## 2. Punto de Equilibrio

### 2.1 Inputs (auto-completados, el usuario solo elige producto, frecuencia y período)

- `costo_fijo_total(periodo)` — de Financiero (Módulo 7), que a su vez lo toma de Costos y Gastos (Módulo 4).
- `costo_variable_unitario` — de Productos e Inventario (costo operativo vigente).
- `precio_venta` — de Productos e Inventario.

### 2.2 Output

```
margen_contribucion_unitario = precio_venta − costo_variable_unitario

punto_equilibrio_unidades = costo_fijo_total(periodo) ÷ margen_contribucion_unitario
```

Unidades mínimas a vender en el período para cubrir los costos, con un gráfico simple.

### 2.3 Un solo motor, reutilizado (no duplicado)

Confirmado en los documentos funcionales: este mismo cálculo (`monto_a_cubrir ÷ margen_contribución_unitario`) es el que también usa la proyección de inversión en activos ("vender X unidades para recuperar el freezer en Y meses" — Módulo 5/6, hoy manual, a futuro alerta de Tuki). Se modela como **una única función genérica**, con dos puntos de entrada:

```
unidades_para_cubrir(monto_a_cubrir, margen_contribucion_unitario) → unidades_necesarias
```

- **Punto de Equilibrio** (este módulo): `monto_a_cubrir = costo_fijo_total(periodo)`.
- **Proyección de inversión en un activo** (fuera de alcance de este módulo, corresponde a Patrimonio/Producción cuando se aborde la parte proactiva de Tuki): `monto_a_cubrir = valor_compra` del activo a evaluar. Acá solo se deja documentada la reutilización — no se construye esa pantalla en este módulo.

---

## 3. Reglas de negocio clave

1. **Tablas propias mínimas, no ausentes.** Los cálculos en sí siguen leyendo todo de Ventas, Productos y Financiero — lo único que este módulo posee es el historial de simulaciones y su propia configuración de umbral (sección 1.5), no los datos de negocio de fondo.
2. **Costo automático por defecto, ajuste manual opcional** — nunca al revés (regla ya explicada en la introducción).
3. **El ajuste manual de costo en una simulación nunca persiste ni sugiere cambiar el costo real del producto.** Es una pregunta de "qué pasaría si", no una edición — mantiene la fuente de verdad del costo real exclusivamente en Productos e Inventario / Módulo Operativo.
4. **Simular un precio nunca aplica ese precio automáticamente.** El usuario tiene que ir a Productos e Inventario (Módulo 2) y cambiarlo ahí si decide seguir la sugerencia — Simulaciones nunca escribe en otro módulo.
5. **Un solo motor de punto de equilibrio/recuperación de inversión**, nunca duplicado entre este módulo y futuras alertas proactivas (regla de la sección 2.3).

---

## 4. Casos borde

1. **Producto sin historial de ventas (rotación = 0):** confirmado — se muestra únicamente el `precio_sugerido`, sin `impacto_proyectado_bs` (que quedaría en blanco/no disponible), en vez de pedirle al usuario una estimación manual que generaría fricción. En cuanto el producto acumule historial de ventas, la proyección aparece sola, sin que el usuario tenga que hacer nada distinto.
2. **Margen de contribución cero o negativo** (el precio de venta no supera el costo variable): `punto_equilibrio_unidades` sería infinito o negativo, un resultado sin sentido para el usuario. El sistema debe mostrar una advertencia explícita en lenguaje simple ("a este precio, nunca vas a cubrir tus costos fijos") en vez de un número o un error críptico.
3. **Costo fijo total en cero** (negocio recién creado, sin gastos fijos aún cargados): `punto_equilibrio_unidades` da cero — válido matemáticamente, pero conviene aclarar en la interfaz que probablemente falten gastos fijos por cargar, no que el negocio ya cubre sus costos con cero ventas.

---

## 5. Confirmaciones de esta ronda

1. **Umbral del comparativo multi-SKU:** confirmado en 15 puntos porcentuales por defecto, regulable por el Owner o un rol con permiso de editar en este módulo (sección 1.4). Queda anotada la desviación estándar como posible mejora futura, sin construirla ahora.
2. **Producto sin historial de ventas:** confirmado — solo precio sugerido, sin proyección en bolivianos, para no generar fricción (caso borde 1).
3. **Historial de simulaciones:** confirmado que hace falta — se agrega la entidad `Simulacion` (sección 1.5), justamente para poder comparar simulaciones en el tiempo.

Como comentario tuyo, no una decisión de diseño: es muy probable que estos problemas de margen inconsistente que hoy tiene SanttiCampo dejen de repetirse una vez que el sistema ya esté llevando el registro real — coincido, y es exactamente el tipo de mejora que este módulo hace visible en vez de dejarla escondida en una hoja de cálculo.

Con esto, el Módulo 9 queda cerrado.

---

*Módulo 9 — cerrado y confirmado. Continúa el Módulo 10 (Reportes).*