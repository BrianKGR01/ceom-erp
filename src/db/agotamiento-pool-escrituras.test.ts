import { randomUUID } from "node:crypto";
import postgres from "postgres";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { client, db } from "@/db/client";
import { ROL_OWNER_ID } from "@/modules/identidad/constants";
import * as identidadRepo from "@/modules/identidad/repository";
import type { UsuarioConRol } from "@/modules/identidad/repository";
import { authUsers, sucursales, tenants, usuarios } from "@/modules/identidad/schema";
import { transferirActivo } from "@/modules/patrimonio/actions";
import { activos } from "@/modules/patrimonio/schema";
import { consultarStock } from "@/modules/productos/actions";
import { productos } from "@/modules/productos/schema";
import { recibirCompra, registrarCompra, registrarCompraDeAjuste } from "@/modules/proveedores/actions";

/**
 * Hermano de `agotamiento-pool.test.ts` para las **escrituras**: el mismo
 * autobloqueo del pool, disparado no por `tienePermiso()` sino por las otras
 * llamadas cruzadas que corrían con la transacción abierta —
 * `dispararEntradaStock` (Productos), `requireSucursalOperable` (Identidad) y
 * `revertirStockDeAjuste` (Productos). En la UI son de a una por clic, así
 * que hace falta concurrencia real para que exploten; con `max + 2`
 * operaciones simultáneas en la misma instancia es determinista.
 *
 * Archivo aparte a propósito: si una de estas vuelve a colgarse, envenena el
 * pool del proceso y no tiene que arrastrar a las pruebas de lectura.
 *
 * Además de "no se colgó", cada caso afirma el efecto con un número que la
 * falla no puede producir (dev-practices §6.1 b): el stock final.
 *
 * **Un producto por operación, a propósito.** Movimientos simultáneos sobre el
 * MISMO producto y sucursal chocan en Productos por un defecto aparte
 * (`recalcularCantidadActualTx` sin lock: DA-45 en docs/deuda-aplazada.md). Este
 * archivo mide el pool, no eso.
 */

const hasPostgres = Boolean(process.env.DATABASE_URL);
const ESPERA_MAXIMA_MS = 20_000;

vi.setConfig({ testTimeout: ESPERA_MAXIMA_MS + 15_000, hookTimeout: 30_000 });

function colgadoTras(ms: number): Promise<"COLGADO"> {
  return new Promise((resolve) => setTimeout(() => resolve("COLGADO"), ms).unref());
}

async function sinColgarse<T>(operaciones: Promise<T>[]): Promise<T[]> {
  const resultado = await Promise.race([Promise.all(operaciones), colgadoTras(ESPERA_MAXIMA_MS)]);
  expect(resultado).not.toBe("COLGADO");
  if (resultado === "COLGADO") throw new Error("inalcanzable");
  return resultado;
}

