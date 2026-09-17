import { randomUUID } from "node:crypto";
import { eq, inArray } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { db } from "@/db/client";
import { ROL_OWNER_ID } from "@/modules/identidad/constants";
import * as identidadRepo from "@/modules/identidad/repository";
import type { UsuarioConRol } from "@/modules/identidad/repository";
import { authUsers, sucursales, tenants, usuarios } from "@/modules/identidad/schema";
import { fichaPasivo, listarPasivosConSaldo } from "@/modules/patrimonio/actions";
import { pagosPasivo, pasivos } from "@/modules/patrimonio/schema";
import { productos } from "@/modules/productos/schema";
import { fichaProveedor, listarProveedoresConCantidadCompras } from "@/modules/proveedores/actions";
import { compras, proveedores } from "@/modules/proveedores/schema";

/**
 * Las dos agregaciones que reemplazaron el N+1 del directorio de Proveedores
 * y de la pantalla de Deudas (incidente de pool del 2026-09-17) tienen que
 * dar **exactamente** el número que daban las fichas por fila.
 *
 * Valores elegidos para que la falla sea distinguible (dev-practices §6.1 b):
 * un proveedor con una compra eliminada (un `count` que no filtre
 * `eliminado_en` da 3, no 2), uno sin compras (un inner join lo haría
 * desaparecer), y un pasivo con dos pagos parciales (un join que duplique
 * filas o ignore pagos no da 650).
 */
const hasPostgres = Boolean(process.env.DATABASE_URL);

