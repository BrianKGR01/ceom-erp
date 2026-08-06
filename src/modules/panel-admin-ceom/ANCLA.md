# ANCLA — Módulo: Panel Admin CEOM

## Contrato (no romper sin actualizar este archivo)
- Responsabilidad: es la vista de consumo para `ceom_admin` (Módulo_11
  secciones 2 y 4) — compone datos ya expuestos por Identidad, Financiero y
  Operativo Nicho 1, y audita cada lectura de un tenant puntual vía
  `registrarAccesoAdminCeom()`. No tiene tablas propias.
- NO hace: no pasa por el Gateway de Consentimiento (regla 4, sección 5 del
  Módulo 11: el acceso del equipo CEOM no requiere aprobación del tenant, es
  parte de los Términos de Servicio). No implementa % onboarding completado
  ni % retención (sección 2.2) — no hay datos reales para ninguno de los
  dos todavía, ver pendientes abajo. No implementa gestión de Tenants/Planes
  (crear/editar) — eso ya existe en Identidad (`crearTenant`, etc.) y
  Suscripción (`crearPlan`, etc.), este panel no los duplica.
- Entradas que consume: `listarTenants()`, `calcularEstadoAcceso()`,
  `obtenerTenantPorId()` (Identidad, **la primera es nueva en esta
  tarea**), `registrarAccesoAdminCeom()` (Gateway, ya existía pero sin
  caller real hasta ahora), `listarPlanes()` (Suscripción, ya existía),
  `flujoCaja`/`estadoResultados`/`costoFijoTotal` (Financiero),
  `listarProducciones`/`consultarMermaPeriodo`/`listarInsumos` (Operativo
  Nicho 1).
- Salidas que expone (`actions.ts`): `saludAgregadaPlataforma` (cross-tenant,
  **no audita** — a propósito, ver decisiones), y **4 lecturas de un tenant
  puntual que SÍ auditan** vía `registrarAccesoAdminCeom`:
  `consultarTenantDetalle` (`moduloConsultado: "identidad"`),
  `consultarFinancieroTenant` (`"financiero"`), `consultarOperativoTenant`
  (`"operativo"`) y `consultarInventarioOperativoTenant` (`"operativo"`,
  no `"inventario_operativo"` — ver estado).

## Estado actual
- [x] `actions.ts` con las 5 funciones del contrato, sin `schema.ts` ni
      `repository.ts`. Gate propio `requiereCeomAdmin()` (mismo criterio
      que `consentimiento/actions.ts`: "panel-admin-ceom" tampoco es un
      módulo de `modulo_permiso`, se chequea el rol directo).
- [x] `saludAgregadaPlataforma` cuenta tenants por `estado_acceso`
      (reutiliza `calcularEstadoAcceso()`, pura, sin duplicar lógica) y
      agrupa por plan/nicho.
- [x] `consultarFinancieroTenant`/`consultarOperativoTenant`/
      `consultarInventarioOperativoTenant` **cierran el hook pendiente**
      documentado en `consentimiento/ANCLA.md` desde Módulo 10: son las
      primeras llamadas reales a `registrarAccesoAdminCeom()` en todo el
      proyecto. Acotado a las lecturas de este módulo — el hook automático
      desde el resto de los módulos (tocar `tienePermiso()` de cada uno)
      sigue sin resolver, ver `consentimiento/ANCLA.md`.
- [x] Tests: `panel-admin-ceom.test.ts` (integración contra Supabase Cloud
      real, 4 casos: salud agregada con ceom_admin, rechazo a usuario
      normal, lectura+log de un tenant ajeno, rechazo sin log a usuario
      normal sobre tenant ajeno).
- [ ] `% onboarding completado` / `% retención` (Módulo_11 sección 2.2) —
      **no implementados**, decisión ya confirmada: no hay checklist de
      onboarding (`identidad/ANCLA.md` ya lo marca pendiente) ni definición
      de qué es "retención" en este proyecto. Cuando se construyan, van
      acá, no en Identidad.
- [x] `consultarTenantDetalle` **SÍ llama a `registrarAccesoAdminCeom()`**,
      con `moduloConsultado: "identidad"` (`actions.ts:123`).
      ⚠️ **Corrección de este ANCLA (2026-08-06, R-2.2).** Hasta hoy este
      archivo decía lo contrario —"no llama", "no inventar un valor de enum
      solo para esto sin decidirlo explícitamente aparte"— y **el código
      hacía justo eso**. Era el único ANCLA del proyecto que contradecía a su
      módulo, no que se le quedaba corto: un agente que leyera el contrato
      antes de tocar el código habría concluido que las lecturas de metadata
      de tenant no dejan traza, y son las únicas que sí la dejan por defecto.
      La decisión efectiva (agregar `identidad` como categoría de log) quedó
      tomada en el código sin registrarse; se registra ahora tal cual está.
