# Deuda aplazada — barrido completo de los `ANCLA.md`

Barrido de los **15 `ANCLA.md`** del proyecto (2.839 líneas) buscando decisiones que se
aplazaron y nunca se retomaron: *"fuera de esta tarea"*, *"queda pendiente"*, *"por ahora
no"*, *"se resuelve más adelante"*, *"mismo criterio que"*, *"revisar cuando…"*, *"no
corregido a propósito"*, y variantes.

**Fecha del barrido:** 2026-07-22. **Estado del repo:** `dev` @ `a208853`.
**Alcance:** solo el mapa. No se arregló nada.

---

## Resumen

**44 aplazamientos** identificados. La distribución importa más que el número:

| | Justificación **caducada** | Justificación **vigente** |
|---|---|---|
| **Síntoma visible para el usuario** | **9** ← empezar acá | 8 |
| **Deuda interna sin síntoma** | 7 | 20 |

**El hallazgo estructural:** H-01/H-32 no es un caso aislado. Hay **tres familias** de
aplazamiento tomado más de una vez en módulos distintos, y en las tres el patrón es
idéntico — el segundo agente leyó *"mismo criterio que \<otro módulo\>"* y lo copió sin
verificar si el criterio original seguía en pie:

1. **Catálogo vacío al nacer el tenant** — 3 copias (Gastos, Ventas, Productos). Es H-01/H-32.
2. **"Quitar imagen/logo" no borra nada** — 2 copias (Identidad, Productos), el mismo bug
   de Drizzle documentado dos veces, con la segunda diciendo literalmente *"mismo fix
   pendiente que en Identidad"*. **Nadie hizo el primero.**
3. **`nicho_id` sin FK** — 3 copias (Identidad, Suscripción, Productos) con la instrucción
   explícita *"revisar los tres juntos"*. Se resolvió **uno** y se declaró a los otros dos
   fuera de alcance en el mismo commit.

