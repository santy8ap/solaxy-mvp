// Comprueba que con DEMO_MODE=false no queda nada de la demostración y que solo se cobra de verdad.
// Uso: BASE_URL=http://localhost:3100 node e2e/production-mode.cjs   (servidor arrancado con DEMO_MODE=false)
const { chromium } = require("playwright");
const base = process.env.BASE_URL ?? "http://localhost:3100";

function check(cond, msg) {
  if (!cond) throw new Error(`Falló: ${msg}`);
  console.log(`✓ ${msg}`);
}

(async () => {
  const cfg = await (await fetch(`${base}/api/config`)).json();
  check(cfg.demoMode === false, "el servidor está en modo producción (DEMO_MODE=false)");
  check(cfg.wompi.enabled && !cfg.wompi.sandbox, "Wompi activo con llave de producción");
  check(cfg.crypto.enabled && cfg.crypto.chainId === 56, "cripto activo en BNB Chain (56)");

  const head = await fetch(`${base}/`);
  check(head.headers.get("strict-transport-security")?.includes("max-age") && head.headers.get("x-frame-options") === "DENY", "encabezados de seguridad presentes");

  const signUp = await fetch(`${base}/api/auth/sign-up/email`, {
    method: "POST",
    headers: { "content-type": "application/json", origin: base },
    body: JSON.stringify({ email: "intruso@correo.co", password: "contrasena-larga-123", name: "Intruso" }),
  });
  check(signUp.status >= 400, `no se puede crear una cuenta con correo y contraseña (HTTP ${signUp.status})`);

  const platform = await (await fetch(`${base}/api/platform`)).json();
  check(platform.investors === 0 && platform.soldKw === 0, `base nueva sin inversionistas ficticios (${platform.investors} inversionistas, ${platform.soldKw} kW vendidos)`);

  check((await fetch(`${base}/api/orders`, { method: "POST", headers: { "content-type": "application/json" }, body: "{}" })).status === 401, "las órdenes exigen sesión");

  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  page.on("console", (m) => m.type() === "error" && errors.push(m.text()));

  await page.goto(`${base}/`, { waitUntil: "load" });
  const landing = await page.locator("body").innerText();
  check(landing.includes("Sí. Los pagos con tarjeta, PSE y Nequi se procesan con Wompi") || (await page.getByText("¿Esto ya funciona con dinero real?").count()) > 0, "la landing tiene la pregunta sobre dinero real");
  check(!/Pago simulado|MVP demostrativo|Modo demo/i.test(landing), "la landing no menciona pagos simulados ni modo demo");
  check(/Tarjeta/.test(landing) && /USDT/.test(landing), "la landing muestra tarjeta, PSE/Nequi y USDT/BNB");

  await page.goto(`${base}/ingresar`, { waitUntil: "load" });
  await page.getByRole("button", { name: "Continuar con Google" }).waitFor();
  check((await page.getByRole("button", { name: /cuenta demo/i }).count()) === 0, "el ingreso no ofrece la cuenta demo");
  check(!/posición de demostración/i.test(await page.locator("body").innerText()), "el ingreso no promete posición de regalo");

  for (const p of ["/terminos", "/privacidad"]) {
    await page.goto(`${base}${p}`, { waitUntil: "load" });
    check((await page.locator("h1").count()) === 1, `${p} se muestra`);
  }
  check(errors.length === 0, `sin errores en la consola${errors.length ? `: ${errors.join(" | ")}` : ""}`);
  await browser.close();
})().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
