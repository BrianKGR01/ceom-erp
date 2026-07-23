# Observaciones de uso

> **Qué es este documento.** El registro de lo que aparece cuando una persona **usa** el producto de
> punta a punta, ronda por ronda. No es una auditoría (eso es `AUDITORIA-UI-UX.md`, que se hizo
> leyendo el código y recorriendo pantallas) ni un inventario de defectos funcionales (eso es
> `docs/manual/hallazgos.md`, que salió de escribir el manual). Este sale de **usar el sistema como
> lo va a usar el equipo**, y por eso encuentra cosas que las otras dos no: fricción de recorrido,
> cosas que se ven mal en el momento equivocado, y funcionalidad inalcanzable.
>
> **Cómo se usa.** Cada ronda de prueba agrega una sección nueva al final y sigue la numeración
> (`OBS-01`, `OBS-02`, …). Las observaciones viejas no se editan salvo para cambiarles el estado.
>
> **Regla de oro:** antes de escribir una observación acá se la verifica contra el código y se anota
> el `archivo:línea`. Una descripción escrita desde la memoria de la prueba **puede estar mal** — en
> esta primera ronda, 4 de 10 lo estaban en algún punto, y una de ellas partía de una premisa falsa.
> Si una observación ya está registrada en la auditoría o en hallazgos, se referencia el
> identificador existente en vez de abrir uno nuevo.

---

## Convenciones

**Identificador:** `OBS-NN`, correlativo entre rondas (no se reinicia).

**Veredicto** — qué pasó al verificar la observación contra el código:

| Veredicto | Significa |
|---|---|
| ✅ **Confirmada** | El código dice exactamente lo que decía la observación. |
| 🔶 **Parcial** | El hecho central es cierto, pero algún detalle de la descripción no. El matiz está anotado. |
| ❌ **Corregida** | La premisa era falsa. Se deja registrada igual, con la corrección, para que nadie la vuelva a levantar. |

**Estado** — qué se hizo con ella:

| Estado | Significa |
|---|---|
| 🟢 **Resuelta** | Corregida, con el commit que la cierra. |
| 🔵 **Registrada** | Verificada y anotada. Sin trabajo asignado todavía. |
| 🟣 **Ya documentada** | Existe con otro identificador en `AUDITORIA-UI-UX.md` o `hallazgos.md`. Acá solo queda el puntero. |
| ⏸️ **En espera de decisión** | No es un defecto: falta una decisión de producto. |

---

## Ronda 1 — 2026-07-23

**Qué se probó:** el ciclo completo por primera vez, de punta a punta y con datos reales — alta de
negocio desde `/admin` → correo de invitación → crear contraseña → onboarding → uso de la aplicación.

**Quién:** prueba manual del equipo, sobre el entorno de desarrollo.

### Índice

