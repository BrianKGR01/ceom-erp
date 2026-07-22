# Hallazgos — lo que apareció mientras se documentaba

> **Qué es este documento.** Todo lo que encontré al escribir el manual y que no es un problema del
> manual sino del producto: pasos que no se entienden sin que alguien te los explique, orden que no
> cierra, cosas que la interfaz no dice, funciones que parecen incompletas.
>
> **Qué NO es.** No es una auditoría de código, ni una lista de bugs. Es la lista de puntos donde un
> usuario real se traba, ordenada por cuánto lo traba.
>
> **Cómo se usa.** Cada hallazgo tiene un identificador (`H-01`) que el manual cita en línea. Si un
> hallazgo se corrige, hay que revisar los lugares del manual que lo citan — están enlazados.
>
> Verificado contra el código el 2026-07-22, rama `claude/manual-usuario-fase-1`.

---

## Cómo leer la severidad

| Severidad | Significado |
|---|---|
| 🔴 **Bloquea** | El usuario no puede completar una tarea, o la completa mal sin darse cuenta. |
| 🟠 **Confunde** | Se puede resolver, pero solo si alguien te lo explica. Genera consultas a soporte. |
| 🟡 **Roza** | Molesta o queda raro. No impide nada. |
| ⚪ **Anotado** | Ni bueno ni malo: una decisión de alcance que el manual tiene que saber describir. |

---

## Índice

