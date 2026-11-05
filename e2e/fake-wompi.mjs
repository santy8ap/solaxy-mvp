// Wompi falso para pruebas locales y e2e: Web Checkout, API de transacciones y webhooks firmados.
// Uso: WOMPI_INTEGRITY_SECRET=… WOMPI_EVENTS_SECRET=… WEBHOOK_URL=http://localhost:3000/api/webhooks/wompi node e2e/fake-wompi.mjs
import { createHash } from "node:crypto";
import http from "node:http";

const PORT = Number(process.env.FAKE_WOMPI_PORT ?? 4010);
const INTEGRITY = process.env.WOMPI_INTEGRITY_SECRET ?? "";
const EVENTS = process.env.WOMPI_EVENTS_SECRET ?? "";
const WEBHOOK_URL = process.env.WEBHOOK_URL ?? "";
const txs = new Map();
const sha256 = (s) => createHash("sha256").update(s).digest("hex");
let seq = 0;

async function sendEvent(tx) {
  if (!WEBHOOK_URL) return;
  const timestamp = Math.floor(Date.now() / 1000);
  const checksum = sha256(`${tx.id}${tx.status}${tx.amount_in_cents}${timestamp}${EVENTS}`);
  const body = {
    event: "transaction.updated",
    data: { transaction: tx },
    environment: "test",
    signature: { properties: ["transaction.id", "transaction.status", "transaction.amount_in_cents"], checksum },
    timestamp,
    sent_at: new Date().toISOString(),
  };
  try {
    const r = await fetch(WEBHOOK_URL, { method: "POST", headers: { "content-type": "application/json", "x-event-checksum": checksum }, body: JSON.stringify(body) });
    console.log(`[fake-wompi] webhook ${tx.id} ${tx.status} → ${r.status}`);
  } catch (e) {
    console.log(`[fake-wompi] webhook falló: ${e.message}`);
  }
}

const html = (s) => `<!doctype html><meta charset="utf-8"><title>Wompi (falso)</title><body style="font-family:sans-serif;padding:2rem">${s}</body>`;

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  if (req.method === "GET" && url.pathname === "/p/") {
    const p = url.searchParams;
    const reference = p.get("reference") ?? "";
    const amount = p.get("amount-in-cents") ?? "";
    const expected = sha256(`${reference}${amount}${p.get("currency")}${INTEGRITY}`);
    if (p.get("signature:integrity") !== expected) {
      res.writeHead(400, { "content-type": "text/html" });
      return res.end(html(`<h1 id="firma-invalida">Firma de integridad inválida</h1>`));
    }
    const hidden = (n, v) => `<input type="hidden" name="${n}" value="${String(v).replace(/"/g, "&quot;")}">`;
    res.writeHead(200, { "content-type": "text/html" });
    return res.end(
      html(`<h1>Pagar ${Number(amount) / 100} COP</h1><p id="ref">${reference}</p><p id="cliente">${p.get("customer-data:full-name") ?? ""} · ${p.get("customer-data:legal-id-type") ?? ""} ${p.get("customer-data:legal-id") ?? ""}</p>
      <form method="post" action="/p/pay">${hidden("reference", reference)}${hidden("amount", amount)}${hidden("redirect", p.get("redirect-url") ?? "")}
      <button name="status" value="APPROVED">Aprobar</button> <button name="status" value="DECLINED">Rechazar</button> <button name="status" value="PENDING">Pendiente (PSE)</button></form>`),
    );
  }
  if (req.method === "POST" && url.pathname === "/p/pay") {
    let raw = "";
    for await (const c of req) raw += c;
    const f = new URLSearchParams(raw);
    const status = f.get("status");
    const tx = {
      id: `${1000 + ++seq}-${Date.now()}-${Math.floor(Math.random() * 1e5)}`,
      status,
      status_message: status === "DECLINED" ? "Fondos insuficientes" : null,
      reference: f.get("reference"),
      amount_in_cents: Number(f.get("amount")),
      currency: "COP",
      payment_method_type: status === "PENDING" ? "PSE" : "CARD",
    };
    txs.set(tx.id, tx);
    if (status !== "PENDING") setTimeout(() => void sendEvent(tx), 300);
    const back = new URL(f.get("redirect"));
    back.searchParams.set("id", tx.id);
    back.searchParams.set("env", "test");
    res.writeHead(303, { location: back.toString() });
    return res.end();
  }
  const m = /^\/v1\/transactions\/([^/]+)$/.exec(url.pathname);
  if (req.method === "GET" && m) {
    const tx = txs.get(decodeURIComponent(m[1]));
    res.writeHead(tx ? 200 : 404, { "content-type": "application/json" });
    return res.end(JSON.stringify(tx ? { data: tx } : { error: { type: "NOT_FOUND_ERROR" } }));
  }
  const ctl = /^\/__control\/(approve|decline)\/([^/]+)$/.exec(url.pathname);
  if (req.method === "POST" && ctl) {
    const tx = txs.get(decodeURIComponent(ctl[2]));
    if (!tx) {
      res.writeHead(404);
      return res.end();
    }
    tx.status = ctl[1] === "approve" ? "APPROVED" : "DECLINED";
    await sendEvent(tx);
    res.writeHead(200, { "content-type": "application/json" });
    return res.end(JSON.stringify(tx));
  }
  res.writeHead(404);
  res.end();
});
server.listen(PORT, () => console.log(`[fake-wompi] escuchando en http://localhost:${PORT}`));
