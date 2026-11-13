import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { formatCop } from "@/lib/format";
import { createUser, fundUser } from "../../tests/helpers";

process.env.DATABASE_URL = `file:${path.join(mkdtempSync(path.join(tmpdir(), "xge-correos-")), "test.db")}`;
vi.stubEnv("BETTER_AUTH_SECRET", "secreto-de-prueba-suficientemente-largo-123");

let mail: typeof import("@/lib/customer-email");
let reminders: typeof import("@/lib/jobs/reminders");
let admin: typeof import("@/lib/admin/service");
let dbMod: typeof import("@/lib/db");
let schema: typeof import("@/lib/db/schema");
let drizzle: typeof import("drizzle-orm");
const actor = { id: "admin-correos", name: "Admin de prueba" };
const BANK = { bank: "Bancolombia", accountType: "ahorros", accountNumber: "123-456789-01" };
const DAY = 86_400_000;

type Sent = { from: string; to: string[]; subject: string; text: string; html: string; reply_to?: string };
let sent: Sent[] = [];
let reply: () => Response = () => new Response(JSON.stringify({ id: "email-1" }));

function enable() {
  vi.stubEnv("RESEND_API_KEY", "re_clave_de_prueba");
  vi.stubEnv("CUSTOMER_EMAIL_FROM", "X green Energy <avisos@xgreenenergy.co>");
  vi.stubEnv("ADMIN_EMAILS", "");
  vi.stubEnv("ALERT_EMAIL", "");
}

/** Lo que se le envió a una persona (por el correo de su cuenta). */
const to = (userId: string) => sent.filter((s) => s.to[0] === `${userId}@empresa.co`);
const flush = async () => mail.flushCustomerEmails();

beforeAll(async () => {
  mail = await import("@/lib/customer-email");
  reminders = await import("@/lib/jobs/reminders");
  admin = await import("@/lib/admin/service");
  dbMod = await import("@/lib/db");
  schema = await import("@/lib/db/schema");
  drizzle = await import("drizzle-orm");
  const { saveSupport } = await import("@/lib/support");
  await saveSupport({ email: "soporte@xgreenenergy.co", whatsapp: "" });
  for (const id of ["m1", "m2", "m3", "m4", "m5", "m6", "m7", "m8"]) await createUser(id, { name: `Empresa ${id}` });
}, 120_000);

beforeEach(() => {
  sent = [];
  reply = () => new Response(JSON.stringify({ id: "email-1" }));
  vi.stubGlobal(
    "fetch",
    vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
      sent.push(JSON.parse(String(init?.body)));
      return reply();
    }),
  );
  enable();
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.stubEnv("BETTER_AUTH_SECRET", "secreto-de-prueba-suficientemente-largo-123");
});

describe("configuración", () => {
  it("apagados sin remitente, con el remitente de pruebas de Resend o sin clave; encendidos con un dominio propio", () => {
    vi.stubEnv("CUSTOMER_EMAIL_FROM", "");
    expect(mail.customerEmailConfig()).toMatchObject({ enabled: false, reason: expect.stringMatching(/CUSTOMER_EMAIL_FROM/) });
    vi.stubEnv("CUSTOMER_EMAIL_FROM", "X green Energy <onboarding@resend.dev>");
    expect(mail.customerEmailConfig()).toMatchObject({ enabled: false, reason: expect.stringMatching(/resend\.dev/) });
    vi.stubEnv("CUSTOMER_EMAIL_FROM", "no es un correo");
    expect(mail.customerEmailConfig().enabled).toBe(false);
    vi.stubEnv("CUSTOMER_EMAIL_FROM", "avisos@xgreenenergy.co");
    vi.stubEnv("RESEND_API_KEY", "");
    expect(mail.customerEmailConfig()).toMatchObject({ enabled: false, reason: expect.stringMatching(/RESEND_API_KEY/) });
    enable();
    expect(mail.customerEmailConfig()).toEqual({ enabled: true, from: "X green Energy <avisos@xgreenenergy.co>", reason: null });
  });

  it("apagados, no se envía nada ni queda constancia", async () => {
    vi.stubEnv("CUSTOMER_EMAIL_FROM", "");
    await admin.registerManualPayment(actor, { userId: "m8", planId: "p180", reference: "BCO-APAGADO-1" });
    await flush();
    expect(sent).toHaveLength(0);
    const rows = await dbMod.db.select().from(schema.customerEmail).where(drizzle.eq(schema.customerEmail.userId, "m8"));
    expect(rows).toHaveLength(0);
  });
});

