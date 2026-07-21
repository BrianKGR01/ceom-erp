# Auditoría de autorización server-side — CEOM-ERP

> Fecha: 2026-07-21. Disparador: UI-044 (`/app/mi-negocio/plan` sin gate `esOwner`) no como bug
> aislado sino como **síntoma**. Objetivo: cuantificar cuántos otros olvidos del mismo tipo existen,
> corregir los Críticos/Altos, y proponer un mecanismo que impida que vuelva a pasar.
>
> Método: barrido con agentes en paralelo (workflow `auditoria-autorizacion`, 16 módulos/capas, cada
> hallazgo pasado por 2 verificadores adversariales independientes) + **verificación personal** de
> cada Crítico/Alto leyendo el código citado antes de tocarlo. Donde el workflow y la verificación
> personal difirieron, manda la verificación personal (ver §5, dos "críticas" degradadas a Media).

---

## 1. Respuesta directa a la pregunta

**UI-044 NO era el único. Es un patrón sistémico.** El barrido encontró **24 escrituras
cross-tenant críticas** (además de UI-044) repartidas en 5 módulos, todas de la misma clase: una
función recibe un id de recurso desde el cliente y lo **muta o lee sin verificar que ese recurso
pertenezca al tenant del solicitante**. UI-044 era la variante más leve (lectura same-tenant de
datos Owner-only); las otras son escrituras cross-tenant, varias sobre el sistema de identidad y
permisos.

Todas fueron corregidas en esta sesión (§6). Los hallazgos Medios/Bajos quedan documentados (§7),
sin corregir, según lo pedido.

**Actualización 2026-07-21 (segunda pasada):** poblar el manifiesto de acceso (§8.3) destapó 2
funciones más con la misma clase de bug, en una variante distinta y más grave: `construirDashboard`/
`obtenerCapacidadAlmacenamientoWidget` recibían un `usuario` **ya resuelto** por parámetro en vez de
uno derivado internamente. Se documentaron primero como "bajo riesgo, no explotable" por razonar
sobre los callers del código — verificación empírica contra el `server-reference-manifest.json` real
de `pnpm build` mostró que esa suposición era falsa: Next.js les asigna un action ID igual que a
cualquier endpoint legítimo, así que eran invocables por POST directo con un `usuario` forjado,
evadiendo `tienePermiso()` por completo. Reclasificadas a **Crítico** y corregidas (§8.3.1). El total
de Críticos corregidos en esta auditoría es **26 funciones + UI-044**, no 24.

---

## 2. Hallazgo sistémico raíz — por qué esto es explotable, no defense-in-depth

`src/db/client.ts` abre **una sola conexión directa a Postgres** (`postgres(DATABASE_URL)`) con el
rol `postgres` (dueño de las tablas), sin `SET ROLE` ni `request.jwt.claims` por request. Ese rol
**bypassea RLS**. Está documentado en el propio `src/db/rls.ts`:

> "las Server Actions ya filtran por tenant_id explícitamente vía tienePermiso() y usan el rol
> 'postgres' (DATABASE_URL/DIRECT_URL), que **bypassea RLS por ser dueño de las tablas**. Estas
> policies protegen accesos futuros vía los roles 'authenticated'/'anon'… **no son el mecanismo
> principal de aislamiento**."

**Consecuencia:** las políticas `crudPolicy()` declaradas junto al schema (AGENTS.md regla 6) NO se
aplican a las queries de negocio. El chequeo app-level en cada module action es la **única** defensa.
Por lo tanto:

- Una función por-id que no ata el recurso al tenant = **fuga/escritura cross-tenant real y
  explotable** (Crítica), no un hueco de defensa en profundidad.
- El repository **no** filtra por tenant en las lecturas por-id (ej. `obtenerEventoPorId`,
  `obtenerProductoPorId`, `crearMovimientoTx`) — a propósito, es capa de datos; el filtro vive en la
  action. Si la action se olvida, no hay red.

---

