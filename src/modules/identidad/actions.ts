import { crearClienteAdmin, crearClienteServidor } from "@/lib/supabase/server";
import {
  obtenerPlanPorId,
  PLAN_BASICO_ID,
} from "@/modules/suscripcion/actions";
import {
  CEOM_OPS_TENANT_ID,
  DURACION_ETAPA_SOLO_LECTURA_DIAS,
  ROL_CEOM_ADMIN_ID,
  ROL_OWNER_ID,
} from "./constants";
import * as repo from "./repository";
import type { UsuarioConRol } from "./repository";
import type {
  accionPermisoEnum,
  capacidadEspecialEnum,
  estadoAccesoEnum,
  estadoSuscripcionEnum,
  moduloPermisoEnum,
} from "./schema";

export type Resultado<T> =
  | { ok: true; data: T }
  | { ok: false; error: string };

type Modulo = (typeof moduloPermisoEnum.enumValues)[number];
type Accion = (typeof accionPermisoEnum.enumValues)[number];
type Capacidad = (typeof capacidadEspecialEnum.enumValues)[number];
type EstadoAcceso = (typeof estadoAccesoEnum.enumValues)[number];
type EstadoSuscripcion = (typeof estadoSuscripcionEnum.enumValues)[number];

// --- Sesion ---------------------------------------------------------

export async function obtenerUsuarioActual(): Promise<UsuarioConRol | null> {
  const supabase = await crearClienteServidor();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  return repo.obtenerUsuarioConRolPorId(user.id);
}

// --- Motor de autorizacion (Modulo_01 seccion 7) ---------------------------------------------------------

/**
 * Funcion pura: "Derivado, no editable a mano" (Modulo_01 seccion 1.1). No
 * confia en el campo persistido tenants.estado_acceso (nada lo mantiene al
 * dia todavia — el scheduler real es trabajo de Modulo 11), lo recalcula
 * siempre a partir de estado_suscripcion + fecha_proximo_pago.
 */
export function calcularEstadoAcceso(
  tenant: {
    estadoSuscripcion: EstadoSuscripcion;
    fechaProximoPago: string | null;
  },
  ahora: Date = new Date(),
  duracionEtapaSoloLecturaDias: number = DURACION_ETAPA_SOLO_LECTURA_DIAS
): EstadoAcceso {
  if (tenant.estadoSuscripcion === "activa") return "activo";
  // "pausada" no tiene comportamiento definido en Modulo_01 — se trata como
  // bloqueado por seguridad (un tenant pausado no deberia operar).
  if (tenant.estadoSuscripcion === "pausada") return "bloqueado";

  // vencida: etapa de gracia en solo_lectura, medida desde fecha_proximo_pago.
  if (duracionEtapaSoloLecturaDias <= 0) return "bloqueado";
  if (!tenant.fechaProximoPago) return "bloqueado";
  const finGracia = new Date(tenant.fechaProximoPago);
  finGracia.setDate(finGracia.getDate() + duracionEtapaSoloLecturaDias);
  return ahora <= finGracia ? "solo_lectura" : "bloqueado";
}

/**
 * tienePermiso(solicitante, tenantObjetivo, modulo, accion) — Modulo_01
 * seccion 7.1. Orden: CEOM Admin (bypass cross-tenant) -> estado_acceso ->
 * Owner (bypass matriz) -> matriz rol x modulo x accion.
 */
export async function tienePermiso(
  solicitante: UsuarioConRol,
  tenantObjetivoId: string,
  modulo: Modulo,
  accion: Accion
): Promise<boolean> {
  if (solicitante.rol.esRolSistema && solicitante.rolId === ROL_CEOM_ADMIN_ID) {
    // Alcance cross-tenant (Modulo_01 seccion 6.5). El consentimiento
    // externo institucional (seccion 7.2) es el futuro Gateway de
    // Consentimiento, un modulo aparte — no aplica aca.
    return true;
  }

  if (solicitante.tenantId !== tenantObjetivoId) return false;

  const tenant = await repo.obtenerTenantPorId(tenantObjetivoId);
  if (!tenant) return false;

  const estadoAcceso = calcularEstadoAcceso(tenant);
  if (estadoAcceso === "bloqueado") return false;
  if (estadoAcceso === "solo_lectura" && accion !== "ver") return false;

  if (solicitante.esOwner) return true;

  const filas = await repo.listarPermisosPorRol(solicitante.rolId);
  const permiso = filas.find((p) => p.modulo === modulo && p.accion === accion);
  return permiso?.permitido ?? false;
}

/**
 * Lectura basica de un Tenant (plan_id, nicho_id, estado_suscripcion, etc).
 * El repository ya tenia esta consulta (la usa tienePermiso() internamente);
 * faltaba exponerla como parte del contrato publico. Mismo criterio de
 * alcance que tienePermiso(): ceom_admin ve cualquier tenant, un usuario
 * normal solo el suyo — "identidad" no esta en el enum modulo_permiso, asi
 * que no hay un modulo/accion que gatear, se resuelve igual que
 * invitarUsuario/crearTenant (chequeo directo, no via la matriz generica).
 */
