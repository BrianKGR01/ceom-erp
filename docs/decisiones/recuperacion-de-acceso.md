# Recuperación de acceso cuando el dueño pierde la cuenta — CEOM-ERP

> Fecha: 2026-07-22. Disparador: H-33 (las funciones de gestión de equipo gateadas con
> `solicitante.esOwner` directo, sin el bypass de `ceom_admin` que sí tiene `tienePermiso()`).
> Alcance: **diagnóstico y decisión de modelo de confianza. Sin cambios de código.**
>
> Método: verificación personal, leyendo cada archivo citado. Donde el enunciado de H-33 y el
> código difieren, manda el código y queda anotado abajo (§1.2).
>
> **Nota sobre la fuente:** `docs/manual/hallazgos.md` no existe — ni en `dev`, ni en `main`, ni en
> la rama `user-manual` (que además está detrás de `dev`). El contenido de H-33 se tomó del
> enunciado de la tarea y se verificó contra el código; la numeración `H-XX` sí aparece referenciada
> en [`docs/deuda-aplazada.md`](../deuda-aplazada.md) (H-01/H-32), así que el documento existió en
> algún momento. **Antes de actuar sobre este doc conviene recuperar el original o declararlo
> perdido** — hay hallazgos cruzados que no podemos leer.

---

## 1. Verificación del hallazgo

### 1.1 Lo que H-33 dice bien

**Confirmado.** El bypass de `ceom_admin` existe en los dos guards genéricos del módulo:

- [`identidad/actions.ts:101-106`](../../src/modules/identidad/actions.ts#L101) — `tienePermiso()`
  devuelve `true` incondicionalmente para `rol.esRolSistema && rolId === ROL_CEOM_ADMIN_ID`, antes
  de mirar tenant, estado de acceso o matriz.
- [`identidad/actions.ts:142`](../../src/modules/identidad/actions.ts#L142) —
  `recursoPerteneceAlTenant()` hace lo mismo.

Y **no** existe en las funciones de gestión de equipo, que abren con `if (!solicitante.esOwner)` y
cortan ahí. Un `ceom_admin` no las atraviesa.

**Confirmado también:** [`scripts/seed-admin.ts:94`](../../scripts/seed-admin.ts#L94) crea al
administrador de CEOM con `esOwner: false`. No es un descuido — es correcto: `esOwner` es la
condición de dueño *de un tenant*, y el admin de CEOM pertenece al tenant CEOM Ops, no al negocio
del cliente. Ponerlo en `true` lo haría dueño de CEOM Ops, no de nada más. El problema no es ese
`false`; es que no hay ninguna otra puerta.

### 1.2 Lo que H-33 cuenta mal

**No son doce funciones, son catorce** (y diecisiete si se cuenta el bloque de configuración del
tenant, gateado idéntico). Enumeradas, todas en
[`identidad/actions.ts`](../../src/modules/identidad/actions.ts):

| Bloque | Funciones | Líneas del guard |
|---|---|---|
| Colaboradores (6) | `listarUsuarios`, `invitarUsuario`, `cambiarRolUsuario`, `suspenderUsuario`, `reactivarUsuario`, `transferirOwner` | 574, 587, 632, 662, 692, 725 |
| Roles (5) | `listarRoles`, `listarPermisosPorRol`, `crearRolPersonalizado`, `actualizarPermisosRol`, `eliminarRol` | 765, 776, 797, 819, 838 |
| Capacidades especiales (3) | `listarCapacidadesEspeciales`, `otorgarCapacidadEspecialPorRol`, `otorgarCapacidadEspecialPorUsuario` | 885, 920, 950 |
| *(Config del tenant — mismo gate, otro alcance)* | `actualizarTenant`, `asignarNicho`, `completarOnboarding` | 493, 514, 542 |

La diferencia importa: cualquier propuesta de "tocar las N funciones" tiene que saber que N es 14 o
17, no 12, y que tres de ellas son de onboarding, no de equipo.

### 1.3 Lo que H-33 no vio — y que invalida la solución obvia

**Las catorce funciones son tenant-implícitas: ninguna recibe un `tenantObjetivoId`.** Operan sobre
`solicitante.tenantId`. Ejemplos verificados:

- `listarUsuarios` → `repo.listarUsuariosPorTenant(solicitante.tenantId)` ([:577](../../src/modules/identidad/actions.ts#L577))
- `invitarUsuario` → inserta con `tenantId: solicitante.tenantId` ([:616](../../src/modules/identidad/actions.ts#L616))
- `crearRolPersonalizado` → `repo.crearRol({ tenantId: solicitante.tenantId, … })` ([:804](../../src/modules/identidad/actions.ts#L804))

El `tenantId` de un `ceom_admin` es `CEOM_OPS_TENANT_ID`. **Darle el bypass no le daría acceso al
equipo del negocio en problemas: lo dejaría administrando el equipo de CEOM Ops.** No es un arreglo
de una línea por función — es agregar un parámetro nuevo a 14 funciones públicas, a sus 14 Server
Actions delgadas en [`mi-negocio/actions.ts`](../../src/app/app/(shell)/mi-negocio/actions.ts), y a
sus entradas del [manifiesto de acceso](../../src/lib/security/access-manifest.ts). Es un cambio de
contrato de módulo, con todo lo que exige AGENTS.md.

**Y `transferirOwner` es peor: es caller-implícita.**
[`repository.ts:456-488`](../../src/modules/identidad/repository.ts#L456) recibe `ownerActualId` y
lo pisa con `esOwner: false` + `rolId: rolParaOwnerSaliente`. La capa de acciones le pasa
`solicitante.id` ([:746](../../src/modules/identidad/actions.ts#L746)). La función no significa
"asigná a X como dueño" — significa **"cedo *lo mío* a X"**.

Con un bypass ingenuo, un `ceom_admin` llamándola intentaría degradar *su propia fila*. En la
práctica falla antes, en la validación del rol saliente
([:740](../../src/modules/identidad/actions.ts#L740)): un rol del tenant destino no pertenece a CEOM
Ops, así que devuelve *"El rol elegido para vos no es válido en este tenant."* — **falla cerrado por
accidente, no por diseño.** Si alguien "arregla" esa validación sin entender por qué estaba, el
siguiente intento destruye la cuenta del administrador de CEOM.

Conclusión: **la opción de bypass no es la barata. Es la que parece barata.**

---

## 2. `requireEscrituraHabilitada` y la transferencia de titularidad

**Sí bloquea, y bloquea antes de lo que se supone.**

`transferirOwner` llama a `requireEscrituraHabilitada` en
[:728](../../src/modules/identidad/actions.ts#L728), tercera línea del cuerpo. El guard
([:551-564](../../src/modules/identidad/actions.ts#L551)) exige `estado === "activo"` — **no** "≠
bloqueado". Es más estricto que `tienePermiso()`, que en `solo_lectura` al menos deja `ver`
([:115](../../src/modules/identidad/actions.ts#L115)).

Cruzado con `calcularEstadoAcceso()` ([:52-71](../../src/modules/identidad/actions.ts#L52)) y
`DURACION_ETAPA_SOLO_LECTURA_DIAS = 3` ([`constants.ts:21`](../../src/modules/identidad/constants.ts#L21)):

| Estado del tenant | ¿Se puede transferir la titularidad? |
|---|---|
| `activa` | Sí |
| `vencida`, día 1-3 de gracia (`solo_lectura`) | **No** |
| `vencida`, día 4+ (`bloqueado`) | **No** |
| `pausada` (`bloqueado`) | **No** |

**Un día después del vencimiento la titularidad ya no se puede ceder.** El usuario sospechaba que el
bloqueo llegaba con el `bloqueado`; llega con el `solo_lectura`, tres días antes.

Diez de las catorce funciones pasan por este guard (las cuatro lecturas —`listarUsuarios`,
`listarRoles`, `listarPermisosPorRol`, `listarCapacidadesEspeciales`— no).

Corolario para cualquier diseño: **el camino de recuperación no puede pasar por
`requireEscrituraHabilitada`.** Y hay un segundo tramo: en un tenant vencido, reasignar la
titularidad no descongela nada por sí solo — el dueño nuevo sigue sin poder escribir hasta que la
suscripción se reactive. Como `cambiarPlanTenant`/`cambiarEstadoSuscripcion` ya son exclusivas de
`ceom_admin` ([:424](../../src/modules/identidad/actions.ts#L424),
[:456](../../src/modules/identidad/actions.ts#L456)), la recuperación de un tenant vencido es
necesariamente **dos actos de CEOM**: reasignar y reactivar.

---

## 3. Qué pasa hoy con H-05 (recuperación de contraseña)

**No existe. No es que esté incompleta — no está empezada.**

- [`login-form.tsx:54`](<../../src/app/(auth)/login/login-form.tsx#L54>) — *"¿Olvidaste tu
  contraseña?"* es `<a href="#">`. Un link muerto. (Lo mismo *"Crear cuenta gratis"*,
  [:97](<../../src/app/(auth)/login/login-form.tsx#L97>).)
- Cero llamadas a `resetPasswordForEmail` o `updateUser` en todo `src/` y `scripts/`.
- [`login/actions.ts`](<../../src/app/(auth)/login/actions.ts>) sólo tiene `iniciarSesion`.

**Y hay algo más grande detrás.** El único Route Handler del proyecto es
[`src/app/portal/auth/callback/route.ts`](../../src/app/portal/auth/callback/route.ts), y es para el
magic link de **Instituciones**. No hay callback de Auth para `/app`, no hay `middleware.ts` en
ningún lado, y `src/lib/supabase/` no tiene cliente de navegador (sólo `server.ts`, `actions.ts`,
`storage*.ts`) — así que tampoco hay `detectSessionInUrl` del lado cliente.

Es decir: **hoy no hay ninguna ruta en la app capaz de canjear un token de email por una sesión.**
Eso no afecta sólo a la recuperación de contraseña — afecta al alta misma. `crearTenant` e
`invitarUsuario` invitan con `inviteUserByEmail(email)`, sin `redirectTo`
([:369](../../src/modules/identidad/actions.ts#L369),
[:605](../../src/modules/identidad/actions.ts#L605)). Y el propio
[`identidad/ANCLA.md`](../../src/modules/identidad/ANCLA.md) lo admite: se verificó vía Admin API que
`invited_at` quedó seteado —prueba de que Supabase encoló el correo— pero *"el click del link **queda
pendiente de validación manual**"*.

**Por qué no está hecho:** no aparece ninguna decisión que lo difiera a propósito. No está en
[`deuda-aplazada.md`](../deuda-aplazada.md) ni en el ANCLA de Identidad. La lectura más probable es
que el login se construyó contra usuarios sembrados por script, con la contraseña fijada a mano en
Supabase, y el tramo de "el usuario llega desde un email" nunca se ejerció. **La consecuencia
práctica es que H-05 no es un botón que falta: es un tramo de infraestructura de Auth que no
existe, y que cualquiera de las opciones de abajo necesita igual.**

---

## 4. Qué queda registrado hoy en el log de accesos

Este es el punto que más pesa en la decisión, porque acota **qué se puede auditar de lo que CEOM
haga**.

**La tabla** — `logs_acceso_admin_ceom`
([`consentimiento/schema.ts:236`](../../src/modules/consentimiento/schema.ts#L236)) tiene cuatro
columnas útiles:

```
usuario_ceom_id · tenant_id · modulo_consultado · creado_en
```

**No hay columna de acción, ni de recurso afectado, ni de valor anterior/nuevo.** El vocabulario de
`modulo_consultado` es `moduloPermisoEnum`, que sí incluye `"identidad"` — agregado en la Etapa 3 del
backstop de RLS exactamente para esta tabla
([`identidad/schema.ts:62-68`](../../src/modules/identidad/schema.ts#L62)).

**Quién escribe** — sólo [`panel-admin-ceom/actions.ts`](../../src/modules/panel-admin-ceom/actions.ts),
en cinco lugares (líneas 74, 123, 146, 178, 208), **todos lecturas**: salud agregada, ficha del
tenant, financiero, operativo, inventario. El propio código lo dice:

> *"Expuesta y funcional, pero sin hook automatico que la dispare desde el resto de los modulos
> todavia"* — [`consentimiento/actions.ts:515-518`](../../src/modules/consentimiento/actions.ts#L515)

**Las escrituras que CEOM ya puede hacer hoy no dejan rastro.** Verificado: `crearTenantAction`,
`cambiarPlanTenantAction` y `cambiarEstadoSuscripcionAction`
([`admin/(shell)/tenants/actions.ts`](<../../src/app/admin/(shell)/tenants/actions.ts>)) llaman
directo a `identidad/actions.ts`, que no importa nada de `consentimiento`. Cero filas de log. Ya hoy
CEOM puede cambiarle el plan a un tenant sin que quede constancia en ninguna parte.

**Y el tenant no puede verlo.** La tabla se declara sin ninguna `pgPolicy` para `authenticated` —
deniega por defecto, a propósito: *"no visible para el tenant, solo para el propio equipo CEOM"*
([`schema.ts:231-235`](../../src/modules/consentimiento/schema.ts#L231),
[`:250-254`](../../src/modules/consentimiento/schema.ts#L250)).

> **Resumen operativo:** el log de hoy puede decir *"el admin de CEOM Fulano tocó `identidad` en el
> tenant X el día D"*, y nada más. No distingue leer de escribir, ni sabe a quién se invitó o qué
> permiso se otorgó. Y el dueño del negocio no puede consultarlo. **Cualquier opción que amplíe el
> poder de CEOM sobre el equipo de un tenant sin ampliar primero esta tabla es un aumento de poder
> sin aumento de trazabilidad.**

---

## 5. Las opciones

### Opción A — Bypass completo de `ceom_admin` en las catorce funciones

**Qué resuelve.** En teoría, todo: dueño perdido, colaborador que necesita ascender, permisos
trabados. En la práctica, **nada tal como está escrito**: son tenant-implícitas (§1.3), así que el
bypass deja al admin de CEOM administrando CEOM Ops. Resolverlo de verdad exige agregar
`tenantObjetivoId` a las 14 funciones, sus 14 acciones delgadas y el manifiesto de acceso — cambio
de contrato de módulo, no un parche.

**Qué abre.** El equipo de CEOM podría **invitar identidades nuevas a cualquier negocio**, cambiar
roles y otorgar capacidades especiales (`vender_sin_stock`, `importar_historico`…). Eso no es
"administrar el equipo": es poder insertar una cuenta propia en el negocio de un cliente y después
operar como ese negocio, con acceso a ventas, costos y márgenes. Colisiona además con una invariante
que el código protege a mano: `invitarUsuario` y `cambiarRolUsuario` rechazan explícitamente asignar
roles de sistema *para que nadie gane por error el bypass cross-tenant*
([:596-601](../../src/modules/identidad/actions.ts#L596),
[:646-652](../../src/modules/identidad/actions.ts#L646)). La opción A reabre esa puerta desde el otro
lado.

**Qué queda en el log.** Con la tabla de hoy: `usuario_ceom_id + tenant_id + "identidad" + fecha`.
Una invitación de un empleado de CEOM al negocio de un cliente sería **indistinguible de haber
abierto la ficha del tenant** en el panel. Y el dueño no puede verlo.

**Riesgo adicional.** Un bypass ingenuo en `transferirOwner` falla cerrado sólo por accidente
(§1.3); el "arreglo" natural de ese error destruye la cuenta del admin de CEOM.

---

### Opción B — Camino acotado: CEOM sólo reasigna la titularidad a un colaborador existente

**Qué resuelve.** El caso duro: dueño ilocalizable, fallecido, desvinculado, o con el email muerto.
Un colaborador activo pasa a dueño y **a partir de ahí el negocio se autoadministra** — el dueño
nuevo tiene las 14 funciones, CEOM no vuelve a intervenir.

**Qué no resuelve.** Dos huecos, y el segundo es serio:
1. La contraseña olvidada — el caso más frecuente, donde el dueño está perfectamente disponible.
2. **El tenant de un solo usuario.** Si el único usuario es el dueño, no hay destino posible. Para un
   ERP de emprendimientos, ése es probablemente el tenant más común. **La opción B sola no cubre al
   grueso del mercado objetivo.**

**Qué abre.** Bastante menos que A, por una propiedad concreta: **el conjunto de destinos posibles
está restringido a gente que el tenant ya admitió**. CEOM puede elegir *cuál* de los miembros manda,
pero no puede sumar uno nuevo, ni auto-asignarse, ni entregarle el negocio a un tercero. Sigue siendo
poder real —elegir al dueño entre los existentes— pero es contenible y explicable en un contrato.

**Qué queda en el log.** Con la tabla de hoy, lo mismo que A: "CEOM tocó `identidad` en el tenant X".
**Insuficiente para esta operación**, que es exactamente la que hay que poder auditar. Esta opción
debería llevar de la mano una ampliación del log (acción + usuario saliente + usuario entrante) y,
discutible pero recomendable, **una notificación al tenant** — hoy la tabla es deliberadamente
invisible para él.

**Forma de implementación (no es un bypass).** Función nueva y con nombre propio, del estilo
`reasignarTitularidad(solicitanteCeomAdmin, tenantId, nuevoOwnerUsuarioId, rolParaOwnerSaliente)`,
que:
- resuelva el dueño saliente **desde el tenant**, no desde el caller (no reusar la forma
  caller-implícita de `repo.transferirOwner`, §1.3);
- valide que el destino pertenece al tenant y está `activo`;
- **no** pase por `requireEscrituraHabilitada` (§2);
- escriba su propia fila de auditoría.

---

### Opción C — Recuperación de contraseña real (H-05)

**Qué resuelve.** El caso más común, y **sin tocar el modelo de permisos**: el dueño se recupera
solo, CEOM nunca entra al tenant. Como además obliga a construir la ruta de callback de Auth que hoy
no existe (§3), **de paso desbloquea el tramo no validado de la invitación por email** — el que hace
que hoy un dueño nuevo no tenga forma comprobada de fijar su primera contraseña.

**Qué no resuelve.** Nada de lo que pasa cuando el email del dueño es inalcanzable: cuenta corporativa
dada de baja, dominio vencido, persona desvinculada, fallecida, o adversa. Para esos casos hace falta
B.

**Qué abre.** Superficie de auth estándar, no de autorización: enumeración de usuarios por el mensaje
de respuesta, vida útil y de un solo uso del token, rate limiting. Todo eso lo maneja Supabase Auth;
lo que hay que hacer bien es la ruta de callback y no filtrar en el mensaje si el email existe.

**Qué queda en el log.** **Nada en `logs_acceso_admin_ceom`, y está bien** — CEOM no participa. La
traza vive en los logs de Supabase Auth. Es la única de las tres opciones que resuelve un caso real
sin gastar una sola línea del presupuesto de confianza del producto.

---

### Opción D — Combinación

C primero, B después, A nunca. Desarrollado abajo.

---

## 6. Recomendación

**C primero. B después, acotada y con log propio. A no.**

**Por qué C primero.** Es la única que no amplía el poder de CEOM, cubre el caso de mayor frecuencia,
y está en el camino crítico de algo que ya está roto (§3: sin ruta de callback, la invitación por
email tampoco cierra). Si se hace C y nada más, el "negocio congelado" deja de ser el escenario
normal y pasa a ser el excepcional — que es la condición que hace razonable diseñar B con calma.

**Por qué B después y no en su lugar.** B es necesaria —hay casos que C no alcanza— pero es una
decisión de modelo de confianza, y conviene tomarla cuando ya no sea la única salida de un caso
frecuente. Cuando se tome, tres condiciones no negociables:
1. **Función nueva, no bypass.** Con `tenantId` explícito y el dueño saliente resuelto desde el
   tenant (§1.3, §5-B).
2. **Fuera de `requireEscrituraHabilitada`.** El momento de mayor necesidad es exactamente cuando
   nadie está pagando (§2). Y asumir que la recuperación de un tenant vencido son dos actos:
   reasignar y reactivar.
3. **El log se amplía en el mismo cambio.** Acción, usuario saliente, usuario entrante. Mismo
   criterio que AGENTS.md aplica a RLS: *"no escribir una política para después"*.

**Por qué A no.** Tres razones independientes, cualquiera alcanza:
- No funciona como se propone (tenant-implícitas), y hacerla funcionar es un cambio de contrato en
  14 funciones.
- Rompe `transferirOwner` de una forma que hoy sólo falla cerrado por casualidad.
- Compra el máximo de poder —invitar identidades a cualquier negocio— para cubrir un caso que B
  cubre con una fracción, y encima sobre un log que no puede distinguir esa invitación de una
  lectura.

**El hueco que ninguna de las tres cierra:** el **tenant de un solo usuario** con el email muerto. C
no aplica (no hay bandeja), B no tiene destino (no hay colaborador). Es el caso más probable en un
emprendimiento chico. → **desarrollado en §9.**

---

## 7. El alta de usuarios está rota — traza end-to-end

> Sección agregada el 2026-07-22 tras evidencia nueva. **Esto cambia la urgencia de todo lo
> anterior:** el problema no es sólo "qué pasa si el dueño pierde el acceso". Es que **hoy el dueño
> nunca llega a tenerlo**, salvo que se lo siembre a mano.

### 7.1 Dónde aterriza el dueño cuando hace clic

`crearTenant()` invita con `inviteUserByEmail(input.ownerEmail)` — **sin `redirectTo`**
([`identidad/actions.ts:369`](../../src/modules/identidad/actions.ts#L369)). El correo lleva el
`ConfirmationURL` de Supabase, que resuelve así:

```
1. clic  → https://<proyecto>.supabase.co/auth/v1/verify?token=…&type=invite&redirect_to=<Site URL>
2. Supabase valida el token, marca email_confirmed_at, emite sesión
3. redirect → <Site URL> con los tokens en el fragmento (#access_token=…) o en ?code=
4. el navegador carga <Site URL>
```

Como no se pasa `redirectTo`, el paso 3 usa el **Site URL configurado en el dashboard de Supabase**
— no `NEXT_PUBLIC_SITE_URL` del `.env.local`, que sólo lo lee la app para el magic link de
Instituciones. **Pero el valor concreto da igual, porque no hay ningún destino que sirva:**

| Destino candidato | Qué pasa |
|---|---|
| `/` | [`src/app/page.tsx`](../../src/app/page.tsx) es **el boilerplate de `create-next-app`** — "To get started, edit the page.tsx file". Sin cliente de Supabase, sin lectura del fragmento. El token se descarta. |
| `/login` | Server Component; ignora el fragmento (que ni siquiera viaja al servidor). Pide email + contraseña, que el invitado todavía no tiene. |
| `/app/*` | [`(shell)/layout.tsx:20`](<../../src/app/app/(shell)/layout.tsx#L20>) → `obtenerUsuarioActual()` es `null` (no hay cookie de sesión) → `redirect("/login")`. |
| `/portal/auth/callback` | Único route handler del proyecto, y **hostil a este caso**: canjea el código, no encuentra Institución con ese email, hace `signOut()` y redirige a `/portal?error=sin_institucion` ([route.ts:29-35](../../src/app/portal/auth/callback/route.ts#L29)). |

**No existe en toda la app ninguna ruta capaz de convertir un token de email en una sesión de
`/app`.** No hay `middleware.ts`, no hay cliente de navegador en `src/lib/supabase/`, y —lo
definitivo— **no hay una sola línea de código que fije una contraseña**: cero llamadas a
`updateUser` o `resetPasswordForEmail` en `src/` y `scripts/`. El único uso de `password` fuera de
tests es leer el campo del formulario de login.

> **Corolario duro:** toda cuenta de este proyecto que hoy tiene contraseña la obtuvo **fuera de la
> aplicación** — dashboard de Supabase o `admin.createUser({password})` en tests. No hay excepción
> posible, porque la app no sabe fijar contraseñas.

### 7.2 Confirmación empírica en la base real

Consulta a `auth.users` del proyecto `riertvgnjaujstwyqoom` (2026-07-22). De 16 cuentas reales,
**sólo 2 pasaron alguna vez por `inviteUserByEmail`**:

| Cuenta | Invitada | Email confirmado | Contraseña | Logueó | Estado |
|---|---|---|---|---|---|
| `ceom.qa.alta.…@gmail.com` | sí | **no** | **no** | **nunca** | Owner de "QA Alta Tenant" |
| `runinkgr@gmail.com` | sí | sí | sí | sí | colaborador de "Mi Negocio de Prueba" |

Las otras 14 se crearon con `admin.createUser({ password, email_confirm: true })` desde los tests —
nunca vieron un correo.

**Hay un tenant congelado desde el nacimiento en la base ahora mismo.** "QA Alta Tenant
1784397681183" tiene un único usuario, su Owner, que nunca confirmó el email, nunca fijó contraseña
y nunca entró. Ese tenant además **no tiene ningún rol personalizado**, así que aunque su dueño
entrara mañana no tendría a quién invitar sin crear un rol primero. **El escenario de H-33 no es
hipotético: ya ocurrió, y ocurrió en el alta, no en una pérdida de acceso.**

El caso de `runinkgr` no contradice nada: `email_confirmed_at` lo marca Supabase en el paso 2, con
el solo hecho de abrir el link — no prueba que la app haya capturado la sesión. La contraseña, por
§7.1, salió necesariamente del dashboard.

### 7.3 El límite de correo, y por qué es lo de menos

`inviteUserByEmail` devolvió `email rate limit exceeded`. Según la documentación de Supabase, con el
servicio SMTP incorporado ese límite es **project-wide**, sumando `/auth/v1/signup`, `/auth/v1/recover`
y `/auth/v1/user` en un solo cupo horario, y **sólo se puede subir configurando SMTP propio**
([auth rate limits](https://supabase.com/docs/guides/platform/going-into-prod), [custom SMTP](https://supabase.com/docs/guides/auth/auth-smtp)).
Implicación directa: **dar de alta varios usuarios seguidos es imposible** — cada alta consume del
mismo cupo, y ese cupo lo comparte con la futura recuperación de contraseña de H-05.

**Pero hay una restricción bastante peor que el límite, y explica el tenant congelado.** El SMTP
incorporado de Supabase:

> *"Unless you configure a custom SMTP server for your project, Supabase Auth will refuse to deliver
> messages to addresses that are not part of the project's team."* — con error *"Email address not
> authorized"*.

Es decir: **hoy el sistema sólo puede mandarle un correo a los miembros del equipo de la
organización de Supabase.** Invitar a un cliente real, o a alguien del equipo que no esté en esa
lista, no falla ruidosamente — simplemente no llega. Eso es exactamente el patrón de
`ceom.qa.alta.…@gmail.com` (dirección inventada, jamás entregada) frente a `runinkgr@gmail.com`
(dirección que sí llegó).

La propia doc dice que el SMTP incorporado es para *"toy projects, demos or any non-mission-critical
application"* y urge SMTP propio para todo lo demás.

**Conclusión:** el alta de negocios no está "pendiente de validar el clic". **Está rota para
cualquiera que no sea miembro del equipo de Supabase**, y seguirá rota aunque se configure SMTP
propio, porque el link sigue sin tener dónde aterrizar (§7.1). Son dos fallas independientes: la
entrega del correo y el destino del enlace. **Hay que arreglar las dos.**

---

## 8. Procedimiento confiable para dar de alta a alguien HOY

Sin tocar código, sin depender del correo. Cuatro pasos, dos de ellos manuales.

> **No uses el botón "Invitar colaborador" de la app para esto.** Si el cupo de correo lo deja
> pasar, crea la fila en `usuarios` apuntando a una cuenta de Auth **sin contraseña y sin forma de
> fijarla**, y el email queda ocupado — con lo cual ya no podés crear esa cuenta desde el dashboard.
> Es la trampa exacta en la que quedó `ceom.qa.alta.…@gmail.com`.

### Paso 0 — Asegurate de que exista un rol para esa persona *(en la app, si hace falta)*

`/app/mi-negocio/roles` → "Crear rol". Es una acción de Owner, no toca el correo, funciona hoy.
Roles no-sistema disponibles ahora en **Mi Negocio de Prueba** (`d672ef4b-0ead-4348-8000-0e8c61beb8c3`):

| Rol | `rol_id` |
|---|---|
| Vendedor QA | `f121159f-1417-4e1a-a814-c0949fb43e25` |
| Jesus Reyes | `be7d7a12-c6b0-4ddc-b7d1-f7a959a38b8f` |

> ⚠️ **Nunca uses un rol de sistema** — ni `17eb761e-…` (Owner) ni `c1027307-…` (CEOM Admin). La
> propia app los rechaza en `invitarUsuario()`
> ([:596-601](../../src/modules/identidad/actions.ts#L596)) porque CEOM Admin otorga el bypass
> cross-tenant de `tienePermiso()`. Insertando a mano **no hay nada que te frene**.

### Paso 1 — Crear la cuenta de Auth sin mandar correo *(dashboard de Supabase)*

**Authentication → Users → Add user → Create new user**
- Email: el correo real de la persona
- Password: una contraseña temporal
- ✅ **Auto Confirm User** — imprescindible; sin esto `email_confirmed_at` queda en `null` y el login
  falla con *"Email not confirmed"*

Este camino **no envía ningún correo**: no consume cupo y no lo afecta la restricción de direcciones
autorizadas. Es lo que hace que el procedimiento sea confiable.

### Paso 2 — Copiar el UUID

Queda visible en la fila del usuario recién creado en esa misma pantalla.

### Paso 3 — Crear la fila de la app *(SQL Editor)*

```sql
insert into usuarios (id, tenant_id, nombre_completo, email, rol_id, es_owner, activo)
values (
  '<UUID-del-paso-2>',
  'd672ef4b-0ead-4348-8000-0e8c61beb8c3',   -- tenant_id
  'Nombre Apellido',
  'persona@ejemplo.com',                    -- mismo email que en el paso 1
  'f121159f-1417-4e1a-a814-c0949fb43e25',   -- rol_id no-sistema de ESE tenant
  false,                                     -- es_owner: siempre false acá
  true                                       -- activo
);
```

`id` debe ser **exactamente** el UUID de Auth: `obtenerUsuarioActual()` resuelve la fila por ese id
([`identidad/actions.ts:41`](../../src/modules/identidad/actions.ts#L41)). Si no coinciden, el login
de Supabase funciona pero la app responde *"Tu cuenta no está completamente configurada todavía"*
([`login/actions.ts`](<../../src/app/(auth)/login/actions.ts>)).

### Paso 4 — Entregar y verificar

La persona entra en `/login` con ese email y la contraseña temporal. Debería caer en `/app`.

**Caveats que tenés que asumir, porque no hay forma de evitarlos hoy:**
- **La contraseña temporal es permanente.** No hay pantalla de cambio de contraseña en la app (§3).
  Para cambiarla hay que volver al dashboard. Entregala por un canal seguro y no la reutilices.
- **Si la persona la pierde, vuelve al mismo problema.** Sin H-05 no hay autoservicio.

### Para desatascar a `ceom.qa.alta.…@gmail.com` (el Owner congelado)

Su fila en `usuarios` ya existe y es correcta; lo único que le falta es contraseña. Fijásela a esa
cuenta de Auth existente desde **Authentication → Users**, en el menú de la fila. No hace falta
tocar `usuarios` ni volver a invitar. *(No verifiqué la UI del dashboard yo mismo — si esa opción no
estuviera disponible en tu versión, la alternativa es borrar la cuenta de Auth y su fila de
`usuarios` y rehacer el alta con los pasos 1-3.)*

---

## 9. El tenant de un solo usuario con el correo muerto

El hueco que ninguna de las tres opciones de §5 cierra, y el más probable en el mercado objetivo:
**un emprendimiento donde el dueño es el único usuario**, y su dirección de correo dejó de ser
alcanzable — cuenta corporativa dada de baja, dominio vencido, casilla personal abandonada, persona
desvinculada o fallecida.

Hoy en la base hay **dos tenants en esa forma exacta**: "QA Alta Tenant" (un solo usuario, su Owner,
sin roles creados) y —salvo por un colaborador de prueba— casi "Mi Negocio de Prueba". No es un caso
de borde teórico: es la forma por defecto de un tenant recién creado.

**Por qué ninguna opción anterior alcanza:**

| Opción | Por qué falla acá |
|---|---|
| C (H-05) | El correo de recuperación va a una bandeja que nadie lee. |
| B (reasignar titularidad) | No hay colaborador al que reasignar. El conjunto de destinos válidos está vacío. |
| A (bypass completo) | "Funcionaría" — invitando a alguien nuevo al tenant. Pero eso es exactamente el poder que §5-A descarta, y acá se ejercería sobre el negocio de alguien que **no puede confirmar nada**, porque su único canal de contacto está muerto. |

**Lo que hace especial a este caso:** en B, el consentimiento está implícito — CEOM elige entre
personas que el propio tenant admitió, y el nuevo dueño puede confirmar que la operación fue
legítima. Acá **no queda nadie dentro del sistema capaz de confirmar ni desmentir**. Cualquier
recuperación es, por construcción, la palabra de un tercero sobre quién es el dueño de un negocio.
Es un problema de verificación de identidad fuera de banda, no de permisos.

### Las salidas posibles

**D.1 — Cambiar la dirección de correo de la cuenta de Auth del dueño.**
La menos invasiva en términos de modelo de permisos: no se toca `usuarios`, no cambia nadie de rol,
no entra ninguna identidad nueva. Se actualiza el email de Auth y a partir de ahí H-05 hace el resto
— el dueño se recupera solo. **Es la única salida que no le da a CEOM ningún poder nuevo *dentro* de
la app.** El poder que sí requiere es sobre Supabase Auth, que CEOM ya tiene de hecho (el
`SUPABASE_SECRET_KEY` está en sus manos).
*Riesgo:* quien controle ese procedimiento puede apoderarse de cualquier negocio redirigiendo el
correo del dueño. Todo el peso recae en la verificación de identidad previa.

**D.2 — Alta de un colaborador por pedido verificado, y después B.**
CEOM inserta un colaborador designado por el titular y luego le transfiere la titularidad con el
camino acotado de §5-B. Requiere dos poderes (invitar + reasignar), o sea prácticamente A restringida
a un caso. Más piezas, más superficie, y el resultado es el mismo que D.1.

**D.3 — No resolverlo en producto.** Declararlo explícitamente fuera de alcance: sin acceso al
correo registrado, el negocio no se recupera. Es una respuesta legítima y honesta si se dice **antes**
—en el onboarding— y si se le da al dueño una forma de prevenirlo.

**D.4 — Prevención: exigir un segundo contacto en el onboarding.**
No es una salida, es lo que hace que las otras tres casi nunca se necesiten. Un email de respaldo o
un segundo colaborador pedido al crear el negocio convierte este caso en el de §5-B, que ya sabemos
resolver de forma contenible.

### Recomendación para este caso

**D.4 como default del producto, D.1 como excepción documentada, D.2 nunca.**

D.4 es lo único que ataca la causa: hoy un tenant nace con un único punto de fallo y nadie se lo
advierte al dueño. Pedir un contacto de respaldo en el onboarding cuesta un campo y elimina la
mayoría de estos casos.

Para los que igual ocurran, **D.1 es preferible a D.2** por una razón concreta: cambia *un dato de
contacto*, no la composición del equipo ni el mapa de permisos. Deja al dueño recuperándose por el
camino normal de H-05 en vez de crear una identidad nueva dentro del negocio. Pero **exige un
procedimiento de verificación de identidad escrito y auditado** —qué prueba se pide, quién la
aprueba, qué queda registrado—, y ese procedimiento es la parte difícil, no el cambio técnico.

**Qué quedaría en el log.** Nada, hoy. `logs_acceso_admin_ceom` no tiene forma de representar "se
cambió el correo del dueño del tenant X de A a B por pedido verificado" — no hay columna de acción
ni de valor anterior (§4). Y es invisible para el tenant. **De las tres decisiones de este
documento, ésta es la que más necesita una fila de auditoría propia y la que hoy menos tiene.**

**Lo que falta antes de poder decidir D.1 en serio:** definir la verificación de identidad
fuera de banda. Es una decisión de operaciones y legal, no de código, y hasta que exista, D.1 no
debería ejecutarse ni una vez.

---

## 10. Estado

Diagnóstico cerrado y verificado — en código, contra la base real del proyecto
`riertvgnjaujstwyqoom`, y contra la documentación de Supabase. **Sin cambios aplicados**: ni a
`identidad/actions.ts`, ni a `seed-admin.ts`, ni al login, ni a la base de datos. Ninguna de las
opciones está implementada.

**Lo urgente ya no es §5.** Es §7: el alta de usuarios no funciona para nadie fuera del equipo de
Supabase. El procedimiento manual de §8 es el puente mientras tanto.

Orden sugerido, sujeto a tu decisión:
1. **SMTP propio** — sin eso no sale ningún correo a un cliente real (§7.3).
2. **Ruta de callback de Auth + fijar contraseña** — cierra H-05 y, con la misma pieza, el tramo de
   la invitación que hoy no aterriza en ningún lado (§7.1). Es la Opción C de §5.
3. **Reemplazar el boilerplate de `create-next-app` en `/`** — hoy es el destino más probable del
   enlace de invitación.
4. **Segundo contacto en el onboarding** (§9, D.4).
5. Recién después, el camino acotado de reasignación de titularidad (§5-B).