## 3. Arquitectura de autorización (para leer la matriz)

- **Endpoints reales:** las funciones exportadas de `src/app/**/actions.ts` (`"use server"`).
  Resuelven la sesión (`obtenerUsuarioActual` / `obtenerInstitucionActual`) y delegan pasando el
  `solicitante` + `usuario.tenantId` (**server-derived, no controlable por el cliente**). El cliente
  controla el resto de los argumentos (ids de recursos, montos).
- **Capa de autorización:** las module actions en `src/modules/**/actions.ts`. Reciben `solicitante`
  y gatean.
- **Primitivas de gate:**
  - `tienePermiso(solicitante, tenantObjetivoId, modulo, accion)` — corta si
    `solicitante.tenantId !== tenantObjetivoId` (salvo ceom_admin), aplica estado_acceso, Owner
    bypass, matriz rol×módulo×acción. **El patrón correcto para recursos por-id es: cargar el
    recurso y llamar `tienePermiso(solicitante, recurso.tenantId, …)`** — así un id ajeno hace que
    `recurso.tenantId !== solicitante.tenantId` y se rechaza.
  - `recursoPerteneceAlTenant(solicitante, recursoTenantId)` — **nuevo guard** (§8), para los casos
    gateados por capacidad/esOwner donde `tienePermiso` no aplica.
  - `requiereCeomAdmin` / `requiereOwnerDelTenant` / `tieneConsentimiento` / `estaEnCartera` —
    boundaries de /admin, consentimiento y portal.
- **El layout de `/admin` NO gatea `ceom_admin`** (solo `!usuario`) — la protección de /admin vive
  enteramente en `requiereCeomAdmin` dentro de cada module action. Verificado: todas lo tienen (§4).

---

## 4. Matriz por módulo/capa

| Módulo / capa | Cómo gatea | Veredicto | Hallazgos |
|---|---|---|---|
| **Identidad** (`modules/identidad`) | `esOwner`/`ceom_admin` directo + `tienePermiso` | ⚠️ **7 escrituras cross-tenant** (mutaciones por-id sin atar el recurso) | 7 Crítica + 1 Media |
| **Productos / Inventario** (`modules/productos`) | `tienePermiso(inventario/productos)`; catálogo bien atado por `producto.tenantId` | ⚠️ **5 escrituras cross-tenant** en el ledger de stock | 5 Crítica |
| **Operativo Nicho-1** (`modules/operativo/nichos/nicho-1`) | `tienePermiso(operativo)`; recetas/insumos | ⚠️ **6 fugas/escrituras cross-tenant** (ids anidados sin atar) | 6 Crítica |
| **Ventas** (`modules/ventas`) | `tienePermiso(ventas)` correcto; Eventos gateados por capacidad | ⚠️ **4 escrituras cross-tenant** en Eventos | 4 Crítica + 2 Media |
| **Proveedores** (`modules/proveedores`) | `tienePermiso(proveedores)` fetch-then-gate correcto | ⚠️ FKs de compra sin atar (write a stock ya cerrado downstream) | 1 Crítica + 1 Media |
| **Patrimonio** (`modules/patrimonio`) | fetch-then-gate `tienePermiso(patrimonio, recurso.tenantId)` — **correcto** | ✅ Aislamiento OK; solo FKs anidados sin revalidar | 3 Baja + 2 Media |
| **Gastos** (`modules/gastos`) | `tienePermiso(costos_gastos)` fetch-then-gate | ✅ Sin hallazgos | 0 |
| **Simulaciones** (`modules/simulaciones`) | `tienePermiso(simulaciones)`; delega productoId a Productos/Ventas gateados | ✅ Sin hallazgos | 0 |
| **Financiero** (`modules/financiero`) | re-gatea `tienePermiso(financiero)` antes de delegar | ✅ Sin hallazgos | 0 |
| **Reportes** (`modules/reportes`) | composición pura; reenvía `usuario.tenantId` a actions gateadas | ✅ Sin hallazgos | 0 |
| **Suscripción** (`modules/suscripcion`) | catálogo global de planes (sin tenant_id); writes por `requiereCeomAdmin` | ✅ Sin hallazgos | 0 |
| **Operativo Nicho-4** (`modules/operativo/nichos/nicho-4`) | 1 lectura; delega a patrimonio/productos que revalidan | ✅ Sin hallazgos | 0 |
| **Boundary /admin** (`app/admin/**` + `panel-admin-ceom`) | `requiereCeomAdmin` en toda función alcanzable | ✅ Sin hallazgos — el layout no gatea, pero las actions sí | 0 |
| **Boundary /portal** (`app/portal/**` + `monitoreo-institucional` + Gateway) | `tieneConsentimiento`/`estaEnCartera` antes de cualquier dato | ✅ Sin hallazgos — **el Gateway de Consentimiento resiste** | 0 |
| **Thin actions** (`app/app/(shell)/**/actions.ts`) | resuelven sesión, pasan `usuario.tenantId`; no gatean (esperado) | ⚠️ Exponen las funciones de módulo vulnerables de arriba | (mismos que arriba) |

