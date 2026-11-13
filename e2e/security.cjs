// Recorrido de seguridad contra un servidor local (modo de pruebas, ADMIN_EMAILS con la cuenta de pruebas).
// Uso: BASE_URL=http://localhost:3100 ADMIN_PIN=246810 [CHROMIUM_PATH=/ruta/a/chromium] node e2e/security.cjs
const { chromium } = require("playwright");
const base = process.env.BASE_URL ?? "http://localhost:3100";
const PIN = process.env.ADMIN_PIN ?? "246810";
let failed = 0;
const check = (cond, msg) => {
  console.log(`${cond ? "✓" : "✗"} ${msg}`);
  if (!cond) failed++;
};

(async () => {
  // 1. Encabezados
  const home = await fetch(`${base}/`);
  const csp = home.headers.get("content-security-policy") ?? "";
  check(/default-src 'self'/.test(csp) && /object-src 'none'/.test(csp) && /frame-ancestors 'none'/.test(csp) && /form-action 'self'/.test(csp), "la página trae la política de contenido (CSP)");
  check(home.headers.get("x-frame-options") === "DENY" && home.headers.get("x-content-type-options") === "nosniff", "no se puede incrustar y no adivina tipos");
  check(!home.headers.get("access-control-allow-origin"), "sin CORS abierto en la página");
  const plans = await fetch(`${base}/api/plans`, { headers: { origin: "https://sitio-malicioso.com" } });
  check(!plans.headers.get("access-control-allow-origin"), "la API no autoriza a otros sitios a leer respuestas (CORS)");
  const adminHead = await fetch(`${base}/admin`, { redirect: "manual" });
  check((adminHead.headers.get("x-robots-tag") ?? "").includes("noindex"), "las páginas de administración no se indexan");

  // Salud del servicio: responde sin sesión y no dice nada de la configuración.
  const health = await fetch(`${base}/api/health`);
  const healthBody = await health.json().catch(() => ({}));
  check(health.status === 200 && healthBody.ok === true && Object.keys(healthBody).sort().join(",") === "database,latencyMs,ok,version", `la salud del servicio responde sin revelar la configuración (${health.status}: ${Object.keys(healthBody).join(", ")})`);
  const robots = await (await fetch(`${base}/robots.txt`)).text();
  check(/Disallow: \/admin/.test(robots) && /Disallow: \/panel/.test(robots) && /Sitemap: /.test(robots), "robots.txt cierra el admin y el panel, y apunta al sitemap");

  // 2. Registro cerrado
  const signUp = await fetch(`${base}/api/auth/sign-up/email`, {
    method: "POST",
    headers: { "content-type": "application/json", origin: base, "x-forwarded-for": "203.0.113.50" },
    body: JSON.stringify({ email: "intruso@correo.co", password: "una-clave-larga-123", name: "Intruso" }),
  });
  check(signUp.status >= 400, `nadie puede registrarse con correo y contraseña (HTTP ${signUp.status})`);

  // 3. Límite de contraseñas: 5 por minuto
  const statuses = [];
  for (let i = 0; i < 6; i++) {
    const r = await fetch(`${base}/api/auth/sign-in/email`, {
      method: "POST",
      headers: { "content-type": "application/json", origin: base, "x-forwarded-for": "203.0.113.60" },
      body: JSON.stringify({ email: "pruebas@inworldenergy.local", password: `equivocada-${i}` }),
    });
    statuses.push(r.status);
  }
  check(statuses[5] === 429, `al sexto intento de contraseña en un minuto, espera (${statuses.join(", ")})`);

  // 4. Sin sesión, nada personal ni de administración
  const PRIVATE_ROUTES = [
    ["GET", "/api/portfolio"],
    ["GET", "/api/transactions"],
    ["GET", "/api/transactions/export"],
    ["GET", "/api/receipts/IWE-0000000000"],
    ["GET", "/api/profile"],
    ["GET", "/api/profile/data"],
    ["GET", "/api/profile/deletion"],
    ["POST", "/api/profile/deletion"],
    ["POST", "/api/withdrawals"],
    ["POST", "/api/payments/transfer"],
    ["POST", "/api/payments/transfer/report"],
  ];
  const ADMIN_ROUTES = [
    ["GET", "/api/admin/overview"],
    ["GET", "/api/admin/clients"],
    ["POST", "/api/admin/manual-payments"],
    ["GET", "/api/admin/analytics"],
    ["GET", "/api/admin/audit"],
    ["GET", "/api/admin/payments/export"],
    ["GET", "/api/admin/alerts"],
    ["POST", "/api/admin/alerts"],
    ["GET", "/api/admin/transfer-settings"],
    ["PUT", "/api/admin/transfer-settings"],
    ["POST", "/api/admin/payments/XGE-0000000000"],
    ["POST", "/api/admin/data-requests/dat-0000"],
    ["GET", "/api/admin/backup"],
  ];
  for (const [method, path] of [...PRIVATE_ROUTES, ...ADMIN_ROUTES]) {
    const r = await fetch(`${base}${path}`, { method, headers: { "content-type": "application/json", origin: base }, body: method === "POST" ? "{}" : undefined });
    check(r.status === 401, `sin sesión ${method} ${path} → ${r.status}`);
  }

  // 5. Con sesión de empresa (cuenta de pruebas)
  // CHROMIUM_PATH: un Chromium ya instalado (por ejemplo, si la versión de Playwright no trae el suyo).
  const browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage();
  const errors = [];
  page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
  page.on("pageerror", (e) => errors.push(String(e)));
  await page.goto(`${base}/ingresar`, { waitUntil: "load" });
  await page.getByRole("button", { name: "Entrar con la cuenta de pruebas" }).click();
  await page.waitForURL(/\/panel/, { timeout: 60000 });
  const cookies = (await ctx.cookies()).map((c) => `${c.name}=${c.value}`).join("; ");
  const asUser = (path, init = {}) => fetch(`${base}${path}`, { ...init, headers: { cookie: cookies, "content-type": "application/json", origin: base, ...(init.headers ?? {}) } });
  check((await asUser("/api/portfolio")).status === 200, "con sesión, la empresa ve su resumen");
  check((await asUser("/api/admin/overview")).status === 403, "una empresa no entra a la API de administración (403)");
  for (const [method, path] of ADMIN_ROUTES) {
    const r = await asUser(path, { method, body: method === "GET" ? undefined : "{}" });
    check(r.status === 403, `con sesión de empresa ${method} ${path} → ${r.status}`);
  }
  const report = await asUser("/api/payments/transfer/report", { method: "POST", headers: { origin: "https://sitio-malicioso.com" }, body: JSON.stringify({ planId: "p180", receipt: "COMP-1234" }) });
  check(report.status === 403, `un aviso de transferencia desde otro sitio se rechaza (CSRF → ${report.status})`);
  const deletion = await asUser("/api/profile/deletion", { method: "POST", headers: { origin: "https://sitio-malicioso.com" }, body: "{}" });
  check(deletion.status === 403, `pedir la eliminación de la cuenta desde otro sitio se rechaza (CSRF → ${deletion.status})`);
  const renamed = await asUser("/api/auth/update-user", { method: "POST", body: JSON.stringify({ name: "Soporte", image: "https://sitio-malicioso.com/x.png" }) });
  check(renamed.status === 404, `nadie cambia su nombre ni su foto por fuera de la página (${renamed.status})`);
  const tokens = await asUser("/api/auth/get-access-token", { method: "POST", body: JSON.stringify({ providerId: "google" }) });
  check(tokens.status === 404, `nadie lee los tokens de Google de su cuenta (${tokens.status})`);
  const mine = await asUser("/api/profile/data");
  check(mine.status === 200 && (mine.headers.get("cache-control") ?? "").includes("no-store"), "la descarga de mis datos funciona y no se guarda en cachés");
  const mineText = await mine.text();
  check(!/"token"|accessToken|refreshToken|idToken|password/i.test(mineText), "la descarga de mis datos no trae tokens ni contraseñas");
  check((await asUser("/api/admin/manual-payments", { method: "POST", body: JSON.stringify({ userId: "x", planId: "p180", reference: "TRANSF-1" }) })).status === 403, "una empresa no puede registrar pagos de administrador");
  const csrf = await asUser("/api/wallets", { method: "POST", headers: { origin: "https://sitio-malicioso.com" }, body: JSON.stringify({ address: "0x8ba1f109551bD432803012645Ac136ddd64DBA72", walletName: "x", chainId: 56 }) });
  check(csrf.status === 403, `una petición desde otro sitio con la sesión de la empresa se rechaza (CSRF → ${csrf.status})`);
  const big = await asUser("/api/wallets", { method: "POST", body: JSON.stringify({ address: "0x8ba1f109551bD432803012645Ac136ddd64DBA72", walletName: "x".repeat(200_000), chainId: 56 }) });
  check(big.status === 413, `un cuerpo de más de 100 KB se rechaza (${big.status})`);
  const xss = await asUser("/api/wallets", { method: "POST", body: JSON.stringify({ address: "0x8ba1f109551bD432803012645Ac136ddd64DBA72", walletName: "<img src=x onerror=alert(1)>", chainId: 56 }) });
  check(xss.status === 400, `un nombre con HTML se rechaza (${xss.status})`);
  for (const p of ["/", "/panel", "/panel/planes", "/comprar?plan=p180", "/terminos"]) {
    await page.goto(`${base}${p}`, { waitUntil: "load" });
    await page.waitForTimeout(800);
  }
  const cspErrors = errors.filter((e) => /Content Security Policy|Refused to/i.test(e));
  check(cspErrors.length === 0, `las páginas funcionan con la política de contenido${cspErrors.length ? `: ${cspErrors.slice(0, 3).join(" | ")}` : ""}`);

  // 6. Administración con PIN, y 5 intentos por minuto
  await page.goto(`${base}/ingresar?rol=admin`, { waitUntil: "load" });
  const pin = page.getByLabel("PIN de administrador");
  const submit = page.getByRole("button", { name: "Entrar como administrador de pruebas" });
  const alertText = async () => (await page.getByRole("alert").first().innerText().catch(() => "")).trim();
  for (let i = 0; i < 5; i++) {
    await pin.fill("000000");
    await submit.click();
    await page.getByRole("alert").first().waitFor({ timeout: 15000 });
    await page.waitForTimeout(300);
  }
  check(/no es correcto/i.test(await alertText()), "un PIN equivocado se rechaza");
  await pin.fill(PIN);
  await submit.click();
  await page.waitForTimeout(1500);
  check(/Demasiados intentos/i.test(await alertText()) && !page.url().includes("/admin"), "al sexto intento, ni el PIN correcto entra: hay que esperar un minuto");
  console.log("  (esperando el minuto de bloqueo…)");
  await page.waitForTimeout(61_000);
  await pin.fill(PIN);
  await submit.click();
  await page.waitForURL(/\/admin/, { timeout: 60000 }).catch(() => {});
  check(page.url().includes("/admin"), "pasado el minuto, el PIN correcto entra a la administración");
  for (const p of ["/admin", "/admin/clientes", "/admin/pagos", "/admin/retiros", "/admin/planta", "/admin/analisis", "/admin/actividad", "/admin/configuracion"]) {
    await page.goto(`${base}${p}`, { waitUntil: "load" });
    await page.waitForTimeout(600);
  }
  const cspAdmin = errors.filter((e) => /Content Security Policy|Refused to/i.test(e));
  check(cspAdmin.length === 0, "la administración funciona con la política de contenido");

  await browser.close();
  console.log(failed ? `\n${failed} comprobaciones fallaron` : "\nTodas las comprobaciones pasaron");
  process.exit(failed ? 1 : 0);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
