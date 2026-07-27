# El costo ausente y la cuota de pasivo — diagnóstico de H-15 y H-27

> **Qué es este documento.** El alcance real de los dos hallazgos que quedan de la familia "dato
> operativo que no llega al número financiero, siempre en la dirección optimista". No implementa
> nada: describe cómo se comporta el sistema hoy, mide el daño contra la base real, propone el camino
> de H-27, y pone sobre la mesa la decisión de producto que tiene H-15 adentro.
>
> Verificado contra el código de `dev` el 2026-07-27, con consultas de solo lectura contra la base de
> desarrollo.

---

## 0. Resumen para decidir

| | H-27 — cuota de pasivo | H-15 — producto sin costo |
|---|---|---|
| **Qué es** | Un gasto real que nunca se genera | Un costo desconocido que se guarda como cero |
| **Severidad medida** | **Bs 10.700 pagados sin dejar rastro** en el tenant de prueba (§2.2) | 0 casos hoy — *porque `seed:demo` siempre carga costos* (§3.7) |
| **Naturaleza** | Cableado faltante. La decisión ya está tomada en `Modulo_04` §2 y `Modulo_05` §2 | **Decisión de producto abierta.** Ningún doc dice qué debe pasar |
| **Reversible** | Sí — un gasto se puede cargar a mano después | **No.** El snapshot congela el cero para siempre (§3.3) |
| **Alcance** | 2 archivos + 1 categoría autoprovisionada + tests | Depende de la decisión: entre 1 pantalla y 1 migración + 6 pantallas |
| **Estado** | Camino claro, listo para implementar (§2.4) | **Necesito tu decisión antes de escribir código** (§4) |

Los dos son de la misma familia que H-24 y H-31, pero **no son el mismo tipo de problema**. H-27 es
exactamente el patrón de la comisión: una función que existe, funciona y nadie llama. H-15 no: ahí
no falta una llamada, falta una respuesta a la pregunta *"¿qué querés que pase cuando no sabemos el
costo?"*. Hoy el sistema contesta esa pregunta sin que nadie la haya hecho, y contesta **cero**.

---

# Parte I — H-27, la cuota de pasivo

## 1. Cómo se comporta hoy

### 1.1 La función existe y está bien escrita