---

## 5. Nota de verificación personal (diferencias con el workflow)

Dos funciones que el workflow marcó **Crítica** las **degradé a Media** tras leer el endpoint real:

- `ventas.registrarVenta` y `ventas.importarVentaHistorica`: el workflow razonó sobre la función de
  módulo (que recibe `tenantId` como parámetro) como si el `tenantId` fuera del cliente. Pero sus
  únicos endpoints (`registrarVentaAction`, `importarVentaHistoricaLoteAction`) pasan
  `usuario.tenantId` (server-derived). **No** hay escritura "a un tenant arbitrario". El residuo real
  es que leen `eventoId`/`canalVentaId` ajenos para la comisión (fuga del % de comisión) — Media. El
  `productoId` ajeno ya lo rechaza `consultarPrecioVenta` (fetch-then-gate en Productos). Documentadas
  en §7, no corregidas.

Esto es exactamente por qué la verificación personal es obligatoria antes de tocar código: la
severidad depende de si el `tenantId` es controlable por el cliente en el **endpoint**, no en la
firma de la función de módulo.

---

## 6. Hallazgos Críticos — corregidos en esta sesión

Todos son de la misma clase: **función por-id que muta/lee un recurso sin atarlo al tenant del
solicitante**. RLS bypasseada ⇒ explotables. Fix: cargar el recurso y verificar su tenant (patrón
`fetch-then-check`), usando el guard `recursoPerteneceAlTenant` donde el gate era por capacidad.

### UI-044 — `/app/mi-negocio/plan` + `obtenerMiPlanAction` (lectura Owner-only same-tenant)
`mi-negocio/plan/page.tsx:58` y `mi-negocio/actions.ts` — sin gate `esOwner` (sus 3 hermanas sí lo
tenían). Cualquier colaborador leía plan/precio/estado de suscripción. **Fix:** gate `esOwner` en
page + action. **Commit `46e62cf`.**

### Identidad — 7 escrituras cross-tenant (las más sensibles: usuarios/roles/permisos)
`modules/identidad/actions.ts`. Todas gateaban `esOwner` (flag del propio solicitante) pero nunca
verificaban que el `usuarioId`/`rolId` objetivo fuera del tenant del solicitante ⇒ un Owner de un
tenant podía operar sobre **otro** tenant:

| Función | Línea | Abuso |
|---|---|---|
| `cambiarRolUsuario` | ~601 | Reasignar el rol de un colaborador de otro tenant (validaba el rol nuevo, no el usuario objetivo) |
| `suspenderUsuario` | ~624 | Desactivar (DoS) un colaborador de otro tenant |
| `reactivarUsuario` | ~652 | Reactivar un usuario de otro tenant (ni siquiera lo cargaba) |
| `actualizarPermisosRol` | ~779 | Reescribir la matriz de permisos de un rol de otro tenant |
| `eliminarRol` | ~793 | Soft-delete de un rol de otro tenant |
| `otorgarCapacidadEspecialPorRol` | ~878 | Setear capacidad especial en un rol de otro tenant |
| `otorgarCapacidadEspecialPorUsuario` | ~908 | Otorgar capacidad especial a un usuario de otro tenant |

