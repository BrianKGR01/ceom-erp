# ANCLA — Módulo: Identidad, Tenants, Sucursales, Roles, Autorización

## Contrato (no romper sin actualizar este archivo)
- Responsabilidad: es dueño de Tenant, Sucursal, Usuario, Rol, la matriz de
  permisos (módulo×acción) y las capacidades especiales — y resuelve las
  cuatro preguntas de `docs/modules/Modulo_01...md` sección 0 (a qué tenant
  pertenece un dato, quién es el usuario, qué puede hacer, está permitida
  esta acción ahora mismo).
- NO hace: no implementa el Panel Administrativo CEOM, Instituciones ni el
  Gateway de Consentimiento institucional (sección 7.2 del módulo — ver
  `src/modules/suscripcion/ANCLA.md`, es trabajo del roadmap ítem #10). No
  corre un scheduler real para transición de etapas de suscripción —
  `calcularEstadoAcceso()` es una función pura, algo externo tiene que
  invocarla periódicamente cuando exista esa infraestructura. La UI de
  Gestión de Tenants en `/admin` (Alta/Listado/Ficha de Tenant, con panel
  Cambiar Plan/Cambiar Estado de Suscripción) quedó cerrada 2026-07-18 —
  detalle completo más abajo.
- Entradas que consume: `obtenerPlanPorId()` de `src/modules/suscripcion/actions.ts`
  (para validar/defaultear el plan al dar de alta un tenant — ver
  decisiones abajo). Fuera de eso, ninguna de otro módulo (es la base,
  `CEOM_Arquitectura.md` sección 7). Sí depende de Supabase Auth (GoTrue)
  para la sesión y para crear usuarios.
- Salidas que expone (`actions.ts`): `obtenerUsuarioActual`,
  `calcularEstadoAcceso`, `tienePermiso`, `tieneCapacidadEspecial`,
  `crearTenant`, `cambiarPlanTenant`, `cambiarEstadoSuscripcion` (las dos
  últimas agregadas 2026-07-18, gap de backend cerrado antes de la UI de
  Gestión de Tenants), `invitarUsuario`, `cambiarRolUsuario`, `suspenderUsuario`,
  `reactivarUsuario`, `crearRolPersonalizado`, `actualizarPermisosRol`,
  `eliminarRol`, `obtenerTenantPorId`, `obtenerEstadoAccesoTenant` (las dos
  últimas agregadas en Módulo 10 — Gateway de Consentimiento),
  `obtenerTenantParaVeedor`, `listarTenants`, `solicitanteGateway` (las tres
  agregadas en el roadmap ítem #11 — Monitoreo Institucional/Panel Admin
  CEOM, ver detalle abajo), `otorgarCapacidadEspecialPorRol`,
  `otorgarCapacidadEspecialPorUsuario` (agregadas en auditoría de Fase 1 —
  cerraban un gap real: `tieneCapacidadEspecial()` ya sabía leer el override
  usuario→rol→false de la sección 13.1, pero no existía ninguna Server
  Action para escribirlo; las únicas escrituras eran `db.insert()` directo
  dentro de los propios tests). También re-exporta el **tipo**
  `UsuarioConRol` (desde Módulo 5/Patrimonio) — cualquier módulo que llame a
  `tienePermiso()` necesita tipar su `solicitante` sin importar
  `identidad/repository.ts` directamente. `actualizarTenant`, `asignarNicho`
  (agregadas al construir la UI de Onboarding, Fase 1 fase de UI — cerraban
  el gap de backend documentado desde `docs/ui/pantallas.md`).
  `listarSucursalesPorTenant` (agregada al construir Catálogo/Ficha de
  Producto — ningún módulo tenía forma de listar sucursales de un tenant
  hasta ahora; la necesitan los modales de ajuste/transferencia de stock).
  `completarOnboarding` (agregada al construir el shell de `/app` — hacía
  falta forzar el redirect a Onboarding en el primer ingreso del Owner, y
  `nicho_id` solo no alcanza para saber si ya terminó, ver decisión abajo).
  `listarUsuarios`, `listarRoles`, `listarPermisosPorRol`,
  `listarCapacidadesEspeciales`, `transferirOwner` (agregadas para la UI de
  Colaboradores/Roles — último ítem pendiente del roadmap original de este
  módulo, ver detalle abajo).

## Estado actual
- [x] Schema Drizzle (7 tablas) + RLS (`.enableRLS()` + policies) + función
      SQL `current_tenant_id()`.
- [x] Seed de datos de sistema: tenant reservado "CEOM Ops", roles globales
      "Owner" y "CEOM Admin" (IDs fijos en `constants.ts`).
- [x] `repository.ts` + `actions.ts` con las 11 funciones del contrato.
- [x] Tests: `estado-acceso.test.ts` (puro, siempre corre) +
      `identidad.test.ts` (integración contra Supabase Cloud real, se salta
      solo si faltan `DATABASE_URL`/`SUPABASE_SECRET_KEY`).
- [x] `tenants.plan_id` tiene FK real a `planes.id` (Módulo 11 mínimo,
      `src/modules/suscripcion/`); `crearTenant()` valida/defaultea el plan.
- [x] `modulo_permiso` (enum) ahora incluye `"proveedores"` (Módulo 8,
      `src/modules/proveedores/`) además de `"patrimonio"` (Módulo 5).
- [x] `obtenerTenantParaVeedor(tenantId)` (roadmap ítem #11) — sin
      `solicitante`, mismo criterio que `obtenerEstadoAccesoTenant()`: para
      que `monitoreo-institucional` (una Institución externa, no un
      `UsuarioConRol`) lea nombre/nicho/plan/estado_acceso mínimos de un
      tenant que ya tiene en su Cartera Institucional.
- [x] `listarTenants(solicitante)` (roadmap ítem #11) — listado cross-tenant
      completo, gateado a `ceom_admin` directo (mismo bypass que ya usa
      `tienePermiso()` para ese rol). Consumido por `panel-admin-ceom` para
      calcular salud agregada de la plataforma.
- [x] `solicitanteGateway()` (roadmap ítem #11, **rediseñada 2026-07-21 —
      Etapa 4.a del backstop de RLS**, docs/security/PLAN-RLS-BACKSTOP.md
      §13/§15) — ya NO arma un `UsuarioConRol` sintético: lee la fila real
      sembrada en `0034_gateway_sistema_seed.sql`
      (`GATEWAY_SISTEMA_USUARIO_ID`, tenant CEOM Ops, rol PROPIO
      `ROL_GATEWAY_SISTEMA_ID` — nunca `ROL_CEOM_ADMIN_ID`). El acotamiento
      a "solo lectura, solo tras `tieneConsentimiento()`" sigue siendo el
      mismo — ahora reforzado en dos capas, no solo en comentario: la rama
      de `tienePermiso()` para este id puntual deniega cualquier `accion`
      distinta de `"ver"`, y a nivel de RLS este id solo tiene bypass
      (`es_gateway_sistema()`/`gatewayVigenciaBypassPolicy()`, Etapa 4.b.0 —
      filtra por id puntual, no por rol, Y por vigencia de consentimiento del
      tenant, no solo identidad) donde se aplicó explícitamente
      (`compras`/`pagos_compra` de Proveedores, hoy). Ver "Decisiones"
      abajo para el porqué del rediseño.
- [x] `otorgarCapacidadEspecialPorRol`/`otorgarCapacidadEspecialPorUsuario`
      (auditoría de Fase 1) — gateadas a `esOwner` + `requireEscrituraHabilitada`,
      hacen upsert real sobre `permisos_especiales_por_rol`/`_por_usuario`.
      La de rol rechaza roles de sistema (`esRolSistema`) — Owner/CEOM Admin
      son globales, compartidos entre tenants; habilitar ahí afectaría a
      todos los tenants a la vez. Cubierto por
      `identidad.test.ts` ("otorgarCapacidadEspecialPorRol/PorUsuario...").
- [x] `actualizarTenant`/`asignarNicho` (Onboarding, sección 4/5 del módulo)
      — "Configurar negocio" + "Elegir rubro" ya tienen backend real y
      pantalla en `/app/onboarding`. Gate igual que
      `invitarUsuario`/`cambiarRolUsuario`: `solicitante.esOwner` directo.
      `asignarNicho` es de un solo uso — rechaza siempre si el tenant ya
      tiene `nicho_id` (sección 5: la migración Modo Básico → Nicho es de un
      solo sentido, sin excepciones). Cubierto por `identidad.test.ts`.
- [ ] Checklist de bienvenida progresivo (sección 4, paso 3) — sin tracking
      persistido todavía, fuera de alcance de esta tarea (ya documentado
      como gap aparte en `docs/ui/pantallas.md`).
- [ ] Panel Administrativo CEOM, Instituciones, Gateway de Consentimiento
      (sección 7.2) — roadmap ítem #10, módulo aparte.
- [ ] Scheduler real que recalcula y persiste `estado_acceso` por tiempo.
- [ ] Chequeo de límite de sucursales contra plan (sección 9.6) — depende de
      que exista el catálogo Planes.
- [ ] Lógica de habilitación de cofundadores/multi-owner (el modelo de datos
      ya lo permite vía `es_owner` booleano, no hay función que lo active).
- [ ] `DATABASE_URL`/`SUPABASE_SECRET_KEY` como secrets de GitHub Actions —
      hasta que se configuren, `identidad.test.ts` se salta en CI (queda en
      verde pero sin cobertura real ahí; localmente sí corre).
- [x] Gaps de backend cerrados para la UI de Colaboradores/Roles
      (2026-07-18): `listarUsuarios(solicitante)` (colaboradores del propio
      tenant), `listarRoles(solicitante)` (sistema + personalizados, con
      conteo de colaboradores relativo al tenant), `listarPermisosPorRol(
      solicitante, rolId)` (expone `repo.listarPermisosPorRol`, ya existía
      en el repository sin wrapper), `listarCapacidadesEspeciales(
      solicitante)` (bulk: `porRol` excluye roles de sistema — nunca tienen
      fila, sección 13 —, `porUsuario` solo trae los overrides ya
      otorgados). Las 4 gateadas igual que el resto de gestión de
      Identidad: `solicitante.esOwner` directo.
- [x] `transferirOwner(solicitante, nuevoOwnerUsuarioId,
      rolParaOwnerSaliente)` (2026-07-18, sección 6.2/9.1) — atómica: el
      destino pasa a `rolId=ROL_OWNER_ID, esOwner=true`; el saliente queda
      con `rolParaOwnerSaliente` (obligatorio, sin default implícito) y
      `esOwner=false`. Contrato confirmado explícitamente con el usuario
      antes de implementar (mismo criterio que el magic link de
      Instituciones). Validaciones: destino debe pertenecer al mismo tenant
      y estar `activo=true`; `rolParaOwnerSaliente` no puede ser un rol de
      sistema y debe pertenecer al mismo tenant. **"Agregar Owner adicional
      sin perder la condición propia" (multi-owner vía
      `planes.permiteMultiplesOwners`) queda fuera a propósito** — es una
      acción distinta ("sumar" vs "ceder"), sin urgencia de negocio real
      hoy; se aborda como su propia tanda chica si algún tenant con ese
      plan la necesita.
- [x] **UI construida (2026-07-18): Colaboradores/Roles/Capacidades
      Especiales** — último bloque de UI pendiente del módulo, roadmap
      ítem #1 pasa a `[x]` sin caveats. `/app/mi-negocio/{colaboradores,
      roles,capacidades}` (dentro del route group `(shell)`, separado a
      propósito de `/app/onboarding` — ver decisión sobre el loop de
      redirect más abajo). Mockup de referencia solo para Gestión de Roles
      y Capacidades Especiales; Listado de Colaboradores reusa el patrón
      de cards de Instituciones, Invitar/Editar reusan el patrón de Dialog
      de Nuevo Proveedor. "Transferir Owner" y "Eliminar rol con
      colaboradores asignados" (modal de reasignación forzada) no estaban
      en el inventario original de `docs/ui/pantallas.md` — se sumaron acá.
      Detalle completo de campos por pantalla en `docs/ui/pantallas.md`
      sección 1.
- [x] **Bug de seguridad real encontrado y corregido durante la
      verificación en navegador de esta misma tanda (2026-07-18):
      `invitarUsuario`/`cambiarRolUsuario` no validaban que el rol
      asignado no fuera de sistema.** Antes del fix, un llamado directo a
      cualquiera de las dos Server Actions (no solo a través de la UI —
      las Server Actions de Next.js son invocables directo) podía
      asignarle `ROL_CEOM_ADMIN_ID` a un colaborador de un tenant
      cualquiera. Como `tienePermiso()` resuelve el bypass cross-tenant de
      CEOM Admin mirando únicamente `solicitante.rol.esRolSistema &&
      solicitante.rolId === ROL_CEOM_ADMIN_ID` (nunca valida que el
      usuario pertenezca de verdad al tenant "CEOM Ops"), ese colaborador
      quedaba con acceso administrativo real cross-tenant. **Fix:** ambas
      funciones ahora rechazan si el rol destino `esRolSistema` o no
      pertenece al mismo tenant del solicitante — mismo criterio que ya
      usaban `eliminarRol`/`actualizarPermisosRol`/
      `otorgarCapacidadEspecialPorRol`. La UI también deja de listar
      Owner/CEOM Admin como opciones seleccionables (defensa en
      profundidad, no la única barrera). Cubierto por un test dedicado en
      `identidad.test.ts` ("cambiarRolUsuario/invitarUsuario rechazan
      asignar un rol de sistema").
- [x] **`cambiarPlanTenant`/`cambiarEstadoSuscripcion` (2026-07-18)** —
      gaps de backend confirmados y cerrados antes de tocar la UI de
      Gestión de Tenants en `/admin` (mismo criterio de siempre). Ambas
      gateadas a `solicitante.rolId === ROL_CEOM_ADMIN_ID` directo (mismo
      criterio que `crearTenant`, no `tienePermiso()` — "identidad" no
      participa en la matriz real de permisos: ningún rol tiene una fila en
      `permisos` con `modulo="identidad"`, aunque desde la Etapa 3 del
      backstop de RLS ese valor sí exista en `moduloPermisoEnum`,
      exclusivamente para `logs_acceso_admin_ceom.modulo_consultado` — ver
      `docs/security/PLAN-RLS-BACKSTOP.md` §10.5). `cambiarPlanTenant` valida el plan destino
      contra `obtenerPlanPorId()` de Suscripción (existe + `activo=true`),
      igual que `crearTenant`. `cambiarEstadoSuscripcion` acepta
      `fechaProximoPago` opcional — relevante al pasar a `"vencida"`, que
      es el ancla desde la que `calcularEstadoAcceso()` mide la etapa de
      gracia (sin ella el tenant queda `bloqueado` de inmediato, mismo
      comportamiento ya documentado en esa función, no un caso especial
      nuevo). **Pendiente documentado, no silencioso:** ninguna de las dos
      fuerza la regla de sección 6.2 ("un downgrade a un plan sin
      `permite_multiples_owners` debe forzar un solo Owner primero") —
      hoy no existe ningún camino para que un tenant tenga más de un Owner
      (`transferirOwner()` es 1-a-1, "agregar Owner adicional" quedó fuera
      de alcance a propósito), así que la regla es inalcanzable en la
      práctica; revisar si algún día se construye esa funcionalidad.
      `crearTenant` ya estaba completo (confirmado, no se tocó): crea
      Tenant+Sucursal principal+Usuario Owner atómicamente vía
      `repo.crearTenantConOwner()` y dispara la invitación real por email.
- [x] **UI construida (2026-07-18): Gestión de Tenants** — cierra el único
      bloque de UI pendiente del módulo. `/admin/tenants/nuevo` (Alta, con
      mockup — página dedicada, no Dialog), botón "+ Nuevo Tenant" en el
      listado, y panel de acciones en la Ficha de Tenant existente (sin
      mockup, sin tocar sus 3 tabs veedor de Módulo 11): "Cambiar Plan"
      (Dialog, `cambiarPlanTenant`) y "Cambiar Estado de Suscripción"
      (Dialog, `cambiarEstadoSuscripcion`). Detalle completo de campos en
      `docs/ui/pantallas.md` sección 1. **Verificado end-to-end en
      navegador**, incluida la invitación real: confirmado con un script
      ad-hoc contra `admin.auth.admin.listUsers()` que `invited_at` quedó
      seteado para el Owner de prueba — no solo "no tiró error", prueba
      independiente de que Supabase Auth efectivamente encoló el correo.
      Como el email de prueba es ficticio (sin bandeja real), el click del
      link **queda pendiente de validación manual**, mismo criterio que el
      magic link de Instituciones.
- [x] **UI construida (2026-07-20): Banner de estado del tenant** — cierra el
      último ítem de UI de este módulo. Banner ámbar/rojo en `AppShell`
      (`src/components/shared/app-shell.tsx`), visible en todas las pantallas
      de `/app` cuando `estadoAcceso !== "activo"`. **Es señal visual
      únicamente** — `tienePermiso()` ya bloqueaba crear/editar en
      `solo_lectura`/`bloqueado` desde antes de esta tanda (líneas 95-97 de
      este archivo), sin cambios. Verificado explícitamente: con el tenant
      en `vencida` (etapa de gracia), un intento real de `crearProducto`
      fue rechazado server-side con el mismo mensaje de siempre. Se calcula
      con `calcularEstadoAcceso(tenant)` directo sobre el `tenant` que
      `src/app/app/(shell)/layout.tsx` ya fetchea (no se llama a
      `obtenerEstadoAccesoTenant()` por separado — mismo resultado, pero esa
      función no devuelve `fechaProximoPago`, necesario para el texto del
      banner ámbar, así que hacía falta el tenant completo de todas formas).
      Con esto, roadmap ítem #1 de Identidad queda 100% cerrado — cero UI
      pendiente en todo el módulo.

## Dónde está cada cosa
- Esquema de BD (Drizzle): `src/modules/identidad/schema.ts`
- IDs de sistema (tenant CEOM Ops, roles Owner/CEOM Admin): `src/modules/identidad/constants.ts`
- Repository: `src/modules/identidad/repository.ts`
- Server actions (contrato público): `src/modules/identidad/actions.ts`
- Tests: `src/modules/identidad/estado-acceso.test.ts`, `src/modules/identidad/identidad.test.ts`
- Infra compartida (no es de este módulo, la usa cualquier módulo): cliente
  Drizzle en `src/db/client.ts`, helper `crudPolicy()` en `src/db/rls.ts`,
  clientes de sesión/admin de Supabase en `src/lib/supabase/server.ts`.
- Migraciones relevantes: `drizzle/migrations/0002` (tablas), `0003`
  (`current_tenant_id()`), `0004` (RLS), `0005` (seed CEOM Ops/roles).
- UI de Onboarding: `src/app/app/onboarding/` (fuera del route group
  `(shell)`, ver decisión abajo). UI de Colaboradores/Roles/Capacidades
  Especiales: `src/app/app/(shell)/mi-negocio/` (`actions.ts` compartido +
  un subdirectorio por pantalla: `colaboradores/`, `roles/`, `capacidades/`).
  Schemas de formulario: `src/modules/identidad/validation.ts`.

## Decisiones tomadas que un agente no debe revertir
- **`/app/mi-negocio/*` (Colaboradores/Roles/Capacidades) vive dentro del
  route group `(shell)`, separado de `/app/onboarding` — no fusionarlos.**
  `/app/onboarding` está fuera de `(shell)` a propósito (ver
  `src/app/app/(shell)/layout.tsx`) para que el asistente de primer ingreso
  del Owner nunca quede envuelto en el sidebar ni en loop de redirect. El
  nav item "Mi negocio" de `app-shell.tsx` apunta a
  `/app/mi-negocio/colaboradores`, y `esActivo()` tiene un caso especial
  que resalta el mismo item tanto para `/app/mi-negocio/*` como para
  `/app/onboarding` (visualmente es "la misma sección" para el Owner,
  aunque técnicamente son dos route groups distintos). Las 4 pantallas
  (Negocio/Colaboradores/Roles/Capacidades) se enlazan entre sí con un
  sub-nav de texto duplicado por archivo, mismo criterio que los links de
  `/app/ventas`.
- **`tenants.onboarding_completado_en` es independiente de `nicho_id`** —
  no reusar `nicho_id IS NOT NULL` como señal de "onboarding terminado".
  Modo Básico deja `nicho_id = null` a propósito y para siempre (Modulo_01
  sección 5), así que ese campo solo no distingue "nunca pasó por
  onboarding" de "pasó y eligió Modo Básico". `completarOnboarding()` se
  llama una sola vez al final del asistente sin importar qué se haya
  elegido en el paso 2, y es idempotente (no pisa la fecha si ya está
  seteada).
- `crudPolicy()` **no existe** en `drizzle-orm` para Supabase (solo para
  Neon) en la versión instalada — el de `src/db/rls.ts` es un helper propio.
  No asumir que viene de la librería.
- "Owner" y "CEOM Admin" son **roles de sistema globales** (una sola fila
  cada uno, `tenant_id = null`, IDs fijos en `constants.ts`), no una fila de
  rol nueva por tenant. `crearTenant` reutiliza el mismo `ROL_OWNER_ID`
  siempre — no crear un rol "Owner" por tenant.
- El Owner **no tiene filas en la matriz de permisos** — `tienePermiso()`
  resuelve `es_owner` en código, después del gate de `estado_acceso`.
- `tenants.estado_acceso` está persistido en el schema pero **no es la
  fuente de verdad** que usa `tienePermiso()` — se recalcula siempre con
  `calcularEstadoAcceso()` a partir de `estado_suscripcion` +
  `fecha_proximo_pago`, porque nada mantiene esa columna al día todavía
  (no hay scheduler).
- El catálogo del enum `modulo_permiso` (Modulo_01 sección 1.5) **no incluye
  "identidad"** como módulo gestionable — por eso las acciones de
  gestión de usuarios/roles (`invitarUsuario`, `cambiarRolUsuario`,
  `crearRolPersonalizado`, etc.) están gateadas por `solicitante.esOwner`
  directamente, no por `tienePermiso()`. Es una ambigüedad real del spec
  (sección 8.1 dice "cualquier usuario con permiso crear en este módulo",
  pero ese módulo no está en el enum) — si se decide resolver distinto, hay
  que tocar tanto el enum en `schema.ts` como cada gate en `actions.ts`.
- `crearTenant`/`invitarUsuario` crean el usuario de Supabase Auth **antes**
  de la transacción de Postgres (necesitan el `id` real para la FK
  `usuarios.id -> auth.users.id`). Si la transacción de Postgres falla
  después de creado el usuario de Auth, ese usuario queda huérfano —
  Supabase Auth y Postgres no comparten una transacción. No hay limpieza
  automática todavía; si pasa, se borra a mano con
  `admin.auth.admin.deleteUser()`.
- `drizzle.config.ts` apunta a `./src/modules/**/schema.ts` (glob) — todo
  módulo nuevo que agregue tablas solo necesita crear su `schema.ts` en esa
  ruta, no hay que tocar la config.
- Los tests de `identidad.test.ts` pegan contra el **Supabase Cloud de
  desarrollo real** (no hay DB de test separada) y limpian explícitamente lo
  que crean en `afterAll` (usuarios de Auth vía `admin.deleteUser`, filas de
  Postgres vía `DELETE`) — no dependen de rollback de transacción.
- `crearTenant()` valida el plan **antes** de invitar al usuario a Supabase
  Auth: si no viene `planId`, usa `PLAN_BASICO_ID` (de
  `src/modules/suscripcion/constants.ts`) por default; si viene, llama a
  `obtenerPlanPorId()` de `suscripcion/actions.ts` (nunca a su repository
  directo) y rechaza si el plan no existe o `activo=false`. Este chequeo
  corre antes del efecto secundario de invitación por email — un test
  puede ejercer el rechazo (`identidad.test.ts`, plan inexistente) sin
  disparar un email real.
- `identidad/schema.ts` importa la tabla `planes` de
  `suscripcion/schema.ts` (no su repository ni actions) para declarar la FK
  `tenants.plan_id → planes.id`. Es la **única excepción documentada** al
  principio de "módulo = caja negra" en todo el proyecto — ver el detalle
  completo (por qué, y qué hacer si algún día se vuelve un ciclo real) en
  `src/modules/suscripcion/ANCLA.md`.
- `UsuarioConRol` se re-exporta desde `actions.ts` (antes solo vivía en
  `repository.ts`) porque Módulo 5 (Patrimonio) lo necesita para tipar
  `solicitante` al llamar `tienePermiso()`. Cualquier módulo futuro que
  también llame `tienePermiso()` debe importar el tipo desde acá, no desde
  el repository.
- **`modulo_permiso` es un enum ampliable** — Módulo 5 agregó
  `"patrimonio"` y Módulo 8 agregó `"proveedores"` (ninguno de los dos
  estaba en la lista original de Módulo 1 sección 1.5). Patrón para
  agregar un valor nuevo: la migración `ALTER TYPE ... ADD VALUE` va
  **sola**, sin ninguna otra sentencia DDL en el mismo archivo — Postgres
  no permite usar un valor recién agregado en la misma transacción en que
  se agregó. Ver `src/modules/proveedores/ANCLA.md` para el ejemplo real.
- **`obtenerTenantPorId` y `obtenerEstadoAccesoTenant` (Módulo 10)**: la
  primera exige un `solicitante: UsuarioConRol` real (gate: `ceom_admin` o
  mismo tenant) y devuelve el registro completo del Tenant. La segunda **no
  recibe `solicitante`** — a propósito, pensada para el Gateway de
  Consentimiento, donde el llamador (una Institución externa) no es un
  usuario de CEOM — expone únicamente `estado_acceso` derivado, nunca el
  resto de los datos del Tenant. No fusionar ambas ni agregarle
  `solicitante` a la segunda "por consistencia" — perdería su único
  propósito.

- **Principio (2026-07-18, sigue vigente, no se revierte): el Gateway es un
  lector acotado y revocable, nunca un admin** — nunca debe tener un bypass
  equivalente al de `ceom_admin`, solo la capacidad de leer, exactamente en
  los caminos que ya usa, después de que `tieneConsentimiento()` ya
  autorizó. **El mecanismo original que implementaba este principio (un
  objeto 100% en memoria, `id` sintético sin fila real) quedó obsoleto el
  2026-07-21**, no el principio: la premisa bajo la que se eligió ("esto
  nunca va a depender de que RLS real resuelva `current_tenant_id()`/
  `auth.uid()`") dejó de ser cierta en cuanto Proveedores migró a
  `comoUsuario()` — un objeto sin fila real no puede resolver eso de forma
  consistente (diagnóstico completo: docs/security/PLAN-RLS-BACKSTOP.md
  §9.6, §10.4, §13). La Etapa 4.a de ese plan reemplaza el objeto sintético
  por una fila real sembrada, pero con un bypass de RLS **propio y de solo
  lectura** (`es_gateway_sistema()`/`gatewayVigenciaBypassPolicy()`,
  §13.2/§13.6/§16.9.1 de ese plan — desde la Etapa 4.b.0, condicionado además
  a que el tenant tenga consentimiento vigente para el módulo, no solo a la
  identidad) — distinto del de `ceom_admin`, nunca heredado
  de él — más una rama dedicada en `tienePermiso()` que solo permite
  `"ver"` para ese id puntual (antes era una convención en comentario;
  ahora es una regla que el código hace cumplir, con test negativo
  dedicado). La opción alternativa que se evaluó y se descartó — reusar
  el bypass de `ceom_admin` tal cual, sin rol ni policy propios — sí
  hubiera traicionado este principio (el Gateway heredaría automáticamente
  cualquier bypass presente o futuro de `ceom_admin`, incluida escritura);
  por eso se descartó. **Uso exclusivo**: solo lo invoca
  `monitoreo-institucional/actions.ts`, y solo para lecturas, solo después
  de que `tieneConsentimiento()` ya devolvió `true`. Nunca usar para
  escrituras (los campos de auditoría `creadoPor`/`modificadoPor` quedarían
  apuntando a un UUID sin fila real, violando la FK) ni exponer a ningún
  input externo.
- **`listarTenants()` no pagina** — a diferencia de la advertencia de
  rendimiento del Módulo_11 sección 6.2 (cartera institucional grande), acá
  se aceptó sin paginación para "nivel básico": el volumen esperado de
  tenants en este MVP es bajo. Revisar si se vuelve un problema real de
  performance antes de escalar el número de tenants.
- **El candado circular ya está resuelto**: antes no había forma de entrar
  como `ceom_admin` ni de crear el primer tenant (la migración `0005` solo
  siembra el ROL, nunca una fila de usuario real, y `crearTenant()` exige
  un solicitante ya logueado como `ceom_admin`). `scripts/seed-admin.ts`
  (`pnpm seed:admin <email>`) crea ese primer usuario real vía el Admin API
  de Supabase Auth + una fila en `usuarios` con `rolId=ROL_CEOM_ADMIN_ID` en
  el tenant `CEOM Ops`. Ver `docs/dev-practices/dev-practices.md` sección
  7.1.

- **`tenants.nicho_id` es un enum fijo (`nicho_1`/`nicho_4`), no un `uuid`
  con tabla catálogo.** Antes de esta tarea la columna era un `uuid` suelto
  sin FK y **ningún código del repo la leía ni la escribía** (cero
  referencias en `src/modules/operativo/**`, cero en tests) — un gap más
  profundo que el documentado en `docs/ui/pantallas.md`. Se decidió
  explícitamente con el usuario no crear una tabla `nichos` (solo hay 2
  nichos reales en el MVP, sin previsión de crecer sin revisar el roadmap
  primero — mismo criterio que `capacidadEspecialEnum`). Si algún día se
  suma un nicho nuevo: `ALTER TYPE nicho ADD VALUE` en su propia migración,
  sola, sin otro DDL en el mismo archivo (mismo patrón ya documentado abajo
  para `modulo_permiso`). `planes.nicho_id` (Suscripción) sigue siendo un
  `uuid` suelto — no se tocó, queda fuera de alcance de este cambio.
- **Bug real encontrado en `drizzle-kit generate` para un `ALTER COLUMN` de
  `uuid` a enum**: el SQL que genera (`USING "col"::"tipo_enum"`) falla en
  Postgres — no se puede castear `uuid` directo a un enum arbitrario, hace
  falta pasar por texto (`USING "col"::text::"tipo_enum"`). Ver
  `drizzle/migrations/0022_public_lady_bullseye.sql`, ya corregido a mano.
  Si se genera otra migración que cambie el tipo de una columna `uuid` a un
  enum, revisar el `USING` generado antes de aplicar — no asumir que
  `drizzle-kit generate` lo resuelve bien.
- **`drizzle.__drizzle_migrations` puede quedar inconsistente si una
  migración falla a mitad de camino** (visto en la 0022: `CREATE TYPE`
  llegó a persistir pero el `ALTER COLUMN` falló, y aun así quedó una fila
  de tracking con un `hash`/`created_at` que no correspondían al archivo
  real — la lógica de `drizzle-orm` para decidir qué migración ya se aplicó
  compara por `created_at` contra el `when` de `_journal.json`, **no por
  hash**, aunque la tabla también guarda un hash). Se corrigió esa fila a
  mano, con autorización explícita del usuario (acción que el modo
  automático de la sesión bloquea por defecto, correctamente, al ser una
  escritura directa sobre infraestructura compartida). Si vuelve a pasar:
  comparar `_journal.json` (`when` de la migración) contra
  `select id, hash, created_at from drizzle.__drizzle_migrations order by
  created_at desc limit 1` antes de asumir que "no aparece error" significa
  "se aplicó bien" — `drizzle-kit migrate` puede terminar en exit code 1
  sin imprimir el error real de Postgres.

- **Bug de seguridad real encontrado y corregido — `current_tenant_id()` tenía
  recursión infinita bajo el rol `authenticated`** (migración
  `0025_fix_current_tenant_id_security_definer.sql`). La función
  (`security invoker`, migración `0003`) resuelve
  `select tenant_id from usuarios where id = auth.uid()` — pero `usuarios`
  tiene su propia policy de RLS (`crudPolicy()`) que exige
  `tenant_id = (select current_tenant_id())`. Para evaluar esa policy, Postgres
  necesita `current_tenant_id()`, que a su vez necesita evaluar esa misma
  policy de nuevo — recursión circular. Nunca se detectó porque **todo** el
  acceso a datos de la app corre bajo el rol `postgres` (superusuario, vía
  `DATABASE_URL`/`DIRECT_URL`), que bypassea RLS por completo — la RLS de
  **todas** las tablas de negocio (`crudPolicy()`, la "segunda capa de
  defensa" de `AGENTS.md` regla 6) era código muerto, nunca ejercitado bajo
  el rol `authenticated` real, hasta que la integración de Storage (ver
  abajo) hizo la primera llamada real vía `crearClienteServidor()` (que sí
  usa la sesión JWT del usuario, rol `authenticated`) y Postgres cortó la
  recursión con el error `54001 statement_too_complex`. **Fix:** la función
  ahora es `security definer` (+ `search_path` explícito) — su consulta
  interna corre con los privilegios de quien la creó, sin re-evaluar la
  policy de `usuarios`, rompiendo el ciclo. Sigue siendo segura: el `WHERE`
  de la función es siempre `id = auth.uid()`, nunca puede devolver el
  `tenant_id` de otro usuario sin importar quién la llame. **Cualquier
  módulo que en el futuro haga una llamada real (no solo de test) usando el
  cliente de sesión de Supabase (no el rol `postgres`) contra una tabla con
  `crudPolicy()` ahora sí queda protegido de verdad — antes no lo estaba.**

- **Bug real corregido (2026-07-18): `tieneCapacidadEspecial()` ahora
  bypassea al Owner incondicionalmente**, primer paso de la resolución,
  antes de override por usuario/rol (Modulo_01 sección 6.2: "todos los
  permisos en todos los módulos, de forma permanente y no editable" — igual
  criterio que ya tenía `tienePermiso()`). Antes de este fix, un Owner sin
  un override puntual por usuario **no podía** `vender_sin_stock`/
  `gestionar_eventos`/`producir_sin_stock_insumo`, porque Owner es rol de
  sistema y nunca puede tener una fila en `permisos_especiales_por_rol`
  (`otorgarCapacidadEspecialPorRol` la rechaza explícitamente) — el override
  por usuario era la única vía, y nadie se lo otorgaba al Owner por
  default. Cubierto por un test explícito en `identidad.test.ts`
  ("el Owner tiene bypass incondicional"), que además confirma que ni
  siquiera un override propio del Owner en `false` puede reducirlo — el
  bypass es incondicional de verdad, no solo "el default si no hay override".
  **Verificado que esto NO invalida las verificaciones end-to-end previas**
  de `vender_sin_stock` (Productos), `gestionar_eventos` (Ventas),
  `producir_sin_stock_insumo` (Operativo Nicho 1): las tres se hicieron
  otorgando explícitamente el override a la cuenta de prueba antes de
  probar (nunca confiando en un bypass de Owner inexistente), así que
  ejercitaron el camino real de override — el mismo que usaría cualquier
  colaborador no-Owner. Detalle en `productos/ANCLA.md` y `ventas/ANCLA.md`
  (actualizados en el mismo cambio). Único cabo suelto, no bloqueante:
  `ventas/actions.ts` → `importarVentaHistorica()` tiene un
  `!solicitante.esOwner &&` explícito antes de llamar a
  `tieneCapacidadEspecial()` (workaround de cuando el bypass no existía
  ahí) — ahora redundante pero no incorrecto, no se tocó (cambio de otro
  módulo, fuera de este commit).
- **Storage: `tenants.logoUrl` ya está conectado de punta a punta.** El
  dropzone de Onboarding Paso 1 sube a Storage apenas se elige el archivo
  (`subirLogoAction`, `src/app/app/onboarding/actions.ts`) y persiste la URL
  real con `actualizarTenant()` al guardar el formulario — antes era
  preview local únicamente (`logoUrl` nunca viajaba). Ver
  `src/lib/supabase/storage.ts` y su ANCLA en Productos (mismo mecanismo,
  documentado una sola vez ahí para no duplicar). **Gap conocido no
  resuelto en esta tarea:** el botón "Quitar logo" solo limpia el campo del
  formulario a `undefined` — como el update de Drizzle omite las columnas
  `undefined` del `SET` (no las vuelve `NULL`), quitar el logo y guardar
  **no borra** `logoUrl` en la base. Si se necesita "sacar el logo" de
  verdad, hay que mandar `null` explícito (no `undefined`) y ajustar
  `actualizarTenantSchema`/`actualizarTenant` para aceptarlo.

- **El Dialog "Cambiar Estado de Suscripción" (`/admin/tenants/[tenantId]`)
  usa el enum real `estadoSuscripcion` (`activa`/`pausada`/`vencida`), no
  `estadoAcceso` (`activo`/`solo_lectura`/`bloqueado`).** El pedido original
  de esta pantalla describía un selector con los 3 valores de
  `estadoAcceso` — mezcla incorrecta de dos enums distintos, corregida sin
  preguntar porque ya está documentado arriba como invariante de
  arquitectura: `estadoAcceso` es **derivado** (`calcularEstadoAcceso()`),
  nunca asignable a mano. Si algún agente futuro ve un pedido de UI que
  menciona "activo/solo_lectura/bloqueado" como algo seleccionable por un
  admin, es casi seguro el mismo error — verificar contra esta nota antes
  de implementarlo literal.
- **Bug real encontrado y corregido (2026-07-18, `/app/mi-negocio/plan`): un
  Server Component no puede importar una constante de datos (no-componente)
  desde un archivo `"use client"` y esperar el valor real en el servidor.**
  `page.tsx` (sin `"use client"`) importaba `MODULOS_VEEDOR_INFO` desde
  `consentimiento/generar-cliente.tsx` (que sí es `"use client"`, mismo
  patrón que ya usan `planes-cliente.tsx`/`instituciones-cliente.tsx` — pero
  esos dos son ellos mismos Client Components, no Server Components). En el
  servidor esa importación resolvió a una referencia vacía, no al objeto
  real — `MODULOS_VEEDOR_INFO[m]` daba `undefined` y `.label` tiraba
  `TypeError`. `tsc` no lo detecta (el tipo del import es correcto, solo el
  valor en runtime está vacío). **Fix aplicado:** duplicar el mapeo
  localmente en el Server Component en vez de importarlo (mismo criterio
  que ya se usa para `SubnavMiNegocio`/`CAMPOS_BOOLEANOS`, copiados por
  archivo en toda esta carpeta). **Regla general para cualquier pantalla
  nueva de Server Component en este proyecto:** si necesitás una constante
  que hoy vive en un archivo `"use client"`, no la importes — duplicala o
  movela a un archivo sin directiva.
- **La Ficha de Tenant de `/admin` ahora también muestra el nombre del plan
  vigente en su grid de datos** (antes solo aparecía transitoriamente
  dentro del Dialog "Cambiar Plan"). El selector del Dialog solo lista
  planes `activo=true` (más el plan actual del tenant si ese quedó
  desactivado, para que el Select nunca quede vacío) — el campo de
  visualización del grid, en cambio, busca contra el catálogo completo
  (`listarPlanes()` sin `soloActivos`), porque un tenant puede seguir en un
  plan que ya se desactivó y la ficha tiene que poder mostrar su nombre
  igual.

## Última actualización: 2026-07-21 — Etapa 4.a del backstop de RLS: `solicitanteGateway()`
rediseñada de objeto sintético a fila real y acotada (`GATEWAY_SISTEMA_USUARIO_ID`, rol propio,
`tienePermiso()` con rama allowlist dedicada). Ver `docs/security/PLAN-RLS-BACKSTOP.md` §13/§15.
Actualización previa el 2026-07-20 — Banner de estado del tenant construido en `AppShell`, cierra por completo la UI de este módulo (cero pendientes). Confirmado explícitamente que el bloqueo real de crear/editar en `solo_lectura`/`bloqueado` ya lo hacía `tienePermiso()` desde antes — el banner es señal visual, no control. Actualización previa el mismo día: "Mi Plan" (`/app/mi-negocio/plan`) construida, sin gap de backend, y bug real de RSC/`"use client"` encontrado y corregido (ver Decisiones). Actualización previa el 2026-07-18: Cierre de Gestión de Tenants (UI de Alta/Listado/Ficha de Tenant en `/admin` con panel Cambiar Plan/Cambiar Estado de Suscripción, verificado end-to-end incluida la invitación real por email confirmada vía Admin API) y, antes de eso, gap de backend cerrado (`cambiarPlanTenant`/`cambiarEstadoSuscripcion`) y Colaboradores/Roles/Capacidades Especiales + bug real corregido: `tieneCapacidadEspecial()` ahora bypassea al Owner incondicionalmente (Modulo_01 sección 6.2)
