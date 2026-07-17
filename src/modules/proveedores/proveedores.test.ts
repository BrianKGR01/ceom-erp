import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { db } from "@/db/client";
import { crearClienteAdmin } from "@/lib/supabase/server";
import { ROL_OWNER_ID } from "@/modules/identidad/constants";
import * as identidadRepo from "@/modules/identidad/repository";
import { roles, sucursales, tenants, usuarios } from "@/modules/identidad/schema";
import { consultarStockInsumo, crearInsumo } from "@/modules/operativo/nichos/nicho-1/actions";
import { insumos, movimientosInsumo, stockInsumo } from "@/modules/operativo/nichos/nicho-1/schema";
import { consultarStock, crearProducto } from "@/modules/productos/actions";
import { movimientosStock, productos, stock } from "@/modules/productos/schema";
import {
  fichaProveedor,
  historialPrecio,
  listarCompras,
  recibirCompra,
  registrarCompra,
  registrarCompraDeAjuste,
  registrarPagoCompra,
} from "./actions";
import * as repo from "./repository";
import { comprasAjuste, compras, pagosCompra, proveedores } from "./schema";

const hasCredenciales = Boolean(
  process.env.DATABASE_URL && process.env.SUPABASE_SECRET_KEY
);

// registrarCompra ahora encadena una llamada cross-modulo real (entrada de
// stock en Productos/Operativo Nicho 1 al nacer "recibido") — mismo motivo
// que Modulo 3/4/7 necesitan este timeout ampliado.
vi.setConfig({ testTimeout: 20000 });