**Fix:** nuevo guard `recursoPerteneceAlTenant` + `fetch-then-check` en las 7. **Commit `4430b61`.**

### Productos / Inventario — 5 escrituras cross-tenant al ledger de stock
`modules/productos/actions.ts`. Reciben `tenantId` (propio, gateado) + `input.productoId` (del
cliente) y escriben con `productoId` sin verificar que sea de `tenantId`. El repo
`crearMovimientoTx`/`crearEntradaProduccionTx` inserta en `movimientos_stock` y **pisa
`costo_operativo_vigente`** por `productoId` sin filtrar tenant.

`registrarEntradaProduccion:431`, `registrarEntradaCompraReventa:458`, `registrarAjusteManualStock:485`,
`descontarStockVenta:520`, `registrarTransferenciaStock:566` — un usuario con permiso de inventario
en su tenant podía corromper el stock y el costo de un producto de **otro** tenant.

**Fix:** `requireProductoDelTenant(tenantId, productoId)` tras el gate en las 5. **Commit `f03af71`.**

### Operativo Nicho-1 — 6 fugas/escrituras cross-tenant
`modules/operativo/nichos/nicho-1/actions.ts`:

- `registrarEntradaCompraInsumo:219`, `registrarAjusteManualInsumo:261`, `registrarMermaAlmacenamiento:296`
  — cargaban el insumo pero solo chequeaban existencia, no `insumo.tenantId === tenantId` ⇒ escritura
  al ledger/costo de un insumo ajeno.
- `actualizarComposicionReceta:421` — gateaba la receta por tenant pero no los `insumoId` de la
  composición ⇒ inyectar un insumo ajeno y filtrar su costo vía el costo calculado de la receta.
- `vincularProductoAReceta:446` — validaba el producto pero no `recetaId` ⇒ vincular un producto
  propio a una receta ajena.
- `registrarProduccion:537` — no ataba `productoId` ⇒ leía receta/composición/costos ajenos y
  descontaba stock de insumos de otro tenant antes de fallar la acreditación.

**Fix:** `insumo.tenantId === tenantId`, validación de cada `insumoId`/`recetaId`, y `fichaProducto`
al tope de `registrarProduccion`. **Commit `bb8ca95`.**

### Ventas — 4 escrituras cross-tenant en Eventos
`modules/ventas/actions.ts`. `abrirEvento:271`, `actualizarComisionEvento:301`, `cerrarEvento:316`,
`reabrirEvento:337` gateaban solo con `requiereGestionarEventos` — que chequea la capacidad
`gestionar_eventos`, **tenant-ciega** (`tieneCapacidadEspecial` no recibe tenantObjetivo) — y nunca
ataban el `eventoId`. Como **todo Owner pasa la capacidad**, cualquier Owner podía cerrar/reabrir/
re-comisionar un evento de otro tenant pasando un `eventoId` ajeno.

**Fix:** `recursoPerteneceAlTenant(solicitante, evento.tenantId)` en las 3 por-id; validación de
`tenantId` en `abrirEvento`. **Commit `a36dfa7`.**

### Proveedores — `registrarCompra` (FK cross-tenant)
`modules/proveedores/actions.ts:204`. Gateaba `tenantId` pero no ataba `proveedorId`/`insumoId`/
`productoId`. La escritura cross-tenant al **stock** ya quedó cerrada al atar `productoId`/`insumoId`
en Productos y Nicho-1 (la entrada de stock rechaza items ajenos); el residuo era una fila de compra
referenciando un proveedor ajeno. **Fix:** validación de `proveedor.tenantId === tenantId`.
**Commit `82eaf27`.**

