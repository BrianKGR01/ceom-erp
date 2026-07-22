# Manual de usuario de CEOM — estructura y convenciones

> **Estado: completo.** Los 20 capítulos de los tres actores están escritos, más los cuatro
> documentos transversales. [`negocio/01-primeros-pasos.md`](negocio/01-primeros-pasos.md) se escribió
> primero como referencia de calidad y sigue siendo el modelo de nivel de detalle.
>
> Todo se verificó contra el código, no contra la documentación funcional ni contra
> [`docs/ui/pantallas.md`](../ui/pantallas.md), que tiene deriva conocida (ver H-22). Los flujos se
> recorrieron con la lente de un **negocio recién creado**, no del que puebla `pnpm seed:demo` — ahí
> se escondían varios de los hallazgos.

---

## Para quién es este manual

Dos públicos, un solo texto:

- **El equipo interno que va a probar el sistema.** Necesita saber qué debería pasar en cada paso
  para poder decir "esto no pasa". Por eso el manual describe el comportamiento real con precisión,
  incluido lo que no funciona.
- **Usuarios finales reales** — dueños de emprendimientos, sin formación técnica ni contable.

Cuando los dos públicos entran en conflicto, gana el usuario final: el texto se escribe para quien
no sabe nada, y lo que el equipo interno necesita saber de más va en notas marcadas.

---

## Los tres actores

