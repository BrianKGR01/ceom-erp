import { defineConfig } from "drizzle-kit";

process.loadEnvFile(".env.local");

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