---

## 7. Hallazgos Medios / Bajos — documentados, sin corregir

| ID | Función | Sev | Descripción | Por qué no es Crítico |
|---|---|---|---|---|
| M1 | `ventas.registrarVenta` | Media | `eventoId`/`canalVentaId` ajenos leídos para la comisión (fuga del %) | Endpoint pasa `usuario.tenantId`; `productoId` ajeno ya rechazado por `consultarPrecioVenta` |
| M2 | `ventas.importarVentaHistorica` | Media | `canalVentaId`/`clienteId`/`productoId` anidados sin validar | Endpoint pasa `usuario.tenantId`; no escribe a tenant arbitrario |
| M3 | `patrimonio.crearPasivo` / `refinanciarPasivo` | Media | `activoId` no validado contra el tenant | Escritura cae en el tenant propio; integridad, no fuga de datos ajenos |
| M4 | `patrimonio.crearActivo`/`actualizarActivo`/`transferirActivo` | Baja | `sucursalId`/`proveedorId`/`nuevaSucursalId` no revalidados | Ídem — contamina FK propio, sin leer datos de la víctima |
| M5 | `proveedores.registrarCompra` (residuo) | Media | `insumoId`/`productoId` en compra "pedido" (sin recepción) | Se rechaza al recibir (entrada de stock atada al tenant) |
| M6 | `identidad.completarOnboarding` | Media | Write sin gate de `estado_acceso` (asimétrico vs sus hermanas) | Solo escribe `onboarding_completado_en` del propio tenant |

**Recomendación:** cerrarlos en Fase C junto con la migración, aplicando el mismo guard
`recursoPerteneceAlTenant` a cada FK anidado.

---

## 8. Mecanismo preventivo — para que no vuelva a pasar

No alcanza con parchear las 24: la clase de bug reaparece cada vez que alguien agrega una función
por-id y se olvida el chequeo. Tres capas, de la más inmediata a la más robusta:

### 8.1 Guard obligatorio (implementado)
`recursoPerteneceAlTenant(solicitante, recursoTenantId)` en `modules/identidad/actions.ts` — un único
lugar que decide "¿este recurso es de este solicitante?" (ceom_admin bypass, rechaza recurso de
sistema). **Regla de código:** toda función que recibe un id de recurso desde el cliente **debe**
cargar el recurso y pasar su `tenantId` por este guard (o por `tienePermiso(solicitante,
recurso.tenantId, …)`) antes de leerlo/mutarlo. Ya aplicado en los 24 sitios.

### 8.2 Test de regresión (implementado — §8 test)
`modules/identidad/recurso-tenant.test.ts` prueba el guard como función pura (mismo tenant → true,
otro tenant → false, recurso de sistema → false, ceom_admin → true). Es el test que falla si alguien
rompe la lógica del guard. **Extensión recomendada** (requiere DB de test): un test por módulo que
arma 2 tenants y afirma que el tenant A no puede mutar el recurso de B — hoy los `*.test.ts` de cada
módulo usan un solo tenant, no cubren el caso cross-tenant.

### 8.3 Manifiesto + test de cobertura (implementado — 2026-07-21)
`src/lib/security/access-manifest.ts` declara el nivel de acceso esperado de **cada una de las 152
funciones** exportadas de los 19 archivos `"use server"` reales del proyecto (`publico`,
`autenticado`, `owner`, `ceom_admin`, `por-recurso`). `access-manifest.test.ts` enumera esas
funciones por AST (usando el compilador de TypeScript, sin dependencias nuevas) y:

1. **Falla si una función exportada de un archivo `"use server"` no tiene entrada en el manifiesto**
   — agregar un endpoint nuevo sin clasificarlo rompe la suite. Validado con una prueba negativa
   deliberada (crear un archivo `"use server"` con una función sin clasificar → falla; borrarlo →
   pasa).
2. **Falla si el manifiesto tiene una entrada obsoleta** (función renombrada/eliminada, o typo en la
   clave) — mantiene el manifiesto honesto, no solo creciente.