export async function obtenerTenantPorId(
  solicitante: UsuarioConRol,
  tenantId: string
): Promise<Resultado<NonNullable<Awaited<ReturnType<typeof repo.obtenerTenantPorId>>>>> {
  const esCeomAdmin = solicitante.rol.esRolSistema && solicitante.rolId === ROL_CEOM_ADMIN_ID;
  if (!esCeomAdmin && solicitante.tenantId !== tenantId) {
    return { ok: false, error: "No tenés permiso para ver este tenant." };
  }

  const tenant = await repo.obtenerTenantPorId(tenantId);
  if (!tenant) return { ok: false, error: "Tenant no encontrado." };
  return { ok: true, data: tenant };
}

/**
 * Consulta minima y SIN gate de solicitante — a proposito, para el Gateway
 * de Consentimiento (Modulo 10): una Institucion externa consultando un
 * tenant no es un UsuarioConRol, asi que no puede pasar por
 * obtenerTenantPorId(). Expone unicamente el estado_acceso derivado, nunca
 * datos de negocio del tenant (nombre, plan, etc) — no usar esta funcion
 * para nada que no sea ese chequeo puntual.
 */
export async function obtenerEstadoAccesoTenant(
  tenantId: string
): Promise<Resultado<{ estadoAcceso: EstadoAcceso }>> {
  const tenant = await repo.obtenerTenantPorId(tenantId);
  if (!tenant) return { ok: false, error: "Tenant no encontrado." };
  return { ok: true, data: { estadoAcceso: calcularEstadoAcceso(tenant) } };
}

/**
 * Consulta minima y SIN gate de solicitante — mismo criterio que
 * obtenerEstadoAccesoTenant(): una Institucion externa (Modulo 11,
 * Monitoreo Institucional) no es un UsuarioConRol. Expone solo lo minimo
 * para mostrar un tenant en un panel de veedor (nombre, nicho, plan, estado
 * de acceso), nunca el resto de los datos del Tenant.
 */
export async function obtenerTenantParaVeedor(tenantId: string): Promise<
  Resultado<{
    id: string;
    nombreNegocio: string;
    nichoId: string | null;
    planId: string | null;
    estadoAcceso: EstadoAcceso;
  }>
> {
  const tenant = await repo.obtenerTenantPorId(tenantId);
  if (!tenant) return { ok: false, error: "Tenant no encontrado." };
  return {
    ok: true,
    data: {
      id: tenant.id,
      nombreNegocio: tenant.nombreNegocio,
      nichoId: tenant.nichoId,
      planId: tenant.planId,
      estadoAcceso: calcularEstadoAcceso(tenant),
    },
  };
}

/**
 * Listado cross-tenant, gateado a ceom_admin directo (mismo criterio que
 * tienePermiso() para ese rol) — para que Panel Admin CEOM (Modulo 11)
 * calcule salud agregada de la plataforma sin duplicar calcularEstadoAcceso().
 */
export async function listarTenants(solicitante: UsuarioConRol): Promise<
  Resultado<
    Array<{
      id: string;
      nombreNegocio: string;
      planId: string | null;
      nichoId: string | null;
      estadoSuscripcion: EstadoSuscripcion;
      fechaProximoPago: string | null;
    }>
  >
> {
  const esCeomAdmin = solicitante.rol.esRolSistema && solicitante.rolId === ROL_CEOM_ADMIN_ID;
  if (!esCeomAdmin) {
    return { ok: false, error: "No tenés permiso para listar tenants." };
  }
  const tenants = await repo.listarTenants();
  return {
    ok: true,
    data: tenants.map((t) => ({
      id: t.id,
      nombreNegocio: t.nombreNegocio,
      planId: t.planId,
      nichoId: t.nichoId,
      estadoSuscripcion: t.estadoSuscripcion,
      fechaProximoPago: t.fechaProximoPago,
    })),
  };
}

/**
 * Listado de sucursales de un tenant (Sucursal ya existe desde Modulo 1,
 * pero hasta ahora ningun consumidor de UI la necesitaba). Mismo criterio de
 * gate que obtenerTenantPorId: ceom_admin ve cualquier tenant, un usuario
 * normal solo el suyo.
 */
export async function listarSucursalesPorTenant(
  solicitante: UsuarioConRol,
  tenantId: string
): Promise<Resultado<Awaited<ReturnType<typeof repo.listarSucursalesPorTenant>>>> {
  const esCeomAdmin = solicitante.rol.esRolSistema && solicitante.rolId === ROL_CEOM_ADMIN_ID;
  if (!esCeomAdmin && solicitante.tenantId !== tenantId) {
    return { ok: false, error: "No tenés permiso para ver las sucursales de este tenant." };
  }
  return { ok: true, data: await repo.listarSucursalesPorTenant(tenantId) };
}

