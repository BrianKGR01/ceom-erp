/**
 * Manifiesto de acceso — CEOM-ERP (docs/security/AUDITORIA-AUTORIZACION.md §8.3).
 *
 * Declara el nivel de acceso ESPERADO de cada función exportada de un archivo
 * `"use server"` (Server Action = endpoint invocable directo por el cliente).
 * `access-manifest.test.ts` enumera por AST todas esas funciones y falla el
 * build si alguna no está acá — agregar un endpoint nuevo sin clasificarlo
 * rompe la suite, no pasa desapercibido.
 *
 * Cómo agregar una entrada (ver README.md de esta carpeta para más detalle):
 * 1. `pnpm test access-manifest` — el test lista las funciones sin clasificar.
 * 2. Agregá la clave `"<ruta-relativa-desde-src>::<nombreFuncion>"` acá.
 * 3. Elegí `nivel` según la tabla de abajo; `verificacion: "estatica"` si el
 *    test puede confirmarlo solo, `"manual"` + `nota` si no.
 *
 * Prioridad de clasificación cuando una función combina varios criterios
 * (ej. exige Owner Y además ata un id foráneo al tenant): gana el más
 * específico sobre autorización cross-tenant, en este orden:
 *   ceom_admin > por-recurso > owner > autenticado > publico
 * "por-recurso" se antepone a "owner" a propósito: es la categoría que este
 * manifiesto existe para vigilar (la clase de bug de UI-044 y las 24 fugas
 * del barrido), así que un id foráneo mal atado importa más que quién más
 * podía llamar la función.
 */

export type NivelAcceso = "publico" | "autenticado" | "owner" | "ceom_admin" | "por-recurso";

export interface EntradaManifiesto {
  /**
   * - publico: no requiere sesión (login, magic link, canjear código).
   * - autenticado: solo requiere sesión válida; opera sobre el tenant propio
   *   del caller (usuario.tenantId server-derived), sin id de recurso ajeno.
   * - owner: requiere solicitante.esOwner en algún punto de la cadena.
   * - ceom_admin: requiere el rol ceom_admin en algún punto de la cadena.
   * - por-recurso: recibe un id de recurso controlado por el cliente (no el
   *   tenantId propio) que debe atarse al tenant/permiso del solicitante
   *   antes de usarlo — vía recursoPerteneceAlTenant() o
   *   tienePermiso(solicitante, recurso.tenantId, …).
   */
  nivel: NivelAcceso;
  /**
   * "estatica": el test puede confirmar el nivel buscando el guard esperado
   * en el cuerpo de la función o de la función de módulo a la que delega
   * (1 salto de resolución de imports/helpers locales).
   * "manual": el análisis estático no alcanza (lógica indirecta) o el nivel
   * declarado documenta un hueco YA conocido y no corregido en este alcance
   * — en ambos casos requiere `nota`.
   */
  verificacion: "estatica" | "manual";
  nota?: string;
}

