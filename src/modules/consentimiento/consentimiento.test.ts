import { eq, like } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { db } from "@/db/client";
import { crearClienteAdmin } from "@/lib/supabase/server";
import { ROL_CEOM_ADMIN_ID, ROL_OWNER_ID } from "@/modules/identidad/constants";
import * as identidadRepo from "@/modules/identidad/repository";
import { roles, sucursales, tenants, usuarios } from "@/modules/identidad/schema";
import { crearPlan } from "@/modules/suscripcion/actions";
import { planes } from "@/modules/suscripcion/schema";
import {
  aprobarSolicitud,
  canjearCodigoAcceso,
  crearInstitucion,
  crearSolicitudSeguimiento,
  generarCodigoAcceso,
  listarInstituciones,
  revocarCodigoAcceso,
  revocarConsentimiento,
  tieneConsentimiento,
} from "./actions";
import {
  aprobacionesTenant,
  carteraInstitucional,
  codigosAcceso,
  instituciones,
  solicitudesSeguimiento,
} from "./schema";

const hasCredenciales = Boolean(
  process.env.DATABASE_URL && process.env.SUPABASE_SECRET_KEY
);

vi.setConfig({ testTimeout: 20000 });

describe.skipIf(!hasCredenciales)("Modulo 10 - Gateway de Consentimiento (integracion)", () => {
  const admin = crearClienteAdmin();
  const sufijo = Date.now();
  let tenantId: string;
  let ownerId: string;
  let planId: string;
  let institucionId: string;

  beforeAll(async () => {
    const { data, error } = await admin.auth.admin.createUser({
      email: `consentimiento-owner-${sufijo}@ceom-erp.test`,
      email_confirm: true,
    });
    if (error || !data.user) {
      throw error ?? new Error("No se pudo crear el usuario de Auth de prueba");
    }
    ownerId = data.user.id;

    // Plan de prueba que solo permite compartir "financiero" — necesario
    // para probar el rechazo de generarCodigoAcceso (caso 4).
    const plan = await crearPlan(
      { rolId: ROL_CEOM_ADMIN_ID },
      {
        nombre: `Plan Veedor Test ${sufijo}`,
        precioMensual: 0,
        moneda: "BOB",
        modulosVeedorPermitidos: ["financiero"],
      }
    );
    if (!plan.ok) throw new Error("setup fallo: crearPlan");
    planId = plan.data.planId;

    const { tenant } = await identidadRepo.crearTenantConOwner({
      tenant: {
        nombreNegocio: `Consentimiento Test ${sufijo}`,
        monedaPrincipal: "BOB",
        planId,
        estadoSuscripcion: "activa",
        fechaInicioSuscripcion: new Date().toISOString().slice(0, 10),
      },
      ownerId,
      ownerNombreCompleto: "Owner Consentimiento",
      ownerEmail: `consentimiento-owner-${sufijo}@ceom-erp.test`,
      rolOwnerId: ROL_OWNER_ID,
      creadoPor: null,
    });
    tenantId = tenant.id;

    const institucion = await crearInstitucion(
      { rolId: ROL_CEOM_ADMIN_ID },
      { nombre: `Incubadora Test ${sufijo}`, tipo: "incubadora" }
    );
    if (!institucion.ok) throw new Error("setup fallo: crearInstitucion");
    institucionId = institucion.data.institucionId;
  });

  afterAll(async () => {
    // aprobaciones_tenant.codigo_acceso_id referencia codigos_acceso — hay
    // que borrar las aprobaciones antes que los codigos.
    await db.delete(aprobacionesTenant).where(eq(aprobacionesTenant.tenantId, tenantId));
    await db.delete(codigosAcceso).where(eq(codigosAcceso.tenantId, tenantId));
    await db.delete(solicitudesSeguimiento).where(eq(solicitudesSeguimiento.tenantId, tenantId));
    await db
      .delete(carteraInstitucional)
      .where(eq(carteraInstitucional.tenantId, tenantId));
    await db.delete(instituciones).where(eq(instituciones.id, institucionId));

    // Instituciones auto-creadas al canjear codigo (tests de canje) — limpiar por prefijo/sufijo.
    const institucionesGeneradas = await db
      .select({ id: instituciones.id })
      .from(instituciones)
      .where(like(instituciones.nombre, `Consultora Canjeada ${sufijo}%`));
    for (const i of institucionesGeneradas) {
      await db
        .delete(aprobacionesTenant)
        .where(eq(aprobacionesTenant.institucionId, i.id));
      await db
        .delete(carteraInstitucional)
        .where(eq(carteraInstitucional.institucionId, i.id));
      await db.delete(instituciones).where(eq(instituciones.id, i.id));
    }

    await db.delete(usuarios).where(eq(usuarios.tenantId, tenantId));
    await db.delete(roles).where(eq(roles.tenantId, tenantId));
    await db.delete(sucursales).where(eq(sucursales.tenantId, tenantId));
    await db.delete(tenants).where(eq(tenants.id, tenantId));
    await db.delete(planes).where(eq(planes.id, planId));
    await admin.auth.admin.deleteUser(ownerId);
  });

  it("seccion 3.1: aprobarSolicitud con un subconjunto de lo pedido — tieneConsentimiento refleja exactamente eso", async () => {
    const owner = await identidadRepo.obtenerUsuarioConRolPorId(ownerId);
    const solicitud = await crearSolicitudSeguimiento(
      { rolId: ROL_CEOM_ADMIN_ID },
      { institucionId, tenantId, modulosSolicitados: ["financiero", "operativo"] }
    );
    expect(solicitud.ok).toBe(true);
    if (!solicitud.ok) return;

    const aprobacion = await aprobarSolicitud(owner!, solicitud.data.solicitudId, {
      modulosAprobados: ["financiero"],
    });
    expect(aprobacion.ok).toBe(true);

    expect(await tieneConsentimiento(institucionId, tenantId, "financiero")).toBe(true);
    expect(await tieneConsentimiento(institucionId, tenantId, "operativo")).toBe(false);
  });

  it("listarInstituciones exige ceom_admin (gate de rol cerrado)", async () => {
    const rechazado = await listarInstituciones({ rolId: ROL_OWNER_ID });
    expect(rechazado.ok).toBe(false);

    const permitido = await listarInstituciones({ rolId: ROL_CEOM_ADMIN_ID });
    expect(permitido.ok).toBe(true);
    if (!permitido.ok) return;
    expect(permitido.data.some((i) => i.id === institucionId)).toBe(true);
  });

  it("caso borde 3: revocarConsentimiento deniega de inmediato la siguiente consulta", async () => {
    const owner = await identidadRepo.obtenerUsuarioConRolPorId(ownerId);
    const solicitud = await crearSolicitudSeguimiento(
      { rolId: ROL_CEOM_ADMIN_ID },
      { institucionId, tenantId, modulosSolicitados: ["financiero"] }
    );
    if (!solicitud.ok) throw new Error("setup fallo");
    const aprobacion = await aprobarSolicitud(owner!, solicitud.data.solicitudId, {
      modulosAprobados: ["financiero"],
    });
    if (!aprobacion.ok) throw new Error("setup fallo");

    expect(await tieneConsentimiento(institucionId, tenantId, "financiero")).toBe(true);

    const revocacion = await revocarConsentimiento(owner!, aprobacion.data.aprobacionId);
    expect(revocacion.ok).toBe(true);

    expect(await tieneConsentimiento(institucionId, tenantId, "financiero")).toBe(false);
  });

  it("caso borde 1: tenant bloqueado deniega tieneConsentimiento aunque haya aprobacion vigente", async () => {
    const owner = await identidadRepo.obtenerUsuarioConRolPorId(ownerId);
    const solicitud = await crearSolicitudSeguimiento(
      { rolId: ROL_CEOM_ADMIN_ID },
      { institucionId, tenantId, modulosSolicitados: ["financiero"] }
    );
    if (!solicitud.ok) throw new Error("setup fallo");
    const aprobacion = await aprobarSolicitud(owner!, solicitud.data.solicitudId, {
      modulosAprobados: ["financiero"],
    });
    if (!aprobacion.ok) throw new Error("setup fallo");
    expect(await tieneConsentimiento(institucionId, tenantId, "financiero")).toBe(true);

    // Vencida sin gracia (fecha_proximo_pago muy en el pasado) -> bloqueado.
    await db
      .update(tenants)
      .set({ estadoSuscripcion: "vencida", fechaProximoPago: "2020-01-01" })
      .where(eq(tenants.id, tenantId));

    expect(await tieneConsentimiento(institucionId, tenantId, "financiero")).toBe(false);

    await db
      .update(tenants)
      .set({ estadoSuscripcion: "activa", fechaProximoPago: null })
      .where(eq(tenants.id, tenantId));
  });

  it("seccion 3.4: generarCodigoAcceso rechaza modulos fuera de modulos_veedor_permitidos del plan", async () => {
    const owner = await identidadRepo.obtenerUsuarioConRolPorId(ownerId);
    const rechazado = await generarCodigoAcceso(owner!, tenantId, {
      modulosHabilitados: ["operativo"], // el plan de prueba solo permite "financiero"
    });
    expect(rechazado.ok).toBe(false);

    const permitido = await generarCodigoAcceso(owner!, tenantId, {
      modulosHabilitados: ["financiero"],
    });
    expect(permitido.ok).toBe(true);
  });

  it(
    "seccion 3.4: canjearCodigoAcceso crea la Institucion si no existia y otorga el consentimiento real",
    async () => {
      const owner = await identidadRepo.obtenerUsuarioConRolPorId(ownerId);
      const codigoRes = await generarCodigoAcceso(owner!, tenantId, {
        modulosHabilitados: ["financiero"],
      });
      if (!codigoRes.ok) throw new Error("setup fallo");

      const canje = await canjearCodigoAcceso({
        codigo: codigoRes.data.codigo,
        institucionNueva: { nombre: `Consultora Canjeada ${sufijo}`, tipo: "organizacion" },
      });
      expect(canje.ok).toBe(true);
      if (!canje.ok) return;

      expect(canje.data.modulosAprobados).toEqual(["financiero"]);
      expect(
        await tieneConsentimiento(canje.data.institucionId, tenantId, "financiero")
      ).toBe(true);

      // caso borde 6 (Modulo_11): un codigo ya canjeado no se puede volver a usar.
      const reintento = await canjearCodigoAcceso({
        codigo: codigoRes.data.codigo,
        institucionNueva: { nombre: "Otra", tipo: "organizacion" },
      });
      expect(reintento.ok).toBe(false);
    },
    20000
  );

  it(
    "seccion 3.4: revocarCodigoAcceso corta tambien el acceso ya otorgado tras canjearse",
    async () => {
      const owner = await identidadRepo.obtenerUsuarioConRolPorId(ownerId);
      const codigoRes = await generarCodigoAcceso(owner!, tenantId, {
        modulosHabilitados: ["financiero"],
      });
      if (!codigoRes.ok) throw new Error("setup fallo");

      const canje = await canjearCodigoAcceso({
        codigo: codigoRes.data.codigo,
        institucionNueva: { nombre: `Consultora Canjeada ${sufijo} B`, tipo: "organizacion" },
      });
      if (!canje.ok) throw new Error("setup fallo");
      expect(
        await tieneConsentimiento(canje.data.institucionId, tenantId, "financiero")
      ).toBe(true);

      const revocacion = await revocarCodigoAcceso(owner!, codigoRes.data.codigoAccesoId);
      expect(revocacion.ok).toBe(true);

      expect(
        await tieneConsentimiento(canje.data.institucionId, tenantId, "financiero")
      ).toBe(false);
    },
    20000
  );
});
