import { eq, inArray } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { db } from "@/db/client";
import { crearClienteAdmin } from "@/lib/supabase/server";
import { crearRolPersonalizado } from "@/modules/identidad/actions";
import { ROL_OWNER_ID } from "@/modules/identidad/constants";
import * as identidadRepo from "@/modules/identidad/repository";
import {
  permisos,
  permisosEspecialesPorUsuario,
  roles,
  sucursales,
  tenants,
  usuarios,
} from "@/modules/identidad/schema";
import { crearActivo } from "@/modules/patrimonio/actions";
import { activos } from "@/modules/patrimonio/schema";
import { consultarStock, crearProducto } from "@/modules/productos/actions";
import { categoriasProducto, movimientosStock, productos, stock } from "@/modules/productos/schema";
import {
  actualizarComposicionReceta,
  consultarCapacidadAlmacenamientoUsada,
  consultarCapacidadProduccionUsada,
  crearInsumo,
  crearReceta,
  fichaInsumo,
  fichaReceta,
  listarMovimientosInsumo,
  registrarAjusteManualInsumo,
  registrarEntradaCompraInsumo,
  registrarProduccion,
  registrarProduccionDeAjuste,
  vincularProductoAReceta,
} from "./actions";
import {
  insumos,
  movimientosInsumo,
  produccionesAjuste,
  producciones,
  recetaInsumos,
  recetas,
  stockInsumo,
  vinculacionesProductoReceta,
} from "./schema";

const hasCredenciales = Boolean(
  process.env.DATABASE_URL && process.env.SUPABASE_SECRET_KEY
);

