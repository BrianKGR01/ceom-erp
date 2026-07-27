import { eq, inArray } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { db } from "@/db/client";
import { crearClienteAdmin } from "@/lib/supabase/server";
import { borrarUsuariosAuth, limpiarConAuthGarantizada, limpiarEnParalelo } from "@/test-utils/limpieza";
import { ROL_OWNER_ID } from "@/modules/identidad/constants";
import * as identidadRepo from "@/modules/identidad/repository";
import { roles, sucursales, tenants, usuarios } from "@/modules/identidad/schema";
import {
  consultarStockInsumo,
  crearInsumo,
  registrarAjusteManualInsumo,
} from "@/modules/operativo/nichos/nicho-1/actions";
import { insumos, movimientosInsumo, stockInsumo } from "@/modules/operativo/nichos/nicho-1/schema";
import { consultarStock, crearProducto } from "@/modules/productos/actions";
import { movimientosStock, productos, stock } from "@/modules/productos/schema";
import {
  consultarSaldoCompra,
  fichaProveedor,
  historialPrecio,
  listarCompras,
  listarComprasConAjustes,
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
  let admin: ReturnType<typeof crearClienteAdmin>;
  const sufijo = Date.now();
  let tenantId: string;
  let ownerId: string;
  let sucursalId: string;
  let proveedorId: string;
  let insumoId: string;
  let productoId: string;

  beforeAll(async () => {
    admin = crearClienteAdmin();
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
    // "compras" tiene FK a insumos Y a productos (check constraint: exactamente
    // uno segun "tipo") -- tiene que salir ANTES de esas dos familias, no en
    // paralelo con ellas (bug real encontrado corriendo la suite completa:
    // "compras_insumo_id_insumos_id_fk" violado al paralelizar sin esta
    // dependencia). insumos y productos sí son independientes entre sí.
    await limpiarConAuthGarantizada(
      async () => {
        const compraIds = db.select({ id: compras.id }).from(compras).where(eq(compras.tenantId, tenantId));
        await db.delete(comprasAjuste).where(inArray(comprasAjuste.compraId, compraIds));
        await db.delete(pagosCompra).where(inArray(pagosCompra.compraId, compraIds));
        await db.delete(compras).where(eq(compras.tenantId, tenantId));
        await db.delete(proveedores).where(eq(proveedores.tenantId, tenantId));

        // Tenant-wide y no por el id del setup: los tests de reversión de
        // stock (H-31) crean insumos propios, y sus movimientos referencian
        // la sucursal — borrar solo el insumo compartido dejaba filas que
        // rompían el delete de "sucursales" por FK (bug real de esta tanda).
        await limpiarEnParalelo([
          async () => {
            const insumoIds = db
              .select({ id: insumos.id })
              .from(insumos)
              .where(eq(insumos.tenantId, tenantId));
            await db.delete(movimientosInsumo).where(inArray(movimientosInsumo.insumoId, insumoIds));
            await db.delete(stockInsumo).where(inArray(stockInsumo.insumoId, insumoIds));
            await db.delete(insumos).where(eq(insumos.tenantId, tenantId));
          },
          async () => {
            const productoIds = db
              .select({ id: productos.id })
              .from(productos)
              .where(eq(productos.tenantId, tenantId));
            await db.delete(movimientosStock).where(inArray(movimientosStock.productoId, productoIds));
            await db.delete(stock).where(inArray(stock.productoId, productoIds));
            await db.delete(productos).where(eq(productos.tenantId, tenantId));
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
      const compra = await repo.obtenerCompraPorId(db, resultado.data.compraId);
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

    // La compra original queda intacta (regla 3.3, append-only)...
    const compraOriginal = await repo.obtenerCompraPorId(db, compra.data.compraId);
    expect(Number(compraOriginal?.montoTotal)).toBe(100);
    // ...pero lo que VALE hoy ya no es 100 (H-31): antes el ajuste no
    // cambiaba nada y la compra seguía figurando por su monto original.
    if (ajuste.ok) {
      expect(ajuste.data.montoTotalEfectivo).toBe(110);
      expect(ajuste.data.saldoPendiente).toBe(110);
      expect(ajuste.data.estadoPago).toBe("pendiente");
    }
  });

  // --- H-31: el ajuste de compra tiene efecto observable -----------------

  it("H-31: el signo del ajuste se deriva del tipo — devolución y anulación solo pueden reducir", async () => {
    const owner = await identidadRepo.obtenerUsuarioConRolPorId(ownerId);
    const compra = await registrarCompra(owner!, tenantId, {
      sucursalId,
      proveedorId,
      tipo: "insumo",
      insumoId,
      cantidad: 2,
      montoTotal: 200,
      fechaCompra: "2026-02-01",
    });
    if (!compra.ok) throw new Error("setup fallo");

    for (const tipo of ["devolucion_a_proveedor", "anulacion_total"] as const) {
      const enPositivo = await registrarCompraDeAjuste(owner!, compra.data.compraId, {
        tipo,
        montoAjuste: 50,
        motivo: "Cargado con el signo al revés",
      });
      expect(enPositivo.ok).toBe(false);
      if (!enPositivo.ok) expect(enPositivo.error).toContain("negativo");
    }

    const enCero = await registrarCompraDeAjuste(owner!, compra.data.compraId, {
      tipo: "correccion",
      montoAjuste: 0,
      motivo: "Ajuste vacío",
    });
    expect(enCero.ok).toBe(false);

    // Y no puede dejar la compra valiendo menos que nada.
    const excesiva = await registrarCompraDeAjuste(owner!, compra.data.compraId, {
      tipo: "anulacion_total",
      montoAjuste: -300,
      motivo: "Más de lo que vale la compra",
    });
    expect(excesiva.ok).toBe(false);
    if (!excesiva.ok) expect(excesiva.error).toContain("negativo");
  });

  it("H-31: una anulación total deja la compra sin saldo, no pendiente para siempre", async () => {
    const owner = await identidadRepo.obtenerUsuarioConRolPorId(ownerId);
    const compra = await registrarCompra(owner!, tenantId, {
      sucursalId,
      proveedorId,
      tipo: "insumo",
      insumoId,
      cantidad: 4,
      montoTotal: 400,
      fechaCompra: "2026-03-01",
    });
    if (!compra.ok) throw new Error("setup fallo");

    const saldoAntes = await consultarSaldoCompra(owner!, compra.data.compraId);
    expect(saldoAntes.ok).toBe(true);
    if (saldoAntes.ok) expect(saldoAntes.data.saldoPendiente).toBe(400);

    const anulacion = await registrarCompraDeAjuste(owner!, compra.data.compraId, {
      tipo: "anulacion_total",
      montoAjuste: -400,
      motivo: "La compra no existió — se cargó dos veces",
    });
    expect(anulacion.ok).toBe(true);
    if (!anulacion.ok) return;
    expect(anulacion.data.montoTotalEfectivo).toBe(0);
    expect(anulacion.data.saldoPendiente).toBe(0);
    // Antes de H-31 esto quedaba "pendiente": el sistema seguía diciendo que
    // le debías Bs 400 al proveedor por una compra anulada.
    expect(anulacion.data.estadoPago).toBe("pagado");

    const saldoDespues = await consultarSaldoCompra(owner!, compra.data.compraId);
    expect(saldoDespues.ok).toBe(true);
    if (saldoDespues.ok) {
      expect(saldoDespues.data.montoTotal).toBe(400);
      expect(saldoDespues.data.montoTotalEfectivo).toBe(0);
      expect(saldoDespues.data.saldoPendiente).toBe(0);
    }
  });

  it("H-31: una corrección a la baja deja la compra pagada al cubrir el saldo nuevo", async () => {
    const owner = await identidadRepo.obtenerUsuarioConRolPorId(ownerId);
    const compra = await registrarCompra(owner!, tenantId, {
      sucursalId,
      proveedorId,
      tipo: "insumo",
      insumoId,
      cantidad: 3,
      montoTotal: 300,
      fechaCompra: "2026-04-01",
    });
    if (!compra.ok) throw new Error("setup fallo");

    // Se pagan 180 de 300 -> parcial.
    const pagoParcial = await registrarPagoCompra(owner!, compra.data.compraId, {
      monto: 180,
      fechaPago: "2026-04-02",
    });
    expect(pagoParcial.ok).toBe(true);
    if (pagoParcial.ok) expect(pagoParcial.data.estadoPago).toBe("parcial");

    // El proveedor corrige: eran 180, no 300. Con esos 180 ya pagados, la
    // compra queda cubierta. Antes el estado se derivaba contra montoTotal, así
    // que se quedaba "parcial" para siempre por una deuda que no existía.
    const correccion = await registrarCompraDeAjuste(owner!, compra.data.compraId, {
      tipo: "correccion",
      montoAjuste: -120,
      motivo: "La factura real era de 180",
    });
    expect(correccion.ok).toBe(true);
    if (!correccion.ok) return;
    expect(correccion.data.montoTotalEfectivo).toBe(180);
    expect(correccion.data.saldoPendiente).toBe(0);
    expect(correccion.data.estadoPago).toBe("pagado");
  });

  it("H-31: una anulación devuelve el stock que había entrado, y una corrección no lo toca", async () => {
    const owner = await identidadRepo.obtenerUsuarioConRolPorId(ownerId);
    const insumoPropio = await crearInsumo(owner!, tenantId, {
      nombre: `Insumo Reversión ${sufijo}`,
      unidadMedida: "kg",
    });
    if (!insumoPropio.ok) throw new Error("setup fallo: crearInsumo");

    const compra = await registrarCompra(owner!, tenantId, {
      sucursalId,
      proveedorId,
      tipo: "insumo",
      insumoId: insumoPropio.data.insumoId,
      cantidad: 12,
      montoTotal: 240,
      fechaCompra: "2026-06-01",
    });
    if (!compra.ok) throw new Error("setup fallo: registrarCompra");

    const stockTrasCompra = await consultarStockInsumo(
      owner!,
      insumoPropio.data.insumoId,
      sucursalId
    );
    expect(stockTrasCompra.ok).toBe(true);
    if (stockTrasCompra.ok) expect(stockTrasCompra.data.cantidadActual).toBe(12);

    // Una corrección de monto es plata, no mercadería: el stock no se mueve.
    const correccion = await registrarCompraDeAjuste(owner!, compra.data.compraId, {
      tipo: "correccion",
      montoAjuste: 15,
      motivo: "Flete no cargado",
    });
    expect(correccion.ok).toBe(true);
    if (correccion.ok) expect(correccion.data.reversionStock).toBeNull();

    // Y ni siquiera se puede pedir que la mueva.
    const correccionConUnidades = await registrarCompraDeAjuste(owner!, compra.data.compraId, {
      tipo: "correccion",
      montoAjuste: -10,
      motivo: "Intento de devolver con el tipo equivocado",
      cantidadDevuelta: 2,
    });
    expect(correccionConUnidades.ok).toBe(false);

    const stockTrasCorreccion = await consultarStockInsumo(
      owner!,
      insumoPropio.data.insumoId,
      sucursalId
    );
    expect(stockTrasCorreccion.ok).toBe(true);
    if (stockTrasCorreccion.ok) expect(stockTrasCorreccion.data.cantidadActual).toBe(12);

    // La anulación sí: sin pedir cantidad, vuelve todo lo que entró.
    const anulacion = await registrarCompraDeAjuste(owner!, compra.data.compraId, {
      tipo: "anulacion_total",
      montoAjuste: -255,
      motivo: "La compra no existió",
    });
    expect(anulacion.ok).toBe(true);
    if (!anulacion.ok) return;
    expect(anulacion.data.reversionStock?.devuelta).toBe(12);
    // Reversión completa: no hay nada que avisar.
    expect(anulacion.data.reversionStock?.aviso).toBeNull();

    const stockFinal = await consultarStockInsumo(
      owner!,
      insumoPropio.data.insumoId,
      sucursalId
    );
    expect(stockFinal.ok).toBe(true);
    if (stockFinal.ok) expect(stockFinal.data.cantidadActual).toBe(0);

    // Un segundo ajuste sobre una compra que ya vale 0 se rechaza antes de
    // llegar al stock: el guard del monto es el primero que actúa.
    const segundoAjuste = await registrarCompraDeAjuste(owner!, compra.data.compraId, {
      tipo: "devolucion_a_proveedor",
      montoAjuste: -1,
      motivo: "Intento de devolver dos veces",
    });
    expect(segundoAjuste.ok).toBe(false);
    const stockTrasSegundo = await consultarStockInsumo(
      owner!,
      insumoPropio.data.insumoId,
      sucursalId
    );
    expect(stockTrasSegundo.ok).toBe(true);
    if (stockTrasSegundo.ok) expect(stockTrasSegundo.data.cantidadActual).toBe(0);
  });

  it("H-31: no se puede devolver más unidades de las que trajo la compra, ni acumulando ajustes", async () => {
    const owner = await identidadRepo.obtenerUsuarioConRolPorId(ownerId);
    const insumoTope = await crearInsumo(owner!, tenantId, {
      nombre: `Insumo Tope ${sufijo}`,
      unidadMedida: "kg",
    });
    if (!insumoTope.ok) throw new Error("setup fallo: crearInsumo");

    const compra = await registrarCompra(owner!, tenantId, {
      sucursalId,
      proveedorId,
      tipo: "insumo",
      insumoId: insumoTope.data.insumoId,
      cantidad: 12,
      montoTotal: 240, // costo unitario 20
      fechaCompra: "2026-06-10",
    });
    if (!compra.ok) throw new Error("setup fallo: registrarCompra");

    // Más unidades de las que trajo, de una: rechazado.
    const excesiva = await registrarCompraDeAjuste(owner!, compra.data.compraId, {
      tipo: "devolucion_a_proveedor",
      montoAjuste: -100,
      motivo: "Devolución inflada",
      cantidadDevuelta: 15,
    });
    expect(excesiva.ok).toBe(false);
    if (!excesiva.ok) expect(excesiva.error).toContain("12");

    // Primera devolución legítima: 5 de 12.
    const primera = await registrarCompraDeAjuste(owner!, compra.data.compraId, {
      tipo: "devolucion_a_proveedor",
      montoAjuste: -100,
      motivo: "Devolví 5 kg",
      cantidadDevuelta: 5,
    });
    expect(primera.ok).toBe(true);
    if (primera.ok) expect(primera.data.reversionStock?.devuelta).toBe(5);

    // La segunda no puede pasarse del resto (12 - 5 = 7), acumulando.
    const segundaExcesiva = await registrarCompraDeAjuste(owner!, compra.data.compraId, {
      tipo: "devolucion_a_proveedor",
      montoAjuste: -100,
      motivo: "Devolví 8 kg más",
      cantidadDevuelta: 8,
    });
    expect(segundaExcesiva.ok).toBe(false);
    if (!segundaExcesiva.ok) expect(segundaExcesiva.error).toContain("ya se devolvieron 5");

    const stockFinal = await consultarStockInsumo(
      owner!,
      insumoTope.data.insumoId,
      sucursalId
    );
    expect(stockFinal.ok).toBe(true);
    if (stockFinal.ok) expect(stockFinal.data.cantidadActual).toBe(7);
  });

  it("H-31, el caso difícil: si parte del stock ya se consumió, vuelve solo lo que queda y se avisa", async () => {
    const owner = await identidadRepo.obtenerUsuarioConRolPorId(ownerId);
    const insumoParcial = await crearInsumo(owner!, tenantId, {
      nombre: `Insumo Parcial ${sufijo}`,
      unidadMedida: "kg",
    });
    if (!insumoParcial.ok) throw new Error("setup fallo: crearInsumo");

    const compra = await registrarCompra(owner!, tenantId, {
      sucursalId,
      proveedorId,
      tipo: "insumo",
      insumoId: insumoParcial.data.insumoId,
      cantidad: 10,
      montoTotal: 500,
      fechaCompra: "2026-07-01",
    });
    if (!compra.ok) throw new Error("setup fallo: registrarCompra");

    // Se consumen 7 de las 10 (equivalente a "ya se vendió" del lado reventa).
    const consumo = await registrarAjusteManualInsumo(owner!, tenantId, {
      insumoId: insumoParcial.data.insumoId,
      sucursalId,
      tipo: "salida_ajuste_manual",
      cantidad: 7,
      motivo: "Consumido en producción",
    });
    expect(consumo.ok).toBe(true);

    const anulacion = await registrarCompraDeAjuste(owner!, compra.data.compraId, {
      tipo: "anulacion_total",
      montoAjuste: -500,
      motivo: "La compra estaba cargada dos veces",
    });
    expect(anulacion.ok).toBe(true);
    if (!anulacion.ok) return;

    // El ajuste financiero entra COMPLETO: la compra vale 0 y no se debe nada.
    expect(anulacion.data.montoTotalEfectivo).toBe(0);
    expect(anulacion.data.estadoPago).toBe("pagado");

    // La reversión de stock entra por lo que quedaba: 3, no 10.
    expect(anulacion.data.reversionStock?.solicitada).toBe(10);
    expect(anulacion.data.reversionStock?.devuelta).toBe(3);
    expect(anulacion.data.reversionStock?.aviso).toContain("3 de las 10");
    expect(anulacion.data.reversionStock?.error).toBeUndefined();

    // Y el stock queda en 0, NUNCA en -7: dejarlo negativo movía el error de
    // lugar (ninguna pantalla lo muestra con sentido y la próxima salida se
    // bloquea con un mensaje incomprensible).
    const stockFinal = await consultarStockInsumo(
      owner!,
      insumoParcial.data.insumoId,
      sucursalId
    );
    expect(stockFinal.ok).toBe(true);
    if (stockFinal.ok) expect(stockFinal.data.cantidadActual).toBe(0);
  });

  it("H-31: una compra en estado «pedido» no tiene stock que devolver", async () => {
    const owner = await identidadRepo.obtenerUsuarioConRolPorId(ownerId);
    const compra = await registrarCompra(owner!, tenantId, {
      sucursalId,
      proveedorId,
      tipo: "insumo",
      insumoId,
      cantidad: 6,
      montoTotal: 180,
      fechaCompra: "2026-08-01",
      estado: "pedido",
    });
    if (!compra.ok) throw new Error("setup fallo: registrarCompra");

    const anulacion = await registrarCompraDeAjuste(owner!, compra.data.compraId, {
      tipo: "anulacion_total",
      montoAjuste: -180,
      motivo: "Se canceló el pedido antes de que llegara",
    });
    expect(anulacion.ok).toBe(true);
    if (anulacion.ok) {
      expect(anulacion.data.montoTotalEfectivo).toBe(0);
      // Nunca entró al inventario, así que no hay nada que revertir.
      expect(anulacion.data.reversionStock).toBeNull();
    }
  });

  it("H-31: los ajustes viajan en el listado, con el monto efectivo de cada compra", async () => {
    const owner = await identidadRepo.obtenerUsuarioConRolPorId(ownerId);
    const compra = await registrarCompra(owner!, tenantId, {
      sucursalId,
      proveedorId,
      tipo: "insumo",
      insumoId,
      cantidad: 5,
      montoTotal: 500,
      fechaCompra: "2026-05-01",
    });
    if (!compra.ok) throw new Error("setup fallo");
    await registrarCompraDeAjuste(owner!, compra.data.compraId, {
      tipo: "correccion",
      montoAjuste: 25,
      motivo: "Flete no cargado",
    });

    const listado = await listarComprasConAjustes(owner!, tenantId);
    expect(listado.ok).toBe(true);
    if (!listado.ok) return;
    const fila = listado.data.find((c) => c.id === compra.data.compraId);
    expect(fila).toBeDefined();
    expect(fila!.montoTotalEfectivo).toBe(525);
    expect(fila!.ajustes).toHaveLength(1);
    expect(fila!.ajustes[0].motivo).toBe("Flete no cargado");
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

    const compraPedido = await repo.obtenerCompraPorId(db, compra.data.compraId);
    expect(compraPedido?.estado).toBe("pedido");

    const duranteEspera = await consultarStockInsumo(owner!, insumoId, sucursalId);
    if (!duranteEspera.ok) throw new Error("assert fallo");
    expect(duranteEspera.data.cantidadActual).toBe(antes.data.cantidadActual);

    const recepcion = await recibirCompra(owner!, compra.data.compraId);
    expect(recepcion.ok).toBe(true);
    if (recepcion.ok) expect(recepcion.data.entradaStock.ok).toBe(true);

    const compraRecibida = await repo.obtenerCompraPorId(db, compra.data.compraId);
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
