# Módulo 5 — Patrimonio (Activos y Pasivos)

## 0. Propósito del módulo y alcance (qué NO cubre)

Patrimonio es **un mismo módulo conceptual de cara al usuario** que agrupa dos entidades con lógica propia: **Activos** (lo que el negocio tiene) y **Pasivos** (lo que el negocio debe). Se presentan juntos porque casi siempre se consultan juntos — la ficha de un activo financiado muestra el estado de su deuda en la misma pantalla — pero cada uno mantiene sus propias reglas y tablas.

**Deslinde deliberado, reafirmando una separación ya fijada en la arquitectura v3:**

- Este módulo **registra la capacidad** de un activo (cuánto produce, cuánto almacena, cuánta disponibilidad horaria hay) — pero **no calcula el porcentaje de uso ni genera alertas de capacidad**. Ese cálculo vive en Producción (dentro del Módulo Operativo de cada Nicho, Módulo 6), que cruza esta capacidad con la actividad productiva real. Patrimonio solo es dueño del dato crudo.
- Existe **independientemente de si hay o no un Nicho activo** — cualquier negocio en Modo Básico también tiene activos y puede tener deudas, aunque no tenga módulo operativo.

---

## 1. Entidades y modelo de datos

### 1.1 Activo

| Campo | Tipo | Notas |
|---|---|---|
| `id` | uuid | PK |
| `tenant_id` | uuid | FK |
| `sucursal_id` | uuid, nullable | Dónde está físicamente el activo. `null` si aplica a todo el negocio (ej. un vehículo compartido) |
| `nombre` | text | Ej. "Máquina de gelato", "Horno 1" |
| `tipo` | enum | `equipo_productivo`, `mobiliario`, `vehiculo`, `otro` |
| `capacidad_produccion_cantidad` | numeric, nullable | Ej. `7` |
| `capacidad_produccion_unidad` | text, nullable | Ej. "litros por lote", "empanadas por tanda" — solo aplica a `equipo_productivo` |
| `capacidad_almacenamiento_cantidad` | numeric, nullable | Independiente de la capacidad de producción — puede ser el límite más restrictivo (caso real de SanttiCampo: la heladera, no la máquina, es el cuello de botella) |
| `capacidad_almacenamiento_unidad` | text, nullable | Ej. "bandejas" |
| `disponibilidad_horaria_semanal` | numeric, nullable | Horas reales disponibles por semana para producir — nunca se asume una jornada completa |
| `requiere_descanso_entre_ciclos` | boolean | Distingue maquinaria que necesita enfriar/descansar (ej. algunos motores) de equipos de uso continuo que rinden mejor sin apagarse (ej. hornos industriales) |
| `tiempo_descanso_minutos` | numeric, nullable | Solo aplica si `requiere_descanso_entre_ciclos = true` |
| `tiempo_estimado_por_ciclo_minutos` | numeric, nullable | Tiempo que toma un lote/tanda completa |
| `estado` | enum | `activo`, `en_mantenimiento`, `dado_de_baja` — **estado de negocio, no un soft-delete** (ver sección 3) |
| `valor_compra` | numeric | |
| `fecha_adquisicion` | date | |
| `vida_util_meses` | numeric, nullable | Base para la depreciación lineal (ver 1.3). `null` si el activo no deprecia (ej. un terreno) |
| `proveedor_id` | uuid, nullable | FK opcional a Proveedores |
| `numero_serie` | text, nullable | |
| `vencimiento_garantia` | date, nullable | |
| `creado_por` / `creado_en` | uuid / timestamp | |
| `modificado_por` / `modificado_en` | uuid / timestamp | |
| `eliminado_en` | timestamp, nullable | Soft delete real — solo para errores de carga, no para "dar de baja" un equipo que existió de verdad |

### 1.2 Pasivo

