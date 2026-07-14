import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { db } from "@/db/client";
import { crearClienteAdmin } from "@/lib/supabase/server";
import { ROL_OWNER_ID } from "@/modules/identidad/constants";
import * as identidadRepo from "@/modules/identidad/repository";
import {
  permisosEspecialesPorUsuario,
  roles,
  sucursales,
  tenants,
  usuarios,
} from "@/modules/identidad/schema";
import {
  actualizarProducto,
  consultarStock,
  crearProducto,
  registrarAjusteManualStock,
} from "@/modules/productos/actions";
import { categoriasProducto, movimientosStock, productos, stock } from "@/modules/productos/schema";
import {
  abrirEvento,
  crearCanalVenta,
  crearMetodoPago,
  fichaVenta,
  importarVentaHistorica,
  listarVentas,
  registrarAjusteVenta,
  registrarPagoVenta,
  registrarVenta,
} from "./actions";
import {
  ajustesVenta,
  canalesVenta,
  clientes,
  detallesVenta,
  eventos,
  metodosPago,
  pagosVenta,
  ventas,
} from "./schema";

const hasCredenciales = Boolean(
  process.env.DATABASE_URL && process.env.SUPABASE_SECRET_KEY
);

// registrarVenta hace varias transacciones secuenciales (snapshot + venta +
// descuento de stock por linea) — supera el default de Vitest (5000ms)
// contra la latencia real de red a Supabase Cloud en casi todos los tests
// de este archivo, a diferencia de Modulo 2/6 donde era la excepcion.
vi.setConfig({ testTimeout: 20000 });

