import { expect, test } from "@playwright/test";

test("con la sesión abierta, las páginas públicas muestran «Mi panel» en lugar de «Ingresar»", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));

  await page.goto("/");
  const header = page.getByRole("banner");
  await expect(header.getByRole("link", { name: "Ingresar" })).toBeVisible();

  await page.goto("/ingresar");
  await page.getByRole("button", { name: /Entrar con la cuenta de pruebas/i }).click();
  await expect(page).toHaveURL(/\/panel/);

  // De vuelta en la página de inicio, la sesión se reconoce: foto (o iniciales) y «Mi panel».
  await page.goto("/");
  await expect(header.getByRole("link", { name: /Ir a mi panel/ })).toBeVisible();
  await expect(header.getByRole("link", { name: "Ingresar" })).toHaveCount(0);
  await expect(page.getByRole("main").getByRole("link", { name: /Ir a mi panel/ }).first()).toBeVisible();
  await page.goto("/ayuda");
  await expect(page.getByRole("banner").getByRole("link", { name: /Ir a mi panel/ })).toBeVisible();
  await page.getByRole("banner").getByRole("link", { name: /Ir a mi panel/ }).click();
  await expect(page).toHaveURL(/\/panel$/);
  expect(errors).toEqual([]);
});