| Campo | Tipo | Notas |
|---|---|---|
| `id` | uuid | PK |
| `tenant_id` | uuid | FK |
| `activo_id` | uuid, nullable | FK opcional — normalmente un pasivo financia un activo específico, pero puede no estar atado a ninguno (ej. un préstamo de capital de trabajo) |
| `monto_total` | numeric | |
| `cuota_periodica` | numeric | |
| `frecuencia_cuota` | enum | Mismo catálogo que `GastoRecurrente` (Módulo 4): `mensual`, `semanal`, `quincenal`, `anual` |
| `plazo_cuotas` | integer | Número total de cuotas pactadas |
| `fecha_inicio` | date | |
| `estado` | enum | `activo`, `pagado`, `refinanciado` |
| `refinanciado_desde_id` | uuid, nullable | Si este Pasivo reemplaza a uno anterior refinanciado (ver 3.2) |
| `creado_por` / `creado_en` | uuid / timestamp | |
| `eliminado_en` | timestamp, nullable | |

### 1.3 Depreciación (calculada, no almacenada)

No es una tabla — es un cálculo derivado sobre `Activo`, disponible bajo demanda:

```
valor_actual(activo) = MAX(0, valor_compra × (1 − meses_transcurridos ÷ vida_util_meses))
```

Depreciación lineal simple, tal como confirman los flujos funcionales relevados. Se recalcula cada vez que se consulta, no se guarda como snapshot histórico — no hace falta, porque depende solo de datos que ya son estables (`valor_compra`, `fecha_adquisicion`, `vida_util_meses`) más la fecha actual.

### 1.4 Pago de Pasivo (ledger — reduce el saldo pendiente)

| Campo | Tipo | Notas |
|---|---|---|
| `id` | uuid | PK |
| `pasivo_id` | uuid | FK |
| `monto` | numeric | |
| `fecha_pago` | date | |
| `origen` | enum: `automatico`, `manual` | Ver sección 2 |
| `creado_por` / `creado_en` | uuid / timestamp | |

`saldo_pendiente` de un Pasivo es **derivado**: `monto_total − suma(Pago de Pasivo)`. Cuando llega a `0`, el Pasivo pasa a `estado = pagado` automáticamente y deja de generar el gasto periódico.

---

## 2. Contrato de entrada/salida

**Salidas que este módulo expone:**
- `consultar_capacidad(activo_id)` → devuelve capacidad de producción, capacidad de almacenamiento, disponibilidad horaria y tiempo por ciclo — consumido por **Producción**, dentro del Módulo Operativo de cada Nicho (Módulo 6). Patrimonio entrega el dato crudo; **no calcula porcentaje de uso ni genera alertas**, eso es responsabilidad de Producción.
- `consultar_valor_actual(activo_id)` → depreciación bajo demanda (1.3).
- `consultar_pasivo_de_activo(activo_id)` → para que la ficha del Activo muestre, en la misma pantalla, cuota, saldo pendiente y próximo pago del Pasivo asociado, sin que el usuario tenga que navegar a otro lugar.
- Hacia **Costos & Gastos (Módulo 4)**: mientras un Pasivo esté `activo`, cada período (según `frecuencia_cuota`) se genera automáticamente un `Gasto` con `tipo = fijo`, `origen = cuota_pasivo_automatica`, y simultáneamente se registra un `Pago de Pasivo` con `origen = automatico` por el mismo monto, reduciendo el saldo — sin que el usuario reingrese nada (contrato ya fijado desde el lado de Costos y Gastos, reafirmado acá desde el origen).

---

## 3. Reglas de negocio clave

1. **Activos y Pasivos son un mismo módulo conceptual, con lógica separada.** Se presentan juntos en la interfaz (la ficha de un activo financiado muestra su deuda), pero cada uno tiene su propio ciclo de vida.
2. **"Dado de baja" es un estado de negocio, no una eliminación.** Un activo vendido, desechado o descontinuado sigue existiendo en el sistema con `estado = dado_de_baja`, visible en reportes históricos y en el cálculo de valor patrimonial acumulado — nunca se usa `eliminado_en` para esto (ese campo queda reservado para errores de carga genuinos).
3. **Un activo dado de baja no cancela su pasivo asociado.** Si se vende el equipo pero la deuda sigue vigente, el Pasivo continúa generando su gasto periódico normalmente — son entidades independientes aunque estén vinculadas.
4. **Un Pasivo nunca se edita para reflejar una renegociación.** Si se refinancia (cambia cuota o plazo), se crea un **nuevo** Pasivo con `refinanciado_desde_id` apuntando al anterior, y el anterior pasa a `estado = refinanciado` — mismo principio ya aplicado a Ventas: los movimientos financieros no se editan, se reemplazan con trazabilidad.
5. **Patrimonio nunca calcula capacidad usada.** Solo expone el dato crudo de capacidad; el cálculo de porcentaje de ocupación y las alertas de "te estás quedando sin espacio" viven en Producción (Módulo 6).

