# 3. Alta de negocios

Dar de alta un negocio es **la única puerta de entrada de un cliente a CEOM**: no hay registro por
autoservicio. Todo negocio que exista pasó por esta pantalla.

**Negocios › + Nuevo negocio** (`/admin/tenants/nuevo`). Es una página dedicada, no un diálogo.

---

## El formulario

**Datos del negocio**

| Campo | Notas |
|---|---|
| **Nombre del negocio** | El dueño lo puede corregir después, pero solo hasta que elija su rubro (ver más abajo). |
| **Moneda principal** | Definila bien: el sistema no convierte monedas y el dueño la va a poder cambiar solo en una ventana muy corta. |

**Plan**

Tarjetas seleccionables con los planes activos, mostrando nombre y precio. Si no elegís ninguno, se
asigna el plan básico por defecto.

**Suscripción**

| Campo | Notas |
|---|---|
| **Fecha de inicio de suscripción** | |

**Dueño inicial**

| Campo | Notas |
|---|---|
| **Nombre completo** | |
| **Correo** | **Revisalo dos veces.** Ver la advertencia de abajo. |

---

## ⚠️ El correo del dueño es irreversible

Es el punto más frágil de todo el proceso, y conviene tratarlo con el cuidado que merece.

El correo que cargues acá **es la identidad de esa persona en el sistema**: es a donde va la
invitación y con lo que va a entrar siempre. Y:

- **No hay ninguna pantalla para corregirlo**, ni del lado del dueño ni del tuyo.
- **No hay recuperación de contraseña** (H-05).
- **Ninguna otra persona puede asumir la titularidad** si el dueño no puede entrar — tampoco vos
  (H-33).

Un error de tipeo en este campo produce un negocio con un dueño que **nunca va a poder entrar**, y
cuya única solución es crear el negocio de nuevo o intervenir la base de datos.

**Procedimiento recomendado:** pedí el correo por escrito, copialo y pegalo, y confirmá con el
cliente que le llegó la invitación **antes** de dar el alta por cerrada.

---

## Qué crea el alta, exactamente

Al confirmar, en una sola operación:

| Se crea | Detalle |
|---|---|
| **El negocio** | Con su nombre, moneda, plan y fecha de suscripción. |
| **Una sucursal** | Llamada "Principal", marcada como principal. **Es la única que va a tener nunca** (H-02). |
| **El usuario dueño** | Con el rol Dueño. |
| **La invitación por correo** | Vía Supabase Auth. El dueño elige su contraseña al abrirla. |

---

## ⚠️ Y qué NO crea

Esto es lo que más consultas de soporte genera en los primeros días, así que conviene saberlo de
memoria:

| No se crea | Consecuencia para el dueño |
|---|---|
| **Ningún canal de venta** | Toda venta necesita uno. Lo puede crear desde la propia pantalla de venta con "+ Nuevo canal", pero **la guía de bienvenida le dice que con cargar un producto alcanza**, lo cual es falso. (H-01) |
| **Ningún método de pago** | No puede registrar el cobro de una venta hasta crear uno. |
| **Ninguna categoría de producto** | Opcional, no bloquea. |
| **Ninguna categoría de gasto** | **La categoría es obligatoria en todo gasto**: no puede cargar ni uno hasta crear una. (H-32) |

**Qué hacer con esto.** Hasta que se corrija, conviene avisarle al cliente en el traspaso: *"cuando
entres, lo primero es crear un canal de venta y una categoría de gasto; el sistema no los trae"*.
Son dos minutos si se lo decís, y una llamada a soporte si no.

> 🔎 **Nota interna:** el negocio de prueba que se puebla con `pnpm seed:demo` **sí** trae canales,
> métodos de pago y categorías. Si probás el producto contra ese negocio no vas a ver ninguno de
> estos huecos. Para probar el recorrido real hay que dar de alta un negocio nuevo y entrar con él.

---

## Verificar que la invitación salió

Que el alta termine sin error **no prueba que el correo haya salido**. Son dos sistemas distintos:
la fila del negocio se crea en la base y la invitación la emite Supabase Auth.

La forma de confirmarlo es preguntarle al cliente. Si no le llegó:

1. Que revise spam.
2. Verificá el correo cargado en la ficha del negocio.
3. Si el correo está mal, **no hay forma de corregirlo**: hay que dar de alta el negocio de nuevo con
   el correo correcto, y descartar el anterior.

---

## Después del alta

El negocio aparece en el listado. Del lado del dueño, el recorrido es:

1. Abre la invitación y elige contraseña.
2. Cae en un asistente obligatorio de dos pasos: datos del negocio y **elección de rubro**.
3. **La elección de rubro es irreversible**, y a partir de ahí ya no puede volver a la pantalla de
   datos del negocio: el nombre, la ciudad, la moneda y el logo quedan fijos (H-03).

> ⚠️ Si el cliente te avisa que el nombre o la moneda quedaron mal, **decíle que lo corrija antes de
> elegir el rubro**. Después de ese paso, no hay forma de arreglarlo ni desde `/app` ni desde
> `/admin`.
