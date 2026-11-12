import { readFile } from "node:fs/promises";
import { createClient } from "@libsql/client";
import { expect, test } from "@playwright/test";

test("los enlaces antiguos, la ayuda y las rutas privadas responden correctamente", async ({
  page,
  request,
}) => {
  await page.goto("/planes");
  await expect(page).toHaveURL(/\/#planes$/);
  await expect(
    page.getByRole("heading", { name: /Cuatro planes/i }),
  ).toBeVisible();
  await page.goto("/ayuda");
  await expect(
    page.getByRole("heading", { name: /Tu energía, con respuestas/i }),
  ).toBeVisible();
  for (const url of [
    "/api/transactions",
    "/api/transactions/export",
    "/api/receipts/IWE-12345678",
  ]) {
    expect((await request.get(url)).status()).toBe(401);
  }
  expect((await request.get("/api/cron/payments")).status()).toBe(401);
});

test("plan → ingreso → datos personales → resumen → pago de prueba → PDF e historial", async ({
  page,
}) => {
  const config = await (await page.request.get("/api/config")).json();
  expect(config.demoMode).toBe(true);
  expect(config.mercadopago.enabled).toBe(false);
  expect(config.crypto.enabled).toBe(false);
  const db = createClient({ url: process.env.E2E_DATABASE_URL! });
  try {
    // Solo el perfil ficticio de esta base temporal: cada viewport recorre el formulario completo.
    await db.execute(
      "DELETE FROM company_profile WHERE user_id IN (SELECT id FROM user WHERE email = 'pruebas@inworldenergy.local')",
    );
  } finally {
    db.close();
  }
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/planes");
  await page.locator('a[href="/comprar?plan=p180"]:visible').click();
  await expect(page).toHaveURL(/\/ingresar\?next=%2Fcomprar%3Fplan%3Dp180$/);
  await expect(
    page.locator("strong").filter({ hasText: /^Plan 180$/ }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: /Entrar con la cuenta de pruebas/i })
    .click();
  await expect(page).toHaveURL(/\/comprar\?plan=p180$/);
  await expect(
    page.getByRole("heading", { name: /Tus datos, tu energía/i }),
  ).toBeVisible();
  await expect(page.getByLabel(/Razón social|NIT/i)).toHaveCount(0);
  await page
    .getByLabel("Nombre completo", { exact: true })
    .fill("Mariana Gómez de Prueba");
  await page
    .getByLabel("Número de documento", { exact: true })
    .fill("1036123456");
  await page.getByLabel("Celular", { exact: true }).fill("3001234567");
  await page
    .getByLabel("Ciudad de residencia", { exact: true })
    .fill("Medellín");
  await page.getByRole("checkbox", { name: /Acepto los/i }).press("Space");
  await page
    .getByRole("button", { name: /Guardar y continuar al resumen/i })
    .click();
  await expect(
    page.getByRole("heading", { name: /Así es tu plan/i }),
  ).toBeVisible();
  await expect(
    page.getByRole("complementary", { name: "Resumen del plan" }),
  ).toContainText("20.880.000");
  await expect(page.getByText(/14,94/)).toBeVisible();
  await page.getByRole("button", { name: /Elegir medio de pago/i }).click();
  const paidResponse = page.waitForResponse(
    (response) =>
      response.url().endsWith("/api/payments/test") &&
      response.request().method() === "POST",
  );
  await page.getByRole("button", { name: /Confirmar pago de prueba/i }).click();
  const response = await paidResponse;
  expect(response.ok()).toBe(true);
  const { order } = await response.json();
  await expect(
    page.getByRole("heading", { name: /Tu energía ya cuenta/i }),
  ).toBeVisible();
  await expect(page.getByText(order.id, { exact: true })).toBeVisible();
  const pdfDownload = page.waitForEvent("download");
  await page.getByRole("button", { name: /Comprobante PDF/i }).click();
  const pdf = await pdfDownload;
  expect((await readFile((await pdf.path())!)).subarray(0, 5).toString()).toBe(
    "%PDF-",
  );
  await page.goto("/panel/billetera");
  const history = page.getByRole("region", {
    name: "Historial completo de movimientos",
  });
  await expect(history.getByText(order.id, { exact: false })).toBeVisible();
  const csvDownload = page.waitForEvent("download");
  await history.getByRole("link", { name: /Exportar CSV/i }).click();
  const csv = await csvDownload;
  expect(await readFile((await csv.path())!, "utf8")).toContain(order.id);
  await page.goto("/panel/avisos");
  await expect(
    page.getByText("Pago del plan confirmado", { exact: true }).first(),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth + 1,
    ),
  ).toBe(true);
  expect(errors).toEqual([]);
});