/**
 * Solicitante SINTETICO — solo para lecturas mediadas por el Gateway de
 * Consentimiento (Modulo 11, Monitoreo Institucional). Una Institucion
 * externa no es un UsuarioConRol; una vez que tieneConsentimiento() ya
 * confirmo el permiso puntual, el Gateway necesita "prestar" el mismo
 * bypass cross-tenant que ya tiene ceom_admin (ver tienePermiso() arriba,
 * que no valida nada de tenantId ni de la fila real de usuario en esa
 * rama) para poder llamar a los actions.ts de solo lectura de otros
 * modulos sin romper la caja negra. No hay una fila de usuario real
 * detras — objeto de un solo proposito, documentado.
 *
 * NUNCA usar para escrituras ni exponer a ningun input externo — solo el
 * propio codigo de monitoreo-institucional/actions.ts lo invoca, y solo
 * despues de que tieneConsentimiento() ya devolvio true.
 */
export async function solicitanteGateway(): Promise<UsuarioConRol> {
  const rol = await repo.obtenerRolPorId(ROL_CEOM_ADMIN_ID);
  if (!rol) {
    throw new Error("Rol CEOM Admin no encontrado — seed de sistema faltante.");
  }
  return {
    id: "00000000-0000-0000-0000-000000000000",
    tenantId: CEOM_OPS_TENANT_ID,
    nombreCompleto: "Gateway de Consentimiento (sistema)",
    email: "sistema@ceom.internal",
    telefono: null,
    rolId: ROL_CEOM_ADMIN_ID,
    esOwner: false,
    activo: true,
    ultimoAccesoEn: null,
    creadoPor: null,
    creadoEn: new Date(),
    modificadoPor: null,
    modificadoEn: null,
    eliminadoEn: null,
    rol,
  };
}

/**
 * Resolucion: Owner (bypass, seccion 6.2: "todos los permisos... de forma
 * permanente y no editable") > override por usuario > override por rol >
 * false (seccion 13.1). El bypass de Owner es incondicional, igual que en
 * tienePermiso() — nunca puede quedar reducido por un override puntual.
 */
export async function tieneCapacidadEspecial(
  solicitante: UsuarioConRol,
  capacidad: Capacidad
): Promise<boolean> {
  if (solicitante.esOwner) return true;

  const overrideUsuario = await repo.obtenerCapacidadEspecialPorUsuario(
    solicitante.id,
    capacidad
  );
  if (overrideUsuario) return overrideUsuario.habilitado;

  const overrideRol = await repo.obtenerCapacidadEspecialPorRol(
    solicitante.rolId,
    capacidad
  );
  if (overrideRol) return overrideRol.habilitado;

  return false;
}

// --- Alta de tenant (Modulo_01 seccion 3) ---------------------------------------------------------

export interface CrearTenantInput {
  nombreNegocio: string;
  ciudadBase?: string;
  monedaPrincipal: string;
  canalesVenta?: string[];
  planId?: string;
  fechaInicioSuscripcion: string;
  ownerEmail: string;
  ownerNombreCompleto: string;
}

/**
 * Solo CEOM Admin. Crea el usuario de Supabase Auth via invitacion (dispara
 * el email real) y recien con ese id arma la transaccion atomica de
 * tenant+sucursal+usuario Owner. Limitacion conocida: si la transaccion de
 * DB falla despues de creado el usuario de Auth, ese usuario queda
 * huerfano (Supabase Auth y Postgres no comparten una transaccion) — se
 * limpia manualmente via el admin API si llega a pasar.
 */
export async function crearTenant(
  solicitante: UsuarioConRol,
  input: CrearTenantInput
): Promise<
  Resultado<{ tenantId: string; sucursalId: string; usuarioOwnerId: string }>
> {
  if (solicitante.rolId !== ROL_CEOM_ADMIN_ID) {
    return { ok: false, error: "Solo CEOM Admin puede dar de alta un tenant." };
  }

  // Modulo_01 seccion 12: "Básico" es el plan de arranque por defecto. Si
  // se especifica otro, se valida contra Suscripcion (nunca contra su
  // repository directo — regla de caja negra) que exista y este activo.
  const planId = input.planId ?? PLAN_BASICO_ID;
  const plan = await obtenerPlanPorId(planId);
  if (!plan || !plan.activo) {
    return { ok: false, error: "El plan indicado no existe o no está activo." };
  }

  const admin = crearClienteAdmin();
  const { data: authData, error: authError } =
    await admin.auth.admin.inviteUserByEmail(input.ownerEmail);
  if (authError || !authData.user) {
    return {
      ok: false,
      error: authError?.message ?? "No se pudo crear el usuario de Auth.",
    };
  }

  const { tenant, sucursal, usuarioOwner } = await repo.crearTenantConOwner({
    tenant: {
      nombreNegocio: input.nombreNegocio,
      ciudadBase: input.ciudadBase,
      monedaPrincipal: input.monedaPrincipal,
      canalesVenta: input.canalesVenta ?? [],
      planId,
      estadoSuscripcion: "activa",
      fechaInicioSuscripcion: input.fechaInicioSuscripcion,
      creadoPor: solicitante.id,
    },
    ownerId: authData.user.id,
    ownerNombreCompleto: input.ownerNombreCompleto,
    ownerEmail: input.ownerEmail,
    rolOwnerId: ROL_OWNER_ID,
    creadoPor: solicitante.id,
  });

  return {
    ok: true,
    data: {
      tenantId: tenant.id,
      sucursalId: sucursal.id,
      usuarioOwnerId: usuarioOwner.id,
    },
  };
}

