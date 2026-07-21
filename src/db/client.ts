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

// Exportado para scripts standalone (ej. scripts/seed-admin.ts) que no
// corren dentro del ciclo de vida de Next.js/Vitest y necesitan cerrar la
// conexion explicitamente al terminar (`await client.end()`) — si no, el
// proceso de Node queda colgado. El resto del código (Server Actions,
// tests) sigue usando solo `db`, nunca necesitó cerrar esto a mano.
export { client };

// Backstop de RLS (docs/security/PLAN-RLS-BACKSTOP.md): `db` corre siempre
// como el rol dueño de las tablas (bypassea RLS por completo, ver
// src/db/rls.ts). Para un módulo ya migrado a `src/db/contexto.ts`
// (comoUsuario/comoCeomAdmin/comoInstitucion/comoSistema), importar `db`
// directamente en su repository.ts es exactamente el bug que ese mecanismo
// existe para prevenir — src/db/contexto.test.ts lo hace cumplir por AST
// para la lista de módulos ya migrados. Este export se elimina recién en la
// Etapa 6 del plan, cuando ya no quede ningún módulo sin migrar.
