# 5. Gastos

Sin gastos cargados, CEOM te muestra el margen de tus productos y lo llama resultado. No es lo
mismo. El margen es lo que te deja cada venta; la ganancia es lo que queda después de pagar el
alquiler, la luz y los sueldos. La diferencia entre las dos cifras es, para muchos negocios, la
diferencia entre creer que van bien e ir bien.

Este capítulo cubre: categorías de gasto, cargar gastos, pagarlos, y las plantillas de gastos
recurrentes.

---

## Antes de cargar el primer gasto: las categorías

**La categoría es obligatoria en todo gasto.** No hay forma de guardar uno sin elegirla.

Y tu negocio arranca **sin ninguna categoría de gasto cargada**. No vienen sugerencias, ni un
conjunto inicial, ni un botón de "cargar las típicas".

Es decir: **antes de poder registrar tu primer gasto, tenés que crear una categoría.**

**Cómo:** desde **Gastos** (`/app/gastos`), tocá **Gestionar categorías**. O, más práctico, empezá a
cargar el gasto y usá el enlace **+ Crear nueva** que está al lado del selector de categoría — se
abre la misma ventana sin perder lo que ya escribiste.

> ⚠️ Nada te avisa de esto antes de tiempo. Vas a descubrirlo cuando ya estés cargando el gasto y el
> selector de categoría esté vacío. El sistema tiene por dentro un conjunto de categorías por
> defecto listo para precargarse, pero ningún botón lo activa. (ver H-32)

### Qué categorías crear

Pocas y estables. Entre seis y diez alcanzan para un negocio chico:

> Alquiler · Servicios (luz, agua, gas) · Internet y telefonía · Sueldos y cargas · Transporte ·
> Publicidad · Impuestos · Mantenimiento · Insumos de limpieza · Comisiones bancarias

**El criterio:** una categoría sirve si alguna vez vas a querer ver ese total por separado. Si nunca
vas a preguntarte "¿cuánto gasté en esto?", no merece una categoría propia.

Y no hagas categorías demasiado finas. "Servicios" es útil; "Luz", "Agua" y "Gas" por separado te
dan tres números chicos que después vas a tener que sumar mentalmente cada vez.

---

## Los tres tipos de gasto

Al cargar un gasto elegís su tipo entre tres tarjetas. **No es una etiqueta decorativa**: define
cómo se usa ese gasto en tus cálculos.

| Tipo | Qué es | Ejemplos |
|---|---|---|
| **Fijo** | Se repite todos los meses y no depende de cuánto vendas. | Alquiler, internet, sueldos, seguro |
| **Variable no productivo** | Cambia mes a mes, pero no es materia prima. | Publicidad, comisiones bancarias, reparaciones |
| **Único** | Pasó una vez y no se repite. | Una máquina rota, un trámite, una mudanza |

**Por qué importa elegir bien.** El **punto de equilibrio** —cuánto tenés que vender para no perder
plata— se calcula **sumando únicamente los gastos de tipo "fijo"** del período. Los otros dos tipos
no entran.

Entonces:

- Si cargás el alquiler como "único", tu punto de equilibrio va a dar **más bajo de lo real** y vas a
  creer que estás cubierto cuando no lo estás.
- Si cargás una reparación excepcional como "fijo", va a dar **más alto de lo real** todos los meses.

**La regla práctica:** preguntate "¿esto lo voy a pagar el mes que viene aunque no venda nada?". Si
la respuesta es sí, es fijo.

**El tipo no se puede cambiar después.** El formulario lo bloquea al editar, porque el sistema no
acepta modificarlo. Si te equivocaste, eliminá el gasto y cargalo de nuevo — por eso conviene
pensarlo al cargar.

---

## Cargar un gasto

**Gastos › Nuevo gasto** (`/app/gastos/nuevo`).

| Campo | Obligatorio |
|---|---|
| **Tipo de gasto** | Sí — las tres tarjetas de arriba |
| **Categoría** | Sí |
| **Monto** | Sí, mayor a 0 |
| **Fecha del gasto** | Sí |
| **Proveedor** | No |
| **Descripción** | No, pero conviene |

**Cargá la descripción.** Dentro de tres meses, "Servicios — Bs 450" no te va a decir nada;
"Servicios — luz de marzo" sí. Es el campo que hace que la lista de gastos sirva para algo cuando
crece.

**La fecha es la del gasto, no la del pago.** Son cosas distintas y el sistema las trata distinto:
el gasto entra en tu resultado por la fecha del gasto, y en tu flujo de caja por la fecha del pago.

---

## La lista y la ficha

**Gastos** (`/app/gastos`) lista todo, con filtros por categoría, tipo y estado de pago, y un botón
para cargar de a más resultados.

Cada fila muestra una marca de origen: **Manual** o **Automático**.

Tocá cualquiera para abrir su **ficha** (`/app/gastos/[id]`): monto, categoría, fecha, estado, y el
historial de pagos con el total pagado.

---

## Pagar un gasto

