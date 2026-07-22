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
- [x] UI construida (2026-07-18): `/portal` — Mi Cartera (`src/app/portal/`)
      + Ficha de Tenant con 4 tabs (`src/app/portal/cartera/[tenantId]/`),
      una sola pantalla con tabs de cliente. Los tabs no autorizados
      muestran candado + mensaje explícito "No autorizado", nunca se
      ocultan ni se ven como sección vacía — implementa directo la regla de
      `ConAutorizacion<T>` de este archivo. Ver `docs/ui/pantallas.md`
      sección 11 para el detalle completo de campos por pantalla.
- [x] **Verificado en vivo (2026-07-18, navegador real, no solo el test de
      integración):** con la Ficha de Tenant abierta y el tab Financiero
      autorizado, se revocó el consentimiento desde `/app/consentimiento/
      aprobaciones` (lado Owner) mientras la Institución tenía esa pantalla
      abierta. Al recargar, el tab pasó a candado/"No autorizado" sin
      quedarse con datos viejos ni romperse — confirma que la propiedad de
      privacidad central del módulo se sostiene end-to-end (UI incluida),
      no solo a nivel de `tieneConsentimiento()` aislado.

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
- **Principio (2026-07-18, sigue vigente): el Gateway es un lector acotado
  y revocable, no un admin** — `solicitanteGateway()` nunca debe tener más
  alcance que "leer, en los 4 caminos que ya usa, después de que
  `tieneConsentimiento()` ya autorizó". Esto no se revierte. **El mecanismo
  que lo implementaba (objeto 100% sintético en memoria) sí cambió el
  2026-07-21**: dejó de alcanzar en cuanto un módulo que el Gateway alcanza
  (Proveedores, vía Financiero) migró a `comoUsuario()` — un objeto sin
  fila real no resuelve RLS de forma consistente ahí (diagnóstico completo:
  docs/security/PLAN-RLS-BACKSTOP.md §9.6, §10.4, §13). La Etapa 4.a de ese
  plan sembró una fila real, pero con un bypass de RLS propio y de solo
  lectura (`es_gateway_sistema()`, no `es_ceom_admin()`) — precisamente
  para no traicionar este principio; reusar el bypass de `ceom_admin` tal
  cual sí lo hubiera hecho (heredaría escritura y cualquier bypass futuro
  de `ceom_admin`, sin relación con lo que el Gateway realmente necesita).
  Ver el comentario en `identidad/actions.ts` junto a la función y
  `identidad/ANCLA.md` para el detalle completo.
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

## Última actualización: 2026-07-21 — Etapa 4.a del backstop de RLS: `solicitanteGateway()`
(Identidad) dejó de ser un objeto sintético — ver `identidad/ANCLA.md` y
`docs/security/PLAN-RLS-BACKSTOP.md` §13/§15 para el detalle completo. Este módulo no cambió
código propio (sigue llamando a `solicitanteGateway()` igual que antes); el rediseño vive
enteramente en Identidad + las policies de RLS de cada módulo alcanzado.

Actualización previa el 2026-07-18 — UI construida (Mi Cartera + Ficha de Tenant, `/portal`)