describe.skipIf(!hasCredenciales)("Modulo 8 - Proveedores/Compras (integracion)", () => {
  const admin = crearClienteAdmin();
  const sufijo = Date.now();
  let tenantId: string;
  let ownerId: string;
  let sucursalId: string;
  let proveedorId: string;
  let insumoId: string;
  let productoId: string;

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

    const owner = await identidadRepo.obtenerUsuarioConRolPorId(ownerId);
    const insumo = await crearInsumo(owner!, tenantId, {
      nombre: "Insumo de prueba",
      unidadMedida: "kg",
    });
    if (!insumo.ok) throw new Error("setup fallo: crearInsumo");
    insumoId = insumo.data.insumoId;

    const producto = await crearProducto(owner!, tenantId, {
      nombre: "Producto de prueba",
      unidadVenta: "unidad",
      precioVenta: 20,
      tipoOrigenProducto: "reventa_simple",
    });
    if (!producto.ok) throw new Error("setup fallo: crearProducto");
    productoId = producto.data.productoId;
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
    await db.delete(movimientosInsumo).where(eq(movimientosInsumo.insumoId, insumoId));
    await db.delete(stockInsumo).where(eq(stockInsumo.insumoId, insumoId));
    await db.delete(insumos).where(eq(insumos.id, insumoId));
    await db.delete(movimientosStock).where(eq(movimientosStock.productoId, productoId));
    await db.delete(stock).where(eq(stock.productoId, productoId));
    await db.delete(productos).where(eq(productos.id, productoId));
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
      insumoId,
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
      productoId,
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
      insumoId,
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

    await registrarCompra(owner!, tenantId, {
      sucursalId,
      tipo: "insumo",
      insumoId,
      cantidad: 1,
      montoTotal: 50,
      fechaCompra: "2026-02-01",
    });
    await registrarCompra(owner!, tenantId, {
      sucursalId,
      tipo: "insumo",
      insumoId,
      cantidad: 1,
      montoTotal: 55,
      fechaCompra: "2026-01-15",
    });

    const resultado = await historialPrecio(owner!, tenantId, { insumoId });
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

  it("roadmap #12: registrarCompra con costoAdicionalTraslado prorratea el flete en costo_unitario", async () => {
    const owner = await identidadRepo.obtenerUsuarioConRolPorId(ownerId);
    const resultado = await registrarCompra(owner!, tenantId, {
      sucursalId,
      tipo: "insumo",
      insumoId,
      cantidad: 10,
      montoTotal: 100,
      costoAdicionalTraslado: 20,
      fechaCompra: "2026-03-01",
    });
    expect(resultado.ok).toBe(true);
    if (resultado.ok) expect(resultado.data.costoUnitario).toBe(12);
  });

  it("roadmap #12: registrarCompra estado=recibido (default) dispara la entrada de stock real", async () => {
    const owner = await identidadRepo.obtenerUsuarioConRolPorId(ownerId);
    const antes = await consultarStock(owner!, productoId, sucursalId);
    if (!antes.ok) throw new Error("setup fallo");

    const compra = await registrarCompra(owner!, tenantId, {
      sucursalId,
      proveedorId,
      tipo: "reventa",
      productoId,
      cantidad: 7,
      montoTotal: 140,
      fechaCompra: "2026-03-05",
    });
    expect(compra.ok).toBe(true);
    if (!compra.ok) return;
    expect(compra.data.entradaStock?.ok).toBe(true);

    const despues = await consultarStock(owner!, productoId, sucursalId);
    if (!despues.ok) throw new Error("assert fallo");
    expect(despues.data.cantidadActual).toBe(antes.data.cantidadActual + 7);
  });

  it("roadmap #12: registrarCompra estado=pedido no toca stock hasta recibirCompra()", async () => {
    const owner = await identidadRepo.obtenerUsuarioConRolPorId(ownerId);
    const antes = await consultarStockInsumo(owner!, insumoId, sucursalId);
    if (!antes.ok) throw new Error("setup fallo");

    const compra = await registrarCompra(owner!, tenantId, {
      sucursalId,
      proveedorId,
      tipo: "insumo",
      insumoId,
      cantidad: 4,
      montoTotal: 40,
      fechaCompra: "2026-03-10",
      estado: "pedido",
    });
    if (!compra.ok) throw new Error("setup fallo");
    expect((compra.data as { entradaStock?: unknown }).entradaStock).toBeUndefined();

    const compraPedido = await repo.obtenerCompraPorId(compra.data.compraId);
    expect(compraPedido?.estado).toBe("pedido");

    const duranteEspera = await consultarStockInsumo(owner!, insumoId, sucursalId);
    if (!duranteEspera.ok) throw new Error("assert fallo");
    expect(duranteEspera.data.cantidadActual).toBe(antes.data.cantidadActual);

    const recepcion = await recibirCompra(owner!, compra.data.compraId);
    expect(recepcion.ok).toBe(true);
    if (recepcion.ok) expect(recepcion.data.entradaStock.ok).toBe(true);

    const compraRecibida = await repo.obtenerCompraPorId(compra.data.compraId);
    expect(compraRecibida?.estado).toBe("recibido");
    expect(compraRecibida?.fechaRecepcion).not.toBeNull();

    const despues = await consultarStockInsumo(owner!, insumoId, sucursalId);
    if (!despues.ok) throw new Error("assert fallo");
    expect(despues.data.cantidadActual).toBe(antes.data.cantidadActual + 4);

    // recibirCompra sobre una compra ya recibida rechaza.
    const reintento = await recibirCompra(owner!, compra.data.compraId);
    expect(reintento.ok).toBe(false);
  });

  it("listarCompras: filtra por estadoPago y por estado (pedido/recibido)", async () => {
    const owner = await identidadRepo.obtenerUsuarioConRolPorId(ownerId);

    const recibidaPendiente = await registrarCompra(owner!, tenantId, {
      sucursalId,
      proveedorId,
      tipo: "reventa",
      productoId,
      cantidad: 2,
      montoTotal: 50,
      fechaCompra: "2026-04-01",
    });
    if (!recibidaPendiente.ok) throw new Error("setup fallo");

    const pedidoAbierto = await registrarCompra(owner!, tenantId, {
      sucursalId,
      proveedorId,
      tipo: "insumo",
      insumoId,
      cantidad: 1,
      montoTotal: 30,
      fechaCompra: "2026-04-02",
      estado: "pedido",
    });
    if (!pedidoAbierto.ok) throw new Error("setup fallo");

    const todas = await listarCompras(owner!, tenantId);
    expect(todas.ok).toBe(true);
    if (todas.ok) {
      const ids = todas.data.map((c) => c.id);
      expect(ids).toContain(recibidaPendiente.data.compraId);
      expect(ids).toContain(pedidoAbierto.data.compraId);
    }

    const soloPedidos = await listarCompras(owner!, tenantId, { estado: "pedido" });
    expect(soloPedidos.ok).toBe(true);
    if (soloPedidos.ok) {
      expect(soloPedidos.data.some((c) => c.id === pedidoAbierto.data.compraId)).toBe(true);
      expect(soloPedidos.data.some((c) => c.id === recibidaPendiente.data.compraId)).toBe(false);
    }

    const soloPendientesDePago = await listarCompras(owner!, tenantId, { estadoPago: "pendiente" });
    expect(soloPendientesDePago.ok).toBe(true);
    if (soloPendientesDePago.ok) {
      expect(soloPendientesDePago.data.some((c) => c.id === recibidaPendiente.data.compraId)).toBe(
        true
      );
    }
  });
});
