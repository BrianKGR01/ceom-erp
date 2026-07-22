# 2. Planes

El catálogo de planes que se le pueden asignar a un negocio. Va primero porque **el alta de un
negocio necesita al menos un plan activo** para poder ofrecer algo.

**Planes** (`/admin/planes`). Lista de tarjetas, con un único diálogo para crear y editar.

---

## Los campos de un plan

| Campo | Qué controla |
|---|---|
| **Nombre** | |
| **Precio mensual** y **moneda** | BOB o USD. Es informativo: **el sistema no cobra ni factura nada.** |
| **Incluye sucursales** | Si el negocio puede operar con más de un local. |
| **Permite más de un dueño** | |
| **Permite bajar de plan por autogestión** | |
| **Duración de la invitación (días)** | Por defecto 7. |
| **Duración de la etapa de solo lectura (días)** | Por defecto 3. Es el período de gracia tras el vencimiento. **Este es el campo que más conviene entender.** |
| **Qué información se puede compartir** | Cuáles de los tres tipos —ventas y finanzas, producción, insumos y stock— puede dar el negocio a una institución. |

---

## Cuáles de estos campos hacen algo de verdad

Es la parte que hay que tener clara antes de prometerle algo a un cliente.

| Campo | ¿Tiene efecto? |
|---|---|
| **Qué información se puede compartir** | ✅ **Sí, y es real.** Se valida del lado del servidor: si el negocio intenta compartir un tipo que su plan no incluye, se rechaza. |
| **Duración de la etapa de solo lectura** | ✅ **Sí.** Define cuántos días puede seguir viendo sus datos un negocio con la suscripción vencida antes de quedar bloqueado. |
| **Incluye sucursales** | ❌ No hace nada. No existe ninguna forma de crear una segunda sucursal en todo el producto (H-02). |
| **Permite más de un dueño** | ❌ No hace nada. No existe la acción de agregar un dueño; solo la de transferir la titularidad (H-17). |
| **Permite bajar de plan por autogestión** | ❌ No hace nada. No hay pantalla de cambio de plan en `/app`: **todo cambio de plan lo hacés vos desde acá**, tenga el plan ese atributo o no. |
| **Precio mensual** | ❌ Informativo. No hay cobro, ni facturación, ni vencimiento automático. |

> 🚧 Tres de los atributos se le muestran al dueño en su pantalla "Mi Plan" como características de lo
> que contrató. **No prometas esas tres en una venta**: hoy no se pueden cumplir. (ver H-36)

> 🚧 **No hay cobro automático ni vencimiento automático.** Nada marca una suscripción como vencida
> por sí solo: el estado lo cambiás a mano ([capítulo 4](04-seguimiento-de-negocios.md)). El precio
> del plan no dispara ningún proceso, y tampoco hay aviso al cliente. (ver H-45)

---

## Crear y editar

Mismo diálogo para las dos cosas. Sin restricciones especiales: se puede editar un plan que ya tienen
negocios asignados.

**Editar un plan afecta a todos los negocios que lo tengan**, de inmediato. Es lo esperable de un
catálogo compartido, pero conviene tenerlo presente: cambiarle la duración de la etapa de solo
lectura, o quitarle un tipo de información compartible, se aplica a todos a la vez. Si querés cambiar
las condiciones de un solo cliente, **creá un plan nuevo y asignáselo**; no edites el que comparte con
otros.

---

## Desactivar y reactivar

Desactivar **no elimina** el plan ni saca de él a los negocios que lo tienen. Solo lo quita de las
opciones ofrecidas al crear un negocio o al cambiar de plan.

Un negocio puede seguir operando en un plan desactivado por tiempo indefinido, y su ficha lo muestra
con normalidad. Es el mecanismo para discontinuar un plan sin migrar a nadie a la fuerza.

**Al cambiar de plan a un negocio que está en uno desactivado**, el selector muestra los planes
activos **más el suyo actual**, para que nunca quede vacío.

---

## Cómo armar el catálogo

**Empezá con pocos planes y estables.** Cada plan es una promesa que después hay que sostener, y hoy
solo dos de sus siete atributos hacen algo. Un catálogo razonable para arrancar son dos o tres
planes que se diferencien por **qué información se puede compartir** y por **la duración de la
gracia**, que es lo único que el sistema aplica de verdad.

**La duración de la gracia merece pensarse.** Es lo que separa "te recordamos que venciste" de "no
podés entrar". Tres días es el valor por defecto y es corto para un cliente que paga por
transferencia. Considerá algo más holgado, sobre todo mientras no exista aviso automático de
vencimiento.
