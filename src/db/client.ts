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
//
// Tamaño y timeouts explícitos desde el incidente de pool del 2026-09-17
// (proveedores/ANCLA.md). Ninguno de estos evita el autobloqueo de ese
// incidente —eso se evita no llamando a `db` desde adentro de una transacción
// de `comoUsuario()`, y lo hace cumplir src/db/sin-db-crudo-en-transaccion.test.ts—:
// - `max: 10` es el default de postgres-js, escrito para que se vea. Los
//   tests de src/db/agotamiento-pool*.test.ts lo leen de acá: si cambia,
//   siguen probando lo mismo.
// - `idle_timeout`: con Fluid Compute una instancia vive entre requests;
//   cerrar conexiones ociosas devuelve clientes al pooler de Supavisor, que
//   es compartido entre todas las instancias.
// - `connect_timeout`: si el pooler no acepta la conexión, fallar en 10 s y
//   no en los 30 s por defecto.
// Lo que NO hay, a propósito: timeouts de transacción ociosa. Se probó y se
// descartó — ver "Topes evaluados" en proveedores/ANCLA.md.
const client = postgres(process.env.DATABASE_URL ?? "", {
  prepare: false,
  max: 10,
  idle_timeout: 20,
  connect_timeout: 10,
});

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
