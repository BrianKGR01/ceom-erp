// Aplica scripts/ci/stub-supabase-schemas.sql contra DATABASE_URL usando el
// paquete "postgres" (ya instalado como dependencia del proyecto) en vez de
// invocar el binario "psql" -- evita depender de que psql este presente en
// el runner de CI, algo que no se puede verificar sin iniciar sesion para
// ver los logs de GitHub Actions.
import { readFileSync } from "node:fs";
import postgres from "postgres";

const sql = postgres(process.env.DATABASE_URL, { prepare: false });
const script = readFileSync(new URL("./stub-supabase-schemas.sql", import.meta.url), "utf-8");

try {
  await sql.unsafe(script);
  console.log("Stub de esquemas de Supabase aplicado correctamente.");
} finally {
  await sql.end();
}