| ID | Severidad | Hallazgo |
|---|---|---|
| [H-01](#h-01) | 🟠 | El canal de venta es obligatorio, la tarjeta de inicio dice lo contrario |
| [H-02](#h-02) | 🔴 | No existe forma de crear una sucursal — y hay funciones que asumen que hay varias |
| [H-03](#h-03) | 🟠 | Elegido el rubro, los datos del negocio dejan de ser editables |
| [H-04](#h-04) | 🟠 | "Quitar logo" no quita el logo |
| [H-05](#h-05) | 🟠 | Dos enlaces muertos en la pantalla de entrada, uno de ellos crítico |
| [H-06](#h-06) | 🟠 | La pantalla de entrada anuncia un asistente de IA que no existe |
| [H-07](#h-07) | 🟠 | El registro de accesos identifica a las personas con un fragmento de UUID |
| [H-08](#h-08) | 🟠 | El menú no se adapta ni al rubro ni a los permisos del colaborador |
| [H-09](#h-09) | 🟡 | Nada te dice en qué superficie estás |
| [H-10](#h-10) | 🟠 | Los gastos recurrentes no se generan solos |
| [H-11](#h-11) | 🟡 | Un gasto recurrente pausado no se puede reactivar |
| [H-12](#h-12) | 🟠 | "Tenant" en 105 mensajes de error |
| [H-13](#h-13) | 🟡 | Dos huecos en el registro de accesos de CEOM |
| [H-14](#h-14) | 🟠 | No hay pantalla para dar de alta a otra persona del equipo CEOM |
| [H-15](#h-15) | 🟡 | Un producto sin costo degrada seis pantallas en silencio |
| [H-16](#h-16) | 🟡 | El filtro de sucursal del panel solo afecta a dos de cinco tarjetas |
| [H-17](#h-17) | ⚪ | Funciones que existen en el backend y no tienen botón |
| [H-18](#h-18) | 🟡 | Documentación interna filtrada a la pantalla |
| [H-19](#h-19) | 🟡 | Etiquetas inconsistentes y valores crudos que pueden asomar |
| [H-20](#h-20) | ⚪ | Sin exportación de reportes |
| [H-21](#h-21) | 🟡 | El listado de negocios no pagina |
| [H-22](#h-22) | 🟡 | `docs/ui/pantallas.md` quedó desactualizado en un punto |
| [H-23](#h-23) | ⚪ | Colisión de nombres: `canalesVenta` son dos cosas distintas |

### Fase 2 — aparecidos al documentar el uso diario

| ID | Severidad | Hallazgo |
|---|---|---|
| [H-24](#h-24) | 🔴 | La comisión se calcula, se guarda y no llega a ningún lado |
| [H-25](#h-25) | 🟠 | El costo de un producto se reemplaza por el de la última compra, no se promedia |
| [H-26](#h-26) | 🟠 | Un ajuste no cambia el total ni el estado de cobro de la venta |
| [H-27](#h-27) | 🟠 | Los gastos automáticos son inalcanzables: toda su lógica es código muerto |
| [H-28](#h-28) | 🟡 | "Stock mínimo" se muestra en pantalla y no hay forma de cargarlo |
| [H-29](#h-29) | 🟠 | Eliminar una categoría de producto no verifica si está en uso |
| [H-30](#h-30) | 🔴 | El signo del ajuste de venta no se valida: una anulación mal cargada duplica el ingreso |
| [H-31](#h-31) | 🔴 | Una compra de ajuste no tiene ningún efecto observable |
| [H-32](#h-32) | 🟠 | No se puede cargar un gasto sin crear antes una categoría |

### Fase 3 — aparecidos al documentar patrimonio, producción, equipo y reportes

| ID | Severidad | Hallazgo |
|---|---|---|
| [H-33](#h-33) | 🔴 | Si el dueño no está disponible, el negocio no se puede recuperar — ni por CEOM |
| [H-34](#h-34) | 🟠 | La pantalla de capacidad de producción nunca puede mostrar datos |
| [H-35](#h-35) | 🟠 | No hay roles predefinidos: la grilla de permisos arranca en blanco |
| [H-36](#h-36) | 🟡 | Tres de los cuatro atributos del plan no tienen efecto |
| [H-37](#h-37) | 🟠 | La pantalla de venta no muestra el stock ni avisa al sobrevender |
| [H-38](#h-38) | 🟡 | Las deudas no tienen ni interés ni calendario |
| [H-39](#h-39) | 🟡 | Guardar una receta reemplaza su composición completa |
| [H-40](#h-40) | 🟡 | La producción no es atómica y falla en silencio |
| [H-41](#h-41) | 🟡 | "Vencida" sin fecha de próximo pago saltea el período de gracia |

---

<a id="h-01"></a>
## H-01 🟠 El canal de venta es obligatorio, la tarjeta de inicio dice lo contrario

> **Corregido el 2026-07-22.** Este hallazgo estaba redactado como bloqueante ("no se puede
> vender"). **Es incorrecto y se corrigió.** El botón **+ Nuevo canal** del punto de venta se
> renderiza **siempre**, fuera del guard `{canales.length > 0 && …}` que solo envuelve la grilla de
> canales existentes (`pos-cliente.tsx:314-341`). Un negocio sin canales **sí puede vender**:
> crea el canal desde el mismo diálogo, sin salir de la pantalla. La severidad real es fricción más
> un texto falso, no imposibilidad.

**Qué pasa.** El canal de venta es obligatorio para confirmar una venta, y un negocio recién creado
no tiene ninguno. Se resuelve sin salir del punto de venta, pero nada lo anticipa — y dos elementos
de la interfaz sugieren activamente que no hace falta.

**Por qué importa igual.** No es el muro que decía la versión anterior de este hallazgo, pero pasa
en el momento de mayor expectativa —el usuario acaba de cargar su producto y va a hacer su primera
venta— y **una de las dos piezas es una afirmación falsa**, no una omisión.

**La evidencia, en orden de aparición para el usuario:**

1. El onboarding pregunta **"¿Dónde vendés hoy?"** con cuatro opciones (Redes sociales, Feria /
   pop-up, Local físico, Boca a boca) — `src/components/shared/paso-negocio.tsx:30-35`. Parece que
   estás configurando tus canales. **No lo estás**: eso escribe `tenants.canalesVenta`, un arreglo de
   texto descriptivo que solo se vuelve a leer para repoblar ese mismo formulario y para mostrarlo en
   la ficha del negocio en `/admin` (`src/app/admin/(shell)/tenants/[tenantId]/ficha-cliente.tsx:53`).
   Ninguna venta lo usa.
2. La tarjeta de bienvenida de la pantalla de inicio dice, textual: *"Es lo único que necesitás para
   empezar a vender"* — `src/app/app/(shell)/inicio-contenido.tsx:85`. Es falso.
3. `registrarVentaSchema` exige `canalVentaId` — `src/modules/ventas/validation.ts:22`.
4. `crearTenantConOwner` crea negocio + sucursal + dueño, y **nada más**:
   `src/modules/identidad/repository.ts:210-238`. No siembra canales, ni métodos de pago, ni
   categorías.

**Por qué no se detectó antes.** Toda la verificación end-to-end se hizo contra el negocio de
prueba, que se puebla con `pnpm seed:demo` — y ese script **sí** crea dos canales y tres métodos de
pago (`scripts/seed-demo-data.ts:136-153`). El camino de un negocio real recién dado de alta nunca
se recorrió desde cero.

**Cómo se sale, hoy.** Con el enlace **+ Nuevo canal** (`pos-cliente.tsx:334-340`), que abre un
diálogo, crea el canal y lo deja seleccionado sin recargar. Funciona bien. El problema es que es un
enlace de texto chico debajo de un espacio vacío, sin ningún mensaje que explique que falta ese
paso: se encuentra mirando, no siguiendo la guía.

**Qué haría falta.** Por orden de impacto:
- **Corregir el texto de la tarjeta de bienvenida.** Es lo único de este hallazgo que es
  directamente falso, y es una línea.
- Cuando no hay canales, reemplazar el espacio vacío del punto de venta por un estado explicativo
  con el enlace destacado — el mismo patrón que ya usa bien el formulario de gastos (ver H-32).
- Sembrar un canal "General" y un método "Efectivo" al crear el negocio.

**Citado en el manual:** `negocio/01-primeros-pasos.md` pasos 2, 4 y 6;
`negocio/03-vender-todos-los-dias.md`.

---

<a id="h-02"></a>
## H-02 🔴 No existe forma de crear una sucursal — y hay funciones que asumen que hay varias

**Qué pasa.** Cada negocio recibe exactamente una sucursal, llamada "Principal", creada junto con el
negocio (`src/modules/identidad/repository.ts:213-221`). **No hay ninguna pantalla ni acción para
crear una segunda, renombrarla o desactivarla**, ni en `/app` ni en `/admin`. El módulo de identidad
expone `listarSucursalesPorTenant` y ninguna función de escritura — las únicas inserciones a
`sucursales` en todo el repositorio están en ese alta y en archivos de test.

**Por qué es grave.** No es solo una función faltante: hay funcionalidad construida y visible que
depende de que existan varias sucursales y que hoy no se puede ejercer.

- **Transferir stock entre sucursales** — `productos/[id]/ficha-cliente.tsx:710`
- **Transferir bien entre sucursales** — ficha de bien en Patrimonio
- El selector de sucursal en el panel de inicio, en reportes, en el alta de producto, de gasto, de
  compra y de producción: siempre con un único valor posible.

Además, el plan tiene un atributo **"Múltiples sucursales"** que se le muestra al dueño en Mi Plan
(`mi-negocio/plan/page.tsx:33`) y que hoy no puede tener efecto: ningún plan puede habilitar algo
que no tiene forma de crearse. El `ANCLA.md` de identidad ya lo registra como pendiente
("Chequeo de límite de sucursales contra plan").

**Qué haría falta.** Decidir el alcance: o se construye el ABM de sucursales, o se ocultan las
funciones y los atributos de plan que dependen de él. Hoy la interfaz promete algo que no cumple.

**Citado en el manual:** `negocio/01-primeros-pasos.md`, paso 4.

---

<a id="h-03"></a>
## H-03 🟠 Elegido el rubro, los datos del negocio dejan de ser editables

**Qué pasa.** El asistente de onboarding abre en el paso 1 (**Contanos de tu negocio**) o en el paso
2 (**Tu rubro**) según si el negocio ya tiene rubro:
`const [paso, setPaso] = useState(tenant.nichoId ? 1 : 0)` —
`src/app/app/onboarding/onboarding-wizard.tsx:48`.

No hay botón de "volver" ni el indicador de pasos es clickeable. Entonces, una vez elegido un rubro
concreto, el asistente **siempre** abre en el paso 2, que solo muestra el mensaje "Tu rubro ya está
elegido". El paso 1 queda inalcanzable.

**Qué queda sin poder editarse:** nombre del negocio, ciudad, moneda principal, logo y "¿dónde
vendés hoy?". La única entrada a esa pantalla es el ítem de menú **Mi negocio › Negocio**, que
apunta a `/app/onboarding` (`app-shell.tsx:223`).

**Confirmado como pendiente conocido**: el comentario en `src/components/shared/paso-negocio.tsx:26-29`
dice que la pantalla de edición dedicada "es Fase C" y que este cambio solo movió el componente.

**Por qué importa.** El nombre del negocio lo carga CEOM al dar de alta, no el dueño. Si tiene un
error de tipeo y el dueño confirma el rubro antes de corregirlo, queda con el nombre mal escrito de
forma permanente desde su interfaz. Y la moneda —que no debería cambiarse con datos cargados— tampoco
se puede corregir en la ventana en que sí sería seguro hacerlo: los primeros minutos.

**Citado en el manual:** `negocio/01-primeros-pasos.md`, paso 3.

---

<a id="h-04"></a>
## H-04 🟠 "Quitar logo" no quita el logo

**Qué pasa.** El botón de quitar el logo llama a `form.setValue("logoUrl", undefined)`
(`paso-negocio.tsx:136-139`). Como el `update` de Drizzle omite del `SET` las columnas en
`undefined`, la columna no se pisa con `NULL`: el logo anterior sigue guardado. La vista previa
desaparece, el usuario guarda, y cree que lo sacó.

Ya está documentado en `src/modules/identidad/ANCLA.md` como gap conocido no resuelto.

**Qué haría falta.** Mandar `null` explícito y aceptar `null` en `actualizarTenantSchema` /
`actualizarTenant`. Mientras tanto, la única forma real de cambiar el logo es subir otro encima.

**Citado en el manual:** `negocio/01-primeros-pasos.md`, paso 2.

---

<a id="h-05"></a>
## H-05 🟠 Dos enlaces muertos en la pantalla de entrada, uno de ellos crítico

**Qué pasa.** El formulario de entrada muestra **¿Olvidaste tu contraseña?**
(`src/app/(auth)/login/login-form.tsx:55`) y **Crear cuenta gratis** (`:98`). Ninguno tiene flujo
detrás.

- **"Crear cuenta gratis"** es coherente con el modelo de negocio —el alta es manual, vía CEOM— pero
  entonces no debería estar ahí: le promete a un visitante algo que el producto no ofrece.
- **"¿Olvidaste tu contraseña?"** es el problema serio. Es la única salida de un callejón real, y
  hoy no lleva a ningún lado. Un dueño que pierde la contraseña no tiene forma autónoma de volver a
  entrar a su propio negocio.

**Citado en el manual:** `negocio/01-primeros-pasos.md`, "Antes de empezar".

---

<a id="h-06"></a>
## H-06 🟠 La pantalla de entrada anuncia un asistente de IA que no existe

**Qué pasa.** El panel lateral de la pantalla de entrada dice, como tercer argumento de venta:
*"Tuki IA te asesora 24/7 con tus datos — Tu asistente inteligente siempre disponible."*
(`src/app/(auth)/login/page.tsx:18-19`).

No existe ninguna funcionalidad de asistente en el producto. La única otra mención de "Tuki" en todo
el repositorio es una idea a futuro anotada en `src/modules/simulaciones/ANCLA.md:78`.

**Por qué importa.** Es lo primero que lee un usuario nuevo, y es lo primero que va a buscar cuando
entre. Es también la clase de promesa que el equipo interno de pruebas va a reportar como bug
funcional.

**Citado en el manual:** `negocio/01-primeros-pasos.md`, "Antes de empezar".

---

<a id="h-07"></a>
## H-07 🟠 El registro de accesos identifica a las personas con un fragmento de UUID

**Qué pasa.** En **Logs de Acceso** (`/admin/logs`), la columna "Usuario CEOM" muestra los primeros
8 caracteres del UUID en tipografía monoespaciada: `{fila.usuarioCeomId.slice(0, 8)}…` —
`src/app/admin/(shell)/logs/logs-cliente.tsx:149`.

**Por qué importa.** Es una pantalla de auditoría: existe para responder "quién miró los datos de
qué negocio y cuándo". Un UUID cortado a la mitad no responde la primera parte de esa pregunta a
ningún lector humano.

La misma pantalla muestra, en su descripción, el identificador de rol `ceom_admin` literal
(`logs-cliente.tsx:70`).

---

<a id="h-08"></a>
## H-08 🟠 El menú no se adapta ni al rubro ni a los permisos del colaborador

**Qué pasa.** El menú lateral de `/app` arma una lista fija de ítems
(`src/components/shared/app-shell.tsx:180-255`). La única condición en todo el archivo es
`...(esOwner ? [...] : [])`, que oculta **Mi negocio** a quien no es dueño. Nada más se filtra.

Dos consecuencias distintas:

1. **Por rubro.** Un negocio de comercio minorista o en Modo Básico ve igual la sección
   **Producción** (Producciones, Insumos, Recetas, Capacidad). Es una decisión consciente y
   registrada en `docs/ui/pantallas.md` ("`app-shell.tsx` no oculta nav por nicho"), pero para el
   usuario final es un pedazo de aplicación que no le corresponde y que nadie le explica.
2. **Por permisos.** Un colaborador cuyo rol no tiene permiso de ver Gastos ve igual el ítem
   **Gastos** en el menú. Al entrar recibe un error de permisos.

**Importante — no es un agujero de seguridad.** El bloqueo real lo hace `tienePermiso()` del lado
del servidor (`identidad/actions.ts:78-122`) y funciona. El problema es de experiencia: el menú
ofrece puertas que después se cierran en la cara.

**Citado en el manual:** `negocio/01-primeros-pasos.md`, paso 3.

---

<a id="h-09"></a>
## H-09 🟡 Nada te dice en qué superficie estás

**Qué pasa.** `/app`, `/admin` y `/portal` comparten identidad visual y no muestran ningún rótulo
que las distinga, salvo el menú lateral. `/admin` tiene la leyenda "Panel de Administración" bajo el
logo (`admin-shell.tsx:128`); `/app` y `/portal` no tienen equivalente.

**Por qué importa.** Es menor para el usuario final, que solo conoce una. Importa para el equipo
interno de pruebas, que va a saltar entre las tres con distintas cuentas, y para redactar el manual:
hoy no hay una palabra en pantalla que nombre a cada superficie, así que el manual tiene que
inventarla. Ver glosario, sección 9.

---

<a id="h-10"></a>
## H-10 🟠 Los gastos recurrentes no se generan solos

**Qué pasa.** **Gastos › Recurrentes** deja armar plantillas (alquiler, servicios, sueldos) con su
frecuencia. Pero no hay ningún proceso programado que las dispare: cada gasto del período se crea a
mano con el botón **Generar gasto de este período** de cada plantilla.

Peor: la tarjeta muestra **"Próx. fecha"** y **"Proyección mensual"**, calculados en el navegador
con aritmética de calendario. Son solo una previsualización — no hay nada agendado detrás de esa
fecha. El módulo no tiene planificador y su `ANCLA.md` ya lo registra.

**Por qué importa.** "Gasto recurrente" + una fecha próxima anunciada es una promesa muy fuerte de
automatismo. Un usuario que confía en eso va a terminar el mes con los gastos fijos sin registrar y
un resultado inflado, sin ningún aviso.

---

<a id="h-11"></a>
## H-11 🟡 Un gasto recurrente pausado no se puede reactivar

**Qué pasa.** Existe `desactivarGastoRecurrente` y no existe la acción simétrica. La interfaz lo
refleja honestamente: el interruptor de la plantilla queda bloqueado una vez pausado. Pero el
control **parece** un interruptor de dos posiciones.

**Consecuencia.** Pausar una plantilla es, en la práctica, eliminarla: hay que volver a crearla.

---

<a id="h-12"></a>
## H-12 🟠 "Tenant" en 105 mensajes de error

**Qué pasa.** La fórmula "…en este tenant." aparece en 105 mensajes de error de usuario, repartidos
en 12 módulos, y se muestra tal cual en los diálogos y formularios.

Está desarrollado con el detalle completo y la decisión de reemplazo en
[`glosario.md`](glosario.md), sección 7. Se anota acá porque es, por volumen, el defecto de
experiencia más extendido del producto.

---

<a id="h-13"></a>
## H-13 🟡 Dos huecos en el registro de accesos de CEOM

Ambos ya están documentados en `docs/ui/pantallas.md`; se consolidan acá porque afectan la lectura
de una pantalla de auditoría.

1. **Abrir la ficha de un negocio no queda registrado.** Las tres pestañas de consulta (Financiero,
   Operativo, Inventario Operativo) sí registran el acceso; el dato general del negocio, no —
   "identidad" no es un valor del enum de módulos.
2. **"Inventario Operativo" se registra como "operativo".** Las consultas de insumos y las de
   producción quedan indistinguibles en el registro, porque el enum de permisos no separa lo que sí
   separa el enum del gateway. Quien lea la pantalla no tiene forma de saberlo.

---

<a id="h-14"></a>
## H-14 🟠 No hay pantalla para dar de alta a otra persona del equipo CEOM

**Qué pasa.** El primer usuario administrador se crea con el script `pnpm seed:admin <email>`
(`scripts/seed-admin.ts`), que resuelve el problema del huevo y la gallina — hasta ahí, correcto y
está documentado.

Pero **no existe ninguna pantalla en `/admin` para sumar una segunda persona al equipo CEOM.** No
hay ABM de usuarios administradores. Sumar a alguien requiere acceso al servidor y correr un script.

**Por qué importa.** El actor 1 del manual es "el equipo que opera la plataforma". Hoy ese equipo no
puede crecer por la interfaz. El capítulo `equipo-ceom/01-antes-de-empezar.md` tiene que explicar
esto, y es raro que la única instrucción para un usuario sea "pedile a alguien que corra un script".

---

<a id="h-15"></a>
## H-15 🟡 Un producto sin costo degrada seis pantallas en silencio

**Qué pasa.** `costoOperativoVigente` es opcional (`modules/productos/validation.ts:15`). Se puede
guardar un producto sin costo y venderlo con normalidad. Nada advierte nada.

**Qué se rompe, silenciosamente:** el margen del producto queda sin calcular; queda afuera del
ranking por margen; queda excluido del promedio del comparador de productos; el estado de resultados
suma el ingreso sin su costo; el simulador de precios no tiene base; el punto de equilibrio tampoco.

**Por qué importa.** El costo es lo que convierte a CEOM en algo más que un cuaderno de ventas. Que
sea opcional está bien —al principio uno no lo sabe—, pero que no haya ninguna señal después es lo
que hace que un negocio use el sistema meses y tenga reportes que no significan nada.

**Qué haría falta.** Un aviso en la ficha del producto y una marca en el catálogo. No hace falta
volverlo obligatorio.

**Citado en el manual:** `negocio/01-primeros-pasos.md`, paso 5.

---

<a id="h-16"></a>
## H-16 🟡 El filtro de sucursal del panel solo afecta a dos de cinco tarjetas

**Qué pasa.** El panel de inicio tiene un selector de sucursal, pero solo llega a **Resumen del
período** y **Flujo de caja**. Las otras tres —Ranking de productos, Gastos por categoría, Control de
merma— no reciben el parámetro: sus funciones no lo aceptan en su firma. Ya está documentado en
`reportes/ANCLA.md`.

**Por qué importa.** Un filtro que se aplica a parte de la pantalla y a parte no, sin ninguna marca
visual, produce lecturas cruzadas erróneas. Hoy el impacto real es nulo porque solo existe una
sucursal (H-02) — pero si H-02 se resuelve, esto pasa a ser un defecto de datos.

---

<a id="h-17"></a>
## H-17 ⚪ Funciones que existen en el backend y no tienen botón

Consolidado, porque el manual tiene que saber no mencionarlas. Ninguna es un defecto: son decisiones
de alcance ya registradas.

| Función | Estado |
|---|---|
| `actualizarComisionEvento` | Existe; no hay forma de editar la comisión de un evento ya abierto. |
| Cierre agregado de un evento (cargar el total vendido de una vez al cerrar) | Descrito en el módulo; no existe la acción. Hoy se resuelve venta por venta. |
| `generaPagoNegativo` en un ajuste de venta | El esquema lo acepta; la interfaz no lo expone. Una devolución no puede generar el egreso de caja correspondiente. |
| `listarCategoriasSugeridas` (catálogo global de categorías de producto) | Existe; sin pantalla que lo consuma, y sin administración del catálogo global en `/admin`. |
| `sembrarCategoriasGastoDefault` | Existe y precarga el conjunto de categorías de gasto; ningún botón la llama. Sería el "Cargar categorías sugeridas" que hoy falta. |
| Agregar un segundo dueño (multi-owner) | El modelo lo permite y el plan tiene el atributo; no hay acción. Solo existe *transferir* la titularidad, que es ceder, no sumar. |
| `consultarCapacidadProduccionUsada` para una institución | Queda fuera de la vista de institución por falta de un identificador seguro. |

---

<a id="h-18"></a>
## H-18 🟡 Documentación interna filtrada a la pantalla

**Qué pasa.** El diálogo de gestión de roles muestra al usuario la cadena
**"(Módulo 1, sección 6.3)"** — `src/app/app/(shell)/mi-negocio/roles/roles-cliente.tsx:170`. Es una
referencia al documento de especificación interno.

Es de corrección trivial y no se traduce: se borra.

---

<a id="h-19"></a>
## H-19 🟡 Etiquetas inconsistentes y valores crudos que pueden asomar

Tres problemas de la misma familia, detallados en [`glosario.md`](glosario.md) sección 8:

1. **El mismo tipo de gasto, dos nombres**: `variable_no_productivo` se muestra como "Variable" en
   el listado y "Variable no productivo" en la ficha.
2. **Cuatro mapas con patrón `MAPA[valor] ?? valor`**, que imprimen el identificador crudo si
   aparece un valor no contemplado. Los mapas de rubro solo cubren `nicho_1` y `nicho_4`; un rubro
   nuevo se mostraría como `nicho_2` literal, incluido en el portal de instituciones.
3. **Una etiqueta derivada mecánicamente** quitando guiones bajos, en la columna "Módulo consultado"
   del registro de accesos, en vez de un mapa explícito.

---

<a id="h-20"></a>
## H-20 ⚪ Sin exportación de reportes

No hay exportación a PDF ni a Excel en ninguna pantalla de reportes, y está explícitamente fuera de
alcance en la documentación del módulo. Se anota porque **es la primera cosa que va a pedir un
usuario que use reportes en serio**, y porque hubo botones de exportar en los diseños de referencia
que se omitieron a propósito al construir. El manual tiene que decirlo, para que nadie los busque.

---

<a id="h-21"></a>
## H-21 🟡 El listado de negocios no pagina

`listarTenants()` trae todos los negocios sin paginar, decisión consciente para el volumen actual y
registrada en `identidad/ANCLA.md`. Se anota porque el manual del equipo CEOM describe esa pantalla
como la vista principal de la plataforma, y es la primera que se va a degradar con el crecimiento.

---

<a id="h-22"></a>
## H-22 🟡 `docs/ui/pantallas.md` quedó desactualizado en un punto

El inventario describe la imagen del producto como "dropzone, preview local sin persistir". En el
código actual la imagen **sí** se sube a Storage, apenas se elige el archivo, con el mismo mecanismo
que el logo del negocio (`src/components/shared/product-form.tsx:94-131`).

Se anota porque `pantallas.md` es la fuente principal de este manual y conviene saber que puede
tener deriva. Todo lo que este manual afirma se verificó contra el código, no contra el inventario.

---

<a id="h-23"></a>
## H-23 ⚪ Colisión de nombres: `canalesVenta` son dos cosas distintas

`tenants.canalesVenta` es un arreglo de texto descriptivo del onboarding
(`identidad/schema.ts:105`). `canalesVenta` es también la tabla de canales reales con los que se
registran las ventas (`ventas/schema.ts:64`). Mismo nombre, significados distintos, y ninguna
relación entre ambos.

No es un defecto de usuario —nadie ve los nombres de tabla—, pero es casi con seguridad **la causa
raíz de H-01**: quien construyó el onboarding y quien construyó el punto de venta usaron la misma
palabra para dos cosas, y nadie notó que el paso quedaba sin conectar. Se anota para que, si H-01 se
corrige, se corrija también el nombre — o el próximo cambio vuelve a caer en la misma trampa.

---

<a id="h-24"></a>
## H-24 🔴 La comisión se calcula, se guarda y no llega a ningún lado

**Qué pasa.** Al registrar una venta, `registrarVenta` resuelve el porcentaje de comisión (del
evento si hay, si no del canal), calcula el monto y lo guarda en la venta como
`comisionPorcentajeAplicado` / `comisionMontoCalculado`
(`src/modules/ventas/actions.ts:492-517`).

Y ahí termina. El único consumidor de ese dato en todo el repositorio es
`generarGastoComisionVenta` (`src/modules/gastos/actions.ts:376-406`), que **no se llama desde
ningún lado fuera de los tests**. Además:

- **Ninguna pantalla lo muestra** — ni siquiera la ficha de la venta. Ningún archivo de UI lee esos
  campos.
- **No llega a Financiero.** El estado de resultados es `ingresos − costos − gastos + ajustesVenta`
  (`financiero/actions.ts:37-44`); la comisión no es ninguno de esos términos, porque nunca se
  convirtió en un gasto.

**Por qué es grave.** El campo "comisión por defecto" está a la vista en la pantalla de canales y en
la de eventos, y su presencia promete que la comisión se va a descontar. Un negocio que vende por un
canal con 20 % de comisión y lo carga correctamente **ve una ganancia 20 % mayor que la real, sin
ninguna señal**. Es el peor tipo de defecto: silencioso y en la dirección optimista.

**Qué haría falta.** Conectar `generarGastoComisionVenta` al final de `registrarVenta` (necesita un
`categoriaId`, hoy obligatorio, así que hay que decidir de dónde sale — ver H-32), o al menos
mostrar el monto en la ficha de la venta para que no sea invisible.

**Citado en el manual:** `01-primeros-pasos.md` paso 7, `03-vender-todos-los-dias.md`, `04-gastos.md`.

---

<a id="h-25"></a>
## H-25 🟠 El costo de un producto se reemplaza por el de la última compra, no se promedia

**Qué pasa.** Al recibir una compra de reventa, `crearEntradaCompraReventaTx` hace
`set({ costoOperativoVigente: data.costoCompra })`
(`src/modules/productos/repository.ts:342-345`): **pisa** el costo con el unitario de esa compra.

**Por qué sorprende.** Es el comportamiento contrario al de los insumos, que sí promedian, y
contrario a lo que espera cualquiera que haya usado un sistema de inventario. Con 100 unidades a
Bs 10 en stock, recibir 5 unidades a Bs 18 hace que el costo de las 105 pase a Bs 18. El margen de
todo el catálogo se deforma con una compra chica de urgencia.

No es necesariamente un defecto —"último precio" es una política de costeo válida— pero **no está
declarado en ningún lado** y es indistinguible de un error para quien lo sufre.

**Nota de paso:** el comentario de `productos/repository.ts:315-316` dice que esta función está "hoy
sin caller real (Proveedores no dispara el evento compra_registrada todavía)". Está desactualizado:
`dispararEntradaStock` la llama desde `registrarCompra` y `recibirCompra`.

---

<a id="h-26"></a>
## H-26 🟠 Un ajuste no cambia el total ni el estado de cobro de la venta

**Qué pasa.** `obtenerTotalVenta` suma únicamente los subtotales de las líneas
(`ventas/repository.ts:197-203`), sin restar ajustes. Y `registrarPagoVentaTx` calcula el estado de
cobro contra ese mismo total (`:289-301`).

Consecuencia: una venta con **anulación total** sigue mostrando su importe original en el historial y
en su ficha, y si estaba pendiente **sigue apareciendo como pendiente de cobro para siempre**.

Los reportes sí toman el ajuste, vía `consultarAjustesVentaEnPeriodo`. Así que el historial de ventas
y el estado de resultados cuentan cosas distintas — correctamente, pero sin que nada lo explique.

**Por qué importa.** El caso concreto es perseguir el cobro de una venta que se anuló, o cuadrar
cuentas por cobrar contra una lista que incluye ventas inexistentes.

**Qué haría falta.** Mostrar el efecto del ajuste en la ficha y en el historial —un total ajustado
junto al original, o al menos una marca visible de "tiene ajustes"—. No hace falta tocar el modelo
append-only, que está bien: alcanza con que la pantalla lo refleje.

---

<a id="h-27"></a>
## H-27 🟠 Los gastos automáticos son inalcanzables: toda su lógica es código muerto

**Qué pasa.** El enum de origen de un gasto tiene tres valores: `manual`,
`comision_venta_automatica` y `cuota_pasivo_automatica`. Pero:

- `crearGastoManual` escribe `origen: "manual"` (`gastos/actions.ts:190`).
- `generarGastoDesdeRecurrente` **también** escribe `origen: "manual"`, deliberadamente y
  documentado (`:534`).
- Las dos funciones que escribirían los otros dos valores —`generarGastoComisionVenta` y
  `generarGastoCuotaPasivo`— **no tienen ningún llamador fuera de los tests**. El único
  `generarGasto*` conectado a la UI es `generarGastoDesdeRecurrenteAction`
  (`src/app/app/(shell)/gastos/actions.ts:210`).

**Por lo tanto, a través del producto, todo gasto es `manual`.** Y toda la lógica construida encima
de esa distinción es inalcanzable:

- La marca "Automático" del listado nunca se muestra.
- El aviso de bloqueo de la ficha nunca aparece.
- Los rechazos de `actualizarGastoManual` / `eliminarGastoManual` para gastos no manuales
  (`:214-220`, `:253-259`) nunca se disparan.
- La redirección de la ruta de edición para gastos automáticos nunca actúa.

**Por qué importa** (más allá del código muerto): significa que **las comisiones de venta y las
cuotas de deudas no llegan a los gastos**. Son dos categorías de egreso real que quedan fuera del
resultado salvo que el usuario las cargue a mano, sin que nada se lo diga. Es la misma raíz que
H-24.

---

<a id="h-28"></a>
## H-28 🟡 "Stock mínimo" se muestra en pantalla y no hay forma de cargarlo

**Qué pasa.** La ficha del producto muestra una columna **Stock mínimo**
(`productos/[id]/ficha-cliente.tsx:479`) y calcula un aviso de stock bajo a partir de ella (`:486`).
Existe la acción `configurarStockMinimo` (`productos/actions.ts:378`).

**No hay ninguna pantalla que la llame.** El campo no está en el alta ni en la edición de producto, y
la ficha solo lo muestra. La columna siempre está vacía y el aviso de stock bajo nunca se muestra.

Detalle menor del mismo lugar: tras un ajuste de stock, el cliente reescribe la fila con
`stockMinimo: null` (`:228`, `:275`), así que aunque el valor existiera se borraría de la vista hasta
recargar.

---

<a id="h-29"></a>
## H-29 🟠 Eliminar una categoría de producto no verifica si está en uso

**Qué pasa.** `eliminarCategoria` (`productos/actions.ts:81-95`) valida el permiso y hace la baja
lógica. **No cuenta cuántos productos la usan ni avisa.**

Los productos quedan apuntando a una categoría eliminada: no se borran, pero pierden su
clasificación y hay que reasignarlos de a uno. No hay deshacer.

**El contraste que lo vuelve claramente un descuido:** eliminar un **rol** con colaboradores
asignados sí abre un diálogo de reasignación forzada que obliga a reubicar a cada persona antes de
borrar. El patrón correcto ya existe en el producto; a categorías no se le aplicó.

---

<a id="h-30"></a>
## H-30 🔴 El signo del ajuste de venta no se valida: una anulación mal cargada duplica el ingreso

**Qué pasa.** El estado de resultados **suma** los ajustes:
`ingresos − costos − gastos + ajustesVenta` (`financiero/actions.ts:37-44`). Para que una devolución,
un descuento o una anulación **reduzcan** el resultado, el monto tiene que cargarse **negativo**.

La única guía es un placeholder del campo: *"Negativo si devolvés dinero"*
(`ventas/[id]/ficha-cliente.tsx`, diálogo "Ajuste de venta"). Ese texto:

- desaparece apenas el usuario empieza a escribir;
- solo cubre el caso "devolvés dinero", no menciona la anulación total ni el descuento posterior;
- **no está acompañado de ninguna validación**. `confirmarAjuste` manda `Number(ajusteMonto)` tal
  cual, y `registrarAjusteVenta` solo valida el motivo y la coherencia del pago negativo, nunca el
  signo respecto del tipo.

**El caso concreto.** Una anulación total de una venta de Bs 500 cargada como `500` en vez de `-500`
no cancela el ingreso: **le suma otros Bs 500 al resultado del período**. El error es de un
carácter, invisible después de guardar, y va en la dirección optimista.

**Qué haría falta.** Derivar el signo del tipo de ajuste —los cuatro tipos actuales son todos
reductores— o validar la combinación y rechazarla. Es una de las correcciones más baratas y de mayor
impacto de esta lista.

---

<a id="h-31"></a>
## H-31 🔴 Una compra de ajuste no tiene ningún efecto observable

**Qué pasa.** `registrarCompraDeAjuste` (`proveedores/actions.ts:430-457`) valida permiso y motivo, y
escribe una fila en `compras_ajuste`. Nada más:

- **No modifica** el monto ni el estado de pago de la compra.
- **No revierte el stock** que entró al recibirla.
- **No se muestra en ninguna pantalla.** El repositorio tiene una consulta de ajustes por compra
  (`proveedores/repository.ts:189-193`) que **no está expuesta en `actions.ts`** y que ningún archivo
  de UI consume.
- **No llega a ningún reporte.** Financiero toma de Proveedores únicamente
  `consultarPagosCompraEnPeriodo`.

**El contraste con ventas lo confirma como defecto, no como decisión:** los ajustes de venta sí se
devuelven en `fichaVenta`, sí se muestran en la ficha y sí los consume Financiero. En compras se
construyó la escritura y no la lectura.

**Por qué es grave.** El usuario hace la acción, escribe un motivo obligatorio, recibe confirmación, y
queda convencido de que corrigió la compra. No corrigió nada. Una anulación de compra deja el stock
y el costo intactos.

**Citado en el manual:** `05-compras-y-proveedores.md`, con las tres alternativas manuales para cada
caso.

---

<a id="h-32"></a>
## H-32 🟠 No se puede cargar un gasto sin crear antes una categoría

**Qué pasa.** `categoriaId` es obligatorio tanto en un gasto como en una plantilla recurrente
(`gastos/validation.ts:10` y `:31`, ambos con `.min(1, "Elegí una categoría.")`). Un negocio recién
creado **no tiene ninguna categoría de gasto**: `crearTenantConOwner` no siembra nada.

`sembrarCategoriasGastoDefault` existe (`gastos/actions.ts:77`) y **ningún botón la llama**.

**Es la misma familia que H-01**, y el `ANCLA.md` del módulo lo dice con todas las letras:

> "Pre-carga automática de `CategoriaGasto` al crear el tenant — **fuera de esta tarea**… se expone
> `sembrarCategoriasGastoDefault(tenantId)` lista para invocarse, **mismo criterio que `CanalVenta`
> en Ventas**."

Es decir: **el mismo aplazamiento se tomó dos veces, en dos módulos, y ninguno de los dos se
retomó.** Vale la pena buscar si hay un tercer caso con el mismo patrón antes de cerrar estos.

**La diferencia con H-01 está en la señalización, no en la gravedad.** Los dos se resuelven sin salir
de la pantalla y los dos son 🟠. Pero acá la salida está a la vista: el formulario de gasto tiene un
enlace **+ Crear nueva** pegado al selector de categoría, alineado con su label
(`components/shared/gasto-form.tsx:102-111`). En el punto de venta, el enlace equivalente queda
debajo de un espacio vacío.

**Este es el patrón a copiar para H-01:** el mismo problema, señalizado bien en un módulo y mal en el
otro.

---

<a id="h-33"></a>
## H-33 🔴 Si el dueño no está disponible, el negocio no se puede recuperar — ni por CEOM

**Qué pasa.** Toda la gestión de identidad de un negocio está gateada con `solicitante.esOwner`
**directo**, sin el bypass de `ceom_admin` que sí tiene `tienePermiso()`:

| Función | Línea | Gate |
|---|---|---|
| `listarUsuarios` | `identidad/actions.ts:574` | `if (!solicitante.esOwner)` |
| `invitarUsuario` | `:587` | ídem |
| `cambiarRolUsuario` | `:632` | ídem |
| `suspenderUsuario` | `:662` | ídem |
| `reactivarUsuario` | `:693` | ídem |
| `transferirOwner` | `:725` | ídem |
| `listarRoles` / `crearRolPersonalizado` / `actualizarPermisosRol` / `eliminarRol` | `:765`, `:798`, `:820`, `:839` | ídem |
| `otorgarCapacidadEspecialPorRol` / `PorUsuario` | `:923`, `:953` | ídem |

**Y el equipo CEOM no es `esOwner` de ningún negocio.** `scripts/seed-admin.ts:90-95` crea al
administrador con `tenantId: CEOM_OPS_TENANT_ID`, `rolId: ROL_CEOM_ADMIN_ID` y **`esOwner: false`**.
El comentario de `invitarUsuario` (`:584-586`) confirma que el acotamiento a Owner fue deliberado,
porque "identidad" no es representable en la matriz genérica — pero la consecuencia no parece haber
sido evaluada.

**El escenario, que no es hipotético.** El dueño pierde la contraseña, deja el negocio, o cualquier
cosa que le impida entrar. A partir de ahí:

- Ningún colaborador puede asumir: `transferirOwner` la tiene que iniciar el dueño saliente.
- CEOM no puede designar otro dueño ni invitar a nadie: no es `esOwner`.
- No hay recuperación de contraseña (H-05).

El negocio **sigue operando** con los colaboradores existentes, pero queda congelado: no se puede
sumar gente, cambiar un rol ni recuperar la titularidad. **La única salida es escribir la base de
datos a mano.**

**Agravante.** `requireEscrituraHabilitada` corre en todas estas funciones, así que un negocio con la
suscripción vencida tampoco puede transferir la titularidad hasta regularizar — justo cuando podría
necesitarlo.

**Qué haría falta.** Lo mínimo: una acción en `/admin` que permita a `ceom_admin` designar un dueño
nuevo para un negocio, con registro. Es el mismo tipo de intervención que ya hacen al cambiar plan o
estado de suscripción, y hoy es el único agujero operativo sin salida del producto.

**Citado en el manual:** `negocio/09-tu-equipo.md`, `negocio/11-tu-plan.md`.

---

<a id="h-34"></a>
## H-34 🟠 La pantalla de capacidad de producción nunca puede mostrar datos

**Qué pasa.** `calcularCapacidadProduccionPeriodo` necesita `disponibilidadHorariaSemanal` y
`tiempoEstimadoPorCicloMinutos` del bien, y devuelve `null` si faltan.

**Esos campos no están en el formulario de bienes.** `src/components/shared/activo-form.tsx` incluye
`capacidadProduccionCantidad` (`:230`) y `capacidadAlmacenamientoCantidad` (`:254`), pero **no**
`disponibilidadHorariaSemanal`, `tiempoEstimadoPorCicloMinutos`, `requiereDescansoEntreCiclos` ni
`tiempoDescansoMinutos`. No hay ninguna otra pantalla que los cargue.

Resultado: `/app/produccion/capacidad` muestra siempre "sin datos suficientes" en su mitad de
producción. La mitad de almacenamiento sí funciona, porque ese campo sí está en el formulario.

Ya estaba anotado como omisión conocida en `docs/ui/pantallas.md` ("no todo campo de backend necesita
UI día uno"), sin registrar que dejaba una pantalla entera inservible.

---

<a id="h-35"></a>
## H-35 🟠 No hay roles predefinidos: la grilla de permisos arranca en blanco

**Qué pasa.** Un negocio nuevo tiene dos roles, ambos de sistema y no editables (Dueño y CEOM Admin).
Cualquier otro rol se construye desde cero marcando una grilla de **10 secciones × 4 acciones**.

**Por qué importa.** La consecuencia previsible no es que el dueño se equivoque en el detalle: es que
**le dé todo a todos**, porque es lo único que con seguridad funciona. Un sistema de permisos que
empuja a saltearse los permisos no cumple su función — y arrastra al modelo de corrección por ajuste,
que solo tiene sentido si "anular o corregir" es escaso.

Hay una propuesta de seis roles con su matriz en
[`propuesta-roles-por-defecto.md`](propuesta-roles-por-defecto.md), pendiente de decisión de producto.

---

<a id="h-36"></a>
## H-36 🟡 Tres de los cuatro atributos del plan no tienen efecto

**Qué pasa.** "Mi Plan" muestra cuatro atributos. Solo uno funciona:

| Atributo | Estado |
|---|---|
| Qué información se puede compartir | ✅ Se valida de verdad — `consentimiento/actions.ts:406-415` rechaza los módulos fuera del plan. |
| Múltiples sucursales | ❌ No hay forma de crear una sucursal (H-02). |
| Más de un dueño | ❌ No existe la acción de agregar un dueño (H-17). |
| Bajar de plan por autogestión | ❌ No hay pantalla de cambio de plan en `/app`; siempre lo hace CEOM. |

Se le muestran al dueño como características de lo que contrató. Tres de las cuatro son promesas que
el producto no puede cumplir hoy.

---

<a id="h-37"></a>
## H-37 🟠 La pantalla de venta no muestra el stock ni avisa al sobrevender

**Qué pasa.** El punto de venta lista los productos con nombre, imagen y precio, sin la cantidad
disponible. Al confirmar, `descontarStockVenta` corre por cada línea y sus resultados vuelven en
`descuentosStock`, pero la pantalla **no los muestra**: un aviso de stock insuficiente se calcula y se
descarta.

Está documentado en `docs/ui/pantallas.md` como decisión de rendimiento (evitar N+1 consultas en el
listado) y como pendiente de UI ("no se muestran explícitamente todavía").

**Por qué importa para el usuario.** Vendés, el stock queda en negativo, y no hay ninguna señal ni
durante ni después. El control de existencias se desincroniza en silencio, y la primera pista aparece
recién cuando alguien cuenta a mano.

**Nota:** el permiso especial *vender sin stock* existe para autorizar exactamente esto — pero hoy no
hay diferencia observable entre tenerlo y no tenerlo, porque nadie ve el aviso en ningún caso.

---

<a id="h-38"></a>
## H-38 🟡 Las deudas no tienen ni interés ni calendario

Dos ausencias de la misma familia, ambas decisiones de alcance del MVP ya documentadas, agrupadas
porque juntas definen qué **no** es el módulo de deudas.

1. **Sin tasa de interés.** No hay campo, y la ficha no desglosa capital e interés: se trabaja con la
   cuota fija que se cargue. El usuario tiene que cargar el **monto total a devolver**; si carga el
   capital prestado, el saldo le queda corto y nada se lo advierte.
2. **Sin fecha de próximo vencimiento.** Aunque están cargadas la fecha de inicio, la frecuencia y el
   plazo, ni el listado ni la ficha calculan cuándo vence la próxima cuota. No hay recordatorios.

En conjunto: el módulo sirve para registrar cuánto se debe y cuánto se pagó, no para administrar el
calendario de una deuda. Está bien que sea así en un MVP — pero la pantalla no lo dice, y un usuario
con tres créditos va a esperar que le avise.

---

<a id="h-39"></a>
## H-39 🟡 Guardar una receta reemplaza su composición completa

`actualizarComposicionReceta` reemplaza la lista entera de insumos, no edita línea por línea. La
pantalla de recetas es un editor en vivo donde se agregan y quitan líneas.

Consecuencia: quitar una línea sin querer y guardar la deja quitada, sin confirmación ni deshacer. En
una receta de doce insumos es fácil que pase y difícil que se note — el efecto aparece más tarde, como
un costo de producción más bajo de lo que corresponde.

---

<a id="h-40"></a>
## H-40 🟡 La producción no es atómica y falla en silencio

`registrarProduccion` descuenta los insumos y después acredita el stock del producto terminado. Las
dos partes no están en una sola transacción: si la acreditación falla, los insumos ya se
descontaron.

Está documentado como "gap de atomicidad aceptado por diseño" en `docs/ui/pantallas.md`. Lo que no
está resuelto es la parte visible: `acreditacionProductos` **no se expone en la UI si falla** y la
pantalla redirige al listado igual, así que el usuario ve una producción aparentemente exitosa con el
stock a medio mover.

Probabilidad baja, diagnóstico difícil: no queda ninguna señal de qué pasó.

---

<a id="h-41"></a>
## H-41 🟡 "Vencida" sin fecha de próximo pago saltea el período de gracia

`calcularEstadoAcceso` (`identidad/actions.ts:60-71`) mide la gracia desde `fechaProximoPago`. Si el
estado es `vencida` y esa fecha es `null`, devuelve `bloqueado` de inmediato — sin los días de solo
lectura que define el plan.

El diálogo de `/admin` pide la fecha al elegir `vencida` y el esquema la exige, así que por la
interfaz no debería ocurrir. Puede ocurrir con datos cargados por otra vía, o si la fecha se limpia
después.

**Por qué se registra igual:** el efecto es que un negocio pasa de operar normalmente a no poder ni
ver sus datos, sin transición, y desde `/app` es indistinguible de un error. Vale como nota para el
capítulo de CEOM: **poner "vencida" sin fecha bloquea al negocio en el acto.**

---

## Lo que está bien y conviene no romper

Para que la lista de arriba no dé una impresión equivocada, tres cosas que al documentar aparecieron
como decisiones sólidas:

- **El vocabulario del onboarding.** Llama "Tu rubro" al nicho y describe cada opción en términos
  del negocio del usuario ("Producís en lotes con receta: panadería, repostería…"). Es el mejor
  texto de todo el producto y sirve de modelo para el resto.
- **La honestidad de la interfaz frente a lo que no existe.** Donde falta una acción en el backend,
  la interfaz bloquea el control en vez de fingir (el interruptor de gasto recurrente, los campos de
  capacidad sin datos, el botón de exportar ausente en vez de roto). Es infrecuente y hay que
  mantenerlo.
- **El modelo de corrección por ajuste.** Ventas, compras, producciones y stock no se editan: se
  corrigen con un movimiento nuevo que exige motivo. Cuesta un poco explicarlo la primera vez, pero
  es lo que hace que los reportes sean confiables, y el manual lo puede enseñar como una virtud.
