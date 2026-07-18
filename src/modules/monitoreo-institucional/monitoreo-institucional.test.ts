import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { db } from "@/db/client";
import { crearClienteAdmin } from "@/lib/supabase/server";
import {
  agregarTenantACartera,
  aprobarSolicitud,
  crearInstitucion,
  crearSolicitudSeguimiento,
  revocarConsentimiento,
} from "@/modules/consentimiento/actions";
import {
  aprobacionesTenant,
  carteraInstitucional,
  instituciones,
  solicitudesSeguimiento,
} from "@/modules/consentimiento/schema";
import { ROL_CEOM_ADMIN_ID, ROL_OWNER_ID } from "@/modules/identidad/constants";
import * as identidadRepo from "@/modules/identidad/repository";
import { roles, sucursales, tenants, usuarios } from "@/modules/identidad/schema";
import { crearPlan } from "@/modules/suscripcion/actions";
import { planes } from "@/modules/suscripcion/schema";
import {
  detalleFinanciero,
  detalleInventarioOperativo,
  detalleOperativo,
  estadoTenant,
  tendenciaVentas,
} from "./actions";

const hasCredenciales = Boolean(
  process.env.DATABASE_URL && process.env.SUPABASE_SECRET_KEY
);

vi.setConfig({ testTimeout: 20000 });

const periodo = { desde: "2020-01-01", hasta: "2030-01-01" };

