import { and, eq, inArray, isNull, sql } from "drizzle-orm";
import { db } from "@/db/client";
import {
  permisos,
  permisosEspecialesPorRol,
  permisosEspecialesPorUsuario,
  roles,
  sucursales,
  tenants,
  usuarios,
} from "./schema";

export type NuevoTenant = typeof tenants.$inferInsert;
export type NuevoUsuario = typeof usuarios.$inferInsert;
export type NuevoRol = typeof roles.$inferInsert;
export type NuevoPermiso = typeof permisos.$inferInsert;

export type UsuarioConRol = typeof usuarios.$inferSelect & {
  rol: typeof roles.$inferSelect;
};

// --- Lecturas ---------------------------------------------------------

export async function obtenerUsuarioConRolPorId(
  usuarioId: string
): Promise<UsuarioConRol | null> {
  const filas = await db
    .select({ usuario: usuarios, rol: roles })
    .from(usuarios)
    .innerJoin(roles, eq(usuarios.rolId, roles.id))
    .where(and(eq(usuarios.id, usuarioId), isNull(usuarios.eliminadoEn)))
    .limit(1);
  const fila = filas[0];
  if (!fila) return null;
  return { ...fila.usuario, rol: fila.rol };
}

export async function listarUsuariosPorTenant(tenantId: string): Promise<UsuarioConRol[]> {
  const filas = await db
    .select({ usuario: usuarios, rol: roles })
    .from(usuarios)
    .innerJoin(roles, eq(usuarios.rolId, roles.id))
    .where(and(eq(usuarios.tenantId, tenantId), isNull(usuarios.eliminadoEn)));
  return filas.map((fila) => ({ ...fila.usuario, rol: fila.rol }));
}

export async function obtenerTenantPorId(tenantId: string) {
  const filas = await db
    .select()
    .from(tenants)
    .where(and(eq(tenants.id, tenantId), isNull(tenants.eliminadoEn)))
    .limit(1);
  return filas[0] ?? null;
}

/** Listado cross-tenant completo — solo para consumidores ya gateados a ceom_admin (Panel Admin CEOM). */
export async function listarTenants() {
  return db.select().from(tenants).where(isNull(tenants.eliminadoEn));
}

export async function listarSucursalesPorTenant(tenantId: string) {
  return db
    .select()
    .from(sucursales)
    .where(and(eq(sucursales.tenantId, tenantId), isNull(sucursales.eliminadoEn)));
}

export async function obtenerRolPorId(rolId: string) {
  const filas = await db
    .select()
    .from(roles)
    .where(and(eq(roles.id, rolId), isNull(roles.eliminadoEn)))
    .limit(1);
  return filas[0] ?? null;
}

export async function listarPermisosPorRol(rolId: string) {
  return db.select().from(permisos).where(eq(permisos.rolId, rolId));
}

/**
 * Roles visibles para un tenant: los propios (tenant_id = tenantId) + los
 * de sistema (tenant_id null, Owner/CEOM Admin) — mismo criterio que la
 * policy de RLS de `roles` ("datos de referencia compartidos"). El conteo
 * de colaboradores es siempre relativo a ESTE tenant, incluso para un rol
 * de sistema (Owner tiene una fila por tenant, CEOM Admin da 0 acá).
 */
export async function listarRolesPorTenant(tenantId: string) {
  const listaRoles = await db
    .select()
    .from(roles)
    .where(
      and(isNull(roles.eliminadoEn), sql`(${roles.tenantId} = ${tenantId} or ${roles.tenantId} is null)`)
    );

  const conteos = await db
    .select({ rolId: usuarios.rolId, total: sql<number>`count(*)::int` })
    .from(usuarios)
    .where(and(eq(usuarios.tenantId, tenantId), eq(usuarios.activo, true), isNull(usuarios.eliminadoEn)))
    .groupBy(usuarios.rolId);
  const mapaConteos = new Map(conteos.map((c) => [c.rolId, c.total]));

  return listaRoles.map((rol) => ({ ...rol, colaboradores: mapaConteos.get(rol.id) ?? 0 }));
}

