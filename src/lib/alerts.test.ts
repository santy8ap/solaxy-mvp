import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { formatCop } from "@/lib/format";
import { createUser } from "../../tests/helpers";

process.env.DATABASE_URL = `file:${path.join(mkdtempSync(path.join(tmpdir(), "xge-alerts-")), "test.db")}`;
vi.stubEnv("BETTER_AUTH_SECRET", "secreto-de-prueba-suficientemente-largo-123");

let alerts: typeof import("@/lib/alerts");

beforeAll(async () => {
  alerts = await import("@/lib/alerts");
  // Sin perfil: el nombre sale de la cuenta (viene de Google, sin filtrar) y debe llegar escapado.
  await createUser("a1", { profile: false, name: "Solar <b>Andina</b> S.A.S." });
}, 120_000);

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.stubEnv("BETTER_AUTH_SECRET", "secreto-de-prueba-suficientemente-largo-123");
});

/** Resend falso: guarda lo que se le envía y responde como la API real. */
function fakeResend(reply: (to: string) => Response = () => new Response(JSON.stringify({ id: "email-1" }))) {
  const sent: { url: string; auth: string; body: { from: string; to: string[]; subject: string; text: string; html: string } }[] = [];
  const fetch = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
    const body = JSON.parse(String(init?.body));
    sent.push({ url: String(url), auth: new Headers(init?.headers).get("authorization") ?? "", body });
    return reply(body.to[0]);
  });
  vi.stubGlobal("fetch", fetch);
  return { fetch, sent };
}

function configure(env: Record<string, string> = {}) {
  vi.stubEnv("RESEND_API_KEY", "re_clave_de_prueba");
  vi.stubEnv("ADMIN_EMAILS", "admin@empresa.co, pruebas@inworldenergy.local");
  for (const [k, v] of Object.entries(env)) vi.stubEnv(k, v);
}

describe("a quién y desde dónde se envían", () => {
  it("sin la clave de Resend no se envía nada", () => {
    vi.stubEnv("RESEND_API_KEY", "");
    vi.stubEnv("ADMIN_EMAILS", "admin@empresa.co");
    expect(alerts.alertConfig()).toMatchObject({ enabled: false, to: ["admin@empresa.co"] });
  });

  it("va a los administradores, sin la cuenta de pruebas, desde el remitente de pruebas de Resend", () => {
    configure();
    expect(alerts.alertConfig()).toEqual({ enabled: true, to: ["admin@empresa.co"], from: "X green Energy <onboarding@resend.dev>" });
  });

  it("ALERT_EMAIL manda sobre ADMIN_EMAILS; se descartan los correos inválidos y hay un máximo de 5", () => {
    configure({ ALERT_EMAIL: "Dueno@Empresa.co, no-es-correo, a@b.co, c@d.co, e@f.co, g@h.co, i@j.co", ALERT_FROM: "Alertas <alertas@xgreen.co>" });
    const cfg = alerts.alertConfig();
    expect(cfg.to).toEqual(["dueno@empresa.co", "a@b.co", "c@d.co", "e@f.co", "g@h.co"]);
    expect(cfg.from).toBe("Alertas <alertas@xgreen.co>");
  });

  it("sin destinatarios válidos queda apagada aunque haya clave", () => {
    configure({ ADMIN_EMAILS: "pruebas@inworldenergy.local" });
    expect(alerts.alertConfig().enabled).toBe(false);
  });
});

describe("el contenido del correo", () => {
  it("escapa lo que escriben los usuarios y enlaza al admin", () => {
    const r = alerts.renderAlert(
      { kind: "retiro", subject: "Retiro\r\npor aprobar", lines: ['<script>alert("x")</script> pidió un retiro'], path: "/admin/retiros" },
      { demo: false, url: "https://solaxy-mvp.vercel.app" },
    );
    expect(r.subject).toBe("Retiro por aprobar");
    expect(r.html).not.toContain("<script>");
    expect(r.html).toContain("&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt;");
    expect(r.html).toContain('href="https://solaxy-mvp.vercel.app/admin/retiros"');
    expect(r.text).toContain("https://solaxy-mvp.vercel.app/admin/retiros");
  });

  it("en modo de pruebas lo dice en el asunto y al final", () => {
    const r = alerts.renderAlert(alerts.alertMessages.test(), { demo: true, url: null });
    expect(r.subject).toMatch(/^\[Pruebas\] /);
    expect(r.text).toMatch(/no son dinero real/);
  });

  it("la transferencia trae la referencia y el comprobante que hay que buscar en el banco", () => {
    const a = alerts.alertMessages.transferReported(
      { id: "IWE-1", userId: "a1", amountCop: 59_400_000, method: "transferencia", periodIndex: 2, subscriptionId: "PLN-1A2B3C4D", txHash: "COMP-55" },
      "Energía Andina S.A.S.",
    );
    expect(a.subject).toBe(`Transferencia por confirmar: ${formatCop(59_400_000)}`);
    expect(a.lines.join(" ")).toContain("PLN-1A2B3C4D-M2");
    expect(a.lines.join(" ")).toContain("COMP-55");
  });
});

