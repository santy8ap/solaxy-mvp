"use client";
import { useMemo, useState } from "react";
import { ECONOMICS, PACKAGES } from "@/config/economics";
import type { PortfolioDTO } from "@/lib/portfolio";
import { postJson, refetch, useJson } from "@/lib/client/use-json";
import { formatAsset, formatCop, formatDay, formatKw, formatNumber, formatPct } from "@/lib/format";
import { useAppConfig } from "@/lib/client/use-app-config";
import { useWallet } from "@/lib/wallet/context";
import { Topbar } from "@/components/panel/shell";
import { toast } from "@/components/ui/toast";
import { CryptoSheet, MercadoPagoSheet, type CheckoutRequest } from "./checkout-sheets";
import { MethodSelect, availableMethods, type PayMethod } from "./pay-methods";
import { PaymentSheet, type PurchaseRequest } from "./payment-sheet";

interface MarketDTO {
  plant: { name: string; capacityKwp: number; soldKw: number; availableKw: number; pricePerKwCop: number; minKw: number; maxKw: number; instantSellFactor: number };
  listings: { id: string; sellerName: string; kw: number; pricePerKwCop: number; createdAt: number }[];
  myListings: { id: string; kw: number; pricePerKwCop: number; createdAt: number }[];
  position: { kw: number; listedKw: number; availableKw: number; investedCop: number };
  rates: { prices: Record<string, { cop: number; usd: number }>; source: "coingecko" | "referencia" };
}

type Tab = "comprar" | "p2p" | "vender";


