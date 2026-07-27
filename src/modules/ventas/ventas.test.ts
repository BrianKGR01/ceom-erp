import { eq, inArray } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { db } from "@/db/client";
import { crearClienteAdmin } from "@/lib/supabase/server";
import { diaLocalDe, rangoInstantes, zonaHorariaTenant } from "@/lib/periodo";
import { borrarUsuariosAuth, limpiarConAuthGarantizada, limpiarEnParalelo } from "@/test-utils/limpieza";
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
// Solo para la limpieza: H-24 hace que cada venta con comisión genere su
// Gasto, y este archivo vende por un canal con 10%.
import { categoriasGasto, gastos, pagosGasto } from "@/modules/gastos/schema";
import {
  abrirEvento,
  crearCanalVenta,
  crearMetodoPago,
  fichaVenta,
  historicoVentas,
  importarVentaHistorica,
  listarVentas,
  margenPorCanalYProducto,
  rankingProductos,
  registrarAjusteVenta,
  registrarPagoVenta,
  registrarVenta,
} from "./actions";
import * as repo from "./repository";
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
  let admin: ReturnType<typeof crearClienteAdmin>;
  const sufijo = Date.now();
  let tenantId: string;
  let ownerId: string;
  let sucursalId: string;
  let sucursalDosId: string;
  let canalVentaId: string;
  let metodoPagoId: string;

  beforeAll(async () => {
    admin = crearClienteAdmin();
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

    // H-02: segunda sucursal para los tests de aislamiento — insertada
    // directo, no hay ninguna forma de tener una 2da sucursal antes de
    // Identidad.crearSucursal(), y ese camino corre de forma independiente
    // en identidad.test.ts.
    const [sucursalDos] = await db
      .insert(sucursales)
      .values({ tenantId, nombre: `Sucursal Dos ${sufijo}`, esPrincipal: false })
      .returning();
    sucursalDosId = sucursalDos.id;

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
    // "detalles_venta" (y "ajustes_venta"/"pagos_venta") referencian
    // producto_id/venta_id -- "ventas" tiene que salir ANTES de "productos",
    // no en paralelo (bug real encontrado corriendo la suite completa,
    // mismo patrón que reportes.test.ts/simulaciones.test.ts). El permiso
    // especial (Identidad) sí es independiente de ambas.
    //
    // "gastos"/"pagos_gasto"/"categorias_gasto" entraron con H-24: el canal
    // de este archivo tiene 10% de comisión, así que cada venta genera
    // también su Gasto de comisión (y la categoría se autoprovisiona). Van
    // en la MISMA cadena que ventas, no en paralelo: gastos.referencia_id
    // apunta a la venta y su categoría es del tenant, así que si el borrado
    // del tenant corriera antes fallaría por FK.
    await limpiarConAuthGarantizada(
      async () => {
        await limpiarEnParalelo([
          () =>
            db
              .delete(permisosEspecialesPorUsuario)
              .where(eq(permisosEspecialesPorUsuario.usuarioId, ownerId)),
          async () => {
            const gastoIds = db.select({ id: gastos.id }).from(gastos).where(eq(gastos.tenantId, tenantId));
            await db.delete(pagosGasto).where(inArray(pagosGasto.gastoId, gastoIds));
            await db.delete(gastos).where(eq(gastos.tenantId, tenantId));
            await db.delete(categoriasGasto).where(eq(categoriasGasto.tenantId, tenantId));

            const ventaIds = db.select({ id: ventas.id }).from(ventas).where(eq(ventas.tenantId, tenantId));
            await db.delete(ajustesVenta).where(inArray(ajustesVenta.ventaId, ventaIds));
            await db.delete(pagosVenta).where(inArray(pagosVenta.ventaId, ventaIds));
            await db.delete(detallesVenta).where(inArray(detallesVenta.ventaId, ventaIds));
            await db.delete(ventas).where(eq(ventas.tenantId, tenantId));
            await db.delete(eventos).where(eq(eventos.tenantId, tenantId));
            await db.delete(clientes).where(eq(clientes.tenantId, tenantId));
            await db.delete(metodosPago).where(eq(metodosPago.tenantId, tenantId));
            await db.delete(canalesVenta).where(eq(canalesVenta.tenantId, tenantId));

            const productoIds = db
              .select({ id: productos.id })
              .from(productos)
              .where(eq(productos.tenantId, tenantId));
            await db.delete(movimientosStock).where(inArray(movimientosStock.productoId, productoIds));
            await db.delete(stock).where(inArray(stock.productoId, productoIds));
            await db.delete(productos).where(eq(productos.tenantId, tenantId));
            await db.delete(categoriasProducto).where(eq(categoriasProducto.tenantId, tenantId));
          },
        ]);

        await db.delete(usuarios).where(eq(usuarios.tenantId, tenantId));
        await db.delete(roles).where(eq(roles.tenantId, tenantId));
        await db.delete(sucursales).where(eq(sucursales.tenantId, tenantId));
        await db.delete(tenants).where(eq(tenants.id, tenantId));
      },
      () => borrarUsuariosAuth(admin, [ownerId])
    );
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

  // H-49 — el lado de ESCRITURA. `new Date("YYYY-MM-DD")` anclaba a medianoche
  // UTC, que en Bolivia son las 20:00 del día anterior: un pago fechado el 27
  // quedaba guardado en el 26. Hoy el filtro roto de los reportes lo tapa, así
  // que este test es lo único que impide que el arreglo de lectura corra el
  // Flujo de Caja un día entero sin que nadie lo note.
  //
  // Determinista por construcción: la fecha se elige explícitamente, no se
  // toma del reloj, así que da igual a qué hora corra CI y en qué huso.
  it("H-49: un pago fechado en un día local se guarda dentro de ese día local", async () => {
    const owner = await identidadRepo.obtenerUsuarioConRolPorId(ownerId);
    const producto = await crearProducto(owner!, tenantId, {
      nombre: "Producto Pago Fechado",
      unidadVenta: "unidad",
      precioVenta: 100,
    });
    if (!producto.ok) throw new Error("setup fallo");
    await registrarAjusteManualStock(owner!, tenantId, {
      productoId: producto.data.productoId,
      sucursalId,
      tipo: "entrada_ajuste_manual",
      cantidad: 5,
      motivo: "Carga inicial",
    });
    const venta = await registrarVenta(owner!, tenantId, {
      sucursalId,
      canalVentaId,
      lineas: [{ productoId: producto.data.productoId, cantidad: 1 }],
    });
    if (!venta.ok) throw new Error("setup fallo");

    const DIA = "2026-03-17";
    const pago = await registrarPagoVenta(owner!, venta.data.ventaId, {
      monto: 100,
      metodoPagoId,
      fechaPago: DIA,
    });
    expect(pago.ok).toBe(true);

    const pagos = await repo.listarPagosPorVenta(venta.data.ventaId);
    const guardado = pagos.at(-1)!.fechaPago;
    const zona = await zonaHorariaTenant(tenantId);

    // Lo que importa no es el instante exacto sino que caiga DENTRO del día
    // local que el usuario eligió — que es la pregunta que le hace el reporte.
    expect(diaLocalDe(guardado, zona)).toBe(DIA);
    const { inicio, fin } = rangoInstantes({ desde: DIA, hasta: DIA }, zona);
    expect(guardado >= inicio && guardado < fin).toBe(true);

    // Y explícitamente NO en el día anterior, que es donde caía antes.
    expect(diaLocalDe(guardado, zona)).not.toBe("2026-03-16");
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

  const periodoReportes = { desde: "2026-07-01", hasta: "2026-07-31" };

  it("roadmap #14: rankingProductos ordena distinto por rotacion y por margen", async () => {
    const owner = await identidadRepo.obtenerUsuarioConRolPorId(ownerId);

    const altoMargen = await crearProducto(owner!, tenantId, {
      nombre: "Alto margen, baja rotacion",
      unidadVenta: "unidad",
      precioVenta: 100,
      costoOperativoVigente: 20,
    });
    if (!altoMargen.ok) throw new Error("setup fallo");
    const bajoMargen = await crearProducto(owner!, tenantId, {
      nombre: "Bajo margen, alta rotacion",
      unidadVenta: "unidad",
      precioVenta: 100,
      costoOperativoVigente: 90,
    });
    if (!bajoMargen.ok) throw new Error("setup fallo");

    for (const [productoId, cantidad] of [
      [altoMargen.data.productoId, 1],
      [bajoMargen.data.productoId, 5],
    ] as const) {
      await registrarAjusteManualStock(owner!, tenantId, {
        productoId,
        sucursalId,
        tipo: "entrada_ajuste_manual",
        cantidad: 10,
        motivo: "Carga inicial",
      });
      await registrarVenta(owner!, tenantId, {
        sucursalId,
        canalVentaId,
        fechaVenta: "2026-07-10",
        lineas: [{ productoId, cantidad }],
      });
    }

    // Otros tests de este archivo registran ventas con fechaVenta por
    // defecto (hoy) que tambien caen en periodoReportes — se filtra a solo
    // los dos productos de este test en vez de asumir la posicion [0] del
    // ranking completo del tenant.
    const posicion = (
      datos: Array<{ productoId: string }>,
      productoId: string
    ) => datos.findIndex((f) => f.productoId === productoId);

    const porRotacion = await rankingProductos(owner!, tenantId, periodoReportes, {
      criterio: "rotacion",
    });
    expect(porRotacion.ok).toBe(true);
    if (porRotacion.ok) {
      expect(
        posicion(porRotacion.data, bajoMargen.data.productoId)
      ).toBeLessThan(posicion(porRotacion.data, altoMargen.data.productoId));
    }

    const porMargen = await rankingProductos(owner!, tenantId, periodoReportes, {
      criterio: "margen",
    });
    expect(porMargen.ok).toBe(true);
    if (porMargen.ok) {
      expect(
        posicion(porMargen.data, altoMargen.data.productoId)
      ).toBeLessThan(posicion(porMargen.data, bajoMargen.data.productoId));
    }
  });

  it("roadmap #14: historicoVentas separa ventas regulares de las de evento", async () => {
    const owner = await identidadRepo.obtenerUsuarioConRolPorId(ownerId);
    const producto = await crearProducto(owner!, tenantId, {
      nombre: "Producto historico",
      unidadVenta: "unidad",
      precioVenta: 10,
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

    const ventaRegular = await registrarVenta(owner!, tenantId, {
      sucursalId,
      canalVentaId,
      fechaVenta: "2026-07-15",
      lineas: [{ productoId, cantidad: 1 }],
    });
    if (!ventaRegular.ok) throw new Error("setup fallo");

    const evento = await abrirEvento(owner!, tenantId, {
      sucursalId,
      canalVentaId,
      nombre: "Feria historico",
      porcentajeComision: 15,
      fechaInicio: "2026-07-16",
      fechaFin: "2026-07-17",
    });
    if (!evento.ok) throw new Error("setup fallo");
    const ventaEvento = await registrarVenta(owner!, tenantId, {
      sucursalId,
      canalVentaId,
      eventoId: evento.data.eventoId,
      fechaVenta: "2026-07-16",
      lineas: [{ productoId, cantidad: 1 }],
    });
    if (!ventaEvento.ok) throw new Error("setup fallo");

    const soloRegulares = await historicoVentas(owner!, tenantId, periodoReportes, {
      incluirEventos: false,
    });
    expect(soloRegulares.ok).toBe(true);
    if (soloRegulares.ok) {
      const ids = soloRegulares.data.map((v) => v.ventaId);
      expect(ids).toContain(ventaRegular.data.ventaId);
      expect(ids).not.toContain(ventaEvento.data.ventaId);
    }

    const conEventos = await historicoVentas(owner!, tenantId, periodoReportes, {
      incluirEventos: true,
    });
    expect(conEventos.ok).toBe(true);
    if (conEventos.ok) {
      const ids = conEventos.data.map((v) => v.ventaId);
      expect(ids).toContain(ventaRegular.data.ventaId);
      expect(ids).toContain(ventaEvento.data.ventaId);
    }
  });

  it("roadmap #14: margenPorCanalYProducto cruza canal x producto", async () => {
    const owner = await identidadRepo.obtenerUsuarioConRolPorId(ownerId);
    const producto = await crearProducto(owner!, tenantId, {
      nombre: "Producto cruce canal",
      unidadVenta: "unidad",
      precioVenta: 50,
      costoOperativoVigente: 30,
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
    await registrarVenta(owner!, tenantId, {
      sucursalId,
      canalVentaId,
      fechaVenta: "2026-07-20",
      lineas: [{ productoId, cantidad: 2 }],
    });

    const resultado = await margenPorCanalYProducto(owner!, tenantId, periodoReportes);
    expect(resultado.ok).toBe(true);
    if (!resultado.ok) return;
    const fila = resultado.data.find(
      (f) => f.canalVentaId === canalVentaId && f.productoId === productoId
    );
    expect(fila).toBeDefined();
    expect(fila?.ingresos).toBe(100);
    expect(fila?.costos).toBe(60);
  });

  it(
    "H-15: la linea de venta distingue 'no sabiamos el costo' de 'el costo es 0'",
    async () => {
      // El unico test que prueba que la ambiguedad quedo resuelta. Un 0
      // guardado, por si solo, no dice cual de los dos casos fue — y no se
      // puede inferir despues, porque el producto puede ganar un costo mañana
      // y esta venta no se recalcula (regla 4). Por eso se registra al
      // escribir, no se deduce al leer.
      const owner = await identidadRepo.obtenerUsuarioConRolPorId(ownerId);

      const sinCosto = await crearProducto(owner!, tenantId, {
        nombre: "Sin costo cargado",
        unidadVenta: "unidad",
        precioVenta: 100,
      });
      // Un costo de 0 REAL y deliberado: una muestra gratis, un regalo de
      // promocion. Es un dato valido, no una incognita, y no se debe marcar.
      const costoCeroReal = await crearProducto(owner!, tenantId, {
        nombre: "Muestra gratis",
        unidadVenta: "unidad",
        precioVenta: 100,
        costoOperativoVigente: 0,
      });
      if (!sinCosto.ok || !costoCeroReal.ok) throw new Error("setup fallo: crearProducto");

      for (const productoId of [sinCosto.data.productoId, costoCeroReal.data.productoId]) {
        await registrarAjusteManualStock(owner!, tenantId, {
          productoId,
          sucursalId,
          tipo: "entrada_ajuste_manual",
          cantidad: 10,
          motivo: "Carga inicial H-15",
        });
      }

      const venta = await registrarVenta(owner!, tenantId, {
        sucursalId,
        canalVentaId,
        fechaVenta: "2026-07-22",
        lineas: [
          { productoId: sinCosto.data.productoId, cantidad: 1 },
          { productoId: costoCeroReal.data.productoId, cantidad: 1 },
        ],
      });
      expect(venta.ok).toBe(true);
      if (!venta.ok) return;

      const lineas = await db
        .select({
          productoId: detallesVenta.productoId,
          costo: detallesVenta.costoUnitarioSnapshot,
          desconocido: detallesVenta.costoDesconocido,
        })
        .from(detallesVenta)
        .where(eq(detallesVenta.ventaId, venta.data.ventaId));

      const lineaSinCosto = lineas.find((l) => l.productoId === sinCosto.data.productoId);
      const lineaCeroReal = lineas.find((l) => l.productoId === costoCeroReal.data.productoId);

      // Las dos congelan 0 — el numero no cambia, y no tiene que cambiar:
      // no hay costo que poner. Lo que cambia es que ahora se sabe cual era
      // una incognita.
      expect(Number(lineaSinCosto?.costo)).toBe(0);
      expect(Number(lineaCeroReal?.costo)).toBe(0);
      expect(lineaSinCosto?.desconocido).toBe(true);
      expect(lineaCeroReal?.desconocido).toBe(false);
    },
    20000
  );

  // H-02: sucursales multiples.
  it("una venta en la sucursal A no toca el stock de la sucursal B", async () => {
    const owner = await identidadRepo.obtenerUsuarioConRolPorId(ownerId);
    const producto = await crearProducto(owner!, tenantId, {
      nombre: `Producto Venta Multi-sucursal ${sufijo}`,
      unidadVenta: "unidad",
      precioVenta: 12,
    });
    if (!producto.ok) throw new Error("setup fallo");
    const productoId = producto.data.productoId;

    await registrarAjusteManualStock(owner!, tenantId, {
      productoId,
      sucursalId,
      tipo: "entrada_ajuste_manual",
      cantidad: 20,
      motivo: "Carga A",
    });
    await registrarAjusteManualStock(owner!, tenantId, {
      productoId,
      sucursalId: sucursalDosId,
      tipo: "entrada_ajuste_manual",
      cantidad: 20,
      motivo: "Carga B",
    });

    const venta = await registrarVenta(owner!, tenantId, {
      sucursalId,
      canalVentaId,
      lineas: [{ productoId, cantidad: 5 }],
    });
    expect(venta.ok).toBe(true);

    const stockA = await consultarStock(owner!, productoId, sucursalId);
    const stockB = await consultarStock(owner!, productoId, sucursalDosId);
    expect(stockA.ok && stockA.data.cantidadActual).toBe(15); // 20 - 5
    expect(stockB.ok && stockB.data.cantidadActual).toBe(20); // intacto
  });

  it("registrarVenta rechaza una sucursal congelada ANTES de crear la Venta (no solo al descontar stock)", async () => {
    const owner = await identidadRepo.obtenerUsuarioConRolPorId(ownerId);
    const producto = await crearProducto(owner!, tenantId, {
      nombre: `Producto Sucursal Congelada Venta ${sufijo}`,
      unidadVenta: "unidad",
      precioVenta: 9,
    });
    if (!producto.ok) throw new Error("setup fallo");
    const productoId = producto.data.productoId;

    await registrarAjusteManualStock(owner!, tenantId, {
      productoId,
      sucursalId: sucursalDosId,
      tipo: "entrada_ajuste_manual",
      cantidad: 10,
      motivo: "Carga previa al congelamiento",
    });

    // Congelamiento simulado — lo dispara Identidad (cambiarPlanTenant), no
    // este módulo (ver el mismo criterio en productos.test.ts).
    await db
      .update(sucursales)
      .set({ congeladaEn: new Date(), congeladaMotivo: "Test H-02" })
      .where(eq(sucursales.id, sucursalDosId));

    const ventasAntes = await db.select().from(ventas).where(eq(ventas.tenantId, tenantId));

    const ventaRechazada = await registrarVenta(owner!, tenantId, {
      sucursalId: sucursalDosId,
      canalVentaId,
      lineas: [{ productoId, cantidad: 1 }],
    });
    expect(ventaRechazada.ok).toBe(false);

    // No quedó ninguna Venta a medio crear — se cortó ANTES del insert.
    const ventasDespues = await db.select().from(ventas).where(eq(ventas.tenantId, tenantId));
    expect(ventasDespues.length).toBe(ventasAntes.length);

    // El stock de la sucursal congelada tampoco se tocó.
    const stock = await consultarStock(owner!, productoId, sucursalDosId);
    expect(stock.ok && stock.data.cantidadActual).toBe(10);

    await db
      .update(sucursales)
      .set({ congeladaEn: null, congeladaMotivo: null })
      .where(eq(sucursales.id, sucursalDosId));
  });
});
