import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { db } from "@/db/client";
import { crearClienteAdmin } from "@/lib/supabase/server";
import { limpiarConAuthGarantizada, limpiarEnParalelo } from "@/test-utils/limpieza";
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
import { crearGastoManual, crearCategoriaGasto } from "@/modules/gastos/actions";
import { categoriasGasto, gastos } from "@/modules/gastos/schema";
import { ROL_CEOM_ADMIN_ID, ROL_OWNER_ID } from "@/modules/identidad/constants";
import * as identidadRepo from "@/modules/identidad/repository";
import { roles, sucursales, tenants, usuarios } from "@/modules/identidad/schema";
import {
  crearInsumo,
  crearReceta,
  actualizarComposicionReceta,
  registrarEntradaCompraInsumo,
  vincularProductoAReceta,
  registrarProduccion,
} from "@/modules/operativo/nichos/nicho-1/actions";
import {
  insumos,
  movimientosInsumo,
  producciones,
  recetaInsumos,
  recetas,
  stockInsumo,
  vinculacionesProductoReceta,
} from "@/modules/operativo/nichos/nicho-1/schema";
import { crearActivo } from "@/modules/patrimonio/actions";
import { activos } from "@/modules/patrimonio/schema";
import { crearProducto } from "@/modules/productos/actions";
import { movimientosStock, productos, stock } from "@/modules/productos/schema";
import { registrarCompra, registrarPagoCompra } from "@/modules/proveedores/actions";
import { compras, pagosCompra } from "@/modules/proveedores/schema";
import { crearPlan } from "@/modules/suscripcion/actions";
import { planes } from "@/modules/suscripcion/schema";
import { crearCanalVenta, registrarVenta } from "@/modules/ventas/actions";
import { canalesVenta, detallesVenta, ventas } from "@/modules/ventas/schema";
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
    let admin: ReturnType<typeof crearClienteAdmin>;
    const sufijo = Date.now();
    let tenantId: string;
    let sucursalId: string;
    let ownerId: string;
    let planId: string;
    let institucionId: string;

    // Datos reales de negocio (§10.6/§13.11 del backstop de RLS): sin esto,
    // los asserts de "caso 2"/"caso 3" solo podian verificar `typeof` o el
    // booleano `autorizado`, indistinguibles de un RLS que filtra de mas o
    // de un leak cross-tenant — mismo hallazgo ya corregido una vez en
    // panel-admin-ceom.test.ts caso 3, acá aplicado a los 4 puntos que
    // §10.6 dejó listados sin arreglar.
    let productoVentaId: string;
    let compraId: string;
    let canalVentaId: string;
    let ventaId: string;
    let categoriaGastoId: string;
    let gastoId: string;
    let activoId: string;
    let insumoId: string;
    let recetaId: string;
    let productoProduccionId: string;
    let produccionId: string;
    let mermaCostoEsperado: number;

    beforeAll(async () => {
      admin = crearClienteAdmin();
      const { data, error } = await admin.auth.admin.createUser({
        email: `monitoreo-owner-${sufijo}@ceom-erp.test`,
        email_confirm: true,
      });
      if (error || !data.user) {
        throw error ?? new Error("No se pudo crear el usuario de Auth de prueba");
      }
      ownerId = data.user.id;

      const plan = await crearPlan(
        { rolId: ROL_CEOM_ADMIN_ID, rol: { esRolSistema: true } },
        {
          nombre: `Plan Monitoreo Test ${sufijo}`,
          precioMensual: 0,
          moneda: "BOB",
          modulosVeedorPermitidos: ["financiero", "operativo", "inventario_operativo"],
        }
      );
      if (!plan.ok) throw new Error("setup fallo: crearPlan");
      planId = plan.data.planId;

      const { tenant, sucursal } = await identidadRepo.crearTenantConOwner({
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
      sucursalId = sucursal.id;

      const institucion = await crearInstitucion(
        { rolId: ROL_CEOM_ADMIN_ID, rol: { esRolSistema: true } },
        { nombre: `Institucion Monitoreo Test ${sufijo}`, tipo: "incubadora" }
      );
      if (!institucion.ok) throw new Error("setup fallo: crearInstitucion");
      institucionId = institucion.data.institucionId;

      const cartera = await agregarTenantACartera(
        { rolId: ROL_CEOM_ADMIN_ID, rol: { esRolSistema: true } },
        { institucionId, tenantId, fechaInicio: new Date().toISOString().slice(0, 10) }
      );
      if (!cartera.ok) throw new Error("setup fallo: agregarTenantACartera");

      const owner = await identidadRepo.obtenerUsuarioConRolPorId(ownerId);

      // --- Financiero (flujoCaja/estadoResultados/costoFijoTotal) + Ventas (tendenciaVentas) ---
      // Compra + Pago de Compra reales (mismo patrón que panel-admin-ceom.test.ts
      // caso 3): costoUnitario = 100/10 = 10.
      const productoVenta = await crearProducto(owner!, tenantId, {
        nombre: `Producto Monitoreo Test ${sufijo}`,
        unidadVenta: "unidad",
        precioVenta: 20,
      });
      if (!productoVenta.ok) throw new Error("setup fallo: crearProducto");
      productoVentaId = productoVenta.data.productoId;

      const compra = await registrarCompra(owner!, tenantId, {
        sucursalId,
        tipo: "reventa",
        productoId: productoVentaId,
        cantidad: 10,
        montoTotal: 100,
        fechaCompra: "2025-06-01",
      });
      if (!compra.ok) throw new Error("setup fallo: registrarCompra");
      compraId = compra.data.compraId;
      const pago = await registrarPagoCompra(owner!, compraId, {
        monto: 100,
        fechaPago: "2025-06-01",
      });
      if (!pago.ok) throw new Error("setup fallo: registrarPagoCompra");

      // Venta real: ingresos = precioVenta(20) x cantidad(2) = 40; costos =
      // costoUnitarioSnapshot(10) x 2 = 20. Sin pagoInicial a propósito —
      // mantiene pagosVenta en 0 para que flujoCaja siga dando exactamente
      // -100 (el mismo valor ya establecido en panel-admin-ceom.test.ts).
      const canal = await crearCanalVenta(owner!, tenantId, {
        nombre: "Feria",
        porcentajeComisionDefault: 10,
      });
      if (!canal.ok) throw new Error("setup fallo: crearCanalVenta");
      canalVentaId = canal.data.canalVentaId;

      const venta = await registrarVenta(owner!, tenantId, {
        sucursalId,
        canalVentaId,
        fechaVenta: "2025-06-02",
        lineas: [{ productoId: productoVentaId, cantidad: 2 }],
      });
      if (!venta.ok) throw new Error("setup fallo: registrarVenta");
      ventaId = venta.data.ventaId;

      // Gasto fijo real: costoFijoTotal = 15; estadoResultados = 40 - 20 - 15 + 0 = 5.
      const categoriaGasto = await crearCategoriaGasto(owner!, tenantId, {
        nombre: `Categoria Monitoreo Test ${sufijo}`,
      });
      if (!categoriaGasto.ok) throw new Error("setup fallo: crearCategoriaGasto");
      categoriaGastoId = categoriaGasto.data.categoriaId;

      const gasto = await crearGastoManual(owner!, tenantId, {
        tipo: "fijo",
        categoriaId: categoriaGastoId,
        monto: 15,
        fechaGasto: "2025-06-01",
      });
      if (!gasto.ok) throw new Error("setup fallo: crearGastoManual");
      gastoId = gasto.data.gastoId;

      // --- Operativo/Nicho-1 (detalleOperativo, detalleInventarioOperativo) ---
      // Mismo escenario determinista que operativo-nicho1.test.ts: receta de
      // 2L leche por lote de 3L rendimiento, 1 lote -> teórico 30 unidades,
      // real 28 -> merma de 2 unidades, costo total insumos 2L x 5 = 10,
      // costo/unidad = 10/28.
      const activo = await crearActivo(owner!, tenantId, {
        nombre: `Heladera Monitoreo Test ${sufijo}`,
        tipo: "equipo_productivo",
        capacidadProduccionCantidad: "160",
        capacidadProduccionUnidad: "unidad",
        capacidadAlmacenamientoCantidad: "200",
        capacidadAlmacenamientoUnidad: "unidad",
        disponibilidadHorariaSemanal: "40",
        tiempoEstimadoPorCicloMinutos: "30",
        valorCompra: 5000,
        fechaAdquisicion: "2025-01-01",
      });
      if (!activo.ok) throw new Error("setup fallo: crearActivo");
      activoId = activo.data.activoId;

      const insumo = await crearInsumo(owner!, tenantId, {
        nombre: `Leche Monitoreo Test ${sufijo}`,
        unidadMedida: "litros",
        vidaUtilDias: 5,
      });
      if (!insumo.ok) throw new Error("setup fallo: crearInsumo");
      insumoId = insumo.data.insumoId;

      const receta = await crearReceta(owner!, tenantId, {
        nombre: `Base Gelato Monitoreo Test ${sufijo}`,
        rendimientoPorLote: 3,
        unidadRendimiento: "litros",
      });
      if (!receta.ok) throw new Error("setup fallo: crearReceta");
      recetaId = receta.data.recetaId;

      await actualizarComposicionReceta(owner!, recetaId, [
        { insumoId, cantidadPorLote: 2 },
      ]);
      await registrarEntradaCompraInsumo(owner!, tenantId, {
        insumoId,
        sucursalId,
        cantidad: 100,
        costoCompra: 5,
      });

      const productoProduccion = await crearProducto(owner!, tenantId, {
        nombre: `Gelato Monitoreo Test ${sufijo}`,
        unidadVenta: "unidad",
        precioVenta: 25,
      });
      if (!productoProduccion.ok) throw new Error("setup fallo: crearProducto (produccion)");
      productoProduccionId = productoProduccion.data.productoId;

      await vincularProductoAReceta(owner!, tenantId, {
        productoId: productoProduccionId,
        recetaId,
        cantidadBaseConsumidaPorUnidad: 0.1,
      });

      const produccion = await registrarProduccion(owner!, tenantId, {
        productoId: productoProduccionId,
        sucursalId,
        activoId,
        fechaProduccion: "2025-06-01",
        cantidadLotesProducidos: 1,
        cantidadRealObtenida: 28,
      });
      if (!produccion.ok) throw new Error("setup fallo: registrarProduccion");
      produccionId = produccion.data.produccionId;
      mermaCostoEsperado = produccion.data.mermaCosto;
    }, 60000);

    afterAll(async () => {
      // "producciones" referencia producto_id Y activo_id; "ventas"
      // (detalles_venta) y "compras" referencian producto_id -- ninguna de
      // las tres puede paralelizarse contra la familia de "productos"/
      // "activos" (bug real encontrado corriendo la suite completa: la
      // primera versión de este archivo las separaba, mismo error que en
      // proveedores.test.ts/financiero.test.ts/operativo-nicho1.test.ts).
      // Van todas en una sola cadena secuencial; gastos y consentimiento sí
      // son independientes de esa cadena y entre sí.
      await limpiarConAuthGarantizada(
        async () => {
          await limpiarEnParalelo([
            async () => {
              await db.delete(producciones).where(eq(producciones.tenantId, tenantId));
              await db
                .delete(vinculacionesProductoReceta)
                .where(eq(vinculacionesProductoReceta.recetaId, recetaId));
              await db.delete(recetaInsumos).where(eq(recetaInsumos.recetaId, recetaId));
              await db.delete(recetas).where(eq(recetas.tenantId, tenantId));
              await db.delete(movimientosInsumo).where(eq(movimientosInsumo.insumoId, insumoId));
              await db.delete(stockInsumo).where(eq(stockInsumo.insumoId, insumoId));
              await db.delete(insumos).where(eq(insumos.tenantId, tenantId));

              await db.delete(detallesVenta).where(eq(detallesVenta.ventaId, ventaId));
              await db.delete(ventas).where(eq(ventas.id, ventaId));
              await db.delete(canalesVenta).where(eq(canalesVenta.id, canalVentaId));

              await db.delete(pagosCompra).where(eq(pagosCompra.compraId, compraId));
              await db.delete(compras).where(eq(compras.id, compraId));

              // Recién acá es seguro borrar productos/activos -- todo lo que
              // los referenciaba ya salió arriba.
              await db.delete(movimientosStock).where(eq(movimientosStock.productoId, productoVentaId));
              await db.delete(stock).where(eq(stock.productoId, productoVentaId));
              await db.delete(movimientosStock).where(eq(movimientosStock.productoId, productoProduccionId));
              await db.delete(stock).where(eq(stock.productoId, productoProduccionId));
              await db.delete(productos).where(eq(productos.id, productoVentaId));
              await db.delete(productos).where(eq(productos.id, productoProduccionId));
              await db.delete(activos).where(eq(activos.tenantId, tenantId));
            },
            async () => {
              await db.delete(gastos).where(eq(gastos.id, gastoId));
              await db.delete(categoriasGasto).where(eq(categoriasGasto.id, categoriaGastoId));
            },
            async () => {
              await db.delete(aprobacionesTenant).where(eq(aprobacionesTenant.tenantId, tenantId));
              await db.delete(solicitudesSeguimiento).where(eq(solicitudesSeguimiento.tenantId, tenantId));
              await db.delete(carteraInstitucional).where(eq(carteraInstitucional.tenantId, tenantId));
              await db.delete(instituciones).where(eq(instituciones.id, institucionId));
            },
          ]);
          await db.delete(usuarios).where(eq(usuarios.tenantId, tenantId));
          await db.delete(roles).where(eq(roles.tenantId, tenantId));
          await db.delete(sucursales).where(eq(sucursales.tenantId, tenantId));
          await db.delete(tenants).where(eq(tenants.id, tenantId));
          await db.delete(planes).where(eq(planes.id, planId));
        },
        () => admin.auth.admin.deleteUser(ownerId)
      );
    }, 30000);

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
        { rolId: ROL_CEOM_ADMIN_ID, rol: { esRolSistema: true } },
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
      // Valores reales, no `typeof` (§10.6/§13.11 del backstop de RLS —
      // exactamente el hallazgo que este assert dejaba pasar en verde):
      // flujoCaja = pagosVenta(0) - pagosCompra(100) - pagosGasto(0) = -100;
      // estadoResultados = ingresos(40) - costos(20) - gastos(15) + ajustesVenta(0) = 5;
      // costoFijoTotal = 15 (el único gasto sembrado es tipo "fijo").
      expect(financiero.data.detalle.flujoCaja).toBe(-100);
      expect(financiero.data.detalle.estadoResultados).toBe(5);
      expect(financiero.data.detalle.costoFijoTotal).toBe(15);

      const tendencia = await tendenciaVentas(institucionId, tenantId, periodo);
      expect(tendencia.ok).toBe(true);
      if (!tendencia.ok) return;
      expect(tendencia.data.autorizado).toBe(true);
      if (!tendencia.data.autorizado) return;
      // ingresos = precioVenta(20) x cantidad(2) = 40.
      expect(tendencia.data.detalle.ingresos).toBe(40);

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
        { rolId: ROL_CEOM_ADMIN_ID, rol: { esRolSistema: true } },
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
      if (!operativo.data.autorizado) return;
      // Valores reales, no solo el booleano `autorizado` (§10.6/§13.11): la
      // producción sembrada tiene que aparecer, con su cantidad real
      // obtenida, y el costo de merma tiene que coincidir con el que
      // registrarProduccion() ya devolvió (misma fuente de verdad).
      expect(operativo.data.detalle.producciones).toHaveLength(1);
      expect(operativo.data.detalle.producciones[0]?.id).toBe(produccionId);
      expect(Number(operativo.data.detalle.producciones[0]?.cantidadRealObtenida)).toBe(28);
      // producciones.merma_costo es numeric(12,4) -- el valor persistido (y
      // el que consultarMermaPeriodo suma) queda redondeado a 4 decimales,
      // a diferencia del float sin redondear que devuelve la propia acción
      // de registrarProduccion() -- comparar con esa misma precisión.
      expect(operativo.data.detalle.mermaCostoTotal).toBeCloseTo(mermaCostoEsperado, 4);
      expect(operativo.data.detalle.mermaCostoTotal).toBeGreaterThan(0);

      const inventario = await detalleInventarioOperativo(institucionId, tenantId);
      expect(inventario.ok).toBe(true);
      if (!inventario.ok) return;
      expect(inventario.data.autorizado).toBe(true);
      if (!inventario.data.autorizado) return;
      const filaInsumo = inventario.data.detalle.insumos.find((i) => i.id === insumoId);
      expect(filaInsumo).toBeDefined();
      expect(filaInsumo?.nombre).toBe(`Leche Monitoreo Test ${sufijo}`);
      // costoUnitarioVigente se fija con registrarEntradaCompraInsumo (costoCompra: 5).
      expect(Number(filaInsumo?.costoUnitarioVigente)).toBe(5);

      const financiero = await detalleFinanciero(institucionId, tenantId, periodo);
      expect(financiero.ok).toBe(true);
      if (!financiero.ok) return;
      expect(financiero.data.autorizado).toBe(false);
    });

    it("caso borde 1: tenant bloqueado deniega detalleFinanciero aunque haya aprobacion vigente", async () => {
      const owner = await identidadRepo.obtenerUsuarioConRolPorId(ownerId);
      const solicitud = await crearSolicitudSeguimiento(
        { rolId: ROL_CEOM_ADMIN_ID, rol: { esRolSistema: true } },
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
        { rolId: ROL_CEOM_ADMIN_ID, rol: { esRolSistema: true } },
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
