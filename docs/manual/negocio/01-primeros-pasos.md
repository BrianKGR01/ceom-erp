# 1. Primeros pasos: de la invitación a tu primera venta

Este capítulo te lleva desde el correo con el que entrás por primera vez hasta tener una venta
registrada en el sistema. Son siete pasos y se hace de una sentada, en unos quince minutos.

Al terminar vas a tener: tu negocio configurado, un rubro elegido, un producto cargado con su precio,
un canal de venta creado y una venta registrada que ya aparece en tus reportes.

**Leelo en orden.** Cada paso necesita que el anterior esté hecho. No es una recomendación de
estilo: si te saltás un paso, el sistema te frena más adelante y no siempre te explica por qué.

---

## Antes de empezar: cómo nace tu negocio en CEOM

Tu negocio no lo creás vos. **Lo da de alta el equipo de CEOM.** Ellos cargan el nombre de tu
negocio, el plan que contrataste, y tu nombre y correo como dueño. Recién ahí el sistema te manda la
invitación.

Esto explica dos cosas que te van a llamar la atención:

- No hay ninguna página para registrarte por tu cuenta. Si llegaste a la pantalla de entrada sin
  invitación, no vas a poder crear una cuenta: hay que pedirla a CEOM.
- Cuando entres, el nombre de tu negocio ya va a estar cargado. No lo escribiste vos: lo escribió
  quien te dio de alta. Lo podés corregir en el paso 2.

> 🚧 **Todavía no:** en la pantalla de entrada vas a ver dos enlaces, **¿Olvidaste tu contraseña?** y
> **Crear cuenta gratis**. Ninguno de los dos hace nada todavía — no tienen un flujo detrás. Si
> perdés la contraseña, hay que escribirle a CEOM. (ver H-05)

> 🚧 **Todavía no:** la pantalla de entrada también anuncia *"Tuki IA te asesora 24/7 con tus
> datos"*. Ese asistente no existe en el sistema. (ver H-06)

---

## Paso 1 — Entrar por primera vez

1. Buscá en tu correo el mensaje de invitación de CEOM. Puede haber caído en spam.
2. Abrí el enlace del correo. Te va a pedir que elijas una contraseña.
3. Elegida la contraseña, entrás directo a tu negocio.

De acá en adelante entrás siempre con tu correo y esa contraseña.

**Por qué el correo importa tanto.** Tu correo es tu identidad en el sistema: es con lo que entrás y
es a donde llegan las invitaciones. Si el correo que cargó CEOM tiene un error de tipeo, no vas a
recibir nada y no hay forma de arreglarlo desde adentro. Si la invitación no te llega en unos
minutos, revisá spam y después escribile a CEOM para que confirme el correo cargado.

> 🔎 **Nota interna:** la invitación la emite Supabase Auth al ejecutarse `crearTenant`. Que la
> acción termine sin error no prueba que el correo haya salido; se verifica con `invited_at` sobre
> el usuario de Auth.

---

## Paso 2 — Contanos de tu negocio

Apenas entrás por primera vez, el sistema te lleva a un asistente de dos pasos. **No lo podés
saltear**: mientras no lo termines, cada vez que entres vas a volver a caer acá.

La primera pantalla se llama **Contanos de tu negocio** y pide:

| Campo | Obligatorio | Para qué sirve |
|---|---|---|
| **Nombre de tu negocio** | Sí | Es el que ves en el saludo de la pantalla de inicio y el que ve una institución si algún día compartís datos. Viene precargado por CEOM: revisalo. |
| **Ciudad** | No | Dato de referencia de tu negocio. |
| **Moneda principal** | Sí | **Definí esto bien ahora.** Todos los precios, costos, gastos y reportes se expresan en esta moneda. El sistema no convierte monedas ni te va a avisar si después cambiás de idea con datos ya cargados. |
| **Logo del negocio** | No | PNG o JPG, cuadrado, mínimo 512×512 píxeles, máximo 2 MB. |
| **¿Dónde vendés hoy?** | No | Cuatro opciones para marcar: Redes sociales, Feria / pop-up, Local físico, Boca a boca. |

Completá y tocá **Guardar y continuar**.

> ⚠️ **Ojo con "¿Dónde vendés hoy?".** Marcar acá "Local físico" o "Feria" **no crea tus canales de
> venta**. Es solo un dato descriptivo de tu negocio: queda guardado y el equipo de CEOM lo ve en la
> ficha de tu negocio, pero no tiene ningún efecto sobre las ventas. Los canales con los que después
> vas a registrar ventas se crean aparte, en el paso 6. Es el punto donde más gente se traba, porque
> parece que ya quedó resuelto y no es así. (ver H-01)