describe.skipIf(!hasCredenciales)(
  "Modulo 6 - Modulo Operativo Nicho 1 (integracion, SanttiCampo)",
  () => {
    let admin: ReturnType<typeof crearClienteAdmin>;
    const sufijo = Date.now();
    let tenantId: string;
    let ownerId: string;
    let colaboradorId: string | undefined;
    let sucursalId: string;
    let activoId: string;
    let insumoLecheId: string;
    let recetaId: string;

    beforeAll(async () => {
      admin = crearClienteAdmin();
      const { data, error } = await admin.auth.admin.createUser({
        email: `operativo-owner-${sufijo}@ceom-erp.test`,
        email_confirm: true,
      });
      if (error || !data.user) {
        throw error ?? new Error("No se pudo crear el usuario de Auth de prueba");
      }
      ownerId = data.user.id;

      const { tenant, sucursal } = await identidadRepo.crearTenantConOwner({
        tenant: {
          nombreNegocio: `Operativo Test ${sufijo}`,
          monedaPrincipal: "BOB",
          estadoSuscripcion: "activa",
          fechaInicioSuscripcion: new Date().toISOString().slice(0, 10),
        },
        ownerId,
        ownerNombreCompleto: "Owner Operativo",
        ownerEmail: `operativo-owner-${sufijo}@ceom-erp.test`,
        rolOwnerId: ROL_OWNER_ID,
        creadoPor: null,
      });
      tenantId = tenant.id;
      sucursalId = sucursal.id;

      const owner = await identidadRepo.obtenerUsuarioConRolPorId(ownerId);
      const activo = await crearActivo(owner!, tenantId, {
        nombre: "Heladera SanttiCampo",
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
        nombre: "Leche",
        unidadMedida: "litros",
        vidaUtilDias: 5,
      });
      if (!insumo.ok) throw new Error("setup fallo: crearInsumo");
      insumoLecheId = insumo.data.insumoId;

      const receta = await crearReceta(owner!, tenantId, {
        nombre: "Base Gelato Frutos Rojos",
        rendimientoPorLote: 3,
        unidadRendimiento: "litros",
      });
      if (!receta.ok) throw new Error("setup fallo: crearReceta");
      recetaId = receta.data.recetaId;

      await actualizarComposicionReceta(owner!, recetaId, [
        { insumoId: insumoLecheId, cantidadPorLote: 2 },
      ]);

      await registrarEntradaCompraInsumo(owner!, tenantId, {
        insumoId: insumoLecheId,
        sucursalId,
        cantidad: 100,
        costoCompra: 5,
      });
    });

    afterAll(async () => {
      const usuarioIds = colaboradorId ? [ownerId, colaboradorId] : [ownerId];
      await db
        .delete(permisosEspecialesPorUsuario)
        .where(inArray(permisosEspecialesPorUsuario.usuarioId, usuarioIds));

      const produccionesDelTenant = await db
        .select({ id: producciones.id })
        .from(producciones)
        .where(eq(producciones.tenantId, tenantId));
      for (const p of produccionesDelTenant) {
        await db.delete(produccionesAjuste).where(eq(produccionesAjuste.produccionId, p.id));
      }
      await db.delete(producciones).where(eq(producciones.tenantId, tenantId));
      await db
        .delete(vinculacionesProductoReceta)
        .where(eq(vinculacionesProductoReceta.recetaId, recetaId));
      await db.delete(recetaInsumos).where(eq(recetaInsumos.recetaId, recetaId));
      await db.delete(recetas).where(eq(recetas.tenantId, tenantId));

      const insumosDelTenant = await db
        .select({ id: insumos.id })
        .from(insumos)
        .where(eq(insumos.tenantId, tenantId));
      for (const i of insumosDelTenant) {
        await db.delete(movimientosInsumo).where(eq(movimientosInsumo.insumoId, i.id));
        await db.delete(stockInsumo).where(eq(stockInsumo.insumoId, i.id));
      }
      await db.delete(insumos).where(eq(insumos.tenantId, tenantId));

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

      await db.delete(activos).where(eq(activos.tenantId, tenantId));
      await db.delete(usuarios).where(eq(usuarios.tenantId, tenantId));
      await db.delete(permisos).where(
        inArray(
          permisos.rolId,
          db.select({ id: roles.id }).from(roles).where(eq(roles.tenantId, tenantId))
        )
      );
      await db.delete(roles).where(eq(roles.tenantId, tenantId));
      await db.delete(sucursales).where(eq(sucursales.tenantId, tenantId));
      await db.delete(tenants).where(eq(tenants.id, tenantId));
      await admin.auth.admin.deleteUser(ownerId);
      if (colaboradorId) await admin.auth.admin.deleteUser(colaboradorId);
    });

    it("regla 3.4 / caso borde 4: registrarProduccion sin vinculacion se bloquea", async () => {
      const owner = await identidadRepo.obtenerUsuarioConRolPorId(ownerId);
      const productoSinVincular = await crearProducto(owner!, tenantId, {
        nombre: "Gelato Sin Vincular",
        unidadVenta: "unidad",
        precioVenta: 25,
      });
      if (!productoSinVincular.ok) throw new Error("setup fallo");

      const resultado = await registrarProduccion(owner!, tenantId, {
        productoId: productoSinVincular.data.productoId,
        sucursalId,
        activoId,
        fechaProduccion: "2026-02-01",
        cantidadLotesProducidos: 1,
        cantidadRealObtenida: 25,
      });
      expect(resultado.ok).toBe(false);
    });

    it(
      "produccion exitosa: descuenta insumos, calcula costo con merma, y acredita stock real en Productos e Inventario (casos de uso 1-4, caso borde 1)",
      async () => {
        const owner = await identidadRepo.obtenerUsuarioConRolPorId(ownerId);
        const producto = await crearProducto(owner!, tenantId, {
          nombre: "Gelato Frutos Rojos — Simple",
          unidadVenta: "unidad",
          precioVenta: 25,
          vidaUtilDias: 10,
        });
        if (!producto.ok) throw new Error("setup fallo");
        const productoId = producto.data.productoId;

        const vinculacion = await vincularProductoAReceta(owner!, tenantId, {
          productoId,
          recetaId,
          cantidadBaseConsumidaPorUnidad: 0.1,
        });
        expect(vinculacion.ok).toBe(true);

        // receta: 2L leche por lote de 3L rendimiento; 1 lote -> 2L leche
        // consumidos, rendimiento teorico = 3/0.1 = 30 unidades. Con merma,
        // solo se obtienen 28 -> costo por unidad sube.
        const resultado = await registrarProduccion(owner!, tenantId, {
          productoId,
          sucursalId,
          activoId,
          fechaProduccion: "2026-02-01",
          cantidadLotesProducidos: 1,
          cantidadRealObtenida: 28,
        });
        expect(resultado.ok).toBe(true);
        if (!resultado.ok) return;

        // costo total insumos = 2L x 5 (costo promedio) = 10; costo/unidad = 10/28
        expect(resultado.data.costoOperativoCalculado).toBeCloseTo(10 / 28, 6);
        expect(resultado.data.mermaCantidad).toBeCloseTo(2, 6); // 30 - 28
        expect(resultado.data.acreditacionProductos.ok).toBe(true);

        // caso de uso 6: fecha_vencimiento_lote auto-calculada
        const [produccionPersistida] = await db
          .select()
          .from(producciones)
          .where(eq(producciones.id, resultado.data.produccionId));
        expect(produccionPersistida.fechaVencimientoLote).toBe("2026-02-11");

        // integracion real: Productos e Inventario quedo acreditado
        const stockProducto = await consultarStock(owner!, productoId, sucursalId);
        expect(stockProducto.ok).toBe(true);
        if (stockProducto.ok) expect(stockProducto.data.cantidadActual).toBe(28);

        // stock de insumo quedo descontado: 100 - 2 = 98
        const stockLeche = await db
          .select()
          .from(stockInsumo)
          .where(eq(stockInsumo.insumoId, insumoLecheId));
        expect(Number(stockLeche[0]?.cantidadActual)).toBe(98);
      },
      20000
    );

    it("fichaInsumo junta insumo + stock por sucursal en una sola llamada", async () => {
      const owner = await identidadRepo.obtenerUsuarioConRolPorId(ownerId);
      const resultado = await fichaInsumo(owner!, insumoLecheId);
      expect(resultado.ok).toBe(true);
      if (!resultado.ok) return;
      expect(resultado.data.insumo?.nombre).toBe("Leche");
      const filaSucursal = resultado.data.stockPorSucursal.find((f) => f.sucursalId === sucursalId);
      expect(filaSucursal).toBeDefined();
      // Estado determinista en este punto de la secuencia: 100 (entrada
      // inicial) - 2 (consumidos por la produccion del test anterior) = 98.
      expect(Number(filaSucursal?.cantidadActual)).toBe(98);
    });

    it("listarMovimientosInsumo devuelve el historial de un Insumo en una sucursal", async () => {
      const owner = await identidadRepo.obtenerUsuarioConRolPorId(ownerId);
      const resultado = await listarMovimientosInsumo(owner!, insumoLecheId, sucursalId);
      expect(resultado.ok).toBe(true);
      if (!resultado.ok) return;
      // entrada_compra (beforeAll) + salida_produccion (test anterior).
      expect(resultado.data).toHaveLength(2);
      expect(resultado.data.every((m) => m.insumoId === insumoLecheId)).toBe(true);
      expect(resultado.data.map((m) => m.tipo).sort()).toEqual(
        ["entrada_compra", "salida_produccion"].sort()
      );
    });

    it("fichaReceta junta receta + composicion por recetaId directo (sin pasar por un producto vinculado)", async () => {
      const owner = await identidadRepo.obtenerUsuarioConRolPorId(ownerId);
      const resultado = await fichaReceta(owner!, recetaId);
      expect(resultado.ok).toBe(true);
      if (!resultado.ok) return;
      expect(resultado.data.receta?.nombre).toBe("Base Gelato Frutos Rojos");
      expect(resultado.data.composicion).toHaveLength(1);
      expect(resultado.data.composicion[0].insumoId).toBe(insumoLecheId);
      expect(Number(resultado.data.composicion[0].cantidadPorLote)).toBe(2);
    });

    it("regla 3.5 / caso borde 2: bloquea produccion sin insumo suficiente, salvo producir_sin_stock_insumo (y el Owner nunca se bloquea, seccion 6.2)", async () => {
      const owner = await identidadRepo.obtenerUsuarioConRolPorId(ownerId);
      const producto = await crearProducto(owner!, tenantId, {
        nombre: "Gelato Frutos Rojos — Litro",
        unidadVenta: "unidad",
        precioVenta: 90,
      });
      if (!producto.ok) throw new Error("setup fallo");
      const productoId = producto.data.productoId;

      await vincularProductoAReceta(owner!, tenantId, {
        productoId,
        recetaId,
        cantidadBaseConsumidaPorUnidad: 1,
      });

      // El Owner tiene bypass incondicional (identidad/actions.ts,
      // tieneCapacidadEspecial) — nunca se bloquea, con o sin override. Esta
      // rama prueba la regla con un colaborador NO-Owner (unico actor que
      // puede quedar bloqueado de verdad).
      const rolColaborador = await crearRolPersonalizado(owner!, {
        nombre: `Produccion sin stock ${sufijo}`,
        permisos: [{ modulo: "operativo", accion: "crear", permitido: true }],
      });
      if (!rolColaborador.ok) throw new Error("setup de rol fallo");

      const { data: authColaborador, error: errorAuth } = await admin.auth.admin.createUser({
        email: `operativo-colab-${sufijo}@ceom-erp.test`,
        email_confirm: true,
      });
      if (errorAuth || !authColaborador.user) throw errorAuth ?? new Error("setup de auth fallo");
      colaboradorId = authColaborador.user.id;

      await identidadRepo.insertarUsuario({
        id: colaboradorId,
        tenantId,
        nombreCompleto: "Colaborador produccion",
        email: `operativo-colab-${sufijo}@ceom-erp.test`,
        rolId: rolColaborador.data.rolId,
        esOwner: false,
        activo: true,
        creadoPor: ownerId,
      });
      const colaborador = await identidadRepo.obtenerUsuarioConRolPorId(colaboradorId);

      // pide una cantidad de lotes absurda para agotar el stock de leche.
      const bloqueada = await registrarProduccion(colaborador!, tenantId, {
        productoId,
        sucursalId,
        activoId,
        fechaProduccion: "2026-02-02",
        cantidadLotesProducidos: 1000,
        cantidadRealObtenida: 3000,
      });
      expect(bloqueada.ok).toBe(false);

      // El Owner, en cambio, nunca se bloquea (sin override cargado) —
      // usa una cantidad chica para no volver a agotar el stock de leche
      // antes de la asercion del colaborador con override, mas abajo.
      const ownerSinStock = await registrarProduccion(owner!, tenantId, {
        productoId,
        sucursalId,
        activoId,
        fechaProduccion: "2026-02-02",
        cantidadLotesProducidos: 1000,
        cantidadRealObtenida: 3000,
      });
      expect(ownerSinStock.ok).toBe(true);

      await db.insert(permisosEspecialesPorUsuario).values({
        usuarioId: colaboradorId,
        capacidad: "producir_sin_stock_insumo",
        habilitado: true,
        creadoPor: ownerId,
      });
      const colaboradorConCapacidad = await identidadRepo.obtenerUsuarioConRolPorId(colaboradorId);

      const permitida = await registrarProduccion(colaboradorConCapacidad!, tenantId, {
        productoId,
        sucursalId,
        activoId,
        fechaProduccion: "2026-02-02",
        cantidadLotesProducidos: 1000,
        cantidadRealObtenida: 3000,
      });
      expect(permitida.ok).toBe(true);
    }, 20000);

    it("registrarAjusteManualInsumo exige motivo", async () => {
      const owner = await identidadRepo.obtenerUsuarioConRolPorId(ownerId);
      const sinMotivo = await registrarAjusteManualInsumo(owner!, tenantId, {
        insumoId: insumoLecheId,
        sucursalId,
        tipo: "entrada_ajuste_manual",
        cantidad: 5,
        motivo: "  ",
      });
      expect(sinMotivo.ok).toBe(false);

      const conMotivo = await registrarAjusteManualInsumo(owner!, tenantId, {
        insumoId: insumoLecheId,
        sucursalId,
        tipo: "entrada_ajuste_manual",
        cantidad: 5,
        motivo: "Conteo físico",
      });
      expect(conMotivo.ok).toBe(true);
    });

    it("caso borde 5: registrarProduccionDeAjuste exige motivo y no altera la Produccion original", async () => {
      const owner = await identidadRepo.obtenerUsuarioConRolPorId(ownerId);
      const producto = await crearProducto(owner!, tenantId, {
        nombre: "Gelato Frutos Rojos — Doble",
        unidadVenta: "unidad",
        precioVenta: 40,
      });
      if (!producto.ok) throw new Error("setup fallo");
      const productoId = producto.data.productoId;

      await vincularProductoAReceta(owner!, tenantId, {
        productoId,
        recetaId,
        cantidadBaseConsumidaPorUnidad: 0.2,
      });

      const produccion = await registrarProduccion(owner!, tenantId, {
        productoId,
        sucursalId,
        activoId,
        fechaProduccion: "2026-02-03",
        cantidadLotesProducidos: 1,
        cantidadRealObtenida: 15,
      });
      if (!produccion.ok) throw new Error("setup fallo");

      const sinMotivo = await registrarProduccionDeAjuste(owner!, produccion.data.produccionId, {
        cantidadRealObtenidaCorregida: 14,
        motivo: "   ",
      });
      expect(sinMotivo.ok).toBe(false);

      const conMotivo = await registrarProduccionDeAjuste(owner!, produccion.data.produccionId, {
        cantidadRealObtenidaCorregida: 14,
        motivo: "Conteo físico detectó una unidad menos",
      });
      expect(conMotivo.ok).toBe(true);

      const [produccionOriginal] = await db
        .select()
        .from(producciones)
        .where(eq(producciones.id, produccion.data.produccionId));
      expect(Number(produccionOriginal.cantidadRealObtenida)).toBe(15);
    }, 20000);

    it("seccion 4: consultarCapacidadProduccionUsada/Almacenamiento devuelven porcentajes coherentes", async () => {
      const owner = await identidadRepo.obtenerUsuarioConRolPorId(ownerId);

      const capacidadProduccion = await consultarCapacidadProduccionUsada(
        owner!,
        tenantId,
        activoId,
        { desde: "2026-02-01", hasta: "2026-02-08" }
      );
      expect(capacidadProduccion.ok).toBe(true);
      if (capacidadProduccion.ok) {
        expect(capacidadProduccion.data.capacidadPeriodo).toBeGreaterThan(0);
        expect(capacidadProduccion.data.produccionReal).toBeGreaterThan(0);
        expect(capacidadProduccion.data.porcentajeUsado).not.toBeNull();
      }

      const capacidadAlmacenamiento = await consultarCapacidadAlmacenamientoUsada(
        owner!,
        tenantId,
        activoId
      );
      expect(capacidadAlmacenamiento.ok).toBe(true);
      if (capacidadAlmacenamiento.ok) {
        expect(capacidadAlmacenamiento.data.capacidadAlmacenamientoCantidad).toBe(200);
        expect(capacidadAlmacenamiento.data.stockActualTotal).toBeGreaterThan(0);
      }
    }, 20000);
    // Timeout mas alto que el default (5000ms) -- mismo criterio que los otros
    // 2 tests de este archivo con override explicito. Diagnostico real (no un
    // "por las dudas"): esta llamada encadena ~14 round-trips secuenciales
    // contra Supabase Cloud real -- tienePermiso() propio + consultarCapacidad()
    // (patrimonio, ahora envuelta en comoUsuario() desde la Etapa 1 del
    // backstop RLS: 1 round-trip de contexto + 1 lectura + 1 tienePermiso
    // interno) se paga DOS veces (una por cada consultarCapacidad*Usada), mas
    // repo.listarProductosSucursalesPorActivo + el fan-out de consultarStock
    // (ya paralelizado con Promise.all mas abajo, antes secuencial -- ver ese
    // comentario). Un test flaky "de siempre" era en realidad un N+1 real
    // (arreglado) mas un timeout ajustado que un cambio ajeno (esta migracion)
    // termino de empujar por encima del limite -- documentado, no ignorado.
  }
);
