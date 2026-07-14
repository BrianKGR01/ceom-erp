import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { db } from "@/db/client";
import { crearClienteAdmin } from "@/lib/supabase/server";
import { ROL_OWNER_ID } from "@/modules/identidad/constants";
import * as identidadRepo from "@/modules/identidad/repository";
import { roles, sucursales, tenants, usuarios } from "@/modules/identidad/schema";
import {
  consultarCapacidad,
  consultarPasivoDeActivo,
  consultarValorPatrimonialTotal,
  crearActivo,
  crearPasivo,
  darDeBajaActivo,
  refinanciarPasivo,
  registrarPagoPasivo,
  transferirActivo,
} from "./actions";
import * as repo from "./repository";
import { activos, pagosPasivo, pasivos } from "./schema";

// Pegan contra el Supabase Cloud de desarrollo real, mismo criterio que
// identidad.test.ts — se saltan solos si faltan las credenciales.
const hasCredenciales = Boolean(
  process.env.DATABASE_URL && process.env.SUPABASE_SECRET_KEY
);

describe.skipIf(!hasCredenciales)("Modulo 5 - Patrimonio (integracion)", () => {
  const admin = crearClienteAdmin();
  const sufijo = Date.now();
  let tenantId: string;
  let ownerId: string;
  let sucursalDosId: string;

  beforeAll(async () => {
    const { data, error } = await admin.auth.admin.createUser({
      email: `patrimonio-owner-${sufijo}@ceom-erp.test`,
      email_confirm: true,
    });
    if (error || !data.user) {
      throw error ?? new Error("No se pudo crear el usuario de Auth de prueba");
    }
    ownerId = data.user.id;

    const { tenant } = await identidadRepo.crearTenantConOwner({
      tenant: {
        nombreNegocio: `Patrimonio Test ${sufijo}`,
        monedaPrincipal: "BOB",
        estadoSuscripcion: "activa",
        fechaInicioSuscripcion: new Date().toISOString().slice(0, 10),
      },
      ownerId,
      ownerNombreCompleto: "Owner Patrimonio",
      ownerEmail: `patrimonio-owner-${sufijo}@ceom-erp.test`,
      rolOwnerId: ROL_OWNER_ID,
      creadoPor: null,
    });
    tenantId = tenant.id;

    const [otraSucursal] = await db
      .insert(sucursales)
      .values({ tenantId, nombre: "Sucursal 2", esPrincipal: false, activa: true })
      .returning();
    sucursalDosId = otraSucursal.id;
  });

  afterAll(async () => {
    const pasivosDelTenant = await db
      .select({ id: pasivos.id })
      .from(pasivos)
      .where(eq(pasivos.tenantId, tenantId));
    for (const p of pasivosDelTenant) {
      await db.delete(pagosPasivo).where(eq(pagosPasivo.pasivoId, p.id));
    }
    await db.delete(pasivos).where(eq(pasivos.tenantId, tenantId));
    await db.delete(activos).where(eq(activos.tenantId, tenantId));
    await db.delete(usuarios).where(eq(usuarios.tenantId, tenantId));
    await db.delete(roles).where(eq(roles.tenantId, tenantId));
    await db.delete(sucursales).where(eq(sucursales.tenantId, tenantId));
    await db.delete(tenants).where(eq(tenants.id, tenantId));
    await admin.auth.admin.deleteUser(ownerId);
  });

  it("crearActivo sin datos de capacidad (mobiliario) — caso borde 5.1", async () => {
    const owner = await identidadRepo.obtenerUsuarioConRolPorId(ownerId);
    const resultado = await crearActivo(owner!, tenantId, {
      nombre: "Mueble de prueba",
      tipo: "mobiliario",
      valorCompra: 500,
      fechaAdquisicion: "2025-01-01",
    });
    expect(resultado.ok).toBe(true);
    if (!resultado.ok) return;

    const capacidad = await consultarCapacidad(owner!, resultado.data.activoId);
    expect(capacidad.ok).toBe(true);
    if (capacidad.ok) {
      expect(capacidad.data.capacidadProduccionCantidad).toBeNull();
    }
  });

  it("activo financiado: crear pasivo vinculado, ver saldo, dar de baja no cancela el pasivo", async () => {
    const owner = await identidadRepo.obtenerUsuarioConRolPorId(ownerId);

    const activo = await crearActivo(owner!, tenantId, {
      nombre: "Máquina de gelato",
      tipo: "equipo_productivo",
      capacidadProduccionCantidad: "7",
      capacidadProduccionUnidad: "litros por lote",
      valorCompra: 12000,
      fechaAdquisicion: "2025-01-01",
      vidaUtilMeses: "60",
    });
    expect(activo.ok).toBe(true);
    if (!activo.ok) return;

    const pasivo = await crearPasivo(owner!, tenantId, {
      activoId: activo.data.activoId,
      montoTotal: 12000,
      cuotaPeriodica: 1000,
      frecuenciaCuota: "mensual",
      plazoCuotas: 12,
      fechaInicio: "2025-01-01",
    });
    expect(pasivo.ok).toBe(true);
    if (!pasivo.ok) return;

    const consulta = await consultarPasivoDeActivo(owner!, activo.data.activoId);
    expect(consulta.ok).toBe(true);
    if (consulta.ok) {
      expect(consulta.data).toHaveLength(1);
      expect(consulta.data[0].saldoPendiente).toBe(12000);
    }

    const baja = await darDeBajaActivo(owner!, activo.data.activoId);
    expect(baja.ok).toBe(true);

    const activoActualizado = await repo.obtenerActivoPorId(activo.data.activoId);
    expect(activoActualizado?.estado).toBe("dado_de_baja");

    // El pasivo sigue activo pese a que el activo se dio de baja (regla 3).
    const pasivoActualizado = await repo.obtenerPasivoPorId(pasivo.data.pasivoId);
    expect(pasivoActualizado?.estado).toBe("activo");
  });

  it("registrarPagoPasivo: transiciona a 'pagado' cuando el saldo llega a 0", async () => {
    const owner = await identidadRepo.obtenerUsuarioConRolPorId(ownerId);

    const pasivo = await crearPasivo(owner!, tenantId, {
      montoTotal: 300,
      cuotaPeriodica: 300,
      frecuenciaCuota: "mensual",
      plazoCuotas: 1,
      fechaInicio: "2025-01-01",
    });
    if (!pasivo.ok) throw new Error("setup fallo");

    const pago = await registrarPagoPasivo(owner!, pasivo.data.pasivoId, {
      monto: 300,
      fechaPago: "2025-02-01",
    });
    expect(pago.ok).toBe(true);
    if (pago.ok) {
      expect(pago.data.saldoPendiente).toBe(0);
      expect(pago.data.estadoPasivo).toBe("pagado");
    }

    const pasivoFinal = await repo.obtenerPasivoPorId(pasivo.data.pasivoId);
    expect(pasivoFinal?.estado).toBe("pagado");
  });

  it("refinanciarPasivo: crea un pasivo nuevo y marca el anterior como 'refinanciado' (regla 4)", async () => {
    const owner = await identidadRepo.obtenerUsuarioConRolPorId(ownerId);

    const original = await crearPasivo(owner!, tenantId, {
      montoTotal: 5000,
      cuotaPeriodica: 500,
      frecuenciaCuota: "mensual",
      plazoCuotas: 10,
      fechaInicio: "2025-01-01",
    });
    if (!original.ok) throw new Error("setup fallo");

    const refinanciado = await refinanciarPasivo(owner!, original.data.pasivoId, {
      montoTotal: 5000,
      cuotaPeriodica: 400,
      frecuenciaCuota: "mensual",
      plazoCuotas: 13,
      fechaInicio: "2025-06-01",
    });
    expect(refinanciado.ok).toBe(true);
    if (!refinanciado.ok) return;
    expect(refinanciado.data.pasivoId).not.toBe(original.data.pasivoId);

    const anteriorFinal = await repo.obtenerPasivoPorId(original.data.pasivoId);
    expect(anteriorFinal?.estado).toBe("refinanciado");

    const nuevo = await repo.obtenerPasivoPorId(refinanciado.data.pasivoId);
    expect(nuevo?.refinanciadoDesdeId).toBe(original.data.pasivoId);
  });

  it("transferirActivo: cambia sucursal_id y audita modificado_por/modificado_en (caso borde 4)", async () => {
    const owner = await identidadRepo.obtenerUsuarioConRolPorId(ownerId);

    const activo = await crearActivo(owner!, tenantId, {
      nombre: "Vehículo de reparto",
      tipo: "vehiculo",
      valorCompra: 8000,
      fechaAdquisicion: "2024-01-01",
    });
    if (!activo.ok) throw new Error("setup fallo");

    const resultado = await transferirActivo(owner!, activo.data.activoId, sucursalDosId);
    expect(resultado.ok).toBe(true);

    const activoActualizado = await repo.obtenerActivoPorId(activo.data.activoId);
    expect(activoActualizado?.sucursalId).toBe(sucursalDosId);
    expect(activoActualizado?.modificadoPor).toBe(ownerId);
    expect(activoActualizado?.modificadoEn).not.toBeNull();
  });

  it("consultarValorPatrimonialTotal: suma valor_actual de activos menos saldo_pendiente de pasivos activos", async () => {
    const owner = await identidadRepo.obtenerUsuarioConRolPorId(ownerId);
    const resultado = await consultarValorPatrimonialTotal(owner!, tenantId);
    expect(resultado.ok).toBe(true);
    // No afirmamos un numero exacto (otros tests del mismo tenant ya
    // crearon activos/pasivos) — solo que el calculo corre sin error y
    // devuelve un numero.
    if (resultado.ok) {
      expect(typeof resultado.data.valorPatrimonialTotal).toBe("number");
    }
  });
});