> ⚠️ **Ojo con el logo.** Si cargás un logo y después tocás la cruz para sacarlo y guardás, el logo
> **no se borra**: la imagen anterior sigue siendo la de tu negocio. Para cambiarlo, subí uno nuevo
> encima. (ver H-04)

---

## Paso 3 — Elegir tu rubro

La segunda pantalla del asistente te pregunta a qué se dedica tu negocio. Hay tres opciones:

| Opción | Elegila si… |
|---|---|
| **Alimentos y bebidas por lotes** | Producís con receta, en tandas: panadería, repostería, bebidas, conservas. |
| **Comercio minorista y distribución** | Comprás producto terminado y lo revendés: tienda, distribuidora, kiosco. |
| **Modo Básico** | Todavía no lo tenés claro, o vendés de varias formas distintas. |

**Esta elección no se puede deshacer.** El sistema te lo avisa antes de confirmar, y es literal: no
hay ninguna pantalla, ni para vos ni para CEOM, que permita cambiar el rubro después. Lo único que
podés hacer es elegir **Modo Básico** ahora y decidir el rubro más adelante — pero una vez que
elijas un rubro concreto, quedó elegido para siempre.

**Qué cambia según lo que elijas.** Elegir *Alimentos y bebidas por lotes* habilita el circuito de
producción: insumos, recetas y registro de lotes producidos, con el costo de cada lote calculado a
partir de lo que consumió. Los otros dos modos no lo usan.

**Qué te conviene.** Si tenés dudas, elegí **Modo Básico**. Vas a poder vender, comprar, registrar
gastos y ver tus reportes exactamente igual; lo único que no vas a tener es el circuito de
producción. Y te queda abierta la puerta de elegir el rubro cuando lo tengas claro. Elegir a las
apuradas un rubro que después no era el tuyo no tiene arreglo.

Tocá **Confirmar y empezar** y después **Ir a mi panel**.

> ⚠️ **Ojo:** el menú lateral muestra la sección **Producción** a todos los negocios, sin importar
> el rubro que hayan elegido. Si elegiste comercio minorista o Modo Básico, esa sección te va a
> aparecer igual y vas a poder entrar. No está mal que la veas, pero no forma parte de tu
> circuito. (ver H-08)

> ⚠️ **Ojo:** una vez que elegiste un rubro concreto, ya no vas a poder volver a la pantalla del
> paso 2 para corregir el nombre, la ciudad, la moneda o el logo. Si volvés a **Mi negocio ›
> Negocio**, el asistente salta directo al rubro. Revisá bien esos datos **antes** de confirmar el
> rubro. (ver H-03)

---

## Paso 4 — La pantalla de inicio

Ya estás adentro. La pantalla de inicio (`/app`) te muestra una tarjeta de bienvenida con una sola
tarea: **Cargá tu primer producto**.

Esa tarjeta desaparece sola en cuanto cargues tu primer producto. También la podés cerrar con la
cruz, pero no hace falta.

Cuando la tarjeta se apaga, en su lugar aparece el panel de tu negocio: resultado del período, flujo
de caja, productos más vendidos, gastos por categoría. Ahora está todo en cero, y está bien: no
cargaste nada todavía.

> ⚠️ **Ojo:** la tarjeta dice que cargar un producto es *"lo único que necesitás para empezar a
> vender"*. No es exacto: toda venta necesita además un canal de venta, que es el paso 6 de este
> capítulo. No te va a dejar trabado —el canal se puede crear desde la misma pantalla de venta— pero
> conviene saberlo antes y no descubrirlo con un cliente esperando. (ver H-01)

### ¿Y las sucursales?

Puede que hayas escuchado que en un sistema así hay que configurar las sucursales antes de vender.
Acá no: **tu negocio ya viene con una sucursal creada, llamada "Principal"**, desde el momento en
que CEOM te dio de alta. No tenés que hacer nada.

Por eso, cuando un formulario te pida una sucursal, va a haber una sola y ya elegida. El stock, los
bienes y las ventas se registran contra ella.

> 🚧 **Todavía no:** no existe ninguna pantalla para crear una segunda sucursal, ni para renombrar
> la que tenés. Si tu negocio tiene dos locales, hoy el sistema los trata como uno solo. Varias
> funciones que ves en la interfaz — **Transferir stock entre sucursales**, **Transferir bien** —
> asumen que hay más de una y en la práctica no vas a poder usarlas. (ver H-02)

