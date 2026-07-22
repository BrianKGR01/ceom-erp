# 6. Bienes y deudas

Acá cargás lo que tu negocio **tiene** —máquinas, equipos, vehículos, muebles— y lo que **debe**
—créditos, financiaciones, cuotas—. Es la parte del sistema que responde "¿cuánto vale mi negocio?",
una pregunta que ni las ventas ni los gastos contestan solos.

No es urgente para operar: podés vender y comprar durante meses sin cargar nada de esto. Se vuelve
necesario cuando querés saber tu patrimonio real, cuando financiaste una compra grande, o cuando
tenés que mostrarle números a alguien de afuera.

---

## Bienes

**Bienes y deudas › Bienes** (`/app/patrimonio`).

Un **bien** es algo que compraste, que te dura y que no vendés: el horno, la heladera, la
camioneta, las estanterías. No es mercadería —eso es stock, [capítulo 2](02-catalogo.md)— ni un
gasto —eso se consume, [capítulo 4](04-gastos.md)—.

**El criterio para saber si algo va acá:** ¿lo vas a seguir teniendo el año que viene y lo usás para
trabajar? Entonces es un bien.

### Cargar un bien

El formulario tiene tres secciones.

**Datos principales:** nombre, tipo y sucursal.

**Detalles de adquisición y operación:**

| Campo | Para qué |
|---|---|
| **Valor de compra** | Lo que pagaste. |
| **Fecha de adquisición** | Desde cuándo lo tenés. |
| **Vida útil en meses** | Cuántos meses estimás que te va a durar. Ver la sección de abajo — es el campo que decide si el bien pierde valor con el tiempo o no. |
| **Proveedor** | A quién se lo compraste. |
| **Número de serie** | |
| **Vencimiento de garantía** | |

**Capacidad (opcional):** capacidad de producción y capacidad de almacenamiento, cada una con su
unidad. Son para el rubro de alimentos y bebidas y para el control de depósito
([capítulo 7](07-produccion.md)).

### Cómo pierde valor un bien

El sistema calcula el **valor actual** de cada bien con una depreciación lineal simple: reparte el
valor de compra a lo largo de la vida útil que cargaste, y descuenta la parte ya transcurrida.

Un horno de Bs 12.000 con vida útil de 60 meses pierde Bs 200 por mes. A los 30 meses vale Bs 6.000.

Tres cosas que conviene saber:

- **Si no cargás vida útil, el bien no se deprecia nunca.** Vale siempre lo que pagaste. Está bien
  para un terreno; para una máquina, te va a inflar el patrimonio.
- **Nunca baja de cero.** Pasada la vida útil, queda en cero y ahí se queda.
- **No se guarda: se calcula cada vez que se muestra.** Si corregís la fecha o la vida útil, todos
  los valores se recalculan solos. No hay nada que "cerrar" cada mes.

### Qué podés hacer con un bien

Desde su ficha (`/app/patrimonio/[id]`): ver el detalle con su valor actual y la deuda asociada si la
tiene, **editar**, **transferir** y **dar de baja**.

**Dar de baja** es para cuando el bien se rompió, se vendió o se descartó. **Pide un motivo
obligatorio** y el bien queda registrado como dado de baja, no se borra: sigue en el historial con
su motivo. Los botones de transferir y dar de baja desaparecen una vez dado de baja.

> 🚧 **Todavía no:** **Transferir** mueve un bien de una sucursal a otra, y tu negocio tiene una
> sola sucursal sin forma de crear otra. La función no se puede usar. (ver H-02)

> 🚧 **Todavía no:** el formulario no tiene los campos de **ciclo de producción** (disponibilidad
> horaria semanal, tiempo por ciclo, descanso entre ciclos) que existen por detrás. Sin ellos, la
> pantalla de capacidad de producción no puede mostrar nada. (ver H-34)

---

## Deudas

**Bienes y deudas › Deudas** (`/app/patrimonio/pasivos`).

Una **deuda** es una obligación con un plazo y una cuota: el crédito del horno, la financiación de la
camioneta, un préstamo.

### Cargar una deuda

| Campo | Qué es |
|---|---|
| **Bien relacionado** | Opcional. Si la deuda financió una compra concreta, vinculala: la ficha del bien va a mostrar cuánto falta pagar de él. |
| **Monto total** | El total a devolver. |
| **Cuota** | Cuánto pagás por período. |
| **Frecuencia** | Mensual, semanal, quincenal o anual. |
| **Plazo en cuotas** | Cuántas cuotas son. |
| **Fecha de inicio** | |

> ⚠️ **No hay campo de tasa de interés.** El sistema trabaja con la cuota fija que le cargues, sin
> desglosar cuánto es capital y cuánto interés. Cargá el **monto total a devolver**, no el capital
> prestado, o el saldo te va a quedar corto. (ver H-38)

### La ficha de una deuda

Muestra tres números —monto original, cuota y saldo pendiente— y el historial completo de pagos, con
el saldo restante corrido después de cada uno.

### Registrar un pago

Desde la ficha: **Registrar pago**. El sistema muestra el saldo actual, cuánto vas a pagar y cómo
queda, recalculado mientras escribís. Al llegar a cero, la deuda pasa sola a **pagada**.

> ⚠️ **El pago de una cuota no genera un gasto.** Existe por detrás la función que lo haría, pero no
> está conectada a ningún botón. Así que la cuota **sale de tu caja sin aparecer en tus gastos ni en
> tu resultado**. Si querés que impacte, cargala además como un gasto manual
> ([capítulo 4](04-gastos.md)). (ver H-27)

> ⚠️ **No hay fecha de próximo vencimiento.** Ni la lista ni la ficha calculan cuándo vence la
> próxima cuota, aunque tengas cargadas la fecha de inicio y la frecuencia. No esperes que el sistema
> te avise: llevá vos el control del calendario. (ver H-38)

### Refinanciar

Si renegociaste una deuda, **Refinanciar** desde la ficha. Se abre el mismo formulario del alta, con
los términos anteriores precargados y pidiendo la fecha de inicio de nuevo.

Al confirmar: la deuda anterior queda como **refinanciada**, con su saldo congelado, y nace una
nueva en estado activo. La vieja no se borra — queda el rastro de que existió y de cuánto quedaba
cuando se renegoció.

---

## Cómo se conectan las dos cosas

Si vinculaste una deuda a un bien:

- La ficha del **bien** muestra una tarjeta con la deuda asociada: saldo pendiente, cuota y estado.
- La ficha de la **deuda** muestra el nombre del bien.

Es lo que te deja ver la situación completa de una compra financiada: cuánto vale hoy la máquina y
cuánto te falta pagar de ella. Si el saldo es mayor que el valor actual, estás debiendo más de lo que
vale.

---

## Dónde aparecen estos números

El total de bienes y deudas se muestra como **valor patrimonial total** en
**Reportes › Resumen financiero** ([capítulo 8](08-entender-el-negocio.md)). No hay una pantalla de
patrimonio consolidado propia.

---

## Por dónde empezar

1. **Cargá primero los bienes grandes** — los tres o cuatro que representan la mayor parte de tu
   inversión. Los muebles chicos pueden esperar o no cargarse nunca.
2. **Poné vida útil realista.** Es lo que hace que el valor tenga sentido. Un horno industrial, 5 a
   10 años; una computadora, 3 a 4; un vehículo, 5 a 8.
3. **Cargá las deudas que estén vigentes**, con el monto total a devolver.
4. **Vinculá cada deuda a su bien**, si corresponde.
5. **Cada vez que pagues una cuota**, registrala — y acordate de cargar también el gasto, hasta que
   eso se automatice.
