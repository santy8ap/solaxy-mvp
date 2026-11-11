import type { TxDTO } from "@/lib/portfolio";
import { formatCop, formatDateTime } from "@/lib/format";
import { STATUS_LABEL, txTitle } from "./tx-meta";

const escape = (value: string) =>
  value.replace(
    /[&<>"']/g,
    (character) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        character
      ] ?? character,
  );
/** Every dynamic field is text-escaped before entering the printable document. */
export function transactionPrintHtml(tx: TxDTO) {
  const rows = [
    ["Referencia de operación", tx.id],
    ["Concepto", txTitle(tx)],
    ["Estado", STATUS_LABEL[tx.status] ?? tx.status],
    ["Fecha de registro · Colombia", formatDateTime(tx.createdAt)],
    [
      "Fecha de confirmación · Colombia",
      tx.confirmedAt === null
        ? "Sin confirmar"
        : formatDateTime(tx.confirmedAt),
    ],
    [
      "Método",
      tx.method === "mercadopago"
        ? "Mercado Pago"
        : tx.method === "crypto"
          ? "Cripto"
          : tx.method === "demo" || tx.kind === "asignacion_demo"
            ? "Prueba"
            : "Registro de cuenta",
    ],
    ["Referencia externa", tx.txHash ?? "Sin referencia externa"],
  ];
  return `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="referrer" content="no-referrer"><title>Resumen de operación · In World Energy</title><style>@page{size:A4;margin:20mm}*{box-sizing:border-box}body{font-family:Arial,sans-serif;color:#111;background:white;margin:0;padding:28px;font-size:12px}header{display:flex;justify-content:space-between;border-bottom:2px solid #111;padding-bottom:24px}header strong{letter-spacing:3px;font-size:12px}header span{color:#555;font-size:10px}main{padding-top:40px}small{letter-spacing:2px;color:#555}h1{font-size:28px;font-weight:400;margin:16px 0}section{border:1px solid #999;padding:24px;margin:30px 0}.amount{font:32px monospace;margin:10px 0}.status{letter-spacing:2px;font-size:11px}dl{margin:0}dl>div{display:flex;gap:30px;border-bottom:1px solid #ddd;padding:16px 0;break-inside:avoid}dt{width:40%;color:#555}dd{width:60%;margin:0;text-align:right;overflow-wrap:anywhere;font-family:monospace}footer{font-size:10px;line-height:1.8;margin-top:40px;border-top:1px solid #999;padding-top:18px;color:#555}button{padding:12px 20px;background:#111;color:white;border:0;cursor:pointer}@media print{body{padding:0}button{display:none}}</style></head><body><header><strong>IN WORLD<br>ENERGY</strong><span>REGISTRO DE OPERACIÓN</span></header><main><small>UNA CUENTA CLARA.</small><h1>Resumen de operación</h1><section><span class="status">${escape(STATUS_LABEL[tx.status] ?? tx.status)}</span><p class="amount">${escape(formatCop(tx.amountCop, 2))}</p><span>Pesos colombianos · COP</span></section><dl>${rows.map(([label, value]) => `<div><dt>${escape(label)}</dt><dd>${escape(value)}</dd></div>`).join("")}</dl></main><footer>Documento informativo de la operación registrada. No sustituye una factura ni certifica por sí solo el pago o la entrega de energía. El estado indicado corresponde al registro consultado.</footer></body></html>`;
}

/** Opens the browser's print dialog, where the user can choose Save as PDF. */
export function printTransaction(tx: TxDTO) {
  const frame = document.createElement("iframe");
  frame.title = "Resumen imprimible de la operación";
  frame.tabIndex = -1;
  frame.setAttribute("aria-hidden", "true");
  frame.style.cssText =
    "position:fixed;inset:auto 0 0 auto;width:1px;height:1px;border:0;opacity:0;pointer-events:none";
  const cleanup = () => frame.remove();
  frame.onload = () => {
    const target = frame.contentWindow;
    if (!target) {
      cleanup();
      return;
    }
    target.addEventListener("afterprint", cleanup, { once: true });
    target.focus();
    try {
      target.print();
    } catch {
      cleanup();
    }
    setTimeout(cleanup, 60000);
  };
  frame.srcdoc = transactionPrintHtml(tx);
  document.body.append(frame);
}
