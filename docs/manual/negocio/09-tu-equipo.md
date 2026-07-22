# 9. Tu equipo

Cuando dejás de trabajar solo, necesitás que otras personas entren al sistema sin que puedan hacer
todo lo que hacés vos. Este capítulo cubre cómo se arma eso: roles, permisos, invitaciones y qué
pasa el día que el dueño no está.

Todo lo de este capítulo **lo hace únicamente el dueño**. Es más literal de lo que parece: leé la
última sección antes de empezar.

---

## Cómo está organizado

Tres piezas, y conviene entenderlas antes de tocar nada:

| Pieza | Qué es |
|---|---|
| **Rol** | Un conjunto de permisos con nombre: "Vendedor", "Encargado de depósito". Cada negocio arma los suyos. |
| **Permisos** | Qué puede hacer un rol, marcado en una grilla de **10 secciones × 4 acciones**. |
| **Permisos especiales** | Cuatro excepciones que no entran en la grilla, porque no son "usar una pantalla" sino "saltarse una regla". |

**Los roles son tuyos.** No vienen roles predefinidos: el sistema trae solo dos que no podés editar
—**Dueño** y el rol del equipo de CEOM— y el resto los creás vos desde cero.

> 🚧 **Todavía no:** no hay plantillas ni roles sugeridos. La primera vez que entrás a crear un rol te
> encontrás con una grilla de 40 casillas vacías y ninguna pista de cuáles marcar. Hay una propuesta
> de roles por defecto en evaluación, pero **no existe en el sistema**. (ver H-35)

---

## La grilla de permisos

**Mi negocio › Roles** (`/app/mi-negocio/roles`). Elegí un rol o creá uno nuevo, y se abre la grilla.

**Las 10 secciones** son las áreas del sistema:

Productos · Stock · Ventas · Gastos · Bienes y deudas · Producción · Finanzas · Simulador ·
Reportes · Proveedores

**Las 4 acciones**, para cada sección:

| Acción | Qué habilita |
|---|---|
| **Ver** | Entrar y mirar. Sin esto, las otras tres no sirven. |
| **Crear** | Cargar registros nuevos. |
| **Editar** | Modificar lo ya cargado. |
| **Anular o corregir** | Ajustar, anular, corregir. **Es el permiso delicado.** |

### La acción que hay que pensar dos veces

**"Anular o corregir" es el permiso que conviene dar a la menor cantidad de gente posible.**

En CEOM nada se edita: las ventas, las compras y las producciones se corrigen con un ajuste que queda
registrado. Esa trazabilidad es lo que hace confiables tus reportes — y solo vale algo si corregir es
una atribución de pocos. Si todos pueden anular, el registro existe en la base de datos y no en la
práctica.

Ojo con dos casos donde esta acción no es lo que parece:

- **Ajustar el stock** de un producto exige "anular o corregir" sobre Stock, no "crear". Un
  encargado de depósito que solo tenga "crear" no va a poder cargar un recuento.
- **Eliminar una categoría** de producto exige "anular o corregir" sobre Productos.

---

## Armar tus roles desde cero

Sin plantillas, el método que menos errores produce es este.

**1. Escribí los puestos reales de tu negocio antes de tocar la pantalla.** No los que te gustaría
tener: los que existen. En un negocio chico suelen ser dos o tres: "el que atiende", "el que maneja
el depósito", "la que lleva las cuentas".

**2. Por cada puesto, respondé qué necesita *mirar* y qué necesita *cargar*.** Son dos listas
distintas y casi siempre la primera es más larga.

**3. Empezá marcando solo "Ver"** en las secciones que ese puesto necesita mirar. Guardá.

**4. Agregá "Crear"** solo donde esa persona carga cosas todos los días.

**5. Dejá "Editar" y "Anular o corregir" para el final**, y preguntate en cada casilla: si esta
persona se equivoca acá, ¿quién se entera?

**6. Probalo con una persona real** antes de invitar a cinco. Es mucho más fácil ajustar un rol que
descubrir en tres meses que media docena de gente tiene permisos de más.