---

## 4. Casos de uso comunes

1. **Registrar un activo simple, sin financiamiento:** ej. un mueble — se carga valor de compra, tipo, vida útil; sin vínculo a Pasivo.
2. **Registrar un activo financiado:** ej. la máquina de gelato — se crea el Activo y, en el mismo flujo, un Pasivo vinculado (`activo_id`).
3. **Consultar la ficha de un activo financiado:** se ve, en una sola pantalla, su valor actual (depreciado) y el estado de su deuda (cuota, saldo, próximo pago).
4. **Dar de baja un activo:** cambia su `estado`, no se elimina — sigue apareciendo en el histórico patrimonial.
5. **Terminar de pagar un pasivo:** al llegar `saldo_pendiente` a `0`, pasa a `pagado` automáticamente y deja de generar el gasto en Costos y Gastos.
6. **Consultar el valor patrimonial total del negocio:** suma de `valor_actual` de todos los activos no dados de baja, menos `saldo_pendiente` de todos los pasivos activos.

---

## 5. Casos borde

1. **Activo sin datos de capacidad** (ej. mobiliario, vehículo): los campos de capacidad quedan `null` — no rompe nada, simplemente Producción no tiene ese dato disponible para ese activo.
2. **Depreciación cuando el tiempo transcurrido supera la vida útil:** `valor_actual` se satura en `0`, nunca negativo.
3. **Refinanciación de un pasivo:** se resuelve creando un nuevo registro vinculado al anterior (regla 4), nunca editando el original.
4. **Transferencia de un activo entre sucursales** (solo en planes con multi-sucursal): simple actualización de `sucursal_id` con auditoría (`modificado_por`/`modificado_en`) — a diferencia del stock (Módulo 2), un activo es un bien físico único, no fungible, por lo que no necesita un ledger de movimientos, alcanza con el registro de quién y cuándo lo reubicó.
5. **Pasivo no vinculado a ningún activo** (ej. préstamo de capital de trabajo): funciona igual, simplemente `activo_id = null` — sigue generando su gasto periódico en Costos y Gastos con normalidad.

---

## 6. Confirmaciones de esta ronda

1. **Simplificación del Pasivo:** confirmado para el MVP — cuota fija sin desglose de interés/capital. El desglose real (amortización bancaria) queda para una fase posterior; el modelo actual (sección 1.2, 1.4) no bloquea agregarlo después, porque `Pago de Pasivo` ya es un ledger independiente al que se le podría sumar un desglose sin romper lo existente.
2. **Disponibilidad horaria:** confirmado el nivel simple (`disponibilidad_horaria_semanal` como un solo número) para el MVP, con un agregado importante que trajiste: se suman `requiere_descanso_entre_ciclos` y `tiempo_descanso_minutos` (sección 1.1) para capturar la diferencia real entre maquinaria que necesita enfriar y equipos de uso continuo (ej. un horno industrial que rinde peor si se apaga y se prende de nuevo). La vinculación de un activo a un **propósito o proceso específico** (ej. un vehículo usado para reparto, en un horario que depende del cliente o de la producción) se resuelve en el Módulo 6 (Producción/Operaciones), no acá — Patrimonio sigue aportando solo el dato crudo del activo, tal como ya establece la regla 5 de este documento.
3. **Estado `dado_de_baja`:** confirmado como estado de negocio visible, nunca una eliminación — coherente con la regla general de nunca borrar datos de forma permanente.

Con esto, el Módulo 5 queda cerrado.

---

*Módulo 5 — cerrado y confirmado. Continúa el Módulo 6 (Módulo Operativo — Nicho 1).*