import "server-only";
import { LEGAL } from "@/config/legal";
import { databaseTarget } from "@/lib/db/target";
import { alertConfig } from "@/lib/alerts";
import { getTransferAccount } from "@/lib/payments/transfer";
import { adminEmails, baseUrl, googleEnabled, isDemoMode } from "@/lib/env";
import { rpcChainReader } from "@/lib/payments/chain";
import { cryptoConfig, mercadoPagoConfig } from "@/lib/payments/config";
import { isMercadoPagoTest } from "@/lib/payments/mercadopago-account";
import { liveCopPrices } from "@/lib/payments/prices";
import { demoDataStats, hasDemoData } from "./demo-reset";
import { cronConfigured } from "@/lib/jobs/auth";
import { getSupport } from "@/lib/support";

export type CheckState = "ok" | "falta" | "aviso" | "info";

export interface ConfigCheck {
  id: string;
  group:
    | "Modo"
    | "Base"
    | "Acceso"
    | "Mercado Pago"
    | "Cripto"
    | "Legal"
    | "Datos"
    | "Soporte"
    | "Transferencia"
    | "Alertas";
  title: string;
  state: CheckState;
  detail: string;
  /** Variables de entorno involucradas, con su nombre exacto */
  vars?: string[];
  /** Si no está en "ok" (o "aviso"), no se puede salir en vivo */
  required: boolean;
  action?: "borrar_datos_prueba";
}

const has = (name: string) => Boolean(process.env[name]?.trim());

async function probe<T>(fn: () => Promise<T>, ms = 6000): Promise<T> {
  return Promise.race([
    fn(),
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error("tiempo agotado")), ms),
    ),
  ]);
}

/**
 * Qué está configurado y qué falta para cobrar de verdad. Con `probes`, además prueba en vivo
 * la cuenta de Mercado Pago, el nodo de BNB Chain y el precio de CoinGecko (cada uno con tiempo límite).
 */
