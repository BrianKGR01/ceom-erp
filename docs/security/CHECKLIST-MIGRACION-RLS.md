# Checklist — Migrar un módulo a `comoUsuario()` (backstop de RLS)

**Para quién es esto:** vas a migrar un módulo de negocio (`Ventas`, `Gastos`,
`Operativo/Nicho-1`, `Productos`, `Identidad`, `Suscripción`, o el siguiente que
toque) de `db` crudo a `comoUsuario()`, o vas a agregar el bypass de `ceom_admin`/
Gateway a un módulo que ya migró. Este documento te alcanza solo — no hace falta
releer `PLAN-RLS-BACKSTOP.md` completo (3000+ líneas) para seguirlo. Cada ítem
cita su sección de origen (`§X`) solo para quien quiera el razonamiento completo o
la evidencia detrás de la regla — no es lectura obligatoria.

**Estado de este documento:** consolidado el 2026-07-22, con todo lo aprendido en
las Etapas 0-4.b.0 (ver la tabla de estado al principio de `PLAN-RLS-BACKSTOP.md`
para qué está hecho y qué no). Si encontrás algo nuevo migrando un módulo, agregalo
acá — este archivo es el que se supone que no hay que releer el plan entero para
usar, así que tiene que quedar completo por sí mismo.

**Antes de arrancar, dos lecturas cortas, no todo el plan:**
- `src/db/contexto.ts` — los 4 casos (`comoUsuario`/`comoCeomAdmin`/`comoGatewaySistema`/
  `comoSistema`) y sus comentarios, ya explican el mecanismo.
- `src/db/rls.ts` — los 4 helpers (`crudPolicy`/`ceomAdminBypassPolicy`/
  `gatewayVigenciaBypassPolicy`) con sus comentarios de por qué están escritos así.

---

## 0. Antes de tocar código

1. **Barrido de `await` en bucles del módulo** (`§9.1`). Buscá `for`/`for...of` con
   `await` adentro en `actions.ts`/`repository.ts` del módulo. Migrar a
   `comoUsuario()` agrega latencia real por round-trip (§8.3/§9.4 midieron
   +150%-+243% sobre una query trivial) — un bucle secuencial que hoy está al
   borde del timeout de Vitest (5000ms) puede cruzarlo recién cuando migre este
   módulo, no antes. Paralelizar con `Promise.all` donde sea seguro (sin
   dependencia de orden, sin upsert derivado sobre una clave que dos iteraciones
   compartan — ver la heurística de riesgo abajo). Dejar secuencial, a propósito
   y comentado, cualquier bucle que sea un **upsert derivado** (lee-el-estado-actual,
   decide insert/update) sobre una clave que dos iteraciones puedan compartir —
   paralelizarlo permite sobregiro/carrera real.
2. **Frontera hacia módulos NO migrados** (`§9.3`). Si este módulo, dentro de su
   propia transacción de `comoUsuario()`, llama a una función de OTRO módulo que
   todavía usa `db` crudo — esa llamada **no hereda nada**: ni rol, ni contexto de
   RLS, ni la transacción. Abre su propia conexión con bypass total, exactamente
   como corría antes de migrar. No es una regresión de seguridad (el otro módulo
   nunca tuvo RLS real en ese camino), pero es una ventana de atomicidad cruzada
   nueva: si algo *después* de esa llamada cruzada fallara dentro de la
   transacción de `comoUsuario()`, tu escritura se revierte pero la del otro
   módulo (ya comiteada aparte) queda huérfana. Verificado empíricamente, no solo
   razonado (§9.3): confirmado con `pid`/rol distintos entre la conexión de
   `tx` y la del módulo no migrado. Si tu módulo dispara una llamada así, dejalo
   documentado en el propio código (comentario, no solo acá) — el arreglo de fondo
   (pasar un `tx` opcional) es trabajo del módulo *llamado* cuando le toque migrar,
   no tuyo ahora.
3. **Mapear qué tablas de este módulo toca Panel Admin CEOM/Monitoreo
   Institucional** (`§10.1`/`§11.2` ítem 1). Si no está ya confirmado para tu
   módulo, hacé el mismo relevamiento: qué función de Panel Admin CEOM o de
   Monitoreo Institucional (Gateway) llega a una tabla tuya, por qué camino
   (`archivo:línea`), y si el `tenant_id` llega directo o indirecto (vía FK a otra
   tabla, como `pagos_compra → compras.tenant_id`).
