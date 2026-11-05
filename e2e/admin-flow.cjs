// Retiro de punta a punta: el usuario lo pide y lo firma; el admin envía el dinero y aprueba con la
// referencia del envío; el usuario lo ve confirmado. Además, la sección Pagos del admin.
// Uso: node e2e/admin-flow.cjs [carpeta-de-capturas]   (servidor en modo demo, PIN 2026 o ADMIN_PIN)
const { chromium } = require("playwright");
const base = process.env.BASE_URL ?? "http://localhost:3000";
const pin = process.env.ADMIN_PIN || "2026";
const shots = process.argv[2];

function check(cond, msg) {
  if (!cond) throw new Error(`Falló: ${msg}`);
  console.log(`✓ ${msg}`);
}

(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  page.on("console", (m) => m.type() === "error" && errors.push(m.text()));

  // Administrador (misma cuenta demo, con PIN)
  await page.goto(`${base}/ingresar?rol=admin`, { waitUntil: "load", timeout: 180000 });
  await page.locator("#admin-pin").fill(pin);
  await page.getByRole("button", { name: /Entrar como administrador/ }).click();
  await page.waitForURL(/\/admin/, { timeout: 180000 });

  // Usuario: pide un retiro con la wallet demo
  await page.goto(`${base}/panel/billetera`, { waitUntil: "load" });
  await page.getByRole("button", { name: /Conectar wallet para retirar|Retirar a mi wallet/ }).click();
  if (await page.getByRole("button", { name: /Wallet de demostración/ }).isVisible().catch(() => false)) {
    await page.getByRole("button", { name: /Wallet de demostración/ }).click();
    await page.getByRole("button", { name: "Retirar a mi wallet" }).click();
  }
  await page.locator("#wd-amount").fill("40000");
  await page.getByRole("button", { name: "Firmar y retirar" }).click();
  await page.getByText("Esperando aprobación").waitFor({ timeout: 30000 });
  check(true, "el retiro quedó esperando al administrador");

  // Admin: aprueba con la referencia del envío
  const admin = await ctx.newPage();
  admin.on("pageerror", (e) => errors.push(String(e)));
  await admin.goto(`${base}/admin/retiros`, { waitUntil: "load" });
  await admin.getByRole("button", { name: "Aprobar" }).first().click();
  const ref = `0x${"ab".repeat(32)}`;
  await admin.getByPlaceholder("0x… o número de comprobante").fill(ref);
  if (shots) await admin.screenshot({ path: `${shots}/admin-aprobar-retiro.png` });
  await admin.getByRole("button", { name: "Confirmar aprobación" }).click();
  await admin.getByText(/Aprobaste el retiro/).waitFor({ timeout: 20000 });
  await admin.getByText(`Referencia: ${ref}`).first().waitFor({ timeout: 20000 });
  check(true, "el admin aprobó con la referencia del envío y queda registrada");

  await page.getByText("Retiro enviado").waitFor({ timeout: 30000 });
  check((await page.getByText(/abababab/).count()) > 0, "el usuario ve el retiro enviado con su referencia");

  // Sección Pagos
  await admin.goto(`${base}/admin/pagos`, { waitUntil: "load" });
  await admin.getByRole("heading", { name: "Órdenes" }).waitFor({ timeout: 30000 });
  await admin.getByText("Para cobrar de verdad").waitFor();
  await admin.locator("tbody tr td.num").first().waitFor({ timeout: 30000 });
  check((await admin.locator("tbody tr").count()) > 0, "la sección Pagos lista las órdenes");
  if (shots) await admin.screenshot({ path: `${shots}/admin-pagos.png`, fullPage: true });

  check(errors.length === 0, `sin errores en la consola${errors.length ? `: ${errors.join(" | ")}` : ""}`);
  await browser.close();
})().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