/**
 * Cambia el plan de un tenant (upgrade/downgrade manual desde /admin,
 * Modulo_01 seccion 11/6.2). Mismo criterio de validacion que crearTenant():
 * el plan tiene que existir y estar activo, validado contra Suscripcion
 * (nunca contra su repository directo — regla de caja negra).
 *
 * Pendiente documentado, no silencioso: la seccion 6.2 exige forzar un solo
 * Owner antes de completar un downgrade a un plan sin
 * permite_multiples_owners si el tenant tiene cofundadores — no se chequea
 * acá porque hoy no existe ningun camino para que un tenant tenga mas de
 * un Owner (transferirOwner() es 1-a-1, "agregar Owner adicional" quedo
 * fuera de alcance a proposito, ver mas abajo). Revisar este chequeo si
 * algun dia se construye esa funcionalidad.
 */
export async function cambiarPlanTenant(
  solicitante: UsuarioConRol,
  tenantId: string,
  nuevoPlanId: string
): Promise<Resultado<true>> {
  if (solicitante.rolId !== ROL_CEOM_ADMIN_ID) {
    return { ok: false, error: "Solo CEOM Admin puede cambiar el plan de un tenant." };
  }

  const tenant = await repo.obtenerTenantPorId(tenantId);
  if (!tenant) return { ok: false, error: "Tenant no encontrado." };

  const plan = await obtenerPlanPorId(nuevoPlanId);
  if (!plan || !plan.activo) {
    return { ok: false, error: "El plan indicado no existe o no está activo." };
  }

  await repo.actualizarPlanTenant(tenantId, nuevoPlanId, solicitante.id);
  return { ok: true, data: true };
}

/**
 * Cambia el estado de suscripcion de un tenant manualmente desde /admin
 * (Modulo_01 seccion 9.5/11) — via soporte/cobranza, no el scheduler
 * automatico (que no existe todavia, ver decisiones mas abajo).
 * `fechaProximoPago` es opcional: relevante sobre todo al pasar a
 * "vencida", que es el ancla desde donde `calcularEstadoAcceso()` mide la
 * etapa de gracia — sin ella (o si ya era null), el tenant queda
 * `bloqueado` de inmediato en vez de `solo_lectura` (mismo comportamiento
 * ya documentado en `calcularEstadoAcceso()`, no un caso especial nuevo).
 */
export async function cambiarEstadoSuscripcion(
  solicitante: UsuarioConRol,
  tenantId: string,
  nuevoEstado: EstadoSuscripcion,
  fechaProximoPago?: string
): Promise<Resultado<true>> {
  if (solicitante.rolId !== ROL_CEOM_ADMIN_ID) {
    return { ok: false, error: "Solo CEOM Admin puede cambiar el estado de suscripción de un tenant." };
  }

  const tenant = await repo.obtenerTenantPorId(tenantId);
  if (!tenant) return { ok: false, error: "Tenant no encontrado." };

  await repo.actualizarEstadoSuscripcionTenant(
    tenantId,
    nuevoEstado,
    fechaProximoPago,
    solicitante.id
  );
  return { ok: true, data: true };
}

// --- Configuracion del tenant / Onboarding (Modulo_01 seccion 4) ---------------------------------------------------------

/**
 * "Configurar negocio" (Modulo_01 seccion 4.1). Mismo criterio de gate que
 * invitarUsuario/cambiarRolUsuario: solo el Owner, chequeo directo de
 * esOwner (identidad no esta en el enum modulo_permiso, ver ANCLA.md).
 * logoUrl es opcional (el negocio puede no tener logo) — se sube antes a
 * Storage vía `subirLogoAction()` (`src/app/app/onboarding/actions.ts`,
 * `src/lib/supabase/storage.ts`) y acá solo se persiste la URL ya
 * resultante, mismo patrón que `productos.imagenUrl`.
 */