---

## Paso 5 — Cargar tu primer producto

Desde la tarjeta de bienvenida tocá **Cargar producto**, o andá a **Catálogo** (`/app/productos`) y
tocá el botón de producto nuevo.

Lo obligatorio es poco:

| Campo | Obligatorio | Qué conviene saber |
|---|---|---|
| **Nombre del producto** | Sí | |
| **Se vende por** | Sí | Unidad, kg, g, l, ml o docena. Define en qué se cuenta el stock y en qué se venden las cantidades. |
| **Precio de venta** | Sí | Tiene que ser mayor a 0. |
| **Categoría** | No | Sirve para agrupar y filtrar. La podés crear en el momento. |
| **Costo** | No | Lo que te cuesta a vos ese producto. |
| **Imagen** | No | PNG o JPG, hasta 5 MB. Se sube al guardar la foto, no al guardar el formulario. |
| **Stock inicial** | No | Cuántas unidades tenés ahora mismo. |
| **Vida útil en días** | No | Para productos que vencen. Dejalo vacío si no vence. |

**Cargá el costo aunque sea opcional.** El sistema te deja guardar un producto sin costo y vender
normalmente. Pero el costo es lo que hace que el resto del sistema sirva para algo: sin él, el
margen de ese producto no se puede calcular, no aparece en el ranking por margen, queda afuera del
promedio del comparador de productos y el estado de resultados te va a mostrar ingresos sin el
costo correspondiente. Un número aproximado es muchísimo mejor que ningún número — y lo podés
corregir después.

**Cargá el stock inicial si ya tenés mercadería.** Si lo dejás vacío, el producto arranca en cero.
Podés vender igual (el sistema no te frena por stock en esta configuración), pero el control de
existencias va a arrancar desfasado de la realidad y no hay forma de "reconstruirlo" hacia atrás
salvo con un ajuste manual.

Guardá. La tarjeta de bienvenida de la pantalla de inicio ya no va a aparecer más.

---

## Paso 6 — Crear tu canal de venta

**Este es el paso que falta en la guía de la pantalla de inicio.** Toda venta necesita un canal, y tu
negocio arranca sin ninguno. Podés dejarlo para el momento de vender —se crea ahí mismo— pero hacerlo
ahora te evita resolverlo con un cliente enfrente.

Un **canal de venta** es la vía por la que le llega el producto a tu cliente: tu local, tus redes
sociales, una feria, un revendedor. El sistema te obliga a elegir uno en cada venta, porque después
te deja comparar cuánto vendés y cuánto margen dejás por cada vía. Es una de las preguntas que mejor
responde el sistema, y solo la puede responder si desde el principio cada venta queda atribuida a un
canal.

Andá a **Ventas › Canales de venta** (`/app/ventas/canales`) y creá al menos uno.

Cada canal tiene:

- **Nombre** — como lo llamás vos: "Local", "Instagram", "Feria del domingo".
- **Comisión por defecto (%)** — opcional. Si ese canal se lleva una parte de cada venta (un
  revendedor, una plataforma), poné el porcentaje acá y el sistema lo va a proponer solo en las
  ventas de ese canal. Si vendés directo, dejalo en cero.

**Empezá con pocos.** Dos o tres canales que representen de verdad cómo vendés valen más que ocho
que después no vas a poder comparar. Siempre podés agregar más.

> ⚠️ **Ojo:** también podés crear un canal sobre la marcha, desde la pantalla de venta, con el enlace
> chico **+ Nuevo canal** que está debajo de "Canal de venta". Funciona, pero es fácil no verlo: si
> llegás a la pantalla de venta sin canales creados, no vas a ver ningún mensaje que te explique que
> falta ese paso, solo un espacio vacío donde deberían estar los canales. (ver H-01)

### Los métodos de pago

Mismo asunto, un escalón menos urgente. Un **método de pago** es cómo te pagan: efectivo,
transferencia, QR, tarjeta. Se crean en **Ventas › Métodos de pago** (`/app/ventas/metodos-pago`) y
también se pueden crear desde la pantalla de venta.

No son obligatorios para registrar una venta: podés vender sin anotar el pago, y esa venta queda
como **pendiente de cobro**. Pero si querés que el flujo de caja refleje la plata que entró de
verdad, necesitás al menos uno.

---

## Paso 7 — Tu primera venta

Andá a **Ventas › Vender** (`/app/ventas`).

