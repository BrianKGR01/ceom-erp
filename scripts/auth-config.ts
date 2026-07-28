// Lee la configuración de Supabase Auth del proyecto (incluidas las 4
// plantillas de correo) y la guarda como snapshot versionable en
// `docs/production/auth-config.snapshot.json`.
//
// **Por qué existe.** `docs/auditoria-prelanzamiento/09-arranque-desde-cero.md`
// §3.1 documentó 13 piezas de configuración del proyecto de Supabase que no
// viven en el repo y que un `clone` + `migrate` + `seed` no reproduce. Las dos
// plantillas de correo son la peor: sin ellas, el Owner de un negocio recién
// creado **no puede fijar contraseña nunca** y el negocio queda congelado desde
// el alta, sin que nada falle del lado de la app.
//
// El problema más profundo no es que falten: es que **hoy no hay forma de
// mirarlas desde el repo**. Si el proyecto de Supabase desaparece, desaparece
// con él el único artefacto probado. Este script convierte "andá al dashboard y
// copiá a mano" en un comando, y el resultado en un archivo que se commitea y
// se diffea.
//
// Uso:
//   SUPABASE_ACCESS_TOKEN=sbp_xxx pnpm auth:config            # imprime y guarda
//   SUPABASE_ACCESS_TOKEN=sbp_xxx pnpm auth:config --check    # solo compara, no escribe
//
// El token sale de https://supabase.com/dashboard/account/tokens (Personal
// Access Token). NO es la service-role key ni la publishable: la Management API
// es otra superficie. Deliberadamente NO se lee de `.env.local` — es una
// credencial de cuenta, no de proyecto, y no debería vivir con las del runtime.

import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const SNAPSHOT = path.join("docs", "production", "auth-config.snapshot.json");

/**
 * Los campos que interesan del endpoint `GET /v1/projects/{ref}/config/auth`.
 *
 * Lista explícita y no "todo lo que devuelva": la respuesta incluye secretos
 * (contraseña del SMTP, secretos de OAuth) que **no** pueden entrar a un
 * archivo versionado. Un `JSON.stringify` de la respuesta completa filtraría
 * la credencial de Resend al repo.
 */
const CAMPOS = [
  // Las 4 plantillas: las 2 que hay que personalizar y las 2 que NO se tocan.
  "mailer_templates_invite_content",
  "mailer_templates_recovery_content",
  "mailer_templates_confirmation_content",
  "mailer_templates_magic_link_content",
  "mailer_subjects_invite",
  "mailer_subjects_recovery",
  "mailer_subjects_confirmation",
  "mailer_subjects_magic_link",
  // URL configuration.
  "site_url",
  "uri_allow_list",
  // Los toggles del inventario §3.1.
  "disable_signup",
  "password_hibp_enabled",
  "password_min_length",
  "mailer_autoconfirm",
  "mailer_otp_exp",
  // SMTP: host/puerto/remitente sí, contraseña NO.
  "smtp_host",
  "smtp_port",
  "smtp_admin_email",
  "smtp_sender_name",
  // Rate limits.
  "rate_limit_email_sent",
  "rate_limit_otp",
  "rate_limit_verify",
  "rate_limit_token_refresh",
] as const;

async function main() {
  const token = process.env.SUPABASE_ACCESS_TOKEN;
  const soloChequear = process.argv.includes("--check");

  // El project-ref sale de la URL del proyecto, que sí está en .env.local.
  try {
    process.loadEnvFile(".env.local");
  } catch {
    /* en CI no existe */
  }
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const ref = url?.match(/https:\/\/([a-z0-9]+)\.supabase\.co/)?.[1];

  if (!ref) {
    console.error("No pude deducir el project-ref de NEXT_PUBLIC_SUPABASE_URL.");
    process.exitCode = 1;
    return;
  }
  if (!token) {
    console.error(
      "Falta SUPABASE_ACCESS_TOKEN (Personal Access Token de la cuenta, no la\n" +
        "service-role key). Se saca de https://supabase.com/dashboard/account/tokens\n\n" +
        "  SUPABASE_ACCESS_TOKEN=sbp_xxx pnpm auth:config\n\n" +
        "Sin él, la configuración de Auth de este proyecto NO se puede leer desde el\n" +
        "repo — que es exactamente el problema que este script existe para cerrar\n" +
        "(docs/auditoria-prelanzamiento/09-arranque-desde-cero.md §3.1)."
    );
    process.exitCode = 1;
    return;
  }

  const res = await fetch(`https://api.supabase.com/v1/projects/${ref}/config/auth`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    console.error(`Management API devolvió ${res.status}: ${await res.text()}`);
    process.exitCode = 1;
    return;
  }
  const completo = (await res.json()) as Record<string, unknown>;

  const snapshot: Record<string, unknown> = { _proyecto: ref };
  for (const campo of CAMPOS) snapshot[campo] = completo[campo] ?? null;

  const nuevo = JSON.stringify(snapshot, null, 2) + "\n";

  if (soloChequear) {
    let anterior: string;
    try {
      anterior = readFileSync(SNAPSHOT, "utf8");
    } catch {
      console.error(`No existe ${SNAPSHOT} — corré sin --check para crearlo.`);
      process.exitCode = 1;
      return;
    }
    if (anterior === nuevo) {
      console.log(`✅ La configuración de Auth del proyecto coincide con ${SNAPSHOT}.`);
      return;
    }
    console.error(
      `⚠️  La configuración de Auth del proyecto DIFIERE de ${SNAPSHOT}.\n` +
        "Alguien la cambió en el dashboard sin actualizar el snapshot, o el snapshot\n" +
        "es de otro proyecto. Corré sin --check para ver el diff en git."
    );
    process.exitCode = 1;
    return;
  }

  writeFileSync(SNAPSHOT, nuevo, "utf8");
  console.log(`✅ Snapshot guardado en ${SNAPSHOT} (${CAMPOS.length} campos).\n`);

  // Lo que de verdad importa mirar, resumido — el resto está en el archivo.
  const plantillaInvite = String(snapshot.mailer_templates_invite_content ?? "");
  const plantillaRecovery = String(snapshot.mailer_templates_recovery_content ?? "");
  const usaTokenHash = (t: string) => t.includes("token_hash");
  const vacia = (t: string) => t.trim() === "";

  console.log("PLANTILLAS (lo que decide si el alta de un negocio funciona):");
  for (const [nombre, cuerpo, debeUsarTokenHash] of [
    ["Invite user", plantillaInvite, true],
    ["Reset password", plantillaRecovery, true],
    ["Confirm signup", String(snapshot.mailer_templates_confirmation_content ?? ""), false],
    ["Magic Link", String(snapshot.mailer_templates_magic_link_content ?? ""), false],
  ] as const) {
    const estado = vacia(cuerpo)
      ? "POR DEFECTO (vacía = usa la de fábrica)"
      : usaTokenHash(cuerpo)
        ? "personalizada, con token_hash"
        : "personalizada, SIN token_hash";
    const ok = vacia(cuerpo) ? !debeUsarTokenHash : usaTokenHash(cuerpo) === debeUsarTokenHash;
    console.log(`  ${ok ? "✅" : "❌"} ${nombre.padEnd(16)} ${estado}`);
  }
  console.log(
    "\n  Las 2 primeras DEBEN usar token_hash; las 2 últimas DEBEN quedar por defecto.\n" +
      "  El porqué de esa asimetría: docs/production/plantillas-auth.md\n"
  );
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