4. **Clasificar cada tabla — Familia A o Familia B** (`§10.2`/`§11.2` ítem 2):
   - **Familia A**: ya tiene `crudPolicy()` tenant-scoped declarada en
     `schema.ts`. El bypass se agrega con los helpers de `src/db/rls.ts`
     (`ceomAdminBypassPolicy(tableName)` / `gatewayVigenciaBypassPolicy(tableName,
     moduloVeedor, tenantIdExpr?)`) — nunca reescribir el `using`/`withCheck` a
     mano.
   - **Familia B**: catálogo global o tabla sin policy de tenant propio de la
     que partir (ejemplo: `instituciones`, `planes`, `categorias_*_sugeridas`).
     Necesita diseño de policy dedicado, no el helper genérico — pensalo como un
     mini-diseño aparte, con su propio `EXPLAIN ANALYZE` si el bypass le aplica.

## 1. Escribir los tests ANTES que la policy

Esto va antes de tocar `schema.ts` a propósito — un test escrito y corrido
*después* de que la policy ya existe no prueba nada (podría estar pasando por
casualidad, o por el guard de aplicación, no por RLS).

5. **Reforzar el assert débil de agregación cross-tenant, si este módulo lo
   tiene** (`§14`). Ventas, Gastos y Operativo/Nicho-1 **ya tienen confirmado**
   el patrón `coalesce(sum(...), 0)` en caminos alcanzables por Panel Admin
   CEOM/Gateway (tabla completa en `§14.1` de `PLAN-RLS-BACKSTOP.md`, no
   repetida acá porque puede haber cambiado — volver a grepear
   `coalesce(sum` en el `repository.ts` del módulo antes de asumir la lista
   vieja). El riesgo: `0` porque el tenant genuinamente no tuvo movimientos y
   `0` porque RLS filtró todo son indistinguibles tanto en el resultado como en
   un test que solo hace `typeof x === "number"`. **Antes de migrar**, el test
   correspondiente (`panel-admin-ceom.test.ts`/`monitoreo-institucional.test.ts`/
   el propio del módulo) tiene que sembrar datos reales y afirmar el **valor
   exacto**, no el tipo — sin este paso, el módulo migra en verde devolviendo
   ceros filtrados como si fueran datos reales, y nadie se entera (mismo
   patrón que ya mordió dos veces: `panel-admin-ceom.test.ts` caso 3 antes de
   `§10.6`, y los 4 asserts de `monitoreo-institucional.test.ts` antes de
   `§13.11`).
6. **Test de aislamiento cross-tenant, corrido ANTES de que exista la policy**
   (`§8.1`/`§11.1` punto 4/`§16.10`). Extendé (o creá)
   `<módulo>/tenant-aislamiento.test.ts`: un tenant B no ve la fila de un
   tenant A vía `comoUsuario()`; `comoSistema()` (bypass total) sí la ve, para
   confirmar que el test mide RLS y no el guard de aplicación. Corré este test
   **antes** de escribir la policy de bypass — tiene que fallar (o dar 0 filas
   donde debería dar 1) por RLS todavía sin backstop, no como tautología. Si
   agregás bypass de `ceom_admin` o del Gateway, sumá el caso positivo (un
   `ceom_admin`/Gateway real SÍ ve la fila ajena) y el negativo espejo (un
   usuario casi-`ceom_admin` — mismo `rol_id` pero `es_rol_sistema=false`, o
   desactivado — NO tiene bypass). Documentá el resultado "antes" en el mensaje
   del commit, no lo dejes implícito.

## 2. Escribir la migración

7. **Si el módulo tiene un gate local tipo `requiereCeomAdmin()` propio**
   (`§11.2` ítem 4) — confirmá que ya usa el chequeo doble canónico
   (`rol.esRolSistema && rolId === ROL_CEOM_ADMIN_ID`, nunca solo `rolId`). Si
   no, unificalo ANTES de escribir la policy de RLS, en su propio commit.