[`generarGastoCuotaPasivo`](../../src/modules/gastos/actions.ts#L328) hace las dos mitades del
trabajo en una sola llamada:

1. Crea el `Gasto` con `tipo = "fijo"`, `origen = "cuota_pasivo_automatica"`,
   `referenciaId = pasivoId`, **ya pagado** (regla 6 del Módulo 4), vía `crearGastoConPagoTx`.
2. Llama a [`registrarPagoPasivo(..., origen: "automatico")`](../../src/modules/patrimonio/actions.ts#L432)
   para decrementar el saldo real del pasivo.

Tiene test de integración propio (`gastos.test.ts`), verifica el saldo antes/después, y los rechazos
de edición/eliminación de gasto automático están probados contra un gasto nacido de acá.

### 1.2 Y nadie la llama

El único camino real por el que se paga una cuota es el botón **"Registrar pago"** de la ficha del
pasivo:

```
ficha-pasivo-cliente.tsx:104   registrarPagoPasivoAction(pasivoId, {monto, fechaPago})
   └─ app/(shell)/patrimonio/actions.ts:174   registrarPagoPasivo(usuario, pasivoId, parsed.data)
        └─ modules/patrimonio/actions.ts:444   repo.registrarPagoPasivoTx(...) con origen "manual"
```

Ese camino **no toca Gastos en ningún punto**. El saldo del pasivo baja, el pago queda en el
historial, y el dinero que salió del negocio no aparece ni en el estado de resultados ni en el flujo
de caja. `generarGastoCuotaPasivo` queda como una tercera puerta que ninguna pantalla abre.

### 1.3 Por qué el resultado no lo ve

El estado de resultados es
`ingresos − COGS − gastos + ajustesVenta − ajustesCompra`
([`financiero/actions.ts:57-65`](../../src/modules/financiero/actions.ts#L57)). Una cuota de pasivo
no es ninguno de esos cinco términos **hasta que se convierte en un `Gasto`**. Igual el flujo de
caja: `pagosVenta − pagosCompra − pagosGasto`; un `pagos_pasivo` no es un `pagos_gasto`.

Es literalmente el mismo mecanismo de H-24. El gasto es el único vehículo por el que un egreso llega
al resultado, y la cuota nunca se sube a ese vehículo.

## 2. El alcance real

### 2.1 Lo que sí es trivial

- **El camino al resultado ya existe y está probado.** Una vez que el `Gasto` se crea, viaja solo:
  resta en el estado de resultados, sale en el flujo de caja, aparece en la distribución por
  categoría y en el listado de gastos con la marca "Automático". No hay que tocar Financiero,
  Reportes ni ninguna pantalla de gastos.
- **El disparador natural ya está construido.** A diferencia de `GastoRecurrente` —que necesitó un
  botón "Generar ahora" inventado para suplir la falta de scheduler
  ([`recurrentes-cliente.tsx:263`](../../src/app/app/\(shell\)/gastos/recurrentes/recurrentes-cliente.tsx#L263))—
  el pasivo **ya tiene el botón**: "Registrar pago". No hay que agregar UI. Hay que cambiar a quién
  llama.

### 2.2 El daño medido

Consulta de solo lectura contra la base de desarrollo, tenant `Mi Negocio de Prueba`:

| Métrica | Valor |
|---|---|
| Pagos de pasivo registrados | **5** |
| Monto total pagado | **Bs 10.700,00** |
| Pagos con `origen = automatico` | **0** |
| Gastos con `origen = cuota_pasivo_automatica` | **0** |
| Pasivos activos | 2 (Bs 9.000 de deuda, Bs 1.700 de cuota periódica) |

Para dimensionar: **el mismo tenant tiene Bs 701,50 de ingresos totales en toda su historia de
ventas.** Salieron quince veces más plata por cuotas de deuda de la que entró por ventas, y el
estado de resultados no registra ni un centavo de esa salida. No es un error de redondeo en un
margen: es el egreso más grande del negocio, invisible.

### 2.3 Lo que NO es trivial — cinco cosas que hay que resolver a propósito

**a) `categoriaId` es obligatorio, y el llamador no tiene de dónde sacarlo.**
`generarGastoCuotaPasivo` exige `categoriaId` en su input ([`gastos/actions.ts:333`](../../src/modules/gastos/actions.ts#L333)).
El diálogo de "Registrar pago" solo pide monto y fecha. Es exactamente el problema que H-24 tuvo que
resolver para la comisión, y la solución ya está escrita y documentada:
[`obtenerOCrearCategoriaComisionVenta`](../../src/modules/gastos/actions.ts#L387) autoprovisiona
`"Comisiones de venta"` por tenant. Hace falta la gemela — `CATEGORIA_CUOTA_PASIVO` = *"Cuotas de
deuda"* — con el mismo get-or-create y el mismo comentario sobre por qué no va en
`CATEGORIAS_GASTO_DEFAULT` (H-32: sin categoría no se puede cargar un gasto).

**b) El permiso está gateado por el módulo equivocado — y es la trampa exacta de H-24.**
`generarGastoCuotaPasivo` pide `costos_gastos:crear` ([`:341`](../../src/modules/gastos/actions.ts#L341)).
Pero quien registra el pago de una cuota está ejerciendo `patrimonio:crear`. Un colaborador con
permiso de Patrimonio y sin permiso de Gastos registraría el pago, vería el saldo bajar, y
**perdería el gasto en silencio** — el mismo defecto silencioso y optimista que la corrección
existe para cerrar. La comisión ya tiene la lección aprendida y documentada: gatea por
`ventas:crear`, no por `costos_gastos:crear`. Acá corresponde `patrimonio:crear`.

**c) La dirección de la flecha entre módulos.** Hoy Gastos importa Patrimonio
([`gastos/actions.ts:4`](../../src/modules/gastos/actions.ts#L4)). Si Patrimonio pasara a llamar a
Gastos sin más, quedaría un ciclo entre dos cajas negras — exactamente lo que H-24 tuvo que deshacer
del lado de Ventas. Dos salidas, y no son equivalentes (§2.4).

**d) `pasivos` no tiene `sucursal_id`** ([`patrimonio/schema.ts:126-158`](../../src/modules/patrimonio/schema.ts#L126)),
así que el gasto nace con `sucursalId = null`. Y `sumarTotalGastosPeriodo` filtra con
`eq(gastos.sucursalId, opts.sucursalId)` ([`gastos/repository.ts:351`](../../src/modules/gastos/repository.ts#L351)),
que **excluye las filas con null**. Consecuencia: la cuota va a aparecer en el estado de resultados
del negocio y **no** en el de una sucursal específica. Es coherente (una deuda es del negocio, no de
un local) y es el mismo comportamiento que ya tiene cualquier gasto cargado sin sucursal — pero hay
que **afirmarlo en un test** para que sea una decisión y no una sorpresa. Emparenta con H-16.

**e) Atomicidad.** `generarGastoCuotaPasivo` corre dos transacciones separadas: primero
`crearGastoConPagoTx`, después `registrarPagoPasivo` (que abre la suya vía `comoUsuario`). Si la
segunda falla queda un gasto sin su pago de pasivo: el resultado resta la cuota pero el saldo de la
deuda no baja. El proyecto ya aceptó explícitamente este gap cruzado en `registrarVenta` (comisión y
descuento de stock fuera de la transacción de la venta, con el fallo devuelto como aviso en vez de
anular la venta — [`ventas/actions.ts:563-579`](../../src/modules/ventas/actions.ts#L563)). Acá el
orden correcto es el inverso al actual: **primero el pago de pasivo** (que es lo que el usuario pidió
y lo que la pantalla confirma), **después el gasto**, y si el gasto falla se devuelve como aviso sin
perder el pago. Hoy el orden es al revés.

### 2.4 El camino recomendado

Dos formas de conectar el disparo. Recomiendo la segunda.

| | **A — componer en la Server Action de ruta** | **B — invertir la flecha (patrón H-24)** |
|---|---|---|
| Qué cambia | `registrarPagoPasivoAction` resuelve el pasivo, saca su `tenantId` real y llama a `generarGastoCuotaPasivo` en vez de a `registrarPagoPasivo` | `registrarPagoPasivo` (Patrimonio) llama a Gastos al final. `generarGastoCuotaPasivo` deja de llamar a Patrimonio y pasa a ser solo "creá el gasto de esta cuota" |
| Flecha entre módulos | Sin cambios (Gastos → Patrimonio) | Se invierte: **Patrimonio → Gastos**, en un solo sentido |
| Cobertura | Solo el camino de la UI. Un scheduler futuro, un script o un test que llame `registrarPagoPasivo` directo **no genera el gasto** | **Cualquier** pago de pasivo genera su gasto, venga de donde venga |
| Contrato | Sin cambios en los módulos | Cambia el contrato de `generarGastoCuotaPasivo` y de `registrarPagoPasivo` — ANCLA de los dos módulos |
| Manifiesto de acceso | La entrada de `registrarPagoPasivoAction` está declarada `por-recurso`; delegar en una función que recibe `tenantId` del llamador la volvería `por-tenant`. Hay que resolver el pasivo primero igual | Sin cambios: `registrarPagoPasivo` sigue resolviendo el pasivo para conocer su tenant real |

**Recomiendo B**, por tres razones:

1. **Es lo que dicen los docs.** `Modulo_05` §2 lo describe desde el origen: *"Hacia Costos & Gastos:
   mientras un Pasivo esté activo… se genera automáticamente un `Gasto`… y simultáneamente se
   registra un `Pago de Pasivo`"*. El módulo dueño del evento es Patrimonio.
2. **Es el precedente ya validado.** H-24 hizo exactamente este movimiento y dejó escrito por qué:
   el módulo que registra la transacción dispara su consecuencia; la lectura inversa creaba el ciclo.
3. **Sobrevive al scheduler.** Cuando exista el disparo periódico que `Modulo_04` §4 pide, con B ya
   funciona sin tocar nada. Con A hay que acordarse de cablearlo de nuevo, que es literalmente cómo
   nacieron H-24 y H-27.

El costo de B es un cambio de contrato en dos módulos, con sus dos `ANCLA.md`. Es real, y es el
precio de que la corrección no dependa de que alguien pase por una pantalla.

### 2.5 Lo que este arreglo NO resuelve, y hay que decir

- **No hay scheduler.** El gasto se va a generar cuando el usuario registre el pago, no
  "cada período" como pide `Modulo_04` §4. Un pasivo que el dueño paga por el banco y no registra en
  CEOM sigue sin aparecer. Eso es H-10 (gastos recurrentes que no se generan solos), no H-27, y el
  producto ya convive con esa limitación en todo el módulo de gastos.
- **No hay desglose interés/capital.** `Modulo_05` §6.1 lo confirma como simplificación deliberada
  del MVP: cuota fija, sin separar. Contablemente, cargar la cuota entera como gasto no es
  amortización pura — pero **es la lectura correcta para este producto**, porque la depreciación del
  activo no entra en el estado de resultados de CEOM, así que no hay doble conteo con nada. Lo
  verifiqué: `calcularValorActual` solo alimenta el valor patrimonial. Y un pasivo puede no tener
  activo asociado (préstamo de capital de trabajo), donde la cuota es un egreso puro sin contraparte.
- **No repara los 5 pagos ya registrados.** Los Bs 10.700 del §2.2 seguirían fuera del resultado.
  Regenerar sus gastos retroactivamente es una decisión aparte que no propongo tomar de costado
  —cambiaría el resultado de meses ya cerrados—; si la querés, es un script acotado y medible, mismo
  criterio que la migración `0043` de H-49.

## 3. Plan de pruebas de H-27

Valores exactos, calculados a mano, sobre un período sembrado a propósito. El criterio es el mismo
que H-49: **afirmar el número, y romperlo a propósito para confirmar que el test lo caza.**

### 3.1 El caso central — el número del resultado cambia

Sembrar en un período limpio:

- 1 venta: 10 unidades × Bs 100 = **ingresos 1.000**, con `costoUnitarioSnapshot` 40 → **COGS 400**
- 1 pasivo: `montoTotal` 9.000, `cuotaPeriodica` **1.500**
- registrar el pago de la cuota, fecha dentro del período

| Se afirma | Antes del arreglo | Después |
|---|---|---|
| `gastos` con `origen='cuota_pasivo_automatica'` | 0 filas | **1 fila**, `tipo='fijo'`, `monto=1500`, `referenciaId=pasivoId`, `estadoPago='pagado'` |
| `pagos_gasto` de ese gasto | — | **1 fila de 1.500**, misma fecha |
| `pagos_pasivo` | 1 fila, `origen='manual'` | **1 fila, `origen='automatico'`**, saldo 9.000 → **7.500** |
| `estadoResultados` | `1000 − 400 − 0 = ` **600** | `1000 − 400 − 1500 = ` **−900** |
| `flujoCaja` (con el pago de venta completo) | `1000 − 0 − 0 = ` **1.000** | `1000 − 0 − 1500 = ` **−500** |

**Cómo se rompe a propósito:** quitar la llamada a Gastos. El test debe fallar con
`expected 600 to be -900`, no con un error de tipos. Si falla por otra cosa, el test está midiendo
otra cosa.

### 3.2 Los cinco casos borde, uno por punto del §2.3

| # | Caso | Se afirma |
|---|---|---|
| 1 | Segundo pago del mismo tenant | La categoría *"Cuotas de deuda"* se **reutiliza**: `categorias_gasto` sigue con 1 fila de ese nombre, los 2 gastos la comparten |
| 2 | Usuario con `patrimonio:crear` y **sin** `costos_gastos:crear` | El pago se registra **y el gasto también**. Es el test que hace imposible reintroducir el defecto silencioso de H-24 |
| 3 | Usuario **sin** `patrimonio:crear` | Ni pago ni gasto. Nada a medias |
| 4 | `estadoResultados` filtrado por sucursal | La cuota **no** aparece (gasto sin sucursal). Valor exacto: `1000 − 400 − 0 = 600`. Es la decisión del §2.3.d, afirmada |
| 5 | Editar o eliminar el gasto generado | Rechazado por `actualizarGastoManual`/`eliminarGastoManual` (regla 2 del Módulo 4). Ya hay test; ahora sobre un gasto nacido del camino real |

### 3.3 Regresión

Un test que falle si `generarGastoCuotaPasivo` vuelve a quedarse sin llamador fuera de los tests —
el mismo espíritu del anti-regresión de `lte` que dejó H-49
([`bordes-de-periodo.test.ts`](../../src/lib/bordes-de-periodo.test.ts)). Es barato: barrer por AST
las funciones `generarGasto*` del módulo y exigir que cada una tenga al menos un llamador en código
de producción. Convierte "se construyó la función y se olvidó el cable" —que es la causa raíz común
de H-24, H-27 y H-10— en build roto.

---

# Parte II — H-15, el producto sin costo

## 4. Cómo se comporta hoy, exactamente

Recorrido completo, en el orden en que el usuario lo vive.

| # | Momento | Qué hace el sistema hoy |
|---|---|---|
| 1 | **Alta del producto** | Campo *"Costo por unidad **(opcional)**"* + texto: *"si no lo sabés todavía, lo podés dejar en blanco"* ([`product-form.tsx:214,248`](../../src/components/shared/product-form.tsx#L214)). Correcto y deliberado — `Modulo_02` §1 lo declara `nullable` a propósito |
| 2 | **Checklist de inicio** | *"Cargá tu primer producto"* se apaga con el primer producto, **tenga costo o no** ([`inicio-contenido.tsx:12-13`](../../src/app/app/\(shell\)/inicio-contenido.tsx#L12)) |
| 3 | **Catálogo** | La card simplemente **no muestra el badge de margen** ([`product-card.tsx:29`](../../src/modules/productos/components/product-card.tsx#L29)). Silencio, no aviso |
| 4 | **Ficha del producto** | Muestra `—` y una línea gris: *"Todavía no cargaste un costo."* ([`ficha-cliente.tsx:454,460`](../../src/app/app/\(shell\)/productos/\[id\]/ficha-cliente.tsx#L454)). **Es la única señal que existe en todo el producto** |
| 5 | **Punto de venta** | Nada. Ni un aviso, ni un asterisco |
| 6 | **Al confirmar la venta** | `costoUnitarioSnapshot: String(costo.data.costoOperativoVigente ?? 0)` ([`ventas/actions.ts:492`](../../src/modules/ventas/actions.ts#L492)) — **el desconocido se convierte en un cero duro** |
| 7 | **Estado de resultados** | `costos = Σ(cantidad × costoUnitarioSnapshot)` ([`ventas/repository.ts:341`](../../src/modules/ventas/repository.ts#L341)). Esa venta aporta ingreso y **cero costo** |
| 8 | **Ranking de productos por margen** | `margenPct = calcularMargenPorcentaje(ingresos, 0)` = **100%** ([`reportes/actions.ts:61`](../../src/modules/reportes/actions.ts#L61)) |
| 9 | **Margen canal × producto** | Ídem: 100% en cada cruce |
| 10 | **Simulaciones** | **Se comporta bien**: rechaza con mensaje explícito (*"Este producto no tiene un costo operativo vigente todavía"*, [`simulaciones/actions.ts:98,197`](../../src/modules/simulaciones/actions.ts#L98)) y excluye del promedio del comparador ([`:315`](../../src/modules/simulaciones/actions.ts#L315)) |

### 4.1 El hallazgo central: dos módulos contestan distinto la misma pregunta

Simulaciones trata `null` como **desconocido** y lo dice en pantalla. Ventas, Financiero y Reportes
lo convierten en **cero** y lo presentan como un hecho. Es la misma incógnita, con dos respuestas
opuestas, en el mismo producto. Y la respuesta que se ve más —la del resultado del mes— es la
equivocada.

El síntoma más feo no es el resultado inflado: es el **ranking**. El producto del que el negocio
sabe menos aparece **primero, con 100% de margen**. El reporte que existe para decirte qué te
conviene vender te recomienda activamente el producto que no medís.

### 4.2 El agravante estructural: es irreversible

`detalles_venta.costo_unitario_snapshot` es `notNull` ([`ventas/schema.ts:200-203`](../../src/modules/ventas/schema.ts#L200))
y la regla 4 de `CLAUDE.md` prohíbe recalcular ventas pasadas. Las dos cosas están bien y no hay que
cambiarlas. Pero juntas significan:

> Cargar el costo mañana **no repara** las ventas de hoy. Cada venta hecha sin costo queda mal
> contada para siempre, y no hay ninguna operación en el sistema que la arregle.

**Esto invierte por completo el orden de prioridades de H-15.** El hallazgo original propone *"un
aviso en la ficha y una marca en el catálogo"* — o sea, corrección. Pero corregir después no
recupera nada. **Lo que se gana o se pierde ocurre en el instante de la venta**, y una sola vez.

### 4.3 Y además, el cero es ambiguo

`costoOperativoVigente: z.number().min(0).optional()` ([`productos/validation.ts:15`](../../src/modules/productos/validation.ts#L15))
acepta **0** como valor válido. Así que en `detalles_venta`, un `costo_unitario_snapshot = 0`
significa una de dos cosas —*"este producto no cuesta nada"* o *"no sabíamos cuánto costaba"*— y
**después de guardado son indistinguibles**. Cualquier solución que quiera marcar el reporte
necesita que esa distinción se registre **al escribir**, no que se infiera al leer.

### 4.4 Qué NO está afectado

Stock, compras, gastos y patrimonio no dependen del costo del producto. El costo de una compra de
reventa (`origen_costo = proveedor_reventa`) y el de producción (`nicho_sugerido`) se escriben solos
por sus propios caminos ([`productos/repository.ts:309,344`](../../src/modules/productos/repository.ts#L309)).
H-15 vive enteramente en el eje producto → venta → margen.

### 4.5 Cuánto pasa hoy — y por qué el número engaña

| Métrica (tenant de prueba) | Valor |
|---|---|
| Productos activos | 14 |
| Productos sin costo | **0** |
| Líneas de venta con `costo_unitario_snapshot = 0` | **0** de 74 |
| Ingreso total / COGS registrado | Bs 701,50 / Bs 544,18 |

**Cero casos. Y eso es en sí mismo un hallazgo.** `seed:demo` crea todos los productos con costo, así
que nuestros datos de prueba **no reproducen jamás el escenario que H-15 describe** — un negocio real
que carga un producto rápido y se olvida el costo. Toda la QA visual que hicimos sobre reportes y
ranking se hizo sobre un catálogo perfecto. **No hay ninguna pantalla del producto que hayamos visto
alguna vez en el estado que H-15 describe.**

Si adoptamos alguna de las opciones de abajo, el seed tiene que ganar al menos un producto sin costo,
o la corrección no se va a poder verificar a ojo nunca.

## 5. Cómo lo resuelve el resto de la industria

Miré cómo tratan "producto sin costo" los sistemas de gestión para pequeños comercios. Hay un patrón
claro y es consistente entre ellos:

1. **Nadie bloquea la venta.** Ni Square, ni Shopify, ni QuickBooks, ni Odoo impiden vender un ítem
   sin costo cargado. La venta es el evento que no se puede perder — el comercio está atendiendo a
   alguien.
2. **Todos separan "margen desconocido" de "margen 100%".** Los reportes de rentabilidad muestran el
   ítem sin costo como `—` / *"Cost not set"*, no como el más rentable del catálogo. Square lo excluye
   explícitamente de sus reportes de margen; QuickBooks reporta las líneas sin costo por separado en
   lugar de sumarlas como ganancia.
3. **Todos avisan en el punto de captura.** La señal está en el alta del ítem y en el reporte, no
   escondida en una ficha de detalle.
4. **El COGS se reporta como incompleto, no como cero.** El patrón contable estándar es marcar el
   período —*"N ítems sin costo"*— antes que presentar un número limpio que no lo es.

En una frase: **la industria no bloquea, no inventa un costo, y no llama ganancia a lo que no midió.**
CEOM hoy hace las dos primeras bien y la tercera mal.

Vale notar que CEOM **ya tiene el patrón de "bloquear salvo permiso explícito"** para una condición
parecida: `Modulo_02` regla 4, *no se puede vender sin stock salvo el permiso `vender_sin_stock`*.
Existe la maquinaria si alguna vez quisiéramos ese nivel de dureza — pero por lo de arriba, no lo
recomiendo.

## 6. Las opciones — acá es donde necesito tu decisión

Cuatro caminos. No son excluyentes; los ordeno de más preventivo a más correctivo, con lo que cuesta
cada uno.

### Opción A — Volver el costo obligatorio al crear el producto

**Qué es.** Sacar el `.optional()` de la validación.

**Por qué NO la recomiendo, aunque sea la más barata.** Contradice el modelo, no un detalle de UI:
`Modulo_02` §1 declara el campo `nullable` *a propósito* porque para un producto de producción el
costo lo calcula el Nicho, y para uno de reventa lo escribe la compra. Exigir un número a mano en el
alta de esos dos casos obliga al usuario a inventar un dato que el sistema va a pisar solo
—y encima choca con H-25 (el costo se reemplaza por el de la última compra)—. Sí sería defendible una
variante acotada: **obligatorio solo cuando `tipo_origen_producto = "manual"`**, que es exactamente
el caso donde nadie más lo va a cargar. La dejo anotada como sub-opción, no como recomendación
principal.

### Opción B — Avisar en el momento de la venta ⭐

**Qué es.** El punto de venta detecta que una línea es de un producto sin costo y lo dice, sin
bloquear: un banner *"Este producto no tiene costo cargado — esta venta se va a contar como ganancia
pura"*, con un atajo para cargarlo ahí mismo, igual que **+ Nuevo canal** resuelve H-01 sin salir de
la pantalla.

**Por qué es el lever más fuerte.** Es el único momento en que la información todavía se puede
capturar antes de que el cero se congele (§4.2). Todo lo demás llega tarde por definición.

**Costo:** el POS ya tiene el `productoId` de cada línea; hace falta traer `costoOperativoVigente` en
el listado que ya carga, el aviso, y el atajo de carga. Una pantalla, sin migración.

**Emparenta con H-37** (el POS no muestra el stock ni avisa al sobrevender): es el mismo hueco —el
punto de venta no le dice nada al usuario sobre los datos que está por congelar—, así que conviene
mirar los dos juntos aunque se arreglen por separado.

### Opción C — Dejar de mentir en el número: "margen desconocido" en vez de "cero"

**Qué es.** Registrar en la línea de venta que el costo era desconocido, y que los reportes muestren
`—` en vez de 100%.

**Cómo, en concreto.** Migración **aditiva**: `detalles_venta.costo_desconocido boolean not null
default false`. No toca ninguna fila existente, no cambia ningún `sum(cantidad × snapshot)` —todas
las consultas actuales siguen dando lo mismo—, y resuelve la ambigüedad del §4.3 hacia adelante. La
alternativa (volver `costo_unitario_snapshot` nullable) es más "pura" pero rompe el `notNull` y
obliga a revisar todos los agregados.

**Costo real:** 1 migración + `registrarVenta` + los tres agregados que devuelven `costos`
(`sumarIngresosCostosPeriodo`, `listarRankingProductos`, `listarMargenPorCanalYProducto`) + las
pantallas de estado de resultados, ranking y margen canal×producto. Es la opción más honesta y la
más invasiva.

**Advertencia importante:** esto **no cambia el resultado del período** —los ingresos siguen sin
costo que restar, porque no hay costo que restar—. Cambia qué margen se muestra y cómo. Si lo que
querés es que el resultado deje de estar inflado, ninguna opción puede lograrlo: **el dato no existe**.
Lo único honesto es decirlo, no estimarlo.

### Opción D — Marcar el reporte ⭐

**Qué es.** Que el estado de resultados y el ranking digan, cuando corresponda:
*"Bs 340 de estas ventas son de productos sin costo cargado — tu margen real es menor. Ver cuáles."*

**Costo:** una consulta agregada nueva (líneas del período con costo desconocido, agrupadas por
producto) y un aviso en dos pantallas. Sin migración *si* se apoya en C-lite para saber cuáles son;
sin C, hay que aceptar la ambigüedad del §4.3 y contar `snapshot = 0` (en la práctica un producto
genuinamente gratis es rarísimo en este dominio, pero es una imprecisión que prefiero no dejar
enterrada).

Es el complemento natural de B: B evita los casos nuevos, D hace visibles los que ya pasaron.

### Cuadro comparativo

| | Evita el daño futuro | Deja de mentir | Migración | Superficie | Cambia el número del resultado |
|---|---|---|---|---|---|
| **A** obligatorio | Parcial | No | No | 1 archivo | No |
| **B** aviso en la venta | **Sí** | No | No | 1 pantalla | No |
| **C** margen desconocido | No | **Sí** | Sí (aditiva) | 4 consultas + 3 pantallas | No (cambia el margen mostrado) |
| **D** marca en el reporte | No | Sí, parcial | No (o C-lite) | 1 consulta + 2 pantallas | No |

## 7. Mi recomendación

**B + D, con la parte mínima de C que las hace exactas. A y C completa, no.**

En orden, y cada paso es un commit que deja el sistema consistente:

1. **La migración aditiva de C-lite primero** — `detalles_venta.costo_desconocido`, escrita por
   `registrarVenta` cuando `costoOperativoVigente` es `null`. Cero cambio de comportamiento el día que
   entra: nadie la lee todavía. Pero a partir de ese momento **el dato se empieza a registrar bien**,
   y todo lo que venga después puede ser exacto en vez de inferido. Es la misma lógica que la
   "costura fijada" de H-49: lo caro no es el campo, es retrofitearlo.
2. **B — el aviso en el punto de venta.** Es donde se gana o se pierde de verdad. Sin bloquear:
   avisar y ofrecer cargar el costo en el momento.
3. **D — la marca en el estado de resultados y en el ranking**, apoyada en el campo del paso 1. Y en
   el ranking, que un producto sin costo **no aparezca con 100% de margen**: `—`, y fuera del orden
   por margen (que es exactamente lo que Simulaciones ya hace bien en su comparador — el patrón está
   escrito en el propio repo, solo no se aplicó acá).
4. **Prevención en el onboarding**, chico y barato: que el checklist de inicio no se dé por
   cumplido con un producto sin costo, o que gane un segundo paso *"Cargá el costo de tus
   productos"*. Es el momento en que el usuario está más dispuesto a completar datos, y es la
   conexión con H-01 que el pedido intuía: **el mismo hueco de "el sistema no te acompaña en el
   primer recorrido", una pantalla más adelante.**
5. **`seed:demo` con al menos un producto sin costo** (§4.5), o no vamos a poder ver nunca el
   comportamiento que estamos arreglando.

**Lo que explícitamente NO recomiendo:** estimar un costo (un margen promedio del catálogo, el precio
por un factor). Inventar un número plausible para tapar un hueco es exactamente el modo de falla que
esta familia de hallazgos viene cerrando. **Un hueco marcado es infinitamente mejor que un número
inventado.**

**Lo que queda como tu decisión:** si querés las cuatro piezas o solo B+D; si el aviso del punto de
venta **bloquea** la venta o solo avisa (recomiendo avisar — ver §5.1); y si vale la migración
aditiva del paso 1 o preferís que D cuente `snapshot = 0` y acepte la ambigüedad.

## 8. Plan de pruebas de H-15

Independiente de la opción elegida, hay dos tests que hay que escribir igual porque **fijan el
comportamiento actual antes de tocarlo** — hoy no existe ninguno que mire este caso:

### 8.1 El test que documenta el daño (escribir primero, con la opción que sea)

Sembrar: producto **sin costo**, precio 100. Vender 3 unidades. Ninguna otra venta ni gasto en el
período.

| Se afirma hoy | Valor |
|---|---|
| `detalles_venta.costo_unitario_snapshot` | **0** — el `?? 0` del §4, hecho explícito |
| `estadoResultados.ingresos` | **300** |
| `estadoResultados.costos` | **0** |
| `estadoResultados.estadoResultados` | **300** — el 100% de ganancia fantasma |
| `rankingProductos(criterio: "margen")[0].margenPct` | **100** |

### 8.2 El test de irreversibilidad

Continuación del anterior: cargar el costo (Bs 60) **después** de la venta y volver a pedir el
estado de resultados.

| Se afirma | Valor |
|---|---|
| `estadoResultados.costos` | **sigue en 0** — el snapshot no se recalcula (regla 4) |
| El margen del producto **en la ficha** | 40% |

Este es el test más valioso de los dos: convierte la asimetría del §4.2 —que hoy es una consecuencia
accidental de dos reglas correctas— en **comportamiento afirmado y documentado**. Si algún día
alguien "arregla" H-15 recalculando ventas pasadas, este test lo frena.

### 8.3 Según la opción elegida

| Opción | Test | Valor exacto |
|---|---|---|
| **B** | Vender un producto sin costo devuelve el aviso; con costo, no | El aviso trae el nombre del producto. La venta **se registra igual** en los dos casos |
| **C-lite** | La línea queda con `costo_desconocido = true`; una línea de un producto con costo **0 real** queda en `false` | Es el único test que prueba que la ambigüedad del §4.3 quedó resuelta |
| **D** | Con la venta del §8.1 más otra de Bs 200 de un producto con costo 80: | `ingresosSinCostoConocido = 300`, `costos = 160`, y el aviso aparece. Con las dos ventas con costo, el aviso **no** aparece |
| **D** (ranking) | El producto sin costo | `margenPct = null`, y **no encabeza** el orden por margen |

### 8.4 Cómo se rompe a propósito

- Revertir el aviso de B → el test de §8.3 falla por aviso ausente, no por excepción.
- Escribir `costo_desconocido = true` **siempre** (no solo cuando el costo es null) → el caso del
  producto con costo 0 real lo caza.
- Hacer que D cuente los productos sin costo pero sume mal → `expected 300 to be 500`.

---

## 9. Qué pediría en qué orden

| Orden | Qué | Por qué primero |
|---|---|---|
| 1 | **H-27 completo** (§2.4 opción B + tests §3) | La decisión ya está tomada en los docs. Es cableado, y hay Bs 10.700 medidos del lado equivocado |
| 2 | **Los dos tests de H-15 que fijan el comportamiento actual** (§8.1, §8.2) | Baratos, no cambian nada, y hacen que cualquier opción posterior se pueda medir contra un antes |
| 3 | **La decisión de H-15** (§6) | Tuya |
| 4 | Lo que salga de 3 | — |

Los pasos 1 y 2 no dependen de tu decisión y se pueden empezar apenas digas que sí. El 4 no arranca
hasta que elijas.

---

*No se escribió ni una línea de código de producción para este diagnóstico. Las únicas consultas
ejecutadas contra la base fueron de solo lectura (`select`), y el script quedó en el scratchpad, no
en el repo.*
