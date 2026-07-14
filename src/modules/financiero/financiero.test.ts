import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { db } from "@/db/client";
import { crearClienteAdmin } from "@/lib/supabase/server";
import { ROL_OWNER_ID } from "@/modules/identidad/constants";
import * as identidadRepo from "@/modules/identidad/repository";
import { roles, sucursales, tenants, usuarios } from "@/modules/identidad/schema";
import {
  crearCategoriaGasto,
  crearGastoManual,
  registrarPagoGasto,
  consultarTotalCostosFijos,
} from "@/modules/gastos/actions";
import { categoriasGasto, gastos, pagosGasto } from "@/modules/gastos/schema";
import { crearProducto, registrarAjusteManualStock } from "@/modules/productos/actions";
import { categoriasProducto, movimientosStock, productos, stock } from "@/modules/productos/schema";
import { crearProveedor, registrarCompra, registrarPagoCompra } from "@/modules/proveedores/actions";
import { compras, pagosCompra, proveedores } from "@/modules/proveedores/schema";
import {
  crearCanalVenta,
  crearMetodoPago,
  registrarAjusteVenta,
  registrarPagoVenta,
  registrarVenta,
} from "@/modules/ventas/actions";
import {
  ajustesVenta,
  canalesVenta,
  detallesVenta,
  metodosPago,
  pagosVenta,
  ventas,
} from "@/modules/ventas/schema";
import { costoFijoTotal, estadoResultados, flujoCaja, margenPorProducto } from "./actions";

const hasCredenciales = Boolean(
  process.env.DATABASE_URL && process.env.SUPABASE_SECRET_KEY
);

vi.setConfig({ testTimeout: 20000 });

