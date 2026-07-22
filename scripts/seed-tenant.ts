// Bootstrap del primer tenant — desbloquea probar el backend ya construido
// (Ventas, Productos, Financiero, etc.) con datos reales sin esperar a que
// exista una UI de alta de tenant. Requiere que ya haya un usuario
// ceom_admin real (ver scripts/seed-admin.ts) — crearTenant() exige un
// solicitante logueado con ese rol.
//
// A diferencia de seed-admin.ts, este script SÍ reutiliza
// identidad/actions.ts (crearTenant() real, el mismo camino que va a usar
// la futura UI de alta de tenant) — se confirmó que importar ese archivo
// no rompe fuera de Next.js porque crearTenant() nunca invoca
// cookies()/crearClienteServidor() internamente, solo crearClienteAdmin().
//
// Uso:
//   pnpm seed:tenant <emailCeomAdmin> <nombreNegocio> <emailOwner> <nombreOwner> [moneda=BOB]
//
// Ejemplo:
//   pnpm seed:tenant admin@ceom.lat "SanttiCampo" owner@ceom-erp.test "Nombre Owner" BOB

import { eq } from "drizzle-orm";
import { client as pgClient, db } from "@/db/client";
import { sembrarCategoriasGastoDefault } from "@/modules/gastos/actions";
import { crearTenant } from "@/modules/identidad/actions";
import { ROL_CEOM_ADMIN_ID } from "@/modules/identidad/constants";
import { roles, usuarios } from "@/modules/identidad/schema";

// El env se carga con `node --env-file=.env.local` (ver "seed:tenant" en
// package.json) — ver el comentario equivalente en seed-admin.ts sobre por
// qué `process.loadEnvFile()` acá abajo no funciona (imports hoisteados).

async function main() {
  const [emailCeomAdmin, nombreNegocio, emailOwner, nombreOwner, moneda = "BOB"] =
    process.argv.slice(2);

  if (!emailCeomAdmin || !nombreNegocio || !emailOwner || !nombreOwner) {
    console.error(
      'Uso: pnpm seed:tenant <emailCeomAdmin> <nombreNegocio> <emailOwner> <"nombreOwner"> [moneda=BOB]'
    );
    process.exitCode = 1;
    return;
  }

  for (const variable of ["NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_SECRET_KEY", "DATABASE_URL"]) {
    if (!process.env[variable]) {
      console.error(`Falta ${variable} en .env.local — ver .env.example.`);
      process.exitCode = 1;
      return;
    }
  }

  const filas = await db
    .select({ usuario: usuarios, rol: roles })
    .from(usuarios)
    .innerJoin(roles, eq(usuarios.rolId, roles.id))
    .where(eq(usuarios.email, emailCeomAdmin))
    .limit(1);
  const fila = filas[0];
  if (!fila) {
    console.error(
      `No existe un usuario con email ${emailCeomAdmin} — corré primero \`pnpm seed:admin ${emailCeomAdmin}\`.`
    );
    process.exitCode = 1;
    return;
  }
  if (fila.usuario.rolId !== ROL_CEOM_ADMIN_ID) {
    console.error(`${emailCeomAdmin} existe pero no tiene rol CEOM Admin.`);
    process.exitCode = 1;
    return;
  }

  const resultado = await crearTenant(
    { ...fila.usuario, rol: fila.rol },
    {
      nombreNegocio,
      monedaPrincipal: moneda,
      fechaInicioSuscripcion: new Date().toISOString().slice(0, 10),
      ownerEmail: emailOwner,
      ownerNombreCompleto: nombreOwner,
    }
  );

  if (!resultado.ok) {
    console.error(`No se pudo crear el tenant: ${resultado.error}`);
    process.exitCode = 1;
    return;
  }

  // DA-01: mismo paso que hace el alta real desde /admin/tenants/nuevo
  // (app/admin/(shell)/tenants/actions.ts). Se repite acá a proposito: este
  // script llama a crearTenant() directo, sin pasar por esa Server Action,
  // y sin esto un tenant sembrado arrancaria distinto a uno real.
  const siembra = await sembrarCategoriasGastoDefault(
    { ...fila.usuario, rol: fila.rol },
    resultado.data.tenantId
  );
  if (!siembra.ok) {
    console.error(`No se pudieron sembrar las categorias de gasto default: ${siembra.error}`);
    process.exitCode = 1;
    return;
  }

  console.log(`Tenant creado: ${resultado.data.tenantId}`);
  console.log(`Sucursal principal: ${resultado.data.sucursalId}`);
  console.log(`Categorias de gasto default: ${siembra.data.categoriaIds.length}`);
  console.log(
    `Owner invitado (${emailOwner}) — le llegó un correo de Supabase para fijar su contraseña.`
  );
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pgClient.end();
  });
