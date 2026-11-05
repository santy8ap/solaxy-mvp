// Mercado Pago falso para pruebas locales y e2e: Checkout Pro, API de pagos y notificaciones firmadas.
// Uso: MP_WEBHOOK_SECRET=… WEBHOOK_URL=http://localhost:3000/api/webhooks/mercadopago node e2e/fake-mercadopago.mjs
// La app apunta aquí con MERCADOPAGO_API_BASE=http://localhost:4010 y un token APP_USR-… o TEST-….
import { createHmac, randomUUID } from "node:crypto";
import http from "node:http";

const PORT = Number(process.env.FAKE_MP_PORT ?? 4010);
const SECRET = process.env.MP_WEBHOOK_SECRET ?? "";
const WEBHOOK_URL = process.env.WEBHOOK_URL ?? "";
const preferences = new Map();
const byIdempotencyKey = new Map();
const payments = new Map();
let seq = 0;

const json = (res, status, body) => {
  res.writeHead(status, { "content-type": "application/json" });
  res.end(JSON.stringify(body));
};
const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
const html = (s) => `<!doctype html><meta charset="utf-8"><title>Mercado Pago (falso)</title><body style="font-family:sans-serif;padding:2rem">${s}</body>`;
const readBody = async (req) => {
  let raw = "";
  for await (const c of req) raw += c;
  return raw;
};
const tokenOf = (req) => /^Bearer (APP_USR-|TEST-)\S+$/.exec(req.headers.authorization ?? "")?.[0].slice(7) ?? null;

/** Como Mercado Pago: POST a la URL de notificaciones con ?data.id&type y la firma x-signature. */
async function notify(payment) {
  if (!WEBHOOK_URL) return;
  const dataId = String(payment.id);
  const requestId = randomUUID();
  const ts = String(Date.now());
  const v1 = createHmac("sha256", SECRET).update(`id:${dataId};request-id:${requestId};ts:${ts};`).digest("hex");
  const url = new URL(WEBHOOK_URL);
  url.searchParams.set("data.id", dataId);
  url.searchParams.set("type", "payment");
  const body = {
    action: "payment.updated",
    api_version: "v1",
    data: { id: dataId },
    date_created: new Date().toISOString(),
    id: Date.now(),
    live_mode: payment.live_mode,
    type: "payment",
    user_id: "123456789",
  };
  try {
    const r = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json", "x-signature": `ts=${ts},v1=${v1}`, "x-request-id": requestId },
      body: JSON.stringify(body),
    });
    console.log(`[fake-mp] notificación ${dataId} ${payment.status} → ${r.status}`);
  } catch (e) {
    console.log(`[fake-mp] la notificación falló: ${e.message}`);
  }
}

