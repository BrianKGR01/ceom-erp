# 8. Entender tu negocio

Este capítulo es sobre los números: el panel de inicio, los reportes y el simulador de precios.

Empieza distinto de los demás, con una advertencia, porque tiene que empezar así.

---

## ⚠️ Antes de decidir nada con estos números, leé esto

**Hoy el sistema muestra una ganancia mayor que la real.** No siempre, no en todos los negocios, pero
sí en varios casos frecuentes, y **nunca te avisa cuándo**.

Son cuatro huecos, todos en la misma dirección: cosas que te cuestan plata y que no llegan a
descontarse.

| Qué falta descontar | A quién le pasa | Cuánto pesa |
|---|---|---|
| **Las comisiones de tus canales** | A todo el que haya cargado un % de comisión en un canal o un evento. Se calcula, se guarda y nunca se convierte en gasto. (H-24) | Tanto como el % que cobre tu canal. Con 20 % de comisión, tu ganancia aparece bastante más alta de lo que es. |
| **Las cuotas de tus deudas** | A todo el que tenga una deuda cargada. El pago de la cuota no genera un gasto. (H-27) | El valor de la cuota, cada período. |
| **El costo de los productos sin costo cargado** | A todo el que haya guardado productos sin completar el costo. El ingreso se suma; el costo, no. (H-15) | Todo el costo de esos productos. |
| **Las correcciones de compras** | Al que haya anulado o corregido una compra: el ajuste no revierte nada. (H-31) | El monto de lo que creías haber corregido. |

Y un quinto que va en cualquier dirección:

| **Un ajuste de venta con el signo equivocado** | Al que anule o descuente una venta cargando el monto en positivo. En vez de restar, suma. (H-30) | El doble del monto de la venta ajustada. |

### Qué hacer mientras tanto

**No dejes de usar los reportes** — dejarían de servirte los que sí están bien. Hacé esto:

1. **Cargá el costo de todos tus productos**, aunque sea estimado. Es el hueco más grande y el único
   que depende enteramente de vos ([capítulo 2](02-catalogo.md)).
2. **Cargá como gasto manual** lo que el sistema no descuenta solo: las comisiones del período y las
   cuotas de deuda que pagaste ([capítulo 4](04-gastos.md)). Es un par de líneas por mes y tapa dos
   de los cuatro huecos.
3. **Revisá el signo** de cada ajuste de venta que cargues. En negativo si reduce.
4. **Antes de una decisión importante de precio**, verificá el costo del producto puntual en su ficha
   en vez de confiar en el margen del reporte.

### Qué números sí podés creer hoy

| Número | Estado |
|---|---|
| **Ingresos / ventas totales** | ✅ Confiables. Salen de ventas reales con precios congelados. |
| **Unidades vendidas y ranking por rotación** | ✅ Confiables. |
| **Flujo de caja** | ✅ Confiable **como caja**: suma pagos reales de ventas, compras y gastos. No incluye lo que no registraste como pago. |
| **Distribución de gastos por categoría** | ✅ Confiable sobre lo que cargaste. |
| **Merma** | ✅ Confiable, si registrás las pérdidas como merma y no como ajuste. |
| **Margen por producto y por canal** | ⚠️ Solo tan bueno como los costos cargados. Sin costo, el producto queda afuera o cuenta como costo cero. |
| **Estado de resultados / utilidad** | ⚠️ **Optimista** por los cuatro huecos de arriba. |
| **Punto de equilibrio** | ⚠️ **Optimista**: usa solo los gastos de tipo "fijo", así que si las comisiones y las cuotas no están cargadas, te dice que necesitás vender menos de lo que realmente necesitás. |

---

## El panel de inicio

**Inicio** (`/app`). Es lo primero que ves al entrar, una vez que cargaste tu primer producto.

Arriba, dos filtros: el **período** (hoy, últimos 7 días, este mes, este año) y la **sucursal**.

> ⚠️ El filtro de sucursal solo afecta al resumen del período y al flujo de caja. El ranking de
> productos, los gastos por categoría y la merma lo ignoran. Como hoy hay una sola sucursal no
> cambia nada, pero conviene saberlo. (ver H-16)

### Las cinco tarjetas

**Resumen del período** — tu estado de resultados resumido: ingresos, costos, gastos y el resultado.
Incluye una comparación contra el período anterior equivalente. Es el número que arrastra los huecos
de arriba.

**Flujo de caja** — cuánta plata entró y salió de verdad:

```
pagos de ventas − pagos de compras − pagos de gastos
```

Todo por **fecha de pago**. Es la tarjeta que responde "¿tengo plata?", que es una pregunta distinta
de "¿estoy ganando?". Un negocio puede tener buen resultado y caja negativa: vendiste a crédito y
pagaste al contado.

**Productos más vendidos** — el top 5, con un interruptor entre rotación (unidades) y margen. El de
rotación es confiable; el de margen depende de los costos.

**Gastos por categoría** — la torta de en qué se te va la plata. Acá se paga solo el trabajo de haber
armado bien las categorías ([capítulo 4](04-gastos.md)).

**Control de merma** — cuánto perdiste y qué porcentaje representa sobre tus costos. En un negocio
sin producción da cero, y eso está bien, no es un error.

**Capacidad de depósito** — solo aparece si cargaste la capacidad de almacenamiento de algún bien
([capítulo 6](06-bienes-y-deudas.md)).

---

## Los reportes detallados

**Reportes** (`/app/reportes`), o desde el botón "Ver reportes detallados" del panel.

### Resumen financiero

El **estado de resultados** formal, línea por línea, más el flujo de caja y el **valor patrimonial
total** (bienes menos deudas).

