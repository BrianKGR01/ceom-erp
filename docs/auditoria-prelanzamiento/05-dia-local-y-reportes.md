# El día local y los reportes — diagnóstico del defecto de zona horaria

> **Qué es este documento.** El panorama completo del defecto por el que una venta hecha hoy no
> aparece en el reporte de "este mes". No implementa nada: inventaría todos los lugares afectados,
> mapea cómo se guarda cada fecha, identifica de dónde sale la noción de "día", propone un enfoque,
> y define el plan de migración y de pruebas.
>
> Verificado contra el código de `dev` el 2026-07-27, con la ejecución real de los presets bajo
> `TZ=America/La_Paz` y bajo `TZ=UTC`.

---

## 0. Nota sobre el identificador — esto no es H-13

El pedido lo llama **H-13**. Ese identificador ya está tomado: `H-13` en
[`docs/manual/hallazgos.md:357`](../manual/hallazgos.md) es *"Dos cosas que el registro de accesos no
distingue"* (producción vs. insumos, y la consulta de salud agregada), sin ninguna relación con
fechas. Busqué el defecto de fechas en los 48 hallazgos del manual y **no está registrado en ninguno**.

Donde sí está documentado es en el **mensaje del commit `2ea20e5`** y en el comentario largo de
[`proveedores/repository.ts:351-369`](../../src/modules/proveedores/repository.ts#L351), ambos de la
sesión que corrigió el único lugar puntual. Es decir: el defecto está descrito con precisión, pero
vive solo en el historial de git y en un comentario de código — no tiene ítem visible en el tracker
de hallazgos, que es exactamente el mecanismo que
[`02-arquitectura-y-calidad.md:84-86`](02-arquitectura-y-calidad.md) identifica como la razón por la
que las cosas se cierran o se duermen.

**Recomendación:** registrarlo como **H-49 🔴** en `hallazgos.md` antes de arreglarlo, y que este
documento sea su desarrollo. En el resto de este texto lo llamo **H-49**.

---

## 1. El defecto, y su demostración determinista

### 1.1 Qué pasa

Los reportes reciben el período como dos fechas de solo-día (`"2026-07-01"`, `"2026-07-27"`) y las
convierten con `new Date(...)`, que las ancla a **medianoche UTC**. El filtro que llega a la base es:

```
fecha_venta >= 2026-07-01T00:00:00Z  AND  fecha_venta <= 2026-07-27T00:00:00Z
```

Bolivia es UTC−4 sin horario de verano. Ese `<=` corta en **las 20:00 del 26 de julio, hora local**.
Todo lo que pasó durante el día local del 27 queda afuera. Como los cuatro presets de la interfaz
mandan `hasta = hoy`, **el día en curso nunca cuenta**.

### 1.2 La demostración

Ejecuté la lógica real de `calcularRangoPreset` contra timestamps de venta conocidos. El resultado
para el preset **"Este mes"**, mirando la pantalla a distintas horas del mismo día:

| El dueño mira el reporte a las… | Rango que se arma | Venta 08:00 | Venta 10:00 | Venta 19:00 | Venta 21:00 |
|---|---|---|---|---|---|
| 09:00 local | `2026-07-01` → `2026-07-27` | ❌ | ❌ | ❌ | ❌ |
| 19:00 local | `2026-07-01` → `2026-07-27` | ❌ | ❌ | ❌ | ❌ |
| **20:30 local** | `2026-07-01` → `2026-07-28` | ✅ | ✅ | ✅ | ❌ |

**El número cambia solo, a las 20:00 en punto, sin que nadie toque nada.** A esa hora el reloj UTC
cruza la medianoche, `hasta` pasa a ser mañana, y las ventas del día aparecen de golpe. Ese es el
modo de falla que hay que poder reproducir en un test sin depender de la hora en que corre.

### 1.3 El preset "Hoy" es un caso aparte: la ventana está vacía por construcción

Con `desde = hasta = "2026-07-27"`, el filtro es
`fecha_venta >= 2026-07-27T00:00:00Z AND <= 2026-07-27T00:00:00Z`: **un único instante**, que además
es *las 20:00 del día anterior* en hora local. El preset "Hoy" no puede mostrar nada, jamás, salvo
que una venta caiga exactamente en ese milisegundo. No es un borde mal calculado — es una ventana de
ancho cero.

### 1.4 Además, servidor y navegador no calculan lo mismo

`calcularRangoPreset` se llama de los dos lados: en `page.tsx` (servidor) para el render inicial, y
en los `*-cliente.tsx` (navegador) cuando el usuario cambia el filtro. Usa el reloj y el huso del
proceso donde corre. Hoy no se nota porque la máquina de desarrollo está en `America/La_Paz`; **en
producción Vercel corre en UTC**. Ejecuté el mismo cálculo en ambos husos, en el instante
`2026-01-01T02:00:00Z` (= 31 de diciembre, 22:00 en La Paz):

| Preset | Navegador en La Paz | Servidor en UTC |
|---|---|---|
| `anio` | `desde: 2025-01-01` | `desde: **2026**-01-01` |
| `mes` | `desde: 2025-12-01` | `desde: **2026-01**-01` |

El render del servidor muestra el año nuevo y el primer clic del usuario muestra el año viejo, o al
revés. Es un segundo defecto, independiente del borde superior, que **hoy está oculto por el huso de
la máquina de desarrollo y aparece al desplegar**.

---

## 2. Inventario completo de lugares afectados

### 2.1 Filtros SQL contra columnas `timestamptz` — el defecto

Diez funciones, todas con el mismo par `gte(col, desde) / lte(col, hasta)` sobre una columna que
guarda un instante:

| # | Función | Archivo:línea del borde | Columna filtrada | Qué alimenta |
|---|---|---|---|---|
| 1 | `sumarIngresosCostosPeriodo` | [`ventas/repository.ts:324`](../../src/modules/ventas/repository.ts#L324) | `ventas.fecha_venta` | Ingresos y COGS del **Estado de Resultados**, Dashboard, margen por producto, tendencia institucional |
| 2 | `sumarUnidadesVendidasPeriodo` | [`ventas/repository.ts:356`](../../src/modules/ventas/repository.ts#L356) | `ventas.fecha_venta` | **Rotación** — insumo de las dos simulaciones |
| 3 | `sumarPagosVentaPeriodo` | [`ventas/repository.ts:379`](../../src/modules/ventas/repository.ts#L379) | `pagos_venta.fecha_pago` | **Flujo de Caja** |
| 4 | `sumarAjustesVentaPeriodo` | [`ventas/repository.ts:403`](../../src/modules/ventas/repository.ts#L403) | `ajustes_venta.creado_en` | Ajustes del **Estado de Resultados** y del margen |
| 5 | `listarRankingProductos` | [`ventas/repository.ts:433`](../../src/modules/ventas/repository.ts#L433) | `ventas.fecha_venta` | Reporte **Ranking de productos** + 2 tarjetas del Dashboard |
| 6 | `listarHistoricoVentas` | [`ventas/repository.ts:477`](../../src/modules/ventas/repository.ts#L477) | `ventas.fecha_venta` | Reporte **Histórico de ventas** |
| 7 | `listarMargenPorCanalYProducto` | [`ventas/repository.ts:519`](../../src/modules/ventas/repository.ts#L519) | `ventas.fecha_venta` | Reporte **Margen canal × producto** |
| 8 | `consultarMermaPeriodo` | [`nicho-1/repository.ts:409`](../../src/modules/operativo/nichos/nicho-1/repository.ts#L409) | `producciones.fecha_produccion` | **Control de merma** (Reportes, Dashboard, monitoreo institucional) |
| 9 | `listarProduccionesPorActivoEnPeriodo` | [`nicho-1/repository.ts:381`](../../src/modules/operativo/nichos/nicho-1/repository.ts#L381) | `producciones.fecha_produccion` | **Capacidad de producción** |
| 10 | `listarLogsAccesoAdminCeom` | [`consentimiento/repository.ts:320`](../../src/modules/consentimiento/repository.ts#L320) | `logs_acceso_admin_ceom.creado_en` | **Registro de accesos** de `/admin` |

**Ya corregido, y solo a medias:**

| # | Función | Estado |
|---|---|---|
| 11 | `sumarCostoExtraAjustesCompraPeriodo` ([`proveedores/repository.ts:384`](../../src/modules/proveedores/repository.ts#L384)) | Borde **superior** arreglado (`lt(col, hasta+1día)`, commit `2ea20e5`). El **inferior sigue anclado a medianoche UTC**: incluye 4 horas de la noche anterior a `desde`. Hay que terminarlo con el mismo criterio que el resto. |

### 2.2 Dónde nace el anclaje: la conversión `string → Date`

Los repositorios reciben `Date` ya mal construidos. El anclaje ocurre en la capa de acciones:

| Archivo | Líneas | Funciones afectadas |
|---|---|---|
| [`ventas/actions.ts`](../../src/modules/ventas/actions.ts) | 852-853, 874-875, 904-905, 932-933, 949-950, 966-967, 984-985 | Las 7 funciones expuestas a Financiero y Reportes |
| [`nicho-1/actions.ts`](../../src/modules/operativo/nichos/nicho-1/actions.ts) | 787-788, 810-811 | `consultarMermaPeriodo`, `consultarCapacidadProduccionUsada` |
| [`proveedores/actions.ts`](../../src/modules/proveedores/actions.ts) | 866-867 | `consultarCostoExtraAjustesCompraEnPeriodo` |
| [`consentimiento/actions.ts`](../../src/modules/consentimiento/actions.ts) | 545-546 | `listarLogsAcceso` |

**Este es el punto de corte natural del arreglo.** Son 12 pares de líneas en 4 archivos, todos en la
capa que ya tiene el `tenantId` a mano y ya es asíncrona.

### 2.3 De dónde sale el rango: los presets

| Archivo | Qué hace |
|---|---|
| [`periodo-presets.ts:22`](../../src/app/app/\(shell\)/periodo-presets.ts#L22) `calcularRangoPreset` | Traduce `hoy`/`7dias`/`mes`/`anio` a `{desde, hasta}`. **Mezcla dos bases**: `hasta` sale de `toISOString()` (UTC) y `desde` de `getFullYear()/getMonth()` (huso del proceso). |
| [`periodo-presets.ts:47`](../../src/app/app/\(shell\)/periodo-presets.ts#L47) `calcularPeriodoAnterior` | Mismo defecto heredado; alimenta el delta "vs período anterior" del Dashboard. |
| [`capacidad-cliente.tsx:26-33`](../../src/app/app/\(shell\)/produccion/capacidad/capacidad-cliente.tsx#L26) | **Segunda implementación propia** de `primerDiaDelMes()` / `hoyISO()`, con la misma base UTC. |

**13 pantallas** consumen `calcularRangoPreset`, en cuatro superficies distintas:

- **Servidor** (render inicial): `page.tsx` del Dashboard y de los 4 reportes.
- **Navegador** (al cambiar filtro): `dashboard-resumen.tsx`, los 4 `*-cliente.tsx` de reportes,
  `simulador-cliente.tsx`, `margen-producto-cliente.tsx`.
- **`/admin`**: [`tenants/[tenantId]/ficha-cliente.tsx:339`](../../src/app/admin/\(shell\)/tenants/\[tenantId\]/ficha-cliente.tsx#L339).
- **`/portal`** (institucional): [`cartera/[tenantId]/ficha-cliente.tsx:83`](../../src/app/portal/cartera/\[tenantId\]/ficha-cliente.tsx#L83).

### 2.4 Agrupación, no filtrado — un lugar más

[`historico-ventas-cliente.tsx:63`](../../src/app/app/\(shell\)/reportes/historico-ventas/historico-ventas-cliente.tsx#L63)
`claveBucket()` agrupa las barras del gráfico por `fecha.toISOString().slice(0,10)`, o sea **por día
UTC**. Una venta de las 21:00 local del lunes se dibuja en la barra del martes. Es el mismo defecto
conceptual aplicado al eje del gráfico en vez de al filtro: arreglar el filtro y no esto deja el
total correcto con las barras corridas.

### 2.5 Lo que NO está afectado, y por qué

| Función | Columna | Por qué está bien |
|---|---|---|
| `sumarGastosPorTipoEnPeriodo`, `sumarGastosPorCategoriaEnPeriodo`, `sumarTotalGastosPeriodo` ([`gastos/repository.ts:258,279,332`](../../src/modules/gastos/repository.ts#L258)) | `gastos.fecha_gasto` (`date`) | Recibe `string` y compara contra `date`. No hay instante, no hay huso. |
| `sumarPagosGastoPeriodo` ([`gastos/repository.ts:307`](../../src/modules/gastos/repository.ts#L307)) | `pagos_gasto.fecha_pago` (`date`) | Ídem. |
| `sumarPagosCompraPeriodo` ([`proveedores/repository.ts:309`](../../src/modules/proveedores/repository.ts#L309)) | `pagos_compra.fecha_pago` (`date`) | Ídem. |

Esto confirma y explica la observación del diagnóstico anterior: **los gastos no sufren el bug
porque se guardan como fecha sola.** La diferencia no es de cuidado sino de tipo de columna.

---

## 3. Cómo se guarda cada fecha hoy

La distinción no es cosmética: determina cuál de las dos soluciones aplica.

### 3.1 `timestamptz` — un instante en la línea de tiempo

Estas columnas guardan un momento absoluto. Preguntarles "¿de qué día son?" **exige una zona
horaria**; sin ella la pregunta no tiene respuesta.

| Tabla.columna | Cómo se escribe | Instante que queda guardado (hora local Bolivia) |
|---|---|---|
| `ventas.fecha_venta` | POS en vivo: `new Date()` ([`ventas/actions.ts:457`](../../src/modules/ventas/actions.ts#L457)) | El instante real. **Correcto.** |
| `ventas.fecha_venta` | Con fecha elegida: `parsearFechaVentaSoloFecha` ([`ventas/actions.ts:39`](../../src/modules/ventas/actions.ts#L39)) | `YYYY-MM-DDT12:00:00Z` = **08:00 local**. Cae dentro del día correcto. **Correcto.** |
| `pagos_venta.fecha_pago` | Del pago inicial: hereda `fechaVenta` ([`ventas/actions.ts:551`](../../src/modules/ventas/actions.ts#L551)) | Correcto. |
| `pagos_venta.fecha_pago` | Pago posterior con fecha elegida: `new Date(input.fechaPago)` ([`ventas/actions.ts:695`](../../src/modules/ventas/actions.ts#L695)) | `T00:00:00Z` = **20:00 del día ANTERIOR**. ⚠️ **Corrido un día.** |
| `ajustes_venta.creado_en` | `defaultNow()` | El instante real. Correcto. |
| `producciones.fecha_produccion` | `new Date(input.fechaProduccion)` ([`nicho-1/actions.ts:696`](../../src/modules/operativo/nichos/nicho-1/actions.ts#L696)) | `T00:00:00Z` = **20:00 del día ANTERIOR**. ⚠️ **Corrido un día.** |
| `compras_ajuste.creado_en` | `defaultNow()` | Correcto. |
| `logs_acceso_admin_ceom.creado_en` | `defaultNow()` | Correcto. |
| `eventos_venta.fecha_inicio` / `fecha_fin` | `new Date(input.fecha…)` ([`ventas/actions.ts:310-311`](../../src/modules/ventas/actions.ts#L310)) | `T00:00:00Z` = 20:00 del día anterior. No se usa en filtros de reporte hoy; misma clase de defecto. |

**El hallazgo importante de esta sección:** Ventas ya resolvió el problema de escritura anclando a
**mediodía UTC** — con un comentario que explica exactamente por qué. **Pagos de Venta y Producciones
no adoptaron esa solución** y siguen anclando a medianoche UTC. Ver §6.1: esto convierte el arreglo
"obvio" del lado de lectura en un cambio silencioso y peligroso.

### 3.2 `date` — un día calendario, sin instante

Estas columnas guardan un día como concepto. No tienen huso y no necesitan traducción.

| Tabla.columna | Alimenta |
|---|---|
| `gastos.fecha_gasto` | Estado de Resultados, distribución por categoría, costo fijo |
| `pagos_gasto.fecha_pago` | Flujo de Caja |
| `compras.fecha_compra`, `fecha_vencimiento`, `fecha_recepcion` | Compras |
| `pagos_compra.fecha_pago` | Flujo de Caja |
| `pasivos.fecha_inicio`, `pasivos_pagos.fecha_pago` | Patrimonio |
| `activos.fecha_adquisicion`, `vencimiento_garantia` | Patrimonio |
| `tenants.fecha_inicio_suscripcion`, `fecha_proximo_pago` | Suscripción |
| `consentimientos.fecha_inicio` / `fecha_fin` | Vigencia del Gateway |

**Para estas, la solución es no tocarlas.** Ya son correctas. El único cuidado es no "unificar"
convirtiéndolas a `timestamptz`, que introduciría el problema donde hoy no existe.

### 3.3 La convención de presentación ya está decidida, y hay que revisarla

[`lib/format.ts:50`](../../src/lib/format.ts#L50) `formatFecha` fuerza `timeZone: "UTC"` por defecto,
con una justificación correcta y documentada: para una columna `date`, mostrarla en huso local la
corre un día hacia atrás.

**Pero ese default es exactamente lo contrario de lo correcto para una `timestamptz`.** Mostrar
`ventas.fecha_venta` con `timeZone: "UTC"` muestra el día UTC, no el día en que el negocio vendió.
Hoy hay 13 pantallas usando `timeZone: "UTC"` explícito. El arreglo tiene que distinguir los dos
casos, no aplicar una regla única.

---

## 4. De dónde sale "hoy" y "este mes"

Respuesta corta: **de dos relojes distintos, ninguno de los cuales es el del negocio.**

| Capa | Qué reloj y qué huso usa |
|---|---|
| `page.tsx` (render inicial) | Reloj y huso **del proceso Node**. En desarrollo: `America/La_Paz`. En Vercel: **UTC**. |
| `*-cliente.tsx` (al cambiar filtro) | Reloj y huso **del navegador del usuario**. |
| `calcularRangoPreset` internamente | **Mezcla las dos bases**: `hasta` vía `toISOString()` (UTC), `desde` vía getters locales. |
| Base de datos | Nadie le pregunta. Los rangos llegan ya resueltos como texto. |
| Tenant | **No participa.** No existe ningún campo de zona horaria en `tenants`. |

Y ahí está el corazón del problema: **el negocio piensa en su día local y no hay ningún lugar en el
sistema donde ese día esté definido.** Cada capa improvisa con el huso que tiene a mano.

Vale notar que `tenants` **sí** modela otras propiedades de esta clase —
`moneda_principal` (`notNull`) y `ciudad_base` ([`identidad/schema.ts:106-107`](../../src/modules/identidad/schema.ts#L106)).
La zona horaria es la misma clase de dato y es la que falta.

---

## 5. El estándar de la industria, y el enfoque recomendado

### 5.1 Cómo lo resuelven los sistemas serios

Cuatro reglas, en las que hay consenso amplio (Stripe, QuickBooks, Shopify, Xero: todos exponen y
usan la zona horaria del comercio para cortar sus períodos de reporte):

1. **Guardar instantes como `timestamptz`, y días de negocio como `date`.** CEOM ya hace esto bien.
   No es lo que hay que cambiar.
2. **La zona horaria es una propiedad del negocio**, no del servidor ni del navegador. El servidor
   corre en UTC a propósito; el navegador es del usuario y viaja con él. Ninguno de los dos sabe
   cuándo cierra la caja el negocio.
3. **Un rango de días locales se traduce a un intervalo semiabierto de instantes: `[inicio, fin)`.**
   Nunca `<= fin`. El `<=` sobre un instante siempre deja afuera parte del último día — es
   literalmente el bug que tenemos. `fin` es el comienzo del día local *siguiente* al último día
   pedido.
4. **Una sola definición de "día", usada por todos los reportes.** Si cada uno la calcula, divergen —
   que es lo que ya pasó acá con `capacidad-cliente.tsx` y su propia copia.

### 5.2 El enfoque recomendado para CEOM

Un único módulo nuevo, `src/lib/periodo.ts`, con dos funciones puras:

```
zonaHorariaTenant(tenantId) → string          // hoy: constante; mañana: columna
rangoInstantes({desde, hasta}, zona) → { inicio: Date, fin: Date }   // semiabierto [inicio, fin)
calcularRangoPreset(id, zona) → { desde, hasta }   // el preset, con zona explícita
```

Y tres cambios mecánicos que se derivan:

- **En los 4 archivos de acciones** (§2.2): reemplazar los 12 pares `new Date(periodo.desde/hasta)`
  por una llamada a `rangoInstantes`. Es el único lugar donde entra la zona horaria.
- **En los 10 repositorios** (§2.1): cambiar `lte(col, hasta)` por `lt(col, fin)`. Nada más. Los
  repositorios siguen recibiendo `Date` y siguen sin saber nada de husos.
- **En `calcularRangoPreset`**: recibir la zona como parámetro explícito en vez de leerla del
  entorno. Deja de importar dónde corre — servidor y navegador dan el mismo resultado.

**Por qué así y no de otra forma:**

- **No agrega ninguna dependencia.** La conversión día-local → instante se hace con `Intl` (~15
  líneas), que ya trae la base de datos de husos IANA. `CLAUDE.md` prohíbe introducir librerías sin
  avisar, y acá no hace falta ninguna.
- **Respeta la regla de caja negra.** Los repositorios no cambian de contrato conceptual; la
  traducción vive en la capa de acciones, que es la frontera pública de cada módulo.
- **Es el diff más chico compatible con la semántica correcta.** No reescribe reportes, no toca el
  esquema, no migra datos.
- **Deja el `desde` bien de paso.** Hoy el borde inferior también está mal (incluye 4 horas de la
  noche anterior); un intervalo semiabierto arregla los dos bordes de una.

**La alternativa que descarté:** hacer la conversión en SQL con `AT TIME ZONE`. Es igual de correcta
y le delega los husos a Postgres, pero obliga a meter la zona horaria en los 10 repositorios y a
reescribir sus `where`. Más superficie de cambio, y rompe la propiedad de que el repositorio no sabe
de husos. Queda anotada como opción si alguna vez hace falta agrupar por día **dentro** de SQL
(`date_trunc`), cosa que hoy no se hace en ningún lado.

---

## 6. El riesgo de romper lo que anda

### 6.1 ⚠️ El caso silencioso: arreglar solo la lectura corre dos cosas un día hacia atrás

**Este es el riesgo real de esta tarea, y es el que hay que mirar antes que ninguno.**

`pagos_venta.fecha_pago` y `producciones.fecha_produccion` se escriben con `new Date("YYYY-MM-DD")`,
que las ancla a **medianoche UTC = 20:00 hora local del día anterior** (§3.1).

Hoy eso no se nota, porque el filtro está roto en la misma dirección y los dos errores se tapan. Si
se arregla solo la lectura:

> Un pago que el usuario fechó el **27 de julio** quedaría contado en el **26 de julio**.

El Flujo de Caja de un mes seguiría dando bien (los días interiores no cambian), pero el de un **día**
daría mal, y el del **primer y último día de cada mes** movería plata de un mes al otro. Es
exactamente la clase de error que el pedido señala como peligroso: un total que cambia sin que nadie
lo note.

**Consecuencia para el plan: la escritura se arregla antes que la lectura, no después.** Ventas ya
tiene la solución escrita y probada (`parsearFechaVentaSoloFecha`, anclar a mediodía UTC); hay que
extenderla a Pagos de Venta y a Producciones, y decidir qué hacer con las filas ya escritas
(§8, decisión 3).

### 6.2 Riesgo por lugar

Después de arreglar la escritura, el cambio de lectura en cada lugar es el mismo: la ventana pasa de
`[desde 20:00 del día anterior, hasta 20:00 del día anterior]` a `[desde 00:00 local, hasta 24:00
local)`. Eso **suma** todo el día `hasta` y **resta** las 20:00–24:00 de la noche previa a `desde`.

| # | Lugar | Qué cambia | Riesgo |
|---|---|---|---|
| 1 | Ingresos / COGS (Estado de Resultados) | Sube: entra el día en curso completo | 🟢 **Corrige, sin sorpresa.** Es el síntoma reportado. |
| 3 | Flujo de Caja | Sube; **depende de §6.1 estar hecho** | 🔴 **Alto si se hace solo.** Verde después. |
| 4 | Ajustes de venta | Sube | 🟢 Corrige. `creado_en` es un instante real, sin ambigüedad. |
| 2 | Rotación (simulaciones) | Sube | 🟡 El precio sugerido no cambia (depende de costo y margen), pero **el impacto proyectado en Bs sí**. Cambio visible y correcto; hay que anticiparlo. |
| 5 | Ranking de productos | Sube; **el orden puede cambiar** | 🟡 Silencioso por naturaleza: nadie audita un orden. Se cubre con test de composición, no de orden. |
| 6 | Histórico de ventas | Sube, y **hay que arreglar el bucket** (§2.4) | 🟡 Si se arregla el filtro y no `claveBucket`, el total queda bien y las barras corridas — peor que antes, porque ahora *parece* correcto. |
| 7 | Margen canal × producto | Sube | 🟢 Corrige. |
| 8 | Merma | Sube; **depende de §6.1** | 🔴 Mismo caso que Flujo de Caja. |
| 9 | Capacidad de producción | Sube; **depende de §6.1** | 🔴 Ídem. Además la pantalla hoy no puede mostrar datos por H-34, lo que **oculta** cualquier regresión acá. |
| 10 | Registro de accesos (`/admin`) | Aparecen los accesos del día | 🟢 Corrige. Es una lista, no un total: verificable a ojo. |
| 11 | Ajustes de compra | Solo falta el borde inferior | 🟢 Cambio chico; ya tiene test. |
| — | **Delta "vs período anterior"** (Dashboard) | Hoy compara dos números mal calculados | 🟡 **La flecha puede invertirse.** Los dos períodos se corrigen a la vez, así que el delta cambia aunque ambos totales suban. Avisar. |
| — | **Preset "Hoy"** | De ventana vacía a día real | 🟢 Imposible que hoy esté bien por casualidad (§1.3). El cambio más grande y el más seguro. |

### 6.3 Quién más mira estos números

El defecto no está contenido en `/app`. Las mismas funciones alimentan:

- **`/admin`** — la ficha de tenant que usa el equipo CEOM para evaluar la salud de un negocio.
- **`/portal`** — el dashboard institucional, gateado por consentimiento. Una institución que evalúa
  a un emprendimiento está viendo hoy sus ingresos **sin el día en curso**.
- **`monitoreo-institucional`** — `tendenciaVentas`, `detalleFinanciero` y `detalleOperativo` pasan
  el período crudo a Financiero y a Nicho 1.

Ninguno de los tres necesita cambios propios: arreglando la capa de acciones se corrigen los tres.
Pero **los tres cambian de número el mismo día**, y conviene que el equipo lo sepa antes de que una
institución pregunte.

---

## 7. Plan de migración, por partes verificables

Cinco etapas. Cada una es un commit que deja el sistema consistente y con test propio; ninguna
depende de que la siguiente exista.

| Etapa | Qué hace | Cómo se verifica | Riesgo |
|---|---|---|---|
| **1. El helper** | Crear `src/lib/periodo.ts` con `zonaHorariaTenant`, `rangoInstantes` y la nueva `calcularRangoPreset(id, zona)`. **No lo usa nadie todavía.** | Tests unitarios puros contra instantes fijos, sin base de datos. Se corren en cualquier huso. | 🟢 Nulo — no cambia comportamiento. |
| **2. La escritura** | Anclar a mediodía UTC en `registrarPagoVenta` y `registrarProduccion`, reutilizando el criterio de `parsearFechaVentaSoloFecha`. Decidir el backfill (§8, decisión 3). | Test de integración: escribir con fecha elegida, leer, afirmar el día local. | 🟡 **Hacer primero.** Sin esto, la etapa 4 corre datos un día. |
| **3. Los presets** | Pasar la zona explícita a `calcularRangoPreset` en las 13 pantallas; borrar la copia de `capacidad-cliente.tsx`. | Test unitario del preset en `TZ=UTC` y `TZ=America/La_Paz`: mismo resultado. | 🟡 Toca muchos archivos, pero mecánico. Elimina la divergencia servidor/navegador (§1.4). |
| **4. La lectura** | Los 12 pares de `new Date()` → `rangoInstantes`; los 10 `lte` → `lt`. Cerrar también el borde inferior de ajustes de compra. | Los tests de §9, uno por función. `pnpm test` completo: **hay expectativas existentes que van a cambiar** y hay que revisarlas una por una, no ajustarlas en masa. | 🟠 El commit grande. Es donde cambian los números. |
| **5. La presentación** | `claveBucket` del histórico agrupa por día local; revisar los 13 `timeZone: "UTC"` y separar los que muestran `timestamptz` de los que muestran `date`. | Verificación en navegador de la tanda de reportes. | 🟡 Visual; sin esto el total queda bien y el gráfico corrido. |

**Por qué este orden.** La 1 no rompe nada y habilita todo. La 2 antes que la 4 por §6.1. La 3 antes
que la 4 para que el rango que llega ya sea el día local correcto y los tests de la 4 midan una cosa
sola. La 5 al final porque es cosmética respecto de los totales.

---

## 8. Decisiones abiertas — necesito tu sí/no

### Decisión 1 — ¿Zona horaria única del sistema, o configurable por negocio?

| Opción | A favor | En contra |
|---|---|---|
| **A. Constante única** `America/La_Paz` | Cero migración, cero UI, cero riesgo. Hoy todos los tenants son bolivianos. | Cuando entre el primer cliente de otro país, hay que volver a tocar los mismos 14 archivos. |
| **B. Columna `tenants.zona_horaria`** | Sigue el precedente exacto de `moneda_principal`. Cierra el tema de una. | Migración + política de RLS + campo en el alta de `/admin` + decidir el valor de los tenants existentes. |

**Mi recomendación: una tercera, que es la que quiero proponerte.** Fijar **ahora la costura, y
después la columna**: `zonaHorariaTenant(tenantId)` se escribe desde el día uno recibiendo el
`tenantId` y devolviendo la constante `"America/La_Paz"`. Todos los llamadores ya tienen el
`tenantId` a mano — lo verifiqué, las 10 funciones lo reciben.

Así, el día que haga falta la columna, el cambio es **el cuerpo de una función**, no un barrido por
14 archivos. Lo caro de retrofitear no es la columna: es la costura — que es precisamente la
situación en la que estamos hoy con `hasta`. Costo hoy: cero migración, cero UI, un parámetro que ya
estaba disponible.

### Decisión 2 — ¿Qué pasa con el preset "Hoy" cuando empiece a funcionar?

Hoy muestra 0 siempre. Cuando funcione, va a mostrar el día en curso — **parcial**, porque el día
todavía no terminó. Alguien puede leer "Hoy: Bs 340" a las 10 de la mañana y compararlo con el día
anterior completo.

**Mi recomendación:** dejarlo mostrar el día en curso (es lo que el usuario pide cuando aprieta
"Hoy") y agregar la aclaración en la pantalla — *"al 27 jul, 10:32"*. Es una línea de texto y evita
la comparación engañosa. No inventar un preset "Ayer" a menos que lo pidas.

### Decisión 3 — Los pagos y producciones ya cargados, ¿se corrigen?

En la base hay filas escritas a medianoche UTC (§6.1). Después de la etapa 2, las nuevas quedan
bien; las viejas siguen corridas 4 horas y el arreglo de lectura las va a contar en el día anterior.

| Opción | Qué implica |
|---|---|
| **A. Migración de datos** | Un `UPDATE` que mueve `T00:00:00Z` → `T12:00:00Z` en `pagos_venta` y `producciones`. Solo afecta filas escritas desde formulario con fecha elegida. **Tensión con la regla de ledger append-only** de `CLAUDE.md` — hay que decidirlo explícitamente, no de costado. |
| **B. Dejarlas** | Cero riesgo de migración. Los reportes históricos quedan con algunos pagos y producciones corridos un día. |

**Mi recomendación: A, con dos condiciones.** Primero medir cuántas filas son —sospecho que en el
tenant de prueba y el piloto son pocas decenas—; si el número es chico, es una corrección de datos
puntual y acotada, no una edición de saldos, y no creo que la regla de append-only aplique acá (no
estamos corrigiendo un monto, estamos corrigiendo un huso mal aplicado a un dato de entrada). Segundo,
que sea una migración con su propio archivo y su propio `WHERE` explícito (`extract(hour ...) = 0`),
reversible y revisable. Si el conteo sale grande o te incomoda tocar datos, B es defendible y lo
único que cuesta es precisión en reportes viejos.

**Necesito que me confirmes esta antes de la etapa 2** — es la única que toca datos existentes.

---

## 9. Plan de pruebas

El requisito es no depender de a qué hora corre el test. Tres niveles.

### 9.1 Unitarios puros — el núcleo, sin base de datos

Sobre `src/lib/periodo.ts`. Son los que hacen determinista todo lo demás: **la hora se inyecta, no se
lee del reloj.**

| Caso | Entrada | Se afirma |
|---|---|---|
| Borde superior | `{desde:"2026-07-01", hasta:"2026-07-27"}`, zona La Paz | `fin` = `2026-07-28T04:00:00Z`, **exclusivo** |
| Borde inferior | ídem | `inicio` = `2026-07-01T04:00:00Z` (no `T00:00Z`) |
| Un solo día | `{desde:"2026-07-27", hasta:"2026-07-27"}` | Ventana de **24 h exactas**, no de ancho cero |
| Preset independiente del huso | `calcularRangoPreset("mes", "America/La_Paz")` con reloj fijo en `2026-01-01T02:00:00Z` | Da lo mismo con `TZ=UTC` que con `TZ=America/La_Paz` — el caso que hoy falla (§1.4) |
| Fin de mes | reloj en `2026-07-31T23:00:00Z` (= 19:00 local) | `hasta` = `2026-07-31`, no `2026-08-01` |
| Zona con horario de verano | `America/Santiago`, cruce de cambio de hora | El día local dura 23 o 25 h y el intervalo lo refleja — prueba que el helper no asume offset fijo |

### 9.2 Integración — una venta a una hora conocida del día local

El test que reproduce el bug reportado, contra la base real, como el resto de la suite:

1. Sembrar una venta con `fecha_venta` **fijada explícitamente** en `2026-07-27T14:00:00Z`
   (= 10:00 de la mañana en Bolivia). Instante literal, no `new Date()`.
2. Pedir `estadoResultados` con `{desde:"2026-07-27", hasta:"2026-07-27"}`.
3. Afirmar que los ingresos **incluyen** esa venta.

Y los dos casos que evitan sobrecorregir:

4. Una venta en `2026-07-28T02:00:00Z` (= 22:00 del **27** local) **cuenta** en el 27.
5. Una venta en `2026-07-27T03:00:00Z` (= 23:00 del **26** local) **no cuenta** en el 27.

Los casos 4 y 5 son los que hoy fallan en las dos direcciones y los que impiden que el arreglo se
pase de largo.

**Este trío se replica por función afectada** — son 10, más el borde inferior de ajustes de compra.
No alcanza con probarlo en `estadoResultados`: el defecto está en cada repositorio.

### 9.3 Regresión — que no vuelva a entrar por otra puerta

- **Anti-regresión de `lte`:** un test que recorre los repositorios y falla si aparece un `lte` sobre
  una columna `timestamptz` en una función de período. Es el mismo patrón del manifiesto de acceso
  por AST que `02-arquitectura-y-calidad.md` señala como la mejor práctica del proyecto — convierte
  "alguien copió el borde viejo" (que es literalmente cómo nació este bug, según el commit `2ea20e5`)
  en build roto.
- **La suite corriendo en UTC.** Hoy la máquina de desarrollo está en `America/La_Paz` y eso oculta
  el defecto de §1.4. Agregar `TZ=UTC` a la corrida de CI, que además es el huso real de producción.
- **Escritura y lectura juntas:** escribir un pago con fecha elegida `2026-07-27` y afirmar que el
  Flujo de Caja del `2026-07-27` lo cuenta — el test que hace imposible el escenario silencioso de
  §6.1.

---

## 10. Resumen para decidir

- **11 funciones de repositorio**, **12 pares de conversión** en 4 archivos de acciones, **13
  pantallas** y **1 agrupación de gráfico**. Una sola causa: un rango de días locales tratado como si
  fuera un rango de instantes UTC, con el borde superior inclusivo.
- **Los gastos y las compras no están afectados** porque usan columnas `date`. No hay que tocarlos —
  y hay que cuidar de no "unificarlos".
- **El riesgo grande no es el arreglo: es arreglarlo a medias.** Pagos de Venta y Producciones se
  escriben a medianoche UTC; corregir la lectura sin corregir la escritura los corre un día hacia
  atrás, en silencio, en el Flujo de Caja.
- **El enfoque propuesto no agrega dependencias, no toca el esquema y no migra datos** (salvo la
  decisión 3, que es tuya).
- **Tres decisiones para vos:** zona única vs. por negocio (recomiendo fijar la costura ahora, la
  columna después), qué muestra "Hoy" cuando funcione (recomiendo el día parcial con aclaración de
  hora), y si se corrigen los pagos y producciones ya cargados (recomiendo sí, midiendo primero).

No se escribió ni una línea de código. Con tu sí a las tres decisiones, la etapa 1 arranca sin
bloquear nada.
