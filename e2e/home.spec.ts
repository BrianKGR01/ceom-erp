import { expect, test } from "@playwright/test";

test("la pagina de inicio carga", async ({ page }) => {
  await page.goto("/");
  await expect(
    page.getByText(/to get started, edit the page.tsx file/i)
  ).toBeVisible();
});
