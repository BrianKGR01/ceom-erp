# 7. Producción

> **Este capítulo es solo para el rubro "Alimentos y bebidas por lotes".** Si elegiste comercio
> minorista o Modo Básico, no lo necesitás — aunque el menú te muestre la sección igual (ver H-08).

Producción es lo que convierte materia prima en producto terminado, y —lo más importante— lo que
calcula **cuánto te cuesta de verdad cada unidad que producís**, incluida la parte que se pierde en
el camino.

Es la cadena más larga del sistema y la que más orden exige. Vale la pena leerla entera antes de
cargar nada.

---

## La cadena, de una

```
  1. Insumos          →  qué comprás como materia prima
         ↓
  2. Recetas          →  qué insumos y cuánto lleva un lote
         ↓
  3. Vincular         →  qué producto de tu catálogo sale de esa receta
         ↓
  4. Producción       →  registrás un lote: se descuentan insumos, entra producto
```

Ningún paso funciona sin el anterior. El error más común es intentar registrar una producción antes
de haber vinculado un producto a una receta: la pantalla te va a mostrar un estado vacío explicando
que falta ese paso.

---

## 1. Insumos

**Producción › Insumos** (`/app/produccion/insumos`).

Un **insumo** es materia prima: harina, leche, azúcar, envases, etiquetas. No se vende: se consume
para fabricar.

**Un insumo no es un producto.** Son dos catálogos separados a propósito. El producto tiene precio de
venta; el insumo no. Si algo lo vendés tal cual, es producto; si lo transformás, es insumo.

### Cargar un insumo

| Campo | Qué tener en cuenta |
|---|---|
| **Nombre** | |
| **Unidad de medida** | Litros, ml, kg, g, unidad o metros. **Elegila con cuidado**: es la unidad en la que vas a cargar el stock, las compras y las cantidades de cada receta. Cambiarla después desordena todo lo cargado. |
| **Vida útil en días** | Opcional. Sirve para calcular solo la fecha de vencimiento al cargar una compra. |
| **Stock mínimo** | Opcional. |

**El costo no se carga a mano.** No hay campo para eso: el costo de un insumo sale siempre de lo que
pagaste al comprarlo.

### El costo de un insumo se promedia

Cada vez que cargás una entrada de compra, el sistema recalcula el costo del insumo como **promedio
ponderado** entre lo que ya tenías y lo que entró.

Si tenías 10 kg a Bs 8 y comprás 10 kg a Bs 12, el costo pasa a Bs 10 — no a Bs 12.

> ⚠️ **Esto es distinto de lo que pasa con los productos**, donde el costo se reemplaza por el de la
> última compra. Acá se promedia; allá no. Es una inconsistencia real del sistema, no un error de
> este manual. (ver H-25)

### Mover el stock de un insumo

Desde la ficha del insumo (`/app/produccion/insumos/[id]`):

| Acción | Cuándo |
|---|---|
| **Registrar compra** | Entrada de materia prima. Pide cantidad, costo total y, opcionalmente, fecha de vencimiento — que se calcula sola desde la vida útil si la dejás vacía. Recalcula el costo promedio. |
| **Ajustar** | Corrección de stock, entrada o salida, con motivo obligatorio. |
| **Merma** | Lo que se echó a perder en depósito: vencido, roto, contaminado. Sale del stock y queda registrado como pérdida. |

**Merma y ajuste no son lo mismo, y conviene no mezclarlos.** El ajuste corrige un error de conteo;
la merma registra una pérdida real. La merma se acumula en el indicador de control de merma del
panel ([capítulo 8](08-entender-el-negocio.md)); el ajuste no. Si cargás pérdidas como ajustes, ese
indicador te va a dar siempre cero.

**También entra stock automáticamente** cuando recibís una compra de tipo insumo desde Proveedores
([capítulo 5](05-compras-y-proveedores.md)). Las dos vías conviven: la de Proveedores deja registro
del proveedor y del pago; la de acá es más rápida y directa.

---

## 2. Recetas

**Producción › Recetas** (`/app/produccion/recetas`).

Una **receta** define qué insumos y en qué cantidades entran en **un lote**.

| Campo | Qué es |
|---|---|
| **Nombre** | "Masa madre", "Base de gelato" |
| **Rendimiento por lote** | Cuánto sale de un lote |
| **Unidad de rendimiento** | En qué se mide ese rendimiento |

Debajo, la **composición**: una línea por insumo, con la cantidad que lleva **un lote**. Se edita
directamente en la pantalla, agregando y quitando líneas.

**Pensá la receta en términos de un lote, no de una unidad.** Si tu masa rinde 40 panes y lleva 10 kg
de harina, el rendimiento por lote es 40 y la harina va con 10 — no 0,25.

> ⚠️ Guardar la composición **reemplaza la lista completa**, no la modifica línea por línea. Si abrís
> una receta y borrás una línea sin querer, guardar la deja borrada. (ver H-39)

---

## 3. Vincular un producto a una receta

Este es el paso que se saltea todo el mundo, porque no está en la sección Producción: se hace desde
**la ficha del producto** ([capítulo 2](02-catalogo.md)), con el botón **Vincular a una receta**.

Ahí elegís dos cosas:

