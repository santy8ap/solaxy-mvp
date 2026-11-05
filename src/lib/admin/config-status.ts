import "server-only";
import { LEGAL } from "@/config/legal";
import { adminEmails, baseUrl, googleEnabled, isDemoMode } from "@/lib/env";
import { rpcChainReader } from "@/lib/payments/chain";
import { cryptoConfig, wompiConfig } from "@/lib/payments/config";
import { liveCopPrices } from "@/lib/payments/prices";
import { demoDataStats, hasDemoData } from "./demo-reset";

export type CheckState = "ok" | "falta" | "aviso" | "info";

export interface ConfigCheck {
  id: string;
  group: "Modo" | "Base" | "Acceso" | "Wompi" | "Cripto" | "Legal" | "Datos";
  title: string;
  state: CheckState;
  detail: string;
  /** Variables de entorno involucradas, con su nombre exacto */
  vars?: string[];
  /** Si no está en "ok" (o "aviso"), no se puede salir en vivo */
  required: boolean;
  action?: "borrar_datos_demo";
}

const has = (name: string) => Boolean(process.env[name]?.trim());

async function probe<T>(fn: () => Promise<T>, ms = 6000): Promise<T> {
  return Promise.race([fn(), new Promise<never>((_, reject) => setTimeout(() => reject(new Error("tiempo agotado")), ms))]);
}

/**
 * Qué está configurado y qué falta para cobrar de verdad. Con `probes`, además prueba en vivo
 * la llave de Wompi, el nodo de BNB Chain y el precio de CoinGecko (cada uno con tiempo límite).
 */
