// Bootstrap del primer usuario CEOM Admin — resuelve el candado circular
// documentado en identidad/ANCLA.md: crearTenant() exige un solicitante ya
// logueado como ceom_admin, pero la migracion 0005 solo sembro el ROL
// "CEOM Admin" (catalogo), nunca una fila de usuario real. Sin este script
// no hay forma de entrar a la app como CEOM Admin ni de crear el primer
// tenant, ni manualmente ni por UI.
//
// Corre standalone (no dentro de Next.js) vía `tsx` (devDependency agregada
// para esto — Node nativo no resuelve el alias "@/*" que usa casi todo
// src/modules/**, tsx sí lo hace leyendo tsconfig.json). No reutiliza
// src/lib/supabase/server.ts porque ese archivo importa "next/headers"
// (cookies()), que asume el runtime de Next.js -- se arma un cliente admin
// minimo acá, misma llamada que crearClienteAdmin() usa por dentro.
//
// Uso:
//   pnpm seed:admin <email> ["Nombre completo"]
//
// Que hace:
//   1. Si ya existe una fila en `usuarios` con ese email y rol CEOM Admin,
//      no hace nada (idempotente -- se puede correr mas de una vez sin
//      duplicar).
//   2. Si no existe, invita al usuario por email via el Admin API de
//      Supabase Auth (inviteUserByEmail -- el usuario recibe un correo real
//      para fijar su propia contraseña; este script nunca toca ni ve una
//      contraseña).
//   3. Crea su fila en `usuarios`, tenant CEOM Ops, rol CEOM Admin.

import { createClient } from "@supabase/supabase-js";
import { eq } from "drizzle-orm";
import { client as pgClient, db } from "@/db/client";
import { CEOM_OPS_TENANT_ID, ROL_CEOM_ADMIN_ID } from "@/modules/identidad/constants";
import * as identidadRepo from "@/modules/identidad/repository";
import { usuarios } from "@/modules/identidad/schema";

process.loadEnvFile(".env.local");

async function main() {
  const email = process.argv[2];
  const nombreCompleto = process.argv[3] ?? "CEOM Admin";

  if (!email) {
    console.error('Uso: pnpm seed:admin <email> ["Nombre completo"]');
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

  const yaExiste = await db
    .select({ id: usuarios.id })
    .from(usuarios)
    .where(eq(usuarios.email, email))
    .limit(1);
  if (yaExiste.length > 0) {
    console.log(`Ya existe un usuario con email ${email} — no se hace nada.`);
    return;
  }

  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SECRET_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

  const { data, error } = await admin.auth.admin.inviteUserByEmail(email);
  if (error || !data.user) {
    console.error(
      `No se pudo invitar a ${email}: ${error?.message ?? "error desconocido"}. ` +
        "Si el email ya está registrado en Supabase Auth pero no tiene fila en " +
        "`usuarios`, resolvé ese caso a mano (no es lo que este script espera)."
    );
    process.exitCode = 1;
    return;
  }

  await identidadRepo.insertarUsuario({
    id: data.user.id,
    tenantId: CEOM_OPS_TENANT_ID,
    nombreCompleto,
    email,
    rolId: ROL_CEOM_ADMIN_ID,
    esOwner: false,
    activo: true,
  });

  console.log(
    `Usuario CEOM Admin creado para ${email}. Le llegó un correo de invitación de ` +
      "Supabase para fijar su contraseña — recién después de eso puede loguearse en /login."
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
