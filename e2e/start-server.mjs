import { spawn } from "node:child_process";
import os from "node:os";
import path from "node:path";

const url = process.env.E2E_DATABASE_URL;
if (!url?.startsWith(`file:${path.join(os.tmpdir(), "xge-e2e-")}`))
  throw new Error("E2E exige una base temporal aislada.");
const child = spawn(
  process.execPath,
  [
    "node_modules/next/dist/bin/next",
    "start",
    "--hostname",
    "127.0.0.1",
    "--port",
    "4173",
  ],
  {
    stdio: "inherit",
    env: {
      ...process.env,
      NODE_ENV: "production",
      DEMO_MODE: "true",
      VERCEL: "",
      VERCEL_ENV: "",
      DATABASE_URL: url,
      TURSO_DATABASE_URL: "",
      TURSO_AUTH_TOKEN: "",
      DATABASE_AUTH_TOKEN: "",
      BETTER_AUTH_URL: "http://127.0.0.1:4173",
      BETTER_AUTH_SECRET: "xge-e2e-session-key-for-isolated-tests-only-123456",
      ADMIN_PIN: "123456",
      ADMIN_EMAILS: "",
      GOOGLE_CLIENT_ID: "",
      GOOGLE_CLIENT_SECRET: "",
      MERCADOPAGO_ACCESS_TOKEN: "",
      MERCADOPAGO_WEBHOOK_SECRET: "",
      MERCADOPAGO_API_BASE: "",
      CRYPTO_TREASURY_ADDRESS: "",
      CRYPTO_NETWORK: "bsc-testnet",
      BSC_RPC_URL: "",
      SUPPORT_EMAIL: "",
      SUPPORT_WHATSAPP: "",
      CRON_SECRET: "",
      NEXT_PUBLIC_REOWN_PROJECT_ID: "",
      ALLOW_PREVIEW_MIGRATIONS: "",
    },
  },
);
for (const signal of ["SIGINT", "SIGTERM"])
  process.on(signal, () => child.kill(signal));
child.on("exit", (code) => process.exit(code ?? 1));
