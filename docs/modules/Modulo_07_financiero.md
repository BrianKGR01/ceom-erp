# Módulo 7 — Financiero

## 0. Propósito del módulo y alcance (qué NO cubre)

Financiero **no tiene tablas propias** — es una capa de consulta/agregación pura sobre eventos que ya generan otros módulos (Ventas, Costos y Gastos, Compras). Coherente con el principio de que cada módulo es dueño exclusivo de sus propios datos: Financiero no duplica ni reescribe nada, solo lee y combina.

Consolida los **tres flujos de dinero** ya fijados desde la arquitectura general:

| Evento | Origen | Cuándo impacta |
|---|---|---|
| **Compra** | Proveedores/Compras | Al pagarle al proveedor — impacta el **Flujo de Caja** de inmediato |
| **Costo operativo / COGS** | Ventas (`costo_unitario_snapshot`) | Al **vender**, no al producir ni comprar — impacta el **Estado de Resultados** |
| **Gasto** | Costos y Gastos | Al registrarse — impacta el **Estado de Resultados** del período |

**Lenguaje simple, no contabilidad formal** — reafirmando lo que los propios documentos funcionales dejan explícito: CEOM no busca ser un sistema contable, sino de gestión. Los nombres de las funciones y reportes evitan jerga contable innecesaria.

**Aclaración importante frente a una inconsistencia entre los documentos fuente:** los documentos funcionales (v2, casos de SanttiCampo y La Nona) ubican "Punto de Equilibrio" dentro de Simulaciones, no de Financiero, y de hecho listan los "8 módulos finales" sin nombrar a Financiero como módulo aparte (queda folded dentro de Reportes). La arquitectura v3, en cambio, sí lo trata como módulo propio con contrato de interfaz — y es la que ya venimos usando como referencia de arquitectura en todos los módulos anteriores. Mantengo **Financiero como módulo propio** (v3) por una razón concreta: el Gateway de Consentimiento (Módulo 1) autoriza acceso *por módulo*, y una institución externa puede tener permiso para ver lo financiero sin ver lo operativo — eso exige que Financiero exista como unidad separada y consultable de forma independiente. **Punto de Equilibrio se resuelve en el Módulo 9 (Simulaciones)**, no acá — Financiero solo expone los insumos (costo fijo total, margen real) que Simulaciones necesita para calcularlo.

**Gap detectado en el roadmap: falta documentar "Proveedores/Compras" como módulo propio.** Se lo menciona constantemente como origen del evento `compra_registrada`, pero no está en la lista de módulos que armamos al principio. Lo señalo en la sección 5 para que decidamos dónde ubicarlo.

---

## 1. Funciones que expone (sin tablas propias)

### 1.1 `flujo_caja(periodo, sucursal_id?)` — base caja

Refleja el movimiento **real** de dinero, usando la fecha en que el dinero efectivamente entra o sale, no la fecha en que se originó la operación:

```
flujo_caja = Σ Pago de Venta (por fecha_pago, Módulo 3)
           − Σ Pago de Compra (por fecha_pago, Módulo 8 — adenda de esta ronda)
           − Σ Pago de Gasto (por fecha_pago, Módulo 4 — adenda de la ronda anterior)
```

### 1.2 `estado_resultados(periodo, sucursal_id?)` — base devengado

Refleja el resultado del negocio en el momento en que ocurre la operación económica, sin importar cuándo se cobra o se paga:

```
estado_resultados = Σ (precio_venta_snapshot × cantidad) de Detalle de Venta   [ingresos, por fecha_venta]
                   − Σ (costo_unitario_snapshot × cantidad) de Detalle de Venta [COGS, por fecha_venta]
                   − Σ Gasto.monto                                              [gastos, por fecha_gasto]
                   ± Σ AjusteVenta.monto_ajuste del período                    [correcciones, por su propia fecha]
```

**Esta es la distinción entre "caja" y "resultado" que ya estaba implícita en toda la arquitectura**, ahora hecha explícita: una venta con `estado_pago = pendiente` ya cuenta como ingreso en el Estado de Resultados (se vendió, es un hecho económico), pero **no** cuenta en el Flujo de Caja hasta que efectivamente se cobre (exista un `Pago de Venta`).

### 1.3 `margen_por_producto(producto_id, periodo)`

```
margen % = [Σ (precio_venta_snapshot × cantidad) − Σ (costo_unitario_snapshot × cantidad)]
           ÷ Σ (precio_venta_snapshot × cantidad)
           × 100
```

Sobre `Detalle de Venta` del producto y período, ya ajustado por cualquier `AjusteVenta` asociado.

### 1.4 Insumos que expone hacia Simulaciones (Módulo 9)

- `costo_fijo_total(periodo)` — suma de `Gasto` con `tipo = fijo` del período (Módulo 4).
- `margen_por_producto()` (1.3) — reutilizado tal cual por Simular Precio.

---

## 2. Contrato de entrada/salida

