// Flujo Wompi de punta a punta contra el Wompi falso (e2e/fake-wompi.mjs).
// Uso: node e2e/wompi-flow.cjs [carpeta-de-capturas]
const { chromium } = require("playwright");
const base = process.env.BASE_URL ?? "http://localhost:3000";
const fake = process.env.FAKE_WOMPI_URL ?? "http://localhost:4010";
const shots = process.argv[2];

function check(cond, msg) {
  if (!cond) throw new Error(`Falló: ${msg}`);
  console.log(`✓ ${msg}`);
}

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 860 } });
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
  const api = (path, init) =>
    page.evaluate(
      async ([p, i]) => {
        const r = await fetch(p, i ? { ...i, headers: { "content-type": "application/json" } } : undefined);
        return { status: r.status, json: await r.json().catch(() => ({})) };
      },
      [path, init],
    );

  await page.goto(`${base}/ingresar`, { waitUntil: "load", timeout: 180000 });
  await page.getByRole("button", { name: "Entrar con la cuenta demo" }).click();
  await page.waitForURL(/\/panel/, { timeout: 180000 });
  const prof = await api("/api/profile", { method: "PUT", body: JSON.stringify({ fullName: "Laura Gómez", docType: "CC", docNumber: "1036123456", phone: "3001234567", city: "Medellín", acceptTerms: true }) });
  check(prof.status === 200 && prof.json.profile.complete, "perfil completo");

  const kwBefore = (await api("/api/portfolio")).json.kw;

  // 1) Aprobado, desde la interfaz del mercado
  await page.goto(`${base}/panel/mercado`, { waitUntil: "load", timeout: 180000 });
  await page.locator("input[name=pay][value=wompi]").check();
  await page.getByRole("button", { name: /^Estrella|^Sol|^Semilla/ }).first().waitFor();
  await page.locator("#buy-kw").fill("1");
  await page.getByRole("button", { name: "Pagar con tarjeta, PSE o Nequi" }).click();
  await page.getByRole("button", { name: /^Pagar \$/ }).click();
  await page.waitForURL(new RegExp(`^${fake}/p/`), { timeout: 60000 });
  check(true, "el mercado abre el checkout de Wompi");
  check((await page.locator("#firma-invalida").count()) === 0, "el checkout acepta la firma de integridad");
  check((await page.locator("#cliente").innerText()).includes("CC 1036123456"), "el checkout recibe los datos del cliente");
  await page.getByRole("button", { name: "Aprobar" }).click();
  await page.waitForURL(/\/pagos\/resultado\?id=/, { timeout: 60000 });
  await page.getByRole("heading", { name: /¡Listo!/ }).waitFor({ timeout: 60000 });
  if (shots) await page.screenshot({ path: `${shots}/wompi-aprobado.png` });
  const kwAfter = (await api("/api/portfolio")).json.kw;
  check(Math.abs(kwAfter - kwBefore - 1) < 1e-6, `se asignó 1 kW (${kwBefore} → ${kwAfter})`);
  await page.waitForTimeout(1500); // deja llegar el webhook duplicado
  check(Math.abs((await api("/api/portfolio")).json.kw - kwAfter) < 1e-6, "el webhook duplicado no vuelve a asignar kW");

  // 2) Rechazado
  let o = await api("/api/payments/wompi", { method: "POST", body: JSON.stringify({ kw: 0.5 }) });
  await page.goto(o.json.checkoutUrl, { waitUntil: "load" });
  await page.getByRole("button", { name: "Rechazar" }).click();
  await page.getByRole("heading", { name: "El pago no se aprobó" }).waitFor({ timeout: 60000 });
  check((await page.getByText(/Fondos insuficientes/).count()) > 0, "se muestra el motivo del rechazo");
  if (shots) await page.screenshot({ path: `${shots}/wompi-rechazado.png` });

  // 3) PSE pendiente que se aprueba por webhook mientras la página espera
  o = await api("/api/payments/wompi", { method: "POST", body: JSON.stringify({ kw: 0.5 }) });
  await page.goto(o.json.checkoutUrl, { waitUntil: "load" });
  await page.getByRole("button", { name: "Pendiente (PSE)" }).click();
  await page.getByRole("heading", { name: "Tu pago está en proceso" }).waitFor({ timeout: 60000 });
  if (shots) await page.screenshot({ path: `${shots}/wompi-pendiente.png` });
  const txId = new URL(page.url()).searchParams.get("id");
  const ctl = await fetch(`${fake}/__control/approve/${encodeURIComponent(txId)}`, { method: "POST" });
  check(ctl.status === 200, "Wompi falso aprueba el PSE y envía el webhook");
  await page.getByRole("heading", { name: /¡Listo!/ }).waitFor({ timeout: 60000 });
  check(Math.abs((await api("/api/portfolio")).json.kw - kwAfter - 0.5) < 1e-6, "el PSE aprobado asigna 0,5 kW");

  // 4) Webhook falsificado
  const forged = await fetch(`${base}/api/webhooks/wompi`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ event: "transaction.updated", data: { transaction: { id: "x", status: "APPROVED", reference: "SLX-0000000000", amount_in_cents: 1, currency: "COP" } }, signature: { properties: ["transaction.id"], checksum: "00" }, timestamp: 1 }),
  });
  check(forged.status === 401, "un webhook con checksum falso se rechaza (401)");

  check(errors.length === 0, `sin errores en la consola${errors.length ? `: ${errors.join(" | ")}` : ""}`);

  // 5) El pago de otro usuario no se puede consultar (este 404 es intencional)
  const foreign = await api("/api/payments/wompi/sync", { method: "POST", body: JSON.stringify({ id: "no-existe-123" }) });
  check(foreign.status === 404, "una transacción ajena o inexistente da 404");
  await browser.close();
})().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
