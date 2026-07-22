# 11. Tu plan

Un capítulo corto, sobre la suscripción: qué incluye tu plan, qué pasa si se vence y a quién
escribirle.

**Mi negocio › Mi Plan** (`/app/mi-negocio/plan`). Es una pantalla de solo lectura: muestra tu
situación, no se cambia nada desde ahí.

---

## Qué muestra

**Arriba:** el nombre de tu plan y su precio mensual, más dos indicadores de estado.

**Debajo:** qué incluye tu plan.

| Atributo | Qué significa |
|---|---|
| **Múltiples sucursales** | Si tu negocio puede operar con más de un local. |
| **Más de un dueño** | Si puede haber más de una persona con la titularidad. |
| **Bajar de plan por tu cuenta** | Si podés cambiar a un plan menor sin pasar por CEOM. |
| **Qué información podés compartir** | Cuáles de los tres tipos podés dar a una institución ([capítulo 10](10-compartir-datos.md)). |

**Este último es el único de los cuatro que hoy tiene efecto real.** Si tu plan no incluye un tipo de
información, el sistema te lo bloquea de verdad al generar un código.

> 🚧 **Los otros tres atributos no hacen nada todavía.** No existe forma de crear una segunda
> sucursal (H-02), no existe la acción de agregar un segundo dueño (H-17), y no hay ninguna pantalla
> para cambiar de plan por tu cuenta — el cambio de plan lo hace siempre CEOM, tenga tu plan ese
> atributo o no. Están en la lista porque describen el plan que contrataste, no lo que hoy podés
> hacer. (ver H-36)

---

## Los dos estados, que no son lo mismo

Vas a ver dos indicadores y conviene no confundirlos.

**Estado de la suscripción** — la situación comercial, la que administra CEOM:

| Estado | Qué es |
|---|---|
| **Activa** | Al día. |
| **Vencida** | Pasó la fecha de pago. |
| **Pausada** | Suspendida de común acuerdo. |

**Estado de acceso** — qué podés hacer hoy dentro del sistema. **No se elige: se deduce** del estado
de la suscripción y de la fecha de próximo pago.

| Estado | Qué podés hacer |
|---|---|
| **Activo** | Todo. |
| **Solo lectura** | Ver tus datos. **No podés crear ni editar nada.** |
| **Bloqueado** | Nada. Ni siquiera ver. |

### Cómo se pasa de uno a otro

- Suscripción **activa** → acceso **activo**.
- Suscripción **vencida** → **solo lectura** durante un período de gracia que define tu plan (3 días
  por defecto), y **bloqueado** después.
- Suscripción **pausada** → **bloqueado** directamente, sin gracia.

> ⚠️ Si la suscripción figura como vencida **sin una fecha de próximo pago cargada**, el acceso pasa a
> bloqueado de inmediato, sin período de gracia. Es un detalle de cómo se calcula la gracia —se mide
> desde esa fecha—, no un castigo. Si te pasa y creés que corresponde la gracia, escribile a CEOM:
> es un dato que se corrige de su lado. (ver H-41)

---

## Qué ves cuando algo no está al día

Un cartel arriba de todas las pantallas:

- **Ámbar** — tu suscripción venció; podés ver tus datos pero no crear ni editar. Incluye la fecha de
  próximo pago.
- **Rojo** — acceso bloqueado; hay que contactar a soporte.

**El cartel solo informa.** El bloqueo real lo aplica el sistema por detrás desde antes: no es que el
cartel te impida hacer cosas, es que te explica por qué no podés.

### Qué se bloquea en "solo lectura"

Todo lo que sea crear o modificar: registrar una venta, cargar un producto, anotar un gasto, recibir
una compra. **También la gestión de tu equipo**: no vas a poder invitar a nadie, cambiar un rol ni
transferir la titularidad hasta regularizar ([capítulo 9](09-tu-equipo.md)).

Lo que sí podés: **ver todo y exportar nada** — así que si necesitás llevarte tus números, tenelos a
mano antes de que llegue el bloqueo ([capítulo 8](08-entender-el-negocio.md), H-20).

**Tus datos no se borran.** Solo dejan de ser accesibles hasta que la suscripción se regularice.

---

## Cambiar de plan

**No hay ninguna pantalla para hacerlo.** El cambio de plan —hacia arriba o hacia abajo— lo hace el
equipo de CEOM. Escribiles.

Es así incluso si tu plan dice que podés bajar de plan por tu cuenta: ese atributo no tiene todavía
una pantalla detrás.

---

## Cuándo escribirle a CEOM

Concentrado acá porque son varias las cosas que solo puede resolver el equipo:

| Situación | Por qué solo ellos |
|---|---|
| Cambiar de plan | No hay pantalla para autogestionarlo. |
| Regularizar un pago vencido | El estado de la suscripción lo administran ellos. |
| Perdiste la contraseña | No hay recuperación automática ([capítulo 1](01-primeros-pasos.md), H-05). |
| El dueño no está disponible | Ninguna persona del negocio puede reemplazarlo ([capítulo 9](09-tu-equipo.md), H-33). |
| El nombre del negocio quedó mal y ya elegiste rubro | Esa pantalla deja de ser accesible ([capítulo 1](01-primeros-pasos.md), H-03). |
| Necesitás una segunda sucursal | No existe la función (H-02). |
| Querés saber qué consultó CEOM de tu negocio | El registro existe; pedíselo ([capítulo 10](10-compartir-datos.md)). |