**Entradas que este módulo consume (solo lectura, ningún dato propio):**
- De **Ventas** (Módulo 3): `Detalle de Venta` (con snapshots), `Pago de Venta`, `AjusteVenta`.
- De **Costos y Gastos** (Módulo 4): `Gasto` (con su `tipo` y `fecha_gasto`).
- De **Proveedores/Compras** (Módulo 8): `Pago de Compra` (por `fecha_pago`) — no el evento `compra_registrada`, que solo actualiza stock/costo en Inventario Operativo o Productos e Inventario, sin impactar caja hasta que se pague.

**Salidas que este módulo expone:**
- `flujo_caja(periodo, sucursal_id?)`, `estado_resultados(periodo, sucursal_id?)`, `margen_por_producto(producto_id, periodo)`, `costo_fijo_total(periodo)`.
- Hacia **Monitoreo Institucional** (cuando el Gateway de Consentimiento lo autorice, Módulo 1): las mismas funciones, filtradas por lo que el Owner haya aprobado para esa institución.
- Hacia **Simulaciones** (Módulo 9): `costo_fijo_total()` y `margen_por_producto()` como insumos para Punto de Equilibrio y Simular Precio.

---

## 3. Reglas de negocio clave

1. **Financiero no almacena nada propio.** Cualquier corrección de datos ocurre en el módulo de origen (Ventas, Costos y Gastos, Compras) — Financiero solo refleja lo que ya existe ahí.
2. **Los tres flujos de dinero nunca se mezclan.** Una compra de insumo no vendido todavía no aparece en el Estado de Resultados; una venta con costo pendiente de pago sí cuenta como resultado, aunque no como caja.
3. **Caja vs. Resultado, siempre explícito.** Todo reporte dejará claro si se está mostrando una vista de caja (cuándo entró/salió la plata) o de resultado (cuándo ocurrió el hecho económico) — evita que el usuario confunda "ya vendí" con "ya cobré".
4. **Consentimiento por módulo se respeta siempre.** Financiero nunca expone datos a una institución externa sin pasar por `tiene_permiso()` del motor de Autorización (Módulo 1).

### 3.1 Adenda al Módulo 3 (Ventas): devoluciones que sí devuelven dinero

Detectado al construir el Flujo de Caja: un `AjusteVenta` de tipo `devolucion` con `monto_ajuste` negativo representa, en muchos casos, dinero que efectivamente se le devuelve al cliente — pero el Flujo de Caja (sección 1.1) solo suma `Pago de Venta`, y ese ajuste no generaba ninguna fila ahí. **Se agrega la regla:** cuando un `AjusteVenta` de tipo `devolucion` implica devolución real de efectivo, debe generar automáticamente un `Pago de Venta` con `monto` negativo (mismo ledger, mismo mecanismo), para que el Flujo de Caja quede preciso sin lógica especial. Si la devolución es solo un ajuste contable sin entrega real de dinero (ej. nota de crédito para futura compra), no genera ese `Pago de Venta` — la distinción la marca quien registra el ajuste.

---

## 4. Casos de uso comunes

1. **Consultar el Estado de Resultados del mes.**
2. **Consultar el Flujo de Caja del mes**, para saber cuánta plata real hay disponible, distinto de cuánto se vendió.
3. **Consultar el margen real de un producto**, insumo directo para decisiones de precio en Simulaciones.
4. **Una institución con consentimiento aprobado consulta Financiero** vía el Gateway — ve exactamente lo mismo que el Owner, filtrado únicamente por el módulo autorizado.

---

## 5. Gap de roadmap: Proveedores/Compras necesita su propio módulo

Al construir Financiero quedó en evidencia que **nunca documentamos "Proveedores/Compras" como módulo propio**, aunque se lo menciona constantemente como origen de `compra_registrada` (consumido por Inventario Operativo, Productos e Inventario para reventa directa, y ahora Financiero). Su responsabilidad mínima, según lo ya referenciado en los módulos anteriores:

- Ficha de proveedor (nombre, contacto, historial de precios).
- `registrar_compra`: a quién se le compró, qué se compró, a qué precio, y si es insumo o reventa directa.
- Emite `compra_registrada(monto, item_id, tipo, fecha)` hacia el consumidor correspondiente.

**Confirmado: se documenta a continuación, como el Módulo 8**, antes de Simulaciones (que pasa a ser el Módulo 9).

---

## 6. Confirmaciones de esta ronda

1. **Proveedores/Compras:** confirmado — se documenta a continuación, como próximo módulo, antes de Simulaciones.
2. **Devoluciones con dinero real:** confirmada la regla de la sección 3.1.
3. **Gastos pendientes de pago:** en vez del par de fechas que proponías, se resolvió reutilizando el mismo ledger de pagos que ya existe en Ventas — un `Pago de Gasto` (adenda al Módulo 4, secciones 1.5 y 3.5–3.6), con `estado_pago` derivado. Mismo costo de construcción que dos fechas, pero soporta pagos parciales y queda simétrico con "cuentas por cobrar" (Ventas) / "cuentas por pagar" (Gastos), que es como lo resuelve el estándar real. La fórmula de `flujo_caja` (sección 1.1) ya quedó actualizada para usar este ledger.

Con esto, el Módulo 7 queda cerrado.

---

*Módulo 7 — cerrado y confirmado. Continúa el Módulo 8 (Proveedores/Compras).*