export function Market() {
  const { data: m, error } = useJson<MarketDTO>("/api/market", { refreshMs: 30_000 });
  const { config } = useAppConfig();
  const wallet = useWallet();
  const [tab, setTab] = useState<Tab>("comprar");
  const [kw, setKw] = useState(2);
  const methods = useMemo(() => availableMethods(config), [config]);
  const [payId, setPayId] = useState<string | null>(null);
  const method = methods.find((x) => x.id === payId) ?? methods[0] ?? null;
  const [demoRequest, setDemoRequest] = useState<PurchaseRequest | null>(null);
  const [checkout, setCheckout] = useState<{ request: CheckoutRequest; method: PayMethod } | null>(null);

  const start = (req: CheckoutRequest) => {
    if (!method) return;
    if (method.kind === "demo") {
      if (method.option.method === "wallet" && wallet.status !== "connected") {
        wallet.openConnect();
        toast("Conecta tu wallet para firmar la compra.", "info");
        return;
      }
      setDemoRequest({ kw: req.kw, listingId: req.listingId, title: req.title, pay: method.option });
      return;
    }
    if (method.kind === "crypto" && wallet.status !== "connected") {
      wallet.openConnect();
      toast("Conecta Trust Wallet o MetaMask para pagar con cripto.", "info");
      return;
    }
    setCheckout({ request: req, method });
  };

  if (error && !m) return <div className="panel p-8 text-silver-300">No pudimos cargar el mercado: {error}</div>;

  return (
    <>
      <Topbar title="Mercado" subtitle="Compra kW a la planta o a otros inversionistas, y vende los tuyos cuando quieras." />

      <div className="mb-5 inline-flex rounded-full border border-silicon-600/70 bg-silicon-950/50 p-1" role="tablist" aria-label="Mercado">
        {(
          [
            ["comprar", "Comprar a la planta"],
            ["p2p", "Entre usuarios"],
            ["vender", "Vender"],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={tab === id}
            onClick={() => setTab(id)}
            className={`rounded-full px-4 py-2 text-sm transition-colors ${tab === id ? "bg-silicon-600 font-semibold text-silver-50" : "text-silver-300 hover:text-silver-50"}`}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === "comprar" && (
        <BuyPlant
          m={m}
          kw={kw}
          setKw={setKw}
          methods={methods}
          method={method}
          setPayId={setPayId}
          loadingMethods={!config}
          onBuy={() => start({ kw, title: `Comprar ${formatKw(kw, 1)}`, amountCop: Math.round(kw * (m?.plant.pricePerKwCop ?? ECONOMICS.pricePerKwCop)) })}
        />
      )}
      {tab === "p2p" && (
        <P2P
          m={m}
          methods={methods}
          method={method}
          setPayId={setPayId}
          onBuy={(l) => start({ listingId: l.id, kw: l.kw, title: `Comprar ${formatKw(l.kw, 1)} a ${l.sellerName}`, amountCop: Math.round(l.kw * l.pricePerKwCop) })}
        />
      )}
      {tab === "vender" && <Sell m={m} />}

      <PaymentSheet request={demoRequest} onClose={() => setDemoRequest(null)} />
      <MercadoPagoSheet request={checkout?.method.kind === "mercadopago" ? checkout.request : null} onClose={() => setCheckout(null)} />
      <CryptoSheet
        request={checkout?.method.kind === "crypto" ? checkout.request : null}
        asset={checkout?.method.kind === "crypto" ? checkout.method.asset : "USDT"}
        onClose={() => setCheckout(null)}
      />
    </>
  );
}

function payButtonLabel(method: PayMethod | null, walletConnected: boolean, walletName: string | null) {
  if (!method) return "Pagos no disponibles";
  if (method.kind === "mercadopago") return "Pagar con tarjeta, PSE o Nequi";
  if (method.kind === "crypto") return walletConnected ? `Pagar ${method.asset} con ${walletName ?? "tu wallet"}` : "Conectar wallet y pagar";
  if (method.option.method === "qr") return "Pagar con código QR (demo)";
  return walletConnected ? `Firmar con ${walletName} (demo)` : "Conectar wallet y pagar";
}

function payFootnote(method: PayMethod | null) {
  if (!method) return "";
  if (method.kind === "mercadopago") return "Pagas en Mercado Pago. Tus kW se asignan apenas el pago quede aprobado.";
  if (method.kind === "crypto") return `Envías ${method.asset} desde tu wallet a la billetera de Solaxy en BNB Chain. Tus kW se asignan tras las confirmaciones de la red.`;
  return "Pago simulado: firmas la orden con tu wallet y no se mueve dinero.";
}

function BuyPlant({
  m,
  kw,
  setKw,
  methods,
  method,
  setPayId,
  loadingMethods,
  onBuy,
}: {
  m?: MarketDTO;
  kw: number;
  setKw(v: number): void;
  methods: PayMethod[];
  method: PayMethod | null;
  setPayId(id: string): void;
  loadingMethods: boolean;
  onBuy(): void;
}) {
  const wallet = useWallet();
  const { data: portfolio } = useJson<PortfolioDTO>("/api/portfolio");
  const price = m?.plant.pricePerKwCop ?? ECONOMICS.pricePerKwCop;
  const yearlyPerKwp = (portfolio?.yieldEa ?? 0.158) * price;
  const total = kw * price;
  const asset = method?.kind === "crypto" ? method.asset : method?.kind === "demo" ? method.option.asset : null;
  const assetAmount = m && asset ? total / (m.rates.prices[asset]?.cop ?? 1) : null;
  const max = Math.min(ECONOMICS.maxPurchaseKw, m?.plant.availableKw ?? ECONOMICS.maxPurchaseKw);
  const soldPct = m ? m.plant.soldKw / m.plant.capacityKwp : 0;

  return (
    <div className="grid gap-5 lg:grid-cols-[1.4fr_1fr]">
      <section className="panel p-6 sm:p-8" aria-labelledby="buy-title">
        <h2 id="buy-title" className="text-lg font-semibold text-silver-50">
          ¿Cuántos kW quieres?
        </h2>
        <p className="mt-1 text-sm text-silver-400">
          {formatCop(price)} por kW. Quedan <span className="num text-silver-100">{m ? formatNumber(m.plant.availableKw, 1) : "—"} kW</span> de{" "}
          {m ? formatNumber(m.plant.capacityKwp) : "—"} ({formatPct(1 - soldPct, 0)} de la planta).
        </p>
        <div className="mt-6 grid gap-3 sm:grid-cols-3">
          {PACKAGES.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => setKw(p.kw)}
              aria-pressed={kw === p.kw}
              className={`rounded-2xl border p-4 text-left transition-colors ${kw === p.kw ? "border-sun-400/70 bg-sun-400/10" : "border-silicon-600/70 hover:border-silicon-500"}`}
            >
              <div className="text-sm text-silver-400">{p.name}</div>
              <div className="display mt-1 text-2xl text-silver-50">{formatNumber(p.kw, p.kw % 1 ? 1 : 0)} kW</div>
              <div className="num mt-1 text-sm text-silver-300">{formatCop(p.kw * price)}</div>
              <div className="mt-2 text-xs text-silver-500">{p.blurb}</div>
            </button>
          ))}
        </div>
        <div className="mt-7">
          <label htmlFor="buy-kw" className="flex items-baseline justify-between text-silver-300">
            <span>O elige otra cantidad</span>
            <span className="num display text-2xl text-sun-300">{formatNumber(kw, 1)} kW</span>
          </label>
          <input id="buy-kw" type="range" min={ECONOMICS.minPurchaseKw} max={Math.max(ECONOMICS.minPurchaseKw, Math.min(25, max))} step={0.1} value={kw} onChange={(e) => setKw(Number(e.target.value))} className="mt-3 w-full" />
        </div>
        <div className="mt-7">
          {loadingMethods ? (
            <div className="h-24 animate-pulse rounded-2xl bg-silicon-800/60" aria-busy="true" aria-label="Cargando medios de pago" />
          ) : (
            <MethodSelect methods={methods} value={method?.id ?? ""} onChange={setPayId} />
          )}
        </div>
      </section>

      <aside className="panel cells flex flex-col p-6 sm:p-8" aria-label="Resumen de la compra">
        <h2 className="text-lg font-semibold text-silver-50">Resumen</h2>
        <dl className="mt-5 space-y-3 text-sm">
          <div className="flex justify-between gap-4">
            <dt className="text-silver-400">Energía</dt>
            <dd className="num text-silver-50">{formatKw(kw, 1)}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-silver-400">Total</dt>
            <dd className="num text-xl font-semibold text-silver-50">{formatCop(total)}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-silver-400">{asset ? `En ${asset}` : "Pagas en"}</dt>
            <dd className="num text-silver-100">{asset ? (assetAmount != null ? `≈ ${formatAsset(assetAmount, asset)}` : "—") : "pesos (COP)"}</dd>
          </div>
          <div className="flex justify-between gap-4 border-t border-silicon-600/50 pt-3">
            <dt className="text-silver-400">Ganarías al mes, aprox.</dt>
            <dd className="num font-semibold text-leaf-300">{formatCop((kw * yearlyPerKwp) / 12)}</dd>
          </div>
        </dl>
        {method?.kind === "crypto" && <p className="mt-3 text-xs text-silver-500">Aproximado. El monto exacto se cotiza con el precio en vivo al pagar.</p>}
        {method?.kind === "demo" && m?.rates.source === "referencia" && <p className="mt-3 text-xs text-silver-500">Sin conexión a CoinGecko: se usan precios de referencia.</p>}
        <div className="mt-auto pt-7">
          <button type="button" className="btn btn-sun w-full !py-3.5" onClick={onBuy} disabled={!m || !method || kw > max}>
            {payButtonLabel(method, wallet.status === "connected", wallet.name)}
          </button>
          <p className="mt-3 text-center text-xs text-silver-500">{payFootnote(method)}</p>
        </div>
      </aside>
    </div>
  );
}