describe("pagos", () => {
  it("un pago confirmado avisa una sola vez, con los días que genera ese mes, desde el remitente propio y con respuesta a soporte", async () => {
    const tx = await admin.registerManualPayment(actor, { userId: "m1", planId: "p180", reference: "BCO-CORREO-1" });
    await flush();
    const [email, ...rest] = to("m1");
    expect(rest).toHaveLength(0);
    expect(email).toMatchObject({ from: "X green Energy <avisos@xgreenenergy.co>", reply_to: "soporte@xgreenenergy.co" });
    expect(email.subject).toBe(`[Pruebas] Confirmamos tu pago de ${formatCop(20_880_000)}`);
    expect(email.text).toMatch(/^Hola, Laura:/);
    expect(email.text).toMatch(/el mes 1 de tu plan/);
    expect(email.text).toMatch(/Ese mes genera energía del .+ al .+\./);
    expect(email.text).toContain(tx.id);
    expect(email.text).toMatch(/Ver mis movimientos: http:\/\/localhost:\d+\/panel\/billetera/);
    expect(email.text).toContain("soporte@xgreenenergy.co");
    // La misma orden no vuelve a avisar, aunque se pida otra vez.
    const { emailPaymentConfirmed } = mail;
    emailPaymentConfirmed({ ...tx, userId: "m1" });
    await flush();
    expect(to("m1")).toHaveLength(1);
    const [log] = await dbMod.db.select().from(schema.customerEmail).where(drizzle.eq(schema.customerEmail.key, `pago:${tx.id}`));
    expect(log).toMatchObject({ userId: "m1", kind: "pago_confirmado", status: "enviado", attempts: 1 });
  });

  it("el pago de prueba no avisa", async () => {
    await fundUser("m7", { planId: "p180", days: 1 });
    await flush();
    expect(to("m7")).toHaveLength(0);
  });

  it("un pago que llegó pero no se puede usar avisa que se devolverá; al registrar la devolución, avisa con la referencia", async () => {
    const { orderCode } = await import("@/lib/ids");
    const { closeOrder } = await import("@/lib/orders");
    const id = orderCode();
    await dbMod.db.insert(schema.ledgerTx).values({ id, userId: "m2", kind: "plan_mes", status: "verificando", amountCop: 1000, method: "mercadopago", createdAt: Date.now() });
    await closeOrder(id, "por_reembolsar", { note: "Mercado Pago aprobó 1000 COP, que no coincide con la orden." });
    await flush();
    expect(to("m2").map((s) => s.subject)).toEqual([`[Pruebas] Vamos a devolverte un pago de ${formatCop(1000)}`]);
    expect(to("m2")[0].text).toMatch(/no coincide con la orden/);
    const { markRefunded } = await import("@/lib/admin/payments");
    await markRefunded(actor, id, "DEV-MP-4455");
    await flush();
    expect(to("m2")).toHaveLength(2);
    expect(to("m2")[1].text).toMatch(/Referencia de la devolución: DEV-MP-4455\./);
  });

  it("una transferencia que el admin no encontró avisa con el motivo y el enlace para pagar ese mes", async () => {
    const transfer = await import("@/lib/payments/transfer");
    await transfer.saveTransferAccount(actor, { bank: "Bancolombia", accountType: "corriente", accountNumber: "123-456789-01", holder: "X green Energy S.A.S.", holderId: "901234567-1" });
    const { order } = await transfer.reportTransfer({ userId: "m3", planId: "p180", receipt: "COMP-3311" });
    await transfer.rejectTransfer(actor, order.id, "No aparece en el extracto del banco");
    await flush();
    const [email] = to("m3");
    expect(email.subject).toBe("[Pruebas] No pudimos confirmar tu transferencia");
    expect(email.text).toMatch(/No aparece en el extracto del banco/);
    expect(email.text).toContain(`/comprar?suscripcion=${order.subscriptionId}`);
  });
});