### Un ejemplo trabajado: el rol "Vendedor"

Alguien que atiende y cobra necesita:

| Sección | Marcás | Por qué |
|---|---|---|
| Productos | Ver | Para encontrarlos al vender |
| Stock | Ver | Para saber si hay |
| Ventas | Ver + Crear | Registra ventas y cobros; **no** anula |
| Reportes | — | No necesita ver los márgenes del negocio |
| El resto | — | |

**Lo importante de este ejemplo es lo que no marca.** Sin "anular o corregir" en Ventas, un error de
carga lo tiene que escalar a alguien. Es incómodo a propósito: es exactamente lo que hace que el
historial de ventas sea confiable.

**Es mejor quedarse corto.** Un permiso que falta se nota enseguida —la persona te avisa— y se
agrega en diez segundos. Un permiso que sobra no lo nota nadie hasta que pasa algo.

> ⚠️ **El menú lateral no se adapta a los permisos.** Un colaborador ve todas las secciones, incluidas
> las que su rol no habilita, y recién al entrar recibe un error. No es un agujero de seguridad —el
> bloqueo real funciona— pero desconcierta. Avisale a tu equipo: **el menú muestra de más**. (ver
> H-08)

---

## Invitar colaboradores

**Mi negocio › Colaboradores** (`/app/mi-negocio/colaboradores`) → **Invitar colaborador**.

Pedís **correo**, **nombre completo** y **rol**. La persona recibe una invitación por correo y elige
su contraseña, igual que hiciste vos ([capítulo 1](01-primeros-pasos.md)).

**Creá el rol antes de invitar.** El selector solo muestra roles que ya existen, y no ofrece los dos
roles de sistema — está bien que no lo haga: son globales y no te pertenecen.

**El correo es la identidad de la persona y no se puede corregir después.** Un error de tipeo deja a
esa persona sin poder entrar nunca, y como tampoco hay recuperación de contraseña ([capítulo 1](01-primeros-pasos.md),
H-05), el único camino es invitarla de nuevo con el correo bien escrito. Revisalo antes de confirmar.

### Cambiar el rol, suspender, reactivar

Desde la tarjeta de cada persona. **Suspender** le corta el acceso sin borrarla: su historial —las
ventas que registró, los ajustes que hizo— queda intacto y atribuido a ella.

**Usá suspender, no borrar.** Es lo correcto cuando alguien se va: conservás la trazabilidad de lo
que hizo mientras estuvo.

**Tu propia tarjeta tiene los botones desactivados.** No podés cambiarte el rol ni suspenderte. Es a
propósito: evita que el negocio quede sin dueño.

---

## Eliminar un rol

Si el rol no tiene gente, se elimina con una confirmación simple.

Si tiene gente, el sistema **no te deja borrarlo sin más**: abre una ventana que lista a cada persona
con ese rol y te obliga a elegirle un rol nuevo a cada una. Recién cuando están todas reubicadas, se
elimina.

Es un buen ejemplo de cómo debería comportarse el sistema cuando algo está en uso — y vale
mencionarlo porque **eliminar una categoría de producto no hace nada de esto** y deja los productos
huérfanos ([capítulo 2](02-catalogo.md), H-29).

---

## Los cuatro permisos especiales

**Mi negocio › Permisos especiales** (`/app/mi-negocio/capacidades`). No están en la grilla porque no
habilitan una pantalla: habilitan **saltarse una regla**.

| Permiso | Qué desbloquea |
|---|---|
| **Vender sin stock** | Registrar una venta aunque no alcance el stock. |
| **Gestionar eventos** | Abrir, cerrar y reabrir eventos ([capítulo 3](03-vender-todos-los-dias.md)). |
| **Importar histórico** | Cargar ventas viejas desde un archivo. |
| **Producir sin stock de insumo** | Registrar una producción aunque falte materia prima ([capítulo 7](07-produccion.md)). |

Se otorgan de dos maneras:

- **Por rol** — todos los que tengan ese rol lo reciben.
- **Como excepción a una persona** — solo a ella. Anula lo que diga su rol.

**Cuál usar.** Si es parte del puesto —todos tus vendedores necesitan vender sin stock—, va por rol.
Si es puntual —a una sola persona, por una situación concreta—, va como excepción. La excepción es
más fácil de olvidar: revisalas de vez en cuando.

**El dueño los tiene todos, siempre**, y no aparece en estas listas: no hay nada que otorgarle.

---

## Pasar el negocio a otra persona

**Mi negocio › Colaboradores › Transferir**. Elegís a un colaborador activo, y elegís **qué rol
quedás vos** — es obligatorio, no hay un valor por defecto.

Al confirmar, esa persona pasa a ser el dueño y vos pasás a ser un colaborador con el rol que
elegiste. **Solo puede haber un dueño**, y la operación no se deshace: para volver atrás, el nuevo
dueño tiene que transferirte a vos.

> 🚧 **Todavía no:** no se puede *agregar* un segundo dueño, solo *ceder* la condición. Aunque tu plan
> diga "más de un dueño", no existe la acción. (ver H-17)

---

## Lo que hay que saber antes de que sea tarde

Esta sección es la más importante del capítulo.

### Solo el dueño puede administrar el equipo. Nadie más. Nunca.

Invitar, cambiar roles, suspender, crear roles, dar permisos especiales y transferir la titularidad
**están reservados al dueño y no se pueden delegar**. No es una configuración: no existe ninguna
casilla en la grilla que habilite estas acciones, porque la gestión del equipo no es una de las 10
secciones.

Consecuencia directa: **por más confianza que le tengas a alguien, no podés darle la capacidad de
sumar gente.** Toda alta de un colaborador pasa por vos.

### Si el dueño no está disponible, el negocio queda trabado

Es el escenario que hay que prevenir, porque hoy no tiene salida.

Si el dueño pierde su contraseña, se va, o por cualquier razón deja de poder entrar:

- **Ningún colaborador puede reemplazarlo.** Ni el más antiguo, ni con todos los permisos marcados:
  la transferencia de titularidad la tiene que iniciar el dueño saliente.
- **El equipo de CEOM tampoco puede.** Puede cambiarte el plan y el estado de la suscripción, pero
  **no puede designar un dueño nuevo ni invitar colaboradores** a tu negocio. Esas funciones exigen
  ser el dueño, y el equipo de CEOM no lo es.
- **No hay recuperación de contraseña** ([capítulo 1](01-primeros-pasos.md), H-05).

En la práctica: el negocio queda operando con los colaboradores que ya tenía —que siguen entrando
normalmente— pero **sin ninguna forma de sumar gente, cambiar un rol ni recuperar la titularidad**.
La única salida es que CEOM intervenga la base de datos a mano. (ver H-33)

### Qué hacer al respecto, hoy

1. **Cuidá el acceso del dueño como cuidás la llave del local.** Guardá la contraseña donde no se
   pierda y en un lugar al que llegue más de una persona de confianza.
2. **Usá un correo que sobreviva a la persona.** Si el dueño usa su correo personal y mañana no está,
   ese buzón se va con él. Un correo del negocio —`hola@tunegocio.com`— al que pueda acceder más de
   una persona es mucho más seguro.
3. **Si te vas de vacaciones largas o vas a estar sin acceso**, dejá creados de antemano los roles y
   los colaboradores que puedan hacer falta. Nadie los va a poder crear en tu ausencia.
4. **Si vas a dejar el negocio, transferí la titularidad antes de irte.** No después.

> ⚠️ **Un detalle más:** si tu suscripción vence, la gestión del equipo se bloquea junto con todo lo
> demás. Durante el período de solo lectura no vas a poder invitar, cambiar roles ni transferir la
> titularidad hasta regularizar el pago ([capítulo 11](11-tu-plan.md)). Si tenías pensado transferir
> el negocio, hacelo con la suscripción al día. (ver H-33)