function P2P({
  m,
  methods,
  method,
  setPayId,
  onBuy,
}: {
  m?: MarketDTO;
  methods: PayMethod[];
  method: PayMethod | null;
  setPayId(id: string): void;
  onBuy(l: MarketDTO["listings"][number]): void;
}) {
  const price = m?.plant.pricePerKwCop ?? ECONOMICS.pricePerKwCop;
  return (
    <section className="panel p-5 sm:p-7" aria-labelledby="p2p-title">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 id="p2p-title" className="text-lg font-semibold text-silver-50">
            Ofertas de otros inversionistas
          </h2>
          <p className="mt-1 text-sm text-silver-400">Compras kW que ya están generando. El precio lo pone quien vende.</p>
        </div>
        <div className="w-full max-w-[460px]">
          <MethodSelect methods={methods} value={method?.id ?? ""} onChange={setPayId} />
        </div>
      </div>
      <div className="mt-6 overflow-x-auto">
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead className="text-silver-400">
            <tr className="border-b border-silicon-600/50">
              <th className="py-3 font-normal">Vende</th>
              <th className="py-3 font-normal">kW</th>
              <th className="py-3 font-normal">Precio por kW</th>
              <th className="py-3 font-normal">Frente a la planta</th>
              <th className="py-3 font-normal">Total</th>
              <th className="py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-silicon-600/40">
            {(m?.listings ?? []).map((l) => {
              const diff = l.pricePerKwCop / price - 1;
              return (
                <tr key={l.id}>
                  <td className="py-3.5 text-silver-50">
                    {l.sellerName}
                    <div className="text-xs text-silver-500">publicada el {formatDay(l.createdAt)}</div>
                  </td>
                  <td className="num py-3.5 text-silver-100">{formatNumber(l.kw, 1)}</td>
                  <td className="num py-3.5 text-silver-100">{formatCop(l.pricePerKwCop)}</td>
                  <td className={`num py-3.5 ${diff < 0 ? "text-leaf-300" : "text-silver-300"}`}>{`${diff > 0 ? "+" : ""}${formatNumber(diff * 100, 1)} %`}</td>
                  <td className="num py-3.5 font-semibold text-silver-50">{formatCop(l.kw * l.pricePerKwCop)}</td>
                  <td className="py-3.5 text-right">
                    <button type="button" className="btn btn-ghost !px-4 !py-2 text-sm" onClick={() => onBuy(l)} disabled={!method}>
                      Comprar
                    </button>
                  </td>
                </tr>
              );
            })}
            {m && m.listings.length === 0 && (
              <tr>
                <td colSpan={6} className="py-8 text-center text-silver-400">
                  No hay ofertas en este momento. Compra directamente a la planta.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function Sell({ m }: { m?: MarketDTO }) {
  const price = m?.plant.pricePerKwCop ?? ECONOMICS.pricePerKwCop;
  const available = m?.position.availableKw ?? 0;
  const [instantKw, setInstantKw] = useState(0.5);
  const [listKw, setListKw] = useState(1);
  const [listPrice, setListPrice] = useState(price);
  const [busy, setBusy] = useState<string | null>(null);
  const instantTotal = useMemo(() => instantKw * price * (m?.plant.instantSellFactor ?? ECONOMICS.instantSellFactor), [instantKw, price, m]);

  const act = async (key: string, fn: () => Promise<unknown>, ok: string) => {
    setBusy(key);
    try {
      await fn();
      toast(ok);
      void refetch("/api/market");
      void refetch("/api/portfolio");
    } catch (e) {
      toast((e as Error).message, "error");
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="grid gap-5 lg:grid-cols-2">
      <section className="panel p-6 sm:p-8" aria-labelledby="instant-title">
        <h2 id="instant-title" className="text-lg font-semibold text-silver-50">
          Venta inmediata
        </h2>
        <p className="mt-1 text-sm text-silver-400">
          La plataforma te compra al {formatPct(m?.plant.instantSellFactor ?? ECONOMICS.instantSellFactor, 0)} del precio actual y el dinero queda en tu saldo al instante.
        </p>
        <label htmlFor="instant-kw" className="mt-6 block text-sm text-silver-400">
          kW a vender (tienes {formatNumber(available, 1)} disponibles)
        </label>
        <input id="instant-kw" type="number" min={0.1} step={0.1} max={available} value={instantKw} onChange={(e) => setInstantKw(Number(e.target.value))} className="field mt-2" />
        <p className="mt-4 text-silver-300">
          Recibes <span className="num font-semibold text-leaf-300">{formatCop(instantTotal)}</span>
        </p>
        <button
          type="button"
          className="btn btn-sun mt-6 w-full"
          disabled={busy !== null || instantKw <= 0 || instantKw > available}
          onClick={() => act("instant", () => postJson("/api/sell", { mode: "instant", kw: instantKw }), `Vendiste ${formatKw(instantKw, 1)}. ${formatCop(instantTotal)} ya están en tu saldo.`)}
        >
          {busy === "instant" ? "Vendiendo…" : "Vender ahora"}
        </button>
      </section>

      <section className="panel p-6 sm:p-8" aria-labelledby="list-title">
        <h2 id="list-title" className="text-lg font-semibold text-silver-50">
          Publicar en el mercado
        </h2>
        <p className="mt-1 text-sm text-silver-400">Pon tu precio. Mientras nadie compre, tus kW siguen generando para ti.</p>
        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="list-kw" className="text-sm text-silver-400">
              kW
            </label>
            <input id="list-kw" type="number" min={0.1} step={0.1} max={available} value={listKw} onChange={(e) => setListKw(Number(e.target.value))} className="field mt-2" />
          </div>
          <div>
            <label htmlFor="list-price" className="text-sm text-silver-400">
              Precio por kW (COP)
            </label>
            <input id="list-price" type="number" step={10000} value={listPrice} onChange={(e) => setListPrice(Number(e.target.value))} className="field mt-2" />
          </div>
        </div>
        <p className="mt-4 text-silver-300">
          Total de la oferta: <span className="num font-semibold text-silver-50">{formatCop(listKw * listPrice)}</span>
        </p>
        <button
          type="button"
          className="btn btn-ghost mt-6 w-full"
          disabled={busy !== null || listKw <= 0 || listKw > available}
          onClick={() => act("list", () => postJson("/api/sell", { mode: "listing", kw: listKw, pricePerKwCop: Math.round(listPrice) }), `Tu oferta de ${formatKw(listKw, 1)} quedó publicada.`)}
        >
          {busy === "list" ? "Publicando…" : "Publicar oferta"}
        </button>

        {(m?.myListings.length ?? 0) > 0 && (
          <div className="mt-8">
            <h3 className="text-sm font-semibold text-silver-200">Tus ofertas activas</h3>
            <ul className="mt-3 divide-y divide-silicon-600/40">
              {m!.myListings.map((l) => (
                <li key={l.id} className="flex items-center justify-between gap-4 py-3 text-sm">
                  <span className="num text-silver-100">
                    {formatKw(l.kw, 1)} a {formatCop(l.pricePerKwCop)}
                  </span>
                  <button
                    type="button"
                    className="text-silver-400 hover:text-alert-400"
                    disabled={busy !== null}
                    onClick={() => act(l.id, () => postJson(`/api/listings/${l.id}/cancel`), "Retiraste tu oferta del mercado.")}
                  >
                    Retirar oferta
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>
    </div>
  );
}
