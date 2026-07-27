import { eq, inArray } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { db } from "@/db/client";
import { crearClienteAdmin } from "@/lib/supabase/server";
import { borrarUsuariosAuth, limpiarConAuthGarantizada, limpiarEnParalelo } from "@/test-utils/limpieza";
import { ROL_OWNER_ID } from "@/modules/identidad/constants";
import * as identidadRepo from "@/modules/identidad/repository";
import { roles, sucursales, tenants, usuarios } from "@/modules/identidad/schema";
import {
  consultarPasivoDeActivo,
  crearActivo,
  crearPasivo,
  registrarPagoPasivo,
} from "@/modules/patrimonio/actions";
import { activos, pagosPasivo, pasivos } from "@/modules/patrimonio/schema";
import { crearProducto, registrarAjusteManualStock } from "@/modules/productos/actions";
import { categoriasProducto, movimientosStock, productos, stock } from "@/modules/productos/schema";
import { crearCanalVenta, registrarVenta } from "@/modules/ventas/actions";
import { canalesVenta, detallesVenta, ventas } from "@/modules/ventas/schema";
import {
  actualizarGastoManual,
  CATEGORIA_COMISION_VENTA,
  CATEGORIA_CUOTA_PASIVO,
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
  listarCategoriasGasto,
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
    // "detalles_venta" referencia producto_id -- "ventas" y "productos" van
    // en la misma cadena secuencial, no en ramas paralelas (bug real
    // encontrado corriendo la suite completa, mismo patrón que
    // ventas.test.ts/reportes.test.ts). gastos y pasivos sí son
    // independientes (sin FK a productos ni a ventas).
    await limpiarConAuthGarantizada(
      async () => {
        await limpiarEnParalelo([
          async () => {
            const gastoIds = db.select({ id: gastos.id }).from(gastos).where(eq(gastos.tenantId, tenantId));
            await db.delete(pagosGasto).where(inArray(pagosGasto.gastoId, gastoIds));
            await db.delete(gastos).where(eq(gastos.tenantId, tenantId));
            await db.delete(gastosRecurrentes).where(eq(gastosRecurrentes.tenantId, tenantId));
            await db.delete(categoriasGasto).where(eq(categoriasGasto.tenantId, tenantId));
          },
          async () => {
            const ventaIds = db.select({ id: ventas.id }).from(ventas).where(eq(ventas.tenantId, tenantId));
            await db.delete(detallesVenta).where(inArray(detallesVenta.ventaId, ventaIds));
            await db.delete(ventas).where(eq(ventas.tenantId, tenantId));
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
          async () => {
            const pasivoIds = db.select({ id: pasivos.id }).from(pasivos).where(eq(pasivos.tenantId, tenantId));
            await db.delete(pagosPasivo).where(inArray(pagosPasivo.pasivoId, pasivoIds));
            await db.delete(pasivos).where(eq(pasivos.tenantId, tenantId));
            await db.delete(activos).where(eq(activos.tenantId, tenantId));
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
    "H-27 / regla 2 / caso borde 1: registrarPagoPasivo genera el Gasto de la cuota (ya pagado, no editable) y decrementa el saldo",
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

      // La flecha va Patrimonio -> Gastos: el pago del pasivo es el que
      // dispara el gasto, no al reves (H-27). Antes de esto,
      // generarGastoCuotaPasivo no la llamaba nadie y la cuota nunca
      // llegaba al resultado.
      const pago = await registrarPagoPasivo(owner!, pasivo.data.pasivoId, {
        monto: 500,
        fechaPago: "2026-02-01",
      });
      expect(pago.ok).toBe(true);
      if (!pago.ok) return;
      expect(pago.data.saldoPendiente).toBe(4500); // 5000 - 500
      expect(pago.data.gastoCuota.ok).toBe(true);
      if (!pago.data.gastoCuota.ok) return;
      expect(pago.data.gastoCuota.data.monto).toBe(500);

      const ficha = await fichaGasto(owner!, pago.data.gastoCuota.data.gastoId);
      expect(ficha.ok).toBe(true);
      if (ficha.ok) {
        expect(ficha.data.gasto?.origen).toBe("cuota_pasivo_automatica");
        expect(ficha.data.gasto?.estadoPago).toBe("pagado");
        expect(ficha.data.gasto?.tipo).toBe("fijo");
        expect(Number(ficha.data.gasto?.monto)).toBe(500);
        // Referencia al Pasivo que lo origino — es lo que permite rastrear
        // el gasto hasta su fuente de verdad en Patrimonio (regla 2).
        expect(ficha.data.gasto?.referenciaId).toBe(pasivo.data.pasivoId);
      }

      const saldoDespues = await consultarPasivoDeActivo(owner!, activo.data.activoId);
      expect(saldoDespues.ok).toBe(true);
      if (saldoDespues.ok) expect(saldoDespues.data[0]?.saldoPendiente).toBe(4500);

      // Regla 2 / caso borde 1: no se edita ni elimina directo.
      const editar = await actualizarGastoManual(owner!, pago.data.gastoCuota.data.gastoId, {
        monto: 999,
      });
      expect(editar.ok).toBe(false);
      const eliminar = await eliminarGastoManual(owner!, pago.data.gastoCuota.data.gastoId);
      expect(eliminar.ok).toBe(false);
    },
    20000
  );

  it(
    "H-27: la categoria 'Cuotas de deuda' se autoprovisiona una sola vez y la reutiliza el segundo pago",
    async () => {
      const owner = await identidadRepo.obtenerUsuarioConRolPorId(ownerId);
      const pasivo = await crearPasivo(owner!, tenantId, {
        montoTotal: 3000,
        cuotaPeriodica: 300,
        frecuenciaCuota: "mensual",
        plazoCuotas: 10,
        fechaInicio: "2025-01-01",
      });
      if (!pasivo.ok) throw new Error("setup fallo: crearPasivo");

      const primero = await registrarPagoPasivo(owner!, pasivo.data.pasivoId, {
        monto: 300,
        fechaPago: "2026-03-01",
      });
      const segundo = await registrarPagoPasivo(owner!, pasivo.data.pasivoId, {
        monto: 300,
        fechaPago: "2026-04-01",
      });
      expect(primero.ok && segundo.ok).toBe(true);
      if (!primero.ok || !segundo.ok) return;
      if (!primero.data.gastoCuota.ok || !segundo.data.gastoCuota.ok) {
        throw new Error("los dos pagos tenian que generar su gasto");
      }

      // Misma categoria, no una duplicada por pago (H-32: el disparo
      // automatico no puede depender de que el Owner haya creado una antes).
      expect(segundo.data.gastoCuota.data.categoriaId).toBe(
        primero.data.gastoCuota.data.categoriaId
      );

      const categorias = await listarCategoriasGasto(owner!, tenantId);
      expect(categorias.ok).toBe(true);
      if (categorias.ok) {
        const cuotas = categorias.data.filter((c) => c.nombre === CATEGORIA_CUOTA_PASIVO);
        expect(cuotas).toHaveLength(1);
      }
    },
    20000
  );

  it("H-27: generarGastoCuotaPasivo rechaza montos <= 0 — una cuota solo puede restar (leccion de H-30)", async () => {
    const owner = await identidadRepo.obtenerUsuarioConRolPorId(ownerId);
    const pasivo = await crearPasivo(owner!, tenantId, {
      montoTotal: 1000,
      cuotaPeriodica: 100,
      frecuenciaCuota: "mensual",
      plazoCuotas: 10,
      fechaInicio: "2025-01-01",
    });
    if (!pasivo.ok) throw new Error("setup fallo: crearPasivo");

    for (const monto of [0, -100]) {
      const resultado = await generarGastoCuotaPasivo(owner!, tenantId, {
        pasivoId: pasivo.data.pasivoId,
        monto,
        fechaGasto: "2026-05-01",
      });
      expect(resultado.ok).toBe(false);
    }
  });

  it(
    "H-24: registrarVenta genera sola la comision como Gasto ya pagado, en su categoria propia",
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

      // El Gasto ya lo creo registrarVenta — nadie lo pide a mano (H-24).
      const gastoComision = venta.data.gastoComision;
      expect(gastoComision?.ok).toBe(true);
      if (!gastoComision?.ok) return;
      expect(gastoComision.data.monto).toBe(20);

      const ficha = await fichaGasto(owner!, gastoComision.data.gastoId);
      expect(ficha.ok).toBe(true);
      if (ficha.ok) {
        expect(ficha.data.gasto?.origen).toBe("comision_venta_automatica");
        expect(Number(ficha.data.gasto?.monto)).toBe(20);
        expect(ficha.data.gasto?.estadoPago).toBe("pagado");
        expect(ficha.data.gasto?.tipo).toBe("variable_no_productivo");
        // referenciaId ata el gasto a la venta que lo origino.
        expect(ficha.data.gasto?.referenciaId).toBe(venta.data.ventaId);
      }

      // La categoria se provisiono sola, sin que el Owner la creara (H-32).
      const categorias = await listarCategoriasGasto(owner!, tenantId);
      expect(categorias.ok).toBe(true);
      if (categorias.ok) {
        const comisiones = categorias.data.filter(
          (c) => c.nombre === CATEGORIA_COMISION_VENTA
        );
        expect(comisiones).toHaveLength(1);
        expect(comisiones[0].id).toBe(gastoComision.data.categoriaId);
      }

      // Una segunda venta reutiliza la misma categoria, no crea otra.
      const venta2 = await registrarVenta(owner!, tenantId, {
        sucursalId,
        canalVentaId: canal.data.canalVentaId,
        lineas: [{ productoId: producto.data.productoId, cantidad: 5 }], // total 100, comision 10
      });
      expect(venta2.ok).toBe(true);
      if (!venta2.ok) return;
      expect(venta2.data.gastoComision?.ok).toBe(true);
      if (venta2.data.gastoComision?.ok) {
        expect(venta2.data.gastoComision.data.monto).toBe(10);
        expect(venta2.data.gastoComision.data.categoriaId).toBe(
          gastoComision.data.categoriaId
        );
      }
    },
    20000
  );

  it("H-24: una venta por un canal sin comision no genera ningun Gasto", async () => {
    const owner = await identidadRepo.obtenerUsuarioConRolPorId(ownerId);
    const canal = await crearCanalVenta(owner!, tenantId, { nombre: "Local sin comisión" });
    if (!canal.ok) throw new Error("setup fallo: crearCanalVenta");

    const producto = await crearProducto(owner!, tenantId, {
      nombre: "Gelato Pistacho",
      unidadVenta: "unidad",
      precioVenta: 30,
    });
    if (!producto.ok) throw new Error("setup fallo: crearProducto");
    await registrarAjusteManualStock(owner!, tenantId, {
      productoId: producto.data.productoId,
      sucursalId,
      tipo: "entrada_ajuste_manual",
      cantidad: 5,
      motivo: "Carga inicial",
    });

    const venta = await registrarVenta(owner!, tenantId, {
      sucursalId,
      canalVentaId: canal.data.canalVentaId,
      lineas: [{ productoId: producto.data.productoId, cantidad: 2 }],
    });
    expect(venta.ok).toBe(true);
    if (!venta.ok) return;
    expect(venta.data.comisionMontoCalculado).toBeNull();
    expect(venta.data.gastoComision).toBeNull();
  });

  it("H-24: generarGastoComisionVenta rechaza un monto que no puede ser un costo", async () => {
    const owner = await identidadRepo.obtenerUsuarioConRolPorId(ownerId);
    for (const montoComision of [0, -50]) {
      const resultado = await generarGastoComisionVenta(owner!, tenantId, {
        ventaId: crypto.randomUUID(),
        sucursalId,
        montoComision,
        fechaVenta: "2026-06-10",
      });
      expect(resultado.ok).toBe(false);
      if (!resultado.ok) expect(resultado.error).toContain("mayor a 0");
    }
  });

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