describe("el envío con Resend", () => {
  it("un correo por destinatario, con la clave en el encabezado y el mensaje en texto y HTML", async () => {
    configure({ ALERT_EMAIL: "uno@empresa.co, dos@empresa.co" });
    const { sent } = fakeResend();
    const r = await alerts.deliverAlert(alerts.alertMessages.test());
    expect(r).toEqual([
      { to: "uno@empresa.co", ok: true },
      { to: "dos@empresa.co", ok: true },
    ]);
    expect(sent).toHaveLength(2);
    expect(sent[0]).toMatchObject({ url: "https://api.resend.com/emails", auth: "Bearer re_clave_de_prueba" });
    expect(sent[0].body).toMatchObject({ from: "X green Energy <onboarding@resend.dev>", to: ["uno@empresa.co"] });
    expect(sent[0].body.subject).toMatch(/Prueba de las alertas/);
    expect(sent[0].body.text).toMatch(/las alertas por correo funcionan/);
    expect(sent[0].body.html).toMatch(/<p/);
  });

  it("cuenta qué respondió Resend cuando no entrega", async () => {
    configure({ ALERT_EMAIL: "otro@empresa.co" });
    fakeResend(() => new Response(JSON.stringify({ statusCode: 403, message: "You can only send testing emails to your own email address" }), { status: 403 }));
    const [r] = await alerts.deliverAlert(alerts.alertMessages.test());
    expect(r).toMatchObject({ to: "otro@empresa.co", ok: false });
    expect(r.error).toMatch(/^403: You can only send testing emails/);
  });

  it("si Resend no responde, no lanza errores", async () => {
    configure();
    vi.stubGlobal("fetch", vi.fn(async () => Promise.reject(new Error("sin red"))));
    const [r] = await alerts.deliverAlert(alerts.alertMessages.test());
    expect(r).toMatchObject({ ok: false, error: expect.stringMatching(/sin red/) });
  });

  it("sin configurar no llama a Resend", async () => {
    vi.stubEnv("RESEND_API_KEY", "");
    const { fetch } = fakeResend();
    expect(await alerts.deliverAlert(alerts.alertMessages.test())).toEqual([]);
    expect(fetch).not.toHaveBeenCalled();
  });
});

describe("cuándo se envían", () => {
  it("un pago de Mercado Pago avisa con el nombre de la empresa; los que confirma el admin, no", async () => {
    configure();
    const { sent } = fakeResend();
    const base = { id: "IWE-2", userId: "a1", amountCop: 20_880_000, periodIndex: 1, subscriptionId: "PLN-00000001" };
    alerts.alertPaymentConfirmed({ ...base, method: "transferencia" });
    alerts.alertPaymentConfirmed({ ...base, method: "manual" });
    alerts.alertPaymentConfirmed({ ...base, method: "demo" });
    alerts.alertPaymentConfirmed({ ...base, method: "mercadopago" });
    await alerts.flushAlerts();
    expect(sent).toHaveLength(1);
    expect(sent[0].body.subject).toMatch(/Entró un pago de/);
    // El nombre viene de la base y llega escapado en el HTML.
    expect(sent[0].body.text).toContain("Solar <b>Andina</b> S.A.S. pagó el mes 1");
    expect(sent[0].body.html).toContain("Solar &lt;b&gt;Andina&lt;/b&gt; S.A.S.");
  });

  it("una misma falla avisa una sola vez cada 15 minutos", async () => {
    configure();
    const { sent } = fakeResend();
    alerts.alertFailure("prueba-falla", "la prueba", "TypeError: algo salió mal");
    alerts.alertFailure("prueba-falla", "la prueba", "TypeError: algo salió mal");
    alerts.alertFailure("otra-falla", "otra prueba", "Error: otra cosa");
    await alerts.flushAlerts();
    expect(sent.map((s) => s.body.subject)).toEqual(["[Pruebas] Algo falló: la prueba", "[Pruebas] Algo falló: otra prueba"]);
  });

  it("una falla de la base no manda por correo los datos de la consulta", async () => {
    configure();
    const { sent } = fakeResend();
    const error =
      'DrizzleQueryError: Failed query: insert into "company_profile" ("user_id", "full_name", "doc_number", "phone") values (?, ?, ?, ?)\n' +
      "params: u1,Laura Gómez,1036123456,3001234567 LibsqlError: SQLITE_BUSY: database is locked";
    alerts.alertFailure("falla-con-datos", "error inesperado en la API", `${error} (avisar a laura.gomez@empresa.co)`);
    await alerts.flushAlerts();
    expect(sent).toHaveLength(1);
    const { text, html } = sent[0].body;
    for (const body of [text, html]) {
      // Qué falló sí llega (en el HTML, las comillas van escapadas).
      expect(body).toContain("Failed query: insert into");
      expect(body).toContain("company_profile");
      expect(body).toContain("params: [omitidos]");
      for (const personal of ["Laura Gómez", "1036123456", "3001234567", "laura.gomez@empresa.co"]) expect(body).not.toContain(personal);
    }
  });
});
