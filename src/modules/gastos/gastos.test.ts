import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { db } from "@/db/client";
import { crearClienteAdmin } from "@/lib/supabase/server";
import { ROL_OWNER_ID } from "@/modules/identidad/constants";
import * as identidadRepo from "@/modules/identidad/repository";
import { roles, sucursales, tenants, usuarios } from "@/modules/identidad/schema";
import { consultarPasivoDeActivo, crearActivo, crearPasivo } from "@/modules/patrimonio/actions";
import { activos, pagosPasivo, pasivos } from "@/modules/patrimonio/schema";
import { crearProducto, registrarAjusteManualStock } from "@/modules/productos/actions";
import { categoriasProducto, movimientosStock, productos, stock } from "@/modules/productos/schema";
import { crearCanalVenta, registrarVenta } from "@/modules/ventas/actions";
import { canalesVenta, detallesVenta, ventas } from "@/modules/ventas/schema";
import {
  actualizarGastoManual,
  consultarDistribucionPorCategoria,
  consultarTotalCostosFijos,
  crearCategoriaGasto,
  crearGastoManual,
  crearGastoRecurrente,
  desactivarGastoRecurrente,
  eliminarCategoriaGasto,
  eliminarGastoManual,
  fichaGasto,
  generarGastoComisionVenta,
  generarGastoCuotaPasivo,
  generarGastoDesdeRecurrente,
  registrarPagoGasto,
} from "./actions";
import { categoriasGasto, gastos, gastosRecurrentes, pagosGasto } from "./schema";

const hasCredenciales = Boolean(
  process.env.DATABASE_URL && process.env.SUPABASE_SECRET_KEY
);

// Varias operaciones de este archivo encadenan varias transacciones
// (crear + pago + wiring cruzado a Patrimonio/Ventas) — mismo criterio que
// Modulo 3.
vi.setConfig({ testTimeout: 20000 });

