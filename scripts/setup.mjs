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
  writeFileSync(envFile, template.replace(/^BETTER_AUTH_SECRET=.*$/m, `BETTER_AUTH_SECRET=${secret}`));
  console.log("✓ Creé .env.local con una clave secreta nueva");
}
mkdirSync(path.join(root, "data"), { recursive: true });

const env = readFileSync(envFile, "utf8");
const has = (k) => new RegExp(`^${k}=\\S+`, "m").test(env);
console.log(`✓ Google: ${has("GOOGLE_CLIENT_ID") && has("GOOGLE_CLIENT_SECRET") ? "configurado" : "sin configurar (se usa la cuenta demo)"}`);
console.log(`✓ Trust Wallet por QR: ${has("NEXT_PUBLIC_REOWN_PROJECT_ID") ? "configurado" : "sin configurar (funcionan la extensión y la wallet demo)"}`);
console.log("✓ Base de datos: se crea sola en data/solaxy.db al abrir la app\n");
