# 2. Tu catálogo

El catálogo es la base de todo lo demás. Cada venta, cada compra, cada reporte de margen y cada
simulación de precio se apoyan en los productos que cargues acá. Vale la pena cargarlo con cuidado
una vez, en vez de corregirlo de a pedazos durante meses.

Este capítulo cubre: categorías, alta de productos, qué significa cada campo, cómo funciona el
stock y cómo se corrige cuando la cuenta no da.

---

## Antes que nada: las categorías

Las categorías agrupan productos para buscarlos y filtrarlos: "Panadería", "Bebidas", "Limpieza".

**Son opcionales.** Podés cargar todo tu catálogo sin ninguna categoría y el sistema funciona igual.
Conviene tenerlas cuando pasás de unos 15 o 20 productos, que es cuando el buscador deja de
alcanzar.

Tu negocio arranca **sin ninguna categoría cargada**. No vienen sugerencias ni una lista inicial:
las creás vos.

**Para crearlas:** en **Catálogo** (`/app/productos`), tocá **Gestionar categorías**. Se abre una
ventana donde las creás, renombrás y eliminás. Una categoría tiene solo un nombre.

También podés crear una al vuelo mientras cargás un producto, sin salir del formulario.

> ⚠️ **Ojo:** eliminar una categoría **no verifica si hay productos usándola**. Los productos no se
> borran ni se bloquean: quedan sin categoría, y hay que volver a asignarlos a mano uno por uno. No
> hay aviso previo ni forma de deshacerlo. Antes de eliminar una categoría, filtrá el catálogo por
> ella y fijate qué hay adentro. (ver H-29)

---

## Cargar un producto

Desde **Catálogo**, tocá el botón de producto nuevo (`/app/productos/nuevo`).

### Lo obligatorio

Son tres campos:

| Campo | Qué tener en cuenta |
|---|---|
| **Nombre del producto** | |
| **Se vende por** | Unidad, kg, g, l, ml o docena. Define en qué unidad se cuenta el stock **y** en qué unidad se cargan las cantidades al vender. Si vendés fiambre por peso, elegí kg y vas a poder vender 0,35. |
| **Precio de venta** | Mayor a 0. |

### Lo opcional que igual conviene cargar

| Campo | Por qué |
|---|---|
| **Costo** | Ver la sección siguiente. Es el campo opcional que más cambia lo que el sistema puede hacer por vos. |
| **Categoría** | Para buscar y filtrar. |
| **Imagen** | PNG o JPG, hasta 5 MB. Se sube apenas la elegís, antes de guardar el formulario. Ayuda mucho en la pantalla de venta, donde los productos se muestran como tarjetas. |
| **Stock inicial** | Cuántas unidades tenés ahora mismo. Si lo dejás vacío, el producto arranca en cero. |
| **Vida útil en días** | Para productos que vencen. Dejalo vacío si no vence. |

---

## El costo, y por qué importa tanto

**El precio es lo que cobrás. El costo es lo que te sale a vos.** La diferencia entre los dos es tu
margen, y el margen es lo que el sistema usa para casi todo lo que sirve para decidir.

El sistema **te deja guardar un producto sin costo** y venderlo con normalidad. No te avisa nada, ni
al guardarlo ni después.

**Qué se rompe si no cargás el costo**, en silencio:

- El margen de ese producto no se puede calcular y aparece vacío.
- Queda afuera del ranking por margen.
- Queda excluido del promedio del comparador de productos.
- El estado de resultados suma tus ingresos sin restar el costo correspondiente, así que muestra una
  ganancia mayor que la real.
- El simulador de precios no tiene desde dónde partir.
- El punto de equilibrio tampoco.

**Un número aproximado es muchísimo mejor que ningún número.** Poné lo que te parece que te sale,
guardalo, y corregilo cuando tengas la factura del proveedor.

> ⚠️ Nada en la interfaz te advierte que un producto no tiene costo cargado. Ni en el catálogo, ni
> en la ficha, ni en los reportes donde ese producto queda excluido. (ver H-15)

### De dónde sale el costo

En la ficha del producto vas a ver un campo **origen del costo**. No lo elegís vos: el sistema lo
marca solo, según de dónde vino el último costo.

| Origen | Qué significa |
|---|---|
| **Manual** | Lo escribiste vos en el formulario. |
| **Precio de tu proveedor** | Salió de una compra que recibiste. Ver [capítulo 5](05-compras-y-proveedores.md). |
| **Sugerido por tu rubro** | Salió de una producción que registraste. Ver [capítulo 7](07-produccion.md). |

**Esto importa porque el costo se pisa solo.** Si cargás un costo a mano y después recibís una
compra de ese producto, el costo pasa a ser el de la compra y el origen cambia. No es un error: es
que el dato real le gana a la estimación.

Si el producto se produce con una receta, el costo **no es editable a mano**: lo calcula cada
producción que registres, y el formulario te lo bloquea. Es deliberado — un costo escrito a mano
pisaría el que salió de la materia prima real ([capítulo 7](07-produccion.md)).

