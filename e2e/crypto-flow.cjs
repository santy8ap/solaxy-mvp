// Flujo cripto de punta a punta contra la cadena falsa (e2e/fake-chain.mjs) y una wallet EIP-6963 inyectada.
// Uso: node e2e/crypto-flow.cjs [carpeta-de-capturas]
const { chromium } = require("playwright");
const fs = require("node:fs");
const path = require("node:path");
const base = process.env.BASE_URL ?? "http://localhost:3000";
const shots = process.argv[2];
const walletScript = fs.readFileSync(path.join(__dirname, "fake-wallet.js"), "utf8");

function check(cond, msg) {
  if (!cond) throw new Error(`Falló: ${msg}`);
  console.log(`✓ ${msg}`);
}

(async () => {
  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  await context.addInitScript({ content: walletScript });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
  const api = (p, init) =>
    page.evaluate(
      async ([u, i]) => {
        const r = await fetch(u, i ? { ...i, headers: { "content-type": "application/json" } } : undefined);
        return { status: r.status, json: await r.json().catch(() => ({})) };
      },
      [p, init],
    );

  await page.goto(`${base}/ingresar`, { waitUntil: "load", timeout: 180000 });
  await page.getByRole("button", { name: "Entrar con la cuenta demo" }).click();
  await page.waitForURL(/\/panel/, { timeout: 180000 });
  await api("/api/profile", { method: "PUT", body: JSON.stringify({ fullName: "Laura Gómez", docType: "CC", docNumber: "1036123456", phone: "3001234567", city: "Medellín", acceptTerms: true }) });
  const kwBefore = (await api("/api/portfolio")).json.kw;

  async function buy(assetLabel, kwButton, expectKw) {
    await page.goto(`${base}/panel/mercado`, { waitUntil: "load", timeout: 180000 });
    await page.locator(`input[name=pay][value=${assetLabel.toLowerCase()}]`).check();
    await page.getByRole("button", { name: kwButton }).first().click();
    const pay = page.getByRole("button", { name: /Conectar wallet y pagar|Pagar (USDT|BNB) con/ });
    await pay.click();
    if (await page.getByRole("button", { name: /Wallet de prueba/ }).isVisible().catch(() => false)) {
      await page.getByRole("button", { name: /Wallet de prueba/ }).click();
      await page.getByRole("button", { name: /Pagar (USDT|BNB) con Wallet de prueba/ }).click();
    }
    await page.getByRole("button", { name: "Cotizar el pago" }).click();
    const send = page.getByRole("button", { name: new RegExp(`^Enviar .* ${assetLabel}$`) });
    await send.waitFor({ timeout: 60000 });
    const sendText = await send.innerText();
    check(/vence en \d+:\d\d/.test(await page.locator("text=vence en").first().innerText()), `cotización de ${assetLabel} con cuenta regresiva (${sendText})`);
    if (shots) await page.screenshot({ path: `${shots}/cripto-${assetLabel}-cotizacion.png` });
    await send.click();
    await page.getByText(/de 3 confirmaciones/).waitFor({ timeout: 60000 });
    if (shots) await page.screenshot({ path: `${shots}/cripto-${assetLabel}-verificando.png` });
    await page.getByRole("heading", { name: "¡Listo! Ya es tuya" }).waitFor({ timeout: 90000 });
    if (shots) await page.screenshot({ path: `${shots}/cripto-${assetLabel}-listo.png` });
    check(true, `pago en ${assetLabel} confirmado en la cadena`);
    const kw = (await api("/api/portfolio")).json.kw;
    return kw;
  }

  const afterUsdt = await buy("USDT", /Semilla/, 0.5);
  check(Math.abs(afterUsdt - kwBefore - 0.5) < 1e-6, `USDT asignó 0,5 kW (${kwBefore} → ${afterUsdt})`);
  await page.keyboard.press("Escape");
  const afterBnb = await buy("BNB", /Semilla/, 0.5);
  check(Math.abs(afterBnb - afterUsdt - 0.5) < 1e-6, `BNB asignó 0,5 kW (${afterUsdt} → ${afterBnb})`);

  // El historial muestra la compra con el estado y el enlace a BscScan.
  await page.goto(`${base}/panel/billetera`, { waitUntil: "load" });
  await page.getByRole("link", { name: "Ver en BscScan" }).first().waitFor({ timeout: 30000 }).catch(() => undefined);
  check((await page.getByText("Compra de 0,5 kW a la planta").count()) >= 2, "las compras aparecen en el historial");

  check(errors.length === 0, `sin errores en la consola${errors.length ? `: ${errors.join(" | ")}` : ""}`);
  await browser.close();
})().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