/** Bulk — evita N llamadas a obtenerCapacidadEspecialPorRol al pintar la matriz completa. */
export async function listarCapacidadesEspecialesPorRoles(rolIds: string[]) {
  if (rolIds.length === 0) return [];
  return db
    .select()
    .from(permisosEspecialesPorRol)
    .where(inArray(permisosEspecialesPorRol.rolId, rolIds));
}

/** Bulk — mismo criterio que listarCapacidadesEspecialesPorRoles, para overrides por usuario. */
export async function listarCapacidadesEspecialesPorUsuarios(usuarioIds: string[]) {
  if (usuarioIds.length === 0) return [];
  return db
    .select()
    .from(permisosEspecialesPorUsuario)
    .where(
      and(
        inArray(permisosEspecialesPorUsuario.usuarioId, usuarioIds),
        isNull(permisosEspecialesPorUsuario.eliminadoEn)
      )
    );
}

export async function obtenerCapacidadEspecialPorUsuario(
  usuarioId: string,
  capacidad: (typeof permisosEspecialesPorUsuario.$inferSelect)["capacidad"]
) {
  const filas = await db
    .select()
    .from(permisosEspecialesPorUsuario)
    .where(
      and(
        eq(permisosEspecialesPorUsuario.usuarioId, usuarioId),
        eq(permisosEspecialesPorUsuario.capacidad, capacidad),
        isNull(permisosEspecialesPorUsuario.eliminadoEn)
      )
    )
    .limit(1);
  return filas[0] ?? null;
}

export async function obtenerCapacidadEspecialPorRol(
  rolId: string,
  capacidad: (typeof permisosEspecialesPorRol.$inferSelect)["capacidad"]
) {
  const filas = await db
    .select()
    .from(permisosEspecialesPorRol)
    .where(
      and(
        eq(permisosEspecialesPorRol.rolId, rolId),
        eq(permisosEspecialesPorRol.capacidad, capacidad)
      )
    )
    .limit(1);
  return filas[0] ?? null;
}

export async function contarOwnersActivos(tenantId: string): Promise<number> {
  const filas = await db
    .select({ total: sql<number>`count(*)::int` })
    .from(usuarios)
    .where(
      and(
        eq(usuarios.tenantId, tenantId),
        eq(usuarios.esOwner, true),
        eq(usuarios.activo, true),
        isNull(usuarios.eliminadoEn)
      )
    );
  return filas[0]?.total ?? 0;
}

export async function contarUsuariosActivosPorRol(
  rolId: string
): Promise<number> {
  const filas = await db
    .select({ total: sql<number>`count(*)::int` })
    .from(usuarios)
    .where(
      and(
        eq(usuarios.rolId, rolId),
        eq(usuarios.activo, true),
        isNull(usuarios.eliminadoEn)
      )
    );
  return filas[0]?.total ?? 0;
}

// --- Escrituras ---------------------------------------------------------

/**
 * Alta atomica de tenant: tenant + sucursal principal + usuario Owner, en
 * una sola transaccion (Modulo_01 seccion 3). El rol Owner ya existe como
 * rol de sistema global (ver constants.ts) — no se crea una fila nueva.
 */
export async function crearTenantConOwner(input: {
  tenant: Omit<NuevoTenant, "id">;
  ownerId: string; // = id de Supabase Auth del primer usuario
  ownerNombreCompleto: string;
  ownerEmail: string;
  rolOwnerId: string;
  creadoPor: string | null;
}) {
  return db.transaction(async (tx) => {
    const [tenant] = await tx.insert(tenants).values(input.tenant).returning();

    const [sucursal] = await tx
      .insert(sucursales)
      .values({
        tenantId: tenant.id,
        nombre: "Principal",
        esPrincipal: true,
        activa: true,
      })
      .returning();

    const [usuarioOwner] = await tx
      .insert(usuarios)
      .values({
        id: input.ownerId,
        tenantId: tenant.id,
        nombreCompleto: input.ownerNombreCompleto,
        email: input.ownerEmail,
        rolId: input.rolOwnerId,
        esOwner: true,
        activo: true,
        creadoPor: input.creadoPor,
      })
      .returning();

    return { tenant, sucursal, usuarioOwner };
  });
}