1. **Elegí los productos.** Buscalos por nombre o filtrá por categoría, y tocá cada uno para
   agregarlo al carrito. Ajustá las cantidades. El total se recalcula solo.
2. **Elegí el cliente** (opcional). Podés dejarlo sin cliente, elegir uno existente o crear uno
   nuevo ahí mismo con nombre y teléfono. Sin cliente la venta se registra igual; con cliente vas a
   poder ver después qué le vendiste a quién.
3. **Elegí el canal de venta.** Obligatorio. Acá aparecen los canales del paso 6.
4. **Registrá el pago** (opcional). Elegí el método y el monto. Si cobrás todo, poné el total; si es
   una seña, poné lo que te pagaron; si no cobraste nada, salteá este paso.
5. Confirmá la venta.

**Qué pasó cuando confirmaste.** Vale la pena entenderlo, porque explica cómo funciona el sistema
entero:

- Se registró la venta con el **precio y el costo del momento congelados**. Si mañana subís el
  precio del producto, esta venta va a seguir mostrando lo que cobraste hoy. Tus reportes históricos
  no se alteran cuando cambiás precios: es a propósito.
- Se **descontó el stock** de los productos vendidos.
- La venta quedó con un **estado de cobro**: pagada, parcial o pendiente, según lo que hayas
  registrado en el punto 4.
- Si el canal tenía comisión configurada, **se calculó y se guardó el monto de la comisión junto a la
  venta**.

> ⚠️ **Ojo con la comisión.** El monto se calcula y se guarda, pero hasta ahí llega: no se convierte
> en un gasto, no aparece en ninguna pantalla y no se descuenta de tu resultado. Si cargaste una
> comisión en el canal esperando que se reflejara en tus números, hoy no lo hace. (ver H-24)

**Si te equivocaste**, no busques cómo editar la venta: no se puede, y es deliberado. Se corrige
desde la ficha de la venta con un **ajuste** (corrección, devolución, descuento posterior o
anulación total), que pide un motivo obligatorio y queda registrado al lado de la venta original.
Así siempre se puede reconstruir qué pasó y quién lo corrigió, en vez de que un número cambie sin
dejar rastro.

---

## Ya está. ¿Y ahora?

Andá a **Inicio** (`/app`). El panel ya no está en cero: tu venta aparece en el resultado del
período, en el flujo de caja si registraste el pago, y en productos más vendidos.

Con esto ya podés operar todos los días: cargar productos, vender, cobrar.

### El orden de lo que viene

Podés seguir por donde te sirva, pero hay dependencias reales. Este es el orden que menos trabajo
duplicado genera:

1. **Terminá de cargar tu catálogo** — el resto del sistema se apoya en los productos.
   → capítulo 2
2. **Cargá tus gastos fijos** — sin gastos, el resultado que ves está inflado: muestra el margen de
   tus productos, no la ganancia de tu negocio. Es también lo que necesita el punto de equilibrio
   para dar un número real.
   → capítulo 5
3. **Cargá tus proveedores y compras** — así el costo de tus productos deja de ser una estimación
   tuya y pasa a salir de lo que pagaste de verdad.
   → capítulo 4
4. **Sumá a tu equipo** — si no vas a trabajar solo. Definí los roles antes de invitar gente: es más
   fácil que corregir permisos después.
   → capítulo 9
5. **Cargá tus bienes y deudas** — máquinas, equipos, créditos. Es lo que le falta al sistema para
   mostrarte cuánto vale tu negocio.
   → capítulo 6
6. **Si tu rubro es alimentos y bebidas**, armá tus insumos y recetas.
   → capítulo 7
7. **Recién con todo eso cargado**, el simulador de precios y el punto de equilibrio te van a dar
   números en los que puedas confiar.
   → capítulo 8

---

## Resumen del capítulo

| Paso | Dónde | ¿Se puede saltear? |
|---|---|---|
| 1. Entrar con la invitación | correo → `/login` | No |
| 2. Contanos de tu negocio | `/app/onboarding` | No |
| 3. Elegir tu rubro | `/app/onboarding` | No — y **no se puede cambiar después** |
| 4. Pantalla de inicio | `/app` | — |
| 5. Cargar tu primer producto | `/app/productos/nuevo` | No, sin producto no hay venta |
| 6. Crear un canal de venta | `/app/ventas/canales` | Se puede postergar: si llegás a vender sin canales, lo creás ahí mismo |
| 7. Registrar la venta | `/app/ventas` | — |