3. **Para las entradas `verificacion: "estatica"`, confirma por texto que el guard esperado del nivel
   declarado existe** en la función o en la función de módulo a la que delega (hasta 2 saltos de
   resolución de imports/helpers locales del mismo archivo). Validado con una segunda prueba
   negativa: cambiar a mano el nivel de una función ya corregida → el test la marca sin evidencia;
   revertir → vuelve a pasar. Esta prueba negativa además destapó un bug real en la propia
   herramienta (los guards canónicos como `tienePermiso()` contienen internamente `esOwner`,
   `ROL_CEOM_ADMIN_ID` y `tenantId !==` los tres a la vez, así que inlinear su implementación
   aprobaba cualquier nivel sin importar cuál fuera el real) — corregido excluyendo los guards
   canónicos de la expansión recursiva (su sola presencia como llamada ya alcanza como evidencia).
4. Las entradas donde el análisis estático no alcanza, o donde el nivel declarado documenta un hueco
   ya conocido y no corregido, se marcan `verificacion: "manual"` con una `nota` obligatoria — el
   test exige que toda entrada `"manual"` tenga nota no vacía.
5. **Falla si un endpoint recibe un objeto de identidad/permisos/tenant ya resuelto por parámetro**
   (`UsuarioConRol`, `SolicitanteCeomAdmin`, `Institucion`) — ver §8.3.1, es la regla que cierra la
   clase de bug de `construirDashboard`. Validado con la misma técnica de prueba negativa.

Cómo agregar una entrada nueva: `src/lib/security/README.md`.

#### 8.3.1 Los 3 hallazgos que destapó poblar el manifiesto — los 3 corregidos

**`construirDashboard` / `obtenerCapacidadAlmacenamientoWidget` — reclasificado de "no explotable" a
CRÍTICO tras verificación empírica, y corregido.**

