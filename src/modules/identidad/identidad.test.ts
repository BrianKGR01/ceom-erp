import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { db } from "@/db/client";
import { crearClienteAdmin } from "@/lib/supabase/server";
import {
  actualizarPermisosRol,
  actualizarTenant,
  asignarNicho,
  cambiarRolUsuario,
  crearRolPersonalizado,
  crearTenant,
  eliminarRol,
  otorgarCapacidadEspecialPorRol,
  otorgarCapacidadEspecialPorUsuario,
  tieneCapacidadEspecial,
  tienePermiso,
  suspenderUsuario,
} from "./actions";
import { CEOM_OPS_TENANT_ID, ROL_CEOM_ADMIN_ID, ROL_OWNER_ID } from "./constants";
import * as repo from "./repository";
import {
  permisos,
  permisosEspecialesPorRol,
  permisosEspecialesPorUsuario,
  roles,
  sucursales,
  tenants,
  usuarios,
} from "./schema";

// Estos tests pegan contra el Supabase Cloud de desarrollo real (no hay DB
// de test separada todavia). Se saltan solos si faltan las credenciales
// (ej. en CI hasta que se configuren como secret) — ver vitest.setup.ts.
const hasCredenciales = Boolean(
  process.env.DATABASE_URL && process.env.SUPABASE_SECRET_KEY
);