describe.skipIf(!hasCredenciales)(
  "Roadmap #11 - Monitoreo Institucional (integracion)",
  () => {
    const admin = crearClienteAdmin();
    const sufijo = Date.now();
    let tenantId: string;
    let ownerId: string;
    let planId: string;
    let institucionId: string;

    beforeAll(async () => {
      const { data, error } = await admin.auth.admin.createUser({
        email: `monitoreo-owner-${sufijo}@ceom-erp.test`,
        email_confirm: true,
      });
      if (error || !data.user) {
        throw error ?? new Error("No se pudo crear el usuario de Auth de prueba");
      }
      ownerId = data.user.id;

      const plan = await crearPlan(
        { rolId: ROL_CEOM_ADMIN_ID },
        {
          nombre: `Plan Monitoreo Test ${sufijo}`,
          precioMensual: 0,
          moneda: "BOB",
          modulosVeedorPermitidos: ["financiero", "operativo", "inventario_operativo"],
        }
      );
      if (!plan.ok) throw new Error("setup fallo: crearPlan");
      planId = plan.data.planId;

      const { tenant } = await identidadRepo.crearTenantConOwner({
        tenant: {
          nombreNegocio: `Monitoreo Test ${sufijo}`,
          monedaPrincipal: "BOB",
          planId,
          estadoSuscripcion: "activa",
          fechaInicioSuscripcion: new Date().toISOString().slice(0, 10),
        },
        ownerId,
        ownerNombreCompleto: "Owner Monitoreo",
        ownerEmail: `monitoreo-owner-${sufijo}@ceom-erp.test`,
        rolOwnerId: ROL_OWNER_ID,
        creadoPor: null,
      });
      tenantId = tenant.id;

      const institucion = await crearInstitucion(
        { rolId: ROL_CEOM_ADMIN_ID },
        { nombre: `Institucion Monitoreo Test ${sufijo}`, tipo: "incubadora" }
      );
      if (!institucion.ok) throw new Error("setup fallo: crearInstitucion");
      institucionId = institucion.data.institucionId;

      const cartera = await agregarTenantACartera(
        { rolId: ROL_CEOM_ADMIN_ID },
        { institucionId, tenantId, fechaInicio: new Date().toISOString().slice(0, 10) }
      );
      if (!cartera.ok) throw new Error("setup fallo: agregarTenantACartera");
    });

    afterAll(async () => {
      await db.delete(aprobacionesTenant).where(eq(aprobacionesTenant.tenantId, tenantId));
      await db
        .delete(solicitudesSeguimiento)
        .where(eq(solicitudesSeguimiento.tenantId, tenantId));
      await db.delete(carteraInstitucional).where(eq(carteraInstitucional.tenantId, tenantId));
      await db.delete(instituciones).where(eq(instituciones.id, institucionId));
      await db.delete(usuarios).where(eq(usuarios.tenantId, tenantId));
      await db.delete(roles).where(eq(roles.tenantId, tenantId));
      await db.delete(sucursales).where(eq(sucursales.tenantId, tenantId));
      await db.delete(tenants).where(eq(tenants.id, tenantId));
      await db.delete(planes).where(eq(planes.id, planId));
      await admin.auth.admin.deleteUser(ownerId);
    });

    it("caso 1: tenant en cartera sin ningun modulo aprobado — visible, pero nada autorizado", async () => {
      const estado = await estadoTenant(institucionId, tenantId);
      expect(estado.ok).toBe(true);
      if (!estado.ok) return;
      expect(estado.data.nombreNegocio).toBe(`Monitoreo Test ${sufijo}`);

      const financiero = await detalleFinanciero(institucionId, tenantId, periodo);
      expect(financiero.ok).toBe(true);
      if (!financiero.ok) return;
      expect(financiero.data.autorizado).toBe(false);

      const operativo = await detalleOperativo(institucionId, tenantId, periodo);
      expect(operativo.ok).toBe(true);
      if (!operativo.ok) return;
      expect(operativo.data.autorizado).toBe(false);

      const inventario = await detalleInventarioOperativo(institucionId, tenantId);
      expect(inventario.ok).toBe(true);
      if (!inventario.ok) return;
      expect(inventario.data.autorizado).toBe(false);
    });

    it("caso 2: solo 'financiero' aprobado — detalleFinanciero y tendenciaVentas autorizados, el resto no", async () => {
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

      const financiero = await detalleFinanciero(institucionId, tenantId, periodo);
      expect(financiero.ok).toBe(true);
      if (!financiero.ok) return;
      expect(financiero.data.autorizado).toBe(true);
      if (!financiero.data.autorizado) return;
      expect(typeof financiero.data.detalle.flujoCaja).toBe("number");

      const tendencia = await tendenciaVentas(institucionId, tenantId, periodo);
      expect(tendencia.ok).toBe(true);
      if (!tendencia.ok) return;
      expect(tendencia.data.autorizado).toBe(true);

      const operativo = await detalleOperativo(institucionId, tenantId, periodo);
      expect(operativo.ok).toBe(true);
      if (!operativo.ok) return;
      expect(operativo.data.autorizado).toBe(false);

      const inventario = await detalleInventarioOperativo(institucionId, tenantId);
      expect(inventario.ok).toBe(true);
      if (!inventario.ok) return;
      expect(inventario.data.autorizado).toBe(false);

      // caso borde 3: revocacion inmediata
      const revocacion = await revocarConsentimiento(owner!, aprobacion.data.aprobacionId);
      expect(revocacion.ok).toBe(true);
      const financieroTrasRevocar = await detalleFinanciero(institucionId, tenantId, periodo);
      expect(financieroTrasRevocar.ok).toBe(true);
      if (!financieroTrasRevocar.ok) return;
      expect(financieroTrasRevocar.data.autorizado).toBe(false);
    });

    it("caso 3: solo 'operativo' + 'inventario_operativo' aprobados — inverso del caso 2", async () => {
      const owner = await identidadRepo.obtenerUsuarioConRolPorId(ownerId);
      const solicitud = await crearSolicitudSeguimiento(
        { rolId: ROL_CEOM_ADMIN_ID },
        {
          institucionId,
          tenantId,
          modulosSolicitados: ["operativo", "inventario_operativo"],
        }
      );
      if (!solicitud.ok) throw new Error("setup fallo");
      const aprobacion = await aprobarSolicitud(owner!, solicitud.data.solicitudId, {
        modulosAprobados: ["operativo", "inventario_operativo"],
      });
      if (!aprobacion.ok) throw new Error("setup fallo");

      const operativo = await detalleOperativo(institucionId, tenantId, periodo);
      expect(operativo.ok).toBe(true);
      if (!operativo.ok) return;
      expect(operativo.data.autorizado).toBe(true);

      const inventario = await detalleInventarioOperativo(institucionId, tenantId);
      expect(inventario.ok).toBe(true);
      if (!inventario.ok) return;
      expect(inventario.data.autorizado).toBe(true);

      const financiero = await detalleFinanciero(institucionId, tenantId, periodo);
      expect(financiero.ok).toBe(true);
      if (!financiero.ok) return;
      expect(financiero.data.autorizado).toBe(false);
    });

    it("caso borde 1: tenant bloqueado deniega detalleFinanciero aunque haya aprobacion vigente", async () => {
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

      const antes = await detalleFinanciero(institucionId, tenantId, periodo);
      expect(antes.ok).toBe(true);
      if (!antes.ok) return;
      expect(antes.data.autorizado).toBe(true);

      await db
        .update(tenants)
        .set({ estadoSuscripcion: "vencida", fechaProximoPago: "2020-01-01" })
        .where(eq(tenants.id, tenantId));

      const bloqueado = await detalleFinanciero(institucionId, tenantId, periodo);
      expect(bloqueado.ok).toBe(true);
      if (!bloqueado.ok) return;
      expect(bloqueado.data.autorizado).toBe(false);

      await db
        .update(tenants)
        .set({ estadoSuscripcion: "activa", fechaProximoPago: null })
        .where(eq(tenants.id, tenantId));
    });

    it("caso 6: institucion sin fila de cartera con el tenant — estadoTenant rechaza", async () => {
      const otraInstitucion = await crearInstitucion(
        { rolId: ROL_CEOM_ADMIN_ID },
        { nombre: `Institucion Sin Cartera ${sufijo}`, tipo: "organizacion" }
      );
      if (!otraInstitucion.ok) throw new Error("setup fallo");

      const estado = await estadoTenant(otraInstitucion.data.institucionId, tenantId);
      expect(estado.ok).toBe(false);

      await db
        .delete(instituciones)
        .where(eq(instituciones.id, otraInstitucion.data.institucionId));
    });
  }
);