| Actor | Quién es | Dónde entra | Archivos |
|---|---|---|---|
| **Equipo CEOM** | El equipo que opera la plataforma. Da de alta negocios, define planes y registra instituciones. Sin roles internos por ahora: quien tiene acceso, tiene acceso a todo. | `/admin` | [`equipo-ceom/`](#equipo-ceom--el-panel-interno) |
| **Negocio** | La empresa cliente. Un dueño más los colaboradores que quiera, con roles que cada negocio define. | `/app` | [`negocio/`](#negocio--la-aplicación) |
| **Institución** | Universidad, incubadora u organización que hace seguimiento de negocios que le dieron permiso. No tiene cuenta de CEOM. | `/portal` | [`instituciones/`](#instituciones--el-portal) |

El orden de los capítulos **no** es el orden de esta tabla. Es el orden en que las cosas tienen que
existir: ver [`auditoria-por-actor.md`](auditoria-por-actor.md), que es la columna vertebral del
manual.

---

## Índice

### Documentos transversales

| Archivo | Qué contiene | Estado |
|---|---|---|
| [`glosario.md`](glosario.md) | Vocabulario técnico → vocabulario de usuario. Decisión por término, con ubicación en el código. | ✅ escrito |
| [`auditoria-por-actor.md`](auditoria-por-actor.md) | Qué pantallas ve cada actor, qué puede hacer, y en qué orden tiene sentido hacerlo. | ✅ escrito |
| [`hallazgos.md`](hallazgos.md) | Todo lo que apareció al documentar: pasos que no se entienden, orden que no cierra, funciones incompletas. Alimenta el trabajo de UI. | ✅ escrito |
| [`propuesta-roles-por-defecto.md`](propuesta-roles-por-defecto.md) | Conjunto de roles sugerido para negocios. **Propuesta, no existe en el sistema.** | ✅ escrito |

### Negocio — la aplicación

El grueso del manual. El orden es el recorrido real de alguien que arranca de cero.

| # | Archivo | Qué cubre | Estado |
|---|---|---|---|
| 01 | [`negocio/01-primeros-pasos.md`](negocio/01-primeros-pasos.md) | Desde el correo de invitación hasta la primera venta registrada. Entrar, configurar el negocio, elegir el rubro, cargar el primer producto, crear el canal de venta, vender. | ✅ **escrito — sección modelo** |
| 02 | [`negocio/02-catalogo.md`](negocio/02-catalogo.md) | Categorías, productos, precio y costo, stock inicial, ajustes y transferencias de stock, historial de movimientos. | ✅ escrito |
| 03 | [`negocio/03-vender-todos-los-dias.md`](negocio/03-vender-todos-los-dias.md) | El punto de venta en profundidad, clientes, canales, métodos de pago, ventas a crédito y cobros, ajustes y anulaciones, eventos y ferias, importación. | ✅ escrito |
| 04 | [`negocio/04-gastos.md`](negocio/04-gastos.md) | Categorías de gasto, los tres tipos y por qué importan, gastos manuales, pagos, gastos recurrentes, y por qué la marca de "gasto automático" hoy no aparece nunca. | ✅ escrito |
| 05 | [`negocio/05-compras-y-proveedores.md`](negocio/05-compras-y-proveedores.md) | Directorio de proveedores, registrar una compra, recibirla, pagarla, corregirla. Cómo la compra actualiza el costo. | ✅ escrito |
| 06 | [`negocio/06-bienes-y-deudas.md`](negocio/06-bienes-y-deudas.md) | Bienes (alta, depreciación, baja, transferencia), deudas (alta, pagos, refinanciación), y cómo se relacionan. | ✅ escrito |
| 07 | [`negocio/07-produccion.md`](negocio/07-produccion.md) | Solo para el rubro de alimentos y bebidas por lotes: insumos, recetas, vincular un producto a una receta, registrar una producción, merma y capacidad. | ✅ escrito |
| 08 | [`negocio/08-entender-el-negocio.md`](negocio/08-entender-el-negocio.md) | **Qué números son confiables hoy y cuáles no**, el panel de inicio, los reportes detallados, y el simulador de precios y punto de equilibrio. | ✅ escrito |
| 09 | [`negocio/09-tu-equipo.md`](negocio/09-tu-equipo.md) | Armar roles desde cero, invitar colaboradores, permisos especiales, y qué pasa el día que el dueño no está. | ✅ escrito |
| 10 | [`negocio/10-compartir-datos.md`](negocio/10-compartir-datos.md) | Qué se comparte con una institución y qué no, los dos caminos de acceso, y cómo se revoca. | ✅ escrito |
| 11 | [`negocio/11-tu-plan.md`](negocio/11-tu-plan.md) | Qué incluye el plan, los dos estados de la suscripción, qué pasa cuando vence y a quién escribirle. | ✅ escrito |

### Equipo CEOM — el panel interno

| # | Archivo | Qué cubre | Estado |
|---|---|---|---|
| 01 | [`equipo-ceom/01-antes-de-empezar.md`](equipo-ceom/01-antes-de-empezar.md) | Cómo se crea el primer acceso administrativo y por qué no hay una pantalla para eso. Qué hay que tener listo antes de dar de alta el primer negocio. | ✅ escrito |
| 02 | [`equipo-ceom/02-planes.md`](equipo-ceom/02-planes.md) | El catálogo de planes: qué controla cada campo y qué pasa si no hay ningún plan activo. | ✅ escrito |
| 03 | [`equipo-ceom/03-alta-de-negocios.md`](equipo-ceom/03-alta-de-negocios.md) | Dar de alta un negocio, qué se crea automáticamente, qué recibe el dueño, y qué queda pendiente de configurar del lado del negocio. | ✅ escrito |
| 04 | [`equipo-ceom/04-seguimiento-de-negocios.md`](equipo-ceom/04-seguimiento-de-negocios.md) | El listado con salud agregada, la ficha, cambiar de plan, cambiar el estado de la suscripción, y las tres pestañas de consulta. | ✅ escrito |
| 05 | [`equipo-ceom/05-instituciones.md`](equipo-ceom/05-instituciones.md) | Alta de instituciones, cartera, crear solicitudes de seguimiento. | ✅ escrito |
| 06 | [`equipo-ceom/06-registro-de-accesos.md`](equipo-ceom/06-registro-de-accesos.md) | Qué queda registrado cuando el equipo consulta datos de un negocio, y qué no. | ✅ escrito |

### Instituciones — el portal

| # | Archivo | Qué cubre | Estado |
|---|---|---|---|
| 01 | [`instituciones/01-primer-acceso.md`](instituciones/01-primer-acceso.md) | Los dos caminos de entrada (código de acceso y solicitud), canjear el código, y cómo se vuelve a entrar después. | ✅ escrito |
| 02 | [`instituciones/02-tu-cartera.md`](instituciones/02-tu-cartera.md) | La cartera de negocios y qué significa cada estado. | ✅ escrito |
| 03 | [`instituciones/03-ver-un-negocio.md`](instituciones/03-ver-un-negocio.md) | Las cuatro pestañas, qué muestra cada una, y por qué algunas aparecen con candado. | ✅ escrito |

---

## Convenciones

### Nomenclatura

1. **El [glosario](glosario.md) manda.** Ningún archivo del manual usa un término de la columna
   izquierda del glosario, ni siquiera aclarando entre paréntesis. Si hace falta un término que no
   está en el glosario, se agrega ahí primero.
2. **Un concepto, una palabra.** Nada de sinónimos por variedad de estilo. Si en un archivo es
   "canal de venta", en todos es "canal de venta".
3. **Nombres de pantalla en negrita, tal como se leen en la interfaz**: el botón **Guardar y
   continuar**, la sección **Mi negocio**. Si el glosario decidió renombrar esa pantalla, el manual
   usa el nombre nuevo — el manual y la interfaz se corrigen juntos, no se documenta el nombre
   viejo.

### Tono

- **Vos, no usted.** Es el registro que ya usa toda la interfaz.
- **Segunda persona y voz activa**: "cargá tu primer producto", no "el usuario deberá cargar".
- **Frases cortas.** Un paso por oración.
- **El porqué antes del paso**, cuando el paso no es obvio. Un manual que solo enumera clics no
  sirve para decidir nada. La regla práctica: si alguien podría razonablemente saltearse el paso,
  hay que explicar qué se rompe si lo saltea.
- **Nada de disculparse por el producto.** Lo que no funciona se dice con neutralidad y se registra
  en `hallazgos.md`; el manual no editorializa.
- **Sin capturas de pantalla en esta fase.** La interfaz va a cambiar con el trabajo de UI. Cuando
  se estabilice, se agregan.

### Cómo se referencian las pantallas

Formato: **Nombre de la pantalla** seguido de su ruta entre paréntesis, la primera vez que aparece
en cada archivo.

> Andá a **Canales de venta** (`/app/ventas/canales`).

Para navegación dentro de una pantalla, se usa `›`:

> **Mi negocio › Colaboradores › Invitar colaborador**

Las rutas se escriben porque el equipo interno las necesita para reportar. Para el usuario final son
ruido tolerable: aparecen una sola vez por archivo, no en cada mención.

### Cómo se marca lo que no existe o no funciona

Cuatro marcas, y **nunca se mezclan en un mismo párrafo**. Esta es la convención más importante del
manual: la tentación permanente es describir el sistema ideal.

| Marca | Cuándo se usa | Formato |
|---|---|---|
| *(sin marca)* | **Existe y funciona.** El caso normal. Se describe y ya. | Texto común. |
| ⚠️ | **Existe pero se comporta distinto de lo que uno esperaría.** Funciona, pero de una forma que sorprende. Se describe el comportamiento real, no el esperado. | `> ⚠️ **Ojo:** …` |
| 🚧 | **No existe todavía.** La función se menciona porque el usuario la va a buscar, y hay que decirle que no está y qué hacer mientras tanto. | `> 🚧 **Todavía no:** …` |
| 🔎 | **Nota para el equipo interno.** Detalle de verificación o de implementación que al usuario final no le sirve. | `> 🔎 **Nota interna:** …` |

Reglas de uso:

- **Todo ⚠️ y todo 🚧 tiene una entrada correspondiente en [`hallazgos.md`](hallazgos.md)**, con su
  identificador. La nota del manual enlaza al hallazgo: `(ver H-01)`.
- **Nunca describir en futuro.** Prohibido "próximamente", "en una versión futura", "está previsto".
  El manual describe el presente; lo que no está, no está.
- **Nunca inferir del nombre.** Si una pantalla se llama "Capacidad Operativa", eso no autoriza a
  escribir qué hace. Se abre, se mira, se verifica contra el código, y recién ahí se escribe.

### Verificación

Toda afirmación del manual tiene que estar respaldada por una de estas fuentes, en este orden de
preferencia:

1. La aplicación desplegada, recorrida de verdad.
2. El código: la ruta en `src/app/`, la Server Action en `src/modules/<módulo>/actions.ts`, el
   esquema de validación en `validation.ts`.
3. El `ANCLA.md` del módulo y [`docs/ui/pantallas.md`](../ui/pantallas.md).

Los documentos funcionales (`docs/modules/Modulo_XX.md`) describen el **diseño**, no siempre lo
construido. Sirven para entender la intención; **no alcanzan para afirmar que algo funciona**.
Donde el diseño y el código difieren, manda el código y la diferencia se anota como hallazgo.

---

## Qué falta decidir antes de escribir el resto

Dos cosas condicionan capítulos ya escritos y habría que revisarlos si cambian:

1. **Los roles por defecto.** [`propuesta-roles-por-defecto.md`](propuesta-roles-por-defecto.md) es
   una propuesta. `negocio/09-tu-equipo.md` hoy enseña a construir la matriz desde cero; si se
   aprueban roles predefinidos, esa sección se reescribe (ver H-35).
2. **Los hallazgos que el manual enseña a esquivar.** Varios capítulos dedican espacio a convivir con
   defectos: el paso 6 del capítulo 01 (H-01), las correcciones manuales del capítulo 8 (H-24, H-27,
   H-30, H-31) y las alternativas del capítulo 5 (H-31). **Si esos se corrigen, esas secciones se
   acortan bastante** — están escritas para poder sacarlas de un bloque, no entreveradas con el
   resto.

> **`Tenant` → "Negocio"** quedó confirmado el 2026-07-22. Es la decisión vigente en todo el manual.
