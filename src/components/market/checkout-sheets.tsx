"use client";
import { Check, Copy, ExternalLink, Loader2, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useAppConfig } from "@/lib/client/use-app-config";
import { refetch } from "@/lib/client/use-json";
import { clearPending, savePending } from "@/lib/client/pending-crypto";
import { formatCop, formatKw, shortAddress } from "@/lib/format";
import type { TxDTO } from "@/lib/portfolio";
import { buildPayerProofMessage } from "@/lib/signing";
import { useWallet } from "@/lib/wallet/context";
import { useUser } from "@/components/panel/user-context";
import { ProfileForm, useProfile } from "@/components/profile/profile-form";
import { toast } from "@/components/ui/toast";
import { Modal } from "@/components/wallet/connect-dialog";
import { Burst } from "./payment-sheet";

export interface CheckoutRequest {
  kw?: number;
  listingId?: string;
  title: string;
  /** Total estimado en COP (el servidor calcula el definitivo) */
  amountCop: number;
}

class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public code?: string,
  ) {
    super(message);
  }
}

async function api<T>(url: string, body?: unknown): Promise<T> {
  const res = await fetch(url, body === undefined ? { cache: "no-store" } : { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  const json = (await res.json().catch(() => ({}))) as T & { error?: string; code?: string };
  if (!res.ok) throw new ApiError(json.error ?? `Error ${res.status}`, res.status, json.code);
  return json;
}

function Summary({ request, children }: { request: CheckoutRequest; children?: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-silicon-600/60 bg-silicon-950/40 p-4">
      <div className="flex items-baseline justify-between gap-4">
        <span className="text-silver-400">Energía</span>
        <span className="num font-semibold text-silver-50">{request.kw ? formatKw(request.kw, 1) : "—"}</span>
      </div>
      <div className="mt-2 flex items-baseline justify-between gap-4">
        <span className="text-silver-400">Total</span>
        <span className="num text-lg font-semibold text-silver-50">{formatCop(request.amountCop)}</span>
      </div>
      {children}
    </div>
  );
}

/** Antes del primer pago real: datos del inversionista y términos aceptados. */
function ProfileGate({ children }: { children: React.ReactNode }) {
  const { data, error } = useProfile();
  if (!data) {
    return error ? <p className="mt-5 text-sm text-alert-400">{error}</p> : <div className="mt-5 h-24 animate-pulse rounded-2xl bg-silicon-800/60" aria-busy="true" />;
  }
  if (!data.profile?.complete) {
    return (
      <div className="mt-5">
        <p className="mb-4 flex items-start gap-2 text-sm text-silver-300">
          <ShieldCheck size={18} className="mt-0.5 shrink-0 text-sun-300" />
          {data.profile ? "Actualizamos los términos: revísalos y acéptalos para continuar." : "Antes de tu primera compra, completa tus datos de inversionista. Solo te los pedimos una vez."}
        </p>
        <ProfileForm submitLabel="Guardar y continuar" onSaved={() => toast("Datos guardados. Ya puedes pagar.")} />
      </div>
    );
  }
  return <>{children}</>;
}

function ErrorBox({ message }: { message: string }) {
  return (
    <p role="alert" className="mt-5 rounded-xl border border-alert-400/40 bg-alert-400/10 p-3 text-sm text-alert-400">
      {message}
    </p>
  );
}

/* ───────────── Wompi: tarjeta, PSE o Nequi ───────────── */

export function WompiSheet({ request, onClose }: { request: CheckoutRequest | null; onClose(): void }) {
  const { config } = useAppConfig();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const pay = async () => {
    if (!request) return;
    setBusy(true);
    setError(null);
    try {
      const o = await api<{ checkoutUrl: string }>("/api/payments/wompi", { kw: request.listingId ? undefined : request.kw, listingId: request.listingId });
      window.location.assign(o.checkoutUrl);
    } catch (e) {
      setBusy(false);
      if (e instanceof ApiError && e.code === "perfil_incompleto") void refetch("/api/profile");
      setError((e as Error).message);
    }
  };

  return (
    <Modal open={!!request} onClose={busy ? () => {} : onClose} title={request?.title ?? "Pagar"} wide>
      {request && (
        <div>
          <Summary request={request}>
            <div className="mt-2 flex items-baseline justify-between gap-4">
              <span className="text-silver-400">Medio</span>
              <span className="text-silver-100">Tarjeta, PSE o Nequi (Wompi)</span>
            </div>
          </Summary>
          <ProfileGate>
            <p className="mt-5 text-sm leading-relaxed text-silver-300">
              Te llevamos al checkout seguro de Wompi. Allí eliges tarjeta, PSE o Nequi y, al terminar, vuelves a Solaxy. Tus kW se asignan apenas el pago
              quede aprobado.
            </p>
            {config?.wompi.sandbox && <p className="mt-2 text-xs text-sun-300">Modo de pruebas de Wompi: no se cobra dinero real.</p>}
            {error && <ErrorBox message={error} />}
            <div className="mt-6 flex flex-wrap justify-end gap-2">
              <button type="button" className="btn btn-ghost" onClick={onClose} disabled={busy}>
                Cancelar
              </button>
              <button type="button" className="btn btn-sun" onClick={() => void pay()} disabled={busy}>
                {busy ? (
                  <>
                    <Loader2 size={16} className="animate-spin" /> Abriendo Wompi…
                  </>
                ) : (
                  `Pagar ${formatCop(request.amountCop)}`
                )}
              </button>
            </div>
          </ProfileGate>
        </div>
      )}
    </Modal>
  );
}

/* ───────────── Cripto directo: USDT o BNB en BNB Chain ───────────── */

interface Quote {
  orderId: string;
  kw: number;
  amountCop: number;
  asset: "USDT" | "BNB";
  amount: string;
  amountBaseUnits: string;
  priceCop: number;
  to: `0x${string}`;
  tokenContract: `0x${string}` | null;
  chainId: number;
  networkName: string;
  explorer: string;
  confirmations: number;
  expiresAt: number;
}

interface CryptoState {
  order: TxDTO;
  state: "pendiente" | "esperando" | "confirmada" | "fallida" | "por_reembolsar" | "cerrada";
  confirmations: number;
  needed: number;
}

type Phase = "inicio" | "cotizando" | "listo" | "enviando" | "verificando" | "fin" | "error";

const STEPS = ["Cotización exacta", "Red BNB Chain", "Envío desde tu wallet", "Confirmaciones de la red", "Energía asignada"];

function CopyLine({ value }: { value: string }) {
  return (
    <button
      type="button"
      onClick={() => void navigator.clipboard?.writeText(value).then(() => toast("Copiado"))}
      className="inline-flex max-w-full items-center gap-1.5 break-all text-left font-mono text-xs text-silver-200 hover:text-silver-50"
      title="Copiar"
    >
      {value}
      <Copy size={12} className="shrink-0 text-silver-400" />
    </button>
  );
}

/** Reloj real (no el del Modo presentación): la cotización vence en tiempo real. */
function useClock(active: boolean) {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    if (!active) return;
    const tick = () => setNow(Date.now());
    const first = setTimeout(tick, 0);
    const id = setInterval(tick, 1000);
    return () => {
      clearTimeout(first);
      clearInterval(id);
    };
  }, [active]);
  return now;
}

