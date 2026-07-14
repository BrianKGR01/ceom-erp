import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
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
  configurarStockMinimo,
  consultarStock,
  crearProducto,
  descontarStockVenta,
  eliminarProducto,
  enviarProductoAOperaciones,
  actualizarProducto,
  registrarAjusteManualStock,
  registrarTransferenciaStock,
} from "./actions";
import * as repo from "./repository";
import { categoriasProducto, movimientosStock, productos, stock } from "./schema";

const hasCredenciales = Boolean(
  process.env.DATABASE_URL && process.env.SUPABASE_SECRET_KEY
);

describe.skipIf(!hasCredenciales)(
  "Modulo 2 - Productos e Inventario (integracion, modo punto de venta puro sin Nicho)",
  () => {
    const admin = crearClienteAdmin();
    const sufijo = Date.now();
    let tenantId: string;
    let ownerId: string;
    let sucursalId: string;
    let sucursalDestinoId: string;

    beforeAll(async () => {
      const { data, error } = await admin.auth.admin.createUser({
        email: `productos-owner-${sufijo}@ceom-erp.test`,
        email_confirm: true,
      });
      if (error || !data.user) {
        throw error ?? new Error("No se pudo crear el usuario de Auth de prueba");
      }
      ownerId = data.user.id;

      const { tenant, sucursal } = await identidadRepo.crearTenantConOwner({
        tenant: {
          nombreNegocio: `Productos Test ${sufijo}`,
          monedaPrincipal: "BOB",
          estadoSuscripcion: "activa",
          fechaInicioSuscripcion: new Date().toISOString().slice(0, 10),
        },
        ownerId,
        ownerNombreCompleto: "Owner Productos",
        ownerEmail: `productos-owner-${sufijo}@ceom-erp.test`,
        rolOwnerId: ROL_OWNER_ID,
        creadoPor: null,
      });
      tenantId = tenant.id;
      sucursalId = sucursal.id;

      const [destino] = await db
        .insert(sucursales)
        .values({ tenantId, nombre: "Sucursal Destino", esPrincipal: false })
        .returning();
      sucursalDestinoId = destino.id;
    });

    afterAll(async () => {
      await db
        .delete(permisosEspecialesPorUsuario)
        .where(eq(permisosEspecialesPorUsuario.usuarioId, ownerId));

      const productosDelTenant = await db
        .select({ id: productos.id })
        .from(productos)
        .where(eq(productos.tenantId, tenantId));
      for (const p of productosDelTenant) {
        await db.delete(movimientosStock).where(eq(movimientosStock.productoId, p.id));
        await db.delete(stock).where(eq(stock.productoId, p.id));
      }
      await db.delete(productos).where(eq(productos.tenantId, tenantId));
      await db
        .delete(categoriasProducto)
        .where(eq(categoriasProducto.tenantId, tenantId));
      await db.delete(usuarios).where(eq(usuarios.tenantId, tenantId));
      await db.delete(roles).where(eq(roles.tenantId, tenantId));
      await db.delete(sucursales).where(eq(sucursales.tenantId, tenantId));
      await db.delete(tenants).where(eq(tenants.id, tenantId));
      await admin.auth.admin.deleteUser(ownerId);
    });

    it("caso de uso 1: carga inicial en Modo Basico via entrada_ajuste_manual", async () => {
      const owner = await identidadRepo.obtenerUsuarioConRolPorId(ownerId);
      const producto = await crearProducto(owner!, tenantId, {
        nombre: "Gelato Frutos Rojos",
        unidadVenta: "unidad",
        precioVenta: 25,
      });
      expect(producto.ok).toBe(true);
      if (!producto.ok) return;

      const ajuste = await registrarAjusteManualStock(owner!, tenantId, {
        productoId: producto.data.productoId,
        sucursalId,
        tipo: "entrada_ajuste_manual",
        cantidad: 20,
        motivo: "Carga inicial",
      });
      expect(ajuste.ok).toBe(true);

      const consulta = await consultarStock(owner!, producto.data.productoId, sucursalId);
      expect(consulta.ok).toBe(true);
      if (consulta.ok) expect(consulta.data.cantidadActual).toBe(20);
    });

    it("caso de uso 3: descontarStockVenta reduce cantidad_actual via salida_venta", async () => {
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
        cantidad: 15,
        motivo: "Carga inicial",
      });

      const venta = await descontarStockVenta(owner!, tenantId, {
        productoId,
        sucursalId,
        cantidad: 5,
      });
      expect(venta.ok).toBe(true);
      if (venta.ok) expect(venta.data.cantidadActual).toBe(10);
    });

    it(
      "regla 4 / caso borde 4: bloquea venta sin stock salvo capacidad vender_sin_stock",
      async () => {
        const owner = await identidadRepo.obtenerUsuarioConRolPorId(ownerId);
        const producto = await crearProducto(owner!, tenantId, {
          nombre: "Botella de Agua",
          unidadVenta: "unidad",
          precioVenta: 5,
        });
        if (!producto.ok) throw new Error("setup fallo");
        const productoId = producto.data.productoId;

        await registrarAjusteManualStock(owner!, tenantId, {
          productoId,
          sucursalId,
          tipo: "entrada_ajuste_manual",
          cantidad: 3,
          motivo: "Carga inicial",
        });

        const bloqueada = await descontarStockVenta(owner!, tenantId, {
          productoId,
          sucursalId,
          cantidad: 10,
        });
        expect(bloqueada.ok).toBe(false);

        await db.insert(permisosEspecialesPorUsuario).values({
          usuarioId: ownerId,
          capacidad: "vender_sin_stock",
          habilitado: true,
          creadoPor: ownerId,
        });

        const propietarioConCapacidad = await identidadRepo.obtenerUsuarioConRolPorId(
          ownerId
        );
        const permitida = await descontarStockVenta(propietarioConCapacidad!, tenantId, {
          productoId,
          sucursalId,
          cantidad: 10,
        });
        expect(permitida.ok).toBe(true);
        if (permitida.ok) expect(permitida.data.cantidadActual).toBe(-7);
      },
      20000
    );

    it("registrarAjusteManualStock exige motivo (paralelo a Compra de Ajuste)", async () => {
      const owner = await identidadRepo.obtenerUsuarioConRolPorId(ownerId);
      const producto = await crearProducto(owner!, tenantId, {
        nombre: "Vaso Descartable",
        unidadVenta: "unidad",
        precioVenta: 1,
      });
      if (!producto.ok) throw new Error("setup fallo");
      const productoId = producto.data.productoId;

      const sinMotivo = await registrarAjusteManualStock(owner!, tenantId, {
        productoId,
        sucursalId,
        tipo: "entrada_ajuste_manual",
        cantidad: 10,
        motivo: "   ",
      });
      expect(sinMotivo.ok).toBe(false);

      const conMotivo = await registrarAjusteManualStock(owner!, tenantId, {
        productoId,
        sucursalId,
        tipo: "entrada_ajuste_manual",
        cantidad: 10,
        motivo: "Conteo físico inicial",
      });
      expect(conMotivo.ok).toBe(true);
    });

    it(
      "caso de uso 7: transferencia genera par de movimientos con el mismo referencia_id",
      async () => {
        const owner = await identidadRepo.obtenerUsuarioConRolPorId(ownerId);
        const producto = await crearProducto(owner!, tenantId, {
          nombre: "Bolsa de Hielo",
          unidadVenta: "unidad",
          precioVenta: 12,
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

        const transferencia = await registrarTransferenciaStock(owner!, tenantId, {
          productoId,
          sucursalOrigenId: sucursalId,
          sucursalDestinoId: sucursalDestinoId,
          cantidad: 10,
        });
        expect(transferencia.ok).toBe(true);
        if (transferencia.ok) {
          expect(transferencia.data.cantidadActualOrigen).toBe(20);
          expect(transferencia.data.cantidadActualDestino).toBe(10);
        }

        const movsOrigen = await repo.listarMovimientosStock(productoId, sucursalId);
        const movsDestino = await repo.listarMovimientosStock(
          productoId,
          sucursalDestinoId
        );
        const salida = movsOrigen.find((m) => m.tipo === "salida_transferencia");
        const entrada = movsDestino.find((m) => m.tipo === "entrada_transferencia");
        expect(salida?.referenciaId).toBeTruthy();
        expect(salida?.referenciaId).toBe(entrada?.referenciaId);
      },
      20000
    );

    it("seccion 5: bajo_stock_minimo se activa cuando cantidad_actual <= stock_minimo", async () => {
      const owner = await identidadRepo.obtenerUsuarioConRolPorId(ownerId);
      const producto = await crearProducto(owner!, tenantId, {
        nombre: "Leche Entera 1L",
        unidadVenta: "l",
        precioVenta: 15,
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
      await configurarStockMinimo(owner!, productoId, sucursalId, 10);

      const consulta = await consultarStock(owner!, productoId, sucursalId);
      expect(consulta.ok).toBe(true);
      if (consulta.ok) expect(consulta.data.bajoStockMinimo).toBe(true);
    });

    it("caso borde 1: eliminar producto con stock positivo exige confirmarConStock", async () => {
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
        cantidad: 5,
        motivo: "Carga inicial",
      });

      const sinConfirmar = await eliminarProducto(owner!, productoId);
      expect(sinConfirmar.ok).toBe(false);

      const confirmado = await eliminarProducto(owner!, productoId, {
        confirmarConStock: true,
      });
      expect(confirmado.ok).toBe(true);
    });

    it("regla 2: el costo operativo de un producto de produccion no se edita a mano tras vincularlo", async () => {
      const owner = await identidadRepo.obtenerUsuarioConRolPorId(ownerId);
      const producto = await crearProducto(owner!, tenantId, {
        nombre: "Queso Fresco 500g",
        unidadVenta: "unidad",
        precioVenta: 20,
      });
      if (!producto.ok) throw new Error("setup fallo");
      const productoId = producto.data.productoId;

      const precioActualizado = await actualizarProducto(owner!, productoId, {
        precioVenta: 22,
      });
      expect(precioActualizado.ok).toBe(true);

      const vinculacion = await enviarProductoAOperaciones(owner!, productoId);
      expect(vinculacion.ok).toBe(true);

      const rechazado = await actualizarProducto(owner!, productoId, {
        costoOperativoVigente: 12,
      });
      expect(rechazado.ok).toBe(false);
    });
  }
);
