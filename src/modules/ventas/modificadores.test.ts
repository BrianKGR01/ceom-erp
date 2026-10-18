import { and, eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { db } from "@/db/client";
import {
  actualizarComposicionReceta,
  crearGrupoModificadores,
  crearInsumo,
  crearModificador,
  crearReceta,
  eliminarModificador,
  registrarEntradaCompraInsumo,
  vincularGrupoModificadoresAProducto,
  vincularProductoAReceta,
} from "@/modules/operativo/nichos/nicho-1/actions";
import { movimientosInsumo, stockInsumo } from "@/modules/operativo/nichos/nicho-1/schema";
import { productos } from "@/modules/productos/schema";
import {
  crearFixturePermisosCruzados,
  type FixturePermisosCruzados,
} from "@/test-utils/fixture-permisos-cruzados";
import { crearCanalVenta, registrarVenta } from "./actions";
import { detallesVenta, detallesVentaModificadores, ventas } from "./schema";

/**
 * Roadmap Cafiatto, Fase 3 — modificadores de producto (leche de almendra, shot
 * extra, "extra caliente") con precio y receta propios, y variantes. Cada caso
 * afirma un numero que la falla no puede producir (dev-practices 6.1 b).
 *
 * Latte: 0,015 kg de cafe (Bs 100/kg) + 0,2 L de leche entera (Bs 8/L) = Bs 3,10.
 *  - Almendra: reemplaza la leche entera por 0,2 L de almendra (Bs 20/L), +Bs 4.
 *  - Shot: agrega 0,009 kg de cafe, +Bs 5.
 */
const hasPostgres = Boolean(process.env.DATABASE_URL);
vi.setConfig({ testTimeout: 40_000, hookTimeout: 60_000 });

describe.skipIf(!hasPostgres)("Ventas — modificadores y variantes (Fase 3)", () => {
  let f: FixturePermisosCruzados;
  let otro: FixturePermisosCruzados;
  let canalVentaId: string;
  let cafeId: string;
  let lecheId: string;
  let almendraId: string;
  let latteId: string;
  let latte16Id: string;
  let medialunaId: string;
  let grupoLecheId: string;
  let enteraId: string;
  let almendraModId: string;
  let soyaModId: string;
  let shotId: string;
  let caliente: string;
  let ajenoId: string;

  const saldo = async (insumoId: string) => {
    const [fila] = await db
      .select({ c: stockInsumo.cantidadActual })
      .from(stockInsumo)
      .where(and(eq(stockInsumo.insumoId, insumoId), eq(stockInsumo.sucursalId, f.sucursalId)));
    return Number(fila?.c ?? 0);
  };
  const cuentaVentas = async () =>
    (await db.select({ id: ventas.id }).from(ventas).where(eq(ventas.tenantId, f.tenantId))).length;
  const lineasDe = (ventaId: string) =>
    db.select().from(detallesVenta).where(eq(detallesVenta.ventaId, ventaId));
  const modsDe = async (detalleId: string) =>
    db.select().from(detallesVentaModificadores).where(eq(detallesVentaModificadores.detalleVentaId, detalleId));

  const ok = <T>(r: { ok: true; data: T } | { ok: false; error: string }): T => {
    if (!r.ok) throw new Error(r.error);
    return r.data;
  };

  async function insumo(nombre: string, unidad: "kg" | "litros", cantidad: number, costo: number) {
    const id = ok(await crearInsumo(f.owner, f.tenantId, { nombre, unidadMedida: unidad })).insumoId;
    ok(
      await registrarEntradaCompraInsumo(f.owner, f.tenantId, {
        insumoId: id,
        sucursalId: f.sucursalId,
        cantidad,
        costoCompra: costo,
      })
    );
    return id;
  }

  async function productoConReceta(nombre: string, precio: string, grupoVariantes?: string, etiquetaVariante?: string) {
    const [p] = await db
      .insert(productos)
      .values({
        tenantId: f.tenantId,
        nombre,
        unidadVenta: "unidad",
        precioVenta: precio,
        grupoVariantes,
        etiquetaVariante,
      })
      .returning();
    const receta = ok(
      await crearReceta(f.owner, f.tenantId, { nombre: `Receta ${nombre}`, rendimientoPorLote: 1, unidadRendimiento: "UND" })
    );
    ok(
      await actualizarComposicionReceta(f.owner, receta.recetaId, [
        { insumoId: cafeId, cantidadPorLote: 0.015 },
        { insumoId: lecheId, cantidadPorLote: 0.2 },
      ])
    );
    ok(
      await vincularProductoAReceta(f.owner, f.tenantId, {
        productoId: p.id,
        recetaId: receta.recetaId,
        cantidadBaseConsumidaPorUnidad: 1,
        modoConsumo: "al_vender",
      })
    );
    return p.id;
  }

  beforeAll(async () => {
    f = await crearFixturePermisosCruzados("modificadores", [
      ["productos", "ver"],
      ["ventas", "ver"],
      ["ventas", "crear"],
    ]);
    otro = await crearFixturePermisosCruzados("modificadores-otro", []);
    canalVentaId = ok(await crearCanalVenta(f.owner, f.tenantId, { nombre: "Local" })).canalVentaId;

    cafeId = await insumo("Café en grano", "kg", 5, 100);
    lecheId = await insumo("Leche entera", "litros", 50, 8);
    almendraId = await insumo("Leche de almendra", "litros", 5, 20);

    latteId = await productoConReceta("Latte 12 oz", "20", "Latte", "12 oz");
    latte16Id = await productoConReceta("Latte 16 oz", "26", "Latte", "16 oz");
    const [medialuna] = await db
      .insert(productos)
      .values({ tenantId: f.tenantId, nombre: "Medialuna", unidadVenta: "unidad", precioVenta: "5" })
      .returning();
    medialunaId = medialuna.id;

    grupoLecheId = ok(await crearGrupoModificadores(f.owner, f.tenantId, { nombre: "Leche", seleccion: "una" })).grupoId;
    enteraId = ok(
      await crearModificador(f.owner, f.tenantId, grupoLecheId, { nombre: "Entera", tipo: "indicacion", esBase: true })
    ).modificadorId;
    almendraModId = ok(
      await crearModificador(f.owner, f.tenantId, grupoLecheId, {
        nombre: "Almendra",
        tipo: "reemplaza",
        precioExtra: 4,
        insumoReemplazadoId: lecheId,
        insumoId: almendraId,
      })
    ).modificadorId;
    soyaModId = ok(
      await crearModificador(f.owner, f.tenantId, grupoLecheId, {
        nombre: "Soya",
        tipo: "reemplaza",
        precioExtra: 3,
        insumoReemplazadoId: lecheId,
        insumoId: almendraId,
      })
    ).modificadorId;

    const grupoExtras = ok(await crearGrupoModificadores(f.owner, f.tenantId, { nombre: "Extras", seleccion: "varias" })).grupoId;
    shotId = ok(
      await crearModificador(f.owner, f.tenantId, grupoExtras, {
        nombre: "Shot",
        tipo: "agrega",
        precioExtra: 5,
        insumoId: cafeId,
        cantidad: 0.009,
      })
    ).modificadorId;
    const grupoInd = ok(await crearGrupoModificadores(f.owner, f.tenantId, { nombre: "Indicaciones", seleccion: "varias" })).grupoId;
    caliente = ok(
      await crearModificador(f.owner, f.tenantId, grupoInd, { nombre: "Extra caliente", tipo: "indicacion" })
    ).modificadorId;

    for (const g of [grupoLecheId, grupoExtras, grupoInd]) {
      ok(await vincularGrupoModificadoresAProducto(f.owner, f.tenantId, latteId, g));
    }

    // Un modificador de OTRO negocio.
    const grupoAjeno = ok(await crearGrupoModificadores(otro.owner, otro.tenantId, { nombre: "Ajeno", seleccion: "varias" })).grupoId;
    ajenoId = ok(
      await crearModificador(otro.owner, otro.tenantId, grupoAjeno, { nombre: "Indicación ajena", tipo: "indicacion" })
    ).modificadorId;
  });

  afterAll(async () => {
    await f?.limpiar();
    await otro?.limpiar();
  });

  const vender = (
    usuario: FixturePermisosCruzados["owner"],
    lineas: Array<{ productoId: string; cantidad: number; modificadorIds?: string[]; observacion?: string }>
  ) => registrarVenta(usuario, f.tenantId, { sucursalId: f.sucursalId, canalVentaId, lineas });

  it("almendra + shot: suma el precio, cambia la receta, congela todo y descuenta lo correcto", async () => {
    const [cafeAntes, lecheAntes, almendraAntes] = await Promise.all([saldo(cafeId), saldo(lecheId), saldo(almendraId)]);

    const res = ok(await vender(f.owner, [{ productoId: latteId, cantidad: 2, modificadorIds: [almendraModId, shotId] }]));

    // 20 + 4 + 5 = 29 por unidad -> 58 las dos.
    expect(res.totalVenta).toBeCloseTo(58, 2);
    const [linea] = await lineasDe(res.ventaId);
    expect(Number(linea.precioVentaSnapshot)).toBeCloseTo(29, 2);
    expect(Number(linea.subtotal)).toBeCloseTo(58, 2);
    // Costo por unidad: cafe (0,015 + 0,009) x 100 = 2,4 + almendra 0,2 x 20 = 4 -> 6,4. La leche entera ya no.
    expect(Number(linea.costoUnitarioSnapshot)).toBeCloseTo(6.4, 4);
    expect(linea.costoDesconocido).toBe(false);

    // Inventario: leche entera NO se toca, almendra 0,4, cafe 2 x 0,024 = 0,048.
    expect(lecheAntes - (await saldo(lecheId))).toBeCloseTo(0, 4);
    expect(almendraAntes - (await saldo(almendraId))).toBeCloseTo(0.4, 4);
    expect(cafeAntes - (await saldo(cafeId))).toBeCloseTo(0.048, 4);

    // Snapshot de los modificadores: precio y efecto en la receta, por unidad.
    const mods = await modsDe(linea.id);
    expect(mods.map((m) => m.nombre).sort()).toEqual(["Almendra", "Shot"]);
    const shot = mods.find((m) => m.nombre === "Shot")!;
    expect(Number(shot.precioExtra)).toBe(5);
    expect(shot.efectoReceta).toEqual([
      expect.objectContaining({ insumoId: cafeId, cantidad: 0.009 }),
    ]);
    const almendra = mods.find((m) => m.nombre === "Almendra")!;
    expect(almendra.grupoNombre).toBe("Leche");
    expect(almendra.efectoReceta).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ insumoId: lecheId, cantidad: -0.2 }),
        expect.objectContaining({ insumoId: almendraId, cantidad: 0.2 }),
      ])
    );
  });

  it("dos lattes de la misma venta con modificadores distintos consumen y cuestan distinto", async () => {
    const lecheAntes = await saldo(lecheId);
    const almendraAntes = await saldo(almendraId);

    const res = ok(
      await vender(f.owner, [
        { productoId: latteId, cantidad: 1 },
        { productoId: latteId, cantidad: 1, modificadorIds: [almendraModId] },
      ])
    );

    const [simple, conAlmendra] = await lineasDe(res.ventaId).then((ls) =>
      ls.sort((a, b) => Number(a.precioVentaSnapshot) - Number(b.precioVentaSnapshot))
    );
    expect(Number(simple.precioVentaSnapshot)).toBe(20);
    expect(Number(simple.costoUnitarioSnapshot)).toBeCloseTo(3.1, 4);
    expect(Number(conAlmendra.precioVentaSnapshot)).toBe(24);
    expect(Number(conAlmendra.costoUnitarioSnapshot)).toBeCloseTo(0.015 * 100 + 0.2 * 20, 4);
    // La entera la gasta solo el primero; la almendra solo el segundo.
    expect(lecheAntes - (await saldo(lecheId))).toBeCloseTo(0.2, 4);
    expect(almendraAntes - (await saldo(almendraId))).toBeCloseTo(0.2, 4);
  });

  it("la opción base elegida expresamente no cambia nada ni se registra", async () => {
    const res = ok(await vender(f.owner, [{ productoId: latteId, cantidad: 1, modificadorIds: [enteraId] }]));
    const [linea] = await lineasDe(res.ventaId);
    expect(Number(linea.precioVentaSnapshot)).toBe(20);
    expect(await modsDe(linea.id)).toHaveLength(0);
  });

  it("una indicación se guarda pero no mueve precio ni inventario; la observación de la caja también", async () => {
    const cafeAntes = await saldo(cafeId);
    const res = ok(
      await vender(f.owner, [
        { productoId: latteId, cantidad: 1, modificadorIds: [caliente], observacion: "  Para llevar  " },
      ])
    );
    const [linea] = await lineasDe(res.ventaId);
    expect(Number(linea.precioVentaSnapshot)).toBe(20);
    expect(linea.observacion).toBe("Para llevar");
    const [mod] = await modsDe(linea.id);
    expect(mod).toMatchObject({ nombre: "Extra caliente", tipo: "indicacion" });
    expect(mod.efectoReceta).toEqual([]);
    expect(cafeAntes - (await saldo(cafeId))).toBeCloseTo(0.015, 4); // solo la receta base
  });

  it("un grupo de 'elige 1' rechaza dos opciones, y no se crea nada", async () => {
    const antes = await cuentaVentas();
    const res = await vender(f.owner, [{ productoId: latteId, cantidad: 1, modificadorIds: [almendraModId, soyaModId] }]);
    expect(res).toEqual({ ok: false, error: 'Del grupo "Leche" solo se puede elegir una opción.' });
    expect(await cuentaVentas()).toBe(antes);
  });

  it("un modificador de otro producto o de otro negocio no vale", async () => {
    const antes = await cuentaVentas();
    const mensaje = "Un modificador elegido no está disponible para este producto.";
    // Latte 16 oz no tiene grupos vinculados.
    expect(await vender(f.owner, [{ productoId: latte16Id, cantidad: 1, modificadorIds: [shotId] }])).toEqual({
      ok: false,
      error: mensaje,
    });
    // Un modificador que existe, pero en otro negocio.
    expect(await vender(f.owner, [{ productoId: latteId, cantidad: 1, modificadorIds: [ajenoId] }])).toEqual({
      ok: false,
      error: mensaje,
    });
    expect(await cuentaVentas()).toBe(antes);
  });

  it("un modificador que cambia la receta no vale en un producto que no se prepara al vender", async () => {
    ok(await vincularGrupoModificadoresAProducto(f.owner, f.tenantId, medialunaId, (await grupoDeShot())));
    const res = await vender(f.owner, [{ productoId: medialunaId, cantidad: 1, modificadorIds: [shotId] }]);
    expect(res).toEqual({
      ok: false,
      error: '"Shot" cambia la receta, pero este producto no se prepara al vender.',
    });
  });

  async function grupoDeShot() {
    const { modificadores } = await import("@/modules/operativo/nichos/nicho-1/schema");
    const [m] = await db.select().from(modificadores).where(eq(modificadores.id, shotId));
    return m.grupoId;
  }

  it("sin stock del insumo que entra por un modificador, y sin vender_sin_stock, la venta se rechaza entera", async () => {
    const antes = await cuentaVentas();
    const almendraAntes = await saldo(almendraId);
    // 100 lattes con almendra = 20 L; hay menos de 5.
    const res = await vender(f.colaborador, [{ productoId: latteId, cantidad: 100, modificadorIds: [almendraModId] }]);
    expect(res.ok).toBe(false);
    if (res.ok) throw new Error("inalcanzable");
    expect(res.error).toMatch(/^Insumo insuficiente \("/);
    expect(await cuentaVentas()).toBe(antes);
    expect(await saldo(almendraId)).toBe(almendraAntes);
  });

  it("editar o borrar un modificador después no toca lo ya vendido, y ya no se puede usar", async () => {
    const res = ok(await vender(f.owner, [{ productoId: latteId, cantidad: 1, modificadorIds: [shotId] }]));
    const [linea] = await lineasDe(res.ventaId);

    ok(await eliminarModificador(f.owner, shotId));

    const [mod] = await modsDe(linea.id);
    expect(mod).toMatchObject({ nombre: "Shot" });
    expect(Number(mod.precioExtra)).toBe(5);
    const denuevo = await vender(f.owner, [{ productoId: latteId, cantidad: 1, modificadorIds: [shotId] }]);
    expect(denuevo.ok).toBe(false);
  });

  it("el movimiento de inventario por modificadores queda atado a la venta", async () => {
    const res = ok(await vender(f.owner, [{ productoId: latteId, cantidad: 1, modificadorIds: [almendraModId] }]));
    const movs = await db.select().from(movimientosInsumo).where(eq(movimientosInsumo.referenciaId, res.ventaId));
    expect(movs.every((m) => m.tipo === "salida_venta")).toBe(true);
    // cafe + almendra (la leche entera no sale).
    expect(movs.map((m) => m.insumoId).sort()).toEqual([cafeId, almendraId].sort());
  });

  describe("definición de modificadores: la forma depende del tipo", () => {
    const crear = (grupo: string, datos: Parameters<typeof crearModificador>[3]) =>
      crearModificador(f.owner, f.tenantId, grupo, datos);

    it("rechaza las formas inválidas", async () => {
      expect(await crear(grupoLecheId, { nombre: "X", tipo: "agrega" })).toEqual({
        ok: false,
        error: "Elegí el insumo que se agrega.",
      });
      expect(await crear(grupoLecheId, { nombre: "X", tipo: "agrega", insumoId: cafeId })).toEqual({
        ok: false,
        error: "Indicá cuánto del insumo se agrega (mayor a 0).",
      });
      expect(await crear(grupoLecheId, { nombre: "X", tipo: "reemplaza" })).toEqual({
        ok: false,
        error: "Elegí el insumo de la receta que se reemplaza.",
      });
      expect(await crear(grupoLecheId, { nombre: "X", tipo: "indicacion", precioExtra: 2 })).toEqual({
        ok: false,
        error: "Una indicación no puede cambiar el precio.",
      });
      expect(await crear(grupoLecheId, { nombre: "X", tipo: "indicacion", insumoId: cafeId })).toEqual({
        ok: false,
        error: "Una indicación es solo texto: no lleva insumos.",
      });
      expect(await crear(grupoLecheId, { nombre: "Otra base", tipo: "indicacion", esBase: true })).toEqual({
        ok: false,
        error: "Este grupo ya tiene una opción por defecto.",
      });
      expect(await crear(grupoLecheId, { nombre: "X", tipo: "agrega", insumoId: cafeId, cantidad: 1, precioExtra: -1 })).toEqual({
        ok: false,
        error: "El precio extra no puede ser negativo.",
      });
    });

    it("no acepta un insumo de otro negocio", async () => {
      const ajeno = ok(await crearInsumo(otro.owner, otro.tenantId, { nombre: "Insumo ajeno", unidadMedida: "kg" })).insumoId;
      expect(await crear(grupoLecheId, { nombre: "X", tipo: "agrega", insumoId: ajeno, cantidad: 1 })).toEqual({
        ok: false,
        error: "Insumo no encontrado.",
      });
    });

    it("un 'reemplaza' de un insumo que la receta no usa se rechaza al vender", async () => {
      const grupo = ok(await crearGrupoModificadores(f.owner, f.tenantId, { nombre: "Raro", seleccion: "varias" })).grupoId;
      const raro = ok(
        await crear(grupo, { nombre: "Cambiar almendra", tipo: "reemplaza", insumoReemplazadoId: almendraId })
      ).modificadorId;
      ok(await vincularGrupoModificadoresAProducto(f.owner, f.tenantId, latteId, grupo));
      const res = await vender(f.owner, [{ productoId: latteId, cantidad: 1, modificadorIds: [raro] }]);
      expect(res).toEqual({
        ok: false,
        error: 'La receta de este producto no usa el insumo que "Cambiar almendra" reemplaza.',
      });
    });
  });

  it("variantes: cada una es un producto con su propio precio y receta, agrupadas por nombre", async () => {
    const cafeAntes = await saldo(cafeId);
    const res = ok(await vender(f.owner, [{ productoId: latte16Id, cantidad: 1 }]));
    const [linea] = await lineasDe(res.ventaId);
    expect(linea.productoId).toBe(latte16Id);
    expect(Number(linea.precioVentaSnapshot)).toBe(26);
    expect(cafeAntes - (await saldo(cafeId))).toBeCloseTo(0.015, 4);

    const filas = await db
      .select({ nombre: productos.nombre, grupo: productos.grupoVariantes, etiqueta: productos.etiquetaVariante })
      .from(productos)
      .where(and(eq(productos.tenantId, f.tenantId), eq(productos.grupoVariantes, "Latte")));
    expect(filas.map((x) => x.etiqueta).sort()).toEqual(["12 oz", "16 oz"]);
  });
});