---

## La ficha del producto

Desde el catálogo, tocá cualquier producto (`/app/productos/[id]`). Ahí ves todo junto:

- **Los datos del producto** y su margen calculado.
- **El stock por sucursal**, con la cantidad actual.
- **El historial de movimientos**: cada entrada y cada salida, con su motivo y su fecha. Es el
  registro completo de por qué el stock es el que es.
- **El historial de precios de compra**: cuánto pagaste este producto cada vez, y a quién.

Desde acá también: editar, eliminar, ajustar stock, transferir stock y vincular a una receta.

> ⚠️ La ficha muestra una columna **Stock mínimo**, pero **no existe ninguna pantalla para
> cargarlo**. Siempre va a estar vacía, y el aviso de "stock bajo" que depende de ella nunca se va a
> mostrar. La función existe por detrás, sin nada que la active. (ver H-28)

---

## El stock: cómo se mueve y cómo se corrige

**El stock nunca se edita a mano.** No hay ningún campo donde escribir "tengo 40". Lo que hay es un
registro de movimientos, y la cantidad actual es la suma de todos ellos.

Esto puede parecer incómodo al principio y es lo que hace que el historial sirva: siempre se puede
reconstruir por qué el stock es el que es, y quién lo movió.

### Qué mueve el stock solo

| Movimiento | Cuándo pasa |
|---|---|
| **Entrada por compra** | Cuando **recibís** una compra ([capítulo 5](05-compras-y-proveedores.md)). Registrarla como "pedido" no mueve nada. |
| **Salida por venta** | Cuando confirmás una venta ([capítulo 3](03-vender-todos-los-dias.md)). |
| **Entrada por producción** | Cuando registrás un lote producido ([capítulo 7](07-produccion.md)). |
| **Entrada por devolución** | Cuando un ajuste de venta devuelve stock. |

### El ajuste manual

Para todo lo demás —una rotura, un faltante que aparece al contar, mercadería vencida, un error de
carga— está el **ajuste manual**, desde la ficha del producto.

1. Elegí **Entrada** (tenés más de lo que dice el sistema) o **Salida** (tenés menos).
2. Poné la cantidad de la **diferencia**, no el total que tenés.
3. Escribí el **motivo**. Es obligatorio y no es un trámite: es lo único que le va a explicar a
   alguien —o a vos en tres meses— por qué faltaban seis unidades.

El sistema te muestra cómo va a quedar el stock antes de confirmar.

**Cómo hacer un recuento.** Contá lo que tenés de verdad, comparalo con lo que dice el sistema, y
cargá la diferencia. Si el sistema dice 40 y contaste 37, cargás una **salida de 3** con motivo
"recuento de inventario", no una entrada de 37.

> 🔎 **Nota interna:** el ajuste manual exige el permiso `anular_ajustar` sobre stock, no `crear`.
> Un rol que solo tenga "crear" no va a poder ajustar. Es deliberado.

### La transferencia entre sucursales

La ficha ofrece **Transferir stock entre sucursales**: mueve cantidad de una sucursal a otra,
generando una salida y una entrada ligadas. A diferencia de la venta, siempre bloquea si no alcanza
el stock.

> 🚧 **Todavía no:** tu negocio tiene una sola sucursal y **no existe forma de crear otra**. Esta
> función no se puede usar en la práctica. (ver H-02)

---

## Editar y eliminar

**Editar** un producto cambia sus datos de acá en adelante. **No toca las ventas ya registradas**:
cada venta congeló el precio y el costo del momento. Si subís el precio hoy, las ventas de ayer
siguen mostrando lo que cobraste ayer. Es a propósito, y es lo que hace que tus reportes históricos
no se deformen cada vez que cambiás una etiqueta.

**Eliminar** es una baja lógica: el producto desaparece del catálogo y de la pantalla de venta, pero
las ventas que lo incluyen siguen intactas, con su nombre y sus números. Si el producto tiene stock,
el sistema te pide confirmación antes.

**Si solo querés dejar de venderlo por un tiempo**, no lo elimines: desmarcá **Activo** en el
formulario. Sale de la pantalla de venta y sigue en tu catálogo.

---

## En qué orden conviene cargar todo

Si estás arrancando y tenés que cargar un catálogo entero:

1. **Creá primero las categorías**, si vas a usarlas. Asignar la categoría al cargar el producto es
   un segundo; volver después a categorizar 60 productos, no.
2. **Cargá los productos con precio y costo**, aunque el costo sea aproximado.
3. **Cargá el stock inicial** en el mismo formulario, mientras tenés el conteo a mano.
4. **Dejá las imágenes para el final.** Son las que más tiempo llevan y las que menos bloquean.

Si ya vas a comprarle a un proveedor esta semana, podés saltear el costo estimado y dejar que lo
fije la primera compra recibida — pero solo si esa compra va a entrar antes de que empieces a
vender, porque las ventas hechas mientras tanto quedan con costo cero.