Y un segundo patrón, más silencioso: **8 aplazamientos tienen la forma "revisar cuando
exista X"**, y **X ya existe**. Nadie los revisó porque nada vigila esos disparadores.
Ver [§6](#6-disparadores-que-ya-se-cumplieron).

---

## Cómo leer esta lista

Cada ítem lleva dos etiquetas independientes:

- **Síntoma** — 🔴 **visible**: el usuario lo choca en el producto. ⚪ **interno**: deuda sin
  síntoma hoy.
- **Justificación** — ❌ **caducada**: el motivo por el que se aplazó ya no es cierto.
  ⚠️ **parcial**: una parte cambió. ✅ **vigente**: sigue siendo una buena razón.

El orden de prioridad es: **caducada + visible** → **caducada + interna** → **vigente +
visible** (decisión de producto, no de contexto) → **vigente + interna** (dejar dormir).

---

## 1. Prioridad 1 — Justificación caducada **y** síntoma visible

> Se aplazaron por un motivo que hoy es falso, y el usuario los choca. Son los que
> conviene retomar primero: el costo de arreglarlos ya no tiene el blocker que los frenó.

### DA-01 · Pre-carga de `CategoriaGasto` al crear el tenant 🔴 ❌
**Dónde:** [gastos/ANCLA.md:60](../src/modules/gastos/ANCLA.md#L60)
**Cuándo:** construcción del Módulo 4 (≈2026-07-14)
**Se aplazó porque:** *"fuera de esta tarea — **no hay onboarding UI todavía**; se expone
`sembrarCategoriasGastoDefault(tenantId)` lista para invocarse, **mismo criterio que
`CanalVenta` en Ventas**."*

**Por qué la justificación caducó:** la UI de onboarding **existe** desde la fase de UI de
Fase 1 — `src/app/app/onboarding/` (wizard de 2 pasos + `finalizarOnboarding()`).
El blocker declarado desapareció y nadie volvió.

**Verificado:** `sembrarCategoriasGastoDefault()` existe en
[gastos/actions.ts:77](../src/modules/gastos/actions.ts) y tiene **cero llamadores** —
la única referencia en todo `src/` es su propia definición.
[onboarding/actions.ts](../src/app/app/onboarding/actions.ts) no importa nada de Gastos.

**Síntoma:** un tenant nuevo abre "Nuevo gasto" con el selector de Categoría vacío.
**Atenuante:** el formulario tiene escape hatch (`onCrearCategoria` →
[nuevo-gasto-cliente.tsx:40](../src/app/app/(shell)/gastos/nuevo/nuevo-gasto-cliente.tsx)),
así que es fricción de primer uso, no un bloqueo.

**Este es H-32.** Una función terminada, probada y documentada lleva ~8 días esperando una
línea de llamada.

---

### DA-02 · Pre-carga de `CanalVenta` desde el onboarding 🔴 ❌
**Dónde:** [ventas/ANCLA.md:95](../src/modules/ventas/ANCLA.md#L95)
**Cuándo:** construcción del Módulo 3 (≈2026-07-13), **antes** que DA-01
**Se aplazó porque:** *"fuera de esta tarea — **la UI de onboarding no existe todavía**
(pendiente ya documentado en `identidad/ANCLA.md`)."*

**Por qué la justificación caducó:** idéntica a DA-01, y por el mismo motivo.

**Este es H-01, y es el original.** DA-01 lo cita explícitamente (*"mismo criterio que
`CanalVenta` en Ventas"*) — el segundo agente heredó el aplazamiento sin revalidar la
premisa. Ese es exactamente el mecanismo que el barrido buscaba.

**Peor que DA-01 en un punto:** acá **no existe** una `sembrarCanalesVentaDefault()`. En
Gastos al menos quedó la función lista; acá hay que escribirla.

> ⚠️ **Discrepancia a reconciliar.** El pedido describe H-01 como *"impide vender"*. En el
> código de hoy **no impide vender**: `canalVentaId` es obligatorio en `DatosVenta`
> ([ventas/actions.ts:399](../src/modules/ventas/actions.ts)) y el POS corta con *"Elegí un
> canal de venta"*, pero el botón **"+ Nuevo canal" se renderiza siempre** — está fuera del
> guard `canales.length > 0`
> ([pos-cliente.tsx:336-341](../src/app/app/(shell)/ventas/pos-cliente.tsx)) — y crea el
> canal inline vía `crearCanalVentaAction`. O el escape hatch se agregó después de que se
> levantó H-01, o H-01 apunta a otra cosa. **Vale confirmarlo antes de dimensionar el
> arreglo.**

---

### DA-03 · Comisión de venta que nunca se convierte en `Gasto` 🔴 ❌
**Dónde:** [ventas/ANCLA.md:88-94](../src/modules/ventas/ANCLA.md#L88)
**Se aplazó porque:** originalmente *"Módulo 4 no existe todavía"*. Hoy el ANCLA reconoce
que sí existe, y lo redujo a: *"Sigue sin un trigger automático que la llame justo después
de `registrarVenta()` (eso tocaría el contrato de Ventas, no declarado en la tarea de
Módulo 4) — **hay que invocarla a mano** o desde un futuro orquestador."*

**Por qué la justificación caducó:** el blocker original (Módulo 4 inexistente) murió.
El blocker de reemplazo — *"tocaría el contrato de Ventas"* — es un límite de alcance de
una tarea que terminó hace días, no una razón técnica.

**Síntoma — probablemente el más caro de la lista:** cada venta calcula y persiste
`comisionMontoCalculado`, y **nadie lo cobra**. `generarGastoComisionVenta()` funciona,
está testeada, y no la llama nadie fuera de los tests. Para cualquier tenant que use
comisiones por canal o evento, el **Estado de Resultados subdeclara gastos de forma
permanente** — el número se ve bien, y está mal.

---

### DA-04 · Sin scheduler: `GastoRecurrente` y cuota de Pasivo nunca se disparan 🔴 ⚠️
**Dónde:** [gastos/ANCLA.md:64](../src/modules/gastos/ANCLA.md#L64),
[patrimonio/ANCLA.md:46-51](../src/modules/patrimonio/ANCLA.md#L46),
[identidad/ANCLA.md:111](../src/modules/identidad/ANCLA.md#L111)
**Se aplazó porque:** *"no hay scheduler ni Módulo 4 todavía"* (Patrimonio) / *"nada las
dispara periódicamente todavía (mismo gap ya documentado en Patrimonio/Ventas/Módulo 6)"*
(Gastos).

**Por qué la justificación es parcial:** la mitad "ni Módulo 4 todavía" caducó — Módulo 4
existe y la integración funciona de verdad. Lo único que falta es el disparador periódico.
**Es un solo problema de infraestructura documentado en 4 ANCLAs distintos**, lo que hace
que parezca deuda de cada módulo cuando es una pieza faltante única.

**Síntoma:** la pantalla "Gestión de Gastos Recurrentes" existe, deja armar plantillas y
muestra una "Proyección mensual"… de gastos que **nunca se generan**. Cálculo de cliente
sobre plantillas inertes.

**Sin síntoma (la tercera copia):** `estado_acceso` sin recalcular no molesta a nadie —
`tienePermiso()` lo deriva en vivo con `calcularEstadoAcceso()`. Esa parte puede seguir
durmiendo.

---

### DA-05 · Exportación PDF/Excel de Reportes 🔴 ❌
**Dónde:** [reportes/ANCLA.md:47-50](../src/modules/reportes/ANCLA.md#L47)
**Se aplazó porque:** *"explícitamente fuera de alcance… Queda para **cuando se aborde la
fase de UI**"* — y en el contrato del módulo, *"fuera de alcance **mientras no exista UI en
el proyecto**"*.

**Por qué la justificación caducó:** la fase de UI se abordó y se cerró. Reportes está
**9/9 pantallas** desde el 2026-07-17. La condición literal que el propio ANCLA fijó como
disparador se cumplió hace 5 días.

**Síntoma:** `Modulo_10_reportes.md` §6 promete exportación con co-branding; no hay ningún
botón de exportar en ninguna de las 9 pantallas.

---

### DA-06 · El filtro de sucursal del Dashboard miente en 3 de 5 tarjetas 🔴 ✅
**Dónde:** [reportes/ANCLA.md:72-79](../src/modules/reportes/ANCLA.md#L72) (marcado ⚠️ por
el propio agente)
**Se aplazó porque:** *"No es un bug de la UI, es la firma real de estas 3 funciones — si se
quiere resolver, es un cambio de contrato acá (y en Ventas/Gastos/Nicho 1), no en la
pantalla."*

**La justificación es correcta técnicamente** — y es exactamente por eso que sigue abierta:
describe bien el costo y nunca decide.

**Verificado en las firmas:** `rankingProductos` toma `canalVentaId`, no `sucursalId`;
`distribucionGastos(solicitante, tenantId, periodo)` y `controlMerma(...)` no toman ningún
filtro de sucursal ([reportes/actions.ts:39-125](../src/modules/reportes/actions.ts)).

**Síntoma — dato silenciosamente incorrecto, la peor clase:** el usuario elige una sucursal
y 2 tarjetas se filtran mientras 3 siguen mostrando el consolidado del tenant, sin ninguna
señal visual de que no acompañaron. Es peor que una función faltante: parece que funciona.

---

### DA-07 · `configurarStockMinimo` sin ninguna UI 🔴 ✅
**Dónde:** [productos/ANCLA.md:99-104](../src/modules/productos/ANCLA.md#L99)
**Se aplazó porque:** la Fase 1 de UI llegó a "paridad visual con el resto del contrato" y
esto quedó afuera del recorte.

**Verificado:** los únicos llamadores de `configurarStockMinimo` son su propia definición y
`productos.test.ts:342`. Cero UI.

**Síntoma:** la Ficha de Producto **muestra** `stock_minimo`, y no hay forma de cargarlo
desde ninguna pantalla — siempre se ve `—`. Un campo de solo-lectura permanente que
promete una alerta de reposición que nunca puede configurarse.

---

### DA-08 · "Quitar logo" no borra el logo 🔴 ✅
**Dónde:** [identidad/ANCLA.md:485-490](../src/modules/identidad/ANCLA.md#L485)
**Se aplazó porque:** *"Gap conocido no resuelto en esta tarea"* — el update de Drizzle omite
las columnas `undefined` del `SET`, así que quitar el logo y guardar no lo borra en la base.

**Verificado:** `logoUrl?: string` sigue sin aceptar `null`, tanto en
[identidad/actions.ts:490](../src/modules/identidad/actions.ts) como en
[validation.ts:18](../src/modules/identidad/validation.ts).

**Síntoma:** el Owner quita el logo, guarda, ve el formulario limpio… y el logo sigue ahí al
recargar. El fix está descripto con precisión en el propio ANCLA (mandar `null` explícito y
ajustar `actualizarTenantSchema`).

---

### DA-09 · "Quitar imagen" no borra la imagen del producto 🔴 ✅
**Dónde:** [productos/ANCLA.md:220-224](../src/modules/productos/ANCLA.md#L220)
**Se aplazó porque:** *"igual que en Identidad… **Mismo fix pendiente que en Identidad** si
se necesita de verdad."*

**Este es el segundo par de gemelos**, con la misma firma que H-01/H-32: el segundo agente
detectó el bug, lo documentó bien, lo enlazó al primero — y se apoyó en un fix que nunca
existió. Ninguno de los dos se hizo. **DA-08 y DA-09 se arreglan juntos o vuelven a
diferirse juntos.**

---

## 2. Prioridad 2 — Justificación caducada, sin síntoma

> El blocker desapareció. No molestan a nadie hoy, pero ya no hay razón para no cerrarlos, y
> dos son riesgos latentes de corrupción de datos.

### DA-10 · `vinculaciones_producto_receta` sin índice único parcial ⚪ ❌
**Dónde:** [nicho-1/ANCLA.md:84-88](../src/modules/operativo/nichos/nicho-1/ANCLA.md#L84)
**Se aplazó porque:** *"se confía en que `vincularProductoAReceta`/
`obtenerVinculacionPorProducto` lo traten como tal en la práctica; **revisar si hace falta un
índice único parcial cuando se construya la UI**."*

**Por qué la justificación caducó:** la UI **se construyó** el 2026-07-20 — el modal
"Vincular a proceso operativo" en la Ficha de Producto
([productos/ANCLA.md:108-119](../src/modules/productos/ANCLA.md#L108)). El disparador que el
propio agente fijó se cumplió y nadie ejecutó la revisión.

**Verificado:** no hay ningún índice único sobre esa tabla en ninguna migración.

**Riesgo latente:** dos vinculaciones activas para el mismo producto ⇒
`obtenerVinculacionPorProducto()` devuelve una arbitraria ⇒ una Producción consume la receta
equivocada y calcula mal el costo operativo. Silencioso, y contamina snapshots de venta
posteriores.

**El proyecto ya tiene el patrón resuelto al lado:** Consentimiento resolvió exactamente esta
clase de problema con `aprobaciones_tenant_vigente_unica` (índice único parcial, migración
`0037`) más revocación atómica de la fila previa
([consentimiento/ANCLA.md:211-230](../src/modules/consentimiento/ANCLA.md#L211)). Es copiar
un patrón propio, no diseñar uno nuevo.

---

### DA-11 · `enviarProductoAOperaciones` no valida que el tenant tenga Nicho activo ⚪ ❌
**Dónde:** [productos/ANCLA.md:72-76](../src/modules/productos/ANCLA.md#L72)
**Se aplazó porque:** *"**Identidad no expone hoy una consulta pública de `tenants.nicho_id`**
(su `actions.ts` no tiene un `obtenerTenant`), y agregarla es un cambio de contrato de
Identidad que no se declaró al empezar esta tarea."*

**Por qué la justificación caducó:** `obtenerTenantPorId(solicitante, tenantId)` **existe** en
`identidad/actions.ts` desde el Módulo 10 — tan disponible que
[onboarding/actions.ts:7](../src/app/app/onboarding/actions.ts) la importa. También existe
`obtenerTenantParaVeedor()`, que devuelve el nicho. El cambio de contrato que se evitó ya
está hecho, por otra tarea.

**Sin síntoma hoy:** llegar a este camino requiere pantallas de Nicho 1, que un tenant en
Modo Básico no visita.

---

### DA-12 · `planes.nicho_id` y `categorias_sugeridas.nicho_id` siguen sin FK ⚪ ❌
**Dónde:** [suscripcion/ANCLA.md:82-84](../src/modules/suscripcion/ANCLA.md#L82),
[productos/ANCLA.md:146-148](../src/modules/productos/ANCLA.md#L146)
**Se aplazó porque:** *"el módulo de Nicho no existe todavía. **Cuando se construya, hay que
revisar ambos pendientes juntos**"* (Suscripción) y *"mismo criterio que `tenants.nicho_id`/
`planes.nicho_id`… **Revisar los tres juntos** cuando se construya"* (Productos).

**Por qué la justificación caducó:** los módulos de nicho existen (`nicho-1`, `nicho-4`).
Más aún: el tercero del trío **sí se resolvió** — `tenants.nicho_id` pasó a enum en la
migración `0022` — y en ese mismo cambio se escribió *"`planes.nicho_id` (Suscripción) sigue
siendo un `uuid` suelto — **no se tocó, queda fuera de alcance de este cambio**"*
([identidad/ANCLA.md:399](../src/modules/identidad/ANCLA.md#L399)).

**La instrucción "revisar los tres juntos" se leyó, se citó, y se incumplió en el acto.**
Tercera familia de aplazamiento duplicado.

**Roza lo visible:** el formulario de `/admin/planes` **omite `nichoId` por completo** —
*"uuid sin FK real, nada contra qué resolverlo todavía"*
([suscripcion/ANCLA.md:41](../src/modules/suscripcion/ANCLA.md#L41)). Un `ceom_admin` no
puede crear un plan específico de nicho, que es justamente para lo que existe la columna.

---

### DA-13 · Chequeo de límite de sucursales contra el plan ⚪ ❌
**Dónde:** [identidad/ANCLA.md:112-113](../src/modules/identidad/ANCLA.md#L112)
**Se aplazó porque:** *"**depende de que exista el catálogo Planes**"* (Modulo_01 §9.6).

**Por qué la justificación caducó:** el catálogo Planes existe — módulo `suscripcion`, tabla
`planes`, y UI en `/admin/planes` construida el 2026-07-18. La dependencia declarada está
cumplida hace 4 días.

**Sin síntoma:** no hay enforcement ⇒ nadie choca un límite. Es una regla de negocio (y de
monetización) que simplemente no se aplica.

---

### DA-14 · `modulos_veedor_permitidos` "hoy nadie consume" ⚪ ❌
**Dónde:** [suscripcion/ANCLA.md:87-88](../src/modules/suscripcion/ANCLA.md#L87)
**Ya no es cierto:** `generarCodigoAcceso` valida de verdad contra
`plan.modulos_veedor_permitidos`
([consentimiento/ANCLA.md:51-53](../src/modules/consentimiento/ANCLA.md#L51)).
**Acción:** corregir la nota. No hay trabajo de código.

---

### DA-15 · Financiero: "Monitoreo Institucional/Gateway no existe todavía" ⚪ ❌
**Dónde:** [financiero/ANCLA.md:60-64](../src/modules/financiero/ANCLA.md#L60)
**Ya no es cierto:** ambos módulos existen y consumen Financiero (roadmap #10/#11 cerrados).
**Acción:** corregir la nota. No hay trabajo de código.

---

### DA-16 · `identidad.test.ts` "se salta en CI" ⚪ ⚠️
**Dónde:** [identidad/ANCLA.md:116-118](../src/modules/identidad/ANCLA.md#L116)
**Se aplazó porque:** *"`DATABASE_URL`/`SUPABASE_SECRET_KEY` como secrets de GitHub Actions —
hasta que se configuren, `identidad.test.ts` se salta en CI."*

**Parcialmente caducado:** [`ci.yml`](../.github/workflows/ci.yml) ya levanta un contenedor
`postgres:16` con `DATABASE_URL`/`DIRECT_URL` seteadas y corre las migraciones reales. Lo que
falta es solo `SUPABASE_SECRET_KEY` (Auth real), que ese entorno no puede proveer.
**Acción:** precisar la nota — hoy exagera el gap.

---

## 3. Prioridad 3 — Justificación vigente, pero con síntoma visible

> Acá el contexto **no** cambió. Siguen abiertos porque nadie decidió, no porque algo los
> bloquee. Son decisiones de producto pendientes, no deuda técnica.

### DA-17 · `actualizarComisionEvento` construida y nunca conectada 🔴 ✅
**Dónde:** [ventas/ANCLA.md:226-228](../src/modules/ventas/ANCLA.md#L226) — *"**No
implementado en esta tanda:** editar la comisión de un evento ya abierto en la UI (la acción
`actualizarComisionEvento` existe pero no se conectó — no era parte de los campos mínimos de
la referencia visual)."*

**Verificado, y es peor de lo que dice el ANCLA:** el wrapper de ruta
`actualizarComisionEventoAction` **sí se escribió**
([ventas/actions.ts:275](../src/app/app/(shell)/ventas/actions.ts)) y hasta tiene entrada en
`access-manifest.ts:155` — pero **ningún `.tsx` lo importa**. No es que falte el wiring: se
construyeron dos de las tres capas y se dejó colgando la última.

**Síntoma:** una comisión mal cargada en un evento abierto no se puede corregir desde la UI.

---

### DA-18 · `precio_mensual` del plan Básico sigue en 0 🔴 ✅
**Dónde:** [suscripcion/ANCLA.md:27-30](../src/modules/suscripcion/ANCLA.md#L27) — *"precio
en 0 como **placeholder explícito** — el usuario todavía no definió el precio real."*

**La justificación sigue siendo válida** (es una decisión de negocio, no técnica) **pero el
contexto cambió**: cuando se escribió no había UI. Hoy hay dos pantallas que muestran ese
número — `/admin/planes` y `/app/mi-negocio/plan`. **Un tenant ve hoy que su plan cuesta
Bs 0.** El placeholder dejó de ser interno.

---

### DA-19 · Dialog de Planes con estilo mobile en viewport desktop 🔴 ✅
**Dónde:** [suscripcion/ANCLA.md:42-45](../src/modules/suscripcion/ANCLA.md#L42) — *"**no
corregido a propósito**"*, derivado a `docs/ui/pantallas.md` §"Pendientes de pulido visual".
Detectado por verificación manual del usuario el 2026-07-18. Cosmético, superficie `/admin`.

---

### DA-20 · "Próxima cuota" / estado "Vencido" en el Listado de Pasivos 🔴 ✅
**Dónde:** [patrimonio/ANCLA.md:110-114](../src/modules/patrimonio/ANCLA.md#L110)
**Se aplazó porque:** no existe ninguna función que calcule la próxima cuota desde
`fechaInicio`/`frecuenciaCuota`/pagos. *"Si se necesita esto en el futuro, es una función pura
nueva (candidata a `calcularProximaCuota()`)."*

**Buena decisión, bien documentada** — se prefirió no fabricar un dato antes que mostrar uno
inventado. Queda como feature faltante consciente: la referencia visual la pedía y el listado
no la tiene.

---

### DA-21 · El Portal Institucional muestra menos de lo que promete 🔴 ✅
**Dónde:** [monitoreo-institucional/ANCLA.md:38-48](../src/modules/monitoreo-institucional/ANCLA.md#L38)
— tres pendientes con la **misma causa raíz**: `detalleOperativo` sin
`consultarCapacidadProduccionUsada` (necesita un `activoId` que el veedor no puede
descubrir), `detalleInventarioOperativo` sin `consultarStockInsumo` (necesita
`insumoId`+`sucursalId`), `detalleFinanciero` sin `margenPorProducto` (necesita `productoId`).

**Justificación vigente y sólida:** no existe una función veedor-segura para **enumerar**
sucursales/productos/activos de un tenant, y fabricar una toca la superficie de privacidad
más sensible del proyecto. Se resuelven las tres de una vez o ninguna.

---

### DA-22 · Set inicial de categorías sugeridas de Producto 🔴 ✅
**Dónde:** [productos/ANCLA.md:96-98](../src/modules/productos/ANCLA.md#L96) — *"no hay set
inicial cargado (el doc no lo exige para el MVP) — el catálogo queda vacío hasta que alguien
con `ROL_CEOM_ADMIN_ID` cargue sugerencias."*

**Tercera copia de la familia H-01/H-32**, con una justificación distinta (el doc no lo pide)
pero el mismo efecto: un catálogo global que nace vacío y una UI que lo ofrece igual. El
selector de categoría sugerida en Alta de Producto aparece vacío para **todos** los tenants,
no solo los nuevos. **Se retoma junto a DA-01/DA-02 o no se retoma.**

---

### DA-23 · `AjusteVenta` sin campo de fecha propio 🔴 ✅
**Dónde:** [financiero/ANCLA.md:54-59](../src/modules/financiero/ANCLA.md#L54) y
[111-115](../src/modules/financiero/ANCLA.md#L111)
**Verificado:** `sumarAjustesVentaPeriodo` filtra por `ajustesVenta.creadoEn`
([ventas/repository.ts:403-404](../src/modules/ventas/repository.ts)).

**Síntoma latente:** un ajuste sobre una venta de enero, registrado en marzo, **cae en el
Estado de Resultados de marzo**. No hay forma de fecharlo correctamente. Solo aparece con
ajustes retroactivos, pero cuando aparece el número está mal sin avisar — misma clase que
DA-06. El propio ANCLA ya dejó escrita la ruta de migración si se decide agregar
`fecha_ajuste`.

---

## 4. Prioridad 4 — Justificación vigente, sin síntoma

> Bien decididos, bien documentados. **No hace falta tocarlos.** Se listan para que el mapa
> esté completo y para no volver a auditarlos desde cero.

**Aceptados a propósito, con mecanismo de detección real:**

- **DA-24 · Gap de atomicidad cruzada** — Ventas
  ([:84-87](../src/modules/ventas/ANCLA.md#L84)), Nicho 1
  ([:64-74](../src/modules/operativo/nichos/nicho-1/ANCLA.md#L64)), Proveedores
  ([:71-74](../src/modules/proveedores/ANCLA.md#L71)). Los módulos son cajas negras y no
  comparten transacción de Drizzle; cada uno expone `{ok, error}` para que el caller
  reintente. **Vigente.**

  > ⚠️ **Pero en Proveedores la justificación es hueca.** Verifiqué quién lee esos
  > resultados: `descuentosStock` sí llega a la UI
  > ([ventas route actions.ts:66](../src/app/app/(shell)/ventas/actions.ts)) y
  > `acreditacionProductos` también
  > ([produccion/actions.ts:267](../src/app/app/(shell)/produccion/actions.ts)) — pero
  > **`entradaStock` solo se lee en `proveedores.test.ts`**. Ningún componente ni wrapper de
  > ruta lo mira. Una Compra puede quedar `recibido` con la entrada de stock fallada y el
  > usuario no se entera nunca. El aplazamiento se aceptó tres veces con la condición *"el
  > caller lo detecta"*; se honró en dos. **Este sub-ítem sí merece arreglo** (🔴).

- **DA-25 · Usuario huérfano de Supabase Auth** si la transacción de Postgres falla después
  de crearlo ([identidad/ANCLA.md:295-301](../src/modules/identidad/ANCLA.md#L295)). Auth y
  Postgres no comparten transacción. Limpieza manual documentada. **Vigente.**

**Decisiones de diseño, no deuda:**

- **DA-26 · `estado_pago_gasto` como enum local** ([gastos:68-71](../src/modules/gastos/ANCLA.md#L68)) — cada módulo define el suyo, coherente con Ventas/Compras.
- **DA-27 · Multi-owner / "agregar Owner adicional"** ([identidad:138-142](../src/modules/identidad/ANCLA.md#L138)) — *"sin urgencia de negocio real hoy"*. Coherente.
- **DA-28 · Regla de downgrade con múltiples Owners** ([identidad:192-198](../src/modules/identidad/ANCLA.md#L192)) — **inalcanzable por construcción** mientras DA-27 no se haga. Bien razonado: se retoman juntos o ninguno.
- **DA-29 · Captura offline real** ([ventas:98-101](../src/modules/ventas/ANCLA.md#L98)) — el enum acepta el valor, no hay app offline.
- **DA-30 · Órdenes de Compra multi-ítem / Landed Cost completo** ([proveedores:75-79](../src/modules/proveedores/ANCLA.md#L75), [nicho-4:35-39](../src/modules/operativo/nichos/nicho-4/ANCLA.md#L35)) — *"si Nicho 4 lo necesita, es una extensión nueva, no un bug"*. Nicho 4 no lo necesita.
- **DA-31 · `activo.sucursalId = null` ("aplica a todo el negocio")** ([nicho-4:40-43](../src/modules/operativo/nichos/nicho-4/ANCLA.md#L40)) — no bloquea el caso real esperado.
- **DA-32 · `costo_unitario_en_movimiento` en ajustes/mermas** ([nicho-1:79-83](../src/modules/operativo/nichos/nicho-1/ANCLA.md#L79)) — el doc no especifica; se usa la mejor estimación disponible.
- **DA-33 · Proyección de inversión en activos** ([simulaciones:74-78](../src/modules/simulaciones/ANCLA.md#L74)) — reutilización futura de `unidadesParaCubrir`, documentada.
- **DA-34 · Sin UI de mapeo interactivo de columnas** en importación de ventas ([ventas:255-257](../src/modules/ventas/ANCLA.md#L255)) — *"se documenta acá para no re-litigar la decisión"*. Respetar.
- **DA-35 · "Tasa (TEA)" en Ficha de Pasivo** ([patrimonio:107-110](../src/modules/patrimonio/ANCLA.md#L107)) — el doc confirma "cuota fija sin desglose" para el MVP. **No fabricar el campo.**
- **DA-36 · Sin simetría completa de Strategy Pattern Nicho 1/Nicho 4** ([nicho-4:72-77](../src/modules/operativo/nichos/nicho-4/ANCLA.md#L72)) — confirmado con el usuario, no es un olvido.
- **DA-37 · `listarTenants()` sin paginación** ([identidad:375-379](../src/modules/identidad/ANCLA.md#L375)) — volumen bajo en MVP; revisar antes de escalar.

**Auditoría y observabilidad (compliance, sin síntoma de usuario):**

- **DA-38 · `registrarAccesoAdminCeom` sin hook automático** ([consentimiento:64-73](../src/modules/consentimiento/ANCLA.md#L64), [panel-admin:39-41](../src/modules/panel-admin-ceom/ANCLA.md#L39)) — solo las 3 lecturas del panel quedan auditadas; un `ceom_admin` que lea Financiero por otra vía no deja rastro. Cerrarlo implica tocar `tienePermiso()` de cada módulo. **Vigente, pero es el ítem de mayor peso reputacional de esta sección.**
- **DA-39 · `consultarTenantDetalle` no audita** ([panel-admin:51-55](../src/modules/panel-admin-ceom/ANCLA.md#L51)) — no hay valor de `moduloPermisoEnum` para metadata de tenant. *"No inventar un valor de enum solo para esto."*
- **DA-40 · `consultarInventarioOperativoTenant` audita como `"operativo"`** ([panel-admin:56-60](../src/modules/panel-admin-ceom/ANCLA.md#L56)) — el enum interno no distingue insumos de producción.

**Bloqueados por otra cosa:**

- **DA-41 · Checklist de bienvenida progresivo** ([identidad:106-108](../src/modules/identidad/ANCLA.md#L106)) **y DA-42 · `% onboarding` / `% retención`** ([panel-admin:46-50](../src/modules/panel-admin-ceom/ANCLA.md#L46)) — encadenados: la métrica del panel no puede existir sin el tracking del checklist, y "retención" no está definida en el proyecto. **Un solo trabajo, no dos.**

**Documentación:**

- **DA-43 · La matriz de dependencias no tiene fila para Suscripción/Módulo 11** ([suscripcion:96-99](../src/modules/suscripcion/ANCLA.md#L96)) — gap de `CEOM_Arquitectura.md` §7, avisado explícitamente.
- **DA-44 · Copy inconsistente del magic link** entre primer y segundo ingreso de una Institución ([consentimiento:274-279](../src/modules/consentimiento/ANCLA.md#L274)) — GoTrue manda "Confirm your email" la primera vez. No es bug; el segundo ingreso nunca se verificó.

---

## 5. Nota aparte: lo que **sí** se retomó

Para calibrar — el proyecto no solo acumula aplazamientos, también los cierra. Vale
reconocerlo porque cambia la lectura de la lista:

- **RLS nunca ejercitada bajo `authenticated`** (aplazada en Identidad y Suscripción como
  *"limitación ya conocida y aceptada"*) → hoy es
  [`docs/security/PLAN-RLS-BACKSTOP.md`](security/PLAN-RLS-BACKSTOP.md), un plan por etapas
  **en ejecución activa** (Etapa 4.b.0 cerrada el 2026-07-22, hoy). **No es deuda aplazada:
  es deuda en curso.**
- `item_id` sin FK, Landed Cost, Orden de Compra, evento `compra_registrada` — los cuatro
  aplazados en 3 ANCLAs distintos, los cuatro cerrados por el roadmap ítem #12.
- `activos.proveedor_id` sin FK → cerrado en la migración `0016`.
- `frecuencia_cuota` duplicado → resuelto reutilizando el enum de Patrimonio.
- `listarInstituciones()` sin gate → cerrado el 2026-07-17 *"no se dejó para después"*.
- `tieneCapacidadEspecial()` sin bypass de Owner → bug real encontrado y corregido.

**El patrón que distingue lo cerrado de lo abierto:** casi todo lo que se cerró tenía un
ítem de roadmap propio. Casi todo lo que sigue abierto vive **únicamente** dentro de un
`ANCLA.md`, donde nada lo vigila.

---

## 6. Disparadores que ya se cumplieron

Ocho aplazamientos se escribieron con la forma *"revisar cuando exista X"*. **X ya existe en
todos.** Esta tabla es, probablemente, el entregable más reutilizable del barrido:

| # | Se aplazó hasta que… | Ese hito se cumplió | Estado |
|---|---|---|---|
| DA-01 | *"no hay onboarding UI todavía"* | Fase 1 UI — `src/app/app/onboarding/` | ❌ sin revisar |
| DA-02 | *"la UI de onboarding no existe todavía"* | ídem | ❌ sin revisar |
| DA-03 | *"Módulo 4 no existe todavía"* | Módulo 4 (`src/modules/gastos/`) | ❌ sin revisar |
| DA-05 | *"mientras no exista UI en el proyecto"* | Reportes 9/9, 2026-07-17 | ❌ sin revisar |
| DA-10 | *"cuando se construya la UI"* | Modal de vinculación, 2026-07-20 | ❌ sin revisar |
| DA-11 | *"Identidad no expone `obtenerTenant`"* | `obtenerTenantPorId`, Módulo 10 | ❌ sin revisar |
| DA-12 | *"el módulo de Nicho no existe todavía"* | `nicho-1` + `nicho-4` | ⚠️ 1 de 3 revisado |
| DA-13 | *"depende de que exista el catálogo Planes"* | Módulo 11 + `/admin/planes` | ❌ sin revisar |

**La causa raíz no es ninguno de estos ocho.** Es que un `ANCLA.md` es un buen registro de
decisiones y un mal sistema de recordatorios: nadie relee 15 archivos buscando condiciones
que se hayan vuelto ciertas. Si se quiere que esto no se repita, el mecanismo tiene que
vivir donde ya se mira — el roadmap, el tracker de pantallas, o un ítem de "Definición de
terminado" que exija revisar los disparadores pendientes del módulo tocado.

---

## 7. Si hay que elegir cinco

Por relación impacto/costo, con el blocker original ya desaparecido:

1. **DA-03** — comisiones que nunca se cobran. Es el único de la lista que **corrompe un
   número contable de forma permanente y silenciosa**. La función existe y está probada.
2. **DA-01 + DA-02 + DA-22** — la familia H-01/H-32 completa. Una tiene la función lista, las
   otras dos son la misma tarea. Cerrarlas por separado es cómo llegamos acá.
3. **DA-06 + DA-23** — los dos "el número se ve bien y está mal". El filtro de sucursal es el
   más urgente porque el usuario lo *activa a propósito* y confía en él.
4. **DA-08 + DA-09** — el segundo par de gemelos. Fix chico, conocido, escrito hace días en
   ambos ANCLAs. Cerrar los dos en un commit y romper el ciclo.
5. **DA-24 (Proveedores)** — el único aplazamiento de la lista cuya **justificación se
   verificó falsa en el código**: se aceptó "el caller lo detecta" y en Proveedores nadie
   detecta nada.

**DA-07, DA-17 y DA-05** son buenos candidatos de relleno: funcionalidad ya construida a la
que solo le falta la última capa.

---

*Barrido generado el 2026-07-22 sobre los 15 `ANCLA.md` de `src/modules/**`. Cada ítem se
verificó contra el código real — no solo contra lo que el ANCLA dice de sí mismo. No se
modificó ningún archivo fuera de este documento.*
