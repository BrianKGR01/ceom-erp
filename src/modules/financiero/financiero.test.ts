import { eq, inArray } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { db } from "@/db/client";
import { crearClienteAdmin } from "@/lib/supabase/server";
import { borrarUsuariosAuth, limpiarConAuthGarantizada, limpiarEnParalelo } from "@/test-utils/limpieza";
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
import {
  crearProveedor,
  registrarCompra,
  registrarCompraDeAjuste,
  registrarPagoCompra,
} from "@/modules/proveedores/actions";
import { comprasAjuste, compras, pagosCompra, proveedores } from "@/modules/proveedores/schema";
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
  let admin: ReturnType<typeof crearClienteAdmin>;
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
    admin = crearClienteAdmin();
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
    // "gastos" es la única familia genuinamente independiente -- ni
    // "ventas" (via detalles_venta.producto_id) ni "compras" (via
    // compras.producto_id/insumo_id) pueden paralelizarse contra "productos":
    // ambas lo referencian. Bug real encontrado corriendo la suite completa
    // (una versión anterior de este archivo SÍ las separaba en paralelo,
    // mismo error que en proveedores.test.ts: "compras_producto_id_..._fk"
    // violado por la carrera) — ventas/compras/productos van en una sola
    // cadena secuencial, no en ramas paralelas.
    await limpiarConAuthGarantizada(
      async () => {
        await limpiarEnParalelo([
          async () => {
            const gastoIds = db.select({ id: gastos.id }).from(gastos).where(eq(gastos.tenantId, tenantId));
            await db.delete(pagosGasto).where(inArray(pagosGasto.gastoId, gastoIds));
            await db.delete(gastos).where(eq(gastos.tenantId, tenantId));
            await db.delete(categoriasGasto).where(eq(categoriasGasto.tenantId, tenantId));
          },
          async () => {
            const ventaIds = db.select({ id: ventas.id }).from(ventas).where(eq(ventas.tenantId, tenantId));
            await db.delete(ajustesVenta).where(inArray(ajustesVenta.ventaId, ventaIds));
            await db.delete(pagosVenta).where(inArray(pagosVenta.ventaId, ventaIds));
            await db.delete(detallesVenta).where(inArray(detallesVenta.ventaId, ventaIds));
            await db.delete(ventas).where(eq(ventas.tenantId, tenantId));
            await db.delete(canalesVenta).where(eq(canalesVenta.tenantId, tenantId));
            await db.delete(metodosPago).where(eq(metodosPago.tenantId, tenantId));

            const compraIds = db.select({ id: compras.id }).from(compras).where(eq(compras.tenantId, tenantId));
            // compras_ajuste referencia compra_id — sale antes que "compras"
            // (H-31 sembró ajustes reales acá).
            await db.delete(comprasAjuste).where(inArray(comprasAjuste.compraId, compraIds));
            await db.delete(pagosCompra).where(inArray(pagosCompra.compraId, compraIds));
            await db.delete(compras).where(eq(compras.tenantId, tenantId));
            await db.delete(proveedores).where(eq(proveedores.tenantId, tenantId));

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
      productoId,
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

  // --- H-24: la comision de canal llega al resultado ---------------------
  // Ventana propia (septiembre) para poder afirmar valores EXACTOS y no
  // "mayor o igual": el resto del archivo siembra en junio, y los
  // ajustes_venta que siembra usan creado_en = hoy (defaultNow, sin
  // parametro para forzarlo), que tampoco cae en septiembre. Producto y
  // canal propios por la misma razon.
  //
  // Este es el test que tiene que ponerse rojo si la comision se
  // desconecta: verificado a mano quitando la llamada a
  // generarGastoComisionVenta en registrarVenta — gastos pasa de 30 a 0 y
  // el resultado de 60 a 90.
  it("H-24: la comisión del canal resta en el estado de resultados y sale en la caja", async () => {
    const owner = await identidadRepo.obtenerUsuarioConRolPorId(ownerId);
    const periodoComision = { desde: "2026-09-01", hasta: "2026-09-30" };

    const canalConComision = await crearCanalVenta(owner!, tenantId, {
      nombre: "Marketplace",
      porcentajeComisionDefault: 20,
    });
    if (!canalConComision.ok) throw new Error("setup fallo: crearCanalVenta");

    const productoComision = await crearProducto(owner!, tenantId, {
      nombre: "Gelato Comisión",
      unidadVenta: "unidad",
      precioVenta: 50,
      costoOperativoVigente: 20,
    });
    if (!productoComision.ok) throw new Error("setup fallo: crearProducto");
    await registrarAjusteManualStock(owner!, tenantId, {
      productoId: productoComision.data.productoId,
      sucursalId,
      tipo: "entrada_ajuste_manual",
      cantidad: 10,
      motivo: "Carga inicial comisión",
    });

    // Septiembre arranca vacío — la línea base contra la que se mide todo.
    const antes = await estadoResultados(owner!, tenantId, periodoComision);
    expect(antes.ok).toBe(true);
    if (!antes.ok) return;
    expect(antes.data.ingresos).toBe(0);
    expect(antes.data.costos).toBe(0);
    expect(antes.data.gastos).toBe(0);
    expect(antes.data.estadoResultados).toBe(0);

    const venta = await registrarVenta(owner!, tenantId, {
      sucursalId,
      canalVentaId: canalConComision.data.canalVentaId,
      fechaVenta: "2026-09-10",
      lineas: [{ productoId: productoComision.data.productoId, cantidad: 3 }],
    });
    expect(venta.ok).toBe(true);
    if (!venta.ok) return;

    // Cuentas a mano, con el canal al 20%:
    //   ingresos = 3 x 50 = 150
    //   costos   = 3 x 20 = 60
    //   comisión = 20% de 150 = 30  -> Gasto variable_no_productivo, ya pagado
    //   resultado = 150 - 60 - 30 = 60
    // Sin la comisión conectada el resultado daría 90: un 50% más de
    // ganancia que la real, que es exactamente el defecto H-24.
    expect(venta.data.comisionMontoCalculado).toBe(30);
    expect(venta.data.gastoComision?.ok).toBe(true);
    if (venta.data.gastoComision?.ok) {
      expect(venta.data.gastoComision.data.monto).toBe(30);
    }

    const despues = await estadoResultados(owner!, tenantId, periodoComision);
    expect(despues.ok).toBe(true);
    if (!despues.ok) return;
    expect(despues.data.ingresos).toBe(150);
    expect(despues.data.costos).toBe(60);
    expect(despues.data.gastos).toBe(30);
    expect(despues.data.ajustesVenta).toBe(0);
    expect(despues.data.estadoResultados).toBe(60);

    // El gasto de comisión nace pagado (regla 6 de Módulo 4), así que la
    // plata sale el mismo día: la venta no se cobró todavía, así que el
    // flujo de caja de septiembre es exactamente la comisión, en negativo.
    const caja = await flujoCaja(owner!, tenantId, periodoComision);
    expect(caja.ok).toBe(true);
    if (!caja.ok) return;
    expect(caja.data.pagosVenta).toBe(0);
    expect(caja.data.pagosCompra).toBe(0);
    expect(caja.data.pagosGasto).toBe(30);
    expect(caja.data.flujoCaja).toBe(-30);
  });

  // --- H-31: el ajuste de compra llega al resultado ----------------------
  // `compras_ajuste` no tiene fecha propia — se filtra por `creadoEn`, igual
  // que `ajustesVenta`. Asi que este test usa el `periodo` general del
  // archivo (que incluye la fecha real de ejecucion) y mide DELTAS contra la
  // medicion inmediatamente anterior, en vez de valores absolutos: el resto
  // del archivo ya sembro ingresos/costos/gastos ahi. El delta es exacto, no
  // un ">=".
  //
  // Verificado rompiendolo a proposito: sin el termino `- ajustesCompra` en
  // calcularEstadoResultados, el delta del resultado da 0 y este test se
  // pone rojo.
  it("H-31: lo que la compra terminó costando de más resta en el estado de resultados", async () => {
    const owner = await identidadRepo.obtenerUsuarioConRolPorId(ownerId);

    const proveedor = await crearProveedor(owner!, tenantId, { nombre: "Mayorista Ajustes" });
    if (!proveedor.ok) throw new Error("setup fallo: crearProveedor");
    const compra = await registrarCompra(owner!, tenantId, {
      sucursalId,
      proveedorId: proveedor.data.proveedorId,
      tipo: "reventa",
      productoId,
      cantidad: 10,
      montoTotal: 400,
      fechaCompra: "2026-06-25",
    });
    if (!compra.ok) throw new Error("setup fallo: registrarCompra");

    const antes = await estadoResultados(owner!, tenantId, periodo);
    expect(antes.ok).toBe(true);
    if (!antes.ok) return;
    // Registrar la compra por sí sola no toca el resultado: una compra entra
    // recién como COGS cuando la mercadería se vende (regla 2 de Módulo 7).
    expect(antes.data.ajustesCompra).toBe(0);

    // El proveedor factura Bs 70 más de lo cargado. Ese excedente no puede
    // llegar nunca al COGS —los costo_unitario_snapshot de las ventas ya
    // hechas están congelados—, así que si no resta acá no aparece en ningún
    // lado: es exactamente el agujero de H-31.
    const correccion = await registrarCompraDeAjuste(owner!, compra.data.compraId, {
      tipo: "correccion",
      montoAjuste: 70,
      motivo: "La factura vino Bs 70 más alta",
    });
    expect(correccion.ok).toBe(true);

    const conCostoExtra = await estadoResultados(owner!, tenantId, periodo);
    expect(conCostoExtra.ok).toBe(true);
    if (!conCostoExtra.ok) return;
    // Nada más se movió: ingresos, costos y gastos idénticos...
    expect(conCostoExtra.data.ingresos).toBe(antes.data.ingresos);
    expect(conCostoExtra.data.costos).toBe(antes.data.costos);
    expect(conCostoExtra.data.gastos).toBe(antes.data.gastos);
    // ...y el resultado bajó exactamente los 70.
    expect(conCostoExtra.data.ajustesCompra).toBe(70);
    expect(conCostoExtra.data.estadoResultados).toBe(antes.data.estadoResultados - 70);

    // Segunda parte, la dirección contraria: una devolución al proveedor de
    // Bs 100 NO puede subir la utilidad. En CEOM una compra nunca fue un
    // gasto (entra como costo al venderse), así que deshacerla no es una
    // ganancia — sumarla inventaría Bs 100 de utilidad que no existen.
    const devolucion = await registrarCompraDeAjuste(owner!, compra.data.compraId, {
      tipo: "devolucion_a_proveedor",
      montoAjuste: -100,
      motivo: "Se devolvieron 2 unidades falladas",
    });
    expect(devolucion.ok).toBe(true);
    if (devolucion.ok) {
      // Sí baja lo que le debés al proveedor: 400 + 70 - 100 = 370.
      expect(devolucion.data.montoTotalEfectivo).toBe(370);
    }

    const conDevolucion = await estadoResultados(owner!, tenantId, periodo);
    expect(conDevolucion.ok).toBe(true);
    if (!conDevolucion.ok) return;
    // El neto de la compra pasó a -30 (+70 y -100), que clampea a 0: los 70
    // de costo extra quedan compensados y NO queda un crédito a favor.
    expect(conDevolucion.data.ajustesCompra).toBe(0);
    expect(conDevolucion.data.estadoResultados).toBe(antes.data.estadoResultados);
    // La red de seguridad, dicha como invariante y no como ejemplo: por más
    // devoluciones que se carguen, un ajuste de compra nunca sube el
    // resultado por encima del que había sin ningún ajuste.
    expect(conDevolucion.data.estadoResultados).toBeLessThanOrEqual(
      antes.data.estadoResultados
    );
  });
});