describe.skipIf(!hasPostgres)("Agregados de listado ≡ fichas por fila", () => {
  const sufijo = Date.now();
  let tenantId: string;
  let ownerId: string;
  let owner: UsuarioConRol;
  let sucursalId: string;
  let productoId: string;
  let conCompras: string;
  let sinCompras: string;
  let unaCompra: string;
  let pasivoConPagos: string;
  let pasivoSinPagos: string;

  beforeAll(async () => {
    ownerId = randomUUID();
    await db.insert(authUsers).values({ id: ownerId });
    const [tenant] = await db
      .insert(tenants)
      .values({
        nombreNegocio: `Agregados Listado ${sufijo}`,
        monedaPrincipal: "BOB",
        estadoSuscripcion: "activa",
        fechaInicioSuscripcion: new Date().toISOString().slice(0, 10),
      })
      .returning();
    tenantId = tenant.id;
    await db.insert(usuarios).values({
      id: ownerId,
      tenantId,
      rolId: ROL_OWNER_ID,
      nombreCompleto: "Owner Agregados",
      email: `owner-agregados-${sufijo}@ceom-erp.test`,
      esOwner: true,
    });
    const [sucursal] = await db
      .insert(sucursales)
      .values({ tenantId, nombre: "Principal", esPrincipal: true })
      .returning();
    sucursalId = sucursal.id;
    const [producto] = await db
      .insert(productos)
      .values({ tenantId, nombre: "Producto", unidadVenta: "unidad" as const, precioVenta: "10" })
      .returning();
    productoId = producto.id;

    const [a, b, c] = await db
      .insert(proveedores)
      .values([
        { tenantId, nombre: "Con compras", creadoPor: ownerId },
        { tenantId, nombre: "Sin compras", creadoPor: ownerId },
        { tenantId, nombre: "Una compra", creadoPor: ownerId },
      ])
      .returning();
    [conCompras, sinCompras, unaCompra] = [a.id, b.id, c.id];

    const compra = (proveedorId: string) => ({
      tenantId,
      sucursalId,
      proveedorId,
      tipo: "reventa" as const,
      productoId,
      cantidad: "1",
      costoUnitario: "10",
      montoTotal: "10",
      fechaCompra: "2026-09-01",
    });
    const filas = await db
      .insert(compras)
      .values([compra(conCompras), compra(conCompras), compra(conCompras), compra(unaCompra)])
      .returning();
    await db.update(compras).set({ eliminadoEn: new Date() }).where(eq(compras.id, filas[0].id));

    const [p1, p2] = await db
      .insert(pasivos)
      .values([
        { tenantId, montoTotal: "1000", cuotaPeriodica: "100", frecuenciaCuota: "mensual", plazoCuotas: 10, fechaInicio: "2026-01-01", creadoPor: ownerId },
        { tenantId, montoTotal: "500", cuotaPeriodica: "50", frecuenciaCuota: "mensual", plazoCuotas: 10, fechaInicio: "2026-01-01", creadoPor: ownerId },
      ])
      .returning();
    [pasivoConPagos, pasivoSinPagos] = [p1.id, p2.id];
    await db.insert(pagosPasivo).values([
      { pasivoId: pasivoConPagos, monto: "100", fechaPago: "2026-02-01", origen: "manual" as const },
      { pasivoId: pasivoConPagos, monto: "250", fechaPago: "2026-03-01", origen: "manual" as const },
    ]);

    const leido = await identidadRepo.obtenerUsuarioConRolPorId(ownerId);
    if (!leido) throw new Error("fixture: owner no encontrado");
    owner = leido;
  });

  afterAll(async () => {
    await db.delete(pagosPasivo).where(inArray(pagosPasivo.pasivoId, [pasivoConPagos, pasivoSinPagos]));
    await db.delete(pasivos).where(eq(pasivos.tenantId, tenantId));
    await db.delete(compras).where(eq(compras.tenantId, tenantId));
    await db.delete(proveedores).where(eq(proveedores.tenantId, tenantId));
    await db.delete(productos).where(eq(productos.tenantId, tenantId));
    await db.delete(usuarios).where(eq(usuarios.id, ownerId));
    await db.delete(sucursales).where(eq(sucursales.tenantId, tenantId));
    await db.delete(tenants).where(eq(tenants.id, tenantId));
    await db.delete(authUsers).where(eq(authUsers.id, ownerId));
  });

  it("listarProveedoresConCantidadCompras da el conteo exacto y el mismo que fichaProveedor", async () => {
    const res = await listarProveedoresConCantidadCompras(owner, tenantId);
    expect(res.ok).toBe(true);
    if (!res.ok) throw new Error("inalcanzable");
    const porId = new Map(res.data.map((p) => [p.id, p.cantidadCompras]));

    expect(Object.fromEntries([conCompras, sinCompras, unaCompra].map((id) => [id, porId.get(id)]))).toEqual({
      [conCompras]: 2,
      [sinCompras]: 0,
      [unaCompra]: 1,
    });
    for (const id of [conCompras, sinCompras, unaCompra]) {
      const ficha = await fichaProveedor(owner, id);
      expect(ficha.ok).toBe(true);
      if (!ficha.ok) throw new Error("inalcanzable");
      expect(porId.get(id)).toBe(ficha.data.cantidadCompras);
    }
  });

  it("listarPasivosConSaldo da el saldo exacto y el mismo que fichaPasivo", async () => {
    const res = await listarPasivosConSaldo(owner, tenantId);
    expect(res.ok).toBe(true);
    if (!res.ok) throw new Error("inalcanzable");
    const porId = new Map(res.data.map((p) => [p.id, p.saldoPendiente]));

    expect(porId.get(pasivoConPagos)).toBe(650);
    expect(porId.get(pasivoSinPagos)).toBe(500);
    for (const id of [pasivoConPagos, pasivoSinPagos]) {
      const ficha = await fichaPasivo(owner, id);
      expect(ficha.ok).toBe(true);
      if (!ficha.ok) throw new Error("inalcanzable");
      expect(porId.get(id)).toBe(ficha.data.saldoPendiente);
    }
  });

  it("un tenant ajeno no ve el listado (mismo gate que listarProveedores/listarPasivos)", async () => {
    const intruso = { ...owner, tenantId: randomUUID() };
    await expect(listarProveedoresConCantidadCompras(intruso, tenantId)).resolves.toEqual({
      ok: false,
      error: "No tenés permiso para ver proveedores.",
    });
    await expect(listarPasivosConSaldo(intruso, tenantId)).resolves.toEqual({
      ok: false,
      error: "No tenés permiso para ver pasivos.",
    });
  });
});
