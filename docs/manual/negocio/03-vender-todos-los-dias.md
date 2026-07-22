# 3. Vender todos los días

Este es el capítulo del uso diario. Registrar ventas, cobrarlas, corregir las que salieron mal, y
mantener ordenadas las listas que las ventas necesitan: clientes, canales, métodos de pago y
eventos.

Si venís del [capítulo 1](01-primeros-pasos.md), ya hiciste tu primera venta. Acá está todo lo demás.

---

## Las cuatro listas que sostienen una venta

Antes del detalle, conviene saber qué es cada cosa y cuál hace falta de verdad.

| Lista | ¿Obligatoria para vender? | Qué es |
|---|---|---|
| **Canales de venta** | **Sí** | La vía por la que llega el producto al cliente: tu local, Instagram, una feria. |
| **Métodos de pago** | No, pero sí para registrar el cobro | Cómo te pagan: efectivo, transferencia, QR. |
| **Clientes** | No | A quién le vendiste. Se puede vender sin cliente. |
| **Eventos** | No | Una feria o pop-up con fecha de inicio y fin, para medirla aparte. |

Tu negocio arranca **sin ninguna de las cuatro cargada**.

> ⚠️ **El canal de venta es obligatorio y nada te lo anticipa.** La guía de bienvenida afirma que
> cargar un producto es lo único que necesitás para vender, y el paso "¿Dónde vendés hoy?" del
> onboarding parece haber resuelto los canales — no los resuelve. Si llegás a la pantalla de venta
> sin canales, vas a ver un espacio vacío donde deberían estar, sin ninguna explicación. **No quedás
> trabado:** el enlace **+ Nuevo canal**, justo debajo de ese espacio, crea uno en el momento y lo
> deja elegido. Pero hay que verlo. (ver H-01)

---

## Registrar una venta

**Ventas › Vender** (`/app/ventas`).

### 1. Armá el carrito

Los productos aparecen como tarjetas. Buscalos por nombre o filtrá por categoría, y tocá cada uno
para agregarlo. Ajustá las cantidades; el total se recalcula solo.

Solo aparecen los productos marcados como activos.

> ⚠️ **La pantalla de venta no te muestra el stock disponible de cada producto**, ni te avisa si
> estás vendiendo más de lo que tenés. La venta se registra igual y el stock queda en negativo. Si
> el control de existencias te importa, revisalo en el catálogo antes o después, no durante la
> venta. (ver H-37)

### 2. Elegí el cliente (opcional)

Tres opciones: dejarlo sin cliente, elegir uno existente, o crear uno nuevo ahí mismo con nombre y
teléfono.

**Cuándo conviene cargar el cliente:** si vendés a crédito —porque después vas a necesitar saber
quién te debe—, si es un cliente que vuelve, o si vendés a otros negocios. Para una venta de
mostrador al público, dejarlo vacío está perfectamente bien.

El cliente que creás desde acá queda guardado en tu lista de clientes.

### 3. Elegí el canal de venta

Obligatorio. Aparecen como botones los canales que tengas creados.

**Por qué el sistema insiste con esto.** Es lo que después te deja responder si te conviene más el
local o las redes, y qué producto deja mejor margen en cada vía. Es una de las preguntas que mejor
contesta CEOM — y solo la puede contestar si cada venta quedó atribuida desde el principio. Ese dato
no se puede reconstruir después.

### 4. Elegí el evento (solo si hay alguno abierto)

Si tenés un evento abierto, aparece un selector opcional. Si no, no se muestra.

### 5. Registrá el pago (opcional)

Elegí el método y el monto:

- **Cobraste todo** → poné el total. La venta queda **pagada**.
- **Cobraste una parte** → poné lo que te dieron. Queda **parcial**.
- **No cobraste nada** → salteá este paso. Queda **pendiente**.

### 6. Confirmá

---

## Qué pasa cuando confirmás

Vale la pena entenderlo, porque explica el sistema entero.

**Se congelan el precio y el costo.** Cada línea guarda el precio y el costo que el producto tenía
en ese momento. Si mañana cambiás cualquiera de los dos, esta venta sigue mostrando lo de hoy. Tus
reportes históricos no se mueven cuando cambiás una etiqueta.

**Se descuenta el stock**, producto por producto.

**Queda un estado de cobro**: pagada, parcial o pendiente.

**Se calcula la comisión**, si el canal o el evento tenían un porcentaje configurado.

