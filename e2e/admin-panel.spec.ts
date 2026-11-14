import { expect, test } from "@playwright/test";

const PAGES = ["/admin", "/admin/analisis", "/admin/clientes", "/admin/pagos", "/admin/retiros", "/admin/planta", "/admin/equipo", "/admin/configuracion", "/admin/actividad"];

test("administración sin PIN: el propietario entra con su cuenta, recorre todo y elige a su equipo", async ({ page }, info) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });

  // Entra como administrador sin PIN: en este ambiente la cuenta de pruebas es propietaria (ADMIN_EMAILS).
  await page.goto("/ingresar?rol=admin");
  await expect(page.getByLabel("PIN de administrador")).toHaveCount(0);
  await page.getByRole("button", { name: /Entrar como administrador de pruebas/i }).click();
  await expect(page).toHaveURL(/\/admin$/);
  await expect(page.getByRole("heading", { name: "Resumen" })).toBeVisible();

  // Todas las pantallas cargan, sin errores ni bloqueos de la política de contenido.
  for (const path of PAGES) {
    await page.goto(path);
    await expect(page.locator("h1").first()).toBeVisible();
    await page.waitForLoadState("networkidle");
  }
  expect(errors.filter((e) => !/status of 404/.test(e))).toEqual([]);

  // Equipo: da acceso a alguien con su correo de Google, lo ve en la lista y en Actividad, y se lo quita.
  const email = `contadora-${info.project.name}@empresa.co`;
  await page.goto("/admin/equipo");
  await expect(page.getByRole("heading", { name: "Propietarios" })).toBeVisible();
  await expect(page.getByText("(tú)")).toBeVisible();
  await page.getByLabel("Correo de Google").fill(email);
  await page.getByLabel("Para qué (opcional)").fill("Contabilidad");
  await page.getByRole("button", { name: "Dar acceso de administrador" }).click();
  await expect(page.getByText(`${email} ya puede entrar a la administración.`)).toBeVisible();
  const row = page.getByRole("listitem").filter({ hasText: email });
  await expect(row).toContainText("Todavía no ha entrado");
  await expect(row).toContainText("Contabilidad");

  await page.goto("/admin/actividad");
  await page.getByLabel("Tipo").selectOption({ label: "Administrador agregado" });
  await expect(page.getByRole("region", { name: "Bitácora" })).toContainText(email);

  await page.goto("/admin/equipo");
  await page.getByRole("listitem").filter({ hasText: email }).getByRole("button", { name: "Quitar acceso" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Quitar el acceso" }).click();
  await expect(page.getByText(`${email} ya no puede entrar a la administración.`)).toBeVisible();
  await expect(page.getByRole("listitem").filter({ hasText: email })).toHaveCount(0);
});
