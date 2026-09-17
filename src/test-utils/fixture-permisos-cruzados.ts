import { randomUUID } from "node:crypto";
import postgres from "postgres";
import { db } from "@/db/client";
import { ROL_OWNER_ID } from "@/modules/identidad/constants";
import * as identidadRepo from "@/modules/identidad/repository";
import type { UsuarioConRol } from "@/modules/identidad/repository";
import { authUsers, permisos, roles, sucursales, tenants, usuarios } from "@/modules/identidad/schema";
import type { accionPermisoEnum, moduloPermisoEnum } from "@/modules/identidad/schema";

type Modulo = (typeof moduloPermisoEnum.enumValues)[number];
type Accion = (typeof accionPermisoEnum.enumValues)[number];

/**
 * Fixture para la familia R-3.2 ("el aviso se calcula y se descarta"): un
 * negocio con su Owner y un **colaborador con permisos a medida**. El
 * disparador real de esa familia es exactamente ése — alguien que puede hacer
 * la operación principal (una compra, una venta, una producción) pero no la
 * consecuencia de stock, que pide `inventario`/`operativo`.
 *
 * Solo para suites gateadas en `DATABASE_URL` que NO necesitan Supabase Auth:
 * `auth.users` se inserta directo (mismo criterio que
 * `proveedores/tenant-aislamiento.test.ts`). **Nunca contra la base de
 * producción** — ver `docs/dev-practices/dev-practices.md` §7.3.
 */
export interface FixturePermisosCruzados {
  tenantId: string;
  sucursalId: string;
  owner: UsuarioConRol;
  colaborador: UsuarioConRol;
  limpiar: () => Promise<void>;
}

export async function crearFixturePermisosCruzados(
  etiqueta: string,
  permisosColaborador: Array<[Modulo, Accion]>
): Promise<FixturePermisosCruzados> {
  const sufijo = `${etiqueta}-${Date.now()}`;
  const ownerId = randomUUID();
  const colaboradorId = randomUUID();
  await db.insert(authUsers).values([{ id: ownerId }, { id: colaboradorId }]);

  const [tenant] = await db
    .insert(tenants)
    .values({
      nombreNegocio: `R-3.2 ${sufijo}`,
      monedaPrincipal: "BOB",
      estadoSuscripcion: "activa",
      fechaInicioSuscripcion: new Date().toISOString().slice(0, 10),
    })
    .returning();
  const [sucursal] = await db
    .insert(sucursales)
    .values({ tenantId: tenant.id, nombre: "Principal", esPrincipal: true })
    .returning();
  const [rol] = await db.insert(roles).values({ tenantId: tenant.id, nombre: `Colaborador ${sufijo}` }).returning();
  if (permisosColaborador.length > 0) {
    await db
      .insert(permisos)
      .values(permisosColaborador.map(([modulo, accion]) => ({ rolId: rol.id, modulo, accion, permitido: true })));
  }
  await db.insert(usuarios).values([
    {
      id: ownerId,
      tenantId: tenant.id,
      rolId: ROL_OWNER_ID,
      nombreCompleto: "Owner R-3.2",
      email: `owner-${sufijo}@ceom-erp.test`,
      esOwner: true,
    },
    {
      id: colaboradorId,
      tenantId: tenant.id,
      rolId: rol.id,
      nombreCompleto: "Colaborador R-3.2",
      email: `colaborador-${sufijo}@ceom-erp.test`,
      esOwner: false,
    },
  ]);

  const owner = await identidadRepo.obtenerUsuarioConRolPorId(ownerId);
  const colaborador = await identidadRepo.obtenerUsuarioConRolPorId(colaboradorId);
  if (!owner || !colaborador) throw new Error("fixture: usuarios no encontrados");

  return {
    tenantId: tenant.id,
    sucursalId: sucursal.id,
    owner,
    colaborador,
    limpiar: () => limpiarTenant(tenant.id, rol.id, [ownerId, colaboradorId]),
  };
}

/** Borra todo lo que las pruebas de R-3.2 pueden crear en el tenant, en orden de FKs. */
async function limpiarTenant(tenantId: string, rolId: string, userIds: string[]) {
  const sql = postgres(process.env.DATABASE_URL!, { max: 1, prepare: false, onnotice: () => {} });
  try {
    await sql.begin(async (t) => {
      const porVenta = `(select id from ventas where tenant_id = '${tenantId}')`;
      const porProducto = `(select id from productos where tenant_id = '${tenantId}')`;
      const porInsumo = `(select id from insumos where tenant_id = '${tenantId}')`;
      const porCompra = `(select id from compras where tenant_id = '${tenantId}')`;
      const porProduccion = `(select id from producciones where tenant_id = '${tenantId}')`;
      const porReceta = `(select id from recetas where tenant_id = '${tenantId}')`;
      for (const stmt of [
        `delete from ajustes_venta where venta_id in ${porVenta}`,
        `delete from pagos_venta where venta_id in ${porVenta}`,
        `delete from detalles_venta where venta_id in ${porVenta}`,
        `delete from gastos where tenant_id = '${tenantId}'`,
        `delete from ventas where tenant_id = '${tenantId}'`,
        `delete from compras_ajuste where compra_id in ${porCompra}`,
        `delete from pagos_compra where compra_id in ${porCompra}`,
        `delete from compras where tenant_id = '${tenantId}'`,
        `delete from producciones_ajuste where produccion_id in ${porProduccion}`,
        `delete from producciones where tenant_id = '${tenantId}'`,
        `delete from vinculaciones_producto_receta where producto_id in ${porProducto}`,
        `delete from receta_insumos where receta_id in ${porReceta}`,
        `delete from recetas where tenant_id = '${tenantId}'`,
        `delete from movimientos_insumo where insumo_id in ${porInsumo}`,
        `delete from stock_insumo where insumo_id in ${porInsumo}`,
        `delete from insumos where tenant_id = '${tenantId}'`,
        `delete from movimientos_stock where producto_id in ${porProducto}`,
        `delete from stock where producto_id in ${porProducto}`,
        `delete from productos where tenant_id = '${tenantId}'`,
        `delete from activos where tenant_id = '${tenantId}'`,
        `delete from canales_venta where tenant_id = '${tenantId}'`,
        `delete from clientes where tenant_id = '${tenantId}'`,
        `delete from categorias_gasto where tenant_id = '${tenantId}'`,
        `delete from usuarios where tenant_id = '${tenantId}'`,
        `delete from permisos where rol_id = '${rolId}'`,
        `delete from roles where id = '${rolId}'`,
        `delete from sucursales where tenant_id = '${tenantId}'`,
        `delete from tenants where id = '${tenantId}'`,
      ]) {
        await t.unsafe(stmt);
      }
      await t`delete from auth.users where id in ${t(userIds)}`;
    });
  } finally {
    await sql.end({ timeout: 5 });
  }
}