export async function actualizarTenant(
  solicitante: UsuarioConRol,
  input: {
    nombreNegocio?: string;
    ciudadBase?: string;
    monedaPrincipal?: string;
    canalesVenta?: string[];
    logoUrl?: string;
  }
): Promise<Resultado<true>> {
  if (!solicitante.esOwner) {
    return { ok: false, error: "Solo el Owner puede configurar el negocio." };
  }
  const escritura = await requireEscrituraHabilitada(solicitante.tenantId);
  if (!escritura.ok) return escritura;

  await repo.actualizarTenant(solicitante.tenantId, input, solicitante.id);
  return { ok: true, data: true };
}

/**
 * "Elegir rubro/nicho" (Modulo_01 seccion 5). Regla de un solo sentido: una
 * vez que el tenant tiene un nicho asignado, esta funcion siempre rechaza
 * — ni para cambiar de nicho ni para volver a Modo Basico. No hay excepcion
 * ni siquiera para ceom_admin: es una decision de negocio del Owner, no una
 * operacion administrativa.
 */
export async function asignarNicho(
  solicitante: UsuarioConRol,
  nicho: "nicho_1" | "nicho_4"
): Promise<Resultado<{ nichoAsignadoEn: string }>> {
  if (!solicitante.esOwner) {
    return { ok: false, error: "Solo el Owner puede elegir el rubro del negocio." };
  }
  const escritura = await requireEscrituraHabilitada(solicitante.tenantId);
  if (!escritura.ok) return escritura;

  const tenant = await repo.obtenerTenantPorId(solicitante.tenantId);
  if (!tenant) return { ok: false, error: "Tenant no encontrado." };
  if (tenant.nichoId) {
    return {
      ok: false,
      error: "Ya elegiste un rubro para este negocio, no se puede cambiar.",
    };
  }

  const actualizado = await repo.asignarNichoTenant(solicitante.tenantId, nicho, solicitante.id);
  return { ok: true, data: { nichoAsignadoEn: actualizado.nichoAsignadoEn!.toISOString() } };
}

/**
 * Marca el onboarding como terminado — señal independiente de nicho_id
 * (que se queda en null tanto si nunca se pasó por onboarding como si se
 * eligió Modo Básico a propósito). Se llama una sola vez, al final del
 * asistente, sin importar qué se haya elegido en "Elegir rubro".
 */
export async function completarOnboarding(
  solicitante: UsuarioConRol
): Promise<Resultado<true>> {
  if (!solicitante.esOwner) {
    return { ok: false, error: "Solo el Owner puede completar el onboarding." };
  }
  await repo.completarOnboardingTenant(solicitante.tenantId);
  return { ok: true, data: true };
}

// --- Colaboradores (Modulo_01 seccion 8) ---------------------------------------------------------

async function requireEscrituraHabilitada(
  tenantId: string
): Promise<Resultado<true>> {
  const tenant = await repo.obtenerTenantPorId(tenantId);
  if (!tenant) return { ok: false, error: "Tenant no encontrado." };
  const estado = calcularEstadoAcceso(tenant);
  if (estado !== "activo") {
    return {
      ok: false,
      error: `El tenant esta en estado "${estado}", no se permite esta accion.`,
    };
  }
  return { ok: true, data: true };
}

/**
 * Listado de colaboradores del propio tenant — mismo criterio de gate que
 * el resto de gestión de Identidad ("identidad" no está en moduloPermisoEnum,
 * se chequea solicitante.esOwner directo, ver decisiones en ANCLA.md).
 */
export async function listarUsuarios(
  solicitante: UsuarioConRol
): Promise<Resultado<UsuarioConRol[]>> {
  if (!solicitante.esOwner) {
    return { ok: false, error: "Solo el Owner puede ver la lista de colaboradores." };
  }
  return { ok: true, data: await repo.listarUsuariosPorTenant(solicitante.tenantId) };
}

export async function invitarUsuario(
  solicitante: UsuarioConRol,
  input: { email: string; nombreCompleto: string; rolId: string }
): Promise<Resultado<{ usuarioId: string }>> {
  // "cualquier usuario con permiso crear en este modulo" (Modulo_01 seccion
  // 8.1) no es representable con la matriz generica (identidad no es un
  // modulo del enum "modulo_permiso") — se acota a Owner, ver ANCLA.md.
  if (!solicitante.esOwner) {
    return { ok: false, error: "Solo el Owner puede invitar colaboradores." };
  }

  const escritura = await requireEscrituraHabilitada(solicitante.tenantId);
  if (!escritura.ok) return escritura;

  // Nunca asignar un rol de sistema (Owner/CEOM Admin) via invitacion — Owner
  // se otorga solo por crearTenant()/transferirOwner(), y CEOM Admin es
  // transversal a todos los tenants: darselo a un colaborador via este
  // camino le otorgaria el bypass cross-tenant de tienePermiso() por error.
  const rolInvitado = await repo.obtenerRolPorId(input.rolId);
  if (!rolInvitado || rolInvitado.esRolSistema || rolInvitado.tenantId !== solicitante.tenantId) {
    return { ok: false, error: "Rol inválido." };
  }

  const admin = crearClienteAdmin();
  const { data: authData, error: authError } =
    await admin.auth.admin.inviteUserByEmail(input.email);
  if (authError || !authData.user) {
    return {
      ok: false,
      error: authError?.message ?? "No se pudo crear el usuario de Auth.",
    };
  }

  const usuario = await repo.insertarUsuario({
    id: authData.user.id,
    tenantId: solicitante.tenantId,
    nombreCompleto: input.nombreCompleto,
    email: input.email,
    rolId: input.rolId,
    esOwner: false,
    activo: true,
    creadoPor: solicitante.id,
  });

  return { ok: true, data: { usuarioId: usuario.id } };
}