> ⚠️ **La comisión se calcula, se guarda y ahí se queda.** No se convierte en un gasto, no se
> muestra en ninguna pantalla —ni en la ficha de la venta— y no se descuenta de tu resultado. Si
> cargaste un porcentaje de comisión en un canal esperando verlo reflejado en tus números, hoy no
> pasa. Mientras tanto, si querés que la comisión impacte en tu resultado, cargala como un gasto
> manual ([capítulo 4](04-gastos.md)). (ver H-24)

---

## Ver y cobrar tus ventas

**Ventas › Historial** (`/app/ventas/historial`) lista todas las ventas con su fecha, cliente,
canal, estado de cobro y total. Se puede buscar por cliente y filtrar por estado y canal.

Tocá cualquier fila para abrir la **ficha de la venta** (`/app/ventas/[id]`): el detalle línea por
línea con los precios y costos congelados, los pagos recibidos y los ajustes aplicados.

### Registrar un cobro posterior

Para las ventas a crédito o con seña, desde la ficha: **Registrar pago**. El monto viene precargado
con el saldo pendiente, y podés cargar un cobro parcial.

El estado se recalcula solo: **pendiente → parcial → pagada**, comparando la suma de los pagos
contra el total de la venta.

---

## Corregir una venta

**Una venta nunca se edita.** No hay botón de editar y no es un olvido: si las ventas se pudieran
editar, ningún reporte sería confiable, porque cualquier número podría haber cambiado sin dejar
rastro.

Lo que hay es el **ajuste**, desde la ficha de la venta. Queda registrado al lado de la venta
original, con su motivo y quién lo hizo.

### Los cuatro tipos

| Tipo | Cuándo |
|---|---|
| **Corrección** | Te equivocaste al cargar: un precio mal, una cantidad de más. |
| **Devolución** | El cliente devolvió mercadería. |
| **Descuento posterior** | Acordaste un descuento después de registrar la venta. |
| **Anulación total** | La venta no existió. |

### Cómo se carga

1. **Tipo** — uno de los cuatro.
2. **Monto del ajuste** — ver el aviso de abajo sobre el signo.
3. **¿Devuelve stock?** — opcional. Si elegís un producto y una cantidad, esa cantidad **vuelve a
   entrar al stock** como un movimiento real.
4. **Motivo** — obligatorio.

> ⚠️ **El signo del monto es responsabilidad tuya y el sistema no lo valida.** Los ajustes se
> **suman** a tu resultado: para que un ajuste **reduzca** lo que ganaste —que es el caso de una
> devolución, un descuento o una anulación— el monto tiene que ir en **negativo**. El campo lo
> sugiere con un texto gris que dice "Negativo si devolvés dinero", pero ese texto desaparece apenas
> empezás a escribir, y nada te frena si ponés un positivo. Una anulación total cargada en positivo
> **duplica** el ingreso de esa venta en tu estado de resultados en vez de cancelarlo. (ver H-30)

> ⚠️ **Un ajuste no cambia el total de la venta ni su estado de cobro.** Una venta anulada sigue
> mostrando su importe original en el historial y en su ficha, y si estaba pendiente sigue
> apareciendo como pendiente de cobro para siempre. El ajuste **sí** se refleja en tus reportes de
> resultado. Es decir: el historial de ventas muestra lo que pasó, los reportes muestran lo que
> quedó. Saberlo evita perseguir cobros de ventas que anulaste. (ver H-26)

> 🚧 **Todavía no:** una devolución no puede registrar la salida de dinero de la caja. El sistema lo
> contempla por detrás pero la pantalla no lo ofrece, así que el ajuste corrige tu resultado y no tu
> flujo de caja. Si devolviste plata de verdad, cargala además como un gasto manual. (ver H-17)

> 🔎 **Nota interna:** ajustar exige el permiso `anular_ajustar` sobre ventas; registrar un pago solo
> exige `crear`. Es la separación entre quien vende y quien corrige.

---

## Clientes

**Ventas › Clientes** (`/app/ventas/clientes`). Alta, edición y baja, con nombre, teléfono y correo.
La lista muestra la fecha de la última compra de cada uno.

Eliminar un cliente es una baja lógica: sus ventas quedan intactas.

---

## Canales de venta

**Ventas › Canales de venta** (`/app/ventas/canales`).

Cada canal tiene un **nombre** y una **comisión por defecto (%)**, que se propone sola al vender por
ese canal. El interruptor **activo** lo saca de la pantalla de venta sin borrarlo.

