import { createClient } from "@libsql/client";
import { expect, test, type Page } from "@playwright/test";

const ADMIN_PIN = "123456";
// Una referencia del banco confirma un solo pago: cada recorrido (escritorio, celular) usa la suya.
const bankReference = () => `BCO-REF-${Date.now()}`;

function database() {
  return createClient({ url: process.env.E2E_DATABASE_URL! });
}

// La cuenta para transferencias cambia los medios de pago de los demás recorridos: se borra al terminar.
test.afterEach(async () => {
  const db = database();
  try {
    await db.execute("DELETE FROM service_setting WHERE id = 'transfer'");
  } finally {
    db.close();
  }
});

/** Datos personales de la cuenta de pruebas: los confirma si ya están guardados o los llena si faltan. */
async function completeProfileIfAsked(page: Page) {
  const summary = page.getByRole("heading", { name: /Así es tu paquete/i });
  const saved = page.getByRole("button", { name: /Continuar al resumen/i });
  const name = page.getByLabel("Nombre completo", { exact: true });
  // El perfil se carga después del título: se espera a que se vea una de las tres pantallas.
  await expect(summary.or(saved).or(name)).toBeVisible();
  if (await saved.isVisible()) {
    await saved.click();
  } else if (await name.isVisible()) {
    await name.fill("Mariana Gómez de Prueba");
    await page.getByLabel("Número de documento", { exact: true }).fill("1036123456");
    await page.getByLabel("Celular", { exact: true }).fill("3001234567");
    await page.getByLabel("Ciudad de residencia", { exact: true }).fill("Medellín");
    await page.getByRole("checkbox", { name: /Acepto los/i }).press("Space");
    await page.getByRole("button", { name: /Guardar y continuar al resumen/i }).click();
  }
  await expect(summary).toBeVisible();
}

test("transferencia: el admin publica la cuenta, la empresa reporta el pago y el admin lo confirma", async ({ page }) => {
  const BANK_REFERENCE = bankReference();
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));

  // Sin cuenta configurada, la transferencia no aparece entre los medios de pago.
  expect((await (await page.request.get("/api/config")).json()).transfer).toEqual({ enabled: false });

  await page.goto("/ingresar");
  await page.getByRole("button", { name: /Entrar con la cuenta de pruebas/i }).click();
  await expect(page).toHaveURL(/\/panel/);

  // 1. El admin publica la cuenta de la empresa.
  await page.goto("/admin/planta");
  await page.getByLabel("PIN de administrador").fill(ADMIN_PIN);
  await page.getByRole("button", { name: /Entrar a la administración/i }).click();
  await expect(page).toHaveURL(/\/admin$/);
  await page.goto("/admin/planta");
  const settings = page.getByRole("region", { name: "Cuenta para transferencias" });
  await settings.getByLabel("Banco").selectOption("Bancolombia");
  await settings.getByLabel("Tipo de cuenta").selectOption("corriente");
  await settings.getByLabel("Número de cuenta").fill("123-456789-01");
  await settings.getByLabel("NIT o documento del titular").fill("901234567-1");
  await settings.getByLabel("Titular de la cuenta").fill("X green Energy S.A.S.");
  await settings.getByRole("button", { name: /Guardar la cuenta/i }).click();
  await expect(page.getByText("Cuenta para transferencias guardada.")).toBeVisible();
  await expect(settings.getByLabel("Número de cuenta")).toHaveValue("12345678901");

  // 2. La empresa ve los datos, el valor exacto y la referencia, y reporta su comprobante.
  await page.goto("/comprar?plan=p360");
  await completeProfileIfAsked(page);
  await page.getByRole("button", { name: /Elegir medio de pago/i }).click();
  await page.getByText("Transferencia bancaria", { exact: true }).click();
  await expect(page.getByRole("button", { name: /Copiar número de cuenta: 12345678901/ })).toBeVisible();
  await expect(page.getByRole("button", { name: /Copiar valor exacto: .*40\.800\.000/ })).toBeVisible();
  const referenceButton = page.getByRole("button", { name: /Copiar referencia: PLN-[0-9A-F]{8}-M1/ });
  await expect(referenceButton).toBeVisible();
  const reference = (await referenceButton.textContent())!.match(/PLN-[0-9A-F]{8}-M1/)![0];
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);

  await page.getByLabel("Número del comprobante").fill("COMP-778899");
  const reported = page.waitForResponse((r) => r.url().endsWith("/api/payments/transfer/report") && r.request().method() === "POST");
  await page.getByRole("button", { name: "Ya transferí" }).click();
  const response = await reported;
  expect(response.status()).toBe(201);
  const { order } = await response.json();
  expect(order).toMatchObject({ status: "verificando", method: "transferencia", amountCop: 40_800_000, txHash: "COMP-778899" });
  await expect(page.getByText("Recibimos el aviso de tu transferencia.")).toBeVisible();

  // 3. El admin la encuentra en Pagos con la referencia y la confirma con la del banco.
  await page.goto("/admin/pagos");
  const row = page.getByRole("listitem").filter({ hasText: reference });
  await expect(row).toContainText("COMP-778899");
  await row.getByRole("button", { name: "Confirmar la transferencia" }).click();
  await row.getByLabel("Referencia del movimiento en el banco").fill(BANK_REFERENCE);
  await row.getByRole("button", { name: "Guardar" }).click();
  await expect(page.getByText(/Transferencia revisada: confirmado/i)).toBeVisible();

  const db = database();
  try {
    const tx = await db.execute({ sql: "SELECT status, provider_id FROM ledger_tx WHERE id = ?", args: [order.id] });
    expect(tx.rows[0]).toMatchObject({ status: "confirmada", provider_id: BANK_REFERENCE });
    const periods = await db.execute({ sql: "SELECT count(*) AS n FROM plan_period WHERE tx_id = ?", args: [order.id] });
    expect(Number(periods.rows[0].n)).toBe(1);
  } finally {
    db.close();
  }

  // 4. La empresa ve el mes confirmado en sus movimientos.
  await page.goto("/panel/billetera");
  const history = page.getByRole("region", { name: "Historial completo de movimientos" });
  await expect(history.getByText(order.id, { exact: false })).toBeVisible();
  expect(errors).toEqual([]);
});