8. **`ceomAdminBypassPolicy(tableName)`** para el bypass de `ceom_admin`
   (Familia A) — usa `(select es_ceom_admin())` internamente, hoisteado a
   `InitPlan` desde el día uno (`§12`). **Nunca** escribir `using:
   sql\`es_ceom_admin()\`` a mano — esa forma NO hoistea (verificado con
   `EXPLAIN ANALYZE` real: ~68x más lento a volumen sintético de 40k filas sin
   filtro de tenant explícito). El helper ya nace corregido; solo hace falta no
   reinventarlo.
9. **`gatewayVigenciaBypassPolicy(tableName, moduloVeedor, tenantIdExpr?)`**, si
   esta tabla la alcanza el Gateway (confirmado en el paso 3) — en el MISMO
   commit que la migración a `comoUsuario()`, nunca después (`§9.6`, la
   regresión real que motivó esta regla). `moduloVeedor` es el módulo veedor
   fijo de ESTA tabla (`"financiero"`/`"operativo"`/`"inventario_operativo"`),
   no un parámetro de sesión. `tenantIdExpr` es opcional — por defecto asume una
   columna `tenant_id` directa; si la tabla es hija (como `pagos_compra`, sin
   `tenant_id` propio), pasá el mismo fragmento SQL que ya usa su `crudPolicy()`
   para resolver el tenant vía la tabla padre.
   - **REGLA DURA — `tenant_tiene_consentimiento_vigente()` NUNCA hoistea a
     `InitPlan`, a diferencia de `es_ceom_admin()`/`es_gateway_sistema()`**
     (`§16.5.2`). Toma `tenant_id` como argumento — varía por fila, así que
     Postgres la ejecuta como un `SubPlan` correlacionado, una vez por fila
     candidata, sin importar cómo se escriba. El costo queda acotado
     (~4ms medido) **solo si la query de aplicación trae su propio filtro de
     tenant explícito** — sin ese filtro, escala linealmente con el tamaño de
     la tabla (~450ms medido a 40k filas sintéticas). Confirmá esto
     explícitamente para la query real que el Gateway va a ejecutar sobre esta
     tabla antes de dar la migración por cerrada.
10. **NUNCA agregar el bypass de `ceom_admin` ni del Gateway a
    `usuarios`/`roles`/`permisos`/`permisos_especiales_por_*` ni a
    `aprobaciones_tenant`/`instituciones`** (`§10.3`/`§16.6`, regla dura ya
    escrita como comentario en `identidad/schema.ts` y
    `consentimiento/schema.ts`). `es_ceom_admin()` lee `usuarios`+`roles`;
    `tenant_tiene_consentimiento_vigente()` lee `aprobaciones_tenant`. Agregarles
    ese mismo bypass a esas tablas crea recursión real el día que reciban
    `FORCE ROW LEVEL SECURITY` (evaluar la policy llamaría a la función, que
    vuelve a leer la tabla, que vuelve a evaluar la policy). Si algún día hace
    falta que `ceom_admin`/el Gateway lean esas tablas bajo RLS directo,
    resolverlo con una función/policy que NO dependa circularmente de sí misma
    — no extender este patrón sin pensarlo dos veces.
11. **Si alguna función del módulo puede recibir un solicitante sin fila real en
    `usuarios`/`auth.users`** (hoy, ninguno — `solicitanteGateway()` ya tiene
    fila real desde `4.a`, `§13`/`§15`) — va a necesitar el patrón de
    `ContextoRlsNoResueltoError` (`comoUsuario()` con fallback a `db` crudo,
    capturando específicamente esa excepción, nunca `Error` genérico) hasta que
    se resuelva de raíz. No debería aplicar ya a ningún módulo nuevo, pero
    confirmalo.

## 3. Probar la migración