describe("retiros", () => {
  it("pagado: dice a qué cuenta y con qué referencia; rechazado: el motivo y que el dinero volvió al saldo", async () => {
    const { createBankWithdrawal } = await import("@/lib/withdrawals");
    await fundUser("m4", { planId: "p360", days: 10 });
    const a = await createBankWithdrawal({ userId: "m4", amountCop: 2_000_000, destination: BANK });
    const b = await createBankWithdrawal({ userId: "m4", amountCop: 1_000_000, destination: BANK });
    await admin.decideWithdrawal(actor, a.id, "aprobar", "", "ENVIO-998877");
    await admin.decideWithdrawal(actor, b.id, "rechazar", "La cuenta no está a nombre del titular");
    await flush();
    const [paid, rejected] = to("m4");
    expect(paid.subject).toBe(`[Pruebas] Pagamos tu retiro de ${formatCop(2_000_000)}`);
    expect(paid.text).toMatch(/a tu cuenta de Bancolombia terminada en 8901\./);
    expect(paid.text).toMatch(/Referencia del envío: ENVIO-998877\./);
    expect(rejected.subject).toBe(`[Pruebas] Tu retiro de ${formatCop(1_000_000)} no se aprobó`);
    expect(rejected.text).toMatch(/Motivo: La cuenta no está a nombre del titular\./);
    expect(rejected.text).toMatch(/El dinero volvió a tu saldo/);
  });
});

describe("recordatorios", () => {
  it("mensualidad por vencer y plan en pausa: uno por plan y por mes, aunque la tarea corra muchas veces", async () => {
    await fundUser("m5", { planId: "p180", days: 26 });
    await fundUser("m6", { planId: "p180", days: 33 });
    const first = await reminders.sendPlanReminders();
    expect(first.enviados).toBeGreaterThanOrEqual(2);
    expect(to("m5").map((s) => s.subject)).toEqual(["[Pruebas] Tu Plan 180 necesita el pago del mes 2"]);
    expect(to("m5")[0].text).toContain(`Paga el mes 2 (${formatCop(20_880_000)}) antes de esa fecha`);
    expect(to("m6").map((s) => s.subject)).toEqual(["[Pruebas] Tu Plan 180 está en pausa"]);
    expect(to("m6")[0].text).toMatch(/Puedes retomarlo hasta el /);
    sent = [];
    expect((await reminders.sendPlanReminders()).enviados).toBe(0);
    expect(sent).toHaveLength(0);
  });

  it("las reglas: avisa 5 días antes de la mensualidad, 7 antes de que termine el plan y no si ya lo renovó", () => {
    const now = Date.UTC(2026, 10, 13, 15);
    const plan = { id: "PLN-1", planId: "p180", planName: "Plan 180", months: 3, paidMonths: 1, paidUntil: now + 6 * DAY, monthlyCop: 20_880_000, graceEndsAt: null };
    expect(reminders.reminderFor({ ...plan, state: "activa" }, now, false)).toBeNull();
    expect(reminders.reminderFor({ ...plan, state: "activa", paidUntil: now + 4 * DAY }, now, false)?.key).toBe("mensualidad:PLN-1:2");
    const ending = { ...plan, paidMonths: 3, state: "activa" as const, paidUntil: now + 6 * DAY };
    expect(reminders.reminderFor(ending, now, false)?.key).toBe("termina:PLN-1");
    expect(reminders.reminderFor(ending, now, true)).toBeNull();
    expect(reminders.reminderFor({ ...ending, paidUntil: now + 8 * DAY }, now, false)).toBeNull();
    expect(reminders.reminderFor({ ...plan, state: "completada", paidMonths: 3, paidUntil: now - DAY }, now, false)).toBeNull();
  });
});