export async function cambiarRolUsuario(
  solicitante: UsuarioConRol,
  usuarioId: string,
  nuevoRolId: string
): Promise<Resultado<true>> {
  if (!solicitante.esOwner) {
    return { ok: false, error: "Solo el Owner puede cambiar roles." };
  }
  const escritura = await requireEscrituraHabilitada(solicitante.tenantId);
  if (!escritura.ok) return escritura;

  // Mismo criterio que invitarUsuario(): nunca asignar un rol de sistema por
  // este camino (Owner se otorga solo via transferirOwner(), CEOM Admin
  // nunca a un colaborador de tenant).
  const nuevoRol = await repo.obtenerRolPorId(nuevoRolId);
  if (!nuevoRol || nuevoRol.esRolSistema || nuevoRol.tenantId !== solicitante.tenantId) {
    return { ok: false, error: "Rol inválido." };
  }

  await repo.actualizarRolUsuario(usuarioId, nuevoRolId, solicitante.id);
  return { ok: true, data: true };
}

export async function suspenderUsuario(
  solicitante: UsuarioConRol,
  usuarioId: string
): Promise<Resultado<true>> {
  if (!solicitante.esOwner) {
    return { ok: false, error: "Solo el Owner puede suspender usuarios." };
  }
  const escritura = await requireEscrituraHabilitada(solicitante.tenantId);
  if (!escritura.ok) return escritura;

  const objetivo = await repo.obtenerUsuarioConRolPorId(usuarioId);
  if (!objetivo) return { ok: false, error: "Usuario no encontrado." };

  // Caso borde 9.1: nunca dejar al tenant sin ningun Owner activo.
  if (objetivo.esOwner) {
    const owners = await repo.contarOwnersActivos(objetivo.tenantId);
    if (owners <= 1) {
      return {
        ok: false,
        error: "No se puede suspender al unico Owner del tenant.",
      };
    }
  }

  await repo.actualizarActivoUsuario(usuarioId, false, solicitante.id);
  return { ok: true, data: true };
}

export async function reactivarUsuario(
  solicitante: UsuarioConRol,
  usuarioId: string
): Promise<Resultado<true>> {
  if (!solicitante.esOwner) {
    return { ok: false, error: "Solo el Owner puede reactivar usuarios." };
  }
  const escritura = await requireEscrituraHabilitada(solicitante.tenantId);
  if (!escritura.ok) return escritura;

  await repo.actualizarActivoUsuario(usuarioId, true, solicitante.id);
  return { ok: true, data: true };
}

/**
 * Transferencia de la condicion de Owner (Modulo_01 seccion 6.2/9.1) —
 * atomica: el destino pasa a Owner, el Owner saliente queda con el rol
 * elegido explicitamente (nunca un default implicito, para no dejarlo con
 * rolId=ROL_OWNER_ID + esOwner=false, un estado inconsistente que no
 * corresponde a ningun permiso real). Fuera de alcance a proposito:
 * "agregar Owner adicional sin perder la condicion propia" (multi-owner via
 * planes.permiteMultiplesOwners) — es una accion distinta ("sumar" vs
 * "ceder"), decision confirmada explicitamente con el usuario antes de
 * implementar.
 */
export async function transferirOwner(
  solicitante: UsuarioConRol,
  nuevoOwnerUsuarioId: string,
  rolParaOwnerSaliente: string
): Promise<Resultado<true>> {
  if (!solicitante.esOwner) {
    return { ok: false, error: "Solo el Owner puede transferir su condición." };
  }
  const escritura = await requireEscrituraHabilitada(solicitante.tenantId);
  if (!escritura.ok) return escritura;

  const destino = await repo.obtenerUsuarioConRolPorId(nuevoOwnerUsuarioId);
  if (!destino || destino.tenantId !== solicitante.tenantId) {
    return { ok: false, error: "El colaborador destino no pertenece a este tenant." };
  }
  if (!destino.activo) {
    return { ok: false, error: "El colaborador destino no está activo." };
  }

  const rolSaliente = await repo.obtenerRolPorId(rolParaOwnerSaliente);
  if (!rolSaliente || rolSaliente.esRolSistema || rolSaliente.tenantId !== solicitante.tenantId) {
    return { ok: false, error: "El rol elegido para vos no es válido en este tenant." };
  }

  await repo.transferirOwner({
    ownerActualId: solicitante.id,
    nuevoOwnerId: nuevoOwnerUsuarioId,
    rolOwnerId: ROL_OWNER_ID,
    rolParaOwnerSaliente,
    modificadoPor: solicitante.id,
  });

  return { ok: true, data: true };
}

