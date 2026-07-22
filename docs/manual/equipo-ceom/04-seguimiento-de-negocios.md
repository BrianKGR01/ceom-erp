# 4. Seguimiento de negocios

**Negocios** (`/admin/tenants`) es la pantalla principal de `/admin` y donde caés al entrar.

---

## El listado

Arriba, cuatro totales de la plataforma: **cantidad de negocios**, y su distribución **por estado de
acceso**, **por plan** y **por rubro**. Debajo, la tabla completa con búsqueda por nombre.

**Qué mirar de esos cuatro números.** El de **estado de acceso** es el operativo: dice cuántos
negocios están funcionando con normalidad, cuántos en solo lectura y cuántos bloqueados. Un número
de bloqueados que crece es la señal más directa de un problema de cobranza.

> 🚧 El alcance de "salud" son exactamente esos cuatro totales. **No hay porcentaje de onboarding
> completado ni de retención**, aunque el diseño del módulo los mencione: no están implementados.
> (ver H-21 para la otra limitación de esta pantalla)

> 🚧 **El listado no pagina.** Trae todos los negocios de una vez. Funciona bien con el volumen
> actual; es lo primero que se va a degradar al crecer. (ver H-21)

---

## La ficha de un negocio

`/admin/tenants/[id]`. Muestra nombre, ciudad, moneda, rubro, plan vigente, estado de suscripción,
estado de acceso y fechas.

Desde acá hacés las dos únicas modificaciones que el equipo puede hacer sobre un negocio: **cambiar
el plan** y **cambiar el estado de la suscripción**.

---

## Los dos estados, y por qué se confunden

Es la distinción más importante de esta pantalla.

**Estado de suscripción** — lo asignás vos, a mano:

| Valor | Significado |
|---|---|
| `activa` | Al día |
| `vencida` | Pasó la fecha de pago |
| `pausada` | Suspendida de común acuerdo |

**Estado de acceso** — **no se asigna: se deriva.** Es qué puede hacer el negocio ahora mismo:

| Valor | Qué puede hacer |
|---|---|
| `activo` | Todo |
| `solo lectura` | Ver, no crear ni editar |
| `bloqueado` | Nada |

**La conversión:**

| Suscripción | + condición | → Acceso |
|---|---|---|
| `activa` | — | `activo` |
| `vencida` | dentro de la gracia del plan, medida desde la fecha de próximo pago | `solo lectura` |
| `vencida` | pasada la gracia | `bloqueado` |
| `vencida` | **sin fecha de próximo pago** | `bloqueado` **de inmediato** |
| `pausada` | — | `bloqueado`, sin gracia |

> ⚠️ **Poner `vencida` sin fecha de próximo pago bloquea al negocio en el acto**, salteando el
> período de gracia. La gracia se mide *desde* esa fecha; sin ella no hay desde dónde contar. El
> diálogo te pide la fecha al elegir `vencida` y el formulario la exige, así que por la interfaz no
> debería pasar — pero si ves un negocio bloqueado que no debería estarlo, es lo primero que hay que
> revisar. (ver H-41)

> ⚠️ **`pausada` bloquea, no pausa suavemente.** No hay período de gracia: el negocio deja de poder
> ver sus datos de inmediato. Si la intención es "suspender sin cortarle el acceso a su información",
> `pausada` no es la herramienta — no existe hoy. (ver H-46)

---

## Cambiar el plan

Diálogo con un selector de planes activos, más el plan actual del negocio aunque esté desactivado.

El cambio es inmediato. Lo único que cambia de verdad son los dos atributos que hacen algo: **qué
información puede compartir** y **cuántos días de gracia tiene** ([capítulo 2](02-planes.md)).

> ⚠️ Si el plan nuevo permite compartir **menos** tipos de información que el anterior, **los
> permisos ya otorgados no se revocan**. El plan se valida al *generar* un código, no
> retroactivamente. Un negocio que baje de plan sigue compartiendo lo que ya había compartido. (ver H-47)

---

## Cambiar el estado de la suscripción

Diálogo con el selector de los tres valores reales. Al elegir `vencida` pide la **fecha de próximo
pago**, que es el ancla desde la que se mide la gracia.

**No hay nada automático detrás de esto.** El sistema no cobra, no factura y no marca a nadie como
vencido por su cuenta: **el cambio de estado es siempre manual, de este diálogo.** Si nadie entra a
marcar un vencimiento, el negocio sigue operando indefinidamente.

**Tampoco hay aviso al cliente.** El negocio se entera cuando entra y ve el cartel ámbar o rojo. No
se envía ningún correo.

---

## Las tres pestañas de consulta

La ficha tiene tres pestañas que muestran datos del negocio, con un selector de período compartido:

| Pestaña | Qué muestra |
|---|---|
| **Financiero** | Flujo de caja, estado de resultados y total de costos fijos. |
| **Operativo** | Producciones registradas y merma total. |
| **Inventario Operativo** | Catálogo de insumos con su costo vigente. |

**No pasás por consentimiento.** A diferencia de una institución, no necesitás que el negocio te
autorice: tu acceso está cubierto por los términos del servicio. No vas a ver candados ni pestañas
bloqueadas.

**Pero sí queda registrado.** Cada una de estas consultas —y también abrir la ficha— dispara una
entrada en el registro de accesos con tu identidad, el negocio y la fecha.
→ [capítulo 6](06-registro-de-accesos.md)

> ⚠️ **Los números de estas pestañas arrastran los mismos huecos que ve el negocio.** El estado de
> resultados no descuenta comisiones de canal ni cuotas de deuda, y suma ingresos de productos sin
> costo cargado. Si vas a evaluar la salud de un negocio con estos datos, leé primero la advertencia
> del capítulo 8 del manual del negocio. (ver H-24, H-27, H-15)

---

## Lo que no podés hacer desde acá

Vale enumerarlo porque es contraintuitivo: **el equipo de CEOM no administra el interior de un
negocio.**

| No podés | Por qué |
|---|---|
| Invitar un colaborador | Reservado al dueño (H-33) |
| Cambiar el rol de alguien | Ídem |
| Designar un dueño nuevo | Ídem — **ni siquiera si el actual perdió el acceso** |
| Corregir el correo del dueño | No existe la pantalla |
| Corregir el nombre o la moneda del negocio | Solo el dueño, y solo antes de elegir rubro (H-03) |
| Crear una segunda sucursal | No existe (H-02) |
| Cambiar el rubro | Es irreversible por diseño |

> ⚠️ **El caso "el dueño no está disponible" no tiene solución por interfaz.** Es el escenario que
> más conviene tener previsto: requiere intervención directa en la base de datos. Ver
> [capítulo 1](01-antes-de-empezar.md). (ver H-33)
