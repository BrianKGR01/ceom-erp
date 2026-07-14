import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";
import "@testing-library/jest-dom/vitest";

// Sin esto, el DOM se acumula entre tests dentro del mismo archivo (varios
// "it" con render()) porque no usamos test.globals en vitest.config.ts.
afterEach(cleanup);

// Carga .env.local si existe (dev local). En CI, hasta que DATABASE_URL se
// configure como secret, este archivo no existe y los tests que dependen de
// la base se saltan solos (ver describe.skipIf en cada modulo).
try {
  process.loadEnvFile(".env.local");
} catch {
  // sin .env.local (CI sin secrets todavia): seguimos sin DB real.
}
