import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

// No se valida DATABASE_URL al importar este modulo (a proposito: permite
// que tests sin DB configurada -ej. CI sin el secret todavia- hagan
// describe.skipIf sin que el import estatico ya explote). Si falta, la
// primera query real falla con un error de conexion claro.
//
// prepare:false es obligatorio: DATABASE_URL apunta al transaction pooler de
// Supabase (puerto 6543), que no soporta prepared statements entre conexiones
// pooleadas.
const client = postgres(process.env.DATABASE_URL ?? "", { prepare: false });

export const db = drizzle(client);
