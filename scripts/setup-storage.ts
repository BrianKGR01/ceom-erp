// Crea el bucket compartido de Storage ("tenant-uploads") si todavia no
// existe — Drizzle no modela buckets (viven en el sistema de Storage de
// Supabase, no en tablas propias), asi que no hay una migracion que lo
// haga. Las politicas RLS de storage.objects para este bucket si son una
// migracion real (drizzle/migrations/0024_storage_tenant_uploads_rls.sql)
// porque storage.objects es una tabla de Postgres como cualquier otra.
//
// Idempotente: si el bucket ya existe, no hace nada (no lo recrea ni
// pisa su configuracion).
//
// Uso:
//   pnpm storage:setup

import { createClient } from "@supabase/supabase-js";
// Importa solo de storage-config.ts (sin next/headers) — nunca de
// storage.ts, que importa crearClienteServidor y por lo tanto next/headers
// (mismo criterio ya documentado para crearClienteAdmin() en
// docs/dev-practices/dev-practices.md sección 7.1).
import {
  BUCKET_TENANT_UPLOADS,
  TAMANO_MAXIMO_IMAGEN_BYTES,
  TIPOS_IMAGEN_PERMITIDOS,
} from "@/lib/supabase/storage-config";

async function main() {
  for (const variable of ["NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_SECRET_KEY"]) {
    if (!process.env[variable]) {
      console.error(`Falta ${variable} en .env.local — ver .env.example.`);
      process.exitCode = 1;
      return;
    }
  }

  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SECRET_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

  const { data: existentes, error: errorListado } = await admin.storage.listBuckets();
  if (errorListado) {
    console.error(`No se pudo listar los buckets existentes: ${errorListado.message}`);
    process.exitCode = 1;
    return;
  }

  if (existentes.some((b) => b.name === BUCKET_TENANT_UPLOADS)) {
    console.log(`El bucket "${BUCKET_TENANT_UPLOADS}" ya existe — no se hace nada.`);
    return;
  }

  const { error } = await admin.storage.createBucket(BUCKET_TENANT_UPLOADS, {
    public: true,
    fileSizeLimit: TAMANO_MAXIMO_IMAGEN_BYTES,
    allowedMimeTypes: [...TIPOS_IMAGEN_PERMITIDOS],
  });

  if (error) {
    console.error(`No se pudo crear el bucket: ${error.message}`);
    process.exitCode = 1;
    return;
  }

  console.log(
    `Bucket "${BUCKET_TENANT_UPLOADS}" creado (público, imágenes hasta 5MB). ` +
      "Recordá aplicar la migración 0024 (políticas RLS) contra este entorno si todavía no corrió."
  );
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
