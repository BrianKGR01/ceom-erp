import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { db } from "@/db/client";
import { crearClienteAdmin } from "@/lib/supabase/server";
import { listarLogsAcceso } from "@/modules/consentimiento/actions";
import { logsAccesoAdminCeom } from "@/modules/consentimiento/schema";
import { CEOM_OPS_TENANT_ID, ROL_CEOM_ADMIN_ID, ROL_OWNER_ID } from "@/modules/identidad/constants";
import * as identidadRepo from "@/modules/identidad/repository";
import { roles, sucursales, tenants, usuarios } from "@/modules/identidad/schema";
import { crearPlan } from "@/modules/suscripcion/actions";
import { planes } from "@/modules/suscripcion/schema";
import {
  consultarFinancieroTenant,
  consultarTenantDetalle,
  saludAgregadaPlataforma,
} from "./actions";

const hasCredenciales = Boolean(
  process.env.DATABASE_URL && process.env.SUPABASE_SECRET_KEY
);

vi.setConfig({ testTimeout: 20000 });

const periodo = { desde: "2020-01-01", hasta: "2030-01-01" };

describe.skipIf(!hasCredenciales)(
  "Roadmap #11 - Panel Admin CEOM (integracion)",
  () => {
    const admin = crearClienteAdmin();
    const sufijo = Date.now();
    let tenantId: string;
    let ownerId: string;
    let planId: string;
    let ceomAdminId: string;
    let ceomAdmin: identidadRepo.UsuarioConRol;

    beforeAll(async () => {
      // registrarAccesoAdminCeom() inserta una fila real con FK a
      // usuarios.id — a diferencia del fixture en memoria de
      // identidad.test.ts (que solo ejercita un path de lectura que falla
      // antes de cualquier insert), acá hace falta un usuario CEOM Admin
      // real sembrado en la base.
      const { data: dataCeomAdmin, error: errorCeomAdmin } = await admin.auth.admin.createUser({
        email: `panel-admin-ceomadmin-${sufijo}@ceom-erp.test`,
        email_confirm: true,
      });
      if (errorCeomAdmin || !dataCeomAdmin.user) {
        throw errorCeomAdmin ?? new Error("No se pudo crear el usuario CEOM Admin de prueba");
      }
      ceomAdminId = dataCeomAdmin.user.id;
      await identidadRepo.insertarUsuario({
        id: ceomAdminId,
        tenantId: CEOM_OPS_TENANT_ID,
        nombreCompleto: "CEOM Admin (test panel-admin-ceom)",
        email: `panel-admin-ceomadmin-${sufijo}@ceom-erp.test`,
        rolId: ROL_CEOM_ADMIN_ID,
        esOwner: false,
        activo: true,
      });
      ceomAdmin = (await identidadRepo.obtenerUsuarioConRolPorId(ceomAdminId))!;

      const { data, error } = await admin.auth.admin.createUser({
        email: `panel-admin-owner-${sufijo}@ceom-erp.test`,
        email_confirm: true,
      });
      if (error || !data.user) {
        throw error ?? new Error("No se pudo crear el usuario de Auth de prueba");
      }
      ownerId = data.user.id;

      const plan = await crearPlan(
        { rolId: ROL_CEOM_ADMIN_ID },
        {
          nombre: `Plan Panel Admin Test ${sufijo}`,
          precioMensual: 0,
          moneda: "BOB",
        }
      );
      if (!plan.ok) throw new Error("setup fallo: crearPlan");
      planId = plan.data.planId;

      const { tenant } = await identidadRepo.crearTenantConOwner({
        tenant: {
          nombreNegocio: `Panel Admin Test ${sufijo}`,
          monedaPrincipal: "BOB",
          planId,
          estadoSuscripcion: "activa",
          fechaInicioSuscripcion: new Date().toISOString().slice(0, 10),
        },
        ownerId,
        ownerNombreCompleto: "Owner Panel Admin",
        ownerEmail: `panel-admin-owner-${sufijo}@ceom-erp.test`,
        rolOwnerId: ROL_OWNER_ID,
        creadoPor: null,
      });
      tenantId = tenant.id;
    });

    afterAll(async () => {
      await db.delete(logsAccesoAdminCeom).where(eq(logsAccesoAdminCeom.tenantId, tenantId));
      await db.delete(usuarios).where(eq(usuarios.tenantId, tenantId));
      await db.delete(roles).where(eq(roles.tenantId, tenantId));
      await db.delete(sucursales).where(eq(sucursales.tenantId, tenantId));
      await db.delete(tenants).where(eq(tenants.id, tenantId));
      await db.delete(planes).where(eq(planes.id, planId));
      await admin.auth.admin.deleteUser(ownerId);

      await db.delete(usuarios).where(eq(usuarios.id, ceomAdminId));
      await admin.auth.admin.deleteUser(ceomAdminId);
    });

    it("caso 1: saludAgregadaPlataforma con ceom_admin real cuenta el tenant de prueba", async () => {
      const salud = await saludAgregadaPlataforma(ceomAdmin);
      expect(salud.ok).toBe(true);
      if (!salud.ok) return;
      expect(salud.data.totalTenants).toBeGreaterThanOrEqual(1);
      expect(salud.data.porEstadoAcceso.activo).toBeGreaterThanOrEqual(1);
      const filaPlan = salud.data.porPlan.find((p) => p.planId === planId);
      expect(filaPlan?.cantidad).toBe(1);
    });

    it("caso 2: saludAgregadaPlataforma con un usuario normal (Owner) rechaza sin exponer datos", async () => {
      const owner = await identidadRepo.obtenerUsuarioConRolPorId(ownerId);
      const salud = await saludAgregadaPlataforma(owner!);
      expect(salud.ok).toBe(false);
    });

    it("caso 3: ceom_admin lee un tenant ajeno y queda logueado en logs_acceso_admin_ceom", async () => {
      const detalle = await consultarTenantDetalle(ceomAdmin, tenantId);
      expect(detalle.ok).toBe(true);
      if (!detalle.ok) return;
      expect(detalle.data.nombreNegocio).toBe(`Panel Admin Test ${sufijo}`);

      const financiero = await consultarFinancieroTenant(ceomAdmin, tenantId, periodo);
      expect(financiero.ok).toBe(true);
      if (!financiero.ok) return;
      expect(typeof financiero.data.flujoCaja).toBe("number");

      const logs = await listarLogsAcceso({ rolId: ROL_CEOM_ADMIN_ID }, { tenantId });
      expect(logs.ok).toBe(true);
      if (!logs.ok) return;
      const logFinanciero = logs.data.find((l) => l.moduloConsultado === "financiero");
      expect(logFinanciero).toBeDefined();
      expect(logFinanciero?.usuarioCeomId).toBe(ceomAdmin.id);
    });

    it("caso 4: un usuario normal no puede leer un tenant ajeno, y no queda log", async () => {
      const owner = await identidadRepo.obtenerUsuarioConRolPorId(ownerId);

      // otro tenant, ajeno a este owner
      const otroPlan = await crearPlan(
        { rolId: ROL_CEOM_ADMIN_ID },
        { nombre: `Plan Ajeno Test ${sufijo}`, precioMensual: 0, moneda: "BOB" }
      );
      if (!otroPlan.ok) throw new Error("setup fallo");
      const { data: otroAuth, error: otroError } = await admin.auth.admin.createUser({
        email: `panel-admin-ajeno-${sufijo}@ceom-erp.test`,
        email_confirm: true,
      });
      if (otroError || !otroAuth.user) throw new Error("setup fallo: auth ajeno");
      const { tenant: tenantAjeno } = await identidadRepo.crearTenantConOwner({
        tenant: {
          nombreNegocio: `Ajeno Test ${sufijo}`,
          monedaPrincipal: "BOB",
          planId: otroPlan.data.planId,
          estadoSuscripcion: "activa",
          fechaInicioSuscripcion: new Date().toISOString().slice(0, 10),
        },
        ownerId: otroAuth.user.id,
        ownerNombreCompleto: "Owner Ajeno",
        ownerEmail: `panel-admin-ajeno-${sufijo}@ceom-erp.test`,
        rolOwnerId: ROL_OWNER_ID,
        creadoPor: null,
      });

      const detalle = await consultarTenantDetalle(owner!, tenantAjeno.id);
      expect(detalle.ok).toBe(false);

      const logs = await listarLogsAcceso(
        { rolId: ROL_CEOM_ADMIN_ID },
        { tenantId: tenantAjeno.id }
      );
      expect(logs.ok).toBe(true);
      if (!logs.ok) return;
      expect(logs.data.length).toBe(0);

      await db.delete(usuarios).where(eq(usuarios.tenantId, tenantAjeno.id));
      await db.delete(roles).where(eq(roles.tenantId, tenantAjeno.id));
      await db.delete(sucursales).where(eq(sucursales.tenantId, tenantAjeno.id));
      await db.delete(tenants).where(eq(tenants.id, tenantAjeno.id));
      await db.delete(planes).where(eq(planes.id, otroPlan.data.planId));
      await admin.auth.admin.deleteUser(otroAuth.user.id);
    });
  }
);
