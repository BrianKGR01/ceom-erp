import "@testing-library/jest-dom/vitest";

// Carga .env.local si existe (dev local). En CI, hasta que DATABASE_URL se
// configure como secret, este archivo no existe y los tests que dependen de
// la base se saltan solos (ver describe.skipIf en cada modulo).
try {
  process.loadEnvFile(".env.local");
} catch {
  // sin .env.local (CI sin secrets todavia): seguimos sin DB real.
}