describe.skipIf(!hasCredenciales)("Modulo 3 - Ventas + Clientes (integracion)", () => {
  const admin = crearClienteAdmin();
  const sufijo = Date.now();
  let tenantId: string;
  let ownerId: string;
  let sucursalId: string;
  let canalVentaId: string;
  let metodoPagoId: string;

  beforeAll(async () => {
    const { data, error } = await admin.auth.admin.createUser({
      email: `ventas-owner-${sufijo}@ceom-erp.test`,
      email_confirm: true,
    });
    if (error || !data.user) {
      throw error ?? new Error("No se pudo crear el usuario de Auth de prueba");
    }
    ownerId = data.user.id;

    const { tenant, sucursal } = await identidadRepo.crearTenantConOwner({
      tenant: {
        nombreNegocio: `Ventas Test ${sufijo}`,
        monedaPrincipal: "BOB",
        estadoSuscripcion: "activa",
        fechaInicioSuscripcion: new Date().toISOString().slice(0, 10),
      },
      ownerId,
      ownerNombreCompleto: "Owner Ventas",
      ownerEmail: `ventas-owner-${sufijo}@ceom-erp.test`,
      rolOwnerId: ROL_OWNER_ID,
      creadoPor: null,
    });
    tenantId = tenant.id;
    sucursalId = sucursal.id;

    const owner = await identidadRepo.obtenerUsuarioConRolPorId(ownerId);
    const canal = await crearCanalVenta(owner!, tenantId, {
      nombre: "Feria",
      porcentajeComisionDefault: 10,
    });
    if (!canal.ok) throw new Error("setup fallo: crearCanalVenta");
    canalVentaId = canal.data.canalVentaId;

    const metodo = await crearMetodoPago(owner!, tenantId, { nombre: "Efectivo" });
    if (!metodo.ok) throw new Error("setup fallo: crearMetodoPago");
    metodoPagoId = metodo.data.metodoPagoId;

    await db.insert(permisosEspecialesPorUsuario).values({
      usuarioId: ownerId,
      capacidad: "gestionar_eventos",
      habilitado: true,
      creadoPor: ownerId,
    });
  });

  afterAll(async () => {
    await db
      .delete(permisosEspecialesPorUsuario)
      .where(eq(permisosEspecialesPorUsuario.usuarioId, ownerId));

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
    await db.delete(eventos).where(eq(eventos.tenantId, tenantId));
    await db.delete(clientes).where(eq(clientes.tenantId, tenantId));
    await db.delete(metodosPago).where(eq(metodosPago.tenantId, tenantId));
    await db.delete(canalesVenta).where(eq(canalesVenta.tenantId, tenantId));

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
  }, 30000);

  it(
    "regla 1: snapshot doble — cambiar el precio del producto despues no toca la venta ya registrada",
    async () => {
      const owner = await identidadRepo.obtenerUsuarioConRolPorId(ownerId);
      const producto = await crearProducto(owner!, tenantId, {
        nombre: "Gelato Frutos Rojos",
        unidadVenta: "unidad",
        precioVenta: 20,
      });
      if (!producto.ok) throw new Error("setup fallo");
      const productoId = producto.data.productoId;

      await registrarAjusteManualStock(owner!, tenantId, {
        productoId,
        sucursalId,
        tipo: "entrada_ajuste_manual",
        cantidad: 50,
        motivo: "Carga inicial",
      });

      const venta = await registrarVenta(owner!, tenantId, {
        sucursalId,
        canalVentaId,
        lineas: [{ productoId, cantidad: 2 }],
      });
      expect(venta.ok).toBe(true);
      if (!venta.ok) return;

      await actualizarProducto(owner!, productoId, { precioVenta: 30 });

      const ficha = await fichaVenta(owner!, venta.data.ventaId);
      expect(ficha.ok).toBe(true);
      if (ficha.ok) {
        expect(Number(ficha.data.detalles[0]?.precioVentaSnapshot)).toBe(20);
      }
    },
    20000
  );

  it("regla: descuento de stock real en Productos e Inventario (no es un stub)", async () => {
    const owner = await identidadRepo.obtenerUsuarioConRolPorId(ownerId);
    const producto = await crearProducto(owner!, tenantId, {
      nombre: "Gelato Vainilla",
      unidadVenta: "unidad",
      precioVenta: 18,
    });
    if (!producto.ok) throw new Error("setup fallo");
    const productoId = producto.data.productoId;

    await registrarAjusteManualStock(owner!, tenantId, {
      productoId,
      sucursalId,
      tipo: "entrada_ajuste_manual",
      cantidad: 20,
      motivo: "Carga inicial",
    });

    const venta = await registrarVenta(owner!, tenantId, {
      sucursalId,
      canalVentaId,
      lineas: [{ productoId, cantidad: 5 }],
    });
    expect(venta.ok).toBe(true);
    if (venta.ok) {
      expect(venta.data.descuentosStock[0]?.ok).toBe(true);
    }

    const stockRestante = await consultarStock(owner!, productoId, sucursalId);
    expect(stockRestante.ok).toBe(true);
    if (stockRestante.ok) expect(stockRestante.data.cantidadActual).toBe(15);
  });

  it("regla 4 / 4.4: venta sin cliente es valida; venta con cliente nuevo lo crea en el mismo acto", async () => {
    const owner = await identidadRepo.obtenerUsuarioConRolPorId(ownerId);
    const producto = await crearProducto(owner!, tenantId, {
      nombre: "Empanada de Queso",
      unidadVenta: "unidad",
      precioVenta: 8,
    });
    if (!producto.ok) throw new Error("setup fallo");
    const productoId = producto.data.productoId;
    await registrarAjusteManualStock(owner!, tenantId, {
      productoId,
      sucursalId,
      tipo: "entrada_ajuste_manual",
      cantidad: 30,
      motivo: "Carga inicial",
    });

    const sinCliente = await registrarVenta(owner!, tenantId, {
      sucursalId,
      canalVentaId,
      lineas: [{ productoId, cantidad: 1 }],
    });
    expect(sinCliente.ok).toBe(true);

    const conClienteNuevo = await registrarVenta(owner!, tenantId, {
      sucursalId,
      canalVentaId,
      clienteNuevo: { nombre: "Cliente de Feria", telefono: "70000000" },
      lineas: [{ productoId, cantidad: 1 }],
    });
    expect(conClienteNuevo.ok).toBe(true);
    if (conClienteNuevo.ok) {
      const ficha = await fichaVenta(owner!, conClienteNuevo.data.ventaId);
      expect(ficha.ok).toBe(true);
      if (ficha.ok) expect(ficha.data.venta?.clienteId).not.toBeNull();
    }
  });

  it(
    "regla 5 / 4.3: comision se calcula sola — por canal si no hay evento, por evento si lo hay",
    async () => {
      const owner = await identidadRepo.obtenerUsuarioConRolPorId(ownerId);
      const producto = await crearProducto(owner!, tenantId, {
        nombre: "Botella de Agua",
        unidadVenta: "unidad",
        precioVenta: 10,
      });
      if (!producto.ok) throw new Error("setup fallo");
      const productoId = producto.data.productoId;
      await registrarAjusteManualStock(owner!, tenantId, {
        productoId,
        sucursalId,
        tipo: "entrada_ajuste_manual",
        cantidad: 20,
        motivo: "Carga inicial",
      });

      const ventaPorCanal = await registrarVenta(owner!, tenantId, {
        sucursalId,
        canalVentaId,
        lineas: [{ productoId, cantidad: 10 }], // total 100
      });
      expect(ventaPorCanal.ok).toBe(true);
      if (ventaPorCanal.ok) expect(ventaPorCanal.data.comisionMontoCalculado).toBe(10); // 10% de 100

      const evento = await abrirEvento(owner!, tenantId, {
        sucursalId,
        canalVentaId,
        nombre: "Feria UPSA",
        porcentajeComision: 25,
        fechaInicio: "2026-03-01",
        fechaFin: "2026-03-02",
      });
      expect(evento.ok).toBe(true);
      if (!evento.ok) return;

      const ventaPorEvento = await registrarVenta(owner!, tenantId, {
        sucursalId,
        canalVentaId,
        eventoId: evento.data.eventoId,
        lineas: [{ productoId, cantidad: 4 }], // total 40
      });
      expect(ventaPorEvento.ok).toBe(true);
      if (ventaPorEvento.ok) expect(ventaPorEvento.data.comisionMontoCalculado).toBe(10); // 25% de 40
    },
    20000
  );

  it(
    "caso borde 2: registrarAjusteVenta exige motivo, no edita la venta original, y devuelve stock real",
    async () => {
      const owner = await identidadRepo.obtenerUsuarioConRolPorId(ownerId);
      const producto = await crearProducto(owner!, tenantId, {
        nombre: "Yogurt Natural",
        unidadVenta: "unidad",
        precioVenta: 6,
      });
      if (!producto.ok) throw new Error("setup fallo");
      const productoId = producto.data.productoId;
      await registrarAjusteManualStock(owner!, tenantId, {
        productoId,
        sucursalId,
        tipo: "entrada_ajuste_manual",
        cantidad: 20,
        motivo: "Carga inicial",
      });

      const venta = await registrarVenta(owner!, tenantId, {
        sucursalId,
        canalVentaId,
        lineas: [{ productoId, cantidad: 5 }],
      });
      if (!venta.ok) throw new Error("setup fallo");

      const stockTrasVenta = await consultarStock(owner!, productoId, sucursalId);
      expect(stockTrasVenta.ok).toBe(true);
      if (stockTrasVenta.ok) expect(stockTrasVenta.data.cantidadActual).toBe(15);

      const sinMotivo = await registrarAjusteVenta(owner!, venta.data.ventaId, {
        tipo: "devolucion",
        montoAjuste: -6,
        productoId,
        cantidadProductoAjustada: 1,
        motivo: "  ",
      });
      expect(sinMotivo.ok).toBe(false);

      const ajuste = await registrarAjusteVenta(owner!, venta.data.ventaId, {
        tipo: "devolucion",
        montoAjuste: -6,
        productoId,
        cantidadProductoAjustada: 1,
        motivo: "Cliente devolvió una unidad",
      });
      expect(ajuste.ok).toBe(true);
      if (ajuste.ok) expect(ajuste.data.ajusteStock?.ok).toBe(true);

      const stockTrasAjuste = await consultarStock(owner!, productoId, sucursalId);
      expect(stockTrasAjuste.ok).toBe(true);
      if (stockTrasAjuste.ok) expect(stockTrasAjuste.data.cantidadActual).toBe(16); // 15 + 1 devuelto

      const ficha = await fichaVenta(owner!, venta.data.ventaId);
      expect(ficha.ok).toBe(true);
      if (ficha.ok) expect(Number(ficha.data.detalles[0]?.cantidad)).toBe(5); // venta original intacta
    },
    20000
  );

  it("regla 7: devolucion con generaPagoNegativo=true crea un Pago de Venta con monto negativo", async () => {
    const owner = await identidadRepo.obtenerUsuarioConRolPorId(ownerId);
    const producto = await crearProducto(owner!, tenantId, {
      nombre: "Vaso Descartable",
      unidadVenta: "unidad",
      precioVenta: 1,
    });
    if (!producto.ok) throw new Error("setup fallo");
    const productoId = producto.data.productoId;
    await registrarAjusteManualStock(owner!, tenantId, {
      productoId,
      sucursalId,
      tipo: "entrada_ajuste_manual",
      cantidad: 10,
      motivo: "Carga inicial",
    });

    const venta = await registrarVenta(owner!, tenantId, {
      sucursalId,
      canalVentaId,
      lineas: [{ productoId, cantidad: 10 }],
      pagoInicial: { metodoPagoId, monto: 10 },
    });
    if (!venta.ok) throw new Error("setup fallo");

    const ajuste = await registrarAjusteVenta(owner!, venta.data.ventaId, {
      tipo: "devolucion",
      montoAjuste: -5,
      motivo: "Devolución de dinero real al cliente",
      generaPagoNegativo: true,
      metodoPagoId,
    });
    expect(ajuste.ok).toBe(true);

    const ficha = await fichaVenta(owner!, venta.data.ventaId);
    expect(ficha.ok).toBe(true);
    if (ficha.ok) {
      const pagoNegativo = ficha.data.pagos.find((p) => Number(p.monto) < 0);
      expect(pagoNegativo).toBeTruthy();
      expect(Number(pagoNegativo?.monto)).toBe(-5);
    }
  });

  it("regla 1.4: registrarPagoVenta transiciona pendiente -> parcial -> pagado", async () => {
    const owner = await identidadRepo.obtenerUsuarioConRolPorId(ownerId);
    const producto = await crearProducto(owner!, tenantId, {
      nombre: "Bolsa de Hielo",
      unidadVenta: "unidad",
      precioVenta: 50,
    });
    if (!producto.ok) throw new Error("setup fallo");
    const productoId = producto.data.productoId;
    await registrarAjusteManualStock(owner!, tenantId, {
      productoId,
      sucursalId,
      tipo: "entrada_ajuste_manual",
      cantidad: 5,
      motivo: "Carga inicial",
    });

    const venta = await registrarVenta(owner!, tenantId, {
      sucursalId,
      canalVentaId,
      lineas: [{ productoId, cantidad: 2 }], // total 100
    });
    if (!venta.ok) throw new Error("setup fallo");

    const pagoParcial = await registrarPagoVenta(owner!, venta.data.ventaId, {
      monto: 40,
      metodoPagoId,
    });
    expect(pagoParcial.ok).toBe(true);
    if (pagoParcial.ok) expect(pagoParcial.data.estadoPago).toBe("parcial");

    const pagoFinal = await registrarPagoVenta(owner!, venta.data.ventaId, {
      monto: 60,
      metodoPagoId,
    });
    expect(pagoFinal.ok).toBe(true);
    if (pagoFinal.ok) expect(pagoFinal.data.estadoPago).toBe("pagado");
  });

  it("caso borde 4: importarVentaHistorica no descuenta stock ni calcula comision", async () => {
    const owner = await identidadRepo.obtenerUsuarioConRolPorId(ownerId);
    const producto = await crearProducto(owner!, tenantId, {
      nombre: "Producto Histórico",
      unidadVenta: "unidad",
      precioVenta: 15,
    });
    if (!producto.ok) throw new Error("setup fallo");
    const productoId = producto.data.productoId;
    await registrarAjusteManualStock(owner!, tenantId, {
      productoId,
      sucursalId,
      tipo: "entrada_ajuste_manual",
      cantidad: 10,
      motivo: "Carga inicial",
    });

    const importacion = await importarVentaHistorica(owner!, tenantId, {
      sucursalId,
      fechaVenta: "2026-05-15",
      canalVentaId,
      lineas: [
        {
          productoId,
          cantidad: 3,
          precioVentaSnapshot: 15,
          costoUnitarioSnapshot: 8,
        },
      ],
    });
    expect(importacion.ok).toBe(true);

    const stockSinCambios = await consultarStock(owner!, productoId, sucursalId);
    expect(stockSinCambios.ok).toBe(true);
    if (stockSinCambios.ok) expect(stockSinCambios.data.cantidadActual).toBe(10); // sin descuento

    if (importacion.ok) {
      const ficha = await fichaVenta(owner!, importacion.data.ventaId);
      expect(ficha.ok).toBe(true);
      if (ficha.ok) {
        expect(ficha.data.venta?.origenRegistro).toBe("importacion_historica");
        expect(ficha.data.venta?.comisionMontoCalculado).toBeNull();
      }
    }
  });

  it("regla 6: estado_acceso solo_lectura bloquea registrarVenta pero permite listarVentas", async () => {
    const owner = await identidadRepo.obtenerUsuarioConRolPorId(ownerId);
    const producto = await crearProducto(owner!, tenantId, {
      nombre: "Producto Preexistente",
      unidadVenta: "unidad",
      precioVenta: 5,
    });
    if (!producto.ok) throw new Error("setup fallo");
    const productoId = producto.data.productoId;
    await registrarAjusteManualStock(owner!, tenantId, {
      productoId,
      sucursalId,
      tipo: "entrada_ajuste_manual",
      cantidad: 10,
      motivo: "Carga inicial",
    });

    const ayer = new Date();
    ayer.setDate(ayer.getDate() - 1);
    await db
      .update(tenants)
      .set({ estadoSuscripcion: "vencida", fechaProximoPago: ayer.toISOString().slice(0, 10) })
      .where(eq(tenants.id, tenantId));

    // tienePermiso() de Identidad ya resuelve la regla 6 para cualquier
    // modulo que la use — no hace falta codigo propio en Ventas.
    const ventaBloqueada = await registrarVenta(owner!, tenantId, {
      sucursalId,
      canalVentaId,
      lineas: [{ productoId, cantidad: 1 }],
    });
    expect(ventaBloqueada.ok).toBe(false);

    const listado = await listarVentas(owner!, tenantId);
    expect(listado.ok).toBe(true);

    await db
      .update(tenants)
      .set({ estadoSuscripcion: "activa", fechaProximoPago: null })
      .where(eq(tenants.id, tenantId));
  });
});