// --- Roles y permisos (Modulo_01 seccion 6.3) ---------------------------------------------------------

/**
 * Roles visibles para el tenant (propios + de sistema, mismo criterio que
 * la policy de RLS de `roles`), con conteo de colaboradores activos por
 * rol para las cards de "Gestión de Roles".
 */
export async function listarRoles(
  solicitante: UsuarioConRol
): Promise<Resultado<Awaited<ReturnType<typeof repo.listarRolesPorTenant>>>> {
  if (!solicitante.esOwner) {
    return { ok: false, error: "Solo el Owner puede ver la lista de roles." };
  }
  return { ok: true, data: await repo.listarRolesPorTenant(solicitante.tenantId) };
}

/** Precarga la Matriz de Permisos al editar un rol — vacío para Owner/CEOM Admin (no tienen filas, sección 6.2/6.5). */
export async function listarPermisosPorRol(
  solicitante: UsuarioConRol,
  rolId: string
): Promise<Resultado<{ modulo: Modulo; accion: Accion; permitido: boolean }[]>> {
  if (!solicitante.esOwner) {
    return { ok: false, error: "Solo el Owner puede ver los permisos de un rol." };
  }
  const rol = await repo.obtenerRolPorId(rolId);
  if (!rol || (rol.tenantId !== null && rol.tenantId !== solicitante.tenantId)) {
    return { ok: false, error: "Rol no encontrado." };
  }
  const permisos = await repo.listarPermisosPorRol(rolId);
  return {
    ok: true,
    data: permisos.map((p) => ({ modulo: p.modulo, accion: p.accion, permitido: p.permitido })),
  };
}

export async function crearRolPersonalizado(
  solicitante: UsuarioConRol,
  input: {
    nombre: string;
    permisos: { modulo: Modulo; accion: Accion; permitido: boolean }[];
  }
): Promise<Resultado<{ rolId: string }>> {
  if (!solicitante.esOwner) {
    return { ok: false, error: "Solo el Owner puede crear roles." };
  }
  const escritura = await requireEscrituraHabilitada(solicitante.tenantId);
  if (!escritura.ok) return escritura;

  const rol = await repo.crearRol({
    tenantId: solicitante.tenantId,
    nombre: input.nombre,
    esRolSistema: false,
  });
  if (input.permisos.length > 0) {
    await repo.reemplazarPermisosRol(rol.id, input.permisos);
  }
  return { ok: true, data: { rolId: rol.id } };
}

export async function actualizarPermisosRol(
  solicitante: UsuarioConRol,
  rolId: string,
  permisos: { modulo: Modulo; accion: Accion; permitido: boolean }[]
): Promise<Resultado<true>> {
  if (!solicitante.esOwner) {
    return { ok: false, error: "Solo el Owner puede editar permisos." };
  }
  const escritura = await requireEscrituraHabilitada(solicitante.tenantId);
  if (!escritura.ok) return escritura;

  const rol = await repo.obtenerRolPorId(rolId);
  if (!rol || rol.esRolSistema) {
    return { ok: false, error: "Rol no encontrado o no editable." };
  }

  await repo.reemplazarPermisosRol(rolId, permisos);
  return { ok: true, data: true };
}

export async function eliminarRol(
  solicitante: UsuarioConRol,
  rolId: string
): Promise<Resultado<true>> {
  if (!solicitante.esOwner) {
    return { ok: false, error: "Solo el Owner puede eliminar roles." };
  }
  const escritura = await requireEscrituraHabilitada(solicitante.tenantId);
  if (!escritura.ok) return escritura;

  const rol = await repo.obtenerRolPorId(rolId);
  if (!rol || rol.esRolSistema) {
    return { ok: false, error: "Rol no encontrado o no eliminable." };
  }

  // Caso borde 9.3: bloqueado hasta reasignar los usuarios de ese rol.
  const usuariosActivos = await repo.contarUsuariosActivosPorRol(rolId);
  if (usuariosActivos > 0) {
    return {
      ok: false,
      error: `Hay ${usuariosActivos} usuario(s) con este rol; reasignalos antes de eliminarlo.`,
    };
  }

  await repo.eliminarRolSoft(rolId);
  return { ok: true, data: true };
}

// --- Capacidades especiales (Modulo_01 seccion 13) ---------------------------------------------------------