describe("entregas", () => {
  it("si Resend falla, queda como fallido y se reintenta hasta 3 veces", async () => {
    const m = { key: "prueba:reintento", kind: "prueba", subject: "Prueba", lines: ["Hola"] };
    reply = () => new Response(JSON.stringify({ message: "Servicio no disponible" }), { status: 503 });
    expect(await mail.deliverCustomerEmail("m1", m)).toBe("fallido");
    const row = async () => (await dbMod.db.select().from(schema.customerEmail).where(drizzle.eq(schema.customerEmail.key, m.key)))[0];
    expect(await row()).toMatchObject({ status: "fallido", attempts: 1, error: "503: Servicio no disponible" });
    expect(await mail.deliverCustomerEmail("m1", m)).toBe("fallido");
    reply = () => new Response(JSON.stringify({ id: "email-ok" }));
    expect(await mail.deliverCustomerEmail("m1", m)).toBe("enviado");
    expect(await row()).toMatchObject({ status: "enviado", attempts: 3, error: null });
    expect(await mail.deliverCustomerEmail("m1", m)).toBe("repetido");
    expect(sent).toHaveLength(3);
  });

  it("después de 3 fallos ya no lo intenta más", async () => {
    const m = { key: "prueba:agotado", kind: "prueba", subject: "Prueba", lines: ["Hola"] };
    reply = () => new Response("{}", { status: 500 });
    for (let i = 0; i < 3; i++) expect(await mail.deliverCustomerEmail("m1", m)).toBe("fallido");
    expect(await mail.deliverCustomerEmail("m1", m)).toBe("repetido");
    expect(sent).toHaveLength(3);
  });

  it("nunca a la cuenta de pruebas ni a una cuenta eliminada", async () => {
    const { ensureDemoAccount } = await import("@/lib/db/seed");
    const demo = await ensureDemoAccount(dbMod.db);
    const m = { key: "prueba:demo", kind: "prueba", subject: "Prueba", lines: ["Hola"] };
    expect(await mail.deliverCustomerEmail(demo, m)).toBe("omitido");
    const { deletedEmail } = await import("@/lib/deleted-account");
    await createUser("borrada");
    await dbMod.db.update(schema.user).set({ email: deletedEmail("borrada") }).where(drizzle.eq(schema.user.id, "borrada"));
    expect(await mail.deliverCustomerEmail("borrada", { ...m, key: "prueba:borrada" })).toBe("omitido");
    expect(sent).toHaveLength(0);
  });

  it("los nombres llegan escapados en el HTML", () => {
    const { html, text } = mail.renderCustomerEmail({ key: "k", kind: "prueba", subject: "Asunto", lines: ["Motivo: <script>alert(1)</script>"] }, { name: "Ana <b>Gómez</b>", demo: false, url: "https://xgreenenergy.co" });
    expect(html).toContain("Hola, Ana:");
    expect(html).toContain("Motivo: &lt;script&gt;alert(1)&lt;/script&gt;");
    expect(html).not.toContain("<script>");
    expect(text).toContain("Motivo: <script>alert(1)</script>");
  });
});

describe("solicitudes sobre los datos", () => {
  it("al eliminar la cuenta, el último correo va a la dirección que tenía; responder sin eliminar también avisa", async () => {
    const privacy = await import("@/lib/privacy");
    await createUser("m9", { name: "Empresa m9" });
    const { request } = await privacy.requestDeletion("m9");
    await privacy.deleteAccount(actor, request.id);
    await flush();
    const [bye] = to("m9");
    expect(bye.subject).toBe(`[Pruebas] Eliminamos tu cuenta de X green Energy`);
    expect(bye.text).toMatch(/También borramos tus datos personales\./);
    // De sus correos solo queda la constancia de este aviso: prueba de que se le notificó.
    const left = await dbMod.db.select().from(schema.customerEmail).where(drizzle.eq(schema.customerEmail.userId, "m9"));
    expect(left.map((e) => ({ kind: e.kind, status: e.status }))).toEqual([{ kind: "cuenta_eliminada", status: "enviado" }]);

    await createUser("m10", { name: "Empresa m10" });
    const second = await privacy.requestDeletion("m10");
    await privacy.answerRequest(actor, second.request.id, "Tienes un plan vigente: la eliminamos cuando termine.");
    await flush();
    expect(to("m10").map((s) => s.subject)).toEqual(["[Pruebas] Respondimos tu solicitud sobre tus datos"]);
    expect(to("m10")[0].text).toMatch(/Tienes un plan vigente/);
  });
});
