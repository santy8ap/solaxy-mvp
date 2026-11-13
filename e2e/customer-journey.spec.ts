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

test("la navegación y el comparador de planes funcionan desde la portada", async ({ page }) => {
  await page.goto("/");
  const header = page.getByRole("banner");
  const nav = header.getByRole("navigation", { name: "Secciones" });
  await nav.getByRole("link", { name: "Planes", exact: true }).click();
  await expect(page).toHaveURL(/\/#planes$/);

  const plans = page.getByRole("region", { name: /Cuatro planes/i });
  const plan = plans.getByRole("list", { name: "Planes de energía" })
    .getByRole("listitem").filter({ has: page.getByRole("heading", { name: /^Plan 180$/i }) });
  await expect(plan).toContainText("20.880.000");
  await expect(plan).toContainText("14,94");
  await expect(plan.getByRole("link", { name: "Elegir Plan 180" })).toHaveAttribute("href", "/comprar?plan=p180");

  await plans.getByText("Comparar todos los planes", { exact: true }).click();
  const comparison = plans.getByRole("region", { name: "Tabla comparativa de planes" });
  await expect(comparison.getByRole("rowheader")).toHaveCount(4);
  const comparisonRow = comparison.getByRole("row").filter({ hasText: /Plan 180/i });
  await expect(comparisonRow).toContainText("20.880.000");
  await expect(comparisonRow).toContainText("≈ 15 %");
  await expect(plans.getByText(/Los porcentajes con ≈ están redondeados/)).toBeVisible();
  await expect(plans.getByRole("heading", { name: /Cuatro planes/i })).toBeVisible();
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1),
  ).toBe(true);

  const preview = plans.getByRole("region", { name: "Compra, venta y utilidad" });
  await preview.getByRole("combobox", { name: "Plan" }).selectOption("p180");
  await expect(preview.getByText(/14,94\s*% sobre la compra/)).toBeVisible();
  await nav.getByRole("link", { name: "Ayuda", exact: true }).click();
  await expect(page).toHaveURL(/\/ayuda$/);
});

test("la portada anuncia el precio de los planes con cupo", async ({ page }) => {
  let soldOut = false;
  await page.route("**/api/plans", async (route) => {
    const response = await route.fetch();
    const catalog = await response.json();
    for (const plan of catalog.plans) {
      plan.available = !soldOut && plan.id !== "p720";
    }
    await route.fulfill({ response, json: catalog });
  });

  await page.goto("/");
  await expect(page.getByText("Desde $ 330 COP por kWh en los planes con cupo.")).toBeVisible();
  await expect(page.getByRole("link", { name: "Elegir Plan 720" })).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Elegir Plan 540" })).toHaveAttribute("href", "/comprar?plan=p540");

  soldOut = true;
  await page.reload();
  await expect(page.getByText("Los planes están sin cupo por ahora.")).toBeVisible();
  await expect(page.getByRole("link", { name: /^Elegir Plan/ })).toHaveCount(0);
});

test("el resultado muestra el comprobante solo cuando se confirma el pago", async ({ page }) => {
  await page.goto("/ingresar");
  await page.getByRole("button", { name: /Entrar con la cuenta de pruebas/i }).click();
  await expect(page).toHaveURL(/\/panel$/);

  const ref = "XGE-12345678";
  let confirmed = false;
  await page.route("**/api/payments/mercadopago/sync", (route) =>
    route.fulfill({
      json: {
        order: {
          id: ref,
          amountCop: 20_880_000,
          kwh: 60_000,
          periodIndex: 2,
          method: "mercadopago",
          network: "Mercado Pago (pruebas)",
          status: confirmed ? "confirmada" : "pendiente",
        },
        outcome: confirmed ? "aprobada" : "sin_pago",
      },
    }),
  );

  await page.goto(`/pagos/resultado?ref=${ref}`);
  await expect(page.getByRole("heading", { name: "Pago aún sin confirmar" })).toBeVisible();
  const receipt = page.getByRole("button", { name: "Comprobante PDF" });
  await expect(receipt).toHaveCount(0);

  confirmed = true;
  await page.getByRole("button", { name: "Volver a consultar" }).click();
  await expect(page.getByRole("heading", { name: "Pago confirmado" })).toBeVisible();
  await expect(page.getByText(/Si pagaste por adelantado, el nuevo periodo empieza al terminar el anterior/)).toBeVisible();
  await expect(page.getByText("Operación de prueba", { exact: true })).toBeVisible();
  await expect(receipt).toBeVisible();
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
  await expect(
    page.getByRole("region", { name: "Compra, venta y utilidad del plan" })
      .getByText(/14,94\s*% sobre la compra/),
  ).toBeVisible();
  const configUrl = "**/api/config";
  await page.route(configUrl, (route) =>
    route.fulfill({ status: 503, json: { error: "Configuración no disponible." } }),
  );
  await page.getByRole("button", { name: /Elegir medio de pago/i }).click();
  await expect(page.getByText("No pudimos cargar los medios de pago.")).toBeVisible();
  await page.unroute(configUrl);
  await page.getByRole("button", { name: "Volver a cargar" }).click();
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
    page.getByRole("heading", { name: "Pago confirmado" }),
  ).toBeVisible();
  await expect(page.getByText(/Registramos el pago del mes 1.*60\.000 kWh durante 30 días/)).toBeVisible();
  await expect(page.getByText("Operación de prueba", { exact: true })).toBeVisible();
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