/**
 * Override por rol (seccion 13). El Owner activa/desactiva una capacidad
 * especial (ej. "vender_sin_stock") para todos los usuarios de ese rol —
 * default que despues puede pisarse puntualmente con
 * otorgarCapacidadEspecialPorUsuario(). Nunca aplica a un rol de sistema
 * (Owner/CEOM Admin son globales, compartidos entre tenants).
 */
/**
 * Bulk — evita N llamadas para pintar la pantalla completa de Capacidades
 * Especiales. `porRol` solo incluye roles personalizados del tenant (Owner/
 * CEOM Admin nunca tienen fila acá, sección 13 — otorgarCapacidadEspecialPorRol
 * ya rechaza roles de sistema). `porUsuario` son los overrides existentes
 * de cualquier colaborador del tenant (no todos los usuarios × las 4
 * capacidades — solo los que tienen una excepción puntual cargada).
 */
export async function listarCapacidadesEspeciales(solicitante: UsuarioConRol): Promise<
  Resultado<{
    porRol: { rolId: string; capacidad: Capacidad; habilitado: boolean }[];
    porUsuario: { usuarioId: string; capacidad: Capacidad; habilitado: boolean }[];
  }>
> {
  if (!solicitante.esOwner) {
    return { ok: false, error: "Solo el Owner puede ver las capacidades especiales." };
  }

  const [roles, usuariosTenant] = await Promise.all([
    repo.listarRolesPorTenant(solicitante.tenantId),
    repo.listarUsuariosPorTenant(solicitante.tenantId),
  ]);
  const rolesCustomIds = roles.filter((r) => !r.esRolSistema).map((r) => r.id);
  const usuarioIds = usuariosTenant.map((u) => u.id);

  const [porRol, porUsuario] = await Promise.all([
    repo.listarCapacidadesEspecialesPorRoles(rolesCustomIds),
    repo.listarCapacidadesEspecialesPorUsuarios(usuarioIds),
  ]);

  return {
    ok: true,
    data: {
      porRol: porRol.map((f) => ({ rolId: f.rolId, capacidad: f.capacidad, habilitado: f.habilitado })),
      porUsuario: porUsuario.map((f) => ({
        usuarioId: f.usuarioId,
        capacidad: f.capacidad,
        habilitado: f.habilitado,
      })),
    },
  };
}

export async function otorgarCapacidadEspecialPorRol(
  solicitante: UsuarioConRol,
  rolId: string,
  capacidad: Capacidad,
  habilitado: boolean
): Promise<Resultado<true>> {
  if (!solicitante.esOwner) {
    return {
      ok: false,
      error: "Solo el Owner puede otorgar capacidades especiales.",
    };
  }
  const escritura = await requireEscrituraHabilitada(solicitante.tenantId);
  if (!escritura.ok) return escritura;

  const rol = await repo.obtenerRolPorId(rolId);
  if (!rol || rol.esRolSistema) {
    return { ok: false, error: "Rol no encontrado o no editable." };
  }

  await repo.upsertCapacidadEspecialRol(rolId, capacidad, habilitado);
  return { ok: true, data: true };
}

/**
 * Override puntual por usuario (seccion 13.1) — gana sobre el override de
 * rol, sin crear un rol nuevo solo para la excepcion. `tieneCapacidadEspecial()`
 * ya resuelve el orden usuario > rol > false; esta es la unica forma de
 * escribir ese primer nivel.
 */
export async function otorgarCapacidadEspecialPorUsuario(
  solicitante: UsuarioConRol,
  usuarioId: string,
  capacidad: Capacidad,
  habilitado: boolean
): Promise<Resultado<true>> {
  if (!solicitante.esOwner) {
    return {
      ok: false,
      error: "Solo el Owner puede otorgar capacidades especiales.",
    };
  }
  const escritura = await requireEscrituraHabilitada(solicitante.tenantId);
  if (!escritura.ok) return escritura;

  const usuario = await repo.obtenerUsuarioConRolPorId(usuarioId);
  if (!usuario) return { ok: false, error: "Usuario no encontrado." };

  await repo.upsertCapacidadEspecialUsuario(
    usuarioId,
    capacidad,
    habilitado,
    solicitante.id
  );
  return { ok: true, data: true };
}

export { CEOM_OPS_TENANT_ID, ROL_CEOM_ADMIN_ID, ROL_OWNER_ID };
// Parte del contrato publico: cualquier modulo que llame a tienePermiso()
// necesita tipar su parametro "solicitante" sin importar el repository de
// Identidad directamente.
export type { UsuarioConRol } from "./repository";
// Parte del contrato publico: la UI de Gestión de Roles/Capacidades
// Especiales necesita tipar la Matriz de Permisos y el catálogo de
// capacidades sin importar identidad/schema.ts directamente.
export type { Accion, Capacidad, Modulo };
