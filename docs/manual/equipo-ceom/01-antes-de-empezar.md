# 1. Antes de empezar

Este manual es para el equipo que opera CEOM: los que dan de alta negocios, definen planes y
registran instituciones. Se trabaja desde `/admin`.

**No hay roles internos.** Quien entra a `/admin` puede hacer todo lo que `/admin` permite: no hay
permisos parciales, ni un modo de solo lectura, ni separación entre quien mira y quien modifica.
Tenerlo presente al decidir a quién se le da acceso.

---

## Cómo se entra

Se usa **la misma pantalla de entrada que los negocios** (`/login`), con correo y contraseña. Lo que
cambia es a dónde te lleva después: si tu usuario tiene el rol de administrador de CEOM, entrás a
`/admin`; si no, a `/app`.

El control es de servidor. Si entrás a una dirección de `/admin` sin el rol, te devuelve a `/app`.

---

## El primer acceso: por qué hace falta un script

El primer usuario administrador **no se puede crear desde ninguna pantalla**. Es un problema de huevo
y gallina: dar de alta cualquier cosa en `/admin` exige estar ya autenticado como administrador de
CEOM, y la migración inicial siembra el *rol* pero nunca una persona.

Se resuelve con un script, una sola vez, desde el servidor:

```bash
pnpm seed:admin <correo>
```

Crea el usuario en Supabase Auth y su fila correspondiente, con el rol de administrador y dentro del
negocio reservado "CEOM Ops".

> 🚧 **Todavía no:** **no existe ninguna pantalla para sumar a otra persona al equipo.** No hay un
> ABM de administradores. Cada persona nueva requiere acceso al servidor y otra corrida del script.
> Tampoco hay forma de quitarle el acceso a alguien desde la interfaz. (ver H-14)

**Qué significa en la práctica.** El acceso a `/admin` se administra por fuera del producto. Conviene
llevar una lista aparte de quién tiene acceso, porque el sistema no la muestra en ningún lado.

---

## Qué tenés que tener listo antes del primer negocio

En este orden:

1. **Al menos un plan activo.** El formulario de alta de negocio ofrece planes como tarjetas; sin
   ninguno activo, no tiene qué mostrar. → [capítulo 2](02-planes.md)
2. **El nombre del negocio y el correo del dueño**, confirmados con el cliente. El correo es la
   identidad de esa persona y **no se puede corregir después desde ninguna pantalla**.
3. **La fecha de inicio de la suscripción.**

---

## Las tres cosas que conviene saber antes de tocar nada

**1. El alta de un negocio crea menos de lo que parece.** Crea el negocio, una sucursal llamada
"Principal", el usuario dueño y la invitación por correo. **No crea canales de venta, ni métodos de
pago, ni categorías.** El dueño se los va a encontrar vacíos. Está detallado en
[capítulo 3](03-alta-de-negocios.md), y es la causa de las primeras consultas a soporte.

**2. Hay cosas que solo puede hacer el dueño del negocio, y vos no.** Invitar colaboradores, cambiar
roles y transferir la titularidad **están reservados al dueño**, sin excepción para el equipo de
CEOM. Si un dueño pierde el acceso, no hay ninguna pantalla —tampoco acá— que permita recuperarlo.

> ⚠️ Esto es lo más importante de todo el manual de CEOM. Si te llega una consulta del tipo "el dueño
> se fue de la empresa" o "perdí la contraseña y soy el único dueño", **no hay solución por
> interfaz**: hay que intervenir la base de datos a mano. Conviene tener un procedimiento escrito
> para eso y saber quién está autorizado a ejecutarlo. (ver H-33, H-05)

**3. Tu acceso a los datos de un negocio queda registrado.** No pasás por el consentimiento que sí
necesita una institución —tu acceso está cubierto por los términos del servicio— pero cada consulta
que hacés sobre un negocio puntual queda trazada con tu identidad, el negocio y la fecha.
→ [capítulo 6](06-registro-de-accesos.md)

---

## Las cuatro secciones de `/admin`

Entrando a `/admin` caés directamente en **Negocios**. El menú lateral tiene cuatro entradas:

| Sección | Para qué | Capítulo |
|---|---|---|
| **Negocios** | Dar de alta, ver el estado de la plataforma, entrar a cada ficha | [3](03-alta-de-negocios.md) y [4](04-seguimiento-de-negocios.md) |
| **Planes** | El catálogo de planes | [2](02-planes.md) |
| **Instituciones** | Universidades, incubadoras y organizaciones, y su cartera | [5](05-instituciones.md) |
| **Registro de accesos** | Qué consultó el equipo, de qué negocio y cuándo | [6](06-registro-de-accesos.md) |
