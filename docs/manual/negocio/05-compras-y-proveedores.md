# 4. Compras y proveedores

Registrar tus compras es lo que hace que el costo de tus productos deje de ser una estimación tuya y
pase a salir de lo que pagaste de verdad. Y como el costo es la base del margen, del estado de
resultados y del simulador, es lo que hace que todos esos números empiecen a significar algo.

Este capítulo cubre: el directorio de proveedores, registrar una compra, recibirla, pagarla y
corregirla.

---

## El orden importa

Una compra necesita que existan antes:

1. **El producto o el insumo** que estás comprando ([capítulo 2](02-catalogo.md)).
2. **El proveedor** — opcional, pero conviene.

Si comprás algo que todavía no está en tu catálogo, cargalo primero como producto. No hay forma de
crear un producto desde la pantalla de compra.

---

## El directorio de proveedores

**Proveedores › Directorio** (`/app/proveedores`). Es una pantalla partida: la lista a la izquierda,
el detalle del seleccionado a la derecha.

Un proveedor tiene solo tres campos: **nombre** (obligatorio), **contacto** y **notas**. No hay
campos de dirección, NIT ni condiciones de pago.

**La ficha del proveedor** muestra cuántas compras le hiciste, cuánto le compraste en total, y dos
pestañas:

- **Historial de compras** — todo lo que le compraste.
- **Historial de precios** — cuánto te cobró cada ítem a lo largo del tiempo. Es la pestaña que sirve
  para negociar: muestra si un proveedor te viene subiendo el precio.

Eliminar un proveedor es una baja lógica: sus compras quedan intactas.

**El proveedor es opcional en una compra.** Podés registrar una compra sin proveedor —una compra de
mostrador, algo que compraste una sola vez—. Pero sin proveedor perdés el historial de precios, que
es la parte más útil.

---

## Registrar una compra

**Proveedores › Compras › Nueva compra** (`/app/proveedores/compras/nuevo`).

### Los dos interruptores que cambian todo

**Tipo:**

| Tipo | Qué comprás |
|---|---|
| **Producto para reventa** | Algo que vendés tal cual. Actualiza el stock y el costo de un **producto** de tu catálogo. |
| **Insumo de producción** | Materia prima. Actualiza el stock y el costo de un **insumo** ([capítulo 7](07-produccion.md)). |

Elegí uno y el selector de abajo cambia. Si tu rubro no es alimentos y bebidas por lotes,
probablemente no tengas insumos cargados y siempre uses el primero.

**Estado:**

| Estado | Qué pasa |
|---|---|
| **Ya recibida** (por defecto) | El stock entra en el momento y el costo se actualiza. |
| **Pedido** | Queda registrada como pendiente. **No mueve stock ni toca el costo** hasta que la recibas. |

**Usá "Pedido"** cuando encargás algo que todavía no llegó. Así queda anotado que está en camino sin
inflar tu stock. Cuando llegue, la recibís y ahí entra.

### Los números

| Campo | Qué es |
|---|---|
| **Cantidad** | Cuántas unidades comprás. |
| **Monto total** | Lo que pagaste **por todo**, no por unidad. |
| **Costo adicional de traslado** | Opcional. Flete, envío, lo que te costó traerlo. |
| **Fecha de compra** | |
| **Fecha de vencimiento** | Opcional. |

**El costo unitario lo calcula el sistema**, así:

```
costo unitario = (monto total + costo de traslado) ÷ cantidad
```

**Por qué el traslado va acá y no como un gasto aparte.** Si comprás 100 unidades por Bs 1.000 y el
flete te costó Bs 200, cada unidad te salió Bs 12, no Bs 10. Cargando el traslado en la compra, ese
costo real queda dentro del producto y tu margen es el verdadero. Si lo cargaras como un gasto
suelto, el producto parecería más rentable de lo que es.

---

## Recibir una compra

Solo aplica a las compras en estado "pedido". Desde **Proveedores › Compras**
(`/app/proveedores/compras`), en la fila de la compra, tocá **Recibir**. Pide la fecha de recepción
—precargada con hoy— y confirmás.

**Ahí sí pasa todo:**

- **Entra el stock** en la sucursal de la compra.
- **Se actualiza el costo** del producto o insumo.
- El origen del costo pasa a **"precio de tu proveedor"**.

### Cómo queda el costo, exactamente

