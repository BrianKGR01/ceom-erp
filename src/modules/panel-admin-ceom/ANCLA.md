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
  no audita), `consultarTenantDetalle`, `consultarFinancieroTenant`,
  `consultarOperativoTenant`, `consultarInventarioOperativoTenant` (estas
  últimas 3 auditan la lectura vía `registrarAccesoAdminCeom`).

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
- [ ] `consultarTenantDetalle` **no llama a `registrarAccesoAdminCeom()`**
      — "identidad" no es un valor de `moduloPermisoEnum` (no es un módulo
      gestionable, ver `identidad/ANCLA.md`), no hay categoría de log para
      metadata básica de tenant. No inventar un valor de enum solo para
      esto sin decidirlo explícitamente aparte.
- [ ] `consultarInventarioOperativoTenant` audita con
      `moduloConsultado: "operativo"` (no `"inventario_operativo"`) —
      `moduloPermisoEnum` no distingue insumos de producción, ambos viven
      bajo el mismo permiso interno `"operativo"`. Solo `moduloVeedorEnum`
      (Gateway) hace esa distinción, es un enum aparte.
- [ ] No hay UI — 100% `actions.ts`, sin pantallas.

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

## Última actualización: 2026-07-14 — implementación inicial (Fase 1, roadmap ítem #11, módulo 2 de 2)