export async function configStatus({
  probes = false,
}: { probes?: boolean } = {}) {
  const demo = isDemoMode();
  const mp = mercadoPagoConfig();
  // Las credenciales de prueba nuevas empiezan por APP_USR- como las reales: se le pregunta a Mercado Pago.
  const mpTest = await isMercadoPagoTest();
  const c = cryptoConfig();
  const webhookUrl = `${baseUrl()}/api/webhooks/mercadopago`;
  const checks: ConfigCheck[] = [];
  const add = (check: ConfigCheck) => checks.push(check);

  add({
    id: "modo",
    group: "Modo",
    title: demo ? "Modo de pruebas activo" : "Cobros reales activos",
    state: demo ? "falta" : "ok",
    detail: demo
      ? "Hay cuenta de pruebas y pago de prueba, y los pagos de prueba de Mercado Pago o de testnet activan planes. Cuando todo lo de abajo esté listo, pon DEMO_MODE=false y vuelve a desplegar."
      : "Solo activan planes los pagos con dinero real: Mercado Pago, cripto en la red principal y los que registra el administrador.",
    vars: ["DEMO_MODE"],
    required: true,
  });

  const target = databaseTarget();
  const persistent = target.kind === "principal" || target.kind === "pruebas";
  add({
    id: "base",
    group: "Base",
    title: "Base de datos persistente",
    state: persistent ? "ok" : process.env.VERCEL ? "falta" : "info",
    detail:
      target.kind === "pruebas"
        ? "Esta vista previa usa su propia base de pruebas, separada de la de producción."
        : target.kind === "principal"
          ? "Conectada a Turso."
          : process.env.VERCEL_ENV === "preview"
            ? "Esta vista previa no tiene base propia: usa un archivo temporal y nunca la base de producción. Conéctale una en Vercel › Storage con el prefijo PREVIEW."
            : process.env.VERCEL
              ? "Sin Turso, los datos se borran cuando Vercel reinicia la función. Conéctalo en Vercel › Storage."
              : "Archivo local (data/iwe.db).",
    vars: process.env.VERCEL_ENV === "preview" ? ["PREVIEW_TURSO_DATABASE_URL", "PREVIEW_TURSO_AUTH_TOKEN"] : ["TURSO_DATABASE_URL", "TURSO_AUTH_TOKEN"],
    required: Boolean(process.env.VERCEL),
  });
  add({
    id: "secreto",
    group: "Acceso",
    title: "Clave de sesiones",
    state: has("BETTER_AUTH_SECRET") ? "ok" : "falta",
    detail: has("BETTER_AUTH_SECRET")
      ? "Configurada."
      : "Sin ella la app no arranca en producción.",
    vars: ["BETTER_AUTH_SECRET"],
    required: true,
  });
  add({
    id: "url",
    group: "Acceso",
    title: "URL pública",
    state: has("BETTER_AUTH_URL") ? "ok" : "aviso",
    detail: has("BETTER_AUTH_URL")
      ? baseUrl()
      : `Se usa ${baseUrl()}. Configúrala si usas un dominio propio.`,
    vars: ["BETTER_AUTH_URL"],
    required: false,
  });
  add({
    id: "google",
    group: "Acceso",
    title: "Ingreso con Google",
    state: googleEnabled ? "ok" : "falta",
    detail: googleEnabled
      ? "Configurado."
      : "Con cobros reales es la única forma de entrar.",
    vars: ["GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET"],
    required: true,
  });
  add({
    id: "admin-pin",
    group: "Acceso",
    title: "PIN de administrador",
    state: has("ADMIN_PIN") ? "ok" : "falta",
    detail: has("ADMIN_PIN")
      ? "Configurado."
      : "Sin ADMIN_PIN, en producción nadie puede entrar al admin.",
    vars: ["ADMIN_PIN"],
    required: true,
  });
  const admins = adminEmails();
  add({
    id: "admin-correos",
    group: "Acceso",
    title: "Correos de administradores",
    state: admins.length ? "ok" : "falta",
    detail: admins.length
      ? admins.join(", ")
      : "Con dinero real, solo estos correos (además del PIN) pueden entrar al admin.",
    vars: ["ADMIN_EMAILS"],
    required: true,
  });

  add({
    id: "mp-token",
    group: "Mercado Pago",
    title: "Access Token de Mercado Pago",
    state: !mp.enabled ? "falta" : mpTest ? (demo ? "aviso" : "falta") : "ok",
    detail: !mp.accessToken
      ? "En Mercado Pago › Tus integraciones › tu aplicación › Credenciales: las de prueba para probar, las de producción para cobrar."
      : !mp.enabled
        ? "No parece un Access Token de Mercado Pago (empieza por APP_USR- o TEST-)."
        : mpTest
          ? demo
            ? "Son credenciales de prueba: no se cobra dinero real."
            : "Con dinero real usa las credenciales de la pestaña Producción: las de prueba no cobran."
          : "Credenciales de producción.",
    vars: ["MERCADOPAGO_ACCESS_TOKEN"],
    required: true,
  });
  add({
    id: "mp-webhook",
    group: "Mercado Pago",
    title: "Notificaciones (webhook)",
    state: mp.webhookSecret ? "ok" : "falta",
    detail: `${mp.webhookSecret ? "Clave secreta configurada." : "Falta la clave secreta de las notificaciones."} En Mercado Pago › Webhooks, la URL debe ser ${webhookUrl} con el evento Pagos.`,
    vars: ["MERCADOPAGO_WEBHOOK_SECRET"],
    required: true,
  });

  add({
    id: "cripto-billetera",
    group: "Cripto",
    title: "Billetera de la empresa",
    state: c.treasury ? "ok" : "falta",
    detail: c.treasury
      ? `${c.treasury} · ${c.explorer}/address/${c.treasury}`
      : "Solo la dirección pública (0x…). Nunca la frase semilla.",
    vars: ["CRYPTO_TREASURY_ADDRESS"],
    required: true,
  });
  add({
    id: "cripto-red",
    group: "Cripto",
    title: "Red",
    state: c.network === "bsc" ? "ok" : demo ? "aviso" : "falta",
    detail:
      c.network === "bsc"
        ? `BNB Smart Chain (56), ${c.confirmations} confirmaciones.`
        : `Red de pruebas (97): no se reciben pagos reales. ${c.confirmations} confirmaciones.`,
    vars: ["CRYPTO_NETWORK", "CRYPTO_CONFIRMATIONS"],
    required: true,
  });

  add({
    id: "legal",
    group: "Legal",
    title: "Términos y Política de Datos",
    state: LEGAL.reviewed ? "ok" : "falta",
    detail: LEGAL.reviewed
      ? `Versión ${LEGAL.version}.`
      : "Están en borrador: un abogado debe revisarlos y completar los datos de la empresa (src/config/legal.ts).",
    required: true,
  });

  const support = await getSupport();
  add({
    id: "soporte",
    group: "Soporte",
    title: "Contacto oficial de soporte",
    state: support.email || support.whatsapp ? "ok" : "falta",
    detail:
      support.email || support.whatsapp
        ? "Hay un contacto publicado en el centro de ayuda."
        : "Guarda un correo o WhatsApp real más abajo, en «Atención al comercializador».",
    required: true,
  });
  add({
    id: "cripto-reconciliacion",
    group: "Cripto",
    title: "Verificación en segundo plano",
    state: cronConfigured() ? "aviso" : "falta",
    detail: cronConfigured()
      ? "Clave configurada. El cron incluido es diario; confirma sus ejecuciones en Vercel y ajusta la frecuencia para la operación comercial."
      : "Configura CRON_SECRET (32 caracteres o más) y vuelve a desplegar para verificar pagos sin visitas al panel.",
    vars: ["CRON_SECRET"],
    required: c.enabled,
  });

  const alerts = alertConfig();
  const transfer = await getTransferAccount();
  add({
    id: "transferencia",
    group: "Transferencia",
    title: "Cuenta para transferencias",
    state: transfer ? "ok" : "aviso",
    detail: transfer
      ? `Las empresas ven la cuenta ${transfer.accountType} de ${transfer.bank} terminada en ${transfer.accountNumber.slice(-4)}.`
      : "Sin ella no aparece el pago por transferencia, y los planes de más de $ 50.000.000 al mes solo se pagan por PSE o cripto. Guárdala más abajo, en «Cuenta para transferencias».",
    required: false,
  });
  add({
    id: "alertas",
    group: "Alertas",
    title: "Alertas por correo",
    state: alerts.enabled ? "ok" : "aviso",
    detail: alerts.enabled
      ? `Llegan a ${alerts.to.length === 1 ? "1 correo" : `${alerts.to.length} correos`}. Pruébalas más abajo, en «Alertas por correo».`
      : process.env.RESEND_API_KEY?.trim()
        ? "Falta a quién enviarlas: agrega tu correo a ALERT_EMAIL o a ADMIN_EMAILS."
        : "Crea una clave en resend.com y guárdala en Vercel como RESEND_API_KEY (Production, Sensitive). Sin ella no se envían correos.",
    vars: ["RESEND_API_KEY", "ALERT_EMAIL"],
    required: false,
  });

  const stats = await demoDataStats();
  const leftovers = hasDemoData(stats);
  add({
    id: "datos-prueba",
    group: "Datos",
    title: "Datos de prueba",
    state: !leftovers ? "ok" : demo ? "info" : "falta",
    detail: !leftovers
      ? "No quedan datos de prueba."
      : `Quedan ${[stats.demoAccount ? "la cuenta de pruebas" : "", stats.testPayments ? `${stats.testPayments} pagos de prueba` : ""].filter(Boolean).join(" y ")}.${
          demo
            ? " Se borran después de desactivar el modo de pruebas."
            : " Bórralos antes de recibir pagos reales."
        }`,
    required: !demo,
    ...(leftovers && !demo ? { action: "borrar_datos_prueba" as const } : {}),
  });

  if (probes) {
    if (mp.enabled) {
      try {
        const res = await probe(() =>
          fetch(`${mp.apiBase}/users/me`, {
            headers: { authorization: `Bearer ${mp.accessToken}` },
            cache: "no-store",
          }),
        );
        const me = (await res.json().catch(() => ({}))) as {
          nickname?: string;
          site_id?: string;
          tags?: string[];
        };
        const colombia = me.site_id === "MCO";
        const testUser = me.tags?.includes("test_user") ?? false;
        add({
          id: "mp-prueba",
          group: "Mercado Pago",
          title: "Conexión con Mercado Pago",
          state:
            !res.ok || !colombia
              ? "falta"
              : testUser && !demo
                ? "falta"
                : testUser
                  ? "aviso"
                  : "ok",
          detail: !res.ok
            ? `Mercado Pago respondió ${res.status}: revisa el Access Token.`
            : !colombia
              ? `La cuenta ${me.nickname ?? ""} no es de Colombia (${me.site_id ?? "?"}): no puede cobrar en pesos con PSE.`
              : `Cuenta ${me.nickname ?? ""}${testUser ? " (cuenta de prueba: no cobra dinero real)" : ""}.`,
          required: true,
        });
      } catch (err) {
        add({
          id: "mp-prueba",
          group: "Mercado Pago",
          title: "Conexión con Mercado Pago",
          state: "falta",
          detail: `No se pudo conectar: ${(err as Error).message}.`,
          required: true,
        });
      }
    }
    try {
      const chainId = await probe(() => rpcChainReader(c.rpcUrl).getChainId());
      add({
        id: "cripto-nodo",
        group: "Cripto",
        title: "Nodo de BNB Chain",
        state: chainId === c.chainId ? "ok" : "falta",
        detail:
          chainId === c.chainId
            ? `Responde en la red ${chainId}.`
            : `El nodo está en la red ${chainId}, se esperaba ${c.chainId}.`,
        vars: ["BSC_RPC_URL"],
        required: true,
      });
    } catch (err) {
      add({
        id: "cripto-nodo",
        group: "Cripto",
        title: "Nodo de BNB Chain",
        state: "falta",
        detail: `No responde: ${(err as Error).message}.`,
        vars: ["BSC_RPC_URL"],
        required: true,
      });
    }
    try {
      const p = await probe(() => liveCopPrices());
      add({
        id: "cripto-precio",
        group: "Cripto",
        title: "Precio en vivo",
        state: "ok",
        detail: `1 USDT = $${Math.round(p.USDT).toLocaleString("es-CO")} · 1 BNB = $${Math.round(p.BNB).toLocaleString("es-CO")} (CoinGecko).`,
        vars: ["COINGECKO_API_KEY"],
        required: true,
      });
    } catch (err) {
      add({
        id: "cripto-precio",
        group: "Cripto",
        title: "Precio en vivo",
        state: "falta",
        detail: (err as Error).message,
        vars: ["COINGECKO_API_KEY"],
        required: true,
      });
    }
  }

  const blocking = checks.filter((k) => k.required && k.state === "falta");
  return {
    demoMode: demo,
    readyForLive: blocking.length === 0,
    missing: blocking.length,
    checks,
    webhookUrl,
  };
}

export type ConfigStatus = Awaited<ReturnType<typeof configStatus>>;