const OUTCOMES = {
  aprobar: { status: "approved", status_detail: "accredited", payment_type_id: "credit_card", payment_method_id: "visa", back: "success" },
  rechazar: { status: "rejected", status_detail: "cc_rejected_insufficient_amount", payment_type_id: "credit_card", payment_method_id: "visa", back: "failure" },
  pse: { status: "in_process", status_detail: "pending_waiting_transfer", payment_type_id: "bank_transfer", payment_method_id: "pse", back: "pending" },
};

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);

  // ── API (requiere el Access Token) ───────────────────────────────────────
  if (url.pathname === "/checkout/preferences" || url.pathname.startsWith("/v1/") || url.pathname === "/users/me") {
    const token = tokenOf(req);
    if (!token) return json(res, 401, { message: "invalid access token", error: "unauthorized", status: 401 });

    if (req.method === "POST" && url.pathname === "/checkout/preferences") {
      const key = req.headers["x-idempotency-key"];
      if (key && byIdempotencyKey.has(key)) return json(res, 201, byIdempotencyKey.get(key));
      const pref = JSON.parse((await readBody(req)) || "{}");
      const item = pref.items?.[0];
      if (!item || item.currency_id !== "COP" || !(item.unit_price > 0) || !pref.external_reference || !pref.back_urls?.success) {
        return json(res, 400, { message: "invalid preference", error: "bad_request", status: 400 });
      }
      const id = `123456789-${randomUUID()}`;
      preferences.set(id, { ...pref, live_mode: token.startsWith("APP_USR-") });
      const out = {
        id,
        init_point: `http://localhost:${PORT}/checkout/v1/redirect?pref_id=${id}`,
        sandbox_init_point: `http://localhost:${PORT}/checkout/v1/redirect?pref_id=${id}&sandbox=1`,
      };
      if (key) byIdempotencyKey.set(key, out);
      return json(res, 201, out);
    }

    if (req.method === "GET" && url.pathname === "/v1/payments/search") {
      const ref = url.searchParams.get("external_reference");
      const results = [...payments.values()].filter((p) => !ref || p.external_reference === ref).reverse();
      return json(res, 200, { results, paging: { total: results.length, limit: 30, offset: 0 } });
    }

    const m = /^\/v1\/payments\/(\d+)$/.exec(url.pathname);
    if (req.method === "GET" && m) {
      const p = payments.get(m[1]);
      return p ? json(res, 200, p) : json(res, 404, { message: "Payment not found", error: "not_found", status: 404 });
    }

    if (req.method === "GET" && url.pathname === "/users/me") {
      return json(res, 200, { id: 123456789, nickname: "SOLAXY_FALSO", site_id: "MCO", tags: token.startsWith("TEST-") ? ["test_user"] : ["normal"] });
    }
    return json(res, 404, { message: "not found", status: 404 });
  }

  // ── Checkout Pro (la página a la que se redirige al comprador) ──────────
  if (req.method === "GET" && url.pathname === "/checkout/v1/redirect") {
    const id = url.searchParams.get("pref_id") ?? "";
    const pref = preferences.get(id);
    if (!pref) {
      res.writeHead(404, { "content-type": "text/html" });
      return res.end(html(`<h1 id="sin-preferencia">La preferencia no existe</h1>`));
    }
    const item = pref.items[0];
    res.writeHead(200, { "content-type": "text/html" });
    return res.end(
      html(`<h1>Mercado Pago (falso)</h1>
      <p id="producto">${esc(item.title)}</p>
      <p id="monto">${esc(item.unit_price * item.quantity)} ${esc(item.currency_id)}</p>
      <p id="ref">${esc(pref.external_reference)}</p>
      <p id="cliente">${esc(pref.payer?.name)} ${esc(pref.payer?.surname)} · ${esc(pref.payer?.email)}</p>
      <form method="post" action="/checkout/v1/pay"><input type="hidden" name="pref_id" value="${esc(id)}">
        <button name="outcome" value="aprobar">Aprobar</button>
        <button name="outcome" value="rechazar">Rechazar</button>
        <button name="outcome" value="pse">Pendiente (PSE)</button>
        <button name="outcome" value="volver">Volver sin pagar</button>
      </form>`),
    );
  }

  if (req.method === "POST" && url.pathname === "/checkout/v1/pay") {
    const f = new URLSearchParams(await readBody(req));
    const prefId = f.get("pref_id") ?? "";
    const pref = preferences.get(prefId);
    if (!pref) return json(res, 404, { message: "preference not found" });
    const outcome = f.get("outcome") ?? "";
    // Mercado Pago agrega estos parámetros a la URL de retorno (con "null" si no hubo pago).
    const back = new URL(pref.back_urls[OUTCOMES[outcome]?.back ?? "failure"]);
    const params = { collection_id: "null", collection_status: "null", payment_id: "null", status: "null", external_reference: pref.external_reference, payment_type: "null", merchant_order_id: "null", preference_id: prefId, site_id: "MCO", processing_mode: "aggregator", merchant_account_id: "null" };
    const o = OUTCOMES[outcome];
    if (o) {
      const item = pref.items[0];
      const payment = {
        id: 1310000000 + ++seq,
        status: o.status,
        status_detail: o.status_detail,
        external_reference: pref.external_reference,
        transaction_amount: item.unit_price * item.quantity,
        currency_id: item.currency_id,
        payment_type_id: o.payment_type_id,
        payment_method_id: o.payment_method_id,
        live_mode: pref.live_mode,
        date_created: new Date().toISOString(),
      };
      payments.set(String(payment.id), payment);
      Object.assign(params, { collection_id: String(payment.id), payment_id: String(payment.id), collection_status: payment.status, status: payment.status, payment_type: payment.payment_type_id, merchant_order_id: String(9000000000 + seq) });
      // Como en Mercado Pago: el pago con tarjeta notifica enseguida; el PSE, cuando el banco confirma.
      if (outcome !== "pse") setTimeout(() => void notify(payment), 300);
    }
    for (const [k, v] of Object.entries(params)) back.searchParams.set(k, v);
    res.writeHead(303, { location: back.toString() });
    return res.end();
  }

  // ── Control de las pruebas: el banco confirma o rechaza un PSE ───────────
  const ctl = /^\/__control\/(approve|reject|refund)\/(\d+)$/.exec(url.pathname);
  if (req.method === "POST" && ctl) {
    const p = payments.get(ctl[2]);
    if (!p) return json(res, 404, { message: "Payment not found" });
    Object.assign(
      p,
      { approve: { status: "approved", status_detail: "accredited" }, reject: { status: "rejected", status_detail: "rejected_by_bank" }, refund: { status: "refunded", status_detail: "refunded" } }[ctl[1]],
    );
    await notify(p);
    return json(res, 200, p);
  }

  res.writeHead(404);
  res.end();
});
server.listen(PORT, () => console.log(`[fake-mp] escuchando en http://localhost:${PORT}`));
