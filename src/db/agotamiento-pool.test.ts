import { randomUUID } from "node:crypto";
import postgres from "postgres";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { client, db } from "@/db/client";
import { ROL_OWNER_ID } from "@/modules/identidad/constants";
import { authUsers, tenants, usuarios } from "@/modules/identidad/schema";
import { fichaPasivo } from "@/modules/patrimonio/actions";
import * as patrimonioRepo from "@/modules/patrimonio/repository";
import { fichaProveedor } from "@/modules/proveedores/actions";
import * as identidadRepo from "@/modules/identidad/repository";
import { proveedores } from "@/modules/proveedores/schema";

/**
 * Incidente del 2026-09-17 (09:44-09:55 hora Bolivia): /app/proveedores de
 * CAFIATTO colgado hasta el `Task timed out after 300 seconds` de Vercel.
 *
 * El mecanismo, completo en proveedores/ANCLA.md: `comoUsuario()` reserva una
 * conexión del pool de postgres-js mientras dura la transacción, y adentro se
 * llamaba a `tienePermiso()` (Identidad, todavía con `db` crudo), que pide
 * OTRA conexión del mismo pool. Con tantas transacciones simultáneas como
 * conexiones tiene el pool —el directorio pedía una `fichaProveedor` por fila
 * en `Promise.all`, y CAFIATTO tenía exactamente 10 proveedores, el `max` por
 * defecto de postgres-js— cada una retiene la suya esperando una que ninguna
 * va a soltar. postgres-js encola sin timeout: no hay error, hay cuelgue.
 *
 * Este test es la reproducción: **falla (se cuelga) con el código anterior al
 * fix y pasa con el fix.** Se corrió en rojo antes de arreglar nada.
 *
 * Por qué N = max + 2 y no 10 fijo: con exactamente `max` transacciones el
 * cuelgue depende de en qué orden se abren las conexiones. Por encima de
 * `max` es determinista. Y leerlo del cliente real hace que el test siga
 * midiendo lo mismo si algún día cambia el tamaño del pool.
 *
 * Por qué la carrera contra un reloj y no un `testTimeout`: si el cuelgue
 * vuelve, el test tiene que decir "COLGADO" en rojo, no morir por timeout sin
 * explicar nada. Y por qué la limpieza usa su propio cliente: con el pool
 * envenenado, un `afterAll` que use `db` se colgaría también.
 */

const hasPostgres = Boolean(process.env.DATABASE_URL);
const ESPERA_MAXIMA_MS = 15_000;

vi.setConfig({ testTimeout: ESPERA_MAXIMA_MS + 10_000, hookTimeout: 30_000 });

function colgadoTras(ms: number): Promise<"COLGADO"> {
  return new Promise((resolve) => setTimeout(() => resolve("COLGADO"), ms).unref());
}

describe.skipIf(!hasPostgres)("Pool de conexiones — comoUsuario() no se autobloquea", () => {
  const sufijo = Date.now();
  const tamanoPool = client.options.max;
  const cantidad = tamanoPool + 2;
  let tenantId: string;
  let ownerId: string;
  let proveedorIds: string[] = [];
  let pasivoIds: string[] = [];

  beforeAll(async () => {
    ownerId = randomUUID();
    await db.insert(authUsers).values({ id: ownerId });
    const [tenant] = await db
      .insert(tenants)
      .values({
        nombreNegocio: `Agotamiento Pool ${sufijo}`,
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
      nombreCompleto: "Owner Agotamiento Pool",
      email: `owner-pool-${sufijo}@ceom-erp.test`,
      esOwner: true,
    });

    const filas = await db
      .insert(proveedores)
      .values(
        Array.from({ length: cantidad }, (_, i) => ({
          tenantId,
          nombre: `Proveedor ${i + 1}`,
          creadoPor: ownerId,
        }))
      )
      .returning();
    proveedorIds = filas.map((p) => p.id);

    for (let i = 0; i < cantidad; i++) {
      const pasivo = await patrimonioRepo.crearPasivo(db, {
        tenantId,
        montoTotal: "1000",
        cuotaPeriodica: "100",
        frecuenciaCuota: "mensual",
        plazoCuotas: 10,
        fechaInicio: "2026-01-01",
        creadoPor: ownerId,
      });
      pasivoIds.push(pasivo.id);
    }
  });

  afterAll(async () => {
    // Cliente propio, no `db`: ver el comentario de arriba.
    const sql = postgres(process.env.DATABASE_URL!, { max: 1, prepare: false, onnotice: () => {} });
    try {
      await sql`delete from pasivos where tenant_id = ${tenantId}`;
      await sql`delete from proveedores where tenant_id = ${tenantId}`;
      await sql`delete from usuarios where id = ${ownerId}`;
      await sql`delete from tenants where id = ${tenantId}`;
      await sql`delete from auth.users where id = ${ownerId}`;
    } finally {
      await sql.end({ timeout: 5 });
    }
  });

  it(`fixture: hay más filas (${cantidad}) que conexiones en el pool (${tamanoPool})`, () => {
    // Sin esto, un pool más grande que la fixture haría pasar el test de abajo
    // sin haber probado nada (dev-practices §6.1 b).
    expect(proveedorIds.length).toBeGreaterThan(tamanoPool);
    expect(pasivoIds.length).toBeGreaterThan(tamanoPool);
  });

  it("fichaProveedor en paralelo, una por proveedor (el directorio de antes), termina", async () => {
    const usuario = await identidadRepo.obtenerUsuarioConRolPorId(ownerId);
    expect(usuario).not.toBeNull();
    const resultado = await Promise.race([
      Promise.all(proveedorIds.map((id) => fichaProveedor(usuario!, id))),
      colgadoTras(ESPERA_MAXIMA_MS),
    ]);

    expect(resultado).not.toBe("COLGADO");
    if (resultado === "COLGADO") throw new Error("inalcanzable");
    expect(resultado.every((r) => r.ok)).toBe(true);
  });

  it("fichaPasivo en paralelo, una por pasivo (Deudas de antes), termina", async () => {
    const usuario = await identidadRepo.obtenerUsuarioConRolPorId(ownerId);
    expect(usuario).not.toBeNull();
    const resultado = await Promise.race([
      Promise.all(pasivoIds.map((id) => fichaPasivo(usuario!, id))),
      colgadoTras(ESPERA_MAXIMA_MS),
    ]);

    expect(resultado).not.toBe("COLGADO");
    if (resultado === "COLGADO") throw new Error("inalcanzable");
    expect(resultado.every((r) => r.ok)).toBe(true);
  });
});