- **Qué receta** produce este producto.
- **Cuánta base consume cada unidad** del producto.

**Qué significa "cuánta base consume cada unidad".** Una misma receta puede dar varias
presentaciones. Si tu base de gelato rinde 10 litros por lote, el potecito de 1/2 litro consume 0,5 y
el de 1 litro consume 1. Con ese número el sistema sabe cuántas unidades deberían salir de un lote.

Al vincular, el producto pasa a ser de origen "producción" y **su costo deja de ser editable a
mano**: lo calcula cada producción que registres.

Desde la misma ventana podés **desvincular**, si el producto deja de producirse con esa receta.

---

## 4. Registrar una producción

**Producción › Nueva producción** (`/app/produccion/nuevo`).

Solo aparecen los productos ya vinculados a una receta. Si no hay ninguno, la pantalla te lo explica
y te manda a vincular uno.

| Campo | Qué es |
|---|---|
| **Producto** | Qué produjiste |
| **Sucursal** | |
| **Equipo** | Qué bien usaste ([capítulo 6](06-bienes-y-deudas.md)) |
| **Fecha de producción** | |
| **Cantidad de lotes producidos** | Cuántos lotes hiciste |
| **Cantidad real obtenida** | **Cuántas unidades salieron de verdad** |
| **Fecha de vencimiento del lote** | Opcional |

Mientras completás, un panel a la derecha recalcula en vivo el rendimiento teórico, la merma y el
costo resultante. Todo está a la vista en una sola pantalla; no es un asistente de pasos.

### Las tres cuentas, explicadas

**Rendimiento teórico** — cuántas unidades *deberían* salir:

```
(rendimiento de la receta × lotes producidos) ÷ base que consume cada unidad
```

**Merma** — lo que se perdió:

```
rendimiento teórico − cantidad real obtenida
```

Nunca es negativa: si sacaste más de lo teórico, la merma es cero.

**Costo por unidad** — lo que te salió cada una:

```
costo total de los insumos ÷ cantidad real obtenida
```

**Fijate en el detalle del divisor: es la cantidad *real*, no la teórica.** Eso hace que la merma se
reparta sola entre las unidades que sí salieron. Si perdiste el 10 % del lote, las unidades buenas
cargan ese 10 %. Es el número honesto: lo que te costó cada unidad vendible, no lo que te habría
costado si nada se hubiera perdido.

**Por eso "cantidad real obtenida" es el campo más importante de la pantalla.** Contá bien. Si ponés
el teórico por comodidad, tu costo va a quedar sistemáticamente bajo y tus márgenes van a parecer
mejores de lo que son.

### Qué pasa al confirmar

- **Se descuentan los insumos** de la receta, según los lotes producidos.
- **Entra el stock** del producto terminado.
- **Se actualiza el costo del producto** con el costo calculado, y su origen pasa a "sugerido por tu
  rubro".
- Quedan registradas la merma en cantidad y en dinero.

**Si no alcanza el stock de un insumo, la producción se bloquea** — salvo que tengas el permiso
especial *producir sin stock de insumo* ([capítulo 9](09-tu-equipo.md)).

> ⚠️ El descuento de insumos y la acreditación del producto no son una sola operación indivisible.
> Si algo falla justo en el medio, podés quedar con los insumos descontados y el producto sin
> acreditar, y la pantalla te lleva al listado igual, sin avisarte. Es poco probable, pero si un día
> los números no cuadran después de una producción, revisá el stock de las dos puntas. (ver H-40)

---

## Corregir una producción

Igual que en ventas y compras: **no se edita**. Desde el listado de producciones, **Corregir una
producción** abre un ajuste donde podés indicar un costo o una cantidad corregidos, con **motivo
obligatorio**.

La fila original sigue mostrando sus valores; el ajuste queda al lado.

---

## Capacidad de producción

**Producción › Capacidad** (`/app/produccion/capacidad`). Compara cuánto produjiste contra cuánto
podrías haber producido, y cuánto depósito estás usando.

> 🚧 **La parte de producción no puede funcionar hoy.** El cálculo necesita dos datos del equipo
> —disponibilidad horaria semanal y tiempo estimado por ciclo— y **el formulario de bienes no tiene
> esos campos**. No hay forma de cargarlos, así que esta mitad de la pantalla siempre va a decir
> "sin datos suficientes". (ver H-34)

**La parte de almacenamiento sí funciona**, porque la capacidad de almacenamiento sí está en el
formulario de bienes. Si la cargaste, vas a ver qué porcentaje de tu depósito estás ocupando, acá y
en el panel de inicio.

---

## El orden de carga, y un consejo

1. **Todos los insumos**, con su unidad bien elegida.
2. **Una compra de cada insumo**, para que tengan costo. Sin costo de insumos, la producción calcula
   un costo de cero.
3. **Las recetas**, pensadas por lote.
4. **Vincular cada producto a su receta**, desde la ficha del producto.
5. **Recién ahí**, registrar producciones.

**El consejo:** hacé una producción de prueba con un lote real y revisá el costo por unidad que te
devuelve. Si no se parece a lo que vos calculabas a mano, hay algo mal cargado —casi siempre la
unidad de un insumo, o la base que consume cada unidad— y es mucho más fácil encontrarlo ahora que
con cincuenta producciones encima.
