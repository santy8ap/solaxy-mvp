import { planSummary, type EnergyPlan } from "@/config/energy-plans";
import { formatCop, formatNumber } from "@/lib/format";
export interface ProposalCompany {
  company: string;
  nit: string;
  representative: string;
  email: string;
}
const escape = (value: string) =>
  value.replace(
    /[&<>"']/g,
    (char) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        char
      ] ?? char,
  );
export function planProposalHtml(plan: EnergyPlan, company?: ProposalCompany) {
  const summary = planSummary(plan);
  const rows = [
    ["Plan", plan.name],
    ["Energía diaria", `${formatNumber(plan.daily)} kWh`],
    ["Energía mensual", `${formatNumber(summary.monthlyKwh)} kWh`],
    ["Energía total", `${formatNumber(summary.totalKwh)} kWh`],
    ["Precio por kWh", formatCop(plan.price)],
    ["Cuota mensual", `${formatCop(summary.monthlyCop)} COP`],
    ["Duración", "3 meses · Periodos de 30 días"],
    ["Total del periodo", `${formatCop(summary.monthlyCop * 3)} COP`],
  ];
  const business = company
    ? `<section><h2>Empresa</h2><p>${escape(company.company)}</p><p>NIT ${escape(company.nit)}</p><p>${escape(company.representative)}</p><p>${escape(company.email)}</p></section>`
    : "";
  return `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="referrer" content="no-referrer"><title>Propuesta ${escape(plan.name)} · In World Energy</title><style>@page{size:A4;margin:20mm}*{box-sizing:border-box}body{margin:0;padding:40px;font:13px Arial,sans-serif;color:#111;background:#fff}header{border-bottom:2px solid #111;padding-bottom:24px;letter-spacing:3px;font-size:12px}main{padding-block:32px}h1{font-weight:400;font-size:32px}h2{font-size:15px;font-weight:400;letter-spacing:2px}section{border:1px solid #999;padding:20px;margin-block:24px}p{overflow-wrap:anywhere;line-height:1.7}dl>div{display:flex;gap:24px;border-bottom:1px solid #ddd;padding:16px 0;break-inside:avoid}dt{width:45%;color:#555}dd{width:55%;margin:0;text-align:right;font-family:monospace;overflow-wrap:anywhere}footer{margin-top:32px;padding-top:20px;border-top:1px solid #999;font-size:10px;line-height:1.9;color:#555}@media print{body{padding:0}}</style></head><body><header>IN WORLD<br>ENERGY</header><main><h1>Propuesta de energía · ${escape(plan.name)}</h1><p>Resumen informativo de la selección. Valores en pesos colombianos.</p>${business}<dl>${rows.map(([label, value]) => `<div><dt>${escape(label)}</dt><dd>${escape(value)}</dd></div>`).join("")}</dl></main><footer>Esta propuesta no es una factura, un contrato ni una reserva de energía. La contratación y el cobro mensual aún no están habilitados. Los valores están sujetos a las condiciones que se confirmen al contratar. La utilidad bruta de referencia no garantiza un rendimiento.</footer></body></html>`;
}
