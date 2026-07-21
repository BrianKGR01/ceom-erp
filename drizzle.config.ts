import { existsSync } from "node:fs";
import { defineConfig } from "drizzle-kit";

// process.loadEnvFile() (a diferencia de dotenv) tira ENOENT si el archivo
// no existe, en vez de no-opear -- en CI no hay .env.local (esta en
// .gitignore, nunca se sube) y DATABASE_URL/DIRECT_URL ya vienen seteadas
// como env vars reales del workflow, asi que cargar el archivo ahi ni hace
// falta. Bug real encontrado: sin este chequeo, drizzle-kit migrate
// crasheaba en CI con "ENOENT: no such file or directory, open
// '.env.local'" antes de llegar siquiera a leer DIRECT_URL.
if (existsSync(".env.local")) {
  process.loadEnvFile(".env.local");
}

if (!process.env.DIRECT_URL) {
  throw new Error("DIRECT_URL no esta definida (ver .env.example)");
}

export default defineConfig({
  schema: "./src/modules/**/schema.ts",
  out: "./drizzle/migrations",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DIRECT_URL,
  },
});
