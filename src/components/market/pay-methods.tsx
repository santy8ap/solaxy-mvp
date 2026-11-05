"use client";
import type { AppConfigDTO } from "@/lib/app-config";
import { PAY_OPTIONS, type PayOption } from "./payment-sheet";

/** Un medio de pago que el usuario puede elegir en el mercado. */
export type PayMethod =
  | { id: "mercadopago"; kind: "mercadopago"; label: string; note: string }
  | { id: "usdt" | "bnb"; kind: "crypto"; asset: "USDT" | "BNB"; label: string; note: string }
  | { id: string; kind: "demo"; option: PayOption; label: string; note: string };

/** Medios disponibles según la configuración del servidor. Los simulados solo existen en modo demo. */
export function availableMethods(config: AppConfigDTO | null): PayMethod[] {
  if (!config) return [];
  const list: PayMethod[] = [];
  if (config.mercadopago.enabled) {
    list.push({
      id: "mercadopago",
      kind: "mercadopago",
      label: "Tarjeta, PSE o Nequi",
      note: config.mercadopago.sandbox ? "Mercado Pago · modo de pruebas" : "Pago seguro con Mercado Pago",
    });
  }
  if (config.crypto.enabled) {
    const net = config.crypto.network === "bsc-testnet" ? "BNB Chain testnet" : "BNB Chain";
    list.push(
      { id: "usdt", kind: "crypto", asset: "USDT", label: "USDT", note: `${net} (BEP-20), desde tu wallet` },
      { id: "bnb", kind: "crypto", asset: "BNB", label: "BNB", note: `${net}, desde tu wallet` },
    );
  }
  if (config.demoMode) {
    for (const o of PAY_OPTIONS) list.push({ id: `demo-${o.id}`, kind: "demo", option: o, label: o.label, note: "Simulado: firma sin mover fondos" });
  }
  return list;
}

export function MethodSelect({ methods, value, onChange }: { methods: PayMethod[]; value: string; onChange(id: string): void }) {
  const groups: { title: string; items: PayMethod[] }[] = [
    { title: "Pesos colombianos", items: methods.filter((m) => m.kind === "mercadopago") },
    { title: "Cripto directo a Solaxy", items: methods.filter((m) => m.kind === "crypto") },
    { title: "Modo demo", items: methods.filter((m) => m.kind === "demo") },
  ].filter((g) => g.items.length > 0);

  if (methods.length === 0) {
    return (
      <p className="rounded-xl border border-sun-400/40 bg-sun-400/10 p-3 text-sm text-sun-200">
        Los pagos todavía no están habilitados. El equipo de Solaxy está terminando de configurarlos.
      </p>
    );
  }
  return (
    <fieldset className="space-y-4">
      <legend className="text-sm text-silver-400">Pagar con</legend>
      {groups.map((g) => (
        <div key={g.title}>
          <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-silver-500">{g.title}</div>
          <div className="grid gap-2 sm:grid-cols-2">
            {g.items.map((m) => (
              <label
                key={m.id}
                className={`flex cursor-pointer items-center gap-3 rounded-xl border px-3.5 py-3 text-sm transition-colors ${
                  value === m.id ? "border-sun-400/70 bg-sun-400/10 text-silver-50" : "border-silicon-600/70 text-silver-300 hover:border-silicon-500"
                }`}
              >
                <input type="radio" name="pay" value={m.id} checked={value === m.id} onChange={() => onChange(m.id)} className="accent-[#f6b73c]" />
                <span>
                  <span className="block font-medium">{m.label}</span>
                  <span className="block text-xs text-silver-400">{m.note}</span>
                </span>
              </label>
            ))}
          </div>
        </div>
      ))}
    </fieldset>
  );
}
