import { readFile } from "node:fs/promises";
import { expect, test } from "@playwright/test";

test("datos personales: el comercializador los descarga y pide eliminar su cuenta; el admin responde", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));

  await page.goto("/ingresar");
  await page.getByRole("button", { name: /Entrar con la cuenta de pruebas/i }).click();
  await expect(page).toHaveURL(/\/panel/);

  // 1. Descargar mis datos: un JSON con la cuenta, sin tokens.
  await page.goto("/panel/perfil");
  const section = page.getByRole("region", { name: "Tus datos personales" });
  const download = page.waitForEvent("download");
  await section.getByRole("link", { name: /Descargar mis datos/ }).click();
  const file = await (await download).path();
  const json = JSON.parse(await readFile(file!, "utf8"));
  expect(json.cuenta.correo).toBe("pruebas@inworldenergy.local");
  expect(JSON.stringify(json)).not.toMatch(/accessToken|refreshToken/);

  // 2. Pedir la eliminación (o ver la que ya está pendiente).
  const ask = section.getByRole("button", { name: "Pedir que eliminen mi cuenta" });
  if (await ask.isVisible()) {
    await ask.click();
    await section.getByLabel("Motivo (opcional)").fill("Prueba de la solicitud de eliminación");
    await section.getByRole("button", { name: "Enviar la solicitud" }).click();
  }
  await expect(section.getByText(/Pediste eliminar tu cuenta el/)).toBeVisible();

  // 3. El admin la ve con su plazo y responde sin eliminar.
  await page.goto("/admin/clientes?estado=solicitudes");
  await page.getByLabel("PIN de administrador").fill("123456");
  await page.getByRole("button", { name: /Entrar a la administración/i }).click();
  await expect(page).toHaveURL(/\/admin$/);
  await expect(page.getByText(/Solicitud(es)? de eliminación de datos/)).toBeVisible();
  await page.goto("/admin/clientes?estado=solicitudes");
  const card = page.getByRole("listitem").filter({ hasText: "Pidió eliminar su cuenta el" });
  await expect(card).toContainText("Responde antes del");
  await card.getByRole("button", { name: "Responder sin eliminar" }).click();
  await page.getByLabel("Respuesta al titular").fill("Es la cuenta de pruebas: no se elimina.");
  await page.getByRole("button", { name: "Enviar la respuesta" }).click();
  await expect(page.getByText("Solicitud respondida.")).toBeVisible();

  // 4. El comercializador ve la respuesta en su perfil.
  await page.goto("/panel/perfil");
  await expect(page.getByText(/Es la cuenta de pruebas: no se elimina\./)).toBeVisible();
  expect(errors).toEqual([]);
});