export async function configStatus({ probes = false }: { probes?: boolean } = {}) {
  const demo = isDemoMode();
  const w = wompiConfig();
  const c = cryptoConfig();
  const webhookUrl = `${baseUrl()}/api/webhooks/wompi`;
  const checks: ConfigCheck[] = [];
  const add = (check: ConfigCheck) => checks.push(check);

  add({
    id: "modo",
    group: "Modo",
    title: demo ? "Modo demo activo" : "Cobros reales activos",
    state: demo ? "info" : "ok",
    detail: demo
      ? "Hay cuenta demo, wallet demo y pagos simulados. Cuando todo lo de abajo esté listo, pon DEMO_MODE=false y vuelve a desplegar."
      : "Solo se aceptan pagos con Wompi y cripto real.",
    vars: ["DEMO_MODE"],
    required: false,
  });

  const turso = has("TURSO_DATABASE_URL");
  add({
    id: "base",
    group: "Base",
    title: "Base de datos persistente",
    state: turso ? "ok" : process.env.VERCEL ? "falta" : "info",
    detail: turso ? "Conectada a Turso." : process.env.VERCEL ? "Sin Turso, los datos se borran cuando Vercel reinicia la función. Conéctalo en Vercel → Storage." : "Archivo local (data/solaxy.db).",
    vars: ["TURSO_DATABASE_URL", "TURSO_AUTH_TOKEN"],
    required: Boolean(process.env.VERCEL),
  });
  add({
    id: "secreto",
    group: "Acceso",
    title: "Clave de sesiones",
    state: has("BETTER_AUTH_SECRET") ? "ok" : "falta",
    detail: has("BETTER_AUTH_SECRET") ? "Configurada." : "Sin ella la app no arranca en producción.",
    vars: ["BETTER_AUTH_SECRET"],
    required: true,
  });
  add({
    id: "url",
    group: "Acceso",
    title: "URL pública",
    state: has("BETTER_AUTH_URL") ? "ok" : "aviso",
    detail: has("BETTER_AUTH_URL") ? baseUrl() : `Se usa ${baseUrl()}. Configúrala si usas un dominio propio.`,
    vars: ["BETTER_AUTH_URL"],
    required: false,
  });
  add({
    id: "google",
    group: "Acceso",
    title: "Ingreso con Google",
    state: googleEnabled ? "ok" : "falta",
    detail: googleEnabled ? "Configurado." : "Sin modo demo, es la única forma de entrar.",
    vars: ["GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET"],
    required: true,
  });
  add({
    id: "admin-pin",
    group: "Acceso",
    title: "PIN de administrador",
    state: has("ADMIN_PIN") ? "ok" : "falta",
    detail: has("ADMIN_PIN") ? "Configurado." : "Sin ADMIN_PIN, en producción nadie puede entrar al admin.",
    vars: ["ADMIN_PIN"],
    required: true,
  });
  const admins = adminEmails();
  add({
    id: "admin-correos",
    group: "Acceso",
    title: "Correos de administradores",
    state: admins.length ? "ok" : "falta",
    detail: admins.length ? admins.join(", ") : "Con dinero real, solo estos correos (además del PIN) pueden entrar al admin.",
    vars: ["ADMIN_EMAILS"],
    required: true,
  });

  const validKey = w.publicKey.startsWith("pub_test_") || w.publicKey.startsWith("pub_prod_");
  add({
    id: "wompi-llave",
    group: "Wompi",
    title: "Llave pública de Wompi",
    state: !w.publicKey || !validKey ? "falta" : w.sandbox ? (demo ? "aviso" : "falta") : "ok",
    detail: !w.publicKey
      ? "Cópiala del panel de Wompi (pub_test_… para pruebas, pub_prod_… para cobrar)."
      : !validKey
        ? "No parece una llave pública de Wompi (debe empezar por pub_test_ o pub_prod_)."
        : w.sandbox
          ? demo
            ? "Es una llave de pruebas (sandbox): no se cobra dinero real."
            : "Con dinero real usa la llave de producción (pub_prod_…): la de pruebas no cobra."
          : "Llave de producción.",
    vars: ["WOMPI_PUBLIC_KEY"],
    required: true,
  });
  add({
    id: "wompi-integridad",
    group: "Wompi",
    title: "Secreto de integridad",
    state: w.integritySecret ? "ok" : "falta",
    detail: w.integritySecret ? "Configurado (firma el checkout)." : "En Wompi: Desarrolladores → Secretos para integración técnica.",
    vars: ["WOMPI_INTEGRITY_SECRET"],
    required: true,
  });
  add({
    id: "wompi-eventos",
    group: "Wompi",
    title: "Eventos (webhook)",
    state: w.eventsSecret ? "ok" : "falta",
    detail: `${w.eventsSecret ? "Secreto configurado." : "Falta el secreto de eventos."} En Wompi, la URL de eventos debe ser ${webhookUrl}`,
    vars: ["WOMPI_EVENTS_SECRET"],
    required: true,
  });

  add({
    id: "cripto-billetera",
    group: "Cripto",
    title: "Billetera de la empresa",
    state: c.treasury ? "ok" : "falta",
    detail: c.treasury ? `${c.treasury} · ${c.explorer}/address/${c.treasury}` : "Solo la dirección pública (0x…). Nunca la frase semilla.",
    vars: ["CRYPTO_TREASURY_ADDRESS"],
    required: true,
  });
  add({
    id: "cripto-red",
    group: "Cripto",
    title: "Red",
    state: c.network === "bsc" ? "ok" : demo ? "aviso" : "falta",
    detail: c.network === "bsc" ? `BNB Smart Chain (56), ${c.confirmations} confirmaciones.` : `Red de pruebas (97): no se reciben pagos reales. ${c.confirmations} confirmaciones.`,
    vars: ["CRYPTO_NETWORK", "CRYPTO_CONFIRMATIONS"],
    required: true,
  });

  add({
    id: "legal",
    group: "Legal",
    title: "Términos y Política de Datos",
    state: LEGAL.reviewed ? "ok" : "aviso",
    detail: LEGAL.reviewed ? `Versión ${LEGAL.version}.` : "Están en borrador: un abogado debe revisarlos y completar los datos de la empresa (src/config/legal.ts).",
    required: false,
  });

  const stats = await demoDataStats();
  const leftovers = hasDemoData(stats);
  add({
    id: "datos-demo",
    group: "Datos",
    title: "Datos de demostración",
    state: !leftovers ? "ok" : demo ? "info" : "falta",
    detail: !leftovers
      ? "No quedan datos de demostración."
      : `Quedan ${[
          stats.fakeUsers ? `${stats.fakeUsers} inversionistas ficticios` : "",
          stats.demoAccount ? "la cuenta demo" : "",
          stats.simulatedTx ? `${stats.simulatedTx} pagos simulados o de prueba` : "",
        ]
          .filter(Boolean)
          .join(", ")}.${demo ? " Se borran después de desactivar el modo demo." : " Bórralos antes de recibir pagos reales."}`,
    required: !demo,
    ...(leftovers && !demo ? { action: "borrar_datos_demo" as const } : {}),
  });

  if (probes) {
    if (w.publicKey) {
      try {
        const res = await probe(() => fetch(`${w.apiBase}/merchants/${encodeURIComponent(w.publicKey)}`, { cache: "no-store" }));
        const json = (await res.json().catch(() => ({}))) as { data?: { name?: string } };
        add({ id: "wompi-prueba", group: "Wompi", title: "Conexión con Wompi", state: res.ok ? "ok" : "falta", detail: res.ok ? `Wompi reconoce la llave${json.data?.name ? ` (comercio: ${json.data.name})` : ""}.` : `Wompi respondió ${res.status}: revisa la llave pública.`, required: true });
      } catch (err) {
        add({ id: "wompi-prueba", group: "Wompi", title: "Conexión con Wompi", state: "falta", detail: `No se pudo conectar: ${(err as Error).message}.`, required: true });
      }
    }
    try {
      const chainId = await probe(() => rpcChainReader(c.rpcUrl).getChainId());
      add({ id: "cripto-nodo", group: "Cripto", title: "Nodo de BNB Chain", state: chainId === c.chainId ? "ok" : "falta", detail: chainId === c.chainId ? `Responde en la red ${chainId}.` : `El nodo está en la red ${chainId}, se esperaba ${c.chainId}.`, vars: ["BSC_RPC_URL"], required: true });
    } catch (err) {
      add({ id: "cripto-nodo", group: "Cripto", title: "Nodo de BNB Chain", state: "falta", detail: `No responde: ${(err as Error).message}.`, vars: ["BSC_RPC_URL"], required: true });
    }
    try {
      const p = await probe(() => liveCopPrices());
      add({ id: "cripto-precio", group: "Cripto", title: "Precio en vivo", state: "ok", detail: `1 USDT = $${Math.round(p.USDT).toLocaleString("es-CO")} · 1 BNB = $${Math.round(p.BNB).toLocaleString("es-CO")} (CoinGecko).`, vars: ["COINGECKO_API_KEY"], required: true });
    } catch (err) {
      add({ id: "cripto-precio", group: "Cripto", title: "Precio en vivo", state: "falta", detail: (err as Error).message, vars: ["COINGECKO_API_KEY"], required: true });
    }
  }

  const blocking = checks.filter((k) => k.required && k.state === "falta");
  return { demoMode: demo, readyForLive: blocking.length === 0, missing: blocking.length, checks, webhookUrl };
}

export type ConfigStatus = Awaited<ReturnType<typeof configStatus>>;