Al poblar el manifiesto el 2026-07-21 se documentó esto como un hallazgo de bajo riesgo, razonando
sobre los *callers* del código ("solo lo llama un Server Component, Next.js no debería exponer un
action-id"). Esa suposición **nunca se verificó contra el build real** — y era incorrecta. Evidencia
concreta, extraída de `.next/server/app/app/(shell)/page/server-reference-manifest.json` después de
`pnpm build`:

```json
"70d02b0d0b823008d6a118475b11877e770f5fd340": {
  "workers": { "app/app/(shell)/page": { "exportedName": "construirDashboard", ... } },
  "exportedName": "construirDashboard",
  "filename": "src/app/app/(shell)/inicio-actions.ts"
},
"40df26756844e3fe225461d04d6d46be04310f34ce": {
  "workers": { "app/app/(shell)/page": { "exportedName": "obtenerCapacidadAlmacenamientoWidget", ... } },
  ...
}
```

Ambas funciones tienen un **action ID real**, en el mismo manifiesto y con la misma forma que
`obtenerDashboardAction`/`cerrarSesion` (los endpoints legítimos de esa misma ruta). Next.js asigna
un action ID a **toda** función exportada de un archivo `"use server"`, sin importar si algún Client
Component la importa — el caller del código nunca determina quién puede invocarla desde afuera. Con
el action ID en mano, un atacante podía enviar un POST directo con `Next-Action: <hash>` y un
`usuario` forjado (`{ esOwner: true, tenantId: "<otro-tenant>" }`) como primer argumento, y
`tienePermiso()` habría confiado en esos campos tal como llegaron: bypass completo de autorización
en una sola llamada, no solo de este dashboard sino de facto de todo `tienePermiso`. **Crítico.**

Corregido: ambas funciones resuelven `usuario` internamente vía `obtenerUsuarioActual()` en vez de
recibirlo por parámetro, como las otras 150 funciones del manifiesto. `construirDashboard` ahora
devuelve `ResultadoAccion<DatosDashboard>` (antes devolvía `DatosDashboard` sin envolver);
`obtenerDashboardAction` pasó a ser un passthrough puro; `page.tsx` desenvuelve el resultado y
redirige a `/login` en el caso `!ok` (solo alcanzable por una sesión revocada entre el chequeo inicial
de la página y esta llamada, milisegundos después). Verificado: `pnpm typecheck`/`lint`/`test`/`build`
limpios.

**`obtenerInstitucionPorIdAction` — corregido.** No llamaba a `obtenerUsuarioActual()`, a diferencia
de sus 9 hermanas del mismo archivo — invocable sin sesión. Se agregó el mismo chequeo que el resto.

**`registrarVentaAction` — corregido.** `input.sucursalId` no se revalidaba contra el tenant al
registrar la Venta. Se agregó `listarSucursalesPorTenant(solicitante, tenantId)` + chequeo de
membresía antes de continuar, mismo patrón ya usado para FKs anidados en otros módulos.

**Mecanismo agregado para que la clase `construirDashboard` no vuelva a pasar** (regla 5 arriba):
`access-manifest.test.ts` ahora falla si cualquiera de las 152 funciones recibe `UsuarioConRol`,
`SolicitanteCeomAdmin` o `Institucion` como tipo de parámetro — sin excepción de manifiesto, es una
regla incondicional. Validada con una prueba negativa: reintroducir `usuario: UsuarioConRol` como
parámetro en una función `"use server"` de prueba → falla citando el archivo y la función exactos;
borrarla → vuelve a pasar.

### 8.4 Arreglar el bypass de RLS (recomendación estratégica)
La defensa real de fondo es que la base **también** rechace el acceso cross-tenant. Hoy Drizzle corre
como `postgres` (RLS off). Migrar a una conexión por-request con `SET ROLE authenticated` +
`set_config('request.jwt.claims', …)` haría que las `crudPolicy()` ya declaradas actúen como
backstop: aunque una action se olvide el chequeo, la policy RLS filtra por `tenant_id`. Es un cambio
de infraestructura (conexión por-request, `SET LOCAL` transaccional, compatibilidad con el pooler en
modo transaction) — no se hizo en esta sesión por riesgo, pero es **la** corrección que convierte
esta clase de bug de "explotable" en "defensa en profundidad". Prioridad alta post-Fase A.

---

## 9. Estado

- **Críticos:** 24 funciones + UI-044 + `construirDashboard`/`obtenerCapacidadAlmacenamientoWidget`
  (reclasificadas de Media a Crítica tras verificación empírica, §8.3.1) → **26 funciones + UI-044,
  todas corregidas** (commits `46e62cf`, `4430b61`, `f03af71`, `bb8ca95`, `a36dfa7`, `82eaf27`,
  `a0cb0a7`). `pnpm typecheck`/`lint`/`test`/`build` limpios.
- **Medios/Bajos:** M1–M6 (§7) siguen documentados, sin corregir (según lo pedido). Los otros 2
  hallazgos del manifiesto (`obtenerInstitucionPorIdAction`, `registrarVentaAction`) sí se
  corrigieron (commits `a72a27e`, `881aa21`) por ser mecánicos y de bajo riesgo de regresión.
- **Mecanismo:** guard `recursoPerteneceAlTenant` + test de regresión implementados (§8.1/8.2);
  manifiesto de acceso + test de cobertura por AST sobre las 152 funciones `"use server"`
  implementado (§8.3), incluida la regla que prohíbe recibir identidad/permisos/tenant por
  parámetro (§8.3.1); backstop RLS sigue como recomendación estratégica pendiente (§8.4).
- **Positivos que resisten:** Gastos, Simulaciones, Financiero, Reportes, Suscripción, el boundary de
  `/admin` (todas las admin actions exigen `ceom_admin` pese a que el layout no lo hace) y el boundary
  de `/portal` (el Gateway de Consentimiento exige `tieneConsentimiento`/`estaEnCartera` antes de
  devolver cualquier dato de un tenant).