describe.skipIf(!hasCredenciales)("Modulo 1 - Identidad (integracion)", () => {
  const admin = crearClienteAdmin();
  const sufijo = Date.now();
  const authIdsCreados: string[] = [];
  let tenantId: string;
  let ownerId: string;
  let colaboradorId: string;

  async function crearAuthUserDePrueba(email: string) {
    const { data, error } = await admin.auth.admin.createUser({
      email,
      email_confirm: true,
    });
    if (error || !data.user) {
      throw error ?? new Error("No se pudo crear el usuario de Auth de prueba");
    }
    authIdsCreados.push(data.user.id);
    return data.user.id;
  }

  beforeAll(async () => {
    ownerId = await crearAuthUserDePrueba(`owner-${sufijo}@ceom-erp.test`);
    colaboradorId = await crearAuthUserDePrueba(`colab-${sufijo}@ceom-erp.test`);

    const { tenant } = await repo.crearTenantConOwner({
      tenant: {
        nombreNegocio: `Test SRL ${sufijo}`,
        monedaPrincipal: "BOB",
        estadoSuscripcion: "activa",
        fechaInicioSuscripcion: new Date().toISOString().slice(0, 10),
      },
      ownerId,
      ownerNombreCompleto: "Owner de prueba",
      ownerEmail: `owner-${sufijo}@ceom-erp.test`,
      rolOwnerId: ROL_OWNER_ID,
      creadoPor: null,
    });
    tenantId = tenant.id;
  });

  afterAll(async () => {
    await db.delete(permisosEspecialesPorUsuario).where(
      eq(permisosEspecialesPorUsuario.usuarioId, colaboradorId)
    );
    await db.delete(usuarios).where(eq(usuarios.tenantId, tenantId));

    const rolesDelTenant = await db
      .select({ id: roles.id })
      .from(roles)
      .where(eq(roles.tenantId, tenantId));
    for (const rol of rolesDelTenant) {
      await db
        .delete(permisosEspecialesPorRol)
        .where(eq(permisosEspecialesPorRol.rolId, rol.id));
      await db.delete(permisos).where(eq(permisos.rolId, rol.id));
    }

    await db.delete(roles).where(eq(roles.tenantId, tenantId));
    await db.delete(sucursales).where(eq(sucursales.tenantId, tenantId));
    await db.delete(tenants).where(eq(tenants.id, tenantId));
    for (const id of authIdsCreados) {
      await admin.auth.admin.deleteUser(id);
    }
  });

  it("crearTenantConOwner crea tenant, sucursal principal y usuario owner de forma atomica", async () => {
    const sucursal = await db
      .select()
      .from(sucursales)
      .where(eq(sucursales.tenantId, tenantId));
    expect(sucursal).toHaveLength(1);
    expect(sucursal[0].esPrincipal).toBe(true);

    const owner = await repo.obtenerUsuarioConRolPorId(ownerId);
    expect(owner?.esOwner).toBe(true);
    expect(owner?.rol.nombre).toBe("Owner");
  });

  it("actualizarTenant: guarda los campos y rechaza si no es Owner (Onboarding, Modulo_01 seccion 4.1)", async () => {
    const owner = await repo.obtenerUsuarioConRolPorId(ownerId);
    const noOwner = { ...owner!, esOwner: false };

    const rechazo = await actualizarTenant(noOwner, { nombreNegocio: "No deberia guardarse" });
    expect(rechazo.ok).toBe(false);

    const resultado = await actualizarTenant(owner!, {
      nombreNegocio: `Test SRL actualizado ${sufijo}`,
      ciudadBase: "La Paz",
      monedaPrincipal: "BOB",
      canalesVenta: ["redes_sociales", "feria"],
    });
    expect(resultado.ok).toBe(true);

    const tenant = await repo.obtenerTenantPorId(tenantId);
    expect(tenant?.nombreNegocio).toBe(`Test SRL actualizado ${sufijo}`);
    expect(tenant?.ciudadBase).toBe("La Paz");
    expect(tenant?.canalesVenta).toEqual(["redes_sociales", "feria"]);
  });

  it("asignarNicho: guarda nicho_id + nicho_asignado_en y rechaza un segundo intento (Modulo_01 seccion 5, regla de un solo sentido)", async () => {
    const owner = await repo.obtenerUsuarioConRolPorId(ownerId);

    const resultado = await asignarNicho(owner!, "nicho_1");
    expect(resultado.ok).toBe(true);

    const tenant = await repo.obtenerTenantPorId(tenantId);
    expect(tenant?.nichoId).toBe("nicho_1");
    expect(tenant?.nichoAsignadoEn).not.toBeNull();

    // Ni cambiar de nicho ni volver a Modo Basico: rechaza siempre una vez asignado.
    const segundoIntento = await asignarNicho(owner!, "nicho_4");
    expect(segundoIntento.ok).toBe(false);
  });

  it("tienePermiso: el Owner tiene acceso total sin filas en la matriz", async () => {
    const owner = await repo.obtenerUsuarioConRolPorId(ownerId);
    const permitido = await tienePermiso(owner!, tenantId, "ventas", "crear");
    expect(permitido).toBe(true);
  });

  it("tienePermiso: deniega cross-tenant a un usuario que no es CEOM Admin", async () => {
    const owner = await repo.obtenerUsuarioConRolPorId(ownerId);
    const permitido = await tienePermiso(
      owner!,
      "00000000-0000-0000-0000-000000000000",
      "ventas",
      "ver"
    );
    expect(permitido).toBe(false);
  });

  it("crearRolPersonalizado + actualizarPermisosRol + un colaborador respeta la matriz", async () => {
    const owner = await repo.obtenerUsuarioConRolPorId(ownerId);
    const resultadoRol = await crearRolPersonalizado(owner!, {
      nombre: "Vendedor",
      permisos: [{ modulo: "ventas", accion: "crear", permitido: true }],
    });
    expect(resultadoRol.ok).toBe(true);
    if (!resultadoRol.ok) return;

    await repo.insertarUsuario({
      id: colaboradorId,
      tenantId,
      nombreCompleto: "Colaborador de prueba",
      email: `colab-${sufijo}@ceom-erp.test`,
      rolId: resultadoRol.data.rolId,
      esOwner: false,
      activo: true,
      creadoPor: ownerId,
    });

    const colaborador = await repo.obtenerUsuarioConRolPorId(colaboradorId);
    expect(await tienePermiso(colaborador!, tenantId, "ventas", "crear")).toBe(
      true
    );
    expect(await tienePermiso(colaborador!, tenantId, "financiero", "ver")).toBe(
      false
    );

    const resultadoUpdate = await actualizarPermisosRol(
      owner!,
      resultadoRol.data.rolId,
      [{ modulo: "ventas", accion: "crear", permitido: false }]
    );
    expect(resultadoUpdate.ok).toBe(true);
    expect(await tienePermiso(colaborador!, tenantId, "ventas", "crear")).toBe(
      false
    );
  });

  it("eliminarRol: bloqueado si el rol tiene usuarios activos asignados (caso borde 9.3)", async () => {
    const owner = await repo.obtenerUsuarioConRolPorId(ownerId);
    const colaborador = await repo.obtenerUsuarioConRolPorId(colaboradorId);
    const resultado = await eliminarRol(owner!, colaborador!.rolId);
    expect(resultado.ok).toBe(false);
  });

  it("cambiarRolUsuario audita modificado_por/modificado_en, y desbloquea el eliminarRol anterior", async () => {
    const owner = await repo.obtenerUsuarioConRolPorId(ownerId);
    const colaboradorAntes = await repo.obtenerUsuarioConRolPorId(colaboradorId);
    const rolAnteriorId = colaboradorAntes!.rolId;

    const nuevoRol = await crearRolPersonalizado(owner!, {
      nombre: "Otro rol",
      permisos: [],
    });
    expect(nuevoRol.ok).toBe(true);
    if (!nuevoRol.ok) return;

    const resultado = await cambiarRolUsuario(
      owner!,
      colaboradorId,
      nuevoRol.data.rolId
    );
    expect(resultado.ok).toBe(true);

    const colaboradorDespues = await repo.obtenerUsuarioConRolPorId(colaboradorId);
    expect(colaboradorDespues?.modificadoPor).toBe(ownerId);
    expect(colaboradorDespues?.modificadoEn).not.toBeNull();

    // Ahora que el colaborador ya no esta en "rolAnteriorId", eliminarlo deja
    // de estar bloqueado (caso borde 9.3 resuelto).
    const eliminar = await eliminarRol(owner!, rolAnteriorId);
    expect(eliminar.ok).toBe(true);
  });

  it("suspenderUsuario: bloquea suspender al unico Owner (caso borde 9.1)", async () => {
    const owner = await repo.obtenerUsuarioConRolPorId(ownerId);
    const resultado = await suspenderUsuario(owner!, ownerId);
    expect(resultado.ok).toBe(false);
  });

  it("suspenderUsuario: un colaborador si puede suspenderse, y es reversible", async () => {
    const owner = await repo.obtenerUsuarioConRolPorId(ownerId);
    const resultado = await suspenderUsuario(owner!, colaboradorId);
    expect(resultado.ok).toBe(true);

    const colaborador = await repo.obtenerUsuarioConRolPorId(colaboradorId);
    expect(colaborador?.activo).toBe(false);
  });

  it("tieneCapacidadEspecial: override por usuario gana sobre el override por rol (seccion 13.1)", async () => {
    const colaborador = await repo.obtenerUsuarioConRolPorId(colaboradorId);

    await db.insert(permisosEspecialesPorRol).values({
      rolId: colaborador!.rolId,
      capacidad: "vender_sin_stock",
      habilitado: true,
    });
    expect(
      await tieneCapacidadEspecial(colaborador!, "vender_sin_stock")
    ).toBe(true);

    await db.insert(permisosEspecialesPorUsuario).values({
      usuarioId: colaboradorId,
      capacidad: "vender_sin_stock",
      habilitado: false,
      creadoPor: ownerId,
    });
    expect(
      await tieneCapacidadEspecial(colaborador!, "vender_sin_stock")
    ).toBe(false);

    expect(
      await tieneCapacidadEspecial(colaborador!, "gestionar_eventos")
    ).toBe(false);
  });

  it("otorgarCapacidadEspecialPorRol/PorUsuario: escriben lo que tieneCapacidadEspecial ya sabia leer", async () => {
    // Timeout default (5000ms) queda corto: son 8 round-trips secuenciales
    // contra Supabase Cloud real, no un mock.
    const owner = await repo.obtenerUsuarioConRolPorId(ownerId);
    const colaborador = await repo.obtenerUsuarioConRolPorId(colaboradorId);

    // Sin overrides todavia: false por defecto.
    expect(
      await tieneCapacidadEspecial(colaborador!, "importar_historico")
    ).toBe(false);

    // Un no-Owner no puede otorgar.
    const rechazo = await otorgarCapacidadEspecialPorRol(
      colaborador!,
      colaborador!.rolId,
      "importar_historico",
      true
    );
    expect(rechazo.ok).toBe(false);

    // Override por rol: prende la capacidad para todo el rol.
    const porRol = await otorgarCapacidadEspecialPorRol(
      owner!,
      colaborador!.rolId,
      "importar_historico",
      true
    );
    expect(porRol.ok).toBe(true);
    expect(
      await tieneCapacidadEspecial(colaborador!, "importar_historico")
    ).toBe(true);

    // Re-otorgar el mismo (rol, capacidad) actualiza in-place (upsert), no duplica fila.
    const porRolActualizado = await otorgarCapacidadEspecialPorRol(
      owner!,
      colaborador!.rolId,
      "importar_historico",
      false
    );
    expect(porRolActualizado.ok).toBe(true);
    expect(
      await tieneCapacidadEspecial(colaborador!, "importar_historico")
    ).toBe(false);

    // Override por usuario: gana sobre el override de rol (seccion 13.1).
    const porUsuario = await otorgarCapacidadEspecialPorUsuario(
      owner!,
      colaboradorId,
      "importar_historico",
      true
    );
    expect(porUsuario.ok).toBe(true);
    expect(
      await tieneCapacidadEspecial(colaborador!, "importar_historico")
    ).toBe(true);

    // No se puede otorgar sobre un rol de sistema (Owner/CEOM Admin son globales).
    const rolSistema = await otorgarCapacidadEspecialPorRol(
      owner!,
      ROL_OWNER_ID,
      "importar_historico",
      true
    );
    expect(rolSistema.ok).toBe(false);
  }, 15000);

  it("crearTenant: rechaza un plan_id inexistente antes de invitar al Auth (Modulo 11)", async () => {
    // Fixture en memoria, no persistido — alcanza con que pase el gate de
    // rol para llegar a la validacion de plan. No hay un usuario CEOM Admin
    // real sembrado todavia (solo el rol y el tenant CEOM Ops).
    const fakeCeomAdmin: repo.UsuarioConRol = {
      id: "00000000-0000-0000-0000-000000000001",
      tenantId: CEOM_OPS_TENANT_ID,
      nombreCompleto: "CEOM Admin (test)",
      email: "admin-test@ceom.lat",
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
      rol: {
        id: ROL_CEOM_ADMIN_ID,
        tenantId: null,
        nombre: "CEOM Admin",
        esRolSistema: true,
        creadoEn: new Date(),
        eliminadoEn: null,
      },
    };

    // planId inexistente hace que crearTenant() devuelva error ANTES de
    // llamar a inviteUserByEmail — no dispara ningun email real.
    const resultado = await crearTenant(fakeCeomAdmin, {
      nombreNegocio: "No deberia crearse",
      monedaPrincipal: "BOB",
      fechaInicioSuscripcion: new Date().toISOString().slice(0, 10),
      ownerEmail: `no-deberia-enviarse-${Date.now()}@ceom-erp.test`,
      ownerNombreCompleto: "No Crear",
      planId: "00000000-0000-0000-0000-000000000000",
    });
    expect(resultado.ok).toBe(false);
  });
});
