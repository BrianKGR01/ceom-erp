# ANCLA — Módulo: Monitoreo Institucional

## Contrato (no romper sin actualizar este archivo)
- Responsabilidad: es la vista de consumo para una Institución externa
  (Módulo_11 sección 3.3) — compone datos ya expuestos por Financiero,
  Ventas, Operativo Nicho 1 e Identidad, siempre detrás de
  `tieneConsentimiento()` (el Gateway, Módulo 10). No tiene tablas propias.
- NO hace: no decide permisos por su cuenta (esa lógica vive 100% en
  `tieneConsentimiento()`, este módulo solo la consulta antes de componer
  cada respuesta). No implementa el login/autenticación de la Institución en
  el futuro Portal de Entidades Veedoras — fuera de este alcance.
- Entradas que consume: `listarCarteraPropia()`, `tieneConsentimiento()`
  (Gateway, `consentimiento/actions.ts`, **la primera es nueva en esta
  tarea**), `obtenerTenantParaVeedor()`, `solicitanteGateway()` (Identidad,
  **ambas nuevas en esta tarea**), `flujoCaja`/`estadoResultados`/
  `costoFijoTotal` (Financiero), `consultarIngresosPeriodo` (Ventas),
  `listarProducciones`/`consultarMermaPeriodo`/`listarInsumos` (Operativo
  Nicho 1).
- Salidas que expone (`actions.ts`): `listarCartera`, `estadoTenant`
  (sin gate de módulo veedor — metadato de la relación de cartera),
  `tendenciaVentas`, `detalleFinanciero`, `detalleOperativo`,
  `detalleInventarioOperativo` (las últimas 4 gateadas por
  `tieneConsentimiento()`, devuelven `{autorizado:false}` sin filtrar nada
  si no está aprobado).

## Estado actual
- [x] `actions.ts` con las 6 funciones del contrato, sin `schema.ts` ni
      `repository.ts` (mismo criterio que Financiero — compone, no
      almacena).
- [x] Ninguna función recibe `solicitante: UsuarioConRol` — la Institución
      externa no tiene cuenta CEOM. Todas reciben `institucionId` directo
      (mismo criterio ya usado en `tieneConsentimiento()`/
      `canjearCodigoAcceso()` del Gateway).
- [x] Tests: `monitoreo-institucional.test.ts` (integración contra Supabase
      Cloud real, 6 casos: sin aprobación, solo financiero, solo
      operativo+inventario_operativo, revocación inmediata, tenant
      bloqueado, institución sin cartera).
- [ ] `detalleOperativo` **no incluye** `consultarCapacidadProduccionUsada`
      — necesita un `activoId` que el veedor no tiene forma de descubrir
      hoy (Patrimonio no está expuesto a ningún módulo veedor, no está en
      `moduloVeedorEnum`). Documentado, no silencioso.
- [ ] `detalleInventarioOperativo` **no incluye** `consultarStockInsumo`
      (solo `listarInsumos`, catálogo + costo vigente) — necesita
      `insumoId` + `sucursalId`, y no hay hoy una función veedor-segura
      para enumerar sucursales de un tenant.
- [ ] `detalleFinanciero` **no incluye** `margenPorProducto` — necesita
      `productoId`, mismo motivo (no hay listado de productos
      veedor-seguro todavía).
- [ ] No hay UI ni Portal de Entidades Veedoras — 100% `actions.ts`, sin
      pantallas.

## Cambios de contrato en otros 2 módulos
- **Identidad** (`src/modules/identidad/actions.ts`):
  - `obtenerTenantParaVeedor(tenantId)` — sin `solicitante`, mismo criterio
    que `obtenerEstadoAccesoTenant()` (Módulo 10): expone nombre/nicho/
    plan/estado_acceso mínimos, nunca el resto del Tenant.
  - `solicitanteGateway()` — **decisión de diseño confirmada explícitamente
    con el usuario antes de implementar**: arma un `UsuarioConRol`
    SINTÉTICO (`rolId=ROL_CEOM_ADMIN_ID`, sin fila de usuario real detrás)
    para que este módulo pueda "prestar" el bypass cross-tenant que
    `tienePermiso()` ya le da a `ceom_admin` y así llamar a los
    `actions.ts` de solo lectura de Financiero/Ventas/Operativo sin violar
    la caja negra. Se usa **únicamente** después de que
    `tieneConsentimiento()` ya devolvió `true`, y **únicamente** para
    lecturas (nunca para escrituras, nunca expuesto a input externo). Ver
    `identidad/ANCLA.md` para el detalle completo.
- **Gateway de Consentimiento** (`src/modules/consentimiento/actions.ts`):
  `listarCarteraPropia(institucionId)` — variante sin gate de
  `ceom_admin` de `listarCarteraPorInstitucion()` ya existente, para que la
  propia Institución liste su cartera (descubierto necesario recién al
  implementar este módulo — `listarCarteraPorInstitucion()` original está
  gateada a CEOM Admin, no sirve para una Institución externa).

## Dónde está cada cosa
- Server actions (todo el módulo — no hay `schema.ts` ni `repository.ts`):
  `src/modules/monitoreo-institucional/actions.ts`
- Tests: `src/modules/monitoreo-institucional/monitoreo-institucional.test.ts`
- Sin migración — este módulo no agrega tablas.

## Decisiones tomadas que un agente no debe revertir
- **`solicitanteGateway()` es un objeto sintético, no una fila de usuario
  real** — no intentar "arreglar" esto creando un usuario de sistema real
  en la base de datos; es intencional, documentado, y acotado a lecturas
  mediadas por `tieneConsentimiento()`. Ver el comentario en
  `identidad/actions.ts` junto a la función.
- **`estadoTenant`/`listarCartera` no pasan por `tieneConsentimiento()`** —
  a propósito: estar en la Cartera Institucional es una relación que la
  propia Institución ya conoce (fue CEOM Admin quien la dio de alta, o
  nació de un Código de Acceso canjeado), no es "dato de negocio fino" del
  tenant. Regla 1 del Módulo 11 ("nada sin aprobación explícita") aplica a
  Financiero/Operativo/Inventario Operativo, no a la metadata de la
  relación misma.
- **Todas las funciones gateadas devuelven `{ok:true, data:{autorizado:
  false}}`**, nunca `{ok:false, error:...}`, cuando el módulo veedor no fue
  aprobado — no es un error, es un estado legítimo que la UI debe poder
  distinguir de una falla real.

## Última actualización: 2026-07-14 — implementación inicial (Fase 1, roadmap ítem #11, módulo 1 de 2)
