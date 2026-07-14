import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { db } from "@/db/client";
import { crearClienteAdmin } from "@/lib/supabase/server";
import { ROL_OWNER_ID } from "@/modules/identidad/constants";
import * as identidadRepo from "@/modules/identidad/repository";
import { roles, sucursales, tenants, usuarios } from "@/modules/identidad/schema";
import {
  fichaProveedor,
  historialPrecio,
  registrarCompra,
  registrarCompraDeAjuste,
  registrarPagoCompra,
} from "./actions";
import * as repo from "./repository";
import { comprasAjuste, compras, pagosCompra, proveedores } from "./schema";

const hasCredenciales = Boolean(
  process.env.DATABASE_URL && process.env.SUPABASE_SECRET_KEY
);

describe.skipIf(!hasCredenciales)("Modulo 8 - Proveedores/Compras (integracion)", () => {
  const admin = crearClienteAdmin();
  const sufijo = Date.now();
  let tenantId: string;
  let ownerId: string;
  let sucursalId: string;
  let proveedorId: string;

  beforeAll(async () => {
    const { data, error } = await admin.auth.admin.createUser({
      email: `proveedores-owner-${sufijo}@ceom-erp.test`,
      email_confirm: true,
    });
    if (error || !data.user) {
      throw error ?? new Error("No se pudo crear el usuario de Auth de prueba");
    }
    ownerId = data.user.id;

    const { tenant, sucursal } = await identidadRepo.crearTenantConOwner({
      tenant: {
        nombreNegocio: `Proveedores Test ${sufijo}`,
        monedaPrincipal: "BOB",
        estadoSuscripcion: "activa",
        fechaInicioSuscripcion: new Date().toISOString().slice(0, 10),
      },
      ownerId,
      ownerNombreCompleto: "Owner Proveedores",
      ownerEmail: `proveedores-owner-${sufijo}@ceom-erp.test`,
      rolOwnerId: ROL_OWNER_ID,
      creadoPor: null,
    });
    tenantId = tenant.id;
    sucursalId = sucursal.id;

    const [proveedor] = await db
      .insert(proveedores)
      .values({ tenantId, nombre: "Proveedor de prueba", creadoPor: ownerId })
      .returning();
    proveedorId = proveedor.id;
  });

  afterAll(async () => {
    const comprasDelTenant = await db
      .select({ id: compras.id })
      .from(compras)
      .where(eq(compras.tenantId, tenantId));
    for (const c of comprasDelTenant) {
      await db.delete(comprasAjuste).where(eq(comprasAjuste.compraId, c.id));
      await db.delete(pagosCompra).where(eq(pagosCompra.compraId, c.id));
    }
    await db.delete(compras).where(eq(compras.tenantId, tenantId));
    await db.delete(proveedores).where(eq(proveedores.tenantId, tenantId));
    await db.delete(usuarios).where(eq(usuarios.tenantId, tenantId));
    await db.delete(roles).where(eq(roles.tenantId, tenantId));
    await db.delete(sucursales).where(eq(sucursales.tenantId, tenantId));
    await db.delete(tenants).where(eq(tenants.id, tenantId));
    await admin.auth.admin.deleteUser(ownerId);
  });

  it("registrarCompra sin proveedor asociado (caso borde 3.4/5.2) calcula costo_unitario", async () => {
    const owner = await identidadRepo.obtenerUsuarioConRolPorId(ownerId);
    const resultado = await registrarCompra(owner!, tenantId, {
      sucursalId,
      tipo: "insumo",
      itemId: "00000000-0000-0000-0000-0000000000aa",
      cantidad: 10,
      montoTotal: 250,
      fechaCompra: "2026-01-01",
    });
    expect(resultado.ok).toBe(true);
    if (resultado.ok) {
      expect(resultado.data.costoUnitario).toBe(25);
    }

    if (resultado.ok) {
      const compra = await repo.obtenerCompraPorId(resultado.data.compraId);
      expect(compra?.proveedorId).toBeNull();
      expect(compra?.estadoPago).toBe("pendiente");
    }
  });

  it("registrarPagoCompra: transiciona pendiente -> parcial -> pagado", async () => {
    const owner = await identidadRepo.obtenerUsuarioConRolPorId(ownerId);
    const compra = await registrarCompra(owner!, tenantId, {
      sucursalId,
      proveedorId,
      tipo: "reventa",
      itemId: "00000000-0000-0000-0000-0000000000bb",
      cantidad: 5,
      montoTotal: 500,
      fechaCompra: "2026-01-05",
    });
    if (!compra.ok) throw new Error("setup fallo");

    const pagoParcial = await registrarPagoCompra(owner!, compra.data.compraId, {
      monto: 200,
      fechaPago: "2026-01-10",
    });
    expect(pagoParcial.ok).toBe(true);
    if (pagoParcial.ok) expect(pagoParcial.data.estadoPago).toBe("parcial");

    const pagoFinal = await registrarPagoCompra(owner!, compra.data.compraId, {
      monto: 300,
      fechaPago: "2026-01-20",
    });
    expect(pagoFinal.ok).toBe(true);
    if (pagoFinal.ok) {
      expect(pagoFinal.data.estadoPago).toBe("pagado");
      expect(pagoFinal.data.totalPagado).toBe(500);
    }
  });

  it("registrarCompraDeAjuste referencia a la original sin editarla, y exige motivo", async () => {
    const owner = await identidadRepo.obtenerUsuarioConRolPorId(ownerId);
    const compra = await registrarCompra(owner!, tenantId, {
      sucursalId,
      proveedorId,
      tipo: "insumo",
      itemId: "00000000-0000-0000-0000-0000000000cc",
      cantidad: 2,
      montoTotal: 100,
      fechaCompra: "2026-01-01",
    });
    if (!compra.ok) throw new Error("setup fallo");

    const sinMotivo = await registrarCompraDeAjuste(owner!, compra.data.compraId, {
      tipo: "correccion",
      montoAjuste: 10,
      motivo: "   ",
    });
    expect(sinMotivo.ok).toBe(false);

    const ajuste = await registrarCompraDeAjuste(owner!, compra.data.compraId, {
      tipo: "correccion",
      montoAjuste: 10,
      motivo: "Se cargó mal la cantidad",
    });
    expect(ajuste.ok).toBe(true);

    // La compra original queda intacta.
    const compraOriginal = await repo.obtenerCompraPorId(compra.data.compraId);
    expect(Number(compraOriginal?.montoTotal)).toBe(100);
  });

  it("historialPrecio devuelve las compras de un item ordenadas por fecha", async () => {
    const owner = await identidadRepo.obtenerUsuarioConRolPorId(ownerId);
    const itemId = "00000000-0000-0000-0000-0000000000dd";

    await registrarCompra(owner!, tenantId, {
      sucursalId,
      tipo: "insumo",
      itemId,
      cantidad: 1,
      montoTotal: 50,
      fechaCompra: "2026-02-01",
    });
    await registrarCompra(owner!, tenantId, {
      sucursalId,
      tipo: "insumo",
      itemId,
      cantidad: 1,
      montoTotal: 55,
      fechaCompra: "2026-01-15",
    });

    const resultado = await historialPrecio(owner!, tenantId, itemId);
    expect(resultado.ok).toBe(true);
    if (resultado.ok) {
      expect(resultado.data.length).toBeGreaterThanOrEqual(2);
      const fechas = resultado.data.map((c) => c.fechaCompra);
      const ordenadas = [...fechas].sort();
      expect(fechas).toEqual(ordenadas);
    }
  });

  it("fichaProveedor resume cantidad y monto total de compras", async () => {
    const owner = await identidadRepo.obtenerUsuarioConRolPorId(ownerId);
    const resultado = await fichaProveedor(owner!, proveedorId);
    expect(resultado.ok).toBe(true);
    if (resultado.ok) {
      expect(resultado.data.proveedor?.id).toBe(proveedorId);
      expect(resultado.data.cantidadCompras).toBeGreaterThanOrEqual(1);
    }
  });
});
