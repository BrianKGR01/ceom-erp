# Glosario — vocabulario técnico → vocabulario de usuario

> **Qué es este documento.** El sistema arrastra a la pantalla palabras que vienen del modelo de
> datos y del código, no del negocio del usuario. Este glosario fija **una decisión por término**:
> cómo se va a llamar de acá en adelante, en la interfaz y en el manual.
>
> **Cómo se usa.** Dos consumidores:
> 1. La sesión de UI que va a renombrar la interfaz — toma la columna "Término de usuario" y la
>    aplica en los archivos de la columna "Dónde aparece hoy".
> 2. El manual de usuario — nunca escribe un término de la columna izquierda, ni siquiera entre
>    paréntesis.
>
> **Criterio.** Conservador a propósito. Un vocabulario que cambia dos veces es peor que uno
> imperfecto. Donde el término actual ya es vocabulario de negocio legítimo, la decisión es
> **mantenerlo** — y está anotada igual, para que nadie gaste tiempo renombrando algo que ya está
> bien.
>
> Ubicaciones verificadas contra el código el 2026-07-22. Los `archivo:línea` pueden correrse con
> el tiempo; el término exacto es el ancla real de búsqueda.

---

## Cómo leer las columnas

| Columna | Qué significa |
|---|---|
| **Término técnico actual** | Lo que se ve hoy en pantalla, textual. |
| **Término de usuario** | La decisión. Esto es lo que tiene que decir la interfaz. |
| **Dónde aparece hoy** | Archivo:línea o pantalla. No exhaustivo cuando el término se repite mucho — en esos casos está anotada la cantidad. |
| **Nota** | Por qué se decidió así, o qué cuidado hay que tener al renombrar. |

**Marca `= MANTENER`**: el término actual se queda. No es un pendiente.

---

## 1. Los tres actores y las entidades centrales