Para un **producto de reventa**, el costo del producto queda **reemplazado por el costo unitario de
esta compra**. No es un promedio: es el último precio que pagaste.

> ⚠️ **Esto sorprende y conviene saberlo.** Si tenías 100 unidades compradas a Bs 10 y recibís 5
> unidades a Bs 18 —una compra chica de urgencia, más cara—, el costo de **todo** tu stock pasa a
> Bs 18. Tu margen se ve peor de lo que es hasta la próxima compra a precio normal. Si te pasa,
> podés corregir el costo a mano desde la ficha del producto. (ver H-25)

Para un **insumo** el cálculo es distinto: ahí sí se promedia. Se explica en el
[capítulo 7](07-produccion.md).

---

## Pagar una compra

Desde la fila de la compra, **Pagar**. El sistema te muestra el saldo actual, cuánto vas a pagar y
cómo queda el saldo después, recalculado mientras escribís.

Se pueden cargar pagos parciales: el estado va de **pendiente → parcial → pagado** solo, comparando
lo pagado contra el monto total.

**Comprar y pagar son dos momentos distintos.** Una compra recibida y no pagada ya te dio el stock y
el costo, pero todavía no salió plata de tu caja. Por eso el flujo de caja se arma con los **pagos**,
no con las compras.

---

## Corregir una compra

Igual que con las ventas: **una compra no se edita**. Se corrige con una **compra de ajuste**, desde
la fila de la compra, botón **Ajustar**.

| Tipo | Cuándo |
|---|---|
| **Corrección** | Te equivocaste al cargar el monto o la cantidad. |
| **Devolución a proveedor** | Devolviste mercadería. |
| **Anulación total** | La compra no existió. |

El **motivo es obligatorio**.

> ⚠️ **Un ajuste de compra hoy no tiene ningún efecto observable.** Queda guardado, pero: no cambia
> el monto ni el estado de pago de la compra, **no revierte el stock que entró**, no aparece en
> ninguna pantalla —ni siquiera en la fila de la compra que ajustaste— y no llega a ningún reporte.
> Es un registro que se escribe y que nadie lee. (ver H-31)
>
> **Qué hacer mientras tanto**, según el caso:
> - **Entró stock que no correspondía** → corregilo con un ajuste manual de stock desde la ficha del
>   producto ([capítulo 2](02-catalogo.md)), que sí funciona.
> - **El costo quedó mal** → corregilo a mano en la ficha del producto.
> - **Pagaste de más o de menos** → el saldo se corrige registrando el pago real; no hay forma de
>   quitar un pago ya cargado.
>
> Cargá igual el ajuste, con su motivo: es el registro de qué pasó, y va a valer cuando la pantalla
> lo muestre.

---

## El historial de precios

Dos formas de ver lo mismo:

- **Por proveedor** — pestaña "Historial de precios" en la ficha del proveedor. Sirve para
  responder "¿este proveedor me viene subiendo?".
- **Por producto** — sección "Historial de precios de compra" en la ficha del producto. Sirve para
  responder "¿a quién le conviene comprarle esto?".

Es de las pantallas más útiles del sistema y la que más se llena sola: no hay que hacer nada
especial más que registrar las compras con su proveedor.

---

## Compras y gastos: cuál es cuál

Es la duda más común y la regla es simple:

| Es una **compra** | Es un **gasto** |
|---|---|
| Comprás algo que **entra a tu stock** y que después vendés o transformás | Todo lo demás |
| Mercadería para revender, materia prima, envases | Alquiler, luz, internet, sueldos, publicidad, transporte no atribuible a una compra |

**El criterio práctico:** si lo que comprás se convierte en unidades que después vas a vender, es una
compra. Si se consume y desaparece sin volverse producto, es un gasto ([capítulo 4](04-gastos.md)).

La distinción no es formal: las compras se vuelven costo de tus productos y se descuentan **cuando
vendés**; los gastos se descuentan **cuando ocurren**. Cargar mercadería como gasto te hace ver
peor el mes que comprás y mejor el mes que vendés.

---

## El ritmo recomendado

- **Cuando encargás** algo que no llegó → cargalo como "pedido".
- **Cuando llega** → recibila, con la fecha real de llegada.
- **Cuando pagás** → registrá el pago, aunque sea parcial.
- **Una vez al mes** → mirá el historial de precios de tus tres o cuatro proveedores principales.
