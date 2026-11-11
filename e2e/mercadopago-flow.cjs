// Flujo Mercado Pago de punta a punta contra el Mercado Pago falso (e2e/fake-mercadopago.mjs).
// Uso: node e2e/mercadopago-flow.cjs [carpeta-de-capturas]
const { chromium } = require("playwright");
const base = process.env.BASE_URL ?? "http://localhost:3000";
const fake = process.env.FAKE_MP_URL ?? "http://localhost:4010";
const shots = process.argv[2];

function check(cond, msg) {
  if (!cond) throw new Error(`Falló: ${msg}`);
  console.log(`✓ ${msg}`);
}
const near = (a, b) => Math.abs(a - b) < 1e-6;

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
  const kwNow = async () => (await api("/api/portfolio")).json.kw;
  const newOrder = async (kw) => {
    const o = await api("/api/payments/mercadopago", { method: "POST", body: JSON.stringify({ kw }) });
    check(o.status === 201 && o.json.checkoutUrl?.startsWith(fake), `se crea la orden de ${kw} kW en Mercado Pago`);
    return o.json;
  };

  await page.goto(`${base}/ingresar`, { waitUntil: "load", timeout: 180000 });
  await page.getByRole("button", { name: "Entrar con la cuenta demo" }).click();
  await page.waitForURL(/\/panel/, { timeout: 180000 });
  const prof = await api("/api/profile", { method: "PUT", body: JSON.stringify({ fullName: "Laura Gómez", docType: "CC", docNumber: "1036123456", phone: "3001234567", city: "Medellín", acceptTerms: true }) });
  check(prof.status === 200 && prof.json.profile.complete, "perfil completo");
  const kwBefore = await kwNow();

  // 1) Tarjeta aprobada, desde la interfaz del mercado
  await page.goto(`${base}/panel/mercado`, { waitUntil: "load", timeout: 180000 });
  await page.locator("input[name=pay][value=mercadopago]").check();
  await page.getByRole("button", { name: /^Estrella|^Sol|^Semilla/ }).first().waitFor();
  await page.locator("#buy-kw").fill("1");
  await page.getByRole("button", { name: "Pagar con tarjeta, PSE o Nequi" }).click();
  if (shots) await page.screenshot({ path: `${shots}/mp-hoja.png` });
  await page.getByRole("button", { name: /^Pagar \$/ }).click();
  await page.waitForURL(new RegExp(`^${fake}/checkout/v1/redirect`), { timeout: 60000 });
  check(true, "el mercado abre el Checkout Pro de Mercado Pago");
  check((await page.locator("#cliente").innerText()).includes("Laura Gómez · pruebas@inworldenergy.local"), "el checkout recibe el nombre y el correo del comprador");
  check(/^SLX-[0-9A-F]{10}$/.test(await page.locator("#ref").innerText()), "la referencia del pago es el código de la orden");
  check(/^\d+ COP$/.test(await page.locator("#monto").innerText()), `el monto va en pesos (${await page.locator("#monto").innerText()})`);
  await page.getByRole("button", { name: "Aprobar" }).click();
  await page.waitForURL(/\/pagos\/resultado\?ref=SLX-.*payment_id=\d+/, { timeout: 60000 });
  await page.getByRole("heading", { name: /¡Listo!/ }).waitFor({ timeout: 60000 });
  if (shots) await page.screenshot({ path: `${shots}/mp-aprobado.png` });
  const kwAfter = await kwNow();
  check(near(kwAfter, kwBefore + 1), `se asignó 1 kW (${kwBefore} → ${kwAfter})`);
  await page.waitForTimeout(1500); // deja llegar la notificación, que repite el mismo pago
  check(near(await kwNow(), kwAfter), "la notificación del mismo pago no vuelve a asignar kW");

  // 2) Tarjeta rechazada: se muestra el motivo
  let o = await newOrder(0.5);
  await page.goto(o.checkoutUrl, { waitUntil: "load" });
  await page.getByRole("button", { name: "Rechazar" }).click();
  await page.getByRole("heading", { name: "El pago no se aprobó" }).waitFor({ timeout: 60000 });
  check((await page.getByText(/no tiene fondos suficientes/).count()) > 0, "se muestra el motivo del rechazo");
  if (shots) await page.screenshot({ path: `${shots}/mp-rechazado.png` });

  // 3) PSE en proceso que el banco aprueba después (llega por notificación mientras la página espera)
  o = await newOrder(0.5);
  await page.goto(o.checkoutUrl, { waitUntil: "load" });
  await page.getByRole("button", { name: "Pendiente (PSE)" }).click();
  await page.getByRole("heading", { name: "Tu pago está en proceso" }).waitFor({ timeout: 60000 });
  if (shots) await page.screenshot({ path: `${shots}/mp-pendiente.png` });
  const paymentId = new URL(page.url()).searchParams.get("payment_id");
  const ctl = await fetch(`${fake}/__control/approve/${paymentId}`, { method: "POST" });
  check(ctl.status === 200, "el banco aprueba el PSE y Mercado Pago envía la notificación");
  await page.getByRole("heading", { name: /¡Listo!/ }).waitFor({ timeout: 60000 });
  check(near(await kwNow(), kwAfter + 0.5), "el PSE aprobado asigna 0,5 kW");

  // 4) Volver sin pagar: no hay cobro ni kW
  o = await newOrder(0.5);
  await page.goto(o.checkoutUrl, { waitUntil: "load" });
  await page.getByRole("button", { name: "Volver sin pagar" }).click();
  await page.getByRole("heading", { name: "No completaste el pago" }).waitFor({ timeout: 60000 });
  if (shots) await page.screenshot({ path: `${shots}/mp-sin-pago.png` });
  check(near(await kwNow(), kwAfter + 0.5), "volver sin pagar no asigna kW");

  // 5) El historial y el admin ven las órdenes con su estado
  await page.goto(`${base}/panel/billetera`, { waitUntil: "load" });
  await page.getByText(/Pago con Mercado Pago/).first().waitFor({ timeout: 30000 });
  check((await page.getByText(/no tiene fondos suficientes/).count()) > 0, "el historial muestra los pagos con Mercado Pago y el motivo del rechazado");
  if (shots) await page.screenshot({ path: `${shots}/mp-historial.png` });

  // 6) Notificación falsificada
  const forged = await fetch(`${base}/api/webhooks/mercadopago?data.id=${paymentId}&type=payment`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-signature": "ts=1,v1=00", "x-request-id": "falso" },
    body: JSON.stringify({ type: "payment", data: { id: paymentId } }),
  });
  check(forged.status === 401, "una notificación con firma falsa se rechaza (401)");

  check(errors.length === 0, `sin errores en la consola${errors.length ? `: ${errors.join(" | ")}` : ""}`);

  // 7) La orden de otro usuario o inexistente no se puede consultar (este 404 es intencional)
  const foreign = await api("/api/payments/mercadopago/sync", { method: "POST", body: JSON.stringify({ ref: "SLX-0000000000" }) });
  check(foreign.status === 404, "una orden ajena o inexistente da 404");
  await browser.close();
})().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
