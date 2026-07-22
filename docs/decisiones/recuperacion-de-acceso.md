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

**El hueco que ninguna de las tres cierra, y que hay que decidir aparte:** el **tenant de un solo
usuario** con el email muerto. C no aplica (no hay bandeja), B no tiene destino (no hay colaborador).
Es el caso más probable en un emprendimiento chico. Las salidas posibles —dar de alta un colaborador
por pedido verificado del titular, o cambiar el email de Auth del dueño previa verificación de
identidad fuera de banda— son ambas más invasivas que B y merecen su propia sección de este
documento. **Escribirla es el siguiente paso, no parte de esta decisión.**

---

## 7. Estado

Diagnóstico cerrado y verificado en código. **Sin cambios aplicados** — ni a `identidad/actions.ts`,
ni a `seed-admin.ts`, ni al login. Ninguna de las opciones está implementada.

Pendiente de decisión del usuario antes de tocar nada.