| Término técnico actual | Término de usuario | Dónde aparece hoy | Nota |
|---|---|---|---|
| **Tenant** / **Tenants** | **Negocio** / **Negocios** | ~25 cadenas de interfaz + **105 mensajes de error** en 12 módulos. Interfaz: `admin-shell.tsx:33`, `admin/(shell)/tenants/tenants-cliente.tsx:58,64,71,83,140,146`, `admin/(shell)/tenants/nuevo/page.tsx:19`, `admin/(shell)/instituciones/instituciones-cliente.tsx:357,380,694,699,709`, `admin/(shell)/logs/logs-cliente.tsx:75,138,147`, **`portal/cartera-cliente.tsx:92,98,112,147,150`**, **`app/(shell)/mi-negocio/plan/page.tsx:33,34,35,76`** | **El término más urgente de todos.** Se filtró a las dos superficies donde menos se lo puede justificar: el portal de la Institución externa y "Mi Plan" del propio dueño. Se elige *Negocio* y no *Empresa* porque la interfaz ya dice "negocio" en todo lo que escribió el usuario final: nav "Mi negocio", campo "Nombre de tu negocio", `nombreNegocio`, "¡Bienvenido, {negocio}!". Ver [advertencia sobre este término](#advertencia-negocio-vs-empresa). |
| **Owner** | **Dueño** | `mi-negocio/colaboradores/colaboradores-cliente.tsx:447` (badge), `:418`, `:370`, `:304`, `:309`, `:333`; `admin/(shell)/tenants/nuevo/nuevo-tenant-cliente.tsx:159,161`; `mi-negocio/roles/roles-cliente.tsx:74`; `mi-negocio/plan/page.tsx:34`; ~17 mensajes de error en `identidad/actions.ts` | Palabra en inglés, en un badge, en la pantalla de gestión de personas. "Dueño" es el término natural y no se confunde con nada. |
| **Transferir Owner** / **Transferir mi condición de Owner** | **Pasar el negocio a otra persona** | `colaboradores-cliente.tsx:304` (título), `:370`, `:418` | El nombre actual no dice qué pasa. El nuevo sí, y la acción es irreversible — conviene que el título lo transmita. |
| **CEOM Admin** / **`ceom_admin`** | **Equipo CEOM** (hablándole al negocio)<br>**Administrador CEOM** (dentro de `/admin`) | `roles-cliente.tsx:75`; `capacidades-cliente.tsx:246`; `mi-negocio/plan/page.tsx:184`; **`admin/(shell)/logs/logs-cliente.tsx:70`** (muestra el identificador `ceom_admin` literal) | Dos registros a propósito: al dueño de un negocio no le importa el rol, le importa quién es ("el equipo de CEOM"); adentro del panel interno sí es un rol con nombre. |
| **Institución** / **Institución veedora** | **Institución** `= MANTENER` | `admin-shell.tsx:35`, `instituciones-cliente.tsx:121` | Es vocabulario de negocio real. Se mantiene. |
| **veedor** (como adjetivo: "módulos veedor", "veedor-seguro") | **eliminar la palabra** — ver fila "Módulos veedor permitidos" | `mi-negocio/plan/page.tsx:164,170` | "Veedor" es término del modelo de datos. Ningún usuario lo usa. |
| **Colaborador** | **Colaborador** `= MANTENER` | `mi-negocio/colaboradores/*` | Ya es la palabra correcta. **Unificar**: donde hoy dice "Usuario" para referirse a una persona del negocio, debe decir "Colaborador" (ver `capacidades-cliente.tsx:288,316`). |
| **Sucursal** | **Sucursal** `= MANTENER` | `activo-form.tsx:123`, `product-form.tsx:275,282`, `productos/[id]/ficha-cliente.tsx:469,710`, y ~40 archivos más | Palabra de negocio legítima en español. **Pero** hoy el sistema crea exactamente una y no existe forma de crear otra — ver `hallazgos.md` H-02. El término se mantiene; el problema es funcional, no de vocabulario. |
| **Insumo** | **Insumo** `= MANTENER` | `produccion/insumos/page.tsx:22`, `app-shell.tsx:247`, `insumos/nuevo/page.tsx:20` | Vocabulario estándar del rubro en Latinoamérica. "Ingrediente" sería más angosto (los insumos incluyen envases y etiquetas). Se mantiene. |
| **Stock** | **Stock** `= MANTENER` | `product-form.tsx:258`, `insumo-form.tsx:118`, `productos/[id]/ficha-cliente.tsx:469,478,479,500`, `capacidad-cliente.tsx:160` | Anglicismo, pero completamente asentado en el comercio de la región. Renombrarlo a "existencias" sería más raro, no más claro. Se mantiene. |

<a id="advertencia-negocio-vs-empresa"></a>
> ✅ **`Tenant` → `Negocio` está confirmado** (2026-07-22). Se evaluó también *Empresa* —el pedido
> original llamaba al actor "Empresa (tenant)"— y se eligió **Negocio** porque es lo que ya dice toda
> la interfaz escrita para el usuario final ("Mi negocio", "Nombre de tu negocio", `nombreNegocio`) y
> porque el público real son emprendimientos chicos. **No volver a abrir esta decisión:** son ~130
> cadenas y todo el manual ya está escrito sobre ella.

---

## 2. Permisos, roles y capacidades

| Término técnico actual | Término de usuario | Dónde aparece hoy | Nota |
|---|---|---|---|
| **Capacidades Especiales** | **Permisos especiales** | `app-shell.tsx:226` (nav), `capacidades-cliente.tsx:75,238`, `roles-cliente.tsx:99`, `colaboradores-cliente.tsx:71`, `mi-negocio/plan/page.tsx:51` (6 lugares) | "Capacidad" es la palabra del enum (`capacidadEspecialEnum`). El usuario ya entiende "permiso" — no hace falta un segundo concepto. |
| **Matriz de Permisos** | **Qué puede hacer este rol** | `roles-cliente.tsx:409` (`<h3>`) | "Matriz" describe la estructura de datos, no lo que el usuario está mirando. |
| **Override** / **Overrides por Usuario** | **Excepción** / **Excepciones por colaborador** | `capacidades-cliente.tsx:122` (título de diálogo), `:288` (`<h2>`), `:316` (estado vacío) | Anglicismo técnico puro. "Excepción" es exactamente lo que es: se aparta del permiso del rol para una sola persona. |
| **Agregar override por colaborador** | **Agregar una excepción** | `capacidades-cliente.tsx:122` | |
| **Rol de sistema** (badge) | **Rol predefinido** | `roles-cliente.tsx:348` | Renderiza el flag `esRolSistema`. Lo que le importa al usuario es que no lo puede editar. |
| **`anular_ajustar`** → "Anular/Ajustar" | **Anular o corregir** | `roles-cliente.tsx:70` (columna de la matriz) | La barra `/` es sintaxis de programador. |
| **`costos_gastos`** → "Costos y Gastos" | **Gastos** | `roles-cliente.tsx:57` | Alinear con el nav, que ya dice "Gastos" (`app-shell.tsx:234`). Hoy la misma cosa tiene dos nombres. |
| **`operativo`** → "Operativo" | **Producción** | `roles-cliente.tsx:59` | Alinear con el nav, que ya dice "Producción" (`app-shell.tsx:243`). |
| **`financiero`** → "Financiero" | **Finanzas** | `roles-cliente.tsx:60` | "Financiero" suelto es un adjetivo sin sustantivo. |
| **`inventario`** → "Inventario" | **Stock** | matriz de permisos, `roles-cliente.tsx` | Alinear con el resto de la app, que dice "stock" en todas las pantallas de producto. |
| **`simulaciones`** → "Simulaciones" | **Simulador** | matriz de permisos + `app-shell.tsx:252` | Ver fila del nav más abajo. |
| **"(Módulo 1, sección 6.3)"** | **borrar** | `roles-cliente.tsx:170` (descripción de un diálogo, visible) | Referencia a documentación interna de especificación filtrada a la pantalla. No se traduce: se elimina. |
| **`vender_sin_stock`, `gestionar_eventos`, `importar_historico`, `producir_sin_stock_insumo`** | ya traducidos `= MANTENER` | `capacidades-cliente.tsx:57-60` | Se muestran como "Vender sin stock", "Gestionar eventos", "Importar histórico", "Producir sin stock". Están bien. |

---

## 3. Suscripción, planes y estado de la cuenta

| Término técnico actual | Término de usuario | Dónde aparece hoy | Nota |
|---|---|---|---|
| **Downgrade autogestionado** | **Podés bajar de plan por tu cuenta** | `mi-negocio/plan/page.tsx:35`, `admin/(shell)/planes/planes-cliente.tsx:58` | Es el texto de una característica del plan, leído por el dueño del negocio. |
| **upgrade o downgrade** | **subir o bajar de plan** | `mi-negocio/plan/page.tsx:185`, `admin/(shell)/tenants/[tenantId]/ficha-cliente.tsx:149` | |
| **Múltiples Owners** | **Más de un dueño** | `mi-negocio/plan/page.tsx:34`, `planes-cliente.tsx:57` | Consecuencia de `Owner → Dueño`. |
| **"El tenant puede operar con más de una sucursal."** | **"Tu negocio puede tener más de una sucursal."** | `mi-negocio/plan/page.tsx:33` (+ duplicado en `planes-cliente.tsx:56`) | Además de `tenant`, corregir la tercera persona: esta pantalla le habla al dueño. |
| **`solo_lectura`** → "Solo lectura" | **Solo lectura** `= MANTENER` | `tenants-cliente.tsx:30`, `mi-negocio/plan/page.tsx:25`, `portal/cartera-cliente.tsx:46` | Ya traducido y es comprensible. Se mantiene. |
| **`estadoSuscripcion`: activa / pausada / vencida** | `= MANTENER` | Ficha de negocio en `/admin` | Claros como están. |
| **Módulos veedor permitidos** | **Qué información podés compartir** | `mi-negocio/plan/page.tsx:164` | |
| **Sin módulos veedor habilitados** | **Tu plan no incluye compartir información** | `mi-negocio/plan/page.tsx:170` | |

---

## 4. Los tres tipos de información compartible

> Estos tres valores (`financiero` / `operativo` / `inventario_operativo`) son la unidad con la que
> un negocio le da acceso a una institución. Aparecen en cinco pantallas distintas y hoy se
> muestran con el nombre del módulo interno.

| Término técnico actual | Término de usuario | Dónde aparece hoy | Nota |
|---|---|---|---|
| **Módulo Financiero** (`financiero`) | **Ventas y finanzas** | `consentimiento/generar-cliente.tsx:28`, `mi-negocio/plan/page.tsx:18`, `admin/(shell)/tenants/[tenantId]/ficha-cliente.tsx:76`, `portal/cartera/[tenantId]/ficha-cliente.tsx:36` | Es lo que contiene de verdad: tendencia de ventas, flujo de caja, estado de resultados. |
| **Módulo Operativo** (`operativo`) | **Producción** | `generar-cliente.tsx:33`, `mi-negocio/plan/page.tsx:19`, `ficha-cliente.tsx:77` (ambas superficies) | |
| **Inventario Operativo** (`inventario_operativo`) | **Insumos y stock** | `generar-cliente.tsx:38`, `mi-negocio/plan/page.tsx:20`, `admin/.../ficha-cliente.tsx:78`, `portal/.../ficha-cliente.tsx:38` | |
| **Aprobaciones/Consentimientos vigentes** | **Permisos vigentes** | `consentimiento/aprobaciones/aprobaciones-cliente.tsx:53` | El título actual ofrece dos sinónimos separados por una barra — señal de que ni el código decidió cómo llamarlo. |
| **Solicitudes de Seguimiento entrantes** | **Solicitudes de acceso** | `consentimiento/solicitudes/solicitudes-cliente.tsx:67` | |
| **Compartir Datos** (nav) | **Compartir Datos** `= MANTENER` | `app-shell.tsx:254`, `generar-cliente.tsx:116` | **Buen ejemplo ya presente**: el módulo interno se llama `consentimiento` y la pantalla dice "Compartir Datos". Se mantiene y se usa como referencia del criterio. |

---

## 5. Nombres de pantallas y de secciones del menú

| Término técnico actual | Término de usuario | Dónde aparece hoy | Nota |
|---|---|---|---|
| **Patrimonio** (nav) | **Bienes y deudas** | `app-shell.tsx:199` | "Patrimonio" es correcto contablemente y opaco para un emprendedor. |
| **Activos** | **Bienes** | `app-shell.tsx:202`, `patrimonio/page.tsx:34`, `patrimonio/nuevo/page.tsx:25` | |
| **Pasivos** | **Deudas** | `app-shell.tsx:203`, `patrimonio/pasivos/page.tsx:35`, `pasivos/nuevo/page.tsx:28` | |
| **Refinanciar pasivo** | **Refinanciar deuda** | `patrimonio/pasivos/[id]/refinanciar/page.tsx:37` | |
| **Simulaciones** (nav) | **Simulador** | `app-shell.tsx:252` | Sustantivo de herramienta, no de registro. El usuario no consulta "sus simulaciones", usa un simulador. |
| **Comparativo Multi-SKU** | **Comparar productos** | `comparativo/comparativo-cliente.tsx:78` (título) + barra de navegación de Simulaciones en `simulador-cliente.tsx:74`, `margen-producto-cliente.tsx:28`, `historial-cliente.tsx:53`, `comparativo-cliente.tsx:47` (5 lugares) | "SKU" no aparece en ninguna otra parte de la app — es jerga suelta. |
| **Cruce Canal × Producto × Margen** | **Margen por canal y producto** | `reportes/margen-canal-producto/margen-canal-producto-cliente.tsx:165` | El `×` es notación de tabla dinámica. El nombre correcto ya lo usa la propia ruta. |
| **Vincular a proceso operativo** | **Vincular a una receta** | `productos/[id]/ficha-cliente.tsx:799` (título de diálogo) | Lo que hace el botón es elegir una receta. |
| **Producción de Ajuste** | **Corregir una producción** | `produccion/producciones-cliente.tsx:86` | |
| **Capacidad Operativa** | **Capacidad de producción** | `produccion/capacidad/page.tsx:22` | Distingue de la de almacenamiento, que es la card de al lado. |
| **Capacidad de Almacenamiento Usada** | **Cuánto depósito estás usando** | `dashboard-resumen.tsx:359` | |
| **Logs de Acceso** | **Registro de accesos** | `admin-shell.tsx:36`, `admin/(shell)/logs/logs-cliente.tsx:70` | |
| **Panel de Administración** | **Panel de Administración** `= MANTENER` | `admin-shell.tsx:128` | Correcto. |
| **Estado de Resultados**, **Flujo de Caja**, **Punto de Equilibrio**, **Margen** | `= MANTENER` | Reportes y Simulador | Vocabulario contable estándar. El manual los explica la primera vez que aparecen en vez de renombrarlos — son términos que al usuario le conviene aprender. |

---

## 6. Rubro (ex "nicho")

| Término técnico actual | Término de usuario | Dónde aparece hoy | Nota |
|---|---|---|---|
| **Nicho** | **Rubro** | `admin/(shell)/tenants/tenants-cliente.tsx:129,132,147,163`; `portal/cartera-cliente.tsx:172` | **El onboarding ya lo resolvió bien** (`onboarding-wizard.tsx:14,26,32` dice "Tu rubro"). Falta propagarlo a `/admin` y al portal, que siguen diciendo "Nicho". |
| **`nicho_1`** | **Alimentos y bebidas por lotes** | `onboarding-wizard.tsx:26` | El nombre correcto ya existe en el onboarding. |
| **`nicho_4`** | **Comercio minorista y distribución** | `onboarding-wizard.tsx:32` | Ídem. |
| **Modo Básico** | **Modo Básico** `= MANTENER` | `onboarding-wizard.tsx:38` | |

---

## 7. Mensajes de error

> No hay errores de Postgres, stack traces ni texto en inglés llegando al usuario — eso ya está
> bien resuelto. El problema es de vocabulario y de utilidad del mensaje.

| Término técnico actual | Término de usuario | Dónde aparece hoy | Nota |
|---|---|---|---|
| **"…en este tenant."** (fórmula repetida) | **borrar el complemento**: "No tenés permiso para crear clientes." | 105 cadenas en 12 módulos: `ventas/actions.ts` (19), `identidad/actions.ts` (16), `nicho-1/actions.ts` (15), `gastos/actions.ts` (14), `productos/actions.ts` (13), `proveedores/actions.ts` (7), `simulaciones/actions.ts` (6), `patrimonio/actions.ts` (5), `financiero/actions.ts` (4), `consentimiento/actions.ts` (4), `monitoreo-institucional/actions.ts` (1), `nicho-4/actions.ts` (1) | El usuario solo tiene un negocio: "en este tenant" no agrega información, solo jerga. Donde el contexto sí importe, "en este negocio". **Es el cambio de mayor volumen del glosario.** |
| **"Tenant no encontrado."** | **"No encontramos el negocio."** | `identidad/actions.ts:165,181,202,429,461,521,555` | |
| **"Una compra de insumo requiere insumoId (y no productoId)."** | **"Para una compra de insumo tenés que elegir un insumo, no un producto."** | `proveedores/actions.ts:252` | Nombres de columna de la base expuestos al usuario. |
| **"Una compra de reventa requiere productoId (y no insumoId)."** | **"Para una compra de reventa tenés que elegir un producto, no un insumo."** | `proveedores/actions.ts:255` | |
| **"No se puede suspender al unico Owner del tenant."** | **"No podés suspender al único dueño del negocio."** | `identidad/actions.ts:679` | Además le falta la tilde a "único". |
| **"Rol inválido."** | **"Ese rol no se puede asignar."** | `identidad/actions.ts:600,651` | El mensaje actual no dice por qué ni qué hacer. |
| **"Rubro inválido."** | **"Elegí uno de los rubros de la lista."** | `app/app/onboarding/actions.ts:62` | |
| **"Solo el Owner puede …"** (≈17 variantes) | **"Solo el dueño del negocio puede …"** | `identidad/actions.ts:494,515,543,575,588,633,663,693,726,766,777,798,820,839,886,923,953` | |
| **"Solo CEOM Admin puede dar de alta un tenant."** | **"Solo el equipo CEOM puede dar de alta un negocio."** | `identidad/actions.ts:355,425,457` (3 variantes) | |
| **"Tu sesión expiró — iniciá sesión de nuevo."** | `= MANTENER` | consistente en toda la app | **Buen ejemplo**: claro, en voseo, accionable. |

---

## 8. Inconsistencias a resolver de paso

No son jerga, son la misma cosa llamada de dos formas. Conviene cerrarlas en el mismo trabajo.

| Problema | Dónde | Decisión |
|---|---|---|
| **"Email" vs "correo"** | "Email": `colaboradores-cliente.tsx:136`, `clientes-cliente.tsx:110`, `canjear-cliente.tsx:196,271`, `instituciones-cliente.tsx:518,620`, `nuevo-tenant-cliente.tsx:177`. "Correo": `login/actions.ts:17` | Unificar en **"Correo electrónico"** (label) / **"correo"** (prosa). |
| **`variable_no_productivo` con dos etiquetas distintas** | "Variable" en `gastos/gastos-cliente.tsx:29` vs "Variable no productivo" en `gastos/[id]/ficha-gasto-cliente.tsx:29` | Unificar en **"Variable"**. El listado y la ficha muestran hoy nombres distintos para el mismo gasto. |
| **Mapas `MAPA[valor] ?? valor`**: degradan al identificador crudo si aparece un valor nuevo | `tenants-cliente.tsx:132,163`, `portal/cartera-cliente.tsx:172`, `mi-negocio/plan/page.tsx:174` | El fallback debe ser un texto neutro (**"Sin especificar"**), nunca el identificador. Hoy un `nicho_2` futuro se imprimiría literal en el portal externo. |
| **Etiqueta derivada mecánicamente** (quita guiones bajos y capitaliza) | `admin/(shell)/logs/logs-cliente.tsx:27-28` | Reemplazar por un mapa explícito con los términos de la sección 4. Hoy produce "Inventario operativo". |
| **UUID truncado como identidad de una persona** | `logs-cliente.tsx:149` — muestra 8 caracteres de un UUID en `font-mono` en la columna "Usuario CEOM" | Mostrar el nombre. Es una pantalla de auditoría: un UUID a medias no sirve ni para auditar. Ver `hallazgos.md` H-07. |
| **Mapa duplicado a mano** que puede divergir | `MODULOS_VEEDOR_INFO` en `generar-cliente.tsx:23`, copiado en `mi-negocio/plan/page.tsx:17` | Al renombrar los 3 tipos de información (sección 4), **hay que tocar los dos archivos**. La duplicación es deliberada (restricción Server/Client Component, documentada en `plan/page.tsx:11-16`), pero hace fácil renombrar uno solo y no el otro. |

---

## 9. Términos que el manual usa y la interfaz todavía no

Palabras que necesito en el manual y que hoy no tienen lugar en la UI. Se listan acá para que el
vocabulario nazca unificado, no para pedir pantallas nuevas.

| Concepto | Término de usuario | Por qué hace falta |
|---|---|---|
| La organización que opera CEOM | **Equipo CEOM** | El manual tiene que nombrar al actor 1 sin decir "ceom_admin". |
| El conjunto de las tres superficies | **la aplicación** (`/app`), **el panel interno** (`/admin`), **el portal de instituciones** (`/portal`) | Hoy no hay ningún cartel que le diga al usuario en cuál está. Ver `hallazgos.md` H-09. |
| Canal de venta | **Canal de venta** `= MANTENER` | Ya es correcto. **Atención**: no confundirlo con el campo "¿Dónde vendés hoy?" del onboarding, que es otra cosa — ver `hallazgos.md` H-01. |
| El estado inicial sin datos | **negocio recién creado** | Necesario para describir el arranque real. |

---

## Resumen para la sesión de UI

Si hay que priorizar, este es el orden por impacto:

1. **`tenant` → `negocio`** — ~130 cadenas. Toca las tres superficies, incluida la de menor
   alfabetización técnica (`/portal`). Es, de lejos, la número uno.
2. **`Owner` → `Dueño`** y **`override` → `excepción`** — palabras en inglés en pantallas de
   gestión de personas.
3. **Los 3 tipos de información compartible** (sección 4) — 5 pantallas, y es lo que el negocio
   tiene que entender para decidir qué comparte con una institución. Recordar el mapa duplicado.
4. **`Nicho` → `Rubro`** en `/admin` y `/portal` — el término correcto ya existe en el onboarding.
5. **`Patrimonio/Activos/Pasivos` → `Bienes y deudas/Bienes/Deudas`** — nav + 4 títulos.
6. **Borrar `"(Módulo 1, sección 6.3)"`** de `roles-cliente.tsx:170` — 30 segundos, y es una fuga
   de documentación interna a la cara del usuario.
