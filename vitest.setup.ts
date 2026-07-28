import { cleanup } from "@testing-library/react";
import { afterEach, beforeEach, expect } from "vitest";
import "@testing-library/jest-dom/vitest";

// Sin esto, el DOM se acumula entre tests dentro del mismo archivo (varios
// "it" con render()) porque no usamos test.globals en vitest.config.ts.
afterEach(cleanup);

/**
 * **Un test que termina sin ejecutar ninguna afirmación es rojo.**
 *
 * Por qué existe, y por qué es un mecanismo global y no una convención. En la
 * tanda 3.3a se escribieron dos tests que **pasaban en vacío**, y los dos
 * aparecieron solo porque se rompió el código a propósito:
 *
 *  1. Uno comparaba un marcador servido contra el del origen — pero la fixture
 *     no tenía el caso, así que comparaba CERO contra CERO. Una tautología.
 *  2. El otro usaba `if (!res.ok || res.data.autorizado) return`, el idiom que
 *     este repo usa por todos lados para estrechar tipos. Al romper el código,
 *     la guarda se cumplía, el test hacía `return` y **terminaba sin ejecutar
 *     una sola afirmación**. Verde, sin haber probado nada.
 *
 * El segundo es el peligroso: no es un error de quien lo escribió, es una
 * propiedad del idiom. Cualquier `if (...) return` antes de los `expect` puede
 * convertir un test en un no-op el día que cambie el comportamiento — que es
 * exactamente el día en que hace falta que falle.
 *
 * `expect.hasAssertions()` en un `beforeEach` global lo vuelve imposible de
 * forma retroactiva: si un test sale sin haber llamado a `expect` ni una vez,
 * vitest lo marca rojo con "expected to have assertions".
 *
 * **Si un test tuyo falla por esto, casi nunca la respuesta es exceptuarlo.**
 * Un test sin afirmaciones o no prueba nada, o prueba "esto no lanzó" — y eso
 * se escribe `await expect(fn()).resolves.toBeDefined()`, que sí es una
 * afirmación y además dice qué se esperaba.
 */
beforeEach(() => {
  expect.hasAssertions();
});

// Carga .env.local si existe (dev local). En CI, hasta que DATABASE_URL se
// configure como secret, este archivo no existe y los tests que dependen de
// la base se saltan solos (ver describe.skipIf en cada modulo).
try {
  process.loadEnvFile(".env.local");
} catch {
  // sin .env.local (CI sin secrets todavia): seguimos sin DB real.
}