export interface DatosActualizarTenant {
  nombreNegocio?: string;
  ciudadBase?: string;
  monedaPrincipal?: string;
  canalesVenta?: string[];
  logoUrl?: string;
}

export async function actualizarPlanTenant(
  tenantId: string,
  planId: string,
  modificadoPor: string
) {
  const [tenant] = await db
    .update(tenants)
    .set({ planId, modificadoPor, modificadoEn: new Date() })
    .where(eq(tenants.id, tenantId))
    .returning();
  return tenant;
}

export async function actualizarEstadoSuscripcionTenant(
  tenantId: string,
  estadoSuscripcion: (typeof tenants.$inferSelect)["estadoSuscripcion"],
  fechaProximoPago: string | undefined,
  modificadoPor: string
) {
  const [tenant] = await db
    .update(tenants)
    .set({
      estadoSuscripcion,
      ...(fechaProximoPago !== undefined ? { fechaProximoPago } : {}),
      modificadoPor,
      modificadoEn: new Date(),
    })
    .where(eq(tenants.id, tenantId))
    .returning();
  return tenant;
}

export async function actualizarTenant(
  tenantId: string,
  data: DatosActualizarTenant,
  modificadoPor: string
) {
  const [tenant] = await db
    .update(tenants)
    .set({ ...data, modificadoPor, modificadoEn: new Date() })
    .where(eq(tenants.id, tenantId))
    .returning();
  return tenant;
}

// Escritura de un solo uso — el gate de "ya tiene nicho asignado" vive en
// actions.ts (regla de negocio, Modulo_01 seccion 5), acá solo se persiste.
export async function asignarNichoTenant(
  tenantId: string,
  nicho: (typeof tenants.$inferSelect)["nichoId"],
  modificadoPor: string
) {
  const [tenant] = await db
    .update(tenants)
    .set({
      nichoId: nicho,
      nichoAsignadoEn: new Date(),
      modificadoPor,
      modificadoEn: new Date(),
    })
    .where(eq(tenants.id, tenantId))
    .returning();
  return tenant;
}

/** Idempotente — si ya tiene fecha, no la pisa (no queremos que un segundo
 * llamado accidental mueva el timestamp original). */
export async function completarOnboardingTenant(tenantId: string) {
  const tenant = await obtenerTenantPorId(tenantId);
  if (tenant?.onboardingCompletadoEn) return tenant;

  const [actualizado] = await db
    .update(tenants)
    .set({ onboardingCompletadoEn: new Date() })
    .where(eq(tenants.id, tenantId))
    .returning();
  return actualizado;
}

export async function insertarUsuario(data: NuevoUsuario) {
  const [usuario] = await db.insert(usuarios).values(data).returning();
  return usuario;
}

export async function actualizarRolUsuario(
  usuarioId: string,
  rolId: string,
  modificadoPor: string
) {
  const [usuario] = await db
    .update(usuarios)
    .set({ rolId, modificadoPor, modificadoEn: new Date() })
    .where(eq(usuarios.id, usuarioId))
    .returning();
  return usuario;
}

export async function actualizarActivoUsuario(
  usuarioId: string,
  activo: boolean,
  modificadoPor: string
) {
  const [usuario] = await db
    .update(usuarios)
    .set({ activo, modificadoPor, modificadoEn: new Date() })
    .where(eq(usuarios.id, usuarioId))
    .returning();
  return usuario;
}

export async function crearRol(data: NuevoRol) {
  const [rol] = await db.insert(roles).values(data).returning();
  return rol;
}