describe.skipIf(!hasCredenciales)("Modulo 4 - Egresos y Gastos (integracion)", () => {
  let admin: ReturnType<typeof crearClienteAdmin>;
  const sufijo = Date.now();
  let tenantId: string;
  let ownerId: string;
  let sucursalId: string;
  let categoriaServiciosId: string;

  beforeAll(async () => {
    admin = crearClienteAdmin();
    const { data, error } = await admin.auth.admin.createUser({
      email: `gastos-owner-${sufijo}@ceom-erp.test`,
      email_confirm: true,
    });
    if (error || !data.user) {
      throw error ?? new Error("No se pudo crear el usuario de Auth de prueba");
    }
    ownerId = data.user.id;

    const { tenant, sucursal } = await identidadRepo.crearTenantConOwner({
      tenant: {
        nombreNegocio: `Gastos Test ${sufijo}`,
        monedaPrincipal: "BOB",
        estadoSuscripcion: "activa",
        fechaInicioSuscripcion: new Date().toISOString().slice(0, 10),
      },
      ownerId,
      ownerNombreCompleto: "Owner Gastos",
      ownerEmail: `gastos-owner-${sufijo}@ceom-erp.test`,
      rolOwnerId: ROL_OWNER_ID,
      creadoPor: null,
    });
    tenantId = tenant.id;
    sucursalId = sucursal.id;

    const owner = await identidadRepo.obtenerUsuarioConRolPorId(ownerId);
    const categoria = await crearCategoriaGasto(owner!, tenantId, { nombre: "Servicios" });
    if (!categoria.ok) throw new Error("setup fallo: crearCategoriaGasto");
    categoriaServiciosId = categoria.data.categoriaId;
  });

  afterAll(async () => {
    const gastosDelTenant = await db
      .select({ id: gastos.id })
      .from(gastos)
      .where(eq(gastos.tenantId, tenantId));
    for (const g of gastosDelTenant) {
      await db.delete(pagosGasto).where(eq(pagosGasto.gastoId, g.id));
    }
    await db.delete(gastos).where(eq(gastos.tenantId, tenantId));
    await db.delete(gastosRecurrentes).where(eq(gastosRecurrentes.tenantId, tenantId));
    await db.delete(categoriasGasto).where(eq(categoriasGasto.tenantId, tenantId));

    const ventasDelTenant = await db
      .select({ id: ventas.id })
      .from(ventas)
      .where(eq(ventas.tenantId, tenantId));
    for (const v of ventasDelTenant) {
      await db.delete(detallesVenta).where(eq(detallesVenta.ventaId, v.id));
    }
    await db.delete(ventas).where(eq(ventas.tenantId, tenantId));
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

  it("regla 1.5: crearGastoManual + registrarPagoGasto transiciona pendiente -> parcial -> pagado", async () => {
    const owner = await identidadRepo.obtenerUsuarioConRolPorId(ownerId);
    const gasto = await crearGastoManual(owner!, tenantId, {
      tipo: "unico",
      categoriaId: categoriaServiciosId,
      monto: 100,
      fechaGasto: "2026-02-01",
      descripcion: "Reparación puntual",
    });
    expect(gasto.ok).toBe(true);
    if (!gasto.ok) return;

    const pagoParcial = await registrarPagoGasto(owner!, gasto.data.gastoId, {
      monto: 40,
      fechaPago: "2026-02-05",
    });
    expect(pagoParcial.ok).toBe(true);
    if (pagoParcial.ok) expect(pagoParcial.data.estadoPago).toBe("parcial");

    const pagoFinal = await registrarPagoGasto(owner!, gasto.data.gastoId, {
      monto: 60,
      fechaPago: "2026-02-10",
    });
    expect(pagoFinal.ok).toBe(true);
    if (pagoFinal.ok) expect(pagoFinal.data.estadoPago).toBe("pagado");
  });

  it("caso borde 6: actualizarGastoManual rechaza bajar el monto por debajo de lo ya pagado", async () => {
    const owner = await identidadRepo.obtenerUsuarioConRolPorId(ownerId);
    const gasto = await crearGastoManual(owner!, tenantId, {
      tipo: "unico",
      categoriaId: categoriaServiciosId,
      monto: 200,
      fechaGasto: "2026-02-01",
    });
    if (!gasto.ok) throw new Error("setup fallo");

    await registrarPagoGasto(owner!, gasto.data.gastoId, { monto: 150, fechaPago: "2026-02-05" });

    const bajarDemasiado = await actualizarGastoManual(owner!, gasto.data.gastoId, { monto: 100 });
    expect(bajarDemasiado.ok).toBe(false);

    const bajarPermitido = await actualizarGastoManual(owner!, gasto.data.gastoId, {
      monto: 180,
    });
    expect(bajarPermitido.ok).toBe(true);
  });

  it(
    "regla 2 / caso borde 1: generarGastoCuotaPasivo crea el Gasto ya pagado y decrementa el saldo del Pasivo en Patrimonio",
    async () => {
      const owner = await identidadRepo.obtenerUsuarioConRolPorId(ownerId);
      const activo = await crearActivo(owner!, tenantId, {
        nombre: "Maquina de Gelato",
        tipo: "equipo_productivo",
        valorCompra: 10000,
        fechaAdquisicion: "2025-01-01",
      });
      if (!activo.ok) throw new Error("setup fallo: crearActivo");

      const pasivo = await crearPasivo(owner!, tenantId, {
        activoId: activo.data.activoId,
        montoTotal: 5000,
        cuotaPeriodica: 500,
        frecuenciaCuota: "mensual",
        plazoCuotas: 10,
        fechaInicio: "2025-01-01",
      });
      if (!pasivo.ok) throw new Error("setup fallo: crearPasivo");

      const saldoAntes = await consultarPasivoDeActivo(owner!, activo.data.activoId);
      expect(saldoAntes.ok).toBe(true);
      if (saldoAntes.ok) expect(saldoAntes.data[0]?.saldoPendiente).toBe(5000);

      const gastoCuota = await generarGastoCuotaPasivo(owner!, tenantId, {
        pasivoId: pasivo.data.pasivoId,
        categoriaId: categoriaServiciosId,
        monto: 500,
        fechaGasto: "2026-02-01",
      });
      expect(gastoCuota.ok).toBe(true);
      if (!gastoCuota.ok) return;
      expect(gastoCuota.data.pagoPasivo.ok).toBe(true);

      const ficha = await fichaGasto(owner!, gastoCuota.data.gastoId);
      expect(ficha.ok).toBe(true);
      if (ficha.ok) {
        expect(ficha.data.gasto?.origen).toBe("cuota_pasivo_automatica");
        expect(ficha.data.gasto?.estadoPago).toBe("pagado");
      }

      const saldoDespues = await consultarPasivoDeActivo(owner!, activo.data.activoId);
      expect(saldoDespues.ok).toBe(true);
      if (saldoDespues.ok) expect(saldoDespues.data[0]?.saldoPendiente).toBe(4500); // 5000 - 500

      // Regla 2 / caso borde 1: no se edita ni elimina directo.
      const editar = await actualizarGastoManual(owner!, gastoCuota.data.gastoId, { monto: 999 });
      expect(editar.ok).toBe(false);
      const eliminar = await eliminarGastoManual(owner!, gastoCuota.data.gastoId);
      expect(eliminar.ok).toBe(false);
    },
    20000
  );

  it(
    "regla: generarGastoComisionVenta crea el Gasto ya pagado a partir de una Venta real con comision",
    async () => {
      const owner = await identidadRepo.obtenerUsuarioConRolPorId(ownerId);
      const canal = await crearCanalVenta(owner!, tenantId, {
        nombre: "Feria",
        porcentajeComisionDefault: 10,
      });
      if (!canal.ok) throw new Error("setup fallo: crearCanalVenta");

      const producto = await crearProducto(owner!, tenantId, {
        nombre: "Gelato Frutos Rojos",
        unidadVenta: "unidad",
        precioVenta: 20,
      });
      if (!producto.ok) throw new Error("setup fallo: crearProducto");
      await registrarAjusteManualStock(owner!, tenantId, {
        productoId: producto.data.productoId,
        sucursalId,
        tipo: "entrada_ajuste_manual",
        cantidad: 20,
        motivo: "Carga inicial",
      });

      const venta = await registrarVenta(owner!, tenantId, {
        sucursalId,
        canalVentaId: canal.data.canalVentaId,
        lineas: [{ productoId: producto.data.productoId, cantidad: 10 }], // total 200, comision 10% = 20
      });
      expect(venta.ok).toBe(true);
      if (!venta.ok) return;
      expect(venta.data.comisionMontoCalculado).toBe(20);

      const gastoComision = await generarGastoComisionVenta(owner!, tenantId, {
        ventaId: venta.data.ventaId,
        categoriaId: categoriaServiciosId,
      });
      expect(gastoComision.ok).toBe(true);
      if (!gastoComision.ok) return;

      const ficha = await fichaGasto(owner!, gastoComision.data.gastoId);
      expect(ficha.ok).toBe(true);
      if (ficha.ok) {
        expect(ficha.data.gasto?.origen).toBe("comision_venta_automatica");
        expect(Number(ficha.data.gasto?.monto)).toBe(20);
        expect(ficha.data.gasto?.estadoPago).toBe("pagado");
      }
    },
    20000
  );

  it("caso de uso 2 / caso borde 3: generarGastoDesdeRecurrente crea un Gasto editable; desactivar no borra el historico", async () => {
    const owner = await identidadRepo.obtenerUsuarioConRolPorId(ownerId);
    const recurrente = await crearGastoRecurrente(owner!, tenantId, {
      categoriaId: categoriaServiciosId,
      monto: 800,
      frecuencia: "mensual",
      fechaInicio: "2026-01-01",
    });
    expect(recurrente.ok).toBe(true);
    if (!recurrente.ok) return;

    const gastoGenerado = await generarGastoDesdeRecurrente(owner!, recurrente.data.gastoRecurrenteId, {
      fechaGasto: "2026-02-01",
    });
    expect(gastoGenerado.ok).toBe(true);
    if (!gastoGenerado.ok) return;

    // origen=manual: se puede editar directo, a diferencia de los otros
    // dos origenes automaticos.
    const editar = await actualizarGastoManual(owner!, gastoGenerado.data.gastoId, {
      monto: 850,
    });
    expect(editar.ok).toBe(true);

    const desactivar = await desactivarGastoRecurrente(owner!, recurrente.data.gastoRecurrenteId);
    expect(desactivar.ok).toBe(true);

    const ficha = await fichaGasto(owner!, gastoGenerado.data.gastoId);
    expect(ficha.ok).toBe(true);
    if (ficha.ok) expect(Number(ficha.data.gasto?.monto)).toBe(850); // historico intacto

    const bloqueado = await generarGastoDesdeRecurrente(owner!, recurrente.data.gastoRecurrenteId, {
      fechaGasto: "2026-03-01",
    });
    expect(bloqueado.ok).toBe(false);
  });

  it("regla 4 / caso de uso 6: consultarTotalCostosFijos y consultarDistribucionPorCategoria devuelven agregados correctos", async () => {
    const owner = await identidadRepo.obtenerUsuarioConRolPorId(ownerId);
    await crearGastoManual(owner!, tenantId, {
      tipo: "fijo",
      categoriaId: categoriaServiciosId,
      monto: 300,
      fechaGasto: "2026-04-01",
    });
    await crearGastoManual(owner!, tenantId, {
      tipo: "fijo",
      categoriaId: categoriaServiciosId,
      monto: 200,
      fechaGasto: "2026-04-15",
    });
    await crearGastoManual(owner!, tenantId, {
      tipo: "unico",
      categoriaId: categoriaServiciosId,
      monto: 50,
      fechaGasto: "2026-04-20",
    });

    const totalFijos = await consultarTotalCostosFijos(owner!, tenantId, {
      desde: "2026-04-01",
      hasta: "2026-04-30",
    });
    expect(totalFijos.ok).toBe(true);
    if (totalFijos.ok) expect(totalFijos.data.totalCostosFijos).toBeGreaterThanOrEqual(500);

    const distribucion = await consultarDistribucionPorCategoria(owner!, tenantId, {
      desde: "2026-04-01",
      hasta: "2026-04-30",
    });
    expect(distribucion.ok).toBe(true);
    if (distribucion.ok) {
      const fila = distribucion.data.find((f) => f.categoriaId === categoriaServiciosId);
      expect(fila?.total).toBeGreaterThanOrEqual(550);
    }
  });

  it("caso borde 2: eliminar (soft-delete) una categoria en uso no rompe los gastos ya registrados con ella", async () => {
    const owner = await identidadRepo.obtenerUsuarioConRolPorId(ownerId);
    const categoria = await crearCategoriaGasto(owner!, tenantId, { nombre: "Empaques" });
    if (!categoria.ok) throw new Error("setup fallo");

    const gasto = await crearGastoManual(owner!, tenantId, {
      tipo: "unico",
      categoriaId: categoria.data.categoriaId,
      monto: 30,
      fechaGasto: "2026-05-01",
    });
    if (!gasto.ok) throw new Error("setup fallo");

    const eliminado = await eliminarCategoriaGasto(owner!, categoria.data.categoriaId);
    expect(eliminado.ok).toBe(true);

    const ficha = await fichaGasto(owner!, gasto.data.gastoId);
    expect(ficha.ok).toBe(true);
    if (ficha.ok) expect(ficha.data.gasto?.categoriaId).toBe(categoria.data.categoriaId);
  });
});