**Cuántos crear.** Pocos y que signifiquen algo. Dos o tres que representen de verdad cómo vendés
valen más que ocho que después no vas a poder comparar. Un buen criterio: creá un canal por cada vía
sobre la que podrías tomar una decisión distinta.

> ⚠️ La comisión por defecto se calcula al vender pero **no impacta en ningún número visible**
> todavía. (ver H-24)

---

## Métodos de pago

**Ventas › Métodos de pago** (`/app/ventas/metodos-pago`). Solo un nombre y un interruptor de
activo.

No se eliminan: se desactivan. Un método desactivado desaparece de la pantalla de venta y los pagos
ya registrados con él siguen intactos. Se puede reactivar.

**Por qué conviene separarlos bien.** El flujo de caja se arma con los pagos efectivamente
registrados. Si cargás todo como "Efectivo" porque es más rápido, vas a tener un flujo de caja
correcto en el total y sin ninguna utilidad para saber cuánto entró por transferencia.

---

## Eventos: ferias y pop-ups

Un **evento** es una venta acotada en el tiempo —una feria, un pop-up, una fecha especial— que
querés medir por separado, con su propia comisión.

**Ventas › Eventos** (`/app/ventas/eventos`).

| Acción | Qué hace |
|---|---|
| **Abrir un evento** | Nombre, sucursal, canal, fechas y comisión. La comisión se precarga con la del canal elegido y se puede cambiar. |
| **Vender dentro del evento** | Mientras está abierto, aparece como opción en la pantalla de venta. Su comisión reemplaza a la del canal. |
| **Cerrar** | Deja de aparecer al vender. |
| **Reabrir** | Vuelve a estar disponible. |

### Un permiso aparte

Abrir, cerrar y reabrir eventos exige el **permiso especial "gestionar eventos"**, que es distinto
del permiso de ventas. El dueño lo tiene siempre. Un colaborador, solo si se lo otorgás
([capítulo 9](09-tu-equipo.md)). Si no lo tiene, puede **vender** dentro de un evento abierto pero no
gestionarlo, y va a ver un error explicando que le falta la capacidad.

> 🚧 **Todavía no:** no se puede cambiar la comisión de un evento ya abierto. Si te equivocaste,
> hay que cerrarlo y abrir otro. (ver H-17)

> 🚧 **Todavía no:** no existe el "cierre con total agregado" —cargar de una sola vez lo que vendiste
> en la feria—. Hoy cada venta del evento se carga una por una. Si volvés de una feria con 80 ventas
> anotadas en papel, considerá la importación de histórico. (ver H-17)

---

## Importar ventas viejas

**Ventas › Importar histórico** (`/app/ventas/importar`). Sirve para cargar de una vez las ventas
anteriores a CEOM, o un lote grande anotado a mano.

**El archivo** es un `.csv` con este encabezado exacto:

```
fecha,canal,producto,cantidad,precioVenta,costoUnitario,cliente
```

No hay pantalla para mapear columnas: el encabezado tiene que ser ese.

**Cómo funciona.** Arrastrás el archivo y el sistema muestra una vista previa: resuelve el canal, el
producto y el cliente **por nombre** contra los que ya tenés cargados, y marca en rojo las filas que
no pudo resolver, con el motivo. Elegís una sucursal para todo el lote y confirmás. Cada fila válida
se convierte en una venta de una sola línea.

**Lo que hay que saber antes de importar:**

- **Los nombres tienen que coincidir** con los que ya tenés cargados. Cargá primero tus productos y
  tus canales.
- **No descuenta stock.** Son ventas que ya ocurrieron; tu stock actual ya las refleja.
- **No calcula comisión.** El precio y el costo salen tal cual del archivo.
- **Las filas con error no se importan**, pero las válidas del mismo archivo sí. Corregí el archivo y
  volvé a subir solo las que fallaron, o vas a duplicar las que ya entraron.

**Quién puede.** El dueño siempre. Un colaborador necesita el permiso especial "importar histórico".

---

## El ritmo diario recomendado

- **Durante el día:** registrá cada venta en el momento, con su canal. Es lo único que no se puede
  reconstruir después.
- **Al cerrar:** registrá los cobros de las ventas que quedaron pendientes.
- **Una vez por semana:** revisá el historial filtrando por "pendiente" para ver quién te debe.
- **Una vez por mes:** cotejá el stock del sistema con lo que tenés de verdad y cargá los ajustes
  ([capítulo 2](02-catalogo.md)).