export async function reemplazarPermisosRol(
  rolId: string,
  filas: Omit<NuevoPermiso, "id" | "rolId">[]
) {
  return db.transaction(async (tx) => {
    await tx.delete(permisos).where(eq(permisos.rolId, rolId));
    if (filas.length === 0) return [];
    return tx
      .insert(permisos)
      .values(filas.map((fila) => ({ ...fila, rolId })))
      .returning();
  });
}

export async function eliminarRolSoft(rolId: string) {
  const [rol] = await db
    .update(roles)
    .set({ eliminadoEn: new Date() })
    .where(eq(roles.id, rolId))
    .returning();
  return rol;
}

/**
 * Upsert (Modulo_01 seccion 13): una fila por (rol, capacidad). El indice
 * unico no es parcial, a diferencia del de usuario, asi que
 * onConflictDoUpdate directo alcanza.
 */
export async function upsertCapacidadEspecialRol(
  rolId: string,
  capacidad: (typeof permisosEspecialesPorRol.$inferSelect)["capacidad"],
  habilitado: boolean
) {
  const [fila] = await db
    .insert(permisosEspecialesPorRol)
    .values({ rolId, capacidad, habilitado })
    .onConflictDoUpdate({
      target: [permisosEspecialesPorRol.rolId, permisosEspecialesPorRol.capacidad],
      set: { habilitado },
    })
    .returning();
  return fila;
}

/**
 * Upsert (Modulo_01 seccion 13.1): a diferencia del de rol, el indice unico
 * de esta tabla es parcial (`where eliminado_en is null`) — Postgres exige
 * que el predicado del indice matchee el de ON CONFLICT, asi que se resuelve
 * a mano (select + insert/update) en vez de onConflictDoUpdate.
 */
export async function upsertCapacidadEspecialUsuario(
  usuarioId: string,
  capacidad: (typeof permisosEspecialesPorUsuario.$inferSelect)["capacidad"],
  habilitado: boolean,
  creadoPor: string
) {
  return db.transaction(async (tx) => {
    const existentes = await tx
      .select()
      .from(permisosEspecialesPorUsuario)
      .where(
        and(
          eq(permisosEspecialesPorUsuario.usuarioId, usuarioId),
          eq(permisosEspecialesPorUsuario.capacidad, capacidad),
          isNull(permisosEspecialesPorUsuario.eliminadoEn)
        )
      )
      .limit(1);

    if (existentes[0]) {
      const [fila] = await tx
        .update(permisosEspecialesPorUsuario)
        .set({ habilitado })
        .where(eq(permisosEspecialesPorUsuario.id, existentes[0].id))
        .returning();
      return fila;
    }

    const [fila] = await tx
      .insert(permisosEspecialesPorUsuario)
      .values({ usuarioId, capacidad, habilitado, creadoPor })
      .returning();
    return fila;
  });
}

/**
 * Atomica (Modulo_01 seccion 6.2/9.1): el destino pasa a Owner, el saliente
 * queda con el rol elegido y esOwner=false. Las validaciones de negocio
 * (mismo tenant, activo, rol no-sistema) ya se resolvieron en actions.ts
 * antes de llegar acá — este nivel solo persiste el cambio.
 */
export async function transferirOwner(input: {
  ownerActualId: string;
  nuevoOwnerId: string;
  rolOwnerId: string;
  rolParaOwnerSaliente: string;
  modificadoPor: string;
}) {
  return db.transaction(async (tx) => {
    const [nuevoOwner] = await tx
      .update(usuarios)
      .set({
        rolId: input.rolOwnerId,
        esOwner: true,
        modificadoPor: input.modificadoPor,
        modificadoEn: new Date(),
      })
      .where(eq(usuarios.id, input.nuevoOwnerId))
      .returning();

    const [ownerSaliente] = await tx
      .update(usuarios)
      .set({
        rolId: input.rolParaOwnerSaliente,
        esOwner: false,
        modificadoPor: input.modificadoPor,
        modificadoEn: new Date(),
      })
      .where(eq(usuarios.id, input.ownerActualId))
      .returning();

    return { nuevoOwner, ownerSaliente };
  });
}
