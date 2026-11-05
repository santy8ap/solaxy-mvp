// 1) Si faltan los datos del inversionista, el pago los pide antes de seguir.
// 2) En modo demo, el pago simulado (firma con la wallet demo) sigue funcionando.
// Uso: node e2e/demo-and-profile.cjs [carpeta-de-capturas]   (usa la base local data/solaxy.db)
const { chromium } = require("playwright");
const { createClient } = require("@libsql/client");
const path = require("node:path");
const base = process.env.BASE_URL ?? "http://localhost:3000";
const shots = process.argv[2];

function check(cond, msg) {
  if (!cond) throw new Error(`Falló: ${msg}`);
  console.log(`✓ ${msg}`);
}

(async () => {
  const db = createClient({ url: `file:${path.join(__dirname, "..", "data", "solaxy.db")}` });
  await db.execute("DELETE FROM investor_profile WHERE user_id = (SELECT id FROM user WHERE email = 'demo@solaxy.local')");

  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  page.on("console", (m) => m.type() === "error" && errors.push(m.text()));

  await page.goto(`${base}/ingresar`, { waitUntil: "load", timeout: 180000 });
  await page.getByRole("button", { name: "Entrar con la cuenta demo" }).click();
  await page.waitForURL(/\/panel/, { timeout: 180000 });

  // 1) Pedido de datos dentro del pago con Wompi
  await page.goto(`${base}/panel/mercado`, { waitUntil: "load", timeout: 180000 });
  await page.locator("input[name=pay][value=wompi]").check();
  await page.getByRole("button", { name: "Pagar con tarjeta, PSE o Nequi" }).click();
  await page.getByText("Antes de tu primera compra, completa tus datos").waitFor({ timeout: 30000 });
  check((await page.getByRole("button", { name: /^Pagar \$/ }).count()) === 0, "sin datos no se puede pagar: el formulario aparece primero");
  if (shots) await page.screenshot({ path: `${shots}/pago-pide-datos.png` });
  await page.getByLabel("Nombre completo").fill("Laura Gómez Restrepo");
  await page.getByLabel("Número de documento").fill("1036123456");
  await page.getByLabel("Celular").fill("3001234567");
  await page.getByLabel("Ciudad").fill("Medellín");
  await page.getByRole("checkbox", { name: /Acepto los/ }).check({ force: true });
  await page.getByRole("button", { name: "Guardar y continuar" }).click();
  await page.getByRole("button", { name: /^Pagar \$/ }).waitFor({ timeout: 30000 });
  check(true, "después de guardar los datos aparece el botón de pago");
  await page.getByRole("button", { name: "Cancelar" }).click();

  // 2) Pago simulado del modo demo
  const before = await page.evaluate(() => fetch("/api/portfolio").then((r) => r.json()).then((p) => p.kw));
  await page.locator("input[name=pay][value=demo-usdt-bsc]").check();
  await page.getByRole("button", { name: "Conectar wallet y pagar" }).click();
  await page.getByRole("button", { name: /Wallet de demostración/ }).click();
  await page.getByRole("button", { name: /Firmar con Wallet de demostración \(demo\)/ }).click();
  await page.getByRole("heading", { name: "¡Listo! Ya es tuya" }).waitFor({ timeout: 60000 });
  const after = await page.evaluate(() => fetch("/api/portfolio").then((r) => r.json()).then((p) => p.kw));
  check(after > before, `el pago simulado asigna kW (${before} → ${after})`);

  check(errors.length === 0, `sin errores en la consola${errors.length ? `: ${errors.join(" | ")}` : ""}`);
  await browser.close();
  db.close();
})().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
