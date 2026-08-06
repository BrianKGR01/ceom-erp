import { and, eq, inArray, isNull } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { db } from "@/db/client";
import { crearClienteAdmin } from "@/lib/supabase/server";
import { borrarUsuariosAuth, limpiarConAuthGarantizada, limpiarEnParalelo } from "@/test-utils/limpieza";
import {
  actualizarPermisosRol,
  actualizarSucursal,
  actualizarTenant,
  asignarNicho,
  cambiarEstadoSuscripcion,
  cambiarPlanTenant,
  cambiarRolUsuario,
  crearRolPersonalizado,
  crearSucursal,
  crearTenant,
  desbloquearSucursal,
  eliminarRol,
  eliminarSucursal,
  invitarUsuario,
  listarCapacidadesEspeciales,
  listarPermisosPorRol,
  listarRoles,
  listarSucursalesPorTenant,
  listarUsuarios,
  otorgarCapacidadEspecialPorRol,
  otorgarCapacidadEspecialPorUsuario,
  reactivarUsuario,
  tieneCapacidadEspecial,
  tienePermiso,
  transferirOwner,
  suspenderUsuario,
} from "./actions";
import {
  CEOM_OPS_TENANT_ID,
  ROL_CEOM_ADMIN_ID,
  ROL_GATEWAY_SISTEMA_ID,
  ROL_OWNER_ID,
} from "./constants";
import { crearPlan, PLAN_BASICO_ID } from "@/modules/suscripcion/actions";
import { planes } from "@/modules/suscripcion/schema";
import {
  consolidarStockDeSucursal,
  consultarStock,
  consultarStockTotalPorSucursal,
  crearProducto,
  registrarAjusteManualStock,
} from "@/modules/productos/actions";
import { movimientosStock, productos, stock } from "@/modules/productos/schema";
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

// crearTenant()/invitarUsuario() exigen el destino del enlace del correo. En
// los tests de abajo nunca se llega a enviarlo (cortan antes, a proposito),
// pero el parametro es obligatorio justamente para que nadie invite sin
// decidir a donde aterriza la persona.
const CALLBACK_DE_PRUEBA = "http://localhost:3000/app/auth/callback";