// Clave: "<ruta-relativa-desde-src, con /, incluye extensión>::<nombreFuncion>"
export const ACCESS_MANIFEST: Record<string, EntradaManifiesto> = {
  // --- app/(auth)/login/actions.ts ---------------------------------------
  "app/(auth)/login/actions.ts::iniciarSesion": {
    nivel: "publico",
    verificacion: "estatica",
    nota: "Pre-auth por definición — valida email/password contra Supabase Auth.",
  },

  // --- app/app/definir-contrasena/actions.ts ------------------------------
  "app/app/definir-contrasena/actions.ts::definirContrasena": {
    nivel: "autenticado",
    verificacion: "estatica",
    nota: "Opera solo sobre el auth.user de la propia sesion (updateUser); no recibe ningun id de recurso. La prueba de identidad es el token de correo que ya canjeo /app/auth/callback.",
  },

  // --- lib/supabase/actions.ts --------------------------------------------
  "lib/supabase/actions.ts::cerrarSesion": {
    nivel: "publico",
    verificacion: "estatica",
    nota: "Logout — no exige sesión previa a propósito (llamarlo sin sesión es inofensivo).",
  },

  // --- app/app/onboarding/actions.ts ---------------------------------------
  "app/app/onboarding/actions.ts::subirLogoAction": { nivel: "owner", verificacion: "estatica" },
  "app/app/onboarding/actions.ts::guardarNegocio": { nivel: "owner", verificacion: "estatica" },
  "app/app/onboarding/actions.ts::elegirRubro": { nivel: "owner", verificacion: "estatica" },
  "app/app/onboarding/actions.ts::finalizarOnboarding": { nivel: "owner", verificacion: "estatica" },

  // --- app/app/(shell)/mi-negocio/actions.ts -------------------------------
  "app/app/(shell)/mi-negocio/actions.ts::listarUsuariosAction": { nivel: "owner", verificacion: "estatica" },
  "app/app/(shell)/mi-negocio/actions.ts::invitarColaboradorAction": { nivel: "owner", verificacion: "estatica" },
  "app/app/(shell)/mi-negocio/actions.ts::editarColaboradorAction": {
    nivel: "por-recurso",
    verificacion: "estatica",
    nota: "usuarioId — fix del barrido (recursoPerteneceAlTenant), además exige esOwner.",
  },
  "app/app/(shell)/mi-negocio/actions.ts::suspenderColaboradorAction": {
    nivel: "por-recurso",
    verificacion: "estatica",
    nota: "usuarioId — fix del barrido, además exige esOwner.",
  },
  "app/app/(shell)/mi-negocio/actions.ts::reactivarColaboradorAction": {
    nivel: "por-recurso",
    verificacion: "estatica",
    nota: "usuarioId — fix del barrido, además exige esOwner.",
  },
  "app/app/(shell)/mi-negocio/actions.ts::transferirOwnerAction": {
    nivel: "por-recurso",
    verificacion: "estatica",
    nota: "nuevoOwnerUsuarioId — ya validaba destino.tenantId === solicitante.tenantId antes del barrido.",
  },
  "app/app/(shell)/mi-negocio/actions.ts::listarRolesAction": { nivel: "owner", verificacion: "estatica" },
  "app/app/(shell)/mi-negocio/actions.ts::listarPermisosPorRolAction": {
    nivel: "por-recurso",
    verificacion: "estatica",
    nota: "rolId — ya validaba rol.tenantId antes del barrido.",
  },
  "app/app/(shell)/mi-negocio/actions.ts::crearRolAction": { nivel: "owner", verificacion: "estatica" },
  "app/app/(shell)/mi-negocio/actions.ts::actualizarPermisosRolAction": {
    nivel: "por-recurso",
    verificacion: "estatica",
    nota: "rolId — fix del barrido (recursoPerteneceAlTenant), además exige esOwner.",
  },
  "app/app/(shell)/mi-negocio/actions.ts::eliminarRolAction": {
    nivel: "por-recurso",
    verificacion: "estatica",
    nota: "rolId — fix del barrido, además exige esOwner.",
  },
  "app/app/(shell)/mi-negocio/actions.ts::listarCapacidadesEspecialesAction": { nivel: "owner", verificacion: "estatica" },
  "app/app/(shell)/mi-negocio/actions.ts::otorgarCapacidadEspecialPorRolAction": {
    nivel: "por-recurso",
    verificacion: "estatica",
    nota: "rolId — fix del barrido, además exige esOwner.",
  },
  "app/app/(shell)/mi-negocio/actions.ts::otorgarCapacidadEspecialPorUsuarioAction": {
    nivel: "por-recurso",
    verificacion: "estatica",
    nota: "usuarioId — fix del barrido, además exige esOwner.",
  },
  "app/app/(shell)/mi-negocio/actions.ts::obtenerMiPlanAction": {
    nivel: "owner",
    verificacion: "estatica",
    nota: "Fix de UI-044 — antes sin gate.",
  },

  // --- app/app/(shell)/ventas/actions.ts -----------------------------------
  "app/app/(shell)/ventas/actions.ts::registrarVentaAction": {
    nivel: "por-recurso",
    verificacion: "estatica",
    nota: "input.sucursalId — fix 2026-07-21: registrarVenta valida ahora que la sucursal pertenece al tenant (listarSucursalesPorTenant + chequeo de membresía) antes de crear la Venta. Antes no se revalidaba (mismo patrón Medio ya documentado para Patrimonio).",
  },
  "app/app/(shell)/ventas/actions.ts::crearCanalVentaAction": { nivel: "autenticado", verificacion: "estatica" },
  "app/app/(shell)/ventas/actions.ts::actualizarCanalVentaAction": { nivel: "por-recurso", verificacion: "estatica" },
  "app/app/(shell)/ventas/actions.ts::toggleCanalVentaActivoAction": { nivel: "por-recurso", verificacion: "estatica" },
  "app/app/(shell)/ventas/actions.ts::eliminarCanalVentaAction": { nivel: "por-recurso", verificacion: "estatica" },
  "app/app/(shell)/ventas/actions.ts::crearMetodoPagoAction": { nivel: "autenticado", verificacion: "estatica" },
  "app/app/(shell)/ventas/actions.ts::actualizarMetodoPagoAction": { nivel: "por-recurso", verificacion: "estatica" },
  "app/app/(shell)/ventas/actions.ts::toggleMetodoPagoActivoAction": { nivel: "por-recurso", verificacion: "estatica" },
  "app/app/(shell)/ventas/actions.ts::crearClienteAction": { nivel: "autenticado", verificacion: "estatica" },
  "app/app/(shell)/ventas/actions.ts::actualizarClienteAction": { nivel: "por-recurso", verificacion: "estatica" },
  "app/app/(shell)/ventas/actions.ts::eliminarClienteAction": { nivel: "por-recurso", verificacion: "estatica" },
  "app/app/(shell)/ventas/actions.ts::registrarPagoVentaAction": { nivel: "por-recurso", verificacion: "estatica" },
  "app/app/(shell)/ventas/actions.ts::registrarAjusteVentaAction": { nivel: "por-recurso", verificacion: "estatica" },
  "app/app/(shell)/ventas/actions.ts::abrirEventoAction": {
    nivel: "por-recurso",
    verificacion: "estatica",
    nota: "tenantId elegido — fix del barrido (recursoPerteneceAlTenant, la capacidad gestionar_eventos es tenant-ciega).",
  },
  "app/app/(shell)/ventas/actions.ts::actualizarComisionEventoAction": {
    nivel: "por-recurso",
    verificacion: "estatica",
    nota: "eventoId — fix del barrido.",
  },
  "app/app/(shell)/ventas/actions.ts::cerrarEventoAction": {
    nivel: "por-recurso",
    verificacion: "estatica",
    nota: "eventoId — fix del barrido.",
  },
  "app/app/(shell)/ventas/actions.ts::reabrirEventoAction": {
    nivel: "por-recurso",
    verificacion: "estatica",
    nota: "eventoId — fix del barrido.",
  },
  "app/app/(shell)/ventas/actions.ts::importarVentaHistoricaLoteAction": {
    nivel: "owner",
    verificacion: "estatica",
    nota: "esOwner O capacidad especial importar_historico (tenantId propio, sin id foráneo).",
  },

  // --- app/app/(shell)/productos/actions.ts --------------------------------
  "app/app/(shell)/productos/actions.ts::subirImagenProductoAction": {
    nivel: "autenticado",
    verificacion: "estatica",
    nota: "tienePermiso directo en el thin sobre el tenant propio; productoIdExistente (opcional) se resuelve vía fichaProducto, que sí gatea por recurso.",
  },
  "app/app/(shell)/productos/actions.ts::crearProductoAction": { nivel: "autenticado", verificacion: "estatica" },
  "app/app/(shell)/productos/actions.ts::actualizarProductoAction": { nivel: "por-recurso", verificacion: "estatica" },
  "app/app/(shell)/productos/actions.ts::eliminarProductoAction": { nivel: "por-recurso", verificacion: "estatica" },
  "app/app/(shell)/productos/actions.ts::ajustarStockAction": {
    nivel: "por-recurso",
    verificacion: "estatica",
    nota: "fix del barrido (requireProductoDelTenant).",
  },
  "app/app/(shell)/productos/actions.ts::listarMovimientosStockAction": { nivel: "por-recurso", verificacion: "estatica" },
  "app/app/(shell)/productos/actions.ts::transferirStockAction": {
    nivel: "por-recurso",
    verificacion: "estatica",
    nota: "fix del barrido (requireProductoDelTenant).",
  },
  "app/app/(shell)/productos/actions.ts::crearCategoriaAction": { nivel: "autenticado", verificacion: "estatica" },
  "app/app/(shell)/productos/actions.ts::actualizarCategoriaAction": { nivel: "por-recurso", verificacion: "estatica" },
  "app/app/(shell)/productos/actions.ts::eliminarCategoriaAction": { nivel: "por-recurso", verificacion: "estatica" },
  "app/app/(shell)/productos/actions.ts::vincularProductoARecetaAction": {
    nivel: "por-recurso",
    verificacion: "estatica",
    nota: "recetaId — fix del barrido en Nicho-1 (receta.tenantId).",
  },
  "app/app/(shell)/productos/actions.ts::desvincularProductoDeRecetaAction": { nivel: "por-recurso", verificacion: "estatica" },

  // --- app/app/(shell)/proveedores/actions.ts ------------------------------
  "app/app/(shell)/proveedores/actions.ts::crearProveedorAction": { nivel: "autenticado", verificacion: "estatica" },
  "app/app/(shell)/proveedores/actions.ts::actualizarProveedorAction": { nivel: "por-recurso", verificacion: "estatica" },
  "app/app/(shell)/proveedores/actions.ts::eliminarProveedorAction": { nivel: "por-recurso", verificacion: "estatica" },
  "app/app/(shell)/proveedores/actions.ts::registrarCompraAction": {
    nivel: "autenticado",
    verificacion: "estatica",
    nota: "tienePermiso sobre el tenant propio; proveedorId validado (fix del barrido); insumoId/productoId validados aguas abajo al recibir la compra (entrada de stock ya atada al tenant).",
  },
  "app/app/(shell)/proveedores/actions.ts::recibirCompraAction": { nivel: "por-recurso", verificacion: "estatica" },
  "app/app/(shell)/proveedores/actions.ts::consultarSaldoCompraAction": { nivel: "por-recurso", verificacion: "estatica" },
  "app/app/(shell)/proveedores/actions.ts::registrarPagoCompraAction": { nivel: "por-recurso", verificacion: "estatica" },
  "app/app/(shell)/proveedores/actions.ts::registrarCompraDeAjusteAction": { nivel: "por-recurso", verificacion: "estatica" },

  // --- app/app/(shell)/consentimiento/actions.ts ---------------------------
  "app/app/(shell)/consentimiento/actions.ts::obtenerModulosPermitidosAction": { nivel: "autenticado", verificacion: "estatica" },
  "app/app/(shell)/consentimiento/actions.ts::generarCodigoAccesoAction": { nivel: "owner", verificacion: "estatica" },
  "app/app/(shell)/consentimiento/actions.ts::listarCodigosAccesoAction": { nivel: "owner", verificacion: "estatica" },
  "app/app/(shell)/consentimiento/actions.ts::revocarCodigoAccesoAction": {
    nivel: "por-recurso",
    verificacion: "estatica",
    nota: "codigoAccesoId — requiereOwnerDelTenant(solicitante, fila.tenantId).",
  },
  "app/app/(shell)/consentimiento/actions.ts::consultarAprobacionesPorTenantAction": {
    nivel: "autenticado",
    verificacion: "estatica",
    nota: "Tenant propio; no exige esOwner (cualquier colaborador autenticado puede ver las aprobaciones de su propio tenant).",
  },
  "app/app/(shell)/consentimiento/actions.ts::revocarConsentimientoAction": {
    nivel: "por-recurso",
    verificacion: "estatica",
    nota: "aprobacionId — requiereOwnerDelTenant(solicitante, aprobacion.tenantId).",
  },
  "app/app/(shell)/consentimiento/actions.ts::listarSolicitudesPorTenantAction": {
    nivel: "autenticado",
    verificacion: "estatica",
    nota: "Tenant propio; no exige esOwner.",
  },
  "app/app/(shell)/consentimiento/actions.ts::aprobarSolicitudAction": {
    nivel: "por-recurso",
    verificacion: "estatica",
    nota: "solicitudId — requiereOwnerDelTenant(solicitante, solicitud.tenantId).",
  },
  "app/app/(shell)/consentimiento/actions.ts::obtenerInstitucionPorIdAction": {
    nivel: "autenticado",
    verificacion: "estatica",
    nota: "Fix 2026-07-21: le faltaba el chequeo obtenerUsuarioActual() presente en sus 9 hermanas — era invocable sin sesión. Corregido.",
  },
  "app/app/(shell)/consentimiento/actions.ts::rechazarSolicitudAction": {
    nivel: "por-recurso",
    verificacion: "estatica",
    nota: "solicitudId — requiereOwnerDelTenant(solicitante, solicitud.tenantId).",
  },

  // --- app/portal/actions.ts ------------------------------------------------
  "app/portal/actions.ts::canjearCodigoAccesoAction": { nivel: "publico", verificacion: "estatica" },
  "app/portal/actions.ts::listarCarteraAction": { nivel: "autenticado", verificacion: "estatica" },
  "app/portal/actions.ts::estadoTenantAction": {
    nivel: "por-recurso",
    verificacion: "estatica",
    nota: "tenantId ajeno — estaEnCartera(institucionId, tenantId) antes de leer nada.",
  },
  "app/portal/actions.ts::tendenciaVentasAction": {
    nivel: "por-recurso",
    verificacion: "estatica",
    nota: "tenantId ajeno — tieneConsentimiento() (Gateway) antes de leer nada.",
  },
  "app/portal/actions.ts::detalleFinancieroAction": { nivel: "por-recurso", verificacion: "estatica" },
  "app/portal/actions.ts::detalleOperativoAction": { nivel: "por-recurso", verificacion: "estatica" },
  "app/portal/actions.ts::detalleInventarioOperativoAction": { nivel: "por-recurso", verificacion: "estatica" },
  "app/portal/actions.ts::solicitarMagicLinkInstitucionAction": { nivel: "publico", verificacion: "estatica" },
  "app/portal/actions.ts::cerrarSesionInstitucionAction": { nivel: "publico", verificacion: "estatica" },

  // --- app/admin/(shell)/tenants/actions.ts --------------------------------
  "app/admin/(shell)/tenants/actions.ts::saludAgregadaPlataformaAction": { nivel: "ceom_admin", verificacion: "estatica" },
  "app/admin/(shell)/tenants/actions.ts::listarTenantsConEstadoAction": { nivel: "ceom_admin", verificacion: "estatica" },
  "app/admin/(shell)/tenants/actions.ts::consultarTenantDetalleAction": { nivel: "ceom_admin", verificacion: "estatica" },
  "app/admin/(shell)/tenants/actions.ts::consultarFinancieroTenantAction": { nivel: "ceom_admin", verificacion: "estatica" },
  "app/admin/(shell)/tenants/actions.ts::consultarOperativoTenantAction": { nivel: "ceom_admin", verificacion: "estatica" },
  "app/admin/(shell)/tenants/actions.ts::consultarInventarioOperativoTenantAction": { nivel: "ceom_admin", verificacion: "estatica" },
  "app/admin/(shell)/tenants/actions.ts::crearTenantAction": { nivel: "ceom_admin", verificacion: "estatica" },
  "app/admin/(shell)/tenants/actions.ts::cambiarPlanTenantAction": { nivel: "ceom_admin", verificacion: "estatica" },
  "app/admin/(shell)/tenants/actions.ts::cambiarEstadoSuscripcionAction": { nivel: "ceom_admin", verificacion: "estatica" },

  // --- app/app/(shell)/simulaciones/actions.ts ------------------------------
  "app/app/(shell)/simulaciones/actions.ts::simularPrecioAction": {
    nivel: "por-recurso",
    verificacion: "estatica",
    nota: "productoId — consultarCostoOperativo/consultarPrecioVenta (Productos) hacen fetch-then-check contra producto.tenantId.",
  },
  "app/app/(shell)/simulaciones/actions.ts::calcularPuntoEquilibrioAction": {
    nivel: "por-recurso",
    verificacion: "estatica",
    nota: "productoId — mismo patrón que simularPrecioAction.",
  },
  "app/app/(shell)/simulaciones/actions.ts::comparativoMultiSkuAction": { nivel: "autenticado", verificacion: "estatica" },
  "app/app/(shell)/simulaciones/actions.ts::obtenerConfiguracionAction": { nivel: "autenticado", verificacion: "estatica" },
  "app/app/(shell)/simulaciones/actions.ts::actualizarUmbralAlertaAction": { nivel: "autenticado", verificacion: "estatica" },
  "app/app/(shell)/simulaciones/actions.ts::listarSimulacionesAction": {
    nivel: "autenticado",
    verificacion: "estatica",
    nota: "productoId opcional es solo filtro AND'eado junto al tenantId propio en el repository — un id ajeno da resultado vacío, no fuga.",
  },
  "app/app/(shell)/simulaciones/actions.ts::margenPorProductoAction": {
    nivel: "autenticado",
    verificacion: "estatica",
    nota: "productoId usado solo como filtro junto al tenantId propio — mismo patrón que listarSimulacionesAction.",
  },
  "app/app/(shell)/simulaciones/actions.ts::obtenerDatosPreviaAction": {
    nivel: "por-recurso",
    verificacion: "estatica",
    nota: "productoId — consultarCostoOperativo/consultarPrecioVenta hacen fetch-then-check.",
  },

  // --- app/app/(shell)/reportes/actions.ts + inicio-actions.ts -------------
  "app/app/(shell)/reportes/actions.ts::obtenerEstadoResultadosAction": { nivel: "autenticado", verificacion: "estatica" },
  "app/app/(shell)/reportes/actions.ts::obtenerFlujoCajaAction": { nivel: "autenticado", verificacion: "estatica" },
  "app/app/(shell)/reportes/actions.ts::obtenerValorPatrimonialTotalAction": { nivel: "autenticado", verificacion: "estatica" },
  "app/app/(shell)/reportes/actions.ts::obtenerHistoricoVentasAction": { nivel: "autenticado", verificacion: "estatica" },
  "app/app/(shell)/reportes/actions.ts::obtenerMargenPorCanalYProductoAction": { nivel: "autenticado", verificacion: "estatica" },
  "app/app/(shell)/reportes/actions.ts::obtenerRankingProductosAction": {
    nivel: "autenticado",
    verificacion: "estatica",
    nota: "opts.canalVentaId es filtro, no un id que determine el tenant.",
  },
  "app/app/(shell)/inicio-actions.ts::obtenerDashboardAction": {
    nivel: "autenticado",
    verificacion: "estatica",
    nota: "Passthrough puro de construirDashboard (que resuelve y valida su propia sesión desde el fix del 2026-07-21).",
  },
  "app/app/(shell)/inicio-actions.ts::construirDashboard": {
    nivel: "autenticado",
    verificacion: "estatica",
    nota: "Fix CRÍTICO 2026-07-21 (ver docs/security/AUDITORIA-AUTORIZACION.md §8.3): recibía `usuario: UsuarioConRol` como parámetro. Se verificó empíricamente en .next/server/app/app/(shell)/page/server-reference-manifest.json que Next.js le asignaba un action ID real (idéntico al de obtenerDashboardAction/cerrarSesion en el mismo manifiesto) — invocable por POST directo con un `usuario` forjado (esOwner:true, tenantId de otro tenant), evadiendo tienePermiso() por completo. La suposición original de que 'solo la llama un Server Component' no aplicaba: Next.js asigna el action ID a toda función exportada de un archivo \"use server\", sin importar el caller. Corregido resolviendo `usuario` internamente vía obtenerUsuarioActual().",
  },
  "app/app/(shell)/inicio-actions.ts::obtenerCapacidadAlmacenamientoWidget": {
    nivel: "autenticado",
    verificacion: "estatica",
    nota: "Fix CRÍTICO 2026-07-21, mismo hallazgo y misma verificación empírica que construirDashboard (ver esa entrada) — corregido resolviendo `usuario` internamente.",
  },

  // --- app/app/(shell)/produccion/actions.ts (Operativo Nicho-1) -----------
  "app/app/(shell)/produccion/actions.ts::crearInsumoAction": { nivel: "autenticado", verificacion: "estatica" },
  "app/app/(shell)/produccion/actions.ts::actualizarInsumoAction": { nivel: "por-recurso", verificacion: "estatica" },
  "app/app/(shell)/produccion/actions.ts::eliminarInsumoAction": { nivel: "por-recurso", verificacion: "estatica" },
  "app/app/(shell)/produccion/actions.ts::registrarEntradaCompraInsumoAction": {
    nivel: "por-recurso",
    verificacion: "estatica",
    nota: "insumoId — fix del barrido.",
  },
  "app/app/(shell)/produccion/actions.ts::registrarAjusteManualInsumoAction": {
    nivel: "por-recurso",
    verificacion: "estatica",
    nota: "insumoId — fix del barrido.",
  },
  "app/app/(shell)/produccion/actions.ts::listarMovimientosInsumoAction": { nivel: "por-recurso", verificacion: "estatica" },
  "app/app/(shell)/produccion/actions.ts::registrarMermaAlmacenamientoAction": {
    nivel: "por-recurso",
    verificacion: "estatica",
    nota: "insumoId — fix del barrido.",
  },
  "app/app/(shell)/produccion/actions.ts::crearRecetaAction": { nivel: "autenticado", verificacion: "estatica" },
  "app/app/(shell)/produccion/actions.ts::actualizarRecetaAction": { nivel: "por-recurso", verificacion: "estatica" },
  "app/app/(shell)/produccion/actions.ts::eliminarRecetaAction": { nivel: "por-recurso", verificacion: "estatica" },
  "app/app/(shell)/produccion/actions.ts::actualizarComposicionRecetaAction": {
    nivel: "por-recurso",
    verificacion: "estatica",
    nota: "recetaId + cada insumoId de la composición — fix del barrido, doble atado.",
  },
  "app/app/(shell)/produccion/actions.ts::fichaRecetaAction": { nivel: "por-recurso", verificacion: "estatica" },
  "app/app/(shell)/produccion/actions.ts::registrarProduccionAction": {
    nivel: "por-recurso",
    verificacion: "estatica",
    nota: "productoId — fix del barrido (vía receta.tenantId).",
  },
  "app/app/(shell)/produccion/actions.ts::consultarCapacidadAction": { nivel: "por-recurso", verificacion: "estatica" },
  "app/app/(shell)/produccion/actions.ts::registrarProduccionDeAjusteAction": { nivel: "por-recurso", verificacion: "estatica" },

  // --- app/app/(shell)/patrimonio/actions.ts -------------------------------
  "app/app/(shell)/patrimonio/actions.ts::crearActivoAction": { nivel: "autenticado", verificacion: "estatica" },
  "app/app/(shell)/patrimonio/actions.ts::actualizarActivoAction": { nivel: "por-recurso", verificacion: "estatica" },
  "app/app/(shell)/patrimonio/actions.ts::darDeBajaActivoAction": { nivel: "por-recurso", verificacion: "estatica" },
  "app/app/(shell)/patrimonio/actions.ts::transferirActivoAction": {
    nivel: "por-recurso",
    verificacion: "estatica",
    nota: "activoId fetch-then-check correcto; nuevaSucursalId no se revalida contra el tenant (Medio, ya documentado en AUDITORIA-AUTORIZACION.md, no corregido).",
  },
  "app/app/(shell)/patrimonio/actions.ts::crearPasivoAction": { nivel: "autenticado", verificacion: "estatica" },
  "app/app/(shell)/patrimonio/actions.ts::refinanciarPasivoAction": { nivel: "por-recurso", verificacion: "estatica" },
  "app/app/(shell)/patrimonio/actions.ts::registrarPagoPasivoAction": { nivel: "por-recurso", verificacion: "estatica" },

  // --- app/app/(shell)/gastos/actions.ts ------------------------------------
  "app/app/(shell)/gastos/actions.ts::crearGastoAction": { nivel: "autenticado", verificacion: "estatica" },
  "app/app/(shell)/gastos/actions.ts::actualizarGastoAction": { nivel: "por-recurso", verificacion: "estatica" },
  "app/app/(shell)/gastos/actions.ts::eliminarGastoAction": { nivel: "por-recurso", verificacion: "estatica" },
  "app/app/(shell)/gastos/actions.ts::registrarPagoGastoAction": { nivel: "por-recurso", verificacion: "estatica" },
  "app/app/(shell)/gastos/actions.ts::crearCategoriaGastoAction": { nivel: "autenticado", verificacion: "estatica" },
  "app/app/(shell)/gastos/actions.ts::actualizarCategoriaGastoAction": { nivel: "por-recurso", verificacion: "estatica" },
  "app/app/(shell)/gastos/actions.ts::eliminarCategoriaGastoAction": { nivel: "por-recurso", verificacion: "estatica" },
  "app/app/(shell)/gastos/actions.ts::crearGastoRecurrenteAction": { nivel: "autenticado", verificacion: "estatica" },
  "app/app/(shell)/gastos/actions.ts::actualizarGastoRecurrenteAction": { nivel: "por-recurso", verificacion: "estatica" },
  "app/app/(shell)/gastos/actions.ts::desactivarGastoRecurrenteAction": { nivel: "por-recurso", verificacion: "estatica" },
  "app/app/(shell)/gastos/actions.ts::generarGastoDesdeRecurrenteAction": { nivel: "por-recurso", verificacion: "estatica" },

  // --- app/admin/(shell)/planes|logs|instituciones/actions.ts --------------
  "app/admin/(shell)/planes/actions.ts::listarPlanesAction": {
    nivel: "publico",
    verificacion: "estatica",
    nota: "Catálogo global de planes (sin tenant_id), lectura pública por diseño — mismo criterio que Suscripción documenta.",
  },
  "app/admin/(shell)/planes/actions.ts::crearPlanAction": { nivel: "ceom_admin", verificacion: "estatica" },
  "app/admin/(shell)/planes/actions.ts::actualizarPlanAction": { nivel: "ceom_admin", verificacion: "estatica" },
  "app/admin/(shell)/planes/actions.ts::desactivarPlanAction": { nivel: "ceom_admin", verificacion: "estatica" },
  "app/admin/(shell)/planes/actions.ts::reactivarPlanAction": { nivel: "ceom_admin", verificacion: "estatica" },
  "app/admin/(shell)/logs/actions.ts::listarLogsAccesoAction": { nivel: "ceom_admin", verificacion: "estatica" },
  "app/admin/(shell)/instituciones/actions.ts::listarInstitucionesAction": { nivel: "ceom_admin", verificacion: "estatica" },
  "app/admin/(shell)/instituciones/actions.ts::crearInstitucionAction": { nivel: "ceom_admin", verificacion: "estatica" },
  "app/admin/(shell)/instituciones/actions.ts::actualizarInstitucionAction": { nivel: "ceom_admin", verificacion: "estatica" },
  "app/admin/(shell)/instituciones/actions.ts::eliminarInstitucionAction": { nivel: "ceom_admin", verificacion: "estatica" },
  "app/admin/(shell)/instituciones/actions.ts::listarCarteraPorInstitucionAction": { nivel: "ceom_admin", verificacion: "estatica" },
  "app/admin/(shell)/instituciones/actions.ts::agregarTenantACarteraAction": { nivel: "ceom_admin", verificacion: "estatica" },
  "app/admin/(shell)/instituciones/actions.ts::quitarDeCarteraAction": { nivel: "ceom_admin", verificacion: "estatica" },
  "app/admin/(shell)/instituciones/actions.ts::listarTenantsAction": { nivel: "ceom_admin", verificacion: "estatica" },
  "app/admin/(shell)/instituciones/actions.ts::crearSolicitudSeguimientoAction": { nivel: "ceom_admin", verificacion: "estatica" },
};