describe.skipIf(!hasCredenciales)("Modulo 7 - Financiero (integracion)", () => {
  const admin = crearClienteAdmin();
  const sufijo = Date.now();
  let tenantId: string;
  let ownerId: string;
  let sucursalId: string;
  let sucursalDosId: string;
  let canalVentaId: string;
  let metodoPagoId: string;
  let productoId: string;
  // "hasta" cubre bien mas alla de junio a proposito: ajustesVenta.creadoEn
  // no es un dato que el test controle (defaultNow() en el schema, sin
  // parametro para forzarlo), asi que el periodo tiene que incluir la
  // fecha real de ejecucion del test para que sumarAjustesVentaPeriodo lo
  // cuente.
  const periodo = { desde: "2026-06-01", hasta: "2026-12-31" };

  beforeAll(async () => {
    const { data, error } = await admin.auth.admin.createUser({
      email: `financiero-owner-${sufijo}@ceom-erp.test`,
      email_confirm: true,
    });
    if (error || !data.user) {
      throw error ?? new Error("No se pudo crear el usuario de Auth de prueba");
    }
    ownerId = data.user.id;

    const { tenant, sucursal } = await identidadRepo.crearTenantConOwner({
      tenant: {
        nombreNegocio: `Financiero Test ${sufijo}`,
        monedaPrincipal: "BOB",
        estadoSuscripcion: "activa",
        fechaInicioSuscripcion: new Date().toISOString().slice(0, 10),
      },
      ownerId,
      ownerNombreCompleto: "Owner Financiero",
      ownerEmail: `financiero-owner-${sufijo}@ceom-erp.test`,
      rolOwnerId: ROL_OWNER_ID,
      creadoPor: null,
    });
    tenantId = tenant.id;
    sucursalId = sucursal.id;

    const [destino] = await db
      .insert(sucursales)
      .values({ tenantId, nombre: "Sucursal Dos", esPrincipal: false })
      .returning();
    sucursalDosId = destino.id;

    const owner = await identidadRepo.obtenerUsuarioConRolPorId(ownerId);
    const canal = await crearCanalVenta(owner!, tenantId, { nombre: "Local" });
    if (!canal.ok) throw new Error("setup fallo: crearCanalVenta");
    canalVentaId = canal.data.canalVentaId;

    const metodo = await crearMetodoPago(owner!, tenantId, { nombre: "Efectivo" });
    if (!metodo.ok) throw new Error("setup fallo: crearMetodoPago");
    metodoPagoId = metodo.data.metodoPagoId;

    const producto = await crearProducto(owner!, tenantId, {
      nombre: "Gelato Frutos Rojos",
      unidadVenta: "unidad",
      precioVenta: 50,
      costoOperativoVigente: 20,
    });
    if (!producto.ok) throw new Error("setup fallo: crearProducto");
    productoId = producto.data.productoId;
    await registrarAjusteManualStock(owner!, tenantId, {
      productoId,
      sucursalId,
      tipo: "entrada_ajuste_manual",
      cantidad: 100,
      motivo: "Carga inicial",
    });
  });

  afterAll(async () => {
    const ventasDelTenant = await db
      .select({ id: ventas.id })
      .from(ventas)
      .where(eq(ventas.tenantId, tenantId));
    for (const v of ventasDelTenant) {
      await db.delete(ajustesVenta).where(eq(ajustesVenta.ventaId, v.id));
      await db.delete(pagosVenta).where(eq(pagosVenta.ventaId, v.id));
      await db.delete(detallesVenta).where(eq(detallesVenta.ventaId, v.id));
    }
    await db.delete(ventas).where(eq(ventas.tenantId, tenantId));
    await db.delete(canalesVenta).where(eq(canalesVenta.tenantId, tenantId));
    await db.delete(metodosPago).where(eq(metodosPago.tenantId, tenantId));

    const gastosDelTenant = await db
      .select({ id: gastos.id })
      .from(gastos)
      .where(eq(gastos.tenantId, tenantId));
    for (const g of gastosDelTenant) {
      await db.delete(pagosGasto).where(eq(pagosGasto.gastoId, g.id));
    }
    await db.delete(gastos).where(eq(gastos.tenantId, tenantId));
    await db.delete(categoriasGasto).where(eq(categoriasGasto.tenantId, tenantId));

    const comprasDelTenant = await db
      .select({ id: compras.id })
      .from(compras)
      .where(eq(compras.tenantId, tenantId));
    for (const c of comprasDelTenant) {
      await db.delete(pagosCompra).where(eq(pagosCompra.compraId, c.id));
    }
    await db.delete(compras).where(eq(compras.tenantId, tenantId));
    await db.delete(proveedores).where(eq(proveedores.tenantId, tenantId));

    const productosDelTenant = await db
      .select({ id: productos.id })
      .from(productos)
      .where(eq(productos.tenantId, tenantId));
    for (const p of productosDelTenant) {
      await db.delete(movimientosStock).where(eq(movimientosStock.productoId, p.id));
      await db.delete(stock).where(eq(stock.productoId, p.id));
    }
    await db.delete(productos).where(eq(productos.tenantId, tenantId));
    await db.delete(categoriasProducto).where(eq(categoriasProducto.tenantId, tenantId));

    await db.delete(usuarios).where(eq(usuarios.tenantId, tenantId));
    await db.delete(roles).where(eq(roles.tenantId, tenantId));
    await db.delete(sucursales).where(eq(sucursales.tenantId, tenantId));
    await db.delete(tenants).where(eq(tenants.id, tenantId));
    await admin.auth.admin.deleteUser(ownerId);
  });

  it("caso de uso 1/2: estadoResultados cuenta una venta pendiente de cobro; flujoCaja no, hasta que se pague", async () => {
    const owner = await identidadRepo.obtenerUsuarioConRolPorId(ownerId);
    const venta = await registrarVenta(owner!, tenantId, {
      sucursalId,
      canalVentaId,
      fechaVenta: "2026-06-05",
      lineas: [{ productoId, cantidad: 4 }], // ingresos 200, costos 80
    });
    expect(venta.ok).toBe(true);
    if (!venta.ok) return;

    const resultados = await estadoResultados(owner!, tenantId, periodo);
    expect(resultados.ok).toBe(true);
    if (resultados.ok) {
      expect(resultados.data.ingresos).toBeGreaterThanOrEqual(200);
      expect(resultados.data.costos).toBeGreaterThanOrEqual(80);
    }

    const cajaAntesDePagar = await flujoCaja(owner!, tenantId, periodo);
    expect(cajaAntesDePagar.ok).toBe(true);
    if (cajaAntesDePagar.ok) expect(cajaAntesDePagar.data.pagosVenta).toBe(0);

    await registrarPagoVenta(owner!, venta.data.ventaId, {
      monto: 200,
      metodoPagoId,
      fechaPago: "2026-06-06",
    });

    const cajaDespuesDePagar = await flujoCaja(owner!, tenantId, periodo);
    expect(cajaDespuesDePagar.ok).toBe(true);
    if (cajaDespuesDePagar.ok) expect(cajaDespuesDePagar.data.pagosVenta).toBeGreaterThanOrEqual(200);
  });

  it("regla 1.1: flujoCaja resta pagos de compra y de gasto reales del periodo", async () => {
    const owner = await identidadRepo.obtenerUsuarioConRolPorId(ownerId);

    const proveedor = await crearProveedor(owner!, tenantId, { nombre: "Distribuidora Test" });
    if (!proveedor.ok) throw new Error("setup fallo");
    const compra = await registrarCompra(owner!, tenantId, {
      sucursalId,
      proveedorId: proveedor.data.proveedorId,
      tipo: "reventa",
      itemId: "00000000-0000-0000-0000-0000000000aa",
      cantidad: 10,
      montoTotal: 300,
      fechaCompra: "2026-06-10",
    });
    if (!compra.ok) throw new Error("setup fallo");
    await registrarPagoCompra(owner!, compra.data.compraId, { monto: 300, fechaPago: "2026-06-11" });

    const categoria = await crearCategoriaGasto(owner!, tenantId, { nombre: "Servicios" });
    if (!categoria.ok) throw new Error("setup fallo");
    const gasto = await crearGastoManual(owner!, tenantId, {
      tipo: "fijo",
      categoriaId: categoria.data.categoriaId,
      monto: 150,
      fechaGasto: "2026-06-12",
    });
    if (!gasto.ok) throw new Error("setup fallo");
    await registrarPagoGasto(owner!, gasto.data.gastoId, { monto: 150, fechaPago: "2026-06-13" });

    const caja = await flujoCaja(owner!, tenantId, periodo);
    expect(caja.ok).toBe(true);
    if (caja.ok) {
      expect(caja.data.pagosCompra).toBeGreaterThanOrEqual(300);
      expect(caja.data.pagosGasto).toBeGreaterThanOrEqual(150);
    }
  });

  it("seccion 1.3: margenPorProducto refleja un AjusteVenta del producto dentro del periodo", async () => {
    const owner = await identidadRepo.obtenerUsuarioConRolPorId(ownerId);
    const venta = await registrarVenta(owner!, tenantId, {
      sucursalId,
      canalVentaId,
      fechaVenta: "2026-06-15",
      lineas: [{ productoId, cantidad: 2 }], // ingresos 100, costos 40
    });
    if (!venta.ok) throw new Error("setup fallo");

    const margenSinAjuste = await margenPorProducto(owner!, tenantId, productoId, periodo);
    expect(margenSinAjuste.ok).toBe(true);

    const ajuste = await registrarAjusteVenta(owner!, venta.data.ventaId, {
      tipo: "descuento_posterior",
      montoAjuste: -20,
      productoId,
      motivo: "Descuento por promoción retroactiva",
    });
    expect(ajuste.ok).toBe(true);

    const margenConAjuste = await margenPorProducto(owner!, tenantId, productoId, periodo);
    expect(margenConAjuste.ok).toBe(true);
    if (margenSinAjuste.ok && margenConAjuste.ok) {
      expect(margenConAjuste.data.ingresosAjustados).toBe(
        margenSinAjuste.data.ingresosAjustados - 20
      );
    }
  });

  it("seccion 1.4: costoFijoTotal coincide exactamente con consultarTotalCostosFijos de Módulo 4", async () => {
    const owner = await identidadRepo.obtenerUsuarioConRolPorId(ownerId);
    const [directo, viaFinanciero] = await Promise.all([
      consultarTotalCostosFijos(owner!, tenantId, periodo),
      costoFijoTotal(owner!, tenantId, periodo),
    ]);
    expect(directo.ok).toBe(true);
    expect(viaFinanciero.ok).toBe(true);
    if (directo.ok && viaFinanciero.ok) {
      expect(viaFinanciero.data.costoFijoTotal).toBe(directo.data.totalCostosFijos);
    }
  });

  it("filtro por sucursalId: una venta en otra sucursal no se cuenta si se filtra por la primera", async () => {
    const owner = await identidadRepo.obtenerUsuarioConRolPorId(ownerId);
    await registrarAjusteManualStock(owner!, tenantId, {
      productoId,
      sucursalId: sucursalDosId,
      tipo: "entrada_ajuste_manual",
      cantidad: 10,
      motivo: "Carga inicial sucursal dos",
    });
    const ventaOtraSucursal = await registrarVenta(owner!, tenantId, {
      sucursalId: sucursalDosId,
      canalVentaId,
      fechaVenta: "2026-06-20",
      lineas: [{ productoId, cantidad: 1 }], // ingresos 50
    });
    expect(ventaOtraSucursal.ok).toBe(true);

    const resultadosFiltrados = await estadoResultados(owner!, tenantId, periodo, {
      sucursalId,
    });
    const resultadosSinFiltro = await estadoResultados(owner!, tenantId, periodo);
    expect(resultadosFiltrados.ok).toBe(true);
    expect(resultadosSinFiltro.ok).toBe(true);
    if (resultadosFiltrados.ok && resultadosSinFiltro.ok) {
      expect(resultadosSinFiltro.data.ingresos).toBeGreaterThan(resultadosFiltrados.data.ingresos);
    }
  });
});
