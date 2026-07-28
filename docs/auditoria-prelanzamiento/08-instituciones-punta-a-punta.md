# Instituciones de punta a punta (H-42) — diagnóstico y diseño técnico

> Documento de diagnóstico, **sin una línea de código de producción tocada**. Generado el 2026-07-27
> sobre `dev`. Cada afirmación está verificada contra el código real con cita `archivo:línea`, o
> contra la base de desarrollo real (`riertvgnjaujstwyqoom`) vía consultas de solo lectura —
> `pg_policies`, `pg_proc`, conteos, y una consulta con `set local role authenticated` dentro de una
> transacción con `rollback`. Nada se afirma desde lo que el diseño original (Modulo_11,
> `CEOM_Arquitectura.md` §8.1/§8.3) dice que *debería* pasar.
>
> Complementa [H-42 del manual de hallazgos](../manual/hallazgos.md#h-42), las tres guías de
> [`docs/manual/instituciones/`](../manual/instituciones/) y la §16 de
> [`docs/security/PLAN-RLS-BACKSTOP.md`](../security/PLAN-RLS-BACKSTOP.md).

---

## 0. Veredicto

**H-42 no es un arreglo chico, pero tampoco es un rediseño del modelo de consentimiento.**

El **modelo de datos ya soporta** una institución con cartera de varios negocios: `cartera_institucional`,
`aprobaciones_tenant` y `codigos_acceso.institucion_id` son todas N:M sobre `(institucion_id, tenant_id)`,
y el invariante de vigencia (`aprobaciones_tenant_vigente_unica`) está declarado **por par**, no por
institución. No hay que migrar ni una tabla para que una incubadora siga quince negocios.

Lo que está construido para un solo negocio es **el flujo**: no existe ningún camino —ni ruta, ni botón,
ni rama de código— por el que una institución autenticada llegue a canjear un segundo código. El
parámetro `institucionId` que `canjearCodigoAcceso()` acepta desde el día uno tiene **cero call-sites en
todo el repositorio**. La "corrección mínima" que propone H-42 (capturar la violación de unicidad) no
arregla nada: deja a la institución con un mensaje de error correcto y sin ninguna manera de canjear.

Y hay un segundo efecto de H-42 que el hallazgo original no registra, más grave que el del piloto:
**después de revocar, un negocio no puede volver a dar acceso a una institución que ya canjeó una vez.**
La única palanca de otorgamiento del Owner es generar un código; la única forma de consumirlo es el
formulario de canje; y ese formulario es inalcanzable para una institución ya registrada. La revocación
es, hoy, de una sola dirección — ver [§5.4](#54-revocar-es-irreversible-desde-app).

Alrededor de eso aparecieron **20 huecos verificados**, y **un punto ciego de entorno que hace que hoy
nadie pueda entrar al portal autenticado**. El detalle de cada uno abajo.

> **Actualización del 2026-07-27 (tanda 3.1).** Al verificar el cruce con sucursales múltiples
> aparecieron tres hallazgos más, y **uno de ellos desplazó a H-42 del primer lugar por consecuencia**:
> el estado de resultados se le sirve a la institución presentado como completo sin serlo (X-01, §4.6).
> Los tres resultaron ser casos del mismo defecto —marcadores de completitud que existen y no se
> propagan al tercero— que quedó escrito como **principio rector #7** del producto. Ver §4.6-4.8 y §10.

### Tabla de hallazgos

| ID | Sev. | Hallazgo | §  |
|---|---|---|---|
| G-01 | 🟡 | Un Código de Acceso no vence nunca — el manual promete que sí | [2.1](#21-código-de-acceso-máquina-de-estados-real) |
| G-02 | 🟠 | El canje no es atómico: tres escrituras sueltas, código quemado sin acceso | [2.1](#21-código-de-acceso-máquina-de-estados-real) |
| G-03 | 🟡 | El canje no tiene guarda de concurrencia: dos canjes simultáneos pasan los dos | [2.1](#21-código-de-acceso-máquina-de-estados-real) |
| G-04 | 🟠 | El canje es la única escritura sin autenticar del producto, sin límite de intentos ni traza | [2.1](#21-código-de-acceso-máquina-de-estados-real) |
| G-05 | 🟠 | Revocar no saca al negocio de la cartera — la institución lo sigue viendo (confirmado en datos vivos) | [5.2](#52-lo-que-la-revocación-no-corta) |
| G-06 | 🟡 | `fecha_fin` del vínculo no se aplica ni se muestra | [2.2](#22-relación-institución-negocio-máquina-de-estados-real) |
| G-07 | 🟡 | Borrar una institución deja su correo bloqueado para siempre y su consentimiento vigente | [2.2](#22-relación-institución-negocio-máquina-de-estados-real) |
| G-08 | 🔴 | **H-42**: no hay camino para canjear un segundo código | [1](#1-la-causa-raíz-de-h-42) |
| G-09 | 🟡 | El camino 2 (CEOM) no acopla cartera y solicitud a nivel de acción | [3.2](#32-el-camino-2-como-circunvalación-cuánto-aguanta) |
| G-10 | ⚪ | Nada es masivo: 15 negocios = 15 códigos, 15 canjes, 30 diálogos de `/admin` | [3.2](#32-el-camino-2-como-circunvalación-cuánto-aguanta) |
| G-11 | 🟠 | El backstop de RLS es por tenant, **no por institución** (deuda declarada, agravada por la cartera) | [4.1](#41-lo-que-rls-sí-sostiene-hoy-verificado-en-vivo) |
| G-12 | 🟠 | El backstop cubre 1 de los 4 tabs del portal; los otros 3 corren sin piso de RLS | [4.1](#41-lo-que-rls-sí-sostiene-hoy-verificado-en-vivo) |
| G-13 | 🟠 | `instituciones` es legible entera por cualquier `authenticated`, con los correos (verificado en vivo) | [4.2](#42-instituciones-un-catálogo-que-dejó-de-serlo) |
| G-14 | 🟠 | Producción e Insumos muestran vacío para un negocio de otro nicho — el manual afirma lo contrario | [4.3](#43-el-agregado-que-miente-producción-e-insumos-de-un-negocio-que-no-produce) |
| G-15 | 🟠 | Si una pestaña falla, queda en "Cargando..." para siempre | [4.4](#44-el-error-que-nunca-llega-a-la-pantalla) |
| G-16 | 🟡 | La misma identidad de Auth puede ser Usuario de un tenant e Institución a la vez (ya pasa en los datos) | [4.5](#45-una-identidad-de-auth-dos-sombreros) |
| G-17 | 🟠 | Revocar es irreversible desde `/app`: no hay forma de volver a otorgar | [5.4](#54-revocar-es-irreversible-desde-app) |

Severidad: 🔴 tarea imposible o dato incorrecto sin aviso · 🟠 consecuencia real, con circunvalación ·
🟡 fricción o promesa incumplida · ⚪ falta de producto, no defecto.

### Hallazgos agregados el 2026-07-27 (tanda 3.1) — el cruce con sucursales

Agregados después de aprobado el documento, al verificar el cruce entre este subsistema y el de
sucursales múltiples ([07-sucursales-multiples.md](07-sucursales-multiples.md)): ninguno de los dos
diagnósticos había mirado al otro, cada uno asumió que el otro lo cubría.

| ID | Sev. | Hallazgo | § |
|---|---|---|---|
| X-01 | 🔴 | El marcador de completitud de H-15 se descarta en la capa institucional | [4.6](#46-x-01--el-marcador-de-h-15-se-descarta-para-la-institución) |
| X-02 | 🟠 | Una sucursal congelada vuelve parcial el dato, y nada lo dice | [4.7](#47-x-02--una-sucursal-congelada-vuelve-parcial-el-dato) |
| X-03 | 🟠 | El re-proyectado a mano de `detalleFinanciero()` es una fábrica de X-01 | [4.8](#48-x-03--el-defecto-común-y-por-qué-va-a-repetirse) |

---

## 1. La causa raíz de H-42

### 1.1 Lo que el diagnóstico previo dijo, y qué parte sobrevive

H-42 afirma dos cosas. **Las dos son correctas**, verificadas línea por línea:

1. El asistente siempre manda `institucionNueva` y nunca `institucionId`
   (`src/app/portal/canjear-cliente.tsx:57-65`), y el tipo de `canjearCodigoAccesoAction`
   (`src/app/portal/actions.ts:21-26`) lo declara **obligatorio** — ni siquiera es opcional en la
   Server Action, así que un llamador futuro tampoco podría pasar solo `institucionId` sin tocar esa
   firma.
2. `canjearCodigoAcceso` llama a `repo.crearInstitucion()` de forma incondicional cuando no recibe
   `institucionId` (`src/modules/consentimiento/actions.ts:468-481`), y `instituciones.email` tiene
   índice único parcial (`src/modules/consentimiento/schema.ts:78-80`).

### 1.2 Dos precisiones que cambian el arreglo

**Precisión 1 — el código NO se quema.** El orden de las escrituras importa y H-42 no lo dice:
`crearInstitucion()` corre en la línea 473, **antes** de `actualizarCodigoAcceso(...estado:"canjeado")`
en la 485. La excepción de unicidad se levanta en la primera, así que el `codigos_acceso` queda intacto
en `activo`. La institución pierde el intento, no el código. Es el único aspecto de H-42 más benigno de
lo documentado.

**Precisión 2 — el síntoma es peor que "un error genérico de Next.js".** `confirmarCanje`
(`canjear-cliente.tsx:46-72`) hace `await canjearCodigoAccesoAction(...)` sin `try/catch`. Cuando la
Server Action rechaza, la ejecución de esa función se corta: **`setEnviando(false)` nunca corre**. El
botón queda en "Confirmando..." de forma permanente. Y no hay ningún `error.tsx` en todo `src/app/`
(verificado: cero archivos), así que tampoco hay error boundary que muestre nada. Lo que la institución
ve no es un error feo: es una pantalla congelada sin ninguna señal.

### 1.3 El hallazgo estructural que H-42 no registra

H-42 propone como arreglo "mejor": *permitir canjear un código estando ya autenticada en el portal —la
sesión ya resuelve `obtenerInstitucionActual()`— y pasar ese `institucionId`, que es el parámetro que
la función ya acepta y que nadie usa.*

**Ese arreglo no es cablear un parámetro: es construir una superficie que no existe.**
`src/app/portal/page.tsx:26-35`:

```tsx
const institucion = await obtenerInstitucionActual();
...
if (institucion) {
  const [carteraRes, planes] = await Promise.all([listarCarteraAction(), listarPlanes()]);
  return <CarteraCliente ... />;   // ← única salida posible con sesión
}
return ( ... <CanjearCliente /> ... );  // ← inalcanzable con sesión
```

`/portal` es una sola ruta con una bifurcación binaria: **con sesión, Cartera; sin sesión, Canje.** No
hay `/portal/canjear`, no hay botón "Canjear otro código" en `CarteraCliente` (leído entero: 193 líneas,
ningún enlace fuera de `/portal/cartera/[tenantId]`), y `PortalTopbar` tampoco lo ofrece. El
`institucionId` de `canjearCodigoAcceso()` tiene **cero call-sites en `src/`**.

Sumado a eso, dos señales más de que el flujo se pensó para un canje único en la vida:

- La copia del paso 2 del asistente dice *"No encontramos una cuenta con este código todavía —
  completá estos datos para crear tu perfil de institución"* (`canjear-cliente.tsx:236-238`). **El
  código nunca busca nada**: `continuarConCodigo()` (líneas 37-44) solo valida que el campo no esté
  vacío y salta al paso `institucion`. Es una afirmación falsa presentada como resultado de una
  búsqueda.
- La copia de éxito dice *"El panel donde vas a ver los datos compartidos está por construirse"*
  (`canjear-cliente.tsx:94-96`). El panel existe desde el ítem #11 del roadmap. Texto muerto de una
  tanda anterior.

### 1.4 ¿Estructural o puntual? La respuesta precisa

| Capa | ¿Soporta cartera múltiple? | Evidencia |
|---|---|---|
| **Esquema** | ✅ Sí, sin cambios | `cartera_institucional`, `aprobaciones_tenant`, `codigos_acceso.institucion_id` son todas N:M; el índice único de vigencia es por `(institucion_id, tenant_id)` |
| **Repository** | ✅ Sí, sin cambios | `listarCarteraPorInstitucion()` filtra solo por institución y devuelve N filas |
| **Actions** | 🟡 Casi | `canjearCodigoAcceso(institucionId)` ya existe; le falta la rama de "ya autenticada" y el manejo de unicidad |
| **UI `/portal`** | ❌ No | Una ruta, bifurcación binaria, sin camino al canje con sesión |
| **UI `/app`** | ❌ No para re-otorgar | Ver [§5.4](#54-revocar-es-irreversible-desde-app) |
| **Datos reales** | ❌ Nunca existió | Máximo de negocios por institución en la base viva: **1** (ver [§6](#6-el-punto-ciego-del-entorno-de-prueba)) |

**Conclusión:** el corazón del trabajo no es rediseñar el consentimiento. Es **cerrar el ciclo de vida
del canje** (una superficie de UI nueva + 2 ramas de acción) y **arreglar los huecos que el modelo de
un-solo-negocio dejó pasar** (§2, §4, §5). Es una tanda mediana con riesgo de privacidad concentrado en
§4, no una migración.

---

## 2. Ciclo de vida completo: código y consentimiento

### 2.1 Código de Acceso: máquina de estados real

```
                    generarCodigoAcceso()            canjearCodigoAcceso()
   (no existe) ─────────────────────────►  activo ─────────────────────────► canjeado
                  Owner del tenant;           │                                  │
                  valida modulosHabilitados   │                                  │
                  contra plan.modulos_        │ revocarCodigoAcceso()            │ revocarCodigoAcceso()
                  veedor_permitidos           ▼                                  ▼
                                          revocado ◄─────────────────────────  revocado
                                                     (+ revoca la Aprobación
                                                      nacida de ese código)
```

Tres estados (`estado_codigo_acceso`: `activo` / `canjeado` / `revocado`,
`schema.ts:36-40`), y **ninguna transición por tiempo**.

| Pregunta | Respuesta verificada |
|---|---|
| ¿Qué contiene el código? | 8 caracteres de un alfabeto de 32 sin `0/O/1/I` (`actions.ts:49-58`), aleatorio con `randomBytes`. El código en sí no lleva información: `modulos_habilitados`, `tenant_id` y `creado_por` viven en la fila. |
| ¿Vence? | **No.** `codigos_acceso` no tiene columna de vencimiento (`schema.ts:200-229`). **G-01** |
| ¿Se puede revocar? | Sí, en cualquier estado ≠ `revocado`. `revocarCodigoAcceso()` además revoca la Aprobación que nació de él, vía `aprobaciones_tenant.codigo_acceso_id` (`actions.ts:432-450`). Con test (`consentimiento.test.ts:331-357`). |
| ¿Se puede canjear dos veces? | No: `if (!codigoRow \|\| codigoRow.estado !== "activo")` (`actions.ts:463-466`). Con test (caso borde 6, `consentimiento.test.ts:321-326`). |
| ¿Es de un solo uso por diseño? | Sí — pero eso significa que **el vínculo institución↔negocio es 1 código = 1 negocio**, que es exactamente lo que rompe el piloto. |

**G-01 🟡 — El código no vence, y el manual dice que sí.**
`instituciones/01-primer-acceso.md:41-42`: *"Si el código está mal escrito, **vencido** o revocado, el
error aparece recién al confirmar el segundo paso."* No existe ningún mecanismo de vencimiento. El
mensaje de error del canje también lo afirma (`actions.ts:465`: *"Código inválido, ya utilizado o
revocado"* — ese sí es correcto). Consecuencia real: un código compartido por WhatsApp hace ocho meses
sigue otorgando acceso completo hoy, y el Owner no tiene ninguna señal de que ese código sigue vivo
salvo entrar a la pantalla de códigos.

**G-02 🟠 — El canje no es atómico.** `canjearCodigoAcceso()` hace **tres escrituras sueltas**, fuera de
toda transacción (`actions.ts:485-501`): marcar el código `canjeado`, `agregarACartera()`,
`crearAprobacionTenant()`. Si la segunda o la tercera fallan, el código ya quedó `canjeado` —
irrecuperable, porque no hay acción que lo vuelva a `activo`— y la institución quedó creada, sin cartera
o sin aprobación. Es la misma clase de defecto que [H-40](../manual/hallazgos.md#h-40) en Producción,
con un agravante: acá el actor no tiene soporte dentro del producto ni forma de reintentar.
`crearAprobacionTenant()` sí es transaccional internamente (`repository.ts:187-202`), pero eso protege
su propio invariante, no el canje completo.

**G-03 🟡 — Sin guarda de concurrencia.** El chequeo es un `SELECT` (`obtenerCodigoAccesoPorCodigo`) y la
escritura es un `UPDATE ... WHERE id = ?` sin condición sobre `estado`
(`repository.ts:281-300`). Dos canjes simultáneos del mismo código pasan los dos el `if`, y quedan dos
instituciones con acceso al mismo negocio. Probabilidad baja (requiere que el código circule por dos
manos a la vez), consecuencia de privacidad. Se cierra con un `WHERE estado = 'activo'` y verificando
las filas afectadas — o gratis, al meter el canje en una transacción por G-02.

**G-04 🟠 — La única escritura sin autenticar del producto, sin límite ni traza.**
`canjearCodigoAccesoAction` (`portal/actions.ts:21-26`) es la única Server Action del proyecto que no
resuelve sesión antes de escribir — deliberado y correcto (la institución no tiene cuenta todavía). Lo
que falta alrededor:

- **Sin límite de intentos.** No hay rate limiting en ninguna capa. El espacio de claves (32⁸ ≈ 1,1×10¹²)
  hace inviable la fuerza bruta, así que el riesgo **no** es adivinar un código; es que cada intento
  fallido es gratis y silencioso, y que un código filtrado se canjea sin fricción alguna.
- **Sin traza de acceso institucional.** `logs_acceso_admin_ceom` registra las lecturas del **equipo
  CEOM** (`schema.ts:236-254`), no las de una institución. **No existe ningún registro de qué institución
  leyó qué negocio, ni cuándo.** Para el único punto de privacidad de la plataforma
  (`CEOM_Arquitectura.md` §6.9), es un hueco de auditoría, no una feature faltante: si un negocio
  pregunta "¿qué vio la incubadora de mis números?", hoy no hay respuesta posible.

### 2.2 Relación institución-negocio: máquina de estados real

Son **dos entidades distintas** que la interfaz presenta como una, y su desincronización explica casi
todos los huecos de esta sección:

```
  cartera_institucional      ── "qué negocios seguís"   → decide QUÉ SE VE EN LA LISTA
  aprobaciones_tenant        ── "qué te dejaron ver"    → decide QUÉ DATOS SE SIRVEN
```

| Camino | Crea cartera | Crea aprobación | Quién dispara |
|---|---|---|---|
| **1 — canje de código** | ✅ `agregarACartera()` | ✅ `crearAprobacionTenant()` | La institución, sin cuenta |
| **2 — solicitud CEOM** | ❌ acción separada | ✅ al aprobar el Owner | CEOM crea; el Owner aprueba |

Estados de una Aprobación: `vigente` (`revocado_en is null` **y** es la más reciente del par) /
`revocada` / `histórica`. El invariante `aprobaciones_tenant_vigente_unica` (índice único parcial,
migración `0037`) garantiza **a lo sumo una vigente por par**, y `crearAprobacionTenant()` revoca la
anterior atómicamente antes de insertar (`repository.ts:187-202`). Esta parte está sólida, con dos tests
que la cubren, incluido uno que verifica la constraint real de base (`consentimiento.test.ts:359-395`).

**G-05 🟠 — Revocar no saca al negocio de la cartera.** Ni `revocarConsentimiento()` ni
`revocarCodigoAcceso()` tocan `cartera_institucional` (`actions.ts:336-347` y `432-450`). Consecuencia:
la institución **sigue viendo el negocio en su cartera para siempre** — con nombre, rubro, plan y estado
de suscripción— con las cuatro pestañas bajo candado. Y `estaEnCartera()` (que gatea `estadoTenant`,
`monitoreo-institucional/actions.ts:42-46`) sigue devolviendo `true`, así que la ficha también abre.

Verificado en la base viva: **2 filas de cartera sin ninguna aprobación vigente**, una de ellas de una
institución ya borrada (soft delete). No es hipotético, ya está pasando.

Es defendible como decisión de producto ("la cartera la administra CEOM, el acceso lo da el negocio" —
es literalmente lo que dice `instituciones/02-tu-cartera.md:56-62`), pero **no es lo que el negocio
espera al tocar "Revocar"**: el Owner cree que cortó el vínculo y la institución sigue viendo el nombre
de su negocio, su rubro y si está al día con la suscripción. Necesita decisión explícita — ver
[D-3](#d-3--qué-pasa-con-la-cartera-cuando-el-negocio-revoca).

**G-06 🟡 — `fecha_fin` del vínculo es decorativa.** `cartera_institucional.fecha_fin` existe
(`schema.ts:100`), `listarCartera()` la devuelve (`monitoreo-institucional/actions.ts:58`) — y de ahí no
la lee nadie: `estaEnCartera()` no la compara contra la fecha de hoy, y la interfaz **ni siquiera la
renderiza** (`cartera-cliente.tsx:13-24`, la interfaz `FilaCartera` no declara el campo). El manual la
promete como columna visible (`02-tu-cartera.md:18`: *"Fecha de inicio y de fin | Del vínculo con tu
institución"*) y más abajo admite a medias el problema (*"la fecha se muestra pero no dispara nada"*,
línea 86) — cuando en realidad **ni se muestra ni dispara**. Un convenio con fecha de cierre no cierra
nada.

**G-07 🟡 — Borrar una institución la deja a medio morir.** `eliminarInstitucionSoft()` marca
`eliminado_en` y nada más (`repository.ts:48-55`). Queda así:

- Su **correo sigue ocupado para siempre**: `instituciones_email_unique` es parcial sobre
  `email is not null`, **no excluye `eliminado_en`** (`schema.ts:78-80`). Esa dirección no se puede
  volver a usar nunca — ni por la misma institución dándose de alta de nuevo. Y como
  `obtenerInstitucionPorEmail()` sí filtra `eliminado_en` (`repository.ts:91-98`), el magic link
  responde el mensaje genérico de éxito y no manda nada: callejón sin salida perfecto.
- Sus **aprobaciones siguen vigentes** y sus **filas de cartera siguen vivas** (confirmado en datos: la
  institución borrada `b6b3c93e` conserva su fila de cartera).
- Su **nombre deja de resolver**: `obtenerInstitucionPorId()` filtra `eliminado_en`
  (`repository.ts:27-34`), así que la pantalla de Aprobaciones del Owner cae al literal `"Institución"`
  (`aprobaciones/page.tsx:52`). El Owner ve un permiso vigente otorgado a *"Institución"*, sin nombre.

---

## 3. ¿El modelo soporta una institución con cartera?

### 3.1 Sí en los datos, no en el flujo

Ya respondido en [§1.4](#14-estructural-o-puntual-la-respuesta-precisa): el esquema y el repository
soportan N negocios por institución sin tocar nada. Lo que falta es el camino.

**G-08 🔴** es H-42 y es el bloqueante: la incubadora del piloto con quince emprendimientos recibe
quince códigos y puede canjear exactamente uno.

### 3.2 El camino 2 como circunvalación: cuánto aguanta

El manual propone como salida pedirle a CEOM que use el camino 2
(`instituciones/01-primer-acceso.md:54-56`). Funciona, y llega al mismo estado final. Su límite es
operativo:

**G-09 🟡 — Cartera y solicitud no están acopladas a nivel de acción.** `agregarTenantACartera()` y
`crearSolicitudSeguimiento()` son independientes (`consentimiento/actions.ts:218-232` y `271-283`), y
nada en la capa de acciones impide crear una solicitud para un tenant que no está en la cartera. Si eso
pasa y el Owner la aprueba, la institución **tiene consentimiento sobre un negocio que no ve en su
cartera** — acceso invisible, imposible de auditar desde el portal.

La interfaz de `/admin` sí lo evita: `NuevaSolicitudDialog` se alimenta de `tenantsEnCartera`
(`instituciones-cliente.tsx:751-762`), así que por pantalla la solicitud solo se puede crear sobre un
negocio ya vinculado. **La regla existe en la UI y no en el contrato** — exactamente el patrón que
[§3.1 de 07-sucursales-multiples.md](07-sucursales-multiples.md) marcó como hueco de autorización real.

**G-10 ⚪ — Nada es masivo.** Para una cohorte de quince: quince Owners generan quince códigos de a uno
(no hay generación múltiple), y por el camino 2 son **treinta diálogos de `/admin`** (quince vincular +
quince solicitud), más quince aprobaciones de quince Owners distintos. Es viable para el piloto y no
escala más allá. No es un defecto: es alcance de producto que conviene decidir a conciencia, no
descubrir en la primera cohorte.

---

## 4. Aislamiento: ¿lo que ve la institución es verdad?

### 4.1 Lo que RLS sí sostiene hoy (verificado en vivo)

Consultado `pg_policies` y `pg_proc` contra la base real. **El backstop está intacto**, exactamente como
lo dejó la Etapa 4.b.0:

| Objeto | Estado real |
|---|---|
| `tenant_tiene_consentimiento_vigente(uuid, modulo_veedor)` | Existe, `STABLE SECURITY DEFINER`, `search_path` fijado a `public, pg_temp`. Cuerpo: `exists(select 1 from aprobaciones_tenant where tenant_id = $1 and revocado_en is null and $2 = any(modulos_aprobados))` |
| `compras_gateway_sistema_bypass` | `SELECT` / `authenticated` / `es_gateway_sistema() AND tenant_tiene_consentimiento_vigente(compras.tenant_id,'financiero')` |
| `compras_ajuste_gateway_sistema_bypass` | Ídem, resolviendo el tenant vía `compras.id = compras_ajuste.compra_id` |
| `pagos_compra_gateway_sistema_bypass` | Ídem |
| Las 6 tablas de Consentimiento | RLS habilitado en las 6. `logs_acceso_admin_ceom`: **0 policies** (deny total para `authenticated`), tal como declara el esquema |

**G-11 🟠 — El backstop es por tenant, no por institución.** La función no recibe `institucion_id`: solo
sabe *"alguien tiene consentimiento vigente sobre este negocio para este módulo"*. **La distinción entre
institución A e institución B se toma únicamente en TypeScript**, en `tieneConsentimiento()`
(`consentimiento/actions.ts:369-383`).

Esto **no es un hallazgo nuevo**: está declarado como Etapa 4.b.1, diferida a propósito
(`docs/security/PLAN-RLS-BACKSTOP.md` §16.11 decisión 2, tabla de línea 50 — *"requiere plumbing nuevo
(GUC `request.gateway.institucion_id`); valor incremental real pero menor que el gap que 4.b.0 ya
cerró"*). Lo que cambia con el piloto es la **exposición**: mientras cada institución seguía un solo
negocio, un bug en `tieneConsentimiento()` filtraba de una institución a un negocio. Con carteras y
varias instituciones sobre los mismos tenants, el mismo bug filtra **de cualquier institución a
cualquier negocio consentido a cualquier otra**. La decisión de diferir 4.b.1 se tomó con un supuesto
que el piloto invalida — merece reabrirse, no revertirse a ciegas ([D-5](#d-5--se-reabre-la-etapa-4b1)).

**G-12 🟠 — El backstop cubre 1 de las 4 pestañas.** Las tres policies de gateway son de **Proveedores**
(`compras`, `compras_ajuste`, `pagos_compra`) y solo para `financiero`. Ninguna tabla de Ventas, Gastos,
Financiero ni Nicho 1 tiene policy de gateway — esos módulos no migraron a `comoUsuario()`, así que la
lectura institucional corre como `postgres` (bypass total de RLS). En términos de las pestañas del
portal:

| Pestaña | Módulo veedor | ¿Piso de RLS? |
|---|---|---|
| Tendencia de Ventas | `financiero` | ❌ (Ventas no migró) |
| Ventas y finanzas | `financiero` | 🟡 Parcial — solo el aporte de Proveedores |
| Producción | `operativo` | ❌ |
| Insumos y stock | `inventario_operativo` | ❌ |

No es una regresión: es el estado conocido y declarado del backstop, que avanza módulo por módulo. Se
registra acá porque el piloto de instituciones apoya su promesa de privacidad sobre esas cuatro
pestañas, y tres no tienen red.

### 4.2 `instituciones`: un catálogo que dejó de serlo

**G-13 🟠.** La policy es `instituciones_select_authenticated`: `SELECT`, rol `authenticated`,
`USING (true)`. Verificado en vivo dentro de una transacción con `rollback`, con un JWT sintético cuyo
`sub` no corresponde a ningún usuario del sistema:

```sql
set local role authenticated;
set local request.jwt.claims = '{"sub":"...0099","role":"authenticated"}';
select count(*), count(email) from public.instituciones;
--  8 filas, 6 correos
```

**Cualquier sesión autenticada —cualquier Owner, cualquier colaborador de cualquier tenant, cualquier
institución— puede leer la tabla entera de instituciones con sus correos**, vía PostgREST con la clave
pública `anon`. Incluye las borradas (RLS no filtra `eliminado_en`).

La justificación en el esquema (`schema.ts:42-45`) es *"catálogo global … mismo patrón que `planes`"* —
y era cierta cuando se escribió, en la migración `0017`. **`email` y `auth_user_id` llegaron después, en
la `0027`**, y nadie volvió a angostar la policy. La tabla dejó de ser un catálogo el día que ganó datos
de contacto y un identificador de identidad: **la justificación sobrevivió al cambio que la invalidó**.

Alcance real: son nombres y correos de instituciones, no datos de negocio de ningún tenant, y hace falta
una sesión válida. No es crítico. Pero es enumeración de PII de terceros, y contradice el criterio con
el que se gateó `listarInsituciones()` en su momento (ANCLA: *"enumeración (listado completo, sensible)
vs. lookup puntual por id ya conocido"*) — el gate de aplicación se cerró y la puerta de RLS quedó
abierta al lado.

### 4.3 El agregado que miente: Producción e Insumos de un negocio que no produce

**G-14 🟠.** El patrón que el usuario pidió buscar aparece, y en la peor forma posible: **no es un cero
consolidado, es un vacío que el manual enseña explícitamente a leer como "no hubo actividad".**

La cadena:

1. `detalleOperativo()` y `detalleInventarioOperativo()` llaman a `listarProducciones`,
   `consultarMermaPeriodo` y `listarInsumos` de **Nicho 1** (`monitoreo-institucional/actions.ts:26-30,
   167-226`).
2. Esas funciones **no verifican el nicho del tenant**. Verificado: `grep -n "nichoId|nicho_1|requiereNicho"`
   sobre `operativo/nichos/nicho-1/actions.ts` → **cero coincidencias**. Solo gatean por
   `tienePermiso(..., "operativo", "ver")`.
3. `generarCodigoAcceso()` valida los módulos contra `plan.modulos_veedor_permitidos`
   (`consentimiento/actions.ts:404-416`) — **contra el plan, nunca contra el nicho**. Un negocio de
   comercio minorista (`nicho_4`) o en Modo Básico (sin nicho) **puede compartir `operativo` e
   `inventario_operativo` sin ningún obstáculo**, y el plan "Básico" tiene los tres módulos veedor
   habilitados.
4. La institución abre esas pestañas y ve *"Sin producciones registradas"* y *"Sin insumos cargados"*
   (`ficha-cliente.tsx:236, 268`), **sin candado**, porque el consentimiento sí existe.

Y el manual le enseñó a leerlo mal, textualmente
(`instituciones/03-ver-un-negocio.md:37-38`):

> *"Una tabla vacía sin candado significa que sí tenés acceso y que ese negocio realmente no registró
> actividad."*

Para un negocio de otro nicho eso es **falso**: el negocio no registró actividad porque **no tiene ese
módulo**, no porque no produzca. Una incubadora con emprendimientos de rubros mixtos —el caso normal—
va a leer "no produjo nada" sobre un comercio que nunca tuvo producción que registrar. Es dato incorrecto
en pantalla, del tipo que el proyecto ya persiguió en H-15/H-16/H-49.

Cuatro salidas posibles, en [D-4](#d-4--qué-se-hace-con-los-módulos-veedor-que-no-aplican-al-nicho).

### 4.4 El error que nunca llega a la pantalla

**G-15 🟠.** Las cuatro cargas de la ficha tienen la misma forma (`ficha-cliente.tsx:102-110, 119-121`):

```tsx
tendenciaVentasAction(tenantId, periodo).then((r) => {
  if (vigente && r.ok) setVentas(r.data);   // ← si !r.ok, el estado queda en null
});
```

Y el render trata `null` como "cargando" (`ficha-cliente.tsx:204-205, 215-216, 228-229, 263-264`).
**Cualquier error de esas cuatro acciones deja la pestaña en "Cargando..." indefinidamente**, sin
mensaje, sin reintento y sin señal en consola. Alcanza a:

- La sesión de institución expirada — `portal/actions.ts:36-77` devuelve
  `{ok:false, error:"Tu sesión expiró — iniciá sesión de nuevo."}`. **Ese texto no se muestra nunca.**
- El `throw` deliberadamente ruidoso de `solicitanteGateway()` cuando la identidad de sistema está
  degradada (`identidad/actions.ts:313-320`), escrito explícitamente para *"cortar acá"* en vez de
  servir números incompletos. Corta en el servidor y en el cliente se ve como un spinner eterno.
- Cualquier fallo de RLS o de red.

Es el reverso exacto del cero silencioso: acá el dato incorrecto no es un número, es la ausencia de
cualquier señal. Arreglo chico y de alto valor (un estado `error` por pestaña).

### 4.5 Una identidad de Auth, dos sombreros

**G-16 🟡.** `consentimiento/actions.ts:145-159` documenta el supuesto:

> *"no hace falta ningún chequeo especial para evitar que una Institución se cuele como Usuario de un
> tenant: … nunca hay fila en `usuarios` con id = auth.uid() de una Institución"*

Ese supuesto se sostiene **solo si nadie usa el mismo correo en los dos lados**, y nada lo impide.
`vincularInstitucionAutenticada()` (`actions.ts:183-193`) no verifica si ese `authUserId` ya corresponde
a un Usuario de tenant. Si el dueño de un negocio pide un magic link con su propio correo de la
aplicación, su `auth.users` queda vinculado a una Institución **además** de a su fila de `usuarios`:
`obtenerUsuarioActual()` resuelve por `usuarios.id = auth.uid()` y `obtenerInstitucionActual()` por
`instituciones.auth_user_id = auth.uid()`; las dos devuelven fila y `/app` y `/portal` funcionan
simultáneamente con la misma sesión.

**Ya está sembrado en los datos**: la institución `"kevin sdasasds"` tiene `email = admin@ceom.lat` —
la dirección del operador de CEOM— y una aprobación vigente.

No es escalada de privilegios (por el portal solo se ve lo consentido a esa institución), pero rompe la
premisa sobre la que está construida la separación de identidades de `CEOM_Arquitectura.md` §8.3, y hace
que el modelo de "quién es quién" deje de ser una función. Corresponde al menos rechazar el vínculo
cuando el `authUserId` ya es un Usuario.

### 4.6 X-01 — El marcador de H-15 se descarta para la institución

**El hallazgo de mayor consecuencia de todo este documento.** Arreglo chico, consecuencia grande.

`estadoResultados()` devuelve **siete** campos, y uno de ellos no es un dato más:
`ingresosSinCostoConocido`, el campo que nació al corregir H-15, con su propósito escrito al lado
(`financiero/actions.ts:136-142`):

> *"El resultado de arriba **no cambia** por esto —no hay costo que restar—, pero deja de presentarse
> como completo: la pantalla puede decir 'de estos ingresos, Bs X no tienen costo cargado, tu margen
> real es menor'. **Marcar el hueco, nunca estimar un número para taparlo.**"*

`detalleFinanciero()` (`monitoreo-institucional/actions.ts:148-158`) reenvía **tres**: `flujoCaja`,
`estadoResultados`, `costoFijoTotal`. **El marcador se descarta ahí.** Idéntico en `tendenciaVentas()`
(líneas 112-124): `consultarIngresosPeriodo` devuelve `{ingresos, costos, ingresosSinCostoConocido}` y
reenvía solo `ingresos`.

Que se descarte la **descomposición** (`ingresos`, `gastos`, `ajustesVenta`, `ajustesCompra`) es
defendible: el portal es agregado por diseño y el manual lo declara. **Descartar el marcador de
completitud no lo es.** Es el único de los seis campos perdidos cuyo propósito entero es impedir que se
malinterprete el número que sí se muestra.

**La asimetría es total.** El marcador llega a cuatro pantallas del dueño —
`reportes/resumen-financiero-cliente.tsx:211-216` (*"Bs X de estos ingresos son de ventas sin costo
cargado"*), `reportes/ranking-productos-cliente.tsx:185`,
`reportes/margen-canal-producto-cliente.tsx:69-71,131,152,160` y
`simulaciones/margen-producto-cliente.tsx:187`. A la institución **no le llega en ninguna forma**.

**Por qué es 🔴 y no 🟠.** Es un número que se presenta completo sin serlo, **desviado siempre hacia el
lado optimista** (falta costo, nunca sobra), leído por el actor que menos contexto tiene para dudar de
él y que puede estar decidiendo financiamiento. Es el mismo modo de falla que este proyecto ya cerró
seis veces en la familia del número financiero (H-15, H-24, H-25, H-27, H-30, H-31), reapareciendo en la
única superficie donde nadie lo había buscado.

**Y el manual lo compensa en prosa.** `instituciones/03-ver-un-negocio.md:63-88` le dedica un bloque
entero de advertencias — *"El estado de resultados leelo como un techo"*, *"un negocio con mucha venta y
poco costo cargado no es un negocio rentable: es un negocio con los costos sin cargar"*. El producto
tiene el número exacto, a una línea de distancia, y le pide a la institución que lo estime de memoria.

**¿El portal le muestra un margen a la institución?** **No, hoy no** — verificado: cero coincidencias de
"margen" en `src/app/portal/` y en `monitoreo-institucional/actions.ts`. La ficha muestra exactamente
tres tarjetas escalares. Pero eso es **accidente de alcance, no protección**: `monitoreo-institucional/ANCLA.md:46`
tiene `margenPorProducto` anotado como pendiente sin marcar. La disciplina que protege al dueño es que
`margenAfirmable()` devuelve `null` cuando el marcador es > 0 (`reportes/actions.ts:74-84`, *"único
lugar donde vive la regla, para que Ranking y Margen canal × producto no puedan divergir"*) — un `null`
sobreviviría a un reenvío ingenuo. **El riesgo real es el inverso**: que quien tilde ese pendiente
calcule el margen en la capa institucional a partir de los escalares que ya viajan, sin pasar por
`margenAfirmable()`. Ahí la institución vería justo el número del que el dueño está protegido. Hoy no
pasa; nada lo impide mañana. Es X-03.

### 4.7 X-02 — Una sucursal congelada vuelve parcial el dato

Primero lo que **no** es defecto: la consolidación en sí es correcta y consistente. Ninguna función del
camino institucional pasa `sucursalId`, y todas las de abajo lo tratan como opcional
(`ventas/repository.ts:343`, `gastos/repository.ts:325,351`, `proveedores/repository.ts:326,383`,
`nicho-1/repository.ts:359,406`). Una institución sigue un negocio, no una sucursal. **No hay ningún
"filtro que no filtra" en el portal** — a diferencia del Dashboard del dueño (H-16).

El defecto es otro, y el encuadre importa porque cambia qué hay que construir.

**Una sucursal congelada no es una sucursal cerrada.** El local puede seguir operando en la vida real;
lo que no puede es **registrarse en CEOM** — el freeze rechaza escritura en los seis módulos (tras
`ff48f95`). Entonces lo que la institución mira no es un negocio que se achicó: **es un negocio del que
se está registrando una parte.** El dato se volvió parcial y nada lo dice.

Y el único diagnóstico que la institución tiene se lo niega:

- El portal **no menciona sucursales en ningún lado**. `obtenerTenantParaVeedor()`
  (`identidad/actions.ts:193-214`) devuelve `{id, nombreNegocio, nichoId, planId, estadoAcceso}` — ni
  cuántas sucursales hay, ni cuántas son operables.
- `calcularEstadoAcceso()` (`identidad/actions.ts:53-72`) depende **solo** de `estadoSuscripcion` y
  `fechaProximoPago`. **Un downgrade de plan deja el estado en `activo`.**

Eso vuelve falso el consejo que el manual le da en `instituciones/02-tu-cartera.md:39-45`: *"Si ves que
la actividad de un negocio se detuvo, mirá primero su estado antes de concluir que dejó de vender."*
Mira el estado, dice **Activo**, y concluye lo contrario de lo que pasó.

**Decisión tomada — ver [D-9](#d-9--x-02-cómo-se-declara-la-cobertura-parcial-por-sucursal).** La señal
no dice "bajó de plan" ni nombra el plan: **declara la cobertura del dato**. No es información
comercial, es un marcador de completitud — el mismo que X-01, sobre otro eje.

### 4.8 X-03 — El defecto común, y por qué va a repetirse

X-01, X-02 y G-14 **no son tres hallazgos: son tres casos del mismo defecto.** Marcadores de
completitud que existen en el sistema y no se propagan al tercero:

| Caso | El marcador existe como… | Se pierde en… |
|---|---|---|
| **X-01** | `ingresosSinCostoConocido` (campo real, ya calculado) | El re-proyectado de `detalleFinanciero()` |
| **X-02** | `sucursales.congelada_en` (columna real) | `obtenerTenantParaVeedor()`, que nunca lo miró |
| **G-14** | `tenants.nicho_id` (columna real) | El camino de Nicho 1, que nunca lo chequea |

En los tres, el dato que evita la mala lectura **ya está en la base**. Ninguno requiere calcular nada
nuevo. Lo que falta es que atraviese la frontera hacia el tercero.

**Y el mecanismo que los produce sigue en pie.** `detalleFinanciero()` recibe siete campos y reenvía
tres **elegidos a mano**. Ese re-proyectado es lo que descartó el marcador, y va a descartar el próximo:
**cada campo nuevo que gane `estadoResultados` nace invisible para la institución, en silencio, sin que
nada falle y sin que nadie lo note.** No es un bug: es una fábrica de bugs.

El proyecto ya resolvió este patrón exacto una vez —`src/lib/security/access-manifest.ts` y su test por
AST, que rompe la build cuando aparece una Server Action sin clasificar— y la propuesta para aplicar la
misma idea acá está en [D-10](#d-10--x-03-cómo-se-vuelve-detectable-el-descarte-de-un-campo).

La regla general que sale de esto quedó escrita como **principio rector #7** del producto
(`docs/architecture/CEOM_Arquitectura.md` §3) y como **regla no negociable #9** de `CLAUDE.md`.

---

## 5. Revocación y consentimiento vigente

### 5.1 Lo que sí funciona, verificado

| Pregunta del pedido | Respuesta |
|---|---|
| ¿Si un negocio revoca, la institución deja de ver sus datos **de inmediato**? | **Sí.** `revocarConsentimiento()` → `revocarAprobacion()` marca `revocado_en`, y la siguiente llamada a `tieneConsentimiento()` deniega — no hay caché ni sesión de consentimiento. Test: `consentimiento.test.ts:240-259`. El backstop de RLS coincide: `tenant_tiene_consentimiento_vigente()` filtra `revocado_en is null`. |
| ¿Revocar el código corta el acceso ya otorgado? | **Sí**, vía `aprobaciones_tenant.codigo_acceso_id`. Test: `consentimiento.test.ts:331-357`. |
| ¿Hay pantalla para que el negocio vea y revoque a quién le dio acceso? | **Sí.** `/app/consentimiento/aprobaciones` — lista con estado Vigente/Revocada/Histórica, nombre de institución, módulos, fechas, y botón Revocar con confirmación (`aprobaciones-cliente.tsx`). Más `/app/consentimiento/codigos` para revocar códigos. |
| ¿Hay pantalla para que la institución vea su cartera? | **Sí.** `/portal` autenticada (`cartera-cliente.tsx`) — con la salvedad de [§6](#6-el-punto-ciego-del-entorno-de-prueba): hoy nadie puede autenticarse. |

### 5.2 Lo que la revocación no corta

Ya detallado en **G-05**: el negocio no sale de la cartera. Concretamente, después de que el Owner toca
"Revocar", la institución sigue viendo en `/portal`: el **nombre del negocio**, su **rubro**, su **plan
actual**, su **estado de suscripción** (activo / solo lectura / bloqueado) y la **cohorte/fecha de
inicio** del vínculo. Y puede abrir la ficha, que muestra el nombre y el estado en el encabezado antes
de los cuatro candados.

Que el estado de suscripción siga siendo visible después de revocar merece atención propia: es
información comercial del negocio (*"su suscripción venció"*, tal como el manual se lo explica a la
institución en `02-tu-cartera.md:36`) que sigue fluyendo a un tercero al que se le retiró el permiso.

### 5.3 Un cero que la copia contradice

Menor, pero del mismo patrón: el vacío de la pantalla de Aprobaciones dice *"Todavía nadie canjeó un
código de acceso a tu negocio"* (`aprobaciones-cliente.tsx:62-64`). Las aprobaciones también nacen del
camino 2 (solicitud de CEOM aprobada), sin ningún código de por medio. Un Owner que aprobó una solicitud
y luego la revocó ve un mensaje que niega que eso haya pasado.

### 5.4 Revocar es irreversible desde `/app`

**G-17 🟠 — el hallazgo más importante de esta sección, y no está en H-42.**

Después de revocar, **el Owner no tiene ninguna forma de volver a otorgar acceso a esa institución**:

| Vía de otorgamiento | Por qué no sirve |
|---|---|
| `aprobarSolicitud()` | Requiere una `solicitud_seguimiento` **pendiente**, que solo puede crear `ceom_admin` (`actions.ts:271-283`). El Owner no puede generarse una. Y la solicitud original quedó en `aprobada`, no vuelve a `pendiente`. |
| `canjearCodigoAcceso()` | El Owner puede generar un código nuevo — pero la institución **ya está registrada**, y no tiene forma de canjearlo: es H-42 exacto. Con su mismo correo, la Server Action revienta; con otro correo, nace una segunda institución con cartera de un solo negocio. |
| Alguna acción de "reactivar aprobación" | No existe. `aprobaciones_tenant` es append-only por diseño y la única escritura pública es revocar. |

**H-42 no bloquea solo la segunda relación de una incubadora: bloquea el segundo *intento* de cualquier
relación.** Un negocio que revoca por error, o que revoca a fin de un programa y quiere volver a
habilitar al año siguiente, queda sin camino de vuelta salvo pedirle a CEOM el camino 2. Eso convierte
el consentimiento en una decisión de una sola dirección, que es lo contrario de lo que el manual le
promete al negocio y a la institución (*"solo su dueño puede volver a otorgarlo"*,
`03-ver-un-negocio.md:53` — una afirmación que hoy es falsa).

---

## 6. El punto ciego del entorno de prueba

> **✅ Cerrado en la tanda 3.1 (2026-07-27) — `pnpm seed:instituciones <emailCeomAdmin>`.**
> `scripts/seed-instituciones.ts` siembra el caso del piloto **y sus estados degenerados**. El
> diagnóstico de abajo queda como el registro de por qué hizo falta; lo que sigue es lo que hay ahora:
>
> | Estado | Antes | Ahora |
> |---|---|---|
> | Institución con 2+ negocios | ❌ nunca existió | ✅ Incubadora Andina con 3 |
> | Institución autenticada | ❌ 0 vinculadas | ✅ Incubadora entra a `/portal` sin bandeja de correo |
> | Dos instituciones sobre el mismo negocio | ❌ | ✅ Incubadora + Universidad sobre Aurora, con módulos distintos |
> | Negocio en cartera sin consentimiento vigente | ✅ por accidente | ✅ a propósito (Fundación ↔ Bertoni) |
> | Negocio de otro nicho con `operativo` consentido | ❌ | ✅ Bertoni (`nicho_4`) |
> | Negocio con sucursal congelada, en una cartera | ❌ | ✅ Cruz (2 sucursales, 1 congelada por downgrade real) |
> | Negocio con ingresos sin costo, en una cartera | ❌ | ✅ Bertoni (180 de 360 exactos) |
> | Institución sin correo (H-43) | ✅ por accidente | ✅ a propósito (Fundación Tejido) |
> | Negocio que no autorizó a nadie | ❌ | ✅ Dalmiro (525, que nadie debe ver) |
> | Códigos en los 3 estados | parcial | ✅ activo / canjeado / revocado |
>
> **Verificado con valores exactos** por el camino real de lectura institucional y en navegador. Lo que
> el portal muestra hoy sobre estos datos: Bertoni con *"ESTADO DE RESULTADOS 285,00"* sin ninguna
> marca de que 180 de sus 360 de ingresos no tienen costo (**X-01**); su pestaña *Producción* con
> *"Sin producciones registradas"* **sin candado** —siendo un `nicho_4` que no puede producir— al lado
> de *Insumos y stock*, que **sí** muestra el candado correctamente (**G-14**, el contraste exacto);
> y Cruz con *"INGRESOS DEL PERÍODO 800,00"* y el badge **Activo**, sobre un negocio que ya solo puede
> registrar en 1 de sus 2 sucursales (**X-02**).
>
> Sigue faltando: la fila de G-16 se limpió (ver abajo), pero **el escenario no cubre el canje
> autenticado** — no puede, es H-42: la Incubadora entra a su cartera por el camino 2. Se completa en
> la tanda 3.2.

El pedido anticipó el patrón (productos sin costo, `auth.users`) y acá es peor de lo esperado.

### 6.1 El seed de demo no crea instituciones. Ninguna.

`grep -i "institucion|codigoAcceso|aprobacion"` sobre todo `scripts/` (`seed-admin.ts`,
`seed-tenant.ts`, `seed-demo-data.ts`) → **cero coincidencias**. **El subsistema entero de
consentimiento es invisible para `pnpm seed:demo`.** Un agente o una persona que levante el entorno
desde cero no tiene ni una institución, ni un código, ni una aprobación con qué probar nada de esto.
Todo lo que existe hoy son residuos manuales de tandas anteriores, documentados en
`consentimiento/ANCLA.md`.

### 6.2 Nadie puede entrar al portal autenticado, hoy

Consultado contra la base viva:

| Métrica | Valor |
|---|---|
| Instituciones vivas | 7 (+1 borrada) |
| Con `auth_user_id` vinculado | **0** |
| Máximo de negocios en cartera por institución | **1** |
| Aprobaciones vigentes | 3 |

**Ninguna institución tiene `auth_user_id`.** `obtenerInstitucionActual()` resuelve exclusivamente por
ese campo (`repository.ts:63-70`), así que hoy `/portal` **solo puede mostrar el formulario de canje**:
la cartera, la ficha y las cuatro pestañas son inalcanzables con los datos actuales.

Es recuperable: `institucion prueva` (`brayankgr@gmail.com`) tiene un `auth.users` real, confirmado, con
`last_sign_in_at` del 2026-07-25, y como su `auth_user_id` está en `null`,
`obtenerInstitucionPorEmailSinVincular()` la encontraría y el vínculo perezoso se rehace en el próximo
click de magic link. Pero **exige una bandeja de correo real** — y el ANCLA ya documenta que no hay
atajo: `admin.auth.admin.generateLink()` devuelve formato *implicit* y no sirve para simular este flujo.

### 6.3 Estados del flujo que hoy NO se ven con los datos de prueba

| Estado | ¿Existe hoy? | Por qué importa |
|---|---|---|
| Institución con **2+ negocios** en cartera | ❌ Nunca existió | Es el caso del piloto. Todo lo verificado del portal se verificó con cartera de uno. |
| Institución **autenticada** | ❌ 0 vinculadas | La mitad logueada del portal no se puede ejercitar |
| **Dos instituciones** sobre el mismo negocio | ❌ | Es donde G-11 (backstop sin institución) se vuelve observable |
| Negocio en cartera **sin consentimiento vigente** | ✅ 2 filas | Único hueco de §5 que sí está sembrado |
| Negocio de **otro nicho** con `operativo` consentido | ❌ | G-14 no se ve nunca hoy |
| Institución **sin correo** con aprobación vigente (H-43) | ✅ `Universidad QA Test` | |
| Mismo correo como Usuario e Institución (G-16) | ✅ `admin@ceom.lat` | Sembrado por accidente |
| Código **revocado después de canjeado** | ✅ | |
| Canje que **falla a mitad** (G-02) | ❌ | Solo reproducible inyectando un fallo |

### 6.4 Los tests no pueden reproducir H-42, por construcción

Los dos tests de canje pasan `institucionNueva` **sin `email`** (`consentimiento.test.ts:311, 342`).
Como el índice único es **parcial** (`where email is not null`), esas filas nunca compiten por unicidad:
**la suite no puede tocar el defecto ni por accidente**. Y `monitoreo-institucional.test.ts` corre entero
con una institución y un tenant — su `caso 6` cubre "institución sin cartera → `estadoTenant` rechaza",
pero **no hay ni un test con dos tenants sobre una institución**, ni uno con un tercer negocio que no
autorizó.

---

## 7. Plan de tandas verificables

> **Nomenclatura (fijada el 2026-07-27).** "Etapa" es la numeración del **proyecto**: Etapa 2 =
> sucursales múltiples, **Etapa 3 = instituciones (este documento)**, Etapa 4 = segundo Owner. Las
> sub-divisiones de este plan se llaman **tandas 3.1 a 3.6**. La numeración de tandas **no se corre**
> aunque dos se fusionen. Usar esta nomenclatura en commits, PR y documentos.

Cada tanda se puede mergear sola, en verde, y deja el sistema mejor que antes. El orden está elegido
para que la verificación de la tanda N no dependa de nada de la N+1.

| Tanda | Qué cierra | Estado |
|---|---|---|
| **3.1** | Cruce con sucursales verificado · decisiones registradas · seed observable | En curso (2026-07-27) |
| **3.2** | H-42 (canje autenticado) + atomicidad + TTL de códigos + rate limiting | Pendiente |
| **3.3** | Que lo que se ve sea verdad: X-01, X-02, X-03, G-14, G-15 | Pendiente |
| **3.4** | Coherencia de la revocación: G-05, G-17, G-06, G-07 | Pendiente |
| **3.5** | Superficie de datos: G-13, G-16, G-04 (log institucional) | Pendiente |
| **3.6** | Escala del piloto: G-09, G-10 | Pendiente, opcional |

### Tanda 3.1 — Hacer el flujo observable (habilita todo lo demás)
Sin esto, ninguna tanda siguiente se puede verificar de punta a punta.
- **Verificar el cruce con sucursales** antes de tocar nada — hecho: X-01, X-02, X-03 (§4.6-4.8).
- **Registrar las decisiones** de §9 para que ninguna tanda posterior las reabra.
- Extender `seed-demo-data.ts` con el caso del piloto **y sus casos degenerados** (§6.3), incluidos los
  dos que exponen X-01 y X-02.
- Resolver el acceso autenticado de prueba: sembrar `auth_user_id` contra usuarios de Auth creados por
  el propio seed, para que `/portal` logueado sea alcanzable sin bandeja de correo real.
- Limpiar la fila de G-16 sembrada por accidente (`admin@ceom.lat` como institución).
- **Verificable por:** `pnpm seed:demo` en base limpia + entrar a `/portal` y ver una cartera de varios.

### Tanda 3.2 — Cerrar H-42 y la integridad del canje (G-08, G-02, G-03, G-04, G-01)
Fusiona las Etapas 1 y 2 del plan original **más dos ítems sumados el 2026-07-27**: tocan todas la misma
función (`canjearCodigoAcceso`) y separarlas obligaría a tocarla tres veces.
- `canjearCodigoAccesoAction`: `institucionNueva` pasa a opcional; aceptar `institucionId`.
- Superficie nueva en `/portal` para canjear con sesión (ruta o diálogo desde `CarteraCliente`), que
  resuelve `obtenerInstitucionActual()` y manda su `id`.
- Capturar la violación de unicidad en `crearInstitucion` y devolver `{ok:false}` con un mensaje útil.
- `try/catch` en `confirmarCanje` (`canjear-cliente.tsx`) para que ningún rechazo deje el botón colgado.
- Corregir las dos copias muertas del asistente (§1.3).
- Las tres escrituras de `canjearCodigoAcceso()` dentro de una transacción (**G-02**).
- `UPDATE ... WHERE id = ? AND estado = 'activo'`, verificando filas afectadas (**G-03**).
- **Sumado:** TTL por defecto de los Códigos de Acceso ([D-7](#d-7--vencen-los-códigos)).
- **Sumado:** rate limiting del canje (**G-04**) — es la única escritura sin autenticar del producto, ya
  está en producción, y `03-seguridad.md` lo marcó como previo a cualquier despliegue.
- **Verificable por:** una institución con sesión canjea un segundo código y ve dos negocios; test que
  inyecta un fallo en `crearAprobacionTenant` y afirma que el código sigue `activo`.

### Tanda 3.3 — Que lo que se ve sea verdad (X-01, X-02, X-03, G-14, G-15) — **la de mayor consecuencia**
- **X-01** — propagar `ingresosSinCostoConocido` hasta la pantalla de la institución, con al menos la
  misma prominencia que tiene para el dueño. **Es lo primero de esta tanda** (§10).
- **X-03** — hacer detectable el descarte de un campo
  ([D-10](#d-10--x-03-cómo-se-vuelve-detectable-el-descarte-de-un-campo)).
- **X-02** — declarar la cobertura parcial por sucursal
  ([D-9](#d-9--x-02-cómo-se-declara-la-cobertura-parcial-por-sucursal)).
- **G-14** — estado explícito "este negocio no usa este módulo" en la ficha
  ([D-4](#d-4--qué-se-hace-con-los-módulos-veedor-que-no-aplican-al-nicho)).
- **G-15** — estado `error` por pestaña en `ficha-cliente.tsx`, en vez de `null` eterno.
- Ajustar `instituciones/03-ver-un-negocio.md`: las advertencias en prosa sobre H-15 pasan a ser
  redundantes con el marcador real, y la afirmación *"una tabla vacía sin candado significa que ese
  negocio realmente no registró actividad"* deja de ser falsa.
- **Verificable por:** el e2e de §8.1 con valores exactos sobre un negocio con costo faltante y otro con
  sucursal congelada.

### Tanda 3.4 — Coherencia de la revocación (G-05, G-17, G-06, G-07)
- Implementar [D-3](#d-3--qué-pasa-con-la-cartera-cuando-el-negocio-revoca).
- Camino de re-otorgamiento desde `/app` (queda resuelto casi entero por la tanda 3.2: con el canje
  autenticado disponible, generar un código nuevo vuelve a ser un camino válido; falta confirmarlo y
  decirlo en la pantalla).
- Aplicar `fecha_fin` en `estaEnCartera()`/`listarCartera()` y mostrarla, o quitarla del manual.
- `eliminarInstitucionSoft()`: revocar aprobaciones, dar de baja la cartera y **liberar el correo**
  ([D-6](#d-6--qué-hace-un-borrado-de-institución-con-su-correo)).
- **Verificable por:** el e2e de revocación de §8.

### Tanda 3.5 — Superficie de datos y trazabilidad (G-13, G-16, G-04)
- Angostar el acceso a `instituciones` vía `REVOKE` de columna
  ([D-2](#d-2--se-angosta-la-rls-de-instituciones)).
- Rechazar el vínculo perezoso si el `authUserId` ya es un Usuario de tenant (**G-16**).
- Registro de acceso institucional, **visible para el negocio**
  ([D-1](#d-1--se-registra-lo-que-lee-una-institución)).
- **Verificable por:** repetir la consulta con `set local role authenticated` y ver que `email` y
  `auth_user_id` ya no salen; test del vínculo rechazado.

### Tanda 3.6 — Escala del piloto (G-09, G-10)
Solo si el piloto lo pide; nada de esto bloquea la corrección.
- Acoplar cartera+solicitud en el contrato, no solo en la UI.
- Alta múltiple para una cohorte.

---

## 8. Plan de tests

### 8.1 El e2e que define "terminado"

Escenario canónico, tal como lo pidió el pedido — **dos negocios, una institución, un tercero que no
autorizó, y revocación**:

```
Setup:   Negocio A  → código con [financiero]
         Negocio B  → código con [operativo, inventario_operativo]
         Negocio C  → no genera ningún código
         Institución I → sin registrar

1. I canjea el código de A sin sesión           → se crea I, cartera = [A]
2. I entra por magic link                        → ve cartera de 1
3. I canjea el código de B CON sesión            → cartera = [A, B]   ← hoy imposible (H-42)
4. Afirmar sobre A:  financiero autorizado con NÚMEROS EXACTOS (no `typeof number`);
                     operativo e inventario CON CANDADO
5. Afirmar sobre B:  inverso exacto del punto 4
6. Afirmar sobre C:  no aparece en la cartera de I;
                     tieneConsentimiento(I, C, *) === false para los 3 módulos;
                     detalleFinanciero(I, C, ...) → autorizado:false
7. El Owner de A revoca                          → detalleFinanciero(I, A) pasa a autorizado:false
                                                   EN LA MISMA CORRIDA, sin recrear cliente
8. Afirmar sobre B tras revocar A:               sigue autorizado (la revocación no se propaga)
9. Afirmar el estado de A en la cartera de I     → según lo que decida D-3
```

El punto 4 es donde la suite actual falla hoy por debilidad, no por rojo: `PLAN-RLS-BACKSTOP.md` §13.11
ya estableció el criterio —**afirmar el delta exacto, nunca `typeof x === "number"`**, porque
`coalesce(sum(...),0)` hace indistinguible "RLS filtró todo" de "legítimamente cero"— y el test de H-27
(`monitoreo-institucional.test.ts:548-609`) es el modelo a copiar. Todos los asserts nuevos siguen ese
criterio.

### 8.2 Tests de integración por hueco

| Test | Cubre | Debe fallar HOY |
|---|---|---|
| Canje autenticado con `institucionId` suma un negocio a la cartera existente | G-08 | ✅ |
| Canje **con email repetido** devuelve `{ok:false}` con mensaje, sin lanzar | G-08 | ✅ (hoy lanza) |
| Fallo inyectado en el paso 3 del canje deja el código `activo` y sin institución huérfana | G-02 | ✅ |
| Dos canjes concurrentes del mismo código: exactamente uno gana | G-03 | ✅ |
| Tras revocar, `listarCartera()` refleja la decisión de D-3 | G-05 | ✅ |
| Cartera con `fecha_fin` pasada no habilita `estadoTenant` | G-06 | ✅ |
| Institución borrada: sin aprobaciones vigentes, sin cartera viva | G-07 | ✅ |
| Negocio de nicho 4 con `operativo` consentido: la respuesta distingue "no aplica" de "sin actividad" | G-14 | ✅ |
| `vincularInstitucionAutenticada` rechaza un `authUserId` que ya es Usuario | G-16 | ✅ |
| Solicitud sobre un tenant fuera de cartera: rechazada en la acción | G-09 | ✅ |
| **Dos instituciones sobre el mismo negocio**, con módulos distintos: cada una ve lo suyo y nada de la otra | G-11 | ❓ debería pasar — es la afirmación que hoy nadie prueba |

### 8.3 Test de RLS en vivo

Siguiendo la metodología ya usada en `PLAN-RLS-BACKSTOP.md` (transacción + `set local role` +
`rollback`), dejar un test que afirme:
- Un `authenticated` cualquiera **no** lee `instituciones` completa (tras la Etapa 5).
- `tenant_tiene_consentimiento_vigente()` en SQL y `tieneConsentimiento()` en TS **coinciden** para una
  matriz de casos (vigente / revocado / módulo no aprobado / tenant bloqueado). Es el *"test dorado"*
  que `PLAN-RLS-BACKSTOP.md` ya recomendaba en su decisión abierta 3 (*"que corra el mismo conjunto de
  escenarios sintéticos contra `tieneConsentimiento()` (TS) y contra la función SQL, y falle si alguna
  vez difieren"*) y que sigue sin existir. Con dos instituciones sobre un mismo tenant es cuando de
  verdad importa.

### 8.4 Verificación manual con navegador

Lo que ningún test cubre: el canje autenticado real, el magic link con bandeja real (obligatorio, sin
atajo conocido), y que las cuatro pestañas de dos negocios distintos muestren cosas distintas en la
misma sesión.

---

## 9. Decisiones — todas cerradas (2026-07-27)

> **Estado: cerradas.** Las ocho decisiones abiertas de la versión original de este documento fueron
> resueltas por el dueño del producto el **2026-07-27**, en la tanda 3.1, más dos nuevas (D-9, D-10)
> nacidas del cruce con sucursales. **Ninguna tanda posterior debe reabrirlas** sin decirlo
> explícitamente. Cada una conserva abajo el análisis original y agrega el bloque **Resuelto**.

| # | Decisión | Resolución | Dónde se implementa |
|---|---|---|---|
| D-1 | Log de acceso institucional | **Sí**, y el negocio lo ve | Tanda 3.5 |
| D-2 | Superficie de `instituciones` | `REVOKE` de columna + filtrar `eliminado_en`; **sin policy nueva** | Tanda 3.5 |
| D-3 | Cartera al revocar | **Opción (c)** — marcada "acceso revocado"; se ocultan plan y estado | Tanda 3.4 |
| D-4 | Módulos veedor fuera del nicho | **Las dos**, pero el estado en la ficha es lo obligatorio y va primero | Tanda 3.3 |
| D-5 | Backstop fino por institución | **Se difiere 4.b.1**; el próximo incremento es G-12; se adopta el test SQL↔TS | Tanda 3.3 (test) |
| D-6 | Correo al borrar institución | **Se libera** | Tanda 3.4 |
| D-7 | Vencimiento de códigos | **Vencen, con TTL por defecto, no opcional** | Tanda 3.2 |
| D-8 | ¿Alcanza el camino 2? | **No** — se implementa el canje autenticado | Tanda 3.2 |
| D-9 | Cobertura parcial por sucursal (X-02) | Señal de **cobertura del dato**, no de plan | Tanda 3.3 |
| D-10 | Detectar el descarte de un campo (X-03) | **Propuesta pendiente de aprobación** | Tanda 3.3 |

### D-1 — ¿Se registra lo que lee una institución?
Hoy no existe ninguna traza de acceso institucional (G-04). `logs_acceso_admin_ceom` solo cubre al equipo
CEOM.
**Recomendación: sí, y antes del piloto.** Una tabla `logs_acceso_institucion` análoga (institución,
tenant, módulo, fecha), escrita desde las cuatro funciones de `monitoreo-institucional/actions.ts`
después de que `tieneConsentimiento()` devuelve `true` — cuatro call-sites, el patrón exacto que ya usa
`panel-admin-ceom`. Sin esto, la promesa de privacidad no es auditable: ante un reclamo de un negocio no
hay nada que mirar. **Decisión secundaria: ¿el negocio ve ese registro?** Recomiendo que sí (a diferencia
del log de CEOM, que es deliberadamente interno): es el dato que vuelve tangible el consentimiento.

> **✅ Resuelto — sí al log, y el negocio lo ve.** Se implementa en la **tanda 3.5**. Tabla propia
> análoga a `logs_acceso_admin_ceom`, escrita desde las cuatro funciones de
> `monitoreo-institucional/actions.ts` después de que `tieneConsentimiento()` devuelve `true`. A
> diferencia del log de CEOM (deny total para `authenticated`), éste **es visible para el negocio
> observado**: es lo que vuelve auditable la promesa de privacidad para quien la otorgó.

### D-2 — ¿Se angosta la RLS de `instituciones`?
Opciones: (a) dejarla como está y aceptar el riesgo por escrito; (b) restringir las columnas expuestas
por PostgREST; (c) cambiar la policy a "solo instituciones con las que compartís tenant, o la propia".
**Recomendación: (c) acotada** — `USING (auth_user_id = auth.uid() OR exists(aprobación/cartera con
current_tenant_id()))`. Cuidado con la regla dura de no-recursión de `schema.ts:182-193`: la policy leería
`aprobaciones_tenant`, no `instituciones`, así que no la viola — pero conviene verificarlo explícitamente
antes de escribirla. Si (c) resulta cara o riesgosa, (b) —quitar `email` y `auth_user_id` del alcance de
`anon`/`authenticated`— resuelve el 90% con un `REVOKE ... ON COLUMN`.

> **✅ Resuelto — se va por (b), no por (c).** `REVOKE` de columna sobre `email` y `auth_user_id`, más
> agregar `eliminado_en is null` a la policy existente. **No se crea una policy nueva que lea otra
> tabla.** Razón: (c) haría que la policy de `instituciones` leyera `aprobaciones_tenant`, y aunque hoy
> no viola la regla dura de no-recursión de `schema.ts:182-193`, agrega una dependencia entre tablas del
> mismo módulo que esa regla existe para evitar. (b) cierra la exposición de PII —que es lo que motiva
> el hallazgo— sin tocar la forma de la policy. Tanda 3.5.

### D-3 — ¿Qué pasa con la cartera cuando el negocio revoca?
Tres opciones: (a) statu quo — el negocio se queda en la cartera con candados; (b) dar de baja la fila de
cartera al revocar; (c) mantenerla pero marcarla visiblemente como "acceso revocado" y ocultar plan y
estado de suscripción.
**Recomendación: (c).** (a) filtra información comercial a un tercero al que se le retiró el permiso, y
contradice lo que el Owner cree que hizo. (b) hace desaparecer el negocio sin explicación y borra el
historial del vínculo, que es de CEOM. (c) es honesta con los dos lados: la institución entiende qué
pasó, el negocio deja de compartir. **Esta decisión es tuya y afecta copy del manual en dos capítulos.**

> **✅ Resuelto — opción (c).** La fila de cartera queda marcada como **"acceso revocado"**; se **ocultan
> plan y estado de suscripción** (información comercial del negocio, que es lo que no corresponde seguir
> filtrando a un tercero sin permiso); se **conservan nombre y rubro** (el vínculo histórico es de CEOM y
> la institución tiene que poder entender qué pasó). Tanda 3.4. Impacta copy de
> `instituciones/02-tu-cartera.md` y `03-ver-un-negocio.md`.

### D-4 — ¿Qué se hace con los módulos veedor que no aplican al nicho?
El caso G-14: un comercio comparte "Producción" y la institución ve una tabla vacía que el manual le
enseña a leer como "no produjo".
**Recomendación: bloquear en el origen y avisar en el destino.** En `generarCodigoAcceso()`, validar los
módulos también contra el nicho del tenant (no solo contra el plan) — un negocio que no puede producir no
debería poder ofrecer "Producción". Y en la ficha, un estado tercero explícito ("Este negocio no usa este
módulo") distinto de candado y de vacío. Alternativa más barata si el alcance aprieta: solo el estado
tercero en la ficha, dejando la generación como está. **Lo que no recomiendo es dejarlo:** es dato
incorrecto en pantalla para el actor que menos contexto tiene para detectarlo.

> **✅ Resuelto — las dos, en ese orden.** El **estado explícito en la ficha es lo obligatorio y va
> primero** (tanda 3.3): es lo que corrige el dato incorrecto que ya está en pantalla. La validación
> contra el nicho en `generarCodigoAcceso()` es **endurecimiento posterior** — evita que el caso vuelva
> a nacer, pero no repara los códigos ya canjeados, así que no puede ser lo único. Es el mismo criterio
> del principio rector #7: marcar el hueco primero, cerrar la fuente después.

### D-5 — ¿Se reabre la Etapa 4.b.1?
El backstop por institución (G-11) se difirió con el supuesto de una institución por negocio.
**Recomendación: reabrir la evaluación, no implementarla ahora.** El piloto cambia la exposición pero
sigue habiendo una sola implementación de la regla (`tieneConsentimiento`), bien testeada y con
invariante de esquema debajo. Recomiendo un paso intermedio y barato: el test de coherencia SQL↔TS de
§8.3, que detectaría una divergencia sin construir el GUC. Si el piloto crece a varias instituciones
sobre los mismos negocios, ahí sí 4.b.1 se vuelve prioritaria. **Necesito tu lectura del riesgo
comercial**: cuánto peso tiene la promesa de aislamiento frente a una incubadora que evalúa financiar.

> **✅ Resuelto — se difiere 4.b.1, y el próximo incremento de seguridad es G-12, no la granularidad.**
> Extender el backstop a los módulos que hoy no tienen piso (Ventas, Gastos, Financiero, Nicho 1 — 3 de
> las 4 pestañas del portal) vale más que afinar por institución el único módulo que sí lo tiene. **Se
> adopta ya el test de coherencia SQL↔TS de §8.3** como el reemplazo barato del backstop fino: detecta
> una divergencia entre las dos implementaciones de la regla sin construir el GUC
> `request.gateway.institucion_id`. Anotado también en `docs/security/PLAN-RLS-BACKSTOP.md`.

### D-6 — ¿Qué hace un borrado de institución con su correo?
Hoy lo bloquea para siempre (G-07).
**Recomendación: liberarlo** — al soft-borrar, mover el correo a una columna de archivo o agregar
`eliminado_en is null` al índice único parcial. Una institución que se dio de baja y vuelve debe poder
usar su misma casilla institucional. Riesgo a mirar: dos filas históricas con el mismo correo hacen
ambiguo `obtenerInstitucionPorEmail()`, que ya filtra borradas — habría que confirmarlo, no asumirlo.

> **✅ Resuelto — se libera el correo al soft-borrar.** Tanda 3.4. El riesgo señalado arriba
> (ambigüedad de `obtenerInstitucionPorEmail()`) hay que **confirmarlo con un test**, no asumirlo: las
> tres funciones de lookup por email ya filtran `eliminado_en`, pero eso debe quedar afirmado, no
> heredado.

### D-7 — ¿Vencen los códigos?
Hoy no (G-01), y el manual dice que sí.
**Recomendación: implementar vencimiento opcional** (`expira_en` nullable, elegido por el Owner al
generar; sin fecha = como hoy). Es aditivo, no rompe códigos existentes, y alinea el producto con lo que
ya se le prometió al usuario. Si se decide no implementarlo, **hay que corregir el manual** — no dejar
una promesa falsa en la guía del actor externo.

> **✅ Resuelto — vencen, con TTL por defecto, no opcional.** Más estricto que la recomendación
> original: no es una fecha que el Owner puede elegir dejar vacía, es un vencimiento que **todo código
> tiene**. Un código de acceso es una credencial que circula fuera del sistema (WhatsApp, correo,
> papel); que el estado por defecto sea "vive para siempre" es la decisión equivocada para una
> credencial. Tanda 3.2, junto al resto de los cambios de `canjearCodigoAcceso()`.

### D-8 — Alcance del piloto: ¿el camino 2 alcanza para la primera cohorte?
Si las quince altas se hacen por CEOM (30 diálogos), H-42 deja de ser bloqueante para el piloto y pasa a
ser deuda.
**Recomendación: no.** Aun por camino 2, cada Owner tiene que aprobar su solicitud, y el primer negocio
que revoque y quiera volver a otorgar cae en G-17 sin salida. Y el canje autenticado (Etapa 1) es
comparativamente barato. **Pero si el calendario del piloto aprieta, ésta es la palanca**, y la decisión
es tuya.

> **✅ Resuelto — el camino 2 no alcanza; se implementa el canje autenticado.** Tanda 3.2.

### D-9 — X-02: cómo se declara la cobertura parcial por sucursal

Nace del cruce con sucursales (§4.7). La pregunta original era "¿le explicamos a la institución por qué
cayó la actividad?". **El encuadre correcto es otro, y cambia la implementación.**

Una sucursal congelada **no es una sucursal cerrada**: el local puede seguir operando, lo que no puede es
registrarse en CEOM. Lo que la institución mira no es un negocio que se achicó — **es un negocio del que
se está registrando una parte**. El dato se volvió parcial y nada lo dice.

> **✅ Resuelto — señal de cobertura del dato, en la ficha.** `obtenerTenantParaVeedor()` pasa a
> devolver la cobertura (total de sucursales vs. sucursales operables) y la ficha lo declara cuando
> difieren.
>
> **La señal NO dice "bajó de plan" ni nombra el plan.** Dice que el resumen cubre una parte de las
> sucursales del negocio. Es una **afirmación sobre la cobertura del dato**, no información comercial —
> por eso es publicable a un tercero sin violar la privacidad del negocio, y por eso es un marcador de
> completitud en el sentido exacto del principio rector #7, no un aviso de estado.
>
> Se descartó el cuarto badge en la cartera (opción (c) del análisis original): mezclaría dos ejes
> distintos —salud de la suscripción vs. cobertura del registro— en un solo indicador. Tanda 3.3.

### D-10 — X-03: cómo se vuelve detectable el descarte de un campo

**Única decisión que queda abierta.** `detalleFinanciero()` recibe siete campos y reenvía tres elegidos a
mano; ese re-proyectado descartó el marcador de X-01 y descartará el próximo campo que nazca, en
silencio. El proyecto ya resolvió este patrón con `src/lib/security/access-manifest.ts` + su test por
AST, que rompe la build cuando aparece una Server Action sin clasificar.

**La propuesta está pendiente de aprobación.** No se implementa nada hasta que esté decidida.

Tres formas, de menos a más maquinaria:

**Opción 1 — Manifiesto de proyección + test por AST (el análogo literal de `access-manifest.ts`).**
Un archivo que declara, por cada función de origen, qué pasa con **cada uno** de sus campos:
`expuesto` / `omitido_por_agregación` / `marcador`. Un test lee el tipo de retorno de la función de
origen y falla si aparece un campo sin clasificar, o si un campo clasificado `marcador` no está en el
`detalle` proyectado.
*A favor:* atrapa las dos direcciones y es el patrón que el equipo ya conoce. *En contra:* un segundo
archivo que mantener, y leer **tipos** por AST es bastante más frágil que leer nombres de funciones
exportadas, que es todo lo que hace `access-manifest.ts` hoy.

**Opción 2 — Invertir la proyección: pasar todo y omitir explícitamente.**
`detalle: omitir(resultadosRes.data, ["ingresos", "gastos", "ajustesVenta", "ajustesCompra"])`. Un
campo nuevo viaja **por defecto**; para que no viaje, alguien tiene que nombrarlo.
*A favor:* el comportamiento seguro pasa a ser el default, sin archivos nuevos. *En contra:* **invierte
el modo de falla** — de "esconde algo en silencio" a "expone algo en silencio". En la única superficie
de privacidad del producto, eso es peor: un campo nuevo de `estadoResultados` que no deba salir del
negocio llegaría a un tercero sin que nadie lo decida.

**Opción 3 — Que lo haga TypeScript (recomendada).**
Declarar la proyección como un mapa exhaustivo sobre las claves del tipo de origen:

```ts
type Proyeccion<TOrigen> = { [K in keyof TOrigen]: "expuesto" | "marcador" | { omitido: string } };
```

El `detalle` se deriva de ese mapa. Cuando `estadoResultados` gana un campo, **el mapa deja de ser
exhaustivo y `pnpm typecheck` falla** — que ya corre en CI. Y `"marcador"` se define de forma que
**no pueda** resolverse a omitido: un marcador clasificado como omitido es un error de tipos, no una
convención que alguien tiene que recordar.
*A favor:* costo casi nulo, imposible de olvidar, falla en el lugar más temprano posible, sin runtime
ni archivo nuevo. *En contra:* solo cubre esta capa; si mañana aparece otro punto de re-proyección
hacia un tercero (Panel Admin CEOM ya es candidato), hay que aplicarlo ahí también a mano.

**Recomiendo la 3**, con la 1 como plan B si la gimnasia de tipos sale ilegible. Es un cambio
estructural en `monitoreo-institucional/actions.ts`, adyacente a su contrato, y por eso se trae a
decisión antes de implementarlo.

---

## 10. Qué mirar primero

Si hubiera que ordenar por consecuencia y no por esfuerzo (orden actualizado el 2026-07-27 con los
hallazgos del cruce):

1. **X-01** — el estado de resultados se le sirve a la institución **presentado como completo sin
   serlo**, desviado siempre hacia el lado optimista, con el marcador que lo corrige existiendo a una
   línea de distancia y llegando a cuatro pantallas del dueño. Es el modo de falla que este proyecto ya
   cerró seis veces en la familia del número financiero, reaparecido en la única superficie donde nadie
   lo buscó, y lo lee quien puede estar decidiendo financiamiento. **Arreglo chico, consecuencia grande.**
2. **G-14 + X-02** — los otros dos casos del mismo defecto: un vacío que el manual enseña a leer como
   "no hubo actividad", y un dato parcial que se presenta como total.
3. **X-03** — el mecanismo que produjo los tres y que va a producir el próximo. Es lo único de la lista
   que no es un defecto sino una fábrica de defectos.
4. **G-08 + G-17** — H-42 y su reverso. Bloquean el piloto y bloquean la reversibilidad del
   consentimiento.
5. **G-13 + G-04** — la superficie de datos y la ausencia total de traza de acceso institucional. Son
   las dos que, en el único punto de privacidad de la plataforma, no tienen respuesta si alguien
   pregunta.
6. **Tanda 3.1** — sin datos de prueba que reflejen el caso real, todo lo demás se verifica contra un
   escenario que no existe. Es el error que este proyecto ya cometió tres veces — y el cruce con
   sucursales lo confirmó una cuarta: los dos únicos negocios de la base que exponen X-01 y X-02 **no
   los sigue ninguna institución**, y el único que sí tiene cartera no tiene ninguna de las dos
   condiciones.