function countdown(ms: number) {
  const s = Math.max(0, Math.floor(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

export function CryptoSheet({ request, asset, onClose }: { request: CheckoutRequest | null; asset: "USDT" | "BNB"; onClose(): void }) {
  const wallet = useWallet();
  const user = useUser();
  const { config } = useAppConfig();
  const [phase, setPhase] = useState<Phase>("inicio");
  const [quote, setQuote] = useState<Quote | null>(null);
  const now = useClock(!!quote);
  const [status, setStatus] = useState<CryptoState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [manualHash, setManualHash] = useState("");
  const [showManual, setShowManual] = useState(false);
  const busy = phase === "cotizando" || phase === "enviando";

  const reset = () => {
    setPhase("inicio");
    setQuote(null);
    setStatus(null);
    setError(null);
    setManualHash("");
    setShowManual(false);
  };
  const close = () => {
    if (busy) return;
    reset();
    onClose();
  };

  // Mientras se verifica en la cadena, se consulta cada 3 segundos.
  useEffect(() => {
    if (phase !== "verificando" || !quote) return;
    const t = setInterval(async () => {
      try {
        const s = await api<CryptoState>(`/api/payments/crypto/${quote.orderId}`);
        setStatus(s);
        if (s.state !== "esperando" && s.state !== "pendiente") {
          setPhase("fin");
          clearPending(quote.orderId);
          if (s.state === "confirmada") {
            void refetch("/api/portfolio");
            void refetch("/api/market");
          }
        }
      } catch {
        /* se reintenta en el siguiente ciclo */
      }
    }, 3000);
    return () => clearInterval(t);
  }, [phase, quote]);

  const start = async () => {
    if (!request || !config) return;
    setError(null);
    if (wallet.status !== "connected" || !wallet.address) {
      wallet.openConnect();
      return;
    }
    if (wallet.kind === "demo") {
      setError("La wallet de demostración no tiene fondos: conecta Trust Wallet o MetaMask para pagar con cripto.");
      return;
    }
    setPhase("cotizando");
    try {
      await wallet.ensureChain(config.crypto.chainId);
      // La wallet firma que es tuya (no mueve fondos): así nadie puede pagar "a tu nombre" con una dirección ajena.
      const issuedAt = Date.now();
      const signature = await wallet.signMessage(buildPayerProofMessage({ userId: user.id, payer: wallet.address, issuedAt }));
      const q = await api<Quote>("/api/payments/crypto/quote", {
        kw: request.listingId ? undefined : request.kw,
        listingId: request.listingId,
        asset,
        payer: wallet.address,
        walletName: wallet.name ?? "Wallet",
        proof: { signature, issuedAt },
      });
      setQuote(q);
      setPhase("listo");
    } catch (e) {
      if (e instanceof ApiError && e.code === "perfil_incompleto") void refetch("/api/profile");
      setError((e as Error).message);
      setPhase("inicio");
    }
  };

  const afterHash = async (hash: string) => {
    if (!quote) return;
    savePending(quote.orderId, hash);
    setPhase("verificando");
    try {
      const s = await api<CryptoState>("/api/payments/crypto/submit", { orderId: quote.orderId, txHash: hash });
      setStatus(s);
      if (s.state !== "esperando" && s.state !== "pendiente") {
        clearPending(quote.orderId);
        setPhase("fin");
        if (s.state === "confirmada") void refetch("/api/portfolio");
      }
    } catch (e) {
      // El hash queda guardado: el panel lo reenviará. Mostramos el motivo sin perder el pago.
      if (e instanceof ApiError && e.status < 500) {
        clearPending(quote.orderId);
        setError(e.message);
        setPhase("error");
      }
    }
  };

  const send = async () => {
    if (!quote || !config) return;
    setError(null);
    setPhase("enviando");
    try {
      await wallet.ensureChain(quote.chainId);
      const hash = await wallet.sendPayment(
        quote.tokenContract
          ? { kind: "token", contract: quote.tokenContract, recipient: quote.to, amount: BigInt(quote.amountBaseUnits) }
          : { kind: "native", to: quote.to, value: BigInt(quote.amountBaseUnits) },
      );
      await afterHash(hash);
    } catch (e) {
      setError((e as Error).message);
      setPhase("listo");
    }
  };

  const expired = quote && now ? now > quote.expiresAt : false;
  const step = phase === "inicio" || phase === "cotizando" ? 0 : phase === "listo" ? 2 : phase === "enviando" ? 2 : phase === "verificando" ? 3 : status?.state === "confirmada" ? 5 : 3;
  const explorer = quote?.explorer ?? config?.crypto.explorer ?? "https://bscscan.com";
  const sentHash = status?.order.txHash ?? null;
  const done = phase === "fin" && status?.state === "confirmada";

  return (
    <Modal open={!!request} onClose={close} title={done ? "¡Listo! Ya es tuya" : (request?.title ?? "Pagar con cripto")} wide>
      {request && (
        <div>
          <Summary request={quote ? { ...request, kw: quote.kw, amountCop: quote.amountCop } : request}>
            <div className="mt-2 flex items-baseline justify-between gap-4">
              <span className="text-silver-400">Pagas</span>
              <span className="num text-right text-silver-100">{quote ? `${quote.amount} ${quote.asset}` : `${asset} en ${config?.crypto.networkName ?? "BNB Chain"}`}</span>
            </div>
            {wallet.status === "connected" && (
              <div className="mt-2 flex items-baseline justify-between gap-4">
                <span className="text-silver-400">Desde</span>
                <span className="num text-silver-100">
                  {wallet.name}, {shortAddress(wallet.address)}
                </span>
              </div>
            )}
          </Summary>

          <ProfileGate>
            {quote && (phase === "listo" || phase === "enviando") && (
              <div className="mt-5 rounded-2xl border border-sun-400/30 bg-sun-400/5 p-4 text-sm">
                <p className="text-silver-200">
                  Envía <span className="num font-semibold text-silver-50">{quote.amount} {quote.asset}</span> a la billetera de Solaxy en {quote.networkName}:
                </p>
                <div className="mt-2">
                  <CopyLine value={quote.to} />
                </div>
                <p className="num mt-2 text-xs text-silver-400">
                  1 {quote.asset} = {formatCop(quote.priceCop)} · {expired ? "la cotización venció" : now ? `vence en ${countdown(quote.expiresAt - now)}` : "vigente por 20 minutos"}
                </p>
              </div>
            )}

            <ol className="mt-6 space-y-3.5">
              {STEPS.map((s, i) => {
                const isDone = i < step;
                const current = i === step && phase === "listo";
                const active = i === step && (busy || phase === "verificando");
                const detail =
                  i === 0 && quote
                    ? `Orden ${quote.orderId}`
                    : i === 1 && quote
                      ? quote.networkName
                      : i === 2 && phase === "enviando"
                        ? "Aprueba el envío en tu wallet"
                        : i === 2 && sentHash
                          ? `Transacción ${sentHash.slice(0, 10)}…${sentHash.slice(-6)}`
                          : i === 3 && status
                            ? `${Math.min(status.confirmations, status.needed)} de ${status.needed} confirmaciones`
                            : null;
                return (
                  <li key={s} className="flex gap-3">
                    <span
                      className={`relative mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border ${
                        isDone || (i === 4 && done) ? "border-leaf-400 bg-leaf-400/15 text-leaf-300" : active || current ? "border-sun-400 text-sun-300" : "border-silicon-500 text-silver-500"
                      }`}
                    >
                      {isDone || (i === 4 && done) ? <Check size={15} /> : active ? <Loader2 size={15} className="animate-spin" /> : <span className="text-xs">{i + 1}</span>}
                      {i === 4 && done && <Burst />}
                    </span>
                    <div>
                      <div className={isDone || active || current ? "font-medium text-silver-50" : "text-silver-400"}>{s}</div>
                      {detail && <div className="num text-sm text-silver-400">{detail}</div>}
                    </div>
                  </li>
                );
              })}
            </ol>

            {sentHash && (
              <a href={`${explorer}/tx/${sentHash}`} target="_blank" rel="noreferrer" className="mt-4 inline-flex items-center gap-1.5 text-sm text-sun-300 hover:text-sun-200">
                Ver la transacción en BscScan <ExternalLink size={13} />
              </a>
            )}

            {phase === "fin" && status && status.state !== "confirmada" && (
              <ErrorBox message={status.order.note ?? (status.state === "por_reembolsar" ? "Recibimos el pago pero no pudimos asignar los kW: te lo devolveremos." : "El pago no se pudo verificar.")} />
            )}
            {phase === "verificando" && <p className="mt-4 text-sm text-silver-400">Puedes cerrar esta ventana: si el pago se confirma, tus kW aparecerán en tu panel.</p>}
            {error && <ErrorBox message={error} />}

            {phase === "listo" && quote && !expired && (
              <div className="mt-4">
                <button type="button" className="text-sm text-silver-400 underline underline-offset-2 hover:text-silver-200" onClick={() => setShowManual(!showManual)}>
                  ¿Ya enviaste el pago desde tu wallet? Pega el hash
                </button>
                {showManual && (
                  <div className="mt-2 flex gap-2">
                    <input value={manualHash} onChange={(e) => setManualHash(e.target.value.trim())} placeholder="0x…" aria-label="Hash de la transacción" className="field num !py-2 text-sm" />
                    <button type="button" className="btn btn-ghost !py-2 text-sm" disabled={!/^0x[0-9a-fA-F]{64}$/.test(manualHash)} onClick={() => void afterHash(manualHash)}>
                      Verificar
                    </button>
                  </div>
                )}
              </div>
            )}

            <div className="mt-6 flex flex-wrap justify-end gap-2">
              {!busy && phase !== "verificando" && (
                <button type="button" className="btn btn-ghost" onClick={close}>
                  {done ? "Seguir comprando" : "Cerrar"}
                </button>
              )}
              {phase === "inicio" && (
                <button type="button" className="btn btn-sun" onClick={() => void start()}>
                  {wallet.status === "connected" ? "Cotizar el pago" : "Conectar wallet"}
                </button>
              )}
              {phase === "cotizando" && (
                <button type="button" className="btn btn-sun" disabled>
                  <Loader2 size={16} className="animate-spin" /> Firma en tu wallet y cotizamos…
                </button>
              )}
              {(phase === "listo" || phase === "enviando") && quote && (
                expired ? (
                  <button type="button" className="btn btn-sun" onClick={() => void start()}>
                    Cotizar de nuevo
                  </button>
                ) : (
                  <button type="button" className="btn btn-sun" onClick={() => void send()} disabled={phase === "enviando"}>
                    {phase === "enviando" ? (
                      <>
                        <Loader2 size={16} className="animate-spin" /> Esperando tu wallet…
                      </>
                    ) : (
                      `Enviar ${quote.amount} ${quote.asset}`
                    )}
                  </button>
                )
              )}
              {phase === "error" && (
                <button type="button" className="btn btn-sun" onClick={reset}>
                  Intentar de nuevo
                </button>
              )}
              {done && (
                <Link href="/panel" className="btn btn-sun" onClick={close}>
                  Ver mi energía en vivo
                </Link>
              )}
            </div>
          </ProfileGate>
        </div>
      )}
    </Modal>
  );
}
