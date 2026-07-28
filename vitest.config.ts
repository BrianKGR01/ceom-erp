import path from "node:path";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    setupFiles: ["./vitest.setup.ts"],
    // Una sola corrida a la vez contra la base compartida — ver el porqué
    // completo en el archivo. `globalSetup` y no `setupFiles`: aquel corre una
    // vez por archivo de test, éste una sola vez por corrida.
    globalSetup: ["./vitest.global-setup.ts"],
    exclude: ["**/node_modules/**", "**/e2e/**"],
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
