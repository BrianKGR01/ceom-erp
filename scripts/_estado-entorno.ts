import { sql } from "drizzle-orm";
import { db } from "@/db/client";
// Importados, NO copiados como literal: el primer intento de este archivo los
// escribió a mano y quedaron mal, así que reportaba "no hay ningún ceom_admin"
// sobre un entorno completo. Un chequeo de estado que miente es peor que no
// tenerlo — habría mandado a alguien a re-sembrar algo que ya estaba.
import { CEOM_OPS_TENANT_ID, ROL_CEOM_ADMIN_ID } from "@/modules/identidad/constants";
import { BUCKET_TENANT_UPLOADS } from "@/lib/supabase/storage-config";

/**
 * Qué le falta al entorno para estar completo, medido contra la base.
 *
 * **Por qué existe.** El orden de bootstrap (`seed:admin` → `seed:tenant` →
 * `seed:demo` → `seed:instituciones`) estaba escrito en
 * `docs/dev-practices/dev-practices.md` §7.1, y un orden escrito en un
 * documento es una garantía que se puede olvidar — que es justo lo que este
 * proyecto no acepta en ningún otro lado. El caso concreto: alguien corre
 * `pnpm seed:demo`, ve "listo", y trabaja durante días contra un entorno sin
 * una sola institución. Es exactamente el punto ciego que la Etapa 3
 * documentó, con otra ropa.
 *
 * **Por qué esto y no encadenar los comandos.** `seed:demo` puebla UN tenant
 * que ya existe y recibe el correo de su Owner; `seed:instituciones` CREA
 * cuatro tenants y recibe el de un `ceom_admin`. Encadenarlos haría que pedir
 * "poblá este negocio" cree cuatro negocios más — peor que tener que correr
 * un comando de más. Así que ninguno llama al otro: **cada uno termina
 * diciendo la verdad sobre el estado del entorno**, con lo cual el orden deja
 * de depender de que alguien lo recuerde.
 */
export async function informarEstadoDelEntorno(): Promise<void> {
  // El bucket de Storage se chequea aparte porque NO es una tabla de negocio:
  // vive en `storage.buckets`, lo crea `pnpm storage:setup` y **ninguna
  // migración lo crea** (Drizzle no modela buckets). Pero las policies de
  // `storage.objects` para ese bucket SÍ son migración real (`0024`), y esa
  // asimetría es justamente la trampa: en un proyecto nuevo, tras `migrate`
  // las policies existen y el bucket no, así que toda subida de imagen falla
  // con un error de Storage que no menciona nada de esto. Hallazgo 🔴 de
  // docs/auditoria-prelanzamiento/09-arranque-desde-cero.md §3.
  const [bucket] = (await db.execute(sql`
    select count(*) as existe from storage.buckets where id = ${BUCKET_TENANT_UPLOADS}
  `)) as unknown as Array<{ existe: number }>;

  const [fila] = (await db.execute(sql`
    select
      (select count(*) from usuarios u
        where u.rol_id = ${ROL_CEOM_ADMIN_ID}::uuid and u.activo and u.eliminado_en is null) as admins,
      (select count(*) from tenants t
        where t.eliminado_en is null and t.id <> ${CEOM_OPS_TENANT_ID}::uuid) as negocios,
      (select count(*) from productos) as productos,
      (select count(*) from instituciones where eliminado_en is null) as instituciones,
      (select count(*) from codigos_acceso) as codigos
  `)) as unknown as Array<{
    admins: number;
    negocios: number;
    productos: number;
    instituciones: number;
    codigos: number;
  }>;

  const faltantes: string[] = [];
  if (Number(fila.admins) === 0)
    faltantes.push("  1. pnpm seed:admin <email>                    ← no hay ningún ceom_admin");
  if (Number(bucket.existe) === 0)
    faltantes.push(
      `  2. pnpm storage:setup                         ← falta el bucket "${BUCKET_TENANT_UPLOADS}"\n` +
        "     (ninguna migración lo crea, pero las policies de storage.objects SÍ:\n" +
        "      sin él, toda subida de imagen falla y el error no menciona el bucket)"
    );
  if (Number(fila.negocios) === 0)
    faltantes.push("  3. pnpm seed:tenant <admin> <negocio> …       ← no hay ningún negocio");
  if (Number(fila.productos) === 0)
    faltantes.push("  4. pnpm seed:demo [emailOwner]                ← ningún negocio tiene datos");
  if (Number(fila.instituciones) === 0)
    faltantes.push("  5. pnpm seed:instituciones <admin>            ← no hay NINGUNA institución");

  if (faltantes.length === 0) {
    console.log(
      `\n✅ Entorno completo: ${fila.admins} admin(s), ${fila.negocios} negocio(s), ` +
        `${fila.instituciones} institución(es), ${fila.codigos} código(s) de acceso, ` +
        `bucket "${BUCKET_TENANT_UPLOADS}" creado.`
    );
    return;
  }

  console.log(
    `\n⚠️  ENTORNO INCOMPLETO — falta correr:\n\n${faltantes.join("\n")}\n\n` +
      "   Sin esos pasos hay superficies del producto que no se pueden verificar\n" +
      "   porque el escenario que las expone no existe. Orden completo y por qué:\n" +
      "   docs/dev-practices/dev-practices.md §7.1.\n"
  );
}
