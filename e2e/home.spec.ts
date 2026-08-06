import { expect, test } from "@playwright/test";

// Landing publica real (src/components/landing/landing.tsx, PR #25) — el spec
// anterior esperaba el placeholder de create-next-app, que la landing
// reemplazo hace tiempo (docs/auditoria-prelanzamiento/antiguo/02-arquitectura-y-calidad.md).
test("la landing publica carga con el contenido real", async ({ page }) => {
  await page.goto("/");

  await expect(
    page.getByRole("heading", { level: 1, name: /Vendiste todo el mes/i })
  ).toBeVisible();

  // Hay mas de un CTA "Escribinos por WhatsApp" en la pagina (hero y cierre)
  // ademas de los CTA por plan ("Escribinos por Basico"/etc.) — .first() basta
  // para un smoke test, no hace falta distinguir cual.
  await expect(
    page.getByRole("link", { name: "Escribinos por WhatsApp" }).first()
  ).toBeVisible();
});