12. **Migración probada contra un contenedor Postgres limpio ANTES de aplicarla
    contra la base real** (`dev-practices.md §7.2`, regla dura, incidente real
    documentado ahí). Obligatorio si la migración toca `auth`/`storage` — muy
    recomendado siempre:
    ```bash
    docker run -d --name repro -e POSTGRES_PASSWORD=postgres -p 15432:5432 postgres:16
    mv .env.local .env.local.bak   # CRÍTICO — ver la nota de abajo
    DATABASE_URL="postgresql://postgres:postgres@localhost:15432/postgres" \
    DIRECT_URL="postgresql://postgres:postgres@localhost:15432/postgres" \
      node scripts/ci/apply-stub.mjs
    DATABASE_URL="postgresql://postgres:postgres@localhost:15432/postgres" \
    DIRECT_URL="postgresql://postgres:postgres@localhost:15432/postgres" \
      pnpm exec drizzle-kit migrate
    mv .env.local.bak .env.local
    docker rm -f repro
    ```
    `mv .env.local .env.local.bak` es obligatorio — `drizzle.config.ts` carga
    `.env.local` si existe y pisa `DATABASE_URL`/`DIRECT_URL` con el proyecto
    Cloud real sin avisar. Si el stub (`scripts/ci/stub-supabase-schemas.sql`)
    le falta algo a tu migración, extenderlo con columnas reales verificadas
    contra el proyecto Cloud — nunca simplificar la migración para esquivarlo.
13. **Si `drizzle-kit generate` pide un prompt interactivo** (rename de policy
    vs. drop+create) — este entorno no tiene TTY, el comando falla duro. Si
    solo cambiaste el `using`/`with_check` de una policy ya existente, la forma
    más simple es mantener el MISMO nombre de policy (no renombrarla) para que
    el diff sea un `ALTER POLICY` sin ambigüedad — ver `gatewayVigenciaBypassPolicy()`
    en `src/db/rls.ts` para el ejemplo real (mismo nombre de policy que
    `gatewaySistemaBypassPolicy()`, cuerpo distinto).
14. **Verificar con `EXPLAIN ANALYZE` real, no simulado**, cualquier función
    `SECURITY DEFINER` nueva antes de confiar en su costo — mismo patrón que
    `§8.1`/`§10.3`/`§12.2`/`§16.5`: todo dentro de una transacción con
    `rollback` al final (cero efectos persistentes), sembrando volumen
    sintético si hace falta forzar el peor caso. No asumir que una función
    hoistea solo porque otra con forma similar lo hace — `es_ceom_admin()`
    hoistea con `(select ...)`, `tenant_tiene_consentimiento_vigente()` no,
    por una razón estructural (item 9 arriba), no por casualidad.

## 4. Cerrar

15. **Correr la suite COMPLETA, no solo la del módulo, antes de dar la
    migración por cerrada** (`§9.6` — la regresión real que esta regla existe
    para prevenir: Proveedores rompió Monitoreo Institucional y Panel Admin
    CEOM sin que ningún test del propio módulo lo detectara). `pnpm test`
    completo, `pnpm typecheck`, `pnpm lint`, `pnpm build`.
16. **`FORCE ROW LEVEL SECURITY`** en las tablas de este módulo, al cierre —
    barato, no rompe nada para `authenticated` (nunca es dueño), cierra la
    puerta a que una query futura corra por accidente como `postgres` sin que
    nadie note que RLS quedó invisible (`§2.4`/`§9.2`, decisión `§7.4`, aplicada
    por-módulo desde Proveedores en vez de esperar a una etapa final única).
17. **Actualizar el `ANCLA.md` del módulo** si cambió el contrato (nueva
    función pública, comportamiento distinto de una existente) — regla general
    del proyecto (`AGENTS.md`), no específica de RLS. Si el módulo migrado tiene
    tablas alcanzadas por el Gateway o por Panel Admin CEOM, documentar ahí
    también qué bypass tiene cada una y por qué.
18. **Actualizar la tabla de estado al principio de `PLAN-RLS-BACKSTOP.md`**
    con el módulo recién migrado — es la única fuente que alguien debería
    necesitar leer para saber qué está hecho, sin releer el documento completo.

---

## Heurística rápida: ¿este bucle es seguro de paralelizar?

De `§9.1`, confirmada en 3 módulos distintos: un bucle es sospechoso de **no**
ser seguro de paralelizar si es un **upsert derivado** — lee el estado actual de
una fila, decide `insert`/`update` en base a eso — sobre una clave que dos
iteraciones del mismo bucle podrían compartir (mismo insumo+sucursal, mismo
producto+sucursal, etc.). Paralelizar ese patrón permite que dos iteraciones lean
el mismo estado "viejo" antes de que la otra escriba, y una pise el resultado de
la otra. Cualquier otro bucle de lecturas independientes o inserciones
independientes (sin ese patrón lee-decide-escribe sobre clave compartida) es
seguro con `Promise.all`.