describe.skipIf(!hasCredenciales)("Modulo 1 - Identidad (integracion)", () => {
  let admin: ReturnType<typeof crearClienteAdmin>;
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
    admin = crearClienteAdmin();
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
    await limpiarConAuthGarantizada(
      async () => {
        await limpiarEnParalelo([
          () => db.delete(planes).where(eq(planes.nombre, `Plan QA ${sufijo}`)),
          () =>
            db
              .delete(permisosEspecialesPorUsuario)
              .where(inArray(permisosEspecialesPorUsuario.usuarioId, [ownerId, colaboradorId])),
        ]);
        await db.delete(usuarios).where(eq(usuarios.tenantId, tenantId));

        const rolesDelTenant = db.select({ id: roles.id }).from(roles).where(eq(roles.tenantId, tenantId));
        await limpiarEnParalelo([
          () => db.delete(permisosEspecialesPorRol).where(inArray(permisosEspecialesPorRol.rolId, rolesDelTenant)),
          () => db.delete(permisos).where(inArray(permisos.rolId, rolesDelTenant)),
        ]);

        await db.delete(roles).where(eq(roles.tenantId, tenantId));
        await db.delete(sucursales).where(eq(sucursales.tenantId, tenantId));
        await db.delete(tenants).where(eq(tenants.id, tenantId));
      },
      // `Promise.all` cortaba en el primer rechazo y dejaba los demás usuarios
      // de Auth sin borrar -- `limpiarEnParalelo` los intenta todos igual.
      () => borrarUsuariosAuth(admin, authIdsCreados)
    );
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

  it("cambiarRolUsuario/invitarUsuario rechazan asignar un rol de sistema (Owner/CEOM Admin) — nunca por este camino", async () => {
    const owner = await repo.obtenerUsuarioConRolPorId(ownerId);

    const cambioAOwner = await cambiarRolUsuario(owner!, colaboradorId, ROL_OWNER_ID);
    expect(cambioAOwner.ok).toBe(false);

    const cambioACeomAdmin = await cambiarRolUsuario(owner!, colaboradorId, ROL_CEOM_ADMIN_ID);
    expect(cambioACeomAdmin.ok).toBe(false);

    const invitacionComoOwner = await invitarUsuario(
      owner!,
      {
        email: `no-deberia-invitarse-${Date.now()}@ceom-erp.test`,
        nombreCompleto: "No deberia invitarse",
        rolId: ROL_CEOM_ADMIN_ID,
      },
      CALLBACK_DE_PRUEBA
    );
    expect(invitacionComoOwner.ok).toBe(false);
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

  it("tieneCapacidadEspecial: el Owner tiene bypass incondicional (seccion 6.2), incluso sobre un override propio en false", async () => {
    const owner = await repo.obtenerUsuarioConRolPorId(ownerId);

    // Sin ningun override cargado: el Owner igual pasa (antes de este fix,
    // esto devolvia false — el bug que esta tarea cierra).
    expect(await tieneCapacidadEspecial(owner!, "vender_sin_stock")).toBe(true);

    // Incondicional de verdad: ni siquiera un override explicito del propio
    // Owner en false lo puede reducir (seccion 6.2: "de forma permanente y
    // no editable").
    await db.insert(permisosEspecialesPorUsuario).values({
      usuarioId: ownerId,
      capacidad: "vender_sin_stock",
      habilitado: false,
      creadoPor: ownerId,
    });
    expect(await tieneCapacidadEspecial(owner!, "vender_sin_stock")).toBe(true);
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

  it("listarUsuarios: devuelve los colaboradores del tenant, rechaza a un no-Owner", async () => {
    const owner = await repo.obtenerUsuarioConRolPorId(ownerId);
    const resultado = await listarUsuarios(owner!);
    expect(resultado.ok).toBe(true);
    if (!resultado.ok) return;
    expect(resultado.data.map((u) => u.id)).toContain(ownerId);
    expect(resultado.data.map((u) => u.id)).toContain(colaboradorId);

    const colaborador = await repo.obtenerUsuarioConRolPorId(colaboradorId);
    const rechazo = await listarUsuarios(colaborador!);
    expect(rechazo.ok).toBe(false);
  });

  it("listarRoles: incluye roles de sistema (Owner/CEOM Admin) + personalizados, con conteo de colaboradores relativo al tenant", async () => {
    const owner = await repo.obtenerUsuarioConRolPorId(ownerId);
    const resultado = await listarRoles(owner!);
    expect(resultado.ok).toBe(true);
    if (!resultado.ok) return;

    const filaOwner = resultado.data.find((r) => r.id === ROL_OWNER_ID);
    expect(filaOwner).toBeDefined();
    expect(filaOwner!.colaboradores).toBe(1); // solo el Owner de este tenant

    const filaCeomAdmin = resultado.data.find((r) => r.id === ROL_CEOM_ADMIN_ID);
    expect(filaCeomAdmin).toBeDefined();
    expect(filaCeomAdmin!.colaboradores).toBe(0); // CEOM Admin no tiene colaboradores en este tenant

    const colaboradorActual = await repo.obtenerUsuarioConRolPorId(colaboradorId);
    const filaRolColaborador = resultado.data.find((r) => r.id === colaboradorActual!.rolId);
    expect(filaRolColaborador!.tenantId).toBe(tenantId);

    // OBS-10: el rol del Gateway de Consentimiento tambien tiene
    // tenant_id null, asi que la query del repositorio lo trae junto a
    // Owner/CEOM Admin. Es una identidad interna del backstop de RLS y no
    // tiene que llegar nunca a la pantalla de Roles del negocio.
    expect(resultado.data.find((r) => r.id === ROL_GATEWAY_SISTEMA_ID)).toBeUndefined();
    // Y el repositorio SI lo sigue trayendo: el filtro es de presentacion,
    // no un cambio en la consulta ni en la policy de RLS.
    const crudos = await repo.listarRolesPorTenant(tenantId);
    expect(crudos.find((r) => r.id === ROL_GATEWAY_SISTEMA_ID)).toBeDefined();
  });

  it("listarPermisosPorRol: devuelve la matriz de un rol personalizado, vacio para Owner (sin filas, seccion 6.2)", async () => {
    const owner = await repo.obtenerUsuarioConRolPorId(ownerId);
    const colaborador = await repo.obtenerUsuarioConRolPorId(colaboradorId);

    const permisosOwner = await listarPermisosPorRol(owner!, ROL_OWNER_ID);
    expect(permisosOwner.ok).toBe(true);
    if (permisosOwner.ok) expect(permisosOwner.data).toEqual([]);

    const permisosColaborador = await listarPermisosPorRol(owner!, colaborador!.rolId);
    expect(permisosColaborador.ok).toBe(true);
  });

  it("listarCapacidadesEspeciales: porRol excluye roles de sistema, porUsuario refleja los overrides ya otorgados", async () => {
    const owner = await repo.obtenerUsuarioConRolPorId(ownerId);
    const resultado = await listarCapacidadesEspeciales(owner!);
    expect(resultado.ok).toBe(true);
    if (!resultado.ok) return;

    expect(resultado.data.porRol.some((f) => f.rolId === ROL_OWNER_ID)).toBe(false);
    // El override por usuario de "vender_sin_stock" (habilitado:false) se otorgo
    // en el test de tieneCapacidadEspecial, mas arriba en este archivo.
    const overrideUsuario = resultado.data.porUsuario.find(
      (f) => f.usuarioId === colaboradorId && f.capacidad === "vender_sin_stock"
    );
    expect(overrideUsuario?.habilitado).toBe(false);
  });

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
      sucursalId: null,
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
    const resultado = await crearTenant(
      fakeCeomAdmin,
      {
        nombreNegocio: "No deberia crearse",
        monedaPrincipal: "BOB",
        fechaInicioSuscripcion: new Date().toISOString().slice(0, 10),
        ownerEmail: `no-deberia-enviarse-${Date.now()}@ceom-erp.test`,
        ownerNombreCompleto: "No Crear",
        planId: "00000000-0000-0000-0000-000000000000",
      },
      CALLBACK_DE_PRUEBA
    );
    expect(resultado.ok).toBe(false);
  });

  it("cambiarPlanTenant: rechaza a un no-ceom_admin y un plan inexistente/inactivo, persiste un cambio valido", async () => {
    const fakeCeomAdmin: repo.UsuarioConRol = {
      id: "00000000-0000-0000-0000-000000000001",
      tenantId: CEOM_OPS_TENANT_ID,
      nombreCompleto: "CEOM Admin (test)",
      email: "admin-test@ceom.lat",
      telefono: null,
      rolId: ROL_CEOM_ADMIN_ID,
      sucursalId: null,
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
    const owner = await repo.obtenerUsuarioConRolPorId(ownerId);

    const rechazoNoAdmin = await cambiarPlanTenant(owner!, tenantId, PLAN_BASICO_ID);
    expect(rechazoNoAdmin.ok).toBe(false);

    const rechazoPlanInexistente = await cambiarPlanTenant(
      fakeCeomAdmin,
      tenantId,
      "00000000-0000-0000-0000-000000000000"
    );
    expect(rechazoPlanInexistente.ok).toBe(false);

    const planNuevo = await crearPlan(
      { rolId: ROL_CEOM_ADMIN_ID, rol: { esRolSistema: true } },
      { nombre: `Plan QA ${sufijo}`, precioMensual: 10, moneda: "BOB" }
    );
    expect(planNuevo.ok).toBe(true);
    if (!planNuevo.ok) return;

    const cambioOk = await cambiarPlanTenant(fakeCeomAdmin, tenantId, planNuevo.data.planId);
    expect(cambioOk.ok).toBe(true);

    const tenantActualizado = await repo.obtenerTenantPorId(tenantId);
    expect(tenantActualizado?.planId).toBe(planNuevo.data.planId);

    // Deja el tenant en el plan Básico de nuevo, sin efecto para otros tests.
    await cambiarPlanTenant(fakeCeomAdmin, tenantId, PLAN_BASICO_ID);
  });

  it("cambiarEstadoSuscripcion: rechaza a un no-ceom_admin, persiste estado + fecha_proximo_pago", async () => {
    const fakeCeomAdmin: repo.UsuarioConRol = {
      id: "00000000-0000-0000-0000-000000000001",
      tenantId: CEOM_OPS_TENANT_ID,
      nombreCompleto: "CEOM Admin (test)",
      email: "admin-test@ceom.lat",
      telefono: null,
      rolId: ROL_CEOM_ADMIN_ID,
      sucursalId: null,
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
    const owner = await repo.obtenerUsuarioConRolPorId(ownerId);

    const rechazoNoAdmin = await cambiarEstadoSuscripcion(owner!, tenantId, "pausada");
    expect(rechazoNoAdmin.ok).toBe(false);

    const fechaProximoPago = "2026-08-01";
    const cambioOk = await cambiarEstadoSuscripcion(
      fakeCeomAdmin,
      tenantId,
      "vencida",
      fechaProximoPago
    );
    expect(cambioOk.ok).toBe(true);

    const tenantActualizado = await repo.obtenerTenantPorId(tenantId);
    expect(tenantActualizado?.estadoSuscripcion).toBe("vencida");
    expect(tenantActualizado?.fechaProximoPago).toBe(fechaProximoPago);

    // Deja el tenant activo de nuevo, sin efecto para otros tests.
    await cambiarEstadoSuscripcion(fakeCeomAdmin, tenantId, "activa");
  });

  // transferirOwner al final del archivo: cambia esOwner de forma permanente,
  // no debe correr antes de ningun test que asuma "owner!.esOwner === true".
  describe("transferirOwner (Modulo_01 seccion 6.2/9.1)", () => {
    it("rechaza si el solicitante no es Owner", async () => {
      const colaborador = await repo.obtenerUsuarioConRolPorId(colaboradorId);
      const resultado = await transferirOwner(colaborador!, ownerId, colaborador!.rolId);
      expect(resultado.ok).toBe(false);
    });

    it("rechaza un destino de otro tenant", async () => {
      const owner = await repo.obtenerUsuarioConRolPorId(ownerId);
      const resultado = await transferirOwner(
        owner!,
        "00000000-0000-0000-0000-000000000000",
        owner!.rolId
      );
      expect(resultado.ok).toBe(false);
    });

    it("rechaza un destino inactivo (colaboradorId sigue suspendido desde el test de suspenderUsuario)", async () => {
      const owner = await repo.obtenerUsuarioConRolPorId(ownerId);
      const colaborador = await repo.obtenerUsuarioConRolPorId(colaboradorId);
      expect(colaborador!.activo).toBe(false); // precondicion del test, no un fixture nuevo

      const resultado = await transferirOwner(owner!, colaboradorId, colaborador!.rolId);
      expect(resultado.ok).toBe(false);
    });

    it("rechaza un rol de sistema para el Owner saliente", async () => {
      const owner = await repo.obtenerUsuarioConRolPorId(ownerId);
      await reactivarUsuario(owner!, colaboradorId); // reactiva para los tests siguientes de este describe
      const resultado = await transferirOwner(owner!, colaboradorId, ROL_OWNER_ID);
      expect(resultado.ok).toBe(false);
    });

    it("rechaza un rol de otro tenant para el Owner saliente", async () => {
      const owner = await repo.obtenerUsuarioConRolPorId(ownerId);
      // Reusa el rol de sistema-como-otro-tenant: cualquier rolId que no
      // pertenezca a este tenant y no sea de sistema sirve para probar el
      // rechazo — no hay un segundo tenant de prueba en este archivo, asi
      // que se valida contra un uuid que no existe (mismo efecto: la
      // condicion "pertenece a este tenant" falla igual que "no existe").
      const resultado = await transferirOwner(
        owner!,
        colaboradorId,
        "00000000-0000-0000-0000-000000000000"
      );
      expect(resultado.ok).toBe(false);
    });

    it("transfiere la condicion de Owner de forma atomica", async () => {
      const owner = await repo.obtenerUsuarioConRolPorId(ownerId);
      const rolParaSaliente = await crearRolPersonalizado(owner!, {
        nombre: "Ex-Owner",
        permisos: [],
      });
      expect(rolParaSaliente.ok).toBe(true);
      if (!rolParaSaliente.ok) return;

      const resultado = await transferirOwner(owner!, colaboradorId, rolParaSaliente.data.rolId);
      expect(resultado.ok).toBe(true);

      const nuevoOwner = await repo.obtenerUsuarioConRolPorId(colaboradorId);
      expect(nuevoOwner?.esOwner).toBe(true);
      expect(nuevoOwner?.rolId).toBe(ROL_OWNER_ID);

      const exOwner = await repo.obtenerUsuarioConRolPorId(ownerId);
      expect(exOwner?.esOwner).toBe(false);
      expect(exOwner?.rolId).toBe(rolParaSaliente.data.rolId);

      // El tenant sigue teniendo exactamente un Owner activo (nunca 0, nunca 2).
      expect(await repo.contarOwnersActivos(tenantId)).toBe(1);
    });
  });
});

// Tenant y plan dedicados, separados del describe de arriba, para no
// interferir con tests que asumen "esta cuenta tiene una sola sucursal" ni
// pisar la limpieza del `Plan QA ${sufijo}` que ya usan otros tests de este
// archivo — ver docs/auditoria-prelanzamiento/antiguo/07-sucursales-multiples.md
// seccion 9 (H-02).
describe.skipIf(!hasCredenciales)("Modulo 1 - Sucursales multiples (H-02, integracion)", () => {
  let admin: ReturnType<typeof crearClienteAdmin>;
  const sufijo = Date.now();
  const authIdsCreados: string[] = [];
  let tenantId: string;
  let ownerId: string;
  let planUnaId: string;
  let planTresId: string;

  const fakeCeomAdmin = {
    id: "00000000-0000-0000-0000-000000000002",
    tenantId: CEOM_OPS_TENANT_ID,
    nombreCompleto: "CEOM Admin (test sucursales)",
    email: "admin-test-sucursales@ceom.lat",
    telefono: null,
    rolId: ROL_CEOM_ADMIN_ID,
    sucursalId: null,
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
  } as repo.UsuarioConRol;

  async function crearAuthUserDePrueba(email: string) {
    const { data, error } = await admin.auth.admin.createUser({ email, email_confirm: true });
    if (error || !data.user) throw error ?? new Error("No se pudo crear el usuario de Auth de prueba");
    authIdsCreados.push(data.user.id);
    return data.user.id;
  }

  beforeAll(async () => {
    admin = crearClienteAdmin();
    ownerId = await crearAuthUserDePrueba(`owner-sucursales-${sufijo}@ceom-erp.test`);

    const planUna = await crearPlan(fakeCeomAdmin, {
      nombre: `Plan QA Sucursales Una ${sufijo}`,
      precioMensual: 10,
      moneda: "BOB",
      maxSucursales: 1,
    });
    if (!planUna.ok) throw new Error(planUna.error);
    planUnaId = planUna.data.planId;

    const planTres = await crearPlan(fakeCeomAdmin, {
      nombre: `Plan QA Sucursales Tres ${sufijo}`,
      precioMensual: 20,
      moneda: "BOB",
      maxSucursales: 3,
    });
    if (!planTres.ok) throw new Error(planTres.error);
    planTresId = planTres.data.planId;

    const { tenant } = await repo.crearTenantConOwner({
      tenant: {
        nombreNegocio: `Test Sucursales SRL ${sufijo}`,
        monedaPrincipal: "BOB",
        planId: planTresId,
        estadoSuscripcion: "activa",
        fechaInicioSuscripcion: new Date().toISOString().slice(0, 10),
      },
      ownerId,
      ownerNombreCompleto: "Owner Sucursales de prueba",
      ownerEmail: `owner-sucursales-${sufijo}@ceom-erp.test`,
      rolOwnerId: ROL_OWNER_ID,
      creadoPor: null,
    });
    tenantId = tenant.id;
  }, 20000);

  afterAll(async () => {
    await limpiarConAuthGarantizada(async () => {
      const productoIds = db.select({ id: productos.id }).from(productos).where(eq(productos.tenantId, tenantId));
      await db.delete(movimientosStock).where(inArray(movimientosStock.productoId, productoIds));
      await db.delete(stock).where(inArray(stock.productoId, productoIds));
      await db.delete(productos).where(eq(productos.tenantId, tenantId));
      await db.delete(usuarios).where(eq(usuarios.tenantId, tenantId));
      await db.delete(sucursales).where(eq(sucursales.tenantId, tenantId));
      await db.delete(tenants).where(eq(tenants.id, tenantId));
      await limpiarEnParalelo([
        () => db.delete(planes).where(eq(planes.id, planUnaId)),
        () => db.delete(planes).where(eq(planes.id, planTresId)),
      ]);
    }, () => borrarUsuariosAuth(admin, authIdsCreados));
  }, 20000);

  it("crearSucursal: rechaza sin permiso de Owner y sin cupo de plan (server-side, no solo la UI), acepta dentro del cupo", async () => {
    const owner = await repo.obtenerUsuarioConRolPorId(ownerId);

    // Tenant arranca en el plan de 3 -- ya tiene 1 (Principal), quedan 2 cupos.
    const primera = await crearSucursal(owner!, tenantId, { nombre: `Sucursal B ${sufijo}` });
    expect(primera.ok).toBe(true);
    const segunda = await crearSucursal(owner!, tenantId, { nombre: `Sucursal C ${sufijo}` });
    expect(segunda.ok).toBe(true);

    // Cupo agotado (Principal + B + C = 3, tope del plan).
    const tercera = await crearSucursal(owner!, tenantId, { nombre: `Sucursal D ${sufijo}` });
    expect(tercera.ok).toBe(false);

    // Rota el plan a "1" (sin sucursales adicionales) y confirma que el
    // gate de plan se aplica server-side aunque la lista ya tenga 3 filas --
    // no es solo "esconder el botón", una llamada directa a la Server
    // Action tiene que rechazar igual.
    const cambio = await cambiarPlanTenant(fakeCeomAdmin, tenantId, planUnaId);
    expect(cambio.ok).toBe(true);
    const cuartaConPlanUna = await crearSucursal(owner!, tenantId, { nombre: `Sucursal E ${sufijo}` });
    expect(cuartaConPlanUna.ok).toBe(false);
    if (!cuartaConPlanUna.ok) {
      expect(cuartaConPlanUna.error).toMatch(/no incluye sucursales|permite hasta/i);
    }

    // Vuelve al plan de 3 para no interferir con el resto de los tests de este bloque.
    await cambiarPlanTenant(fakeCeomAdmin, tenantId, planTresId);
  }, 20000);

  it("cambiarPlanTenant: congela atómicamente el excedente al bajar de plan (más nuevas primero), la Principal nunca se congela, y actualizarSucursal/desbloquearSucursal/eliminarSucursal operan sobre el resultado", async () => {
    const owner = await repo.obtenerUsuarioConRolPorId(ownerId);

    // Sucursales de este test, en orden de creación (creado_en creciente).
    const f1 = await crearSucursal(owner!, tenantId, { nombre: `Freeze Vieja ${sufijo}` });
    const f2 = await crearSucursal(owner!, tenantId, { nombre: `Freeze Nueva ${sufijo}` });
    expect(f1.ok).toBe(true);
    expect(f2.ok).toBe(true);
    if (!f1.ok || !f2.ok) return;

    // El tenant tiene ahora Principal + f1 + f2 en un plan de tope 3 (mas lo
    // que haya quedado del test anterior, que vuelve a ese mismo plan) --
    // bajamos directo a tope 1: Principal sobrevive siempre, f1 y f2 (las
    // unicas dos sin congelar en este momento, mas nuevas primero) se
    // congelan.
    const antes = await listarSucursalesPorTenant(owner!, tenantId);
    expect(antes.ok).toBe(true);
    if (!antes.ok) return;
    const operablesAntes = antes.data.filter((s) => !s.congeladaEn);

    const cambio = await cambiarPlanTenant(fakeCeomAdmin, tenantId, planUnaId);
    expect(cambio.ok).toBe(true);
    if (!cambio.ok) return;

    // Se congelo exactamente (operablesAntes - 1): el tope 1 lo cubre la Principal sola.
    expect(cambio.data.sucursalesCongeladas.length).toBe(operablesAntes.length - 1);

    const despues = await listarSucursalesPorTenant(owner!, tenantId);
    expect(despues.ok).toBe(true);
    if (!despues.ok) return;

    const principal = despues.data.find((s) => s.esPrincipal);
    expect(principal?.congeladaEn).toBeNull();

    const f2Actualizada = despues.data.find((s) => s.id === f2.data.sucursalId);
    const f1Actualizada = despues.data.find((s) => s.id === f1.data.sucursalId);
    // f2 (creada despues) tiene que estar entre las congeladas -- criterio
    // "mas nuevas primero" -- f1 tambien lo estara salvo que el tope 1
    // alcance para dejarla operable, lo cual no pasa aca (tope 1 = solo la
    // Principal).
    expect(f2Actualizada?.congeladaEn).not.toBeNull();
    expect(f1Actualizada?.congeladaEn).not.toBeNull();
    expect(f2Actualizada?.congeladaMotivo).toMatch(/hasta 1 sucursal/i);

    // actualizarSucursal sigue funcionando sobre una sucursal congelada --
    // el freeze bloquea ESCRITURA de negocio (Productos/Ventas), no la
    // gestion de su propio nombre/direccion desde Identidad.
    const editar = await actualizarSucursal(owner!, f2.data.sucursalId, {
      nombre: `Freeze Nueva Renombrada ${sufijo}`,
    });
    expect(editar.ok).toBe(true);

    // Panel Admin CEOM: Desbloquear saca a f1 del freeze sin pasar por un upgrade real.
    const desbloqueo = await desbloquearSucursal(fakeCeomAdmin, f1.data.sucursalId);
    expect(desbloqueo.ok).toBe(true);
    const trasDesbloqueo = await listarSucursalesPorTenant(owner!, tenantId);
    expect(trasDesbloqueo.ok && trasDesbloqueo.data.find((s) => s.id === f1.data.sucursalId)?.congeladaEn).toBeNull();

    // eliminarSucursal: nunca la Principal.
    const rechazoEliminarPrincipal = await eliminarSucursal(fakeCeomAdmin, principal!.id);
    expect(rechazoEliminarPrincipal.ok).toBe(false);

    // eliminarSucursal: soft-delete real de f2 (todavia congelada) -- deja
    // de aparecer en listarSucursalesPorTenant (que filtra eliminado_en),
    // pero la fila sigue existiendo en la base (soft delete, nunca DELETE
    // fisico) para que el historico de otros modulos no quede huerfano.
    const eliminacion = await eliminarSucursal(fakeCeomAdmin, f2.data.sucursalId);
    expect(eliminacion.ok).toBe(true);
    const trasEliminar = await listarSucursalesPorTenant(owner!, tenantId);
    expect(trasEliminar.ok && trasEliminar.data.some((s) => s.id === f2.data.sucursalId)).toBe(false);
    const filaCruda = await db.select().from(sucursales).where(eq(sucursales.id, f2.data.sucursalId));
    expect(filaCruda).toHaveLength(1);
    expect(filaCruda[0].eliminadoEn).not.toBeNull();

    // Vuelve al plan de 3 para no interferir con otros tests de este bloque.
    await cambiarPlanTenant(fakeCeomAdmin, tenantId, planTresId);
  }, 20000);

  it("crearTenantConOwner sigue creando exactamente una sucursal Principal — un negocio de una sola sucursal no cambia (regresion)", async () => {
    const propias = await db
      .select()
      .from(sucursales)
      .where(and(eq(sucursales.tenantId, tenantId), eq(sucursales.esPrincipal, true), isNull(sucursales.eliminadoEn)));
    expect(propias).toHaveLength(1);
    expect(propias[0].creadoEn).not.toBeNull();
    expect(propias[0].congeladaEn).toBeNull();
  });

  it("Panel Admin CEOM — Consolidar: mueve el stock a la Principal y cierra el origen sin dejar huérfanos", async () => {
    const owner = await repo.obtenerUsuarioConRolPorId(ownerId);
    const antes = await listarSucursalesPorTenant(owner!, tenantId);
    expect(antes.ok).toBe(true);
    if (!antes.ok) return;
    const principal = antes.data.find((s) => s.esPrincipal)!;

    const origen = await crearSucursal(owner!, tenantId, { nombre: `Consolidar Origen ${sufijo}` });
    expect(origen.ok).toBe(true);
    if (!origen.ok) return;

    const producto = await crearProducto(owner!, tenantId, {
      nombre: `Producto Consolidar ${sufijo}`,
      unidadVenta: "unidad",
      precioVenta: 7,
    });
    if (!producto.ok) throw new Error("setup fallo");
    const productoId = producto.data.productoId;

    await registrarAjusteManualStock(owner!, tenantId, {
      productoId,
      sucursalId: origen.data.sucursalId,
      tipo: "entrada_ajuste_manual",
      cantidad: 25,
      motivo: "Carga a consolidar",
    });

    // Congela el origen (simula lo que haría un downgrade real) para
    // confirmar que consolidarStockDeSucursal() puede escribir contra una
    // sucursal congelada — es exactamente el mecanismo de liquidación, a
    // propósito no pasa por requireSucursalOperable().
    await db
      .update(sucursales)
      .set({ congeladaEn: new Date(), congeladaMotivo: "Test H-02 consolidar" })
      .where(eq(sucursales.id, origen.data.sucursalId));

    // Server Action de /admin no gateada por rol de negocio — se prueba
    // directo con fakeCeomAdmin, mismo criterio que el resto del archivo.
    const transferencia = await consolidarStockDeSucursal(fakeCeomAdmin, tenantId, {
      sucursalOrigenId: origen.data.sucursalId,
      sucursalDestinoId: principal.id,
    });
    expect(transferencia.ok).toBe(true);
    if (transferencia.ok) expect(transferencia.data.productosTransferidos).toBe(1);

    // El stock quedó realmente en la Principal, y en 0 en el origen — no es
    // un movimiento fantasma, es el ledger real de Productos.
    const stockOrigen = await consultarStock(owner!, productoId, origen.data.sucursalId);
    const stockPrincipal = await consultarStock(owner!, productoId, principal.id);
    expect(stockOrigen.ok && stockOrigen.data.cantidadActual).toBe(0);
    expect(stockPrincipal.ok && stockPrincipal.data.cantidadActual).toBe(25);

    // Recién ahora Eliminar puede cerrar el origen (composición real de
    // admin/tenants/actions.ts: consultarStockTotalPorSucursal === 0 antes
    // de eliminarSucursal — replicado acá para probar el mismo camino).
    const stockTotalOrigen = await consultarStockTotalPorSucursal(owner!, tenantId, origen.data.sucursalId);
    expect(stockTotalOrigen.ok && stockTotalOrigen.data.stockTotal).toBe(0);

    const eliminacion = await eliminarSucursal(fakeCeomAdmin, origen.data.sucursalId);
    expect(eliminacion.ok).toBe(true);

    // Sin huérfanos: la sucursal quedó soft-deleted (no en el listado real),
    // pero la fila sigue existiendo — el movimiento de stock ya transferido
    // sigue apuntando a un sucursal_id válido (nunca DELETE físico de
    // sucursales, ver eliminarSucursalSoft en repository.ts).
    const filaOrigen = await db.select().from(sucursales).where(eq(sucursales.id, origen.data.sucursalId));
    expect(filaOrigen).toHaveLength(1);
    expect(filaOrigen[0].eliminadoEn).not.toBeNull();

    const movimientosDelOrigen = await db
      .select({ id: movimientosStock.id })
      .from(movimientosStock)
      .where(eq(movimientosStock.sucursalId, origen.data.sucursalId));
    expect(movimientosDelOrigen.length).toBeGreaterThan(0); // el ledger histórico no se borró
  }, 20000);
});