| ID | Observación | Veredicto | Estado |
|---|---|---|---|
| [OBS-01](#obs-01) | La pantalla de crear contraseña no acompaña la identidad del login | 🔶 Parcial | 🔵 Registrada |
| [OBS-02](#obs-02) | Sin validación en vivo de los requisitos de contraseña | ❌ Corregida | 🔵 Registrada |
| [OBS-03](#obs-03) | Durante el onboarding se ven pestañas que ofrecen una salida | 🔶 Parcial | 🔵 Registrada |
| [OBS-04](#obs-04) | Pestañas viejas conviven con el submenú de sidebar | 🔶 Parcial | 🟣 UI-002 / UI-005 |
| [OBS-05](#obs-05) | El sidebar no scrollea: había funcionalidad inalcanzable | ✅ Confirmada | 🟢 Resuelta |
| [OBS-06](#obs-06) | El logo del sidebar queda chico | ✅ Confirmada | 🟢 Resuelta |
| [OBS-07](#obs-07) | El sidebar no tiene la identidad visual del login | ✅ Confirmada | 🟢 Resuelta |
| [OBS-08](#obs-08) | Invitar colaborador con el selector de rol vacío y sin salida | ✅ Confirmada | 🔵 Registrada |
| [OBS-09](#obs-09) | Un negocio nuevo no tiene ningún rol | ✅ Confirmada | ⏸️ H-35 |
| [OBS-10](#obs-10) | El rol interno del Gateway es visible para el dueño | ✅ Confirmada | 🔵 Registrada |

---

<a id="obs-01"></a>
### OBS-01 · La pantalla de crear contraseña no acompaña la identidad del login 🔶 🔵

**Qué se observó.** `/app/definir-contrasena` se ve como una tarjeta blanca sobre fondo blanco,
mientras que `/login` tiene un panel con degradado. Rompe la continuidad justo en el primer contacto
de un usuario nuevo, que llega ahí desde el correo de invitación.

**Dónde.**
- `src/app/app/definir-contrasena/page.tsx:24` — `<div className="flex min-h-screen items-center justify-center bg-background p-6">`
- `src/app/(auth)/login/page.tsx:44` — el panel que falta: `hidden w-1/2 ... bg-gradient-to-b from-sidebar-from to-sidebar-to ... lg:flex`
- `src/app/app/auth/callback/route.ts:42` — `invite: "/app/definir-contrasena?motivo=invitacion"`, la ruta por la que se llega desde el correo

**Verificación — tres correcciones a la descripción.**

1. **No es cierto que "no tenga la identidad visual".** La tarjeta es idéntica clase por clase a la
   del login: `w-full max-w-sm rounded-2xl bg-card p-8 shadow-card`, el mismo `<Logo>`, el mismo h1 y
   la misma bajada (`definir-contrasena-form.tsx:36` vs. `login-form.tsx:17`). Marca, tipografía,
   radios y sombra están. Lo único que falta es el panel lateral.
2. **La diferencia solo existe en desktop.** Ese panel es `hidden … lg:flex`: por debajo de 1024px
   `/login` tampoco lo muestra, y las dos pantallas quedan equivalentes. En celular no hay ruptura.
3. **Hay un criterio ya declarado en el código, no es un descuido.**
   `src/app/(auth)/recuperar-contrasena/page.tsx:4` usa el mismo wrapper con un comentario explícito:
   *"sin el panel lateral de marca — es una pantalla de paso, no la puerta principal"*.

**Lo que sí queda en pie.** El criterio "pantalla de paso" no aplica del todo a
`definir-contrasena?motivo=invitacion`: es el **primer contacto** del dueño invitado, que llega desde
el correo sin haber visto nunca `/login`.

> ⚠️ **No copiar el panel del login tal cual.** Uno de sus tres bullets es *"Tuki IA te asesora 24/7
> con tus datos"* (`login/page.tsx:16-20`), y **H-06** (abierto) dice que ese asistente no existe.
> Replicarlo acá propagaría una promesa falsa a la pantalla de bienvenida. OBS-01 y H-06 se deciden
> juntos.

**Relación con otros registros.** Sin identificador previo. `/app/definir-contrasena` y
`/recuperar-contrasena` son posteriores a la auditoría (rama `claude/auth-por-correo`) y no figuran
en su inventario de pantallas. H-09 habla de identidad visual, pero de otra cosa (no saber en qué
superficie estás). `docs/design-system.md:116` (§5.8) fija la composición del login como referencia
del cliente y **no** la extiende al resto de las pantallas de autenticación: no hay regla que se esté
violando, falta decidir la regla.

---

<a id="obs-02"></a>
### OBS-02 · Sin validación en vivo de los requisitos de contraseña ❌ 🔵

**Qué se observó.** Se escribe la contraseña, se envía, y recién ahí rebota. Deberían verse los
requisitos como checks que se completan al escribir, y el botón habilitarse solo cuando se cumplen.

**Dónde.**
- `src/lib/contrasena.ts:6` — `export const LARGO_MINIMO_CONTRASENA = 8;`
- `src/lib/contrasena.ts:8-18` — `contrasenaNuevaSchema`: un `.min(8)` y un `.refine()` de igualdad. Nada más.
- `src/app/app/definir-contrasena/definir-contrasena-form.tsx:32` — `useActionState`, toda la validación es server-side
- `src/app/app/definir-contrasena/definir-contrasena-form.tsx:59` — `disabled={pending}`: el botón solo se apaga mientras el submit está en vuelo, nunca por invalidez

**El comportamiento está confirmado. La premisa no.**

> La observación asumía que el sistema exige más que el mínimo de 8 caracteres. **Es falso.**

Lo que exige hoy, textual y completo:

| Requisito | ¿Se exige? |
|---|---|
| Largo mínimo | **Sí: 8 caracteres** |
| Mayúsculas | No |
| Minúsculas | No |
| Números | No |
| Símbolos | No |
| Que las dos casillas coincidan | Sí |

No hay regex, ni medidor de fortaleza, ni política declarada en el repo — **no existe directorio
`supabase/`**, así que no hay `config.toml` que declare una política de contraseñas.

**Un matiz que importa para el diseño del checklist.** El proyecto de Supabase *podría* tener
activada en su panel una regla que el repo no ve (largo mayor, o el chequeo de contraseñas
filtradas): `contrasena.ts` ya traduce el error `weak_password` que devolvería en ese caso. Antes de
dibujar los checks hay que confirmar qué está prendido en el dashboard, o el checklist va a decir
"listo" y el servidor va a rebotar igual.

**Consecuencia práctica.** Con un solo requisito real, el checklist de checks que se completan es
casi todo lo que hay para mostrar — y la corrección más barata es que el botón se habilite recién a
los 8 caracteres y con las dos casillas iguales. Hoy, además, cada rebote cuesta un viaje al servidor
(`definir-contrasena/actions.ts:28` devuelve `parseo.error.issues[0].message`).

**Relación con otros registros.** **UI-015** (react-hook-form+zod conviviendo con validación manual)
cubre la causa: su propuesta es *"todo formulario con ≥2 campos usa RHF+zod"* (`AUDITORIA-UI-UX.md:733`),
y este formulario tiene 2 campos, aunque el inventario de UI-015 no lo liste por ser posterior.
Nota para no reabrirlo: el formulario **ya** usa `<FormError>` (`definir-contrasena-form.tsx:57`), o
sea que UI-027 ya está honrado ahí.

---

<a id="obs-03"></a>
### OBS-03 · Durante el onboarding se ven pestañas que ofrecen una salida 🔶 🔵

**Qué se observó.** El asistente de dos pasos es obligatorio, pero arriba se ven enlaces a Negocio /
Colaboradores / Roles / Capacidades Especiales. Se puede escapar de un flujo que no debería tener
salida.

**Dónde.**
- `src/app/app/onboarding/page.tsx:21-32` — la tira de 4 ítems se renderiza sin ninguna condición
- `src/app/app/(shell)/layout.tsx:22-24` — el guard: `if (usuario.esOwner && tenant && !tenant.onboardingCompletadoEn) redirect("/app/onboarding")`

**Verificación — la mitad de la observación es falsa, y eso cambia la severidad.**

**No se puede escapar.** El guard existe y funciona: cualquier ruta bajo `(shell)` rebota a
`/app/onboarding` mientras el onboarding no esté completo. Lo que pasa no es una fuga de seguridad
sino **una promesa vacía**: la interfaz ofrece cuatro caminos que rebotan sin explicar por qué. La
severidad baja de "se escapa del flujo" a "fricción y desconcierto".

**Un detalle de vocabulario, de paso.** Esa tira todavía dice **"Capacidades Especiales"**, mientras
el sidebar ya dice "Permisos especiales" (`app-shell.tsx:226`). Es una copia que se salteó el
renombrado del glosario porque vive fuera de `(shell)`.

**Relación con otros registros.** **H-03** (*"Elegido el rubro, los datos del negocio dejan de ser
editables"*) es **la otra cara del mismo defecto**, no un vecino: las dos salen de
`onboarding-wizard.tsx:48`, `const [paso, setPaso] = useState(tenant.nichoId ? 1 : 0)` — el paso se
deriva de si hay rubro, no del progreso real. H-03 cubre el caso "rubro seteado"; OBS-03 el caso
"rubro vacío". Conviene tratarlas juntas. El drift de terminología corresponde a **UI-007** (mismo
destino con nombres distintos) y **UI-037**, no a UI-005.

---

<a id="obs-04"></a>
### OBS-04 · Pestañas viejas conviven con el submenú de sidebar 🔶 🟣

**Qué se observó.** La Fase A decidió submenú de sidebar para Mi Negocio, Ventas, Gastos,
Proveedores, Patrimonio y Producción, pero la barra de pestañas vieja nunca se quitó.

**Dónde.** La coexistencia es real: **9 sitios en 5 módulos**, más una décima copia en el onboarding.
Las cuatro copias de `SubnavMiNegocio()` que se pudieron anclar una por una:

- `src/app/app/(shell)/mi-negocio/capacidades/capacidades-cliente.tsx:64`
- `src/app/app/(shell)/mi-negocio/colaboradores/colaboradores-cliente.tsx:61`
- `src/app/app/(shell)/mi-negocio/plan/page.tsx:43`
- `src/app/app/(shell)/mi-negocio/roles/roles-cliente.tsx:89`
- `src/app/app/onboarding/page.tsx:21-32` (la quinta, inline y divergente — ver OBS-03)
- `src/app/app/(shell)/gastos/gastos-cliente.tsx:106` — el botón "Recurrentes"

**Verificación — una corrección.** **Proveedores no tiene barra duplicada.** Sus únicas pestañas son
las de la Ficha de Proveedor, que son `Tabs` legítimo sobre un mismo recurso (el patrón que la
decisión 6 mantiene a propósito). Son **5 módulos**, no 6. El problema de Proveedores es el opuesto y
ya tiene identificador: **UI-003**, falta de navegación hacia Compras.

**Relación con otros registros.** 🟣 Ya documentada: **UI-005** (las 5 copias de `SubnavMiNegocio`,
con su causa raíz cerrada en Fase A y la limpieza mecánica explícitamente diferida a Fase C) y
**UI-002** (los 7 mecanismos ad-hoc). No abre identificador nuevo. Lo único que OBS-04 agrega es la
confirmación de que, ahora que el submenú existe, la redundancia **se ve** en pantalla.

---

<a id="obs-05"></a>
### OBS-05 · El sidebar no scrollea: había funcionalidad inalcanzable ✅ 🟢

**Qué se observó.** Con un submenú expandido no se llega a los ítems de abajo ni al bloque de usuario
con "Cerrar sesión".

**Dónde.** `src/components/shared/app-shell.tsx` — el `<nav>` era `flex-1` sin `min-h-0` ni overflow,
así que crecía más que el viewport y empujaba el bloque de usuario fuera de pantalla.

**Verificación.** Confirmada y medida: con los 6 grupos expandidos el nav mide **1196px** contra un
alto disponible de 597px (1440), 481px (768) y 448px (375). Sin scroll, todo lo que pasaba de esa
altura era inalcanzable, incluido "Cerrar sesión".

**Estado: resuelta** — commit `aafbdd6`. El nav scrollea con barra discreta y el bloque de usuario
quedó fijo abajo. Verificado en los tres anchos, y verificado que no se rompió el contrato del drawer
móvil (foco atrapado, Escape, scroll-lock).

---

<a id="obs-06"></a>
### OBS-06 · El logo del sidebar queda chico ✅ 🟢

**Qué se observó.** El logo queda chico para el ancho del sidebar.

**Dónde.** `src/components/shared/app-shell.tsx` — el logo estaba en `h-9`.

**Verificación.** Confirmada y medida: 64px de ancho sobre un sidebar de 256px, el **25%**.

**Estado: resuelta** — commit `aafbdd6`. Pasó a `h-14`: 100px, el **39%** del ancho, con la cabecera
de `h-20` a `h-24` para que respire (20px arriba y abajo). El ícono del estado colapsado quedó en el
51% de los 76px.

---

<a id="obs-07"></a>
### OBS-07 · El sidebar no tiene la identidad visual del login ✅ 🟢

**Qué se observó.** El sidebar se ve plano; el panel izquierdo del login se ve bien.

**Dónde.** `src/components/shared/app-shell.tsx` vs. `src/app/(auth)/login/page.tsx:48-59`.

**Verificación.** Confirmada, con una precisión útil: **el degradado ya era el mismo**
(`from-sidebar-from to-sidebar-to` en las dos). Lo que hacía la diferencia eran los **tres círculos
difuminados** del login, que el sidebar no tenía.

**Estado: resuelta** — commit `aafbdd6`. Se llevaron los mismos tres círculos con los tokens que ya
existían (`pastel-blue`, `primary`), y se subió el contraste del texto. **No se tocó el fondo del ítem
activo**: `docs/design-system.md` §5.1 lo fija en `rgba(255,255,255,.07)` *"sutil, no un color sólido
fuerte"*, y es una decisión aprobada con el cliente. Contraste medido sobre el fondo real: el peor
caso de la pantalla es **6.34:1**, sobre el mínimo AA de 4.5:1.

---

<a id="obs-08"></a>
### OBS-08 · Invitar colaborador con el selector de rol vacío y sin salida ✅ 🔵

**Qué se observó.** Un negocio nuevo no tiene roles propios, y los predefinidos no se ofrecen
(correcto: son globales). Pero el diálogo no explica nada ni ofrece crear un rol, y hay que cerrarlo
perdiendo lo escrito.

**Dónde.**
- `src/app/app/(shell)/mi-negocio/colaboradores/colaboradores-cliente.tsx:486` — `roles={roles.filter((r) => !r.esRolSistema)}`: el filtro que deja el selector vacío
- `.../colaboradores-cliente.tsx:143-160` — el bloque del selector: sin texto de ayuda, sin atajo
- `src/components/shared/gasto-form.tsx:101-112` — el patrón que sí lo resuelve: `<div className="flex items-center justify-between">` con el `<Label>` y un `+ Crear nueva` en la misma fila

**Verificación.** Confirmada íntegra. El filtro es correcto (asignar Owner o CEOM Admin desde ahí
sería un problema de seguridad), y el resultado es un `<Select>` vacío sin explicación. El diálogo
**tampoco tiene botón Cancelar**: se sale por la X o por Escape.

**Lo que le falta**, copiando el patrón de Gastos: el `+ Crear rol` en la fila del label, un texto que
explique por qué está vacío, y un Cancelar explícito.

**Relación con otros registros.** La causa de fondo es **H-35** (ver OBS-09). La falta de Cancelar no
tiene identificador previo: UI-026 cubre patrones de confirmación destructiva y UI-039 el string
"Close" del `Dialog`, ninguno cubre esto.

---

<a id="obs-09"></a>
### OBS-09 · Un negocio nuevo no tiene ningún rol ✅ ⏸️

**Qué se observó.** No hay roles por defecto. Hay una propuesta escrita esperando decisión.

**Dónde.**
- `src/modules/identidad/repository.ts:210-238` — `crearTenantConOwner()` inserta tenant, sucursal y usuario Owner. Nada más.
- No existe ninguna función tipo `sembrarRolesDefault` en todo el repo. El único seed conectado al alta de negocio es `sembrarCategoriasGastoDefault()`, conectado en la tanda de DA-01.
- `docs/manual/propuesta-roles-por-defecto.md` — la propuesta esperando decisión.

**Verificación.** Confirmada.

**Relación con otros registros.** 🟣 Es **H-35** (*"No hay roles predefinidos: la grilla de permisos
arranca en blanco"*). ⏸️ No es un defecto a corregir sino **una decisión de producto pendiente**:
cuáles y cuántos roles.

> 📌 **Corregir de paso:** `hallazgos.md:811` dice *"Un negocio nuevo tiene dos roles"*. Son **tres**
> desde la migración `0034` — el tercero es el del Gateway (OBS-10). El mismo conteo desactualizado
> está en `src/modules/identidad/schema.ts:179-180`, que enumera *"(tenant_id null: Owner, CEOM
> Admin)"* justo antes de la regla dura de la policy: es el lugar exacto donde alguien va a leer
> antes de tocar esto.

---

<a id="obs-10"></a>
### OBS-10 · El rol interno del Gateway es visible para el dueño ✅ 🔵

**Qué se observó.** En `/app/mi-negocio/roles` el dueño ve un rol "Gateway de Consentimiento
(sistema)". Es la identidad interna del backstop de RLS y no debería ser visible. Además la tarjeta
dice a la vez "Rol predefinido" y "Rol personalizado de tu negocio".

**Verificación: confirmada en sus dos partes.** El diagnóstico completo está abajo; **no se corrigió
nada todavía**, a pedido.

#### Por qué existe el rol

`drizzle/migrations/0034_gateway_sistema_seed.sql:17-24` lo siembra en la Etapa 4.a del backstop de
RLS, con `tenant_id = null` y `es_rol_sistema = true`. Es un rol **propio a propósito**: el comentario
de la migración explica que reusar `ROL_CEOM_ADMIN_ID` haría que el Gateway heredara cualquier bypass
presente o futuro de un `ceom_admin` humano — exactamente la regresión que la etapa existe para
evitar. **Esa separación no se toca.**

#### Por qué aparece en la pantalla

`src/modules/identidad/repository.ts:92-94`:

```sql
where eliminado_en is null
  and (tenant_id = $tenantId or tenant_id is null)
```

La rama `or tenant_id is null` está para que el dueño vea los roles globales (Owner, CEOM Admin). El
rol del Gateway se sembró con `tenant_id = null`, así que **cae en esa misma rama** y se cuela en la
lista de todos los negocios.

#### Por qué la tarjeta se contradice

Son dos fuentes distintas para el mismo rol, en `roles-cliente.tsx`:

- **el badge** sale de la columna: `{rol.esRolSistema && <Badge>Rol predefinido</Badge>}` (`:351`) → verdadero
- **el texto** sale de un mapa indexado por nombre: `DESCRIPCION_SISTEMA[rol.nombre] ?? "Rol personalizado de tu negocio."` (`:381`), y el mapa solo tiene las claves `"Owner"` y `"CEOM Admin"` (`:73-76`) → cae en el fallback

#### Hasta dónde llega la fuga

**Solo a la pantalla de Roles.** Es visible, pero **no asignable**: los dos selectores que consumen
esa lista la reciben ya filtrada en el call site — `roles.filter((r) => !r.esRolSistema)` en
`colaboradores-cliente.tsx:486` (invitar) y `:493` (editar rol) — y el consumidor de Capacidades
también filtra por `!esRolSistema` (`identidad/actions.ts:904`).

Tampoco se cuela en Colaboradores: el **usuario** del Gateway vive en `CEOM_OPS_TENANT_ID`
(`0034:56`), el tenant interno "CEOM Ops", no en el de ningún cliente.

#### Qué filtro corresponde, y por qué es seguro

**Excluir por UUID (`ROL_GATEWAY_SISTEMA_ID`) en `listarRoles()`** (`identidad/actions.ts:772-779`),
que es la capa de presentación.

**No** hay que tocar la rama `tenant_id is null` del repositorio — eso escondería también Owner y CEOM
Admin. **No** hay que poner `es_rol_sistema = false` (lo volvería asignable y editable). **No** hay
que borrar la fila ni tocar la policy de RLS de `roles`.

**El riesgo sobre el portal institucional es nulo, y es verificable:** la autorización del Gateway es
**por id de usuario**, nunca por la lista de roles.

| Vía | Ancla | Archivo |
|---|---|---|
| Permisos de aplicación | `solicitante.id === GATEWAY_SISTEMA_USUARIO_ID` | `identidad/actions.ts:97` |
| Bypass de RLS | `u.id = 'b4e2d0a3-…'` | `0035_es_gateway_sistema_function.sql:22-27` |
| Resolución del solicitante | `obtenerUsuarioConRolPorId(GATEWAY_SISTEMA_USUARIO_ID)` | `identidad/actions.ts:290` |
| Contexto de la transacción | `fijarContextoYExigirTenant(tx, GATEWAY_SISTEMA_USUARIO_ID)` | `db/contexto.ts:202` |

Ninguna lee `listarRolesPorTenant()`. Un filtro de presentación no puede alcanzarlas.

> ⚠️ **Al implementarlo, la constante correcta es `ROL_GATEWAY_SISTEMA_ID`, no
> `GATEWAY_SISTEMA_USUARIO_ID`.** `identidad/actions.ts` hoy importa la segunda (`:9`) y **no** la
> primera; hay que agregarla al import o no compila.

#### Un hallazgo nuevo que salió del diagnóstico

El **usuario** del Gateway es suspendible desde la interfaz. Si algún día existe un Owner en el tenant
"CEOM Ops", ese Owner vería al Gateway en su lista de Colaboradores y podría suspenderlo. Y fallaría
**en silencio**: `es_gateway_sistema()` exige `and u.activo` (`0035:27`), así que el bypass dejaría de
aplicar, pero `current_tenant_id()` no mira `activo` — el contexto se resolvería igual, no se lanzaría
ningún error, y **el portal institucional devolvería ceros** en vez de fallar. Es el modo de falla que
el comentario de `db/contexto.ts:112-118` dice explícitamente que hay que evitar.

**No es alcanzable hoy:** `scripts/seed-admin.ts:94` crea al `ceom_admin` con `esOwner: false`, y
`colaboradores/page.tsx:9` redirige si no sos Owner, así que hoy no existe ningún Owner en CEOM Ops.
Es una bomba que se arma sola el día que alguien cree uno. La guarda que corresponde es server-side,
en `suspenderUsuario()`; filtrar la lista sería solo cosmética.

**Relación con otros registros.** Sin identificador previo — `grep -i gateway` no da ningún hit en
`AUDITORIA-UI-UX.md`. Si se le abre uno, **UI-047** y **H-49** están libres. Al hacerlo, cruzarlo con
**UI-034**, que ya cubre accesibilidad en este mismo bloque de `roles-cliente.tsx` (a 15 líneas), para
no abrir dos entradas para lo mismo.

---

## Pendientes de esta ronda que no son observaciones

Cosas que aparecieron al verificar, y que conviene no perder:

| Qué | Dónde | Nota |
|---|---|---|
| **UI-045 está mal marcado como resuelto** | `AUDITORIA-UI-UX.md:1408` | Ver la corrección aplicada más abajo. |
| Conteo desactualizado de roles de sistema | `hallazgos.md:811`, `identidad/schema.ts:179-180` | Dicen "dos", son tres desde `0034`. Ver OBS-09. |
| Nada de esta ronda se verificó corriendo la app | — | Las observaciones se verificaron **leyendo el código**. Para OBS-10 en particular, nadie confirmó que la migración `0034` esté aplicada en el entorno donde se hizo la prueba manual. |

### Corrección aplicada: UI-045

Al verificar OBS-09/OBS-10 apareció que **UI-045 quedó marcado como resuelto sin estarlo**. El
renombrado `Owner → Dueño` se aplicó con `nombreRolVisible()` en las pantallas de Mi Negocio, pero
**no** en los dos lugares donde más se lee:

- `src/components/shared/app-shell.tsx:492` — `{rolNombre} · {tenantNombre}`, alimentado con
  `usuario.rol.nombre` crudo desde `(shell)/layout.tsx:34`. Es el sidebar: se ve en **todas** las
  pantallas.
- `src/app/app/(shell)/mi-cuenta/page.tsx:35` — `{usuario.rol.nombre}` bajo la etiqueta "Rol".

Corregido en esta tanda.