La cuenta es:

```
ingresos − costo de lo vendido − gastos + ajustes de venta
```

**Es una cuenta por lo devengado**, es decir por cuándo pasaron las cosas, no por cuándo se cobraron
o pagaron. Por eso convive con el flujo de caja y por eso los dos números casi nunca coinciden. No es
un error: son dos preguntas distintas.

### Histórico de ventas

La evolución de tus ventas en el tiempo, agrupada por día o por mes según el período. Tiene un
interruptor para incluir o excluir las ventas de eventos, que vuelve a consultar los datos de verdad.

**Para qué sirve el interruptor:** una feria buena te deforma el mes. Sacándola ves si tu venta
habitual creció o si solo tuviste un buen fin de semana.

### Margen por canal y producto

Una tabla cruzada: cada producto contra cada canal, con el margen de esa combinación.

**Es el reporte que justifica haber cargado bien los canales desde el día uno**, y probablemente el
más útil del sistema para tomar decisiones: muestra que un producto puede ser rentable en tu local y
dar pérdida por un canal con comisión.

Los totales por canal se calculan desde los ingresos y costos crudos, no promediando porcentajes
—que sería incorrecto—.

> ⚠️ Este reporte **no descuenta la comisión del canal**, porque la comisión nunca llega a los
> gastos. Así que el margen de un canal con comisión aparece más alto de lo real, y justamente acá es
> donde más importa. Si comparás canales, restá la comisión mentalmente. (ver H-24)

### Ranking de productos

La versión completa del widget del panel: todos los productos, con filtro por canal e interruptor
entre rotación y margen.

> 🚧 **No hay exportación a PDF ni a Excel** en ninguna pantalla de reportes. Si necesitás llevar los
> números afuera, hay que copiarlos a mano. (ver H-20)

---

## El simulador

**Simulador** (`/app/simulaciones`). Sirve para responder dos preguntas antes de tomar una decisión.

### Simular precio

Elegís un producto y el sistema te muestra tres datos actuales: cuánto rota, qué margen deja y cuál
es su costo. Ponés el **margen que querés** y te devuelve el precio que habría que cobrar:

```
precio sugerido = costo ÷ (1 − margen deseado)
```

Y el **impacto proyectado**: cuánto más facturarías al mes con ese precio, según lo que ese producto
rota hoy.

**Tantear es gratis.** Mientras movés el margen no se guarda nada. Recién al tocar **Guardar
simulación** queda registrada en el historial. Podés probar veinte escenarios sin ensuciar nada.

**El costo automático se puede sobrescribir** con "Ajustar manualmente", para simular qué pasaría si
tu costo cambiara. Ese número **no modifica el costo real del producto**: vive solo dentro de la
simulación.

> ⚠️ El precio sugerido es tan bueno como el costo del producto. Si el costo está mal cargado o
> desactualizado, el precio que te sugiere está mal en la misma proporción. Miralo en la ficha del
> producto antes de simular. (ver H-15)

### Punto de equilibrio

Cuántas unidades de un producto tenés que vender para cubrir tus costos fijos.

```
margen de contribución por unidad = precio − costo
punto de equilibrio = costos fijos del período ÷ margen de contribución
```

**Dos cosas para leerlo bien:**

**Usa solo los gastos de tipo "fijo".** De ahí que el tipo de gasto importe tanto
([capítulo 4](04-gastos.md)). Si cargaste el alquiler como "único", tu punto de equilibrio va a dar
más bajo de lo real y vas a creer que estás cubierto cuando no.

**Es por producto, no del negocio entero.** Te dice cuántas unidades *de ese producto* cubrirían
*todos* tus costos fijos, como si vendieras solo eso. Es útil como referencia, no como plan de ventas.

Si el precio no supera al costo, el sistema no inventa un número: muestra un aviso explicando que a
ese precio nunca vas a cubrir los costos fijos. Ese aviso es información, no un error.

> ⚠️ Como las comisiones y las cuotas de deuda no llegan a los gastos, tu costo fijo real es más alto
> que el que usa esta cuenta. El punto de equilibrio que te muestra es un **piso**, no la meta.
> (ver H-24, H-27)

### Comparar productos

Todos tus productos en una tabla, con su costo, precio y margen, y un **precio sugerido** calculado
contra el margen promedio de tu catálogo. Las filas que se alejan del umbral que configures se
resaltan.

El umbral se cambia desde el mismo pill de "umbral de alerta".

**Los productos sin costo quedan afuera** del promedio y de la alerta. No aparecen marcados como
problema: simplemente no participan — otra razón para cargar todos los costos.

### Historial de simulaciones

Todo lo que guardaste, filtrable por producto. **No se puede borrar**, por diseño: es un registro de
las decisiones que evaluaste.

---

## Cómo leer todo esto una vez por mes

Media hora, en este orden:

1. **Flujo de caja del mes.** ¿Entró más de lo que salió? Es la pregunta de supervivencia.
2. **Resumen del período**, con la corrección mental de los huecos que ya sabés.
3. **Gastos por categoría.** ¿Hay algo que creció y no habías notado?
4. **Margen por canal y producto.** ¿Qué canal te conviene? ¿Qué producto no deja nada?
5. **Punto de equilibrio** del producto que más vendés. ¿Cuánto necesitás vender para no perder?
6. **Simulador**, si algo de lo anterior te dio mal. Antes de subir un precio, mirá qué le pasaría a
   tu margen.

Y una vez por mes, la tarea que hace que todo lo demás valga: **revisá que los costos de tus
productos sigan siendo reales.** Es el número del que dependen todos los demás.