Un gasto cargado no está pagado. Desde la ficha, **Registrar pago**: el sistema muestra el saldo
actual, cuánto vas a pagar y cómo queda el saldo, recalculado mientras escribís.

Se admiten pagos parciales; el estado va de **pendiente → parcial → pagado** solo.

**Por qué se separan.** El resultado del mes se calcula con los gastos **ocurridos**; el flujo de
caja, con los **pagados**. Si cargás la luz de marzo el 31 y la pagás el 10 de abril, marzo carga el
gasto y abril registra la salida de caja. Es lo que permite ver que un mes puede cerrar con ganancia
y aun así dejarte sin efectivo.

Dos límites razonables que conviene conocer: no se puede bajar el monto de un gasto por debajo de lo
que ya pagaste —el sistema lo rechaza diciéndote cuánto llevás pagado— y no hay forma de **quitar**
un pago ya registrado.

---

## Gastos recurrentes

Para lo que se repite todos los meses —alquiler, internet, un abono— hay plantillas.

**Gastos › Recurrentes** (`/app/gastos/recurrentes`).

Una plantilla tiene categoría, monto, frecuencia (mensual, semanal, quincenal o anual), fecha de
inicio y, opcionalmente, fecha de fin.

### Lo más importante de esta pantalla

> ⚠️ **Los gastos recurrentes no se generan solos.** No hay nada programado detrás. Cada mes tenés
> que entrar y tocar **Generar gasto de este período** en cada plantilla.
>
> La tarjeta muestra una **"Próx. fecha"** y una **"Proyección mensual"**: son cuentas de calendario
> hechas en el momento, para que veas cuánto suman tus plantillas. **No hay nada agendado detrás de
> esa fecha.** Si no entrás y generás, el gasto no existe.
>
> El riesgo concreto: llegás a fin de mes, mirás tu resultado, y está inflado porque los gastos fijos
> nunca se cargaron. (ver H-10)

**Cómo convivir con esto.** Poné un recordatorio propio el mismo día de cada mes —el 1 o el 5— para
entrar a esta pantalla y generar todo. Es un minuto. Mientras tanto, la pantalla sirve igual para dos
cosas: como lista de tus gastos fijos, y para ver cuánto suman.

Lo que la plantilla te ahorra es volver a escribir los datos: al generar, el gasto sale con la
categoría y el monto ya cargados, como **fijo**, y sin pagar. Si un mes el monto cambió, generalo y
editalo — el gasto generado es un gasto manual común y corriente, editable.

> ⚠️ **Pausar una plantilla es definitivo.** El interruptor parece de dos posiciones pero solo va en
> un sentido: no existe la acción de reactivar. Una vez pausada, la interfaz la bloquea y hay que
> crear la plantilla de nuevo. (ver H-11)

---

## Los gastos "automáticos"

Vas a ver, en la lista y en la ficha, una marca de origen **Automático**, y en la ficha un aviso que
explica que esos gastos no se pueden editar, eliminar ni pagar a mano porque nacieron de otro
módulo.

La idea de diseño es esta: cuando una venta genera una comisión, o cuando pagás una cuota de una
deuda, el gasto correspondiente aparece solo y solo se corrige corrigiendo su origen.

> ⚠️ **Hoy ningún gasto automático puede existir.** Las dos funciones que los crearían —la comisión
> de una venta y la cuota de una deuda— no están conectadas a ningún botón de la aplicación. Todos
> los gastos que puedas cargar, incluidos los generados desde una plantilla recurrente, nacen como
> **manuales**.
>
> En la práctica: la marca "Automático" nunca se va a mostrar, el aviso de bloqueo nunca va a
> aparecer, y **todos tus gastos son editables y eliminables**.
>
> Lo que esto significa para vos: **las comisiones de tus canales y las cuotas de tus deudas no
> llegan solas a tus gastos.** Si querés que impacten en tu resultado, cargalas como gastos manuales.
> (ver H-24, H-27)

---

## Qué es gasto y qué es compra

Si comprás algo que **entra a tu stock** y que después vendés, eso es una **compra**, no un gasto
([capítulo 5](05-compras-y-proveedores.md)). Mercadería, materia prima y envases van por compras.
Todo lo demás va acá.

Cargar mercadería como gasto te distorsiona los dos lados: te hace ver peor el mes que comprás y
mejor el mes que vendés, porque el costo deja de estar atado a la venta.

---

## Por dónde empezar

Si nunca cargaste gastos, media hora bien invertida:

1. **Creá tus categorías** — seis a diez.
2. **Cargá tus gastos fijos del mes en curso**: alquiler, servicios, internet, sueldos. Son pocos y
   son los que más cambian tu resultado.
3. **Armá una plantilla recurrente para cada uno**, así el mes que viene es un botón.
4. **De ahí en adelante**, cargá los gastos variables a medida que ocurren.
5. **El día 1 de cada mes**, entrá a Recurrentes y generá los del período.

Con los gastos fijos cargados, dos cosas empiezan a funcionar: el estado de resultados muestra tu
ganancia real, y el punto de equilibrio te dice cuánto necesitás vender ([capítulo 8](08-entender-el-negocio.md)).