describe.skipIf(!hasPostgres)("Pool de conexiones — escrituras con llamadas cruzadas no se autobloquean", () => {
  const sufijo = Date.now();
  const cantidad = client.options.max + 2;
  let tenantId: string;
  let ownerId: string;
  let sucursalId: string;
  let sucursalDosId: string;
  const productoIds: string[] = [];
  let owner: UsuarioConRol;
  const compraIds: string[] = [];
  const activoIds: string[] = [];

  const stockTotal = async () => {
    let total = 0;
    for (const productoId of productoIds) {
      const res = await consultarStock(owner, productoId, sucursalId);
      expect(res.ok).toBe(true);
      if (!res.ok) throw new Error("inalcanzable");
      total += res.data.cantidadActual;
    }
    return total;
  };

  beforeAll(async () => {
    ownerId = randomUUID();
    await db.insert(authUsers).values({ id: ownerId });
    const [tenant] = await db
      .insert(tenants)
      .values({
        nombreNegocio: `Agotamiento Pool Escrituras ${sufijo}`,
        monedaPrincipal: "BOB",
        estadoSuscripcion: "activa",
        fechaInicioSuscripcion: new Date().toISOString().slice(0, 10),
      })
      .returning();
    tenantId = tenant.id;
    await db.insert(usuarios).values({
      id: ownerId,
      tenantId,
      rolId: ROL_OWNER_ID,
      nombreCompleto: "Owner Pool Escrituras",
      email: `owner-pool-escrituras-${sufijo}@ceom-erp.test`,
      esOwner: true,
    });
    const [s1, s2] = await db
      .insert(sucursales)
      .values([
        { tenantId, nombre: "Principal", esPrincipal: true },
        { tenantId, nombre: "Segunda", esPrincipal: false },
      ])
      .returning();
    sucursalId = s1.id;
    sucursalDosId = s2.id;
    const filasProductos = await db
      .insert(productos)
      .values(
        Array.from({ length: cantidad }, (_, i) => ({
          tenantId,
          nombre: `Producto pool ${i + 1}`,
          unidadVenta: "unidad" as const,
          precioVenta: "20",
        }))
      )
      .returning();
    productoIds.push(...filasProductos.map((p) => p.id));
    const filasActivos = await db
      .insert(activos)
      .values(
        Array.from({ length: cantidad }, (_, i) => ({
          tenantId,
          sucursalId,
          nombre: `Activo ${i + 1}`,
          tipo: "mobiliario" as const,
          valorCompra: "100",
          fechaAdquisicion: "2026-01-01",
        }))
      )
      .returning();
    activoIds.push(...filasActivos.map((a) => a.id));

    const leido = await identidadRepo.obtenerUsuarioConRolPorId(ownerId);
    if (!leido) throw new Error("fixture: owner no encontrado");
    owner = leido;
  });

  afterAll(async () => {
    // Cliente propio, no `db`: con el pool envenenado, `db` se colgaría acá también.
    const sql = postgres(process.env.DATABASE_URL!, { max: 1, prepare: false, onnotice: () => {} });
    try {
      await sql`delete from movimientos_stock where producto_id in (select id from productos where tenant_id = ${tenantId})`;
      await sql`delete from stock where producto_id in (select id from productos where tenant_id = ${tenantId})`;
      await sql`delete from compras_ajuste where compra_id in (select id from compras where tenant_id = ${tenantId})`;
      await sql`delete from compras where tenant_id = ${tenantId}`;
      await sql`delete from productos where tenant_id = ${tenantId}`;
      await sql`delete from activos where tenant_id = ${tenantId}`;
      await sql`delete from usuarios where id = ${ownerId}`;
      await sql`delete from sucursales where tenant_id = ${tenantId}`;
      await sql`delete from tenants where id = ${tenantId}`;
      await sql`delete from auth.users where id = ${ownerId}`;
    } finally {
      await sql.end({ timeout: 5 });
    }
  });

  it("registrarCompra recibida en paralelo: termina y el stock entra completo", async () => {
    const resultados = await sinColgarse(
      productoIds.map((productoId) =>
        registrarCompra(owner, tenantId, {
          sucursalId,
          tipo: "reventa",
          productoId,
          cantidad: 3,
          montoTotal: 30,
          fechaCompra: "2026-09-17",
        })
      )
    );
    expect(resultados.every((r) => r.ok && r.data.entradaStock?.ok)).toBe(true);
    expect(await stockTotal()).toBe(3 * cantidad);
  });

  it("recibirCompra en paralelo sobre compras en pedido: termina y el stock entra completo", async () => {
    for (const productoId of productoIds) {
      const res = await registrarCompra(owner, tenantId, {
        sucursalId,
        tipo: "reventa",
        productoId,
        cantidad: 2,
        montoTotal: 20,
        fechaCompra: "2026-09-17",
        estado: "pedido",
      });
      expect(res.ok).toBe(true);
      if (!res.ok) throw new Error("inalcanzable");
      compraIds.push(res.data.compraId);
    }
    const antes = await stockTotal();

    const resultados = await sinColgarse(compraIds.map((id) => recibirCompra(owner, id, "2026-09-17")));
    expect(resultados.every((r) => r.ok && r.data.entradaStock.ok)).toBe(true);
    expect(await stockTotal()).toBe(antes + 2 * cantidad);

    // Recibir dos veces sigue rechazado con el estado releído en la transacción que escribe.
    const segunda = await recibirCompra(owner, compraIds[0]);
    expect(segunda).toEqual({ ok: false, error: "Esta compra ya está recibida." });
  });

  it("registrarCompraDeAjuste con devolución en paralelo: termina y el stock baja", async () => {
    expect(compraIds.length).toBe(cantidad);
    const antes = await stockTotal();

    const resultados = await sinColgarse(
      compraIds.map((id) =>
        registrarCompraDeAjuste(owner, id, {
          tipo: "devolucion_a_proveedor",
          montoAjuste: -10,
          motivo: "Devolución pool",
          cantidadDevuelta: 1,
        })
      )
    );
    expect(resultados.every((r) => r.ok && r.data.reversionStock?.devuelta === 1)).toBe(true);
    expect(await stockTotal()).toBe(antes - cantidad);

    // cantidad_devuelta quedó persistida (se escribe en su propia transacción
    // después de revertir): pedir devolver las 2 unidades de nuevo excede lo pendiente.
    const excede = await registrarCompraDeAjuste(owner, compraIds[0], {
      tipo: "devolucion_a_proveedor",
      montoAjuste: -1,
      motivo: "Excede",
      cantidadDevuelta: 2,
    });
    expect(excede).toEqual({
      ok: false,
      error: "No podés devolver 2 unidades: la compra trajo 2 y ya se devolvieron 1.",
    });
  });

  it("transferirActivo en paralelo: termina y todos quedan en la sucursal destino", async () => {
    const resultados = await sinColgarse(activoIds.map((id) => transferirActivo(owner, id, sucursalDosId)));
    expect(resultados.every((r) => r.ok)).toBe(true);

    const sql = postgres(process.env.DATABASE_URL!, { max: 1, prepare: false, onnotice: () => {} });
    try {
      const [fila] = await sql<{ n: number }[]>`
        select count(*)::int as n from activos where tenant_id = ${tenantId} and sucursal_id = ${sucursalDosId}`;
      expect(fila.n).toBe(cantidad);
    } finally {
      await sql.end({ timeout: 5 });
    }
  });
});
