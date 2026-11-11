// Prepara el proyecto para correr en cualquier sistema (Windows, macOS, Linux).
// - Revisa la versión de Node.js
// - Crea .env.local con una clave secreta aleatoria si no existe
// - Crea la carpeta data/ (la base de datos se crea sola al primer uso)
import { randomBytes } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const [major, minor] = process.versions.node.split(".").map(Number);
if (major < 20 || (major === 20 && minor < 9)) {
  console.error(`\n✗ Necesitas Node.js 20.9 o más reciente (tienes ${process.versions.node}). Instala la versión LTS desde https://nodejs.org\n`);
  process.exit(1);
}

const envFile = path.join(root, ".env.local");
if (!existsSync(envFile)) {
  const template = readFileSync(path.join(root, ".env.example"), "utf8");
  const secret = randomBytes(32).toString("hex");
  // PIN de 6 dígitos sin sesgo (rechazo de valores fuera de rango).
  let n;
  do n = randomBytes(4).readUInt32BE(0);
  while (n >= 4_294_000_000);
  const pin = String(n % 1_000_000).padStart(6, "0");
  writeFileSync(
    envFile,
    template.replace(/^BETTER_AUTH_SECRET=.*$/m, `BETTER_AUTH_SECRET=${secret}`).replace(/^ADMIN_PIN=.*$/m, `ADMIN_PIN=${pin}`),
  );
  console.log("✓ Creé .env.local con una clave secreta nueva");
  console.log(`✓ PIN de administrador: ${pin}  (guárdalo: también queda en .env.local como ADMIN_PIN)`);
}
mkdirSync(path.join(root, "data"), { recursive: true });

const env = readFileSync(envFile, "utf8");
const has = (k) => new RegExp(`^${k}=\\S+`, "m").test(env);
const demo = !/^DEMO_MODE=(false|0|no|off)\s*$/im.test(env);
console.log(`✓ Modo: ${demo ? "demo (pagos simulados)" : "producción (cobros reales)"}`);
console.log(`✓ Google: ${has("GOOGLE_CLIENT_ID") && has("GOOGLE_CLIENT_SECRET") ? "configurado" : "sin configurar (se usa la cuenta demo)"}`);
console.log(`✓ Admin: ${has("ADMIN_PIN") ? "PIN configurado en .env.local" : "PIN de administrador generado arriba (guárdalo; sin él no se puede entrar al admin)"}`);
console.log(`✓ Mercado Pago: ${has("MERCADOPAGO_ACCESS_TOKEN") ? "configurado" : "sin configurar"}`);
console.log(`✓ Cripto directo: ${has("CRYPTO_TREASURY_ADDRESS") ? "configurado" : "sin configurar"}`);
console.log(`✓ Trust Wallet por QR: ${has("NEXT_PUBLIC_REOWN_PROJECT_ID") ? "configurado" : "sin configurar (funcionan la extensión y la wallet demo)"}`);
console.log("✓ Base de datos: se crea sola en data/solaxy.db al abrir la app\n");

// Recordatorio de variables críticas según el modo.
if (demo) {
  console.log("⚠ Modo demo activo: los pagos están simulados. Para cobros reales, define DEMO_MODE=false y configura todas las variables de producción.");
} else {
  const missing = [];
  if (!has("BETTER_AUTH_SECRET")) missing.push("BETTER_AUTH_SECRET");
  if (!has("ADMIN_PIN")) missing.push("ADMIN_PIN");
  if (!has("GOOGLE_CLIENT_ID") || !has("GOOGLE_CLIENT_SECRET")) missing.push("GOOGLE_CLIENT_ID/SECRET");
  if (!has("MERCADOPAGO_ACCESS_TOKEN")) missing.push("MERCADOPAGO_ACCESS_TOKEN");
  if (!has("MERCADOPAGO_WEBHOOK_SECRET")) missing.push("MERCADOPAGO_WEBHOOK_SECRET (obligatoria con dinero real)");
  if (!has("CRYPTO_TREASURY_ADDRESS")) missing.push("CRYPTO_TREASURY_ADDRESS");
  if (missing.length > 0) {
    console.log("\n⚠ Faltan variables críticas en modo producción: " + missing.join(", "));
    console.log("   Revisa .env.local y .env.example. Consulta la ruta /api/health para diagnóstico.\n");
  }
}