- [ ] `consultarInventarioOperativoTenant` audita con
      `moduloConsultado: "operativo"` (no `"inventario_operativo"`) —
      `moduloPermisoEnum` no distingue insumos de producción, ambos viven
      bajo el mismo permiso interno `"operativo"`. Solo `moduloVeedorEnum`
      (Gateway) hace esa distinción, es un enum aparte.
- [x] UI construida (2026-07-18): `/admin/tenants` — listado con salud
      agregada + Ficha de Tenant (`/admin/tenants/[tenantId]`) con 3 tabs
      auditados (Financiero/Operativo/Inventario Operativo). Nav item
      "Tenants" agregado a `admin-shell.tsx`. Sin candado/"no autorizado" en
      esta superficie a propósito — `ceom_admin` no pasa por
      `tieneConsentimiento()`, ver `docs/ui/pantallas.md` sección 11.

## Defecto abierto conocido — re-proyección a mano (reglas #9/#10 de `CLAUDE.md`)

- [ ] 🔴 **`consultarFinancieroTenant` re-proyecta a mano y descarta los
      marcadores de completitud.** `actions.ts:148-155` elige tres escalares
      del resultado de `estadoResultados()` (`flujoCaja`, `estadoResultados`,
      `costoFijoTotal`) y tira todo lo demás — incluido
      `ingresosSinCostoConocido`. El equipo CEOM ve un estado de resultados
      presentado como completo sin serlo, que es **el gemelo exacto de X-01**
      en la otra superficie de terceros. `CLAUDE.md` nombra al Panel Admin
      CEOM explícitamente en las reglas #9 y #10.
      **El arreglo ya existe y está probado en el portal institucional:**
      `src/lib/proyeccion-institucional.ts` (`proyectar()` + la lista de
      marcadores que exporta el módulo dueño, D-10/X-03). Acá hay que
      reutilizarlo, no diseñar nada.
- [ ] Mismo bloque: la Ficha de Tenant conserva el patrón G-15 (cualquier
      error deja la pestaña en "Cargando…" eterno) y no distingue
      `modulo_no_aplica` (G-14) — un tenant de nicho 4 muestra "Sin
      producciones" en vez de "este negocio no usa este módulo". Las tres
      cosas se cierran juntas en **R-3.7** del roadmap.

## Cambio de contrato en Identidad
- `listarTenants(solicitante)` — listado cross-tenant completo, gateado a
  `ceom_admin` directo (mismo criterio que el bypass ya existente de
  `tienePermiso()` para ese rol). Ver `identidad/ANCLA.md`.

## Dónde está cada cosa
- Server actions (todo el módulo — no hay `schema.ts` ni `repository.ts`):
  `src/modules/panel-admin-ceom/actions.ts`
- Tests: `src/modules/panel-admin-ceom/panel-admin-ceom.test.ts`
- Sin migración — este módulo no agrega tablas.

## Decisiones tomadas que un agente no debe revertir
- **Todas las funciones reciben `solicitante: UsuarioConRol` real** (no un
  `{rolId}` mínimo como en `consentimiento/actions.ts`) — a diferencia del
  Gateway, este módulo SÍ necesita reenviar el solicitante completo a
  Financiero/Operativo (que gatean vía `tienePermiso()`, requieren el
  objeto completo con `.rol.esRolSistema`). El bypass cross-tenant de
  `ceom_admin` en `tienePermiso()` (ya existente, `identidad/actions.ts`)
  es lo que permite que este panel lea cualquier tenant sin más mecanismo
  nuevo.
- **`saludAgregadaPlataforma` no audita** — es agregado cross-tenant, no
  "acceso a un tenant puntual" (regla 5 del Módulo 11 habla de eso). No
  agregar logging acá "por consistencia" sin decidirlo aparte.
- El fixture de test `ceomAdmin` es un `UsuarioConRol` sintético en memoria
  (mismo patrón ya usado en `identidad.test.ts`, caso "crearTenant rechaza
  plan_id inexistente") — no hay un usuario CEOM Admin real sembrado en
  ningún entorno todavía.

## Última actualización: 2026-08-06 — R-2.2 (reconciliación documental)
Se corrigió la única contradicción ANCLA↔código del proyecto (`consultarTenantDetalle` **sí**
audita) y se registró el defecto abierto de re-proyección a mano, que hasta hoy no figuraba en
ningún archivo de este módulo. No cambió código.

Actualización previa el 2026-07-18 — UI construida (Tenants con salud agregada, `/admin`)
