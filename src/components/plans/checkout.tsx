"use client";
import { Check, Copy, ExternalLink, Loader2 } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { BRAND } from "@/config/brand";
import type { AppConfigDTO } from "@/lib/app-config";
import { clearPending, savePending } from "@/lib/client/pending-crypto";
import { useAppConfig } from "@/lib/client/use-app-config";
import { refetch } from "@/lib/client/use-json";
import { useNow } from "@/lib/client/use-now";
import { formatCop, formatNumber, shortAddress } from "@/lib/format";
import type { TxDTO } from "@/lib/portfolio";
import { buildPayerProofMessage } from "@/lib/signing";
import { useWallet } from "@/lib/wallet/context";
import { useUser } from "@/components/panel/user-context";
import { ProfileForm, useProfile } from "@/components/profile/profile-form";
import { ErrorNote } from "@/components/ui/field";
import { Modal } from "@/components/ui/modal";
import { toast } from "@/components/ui/toast";

/** Lo que se va a pagar: el primer mes de un plan nuevo o el mes siguiente de un plan del usuario. */
export interface CheckoutRequest {
  planId?: string;
  subscriptionId?: string;
  planName: string;
  periodIndex: number;
  months: number;
  /** Energía del mes (kWh) y monto estimado: el servidor calcula el definitivo. */
  kwh: number;
  amountCop: number;
}

type MethodId = "mercadopago" | "USDT" | "BNB" | "test";
interface Method {
  id: MethodId;
  label: string;
  note: string;
}

function methodsFrom(config: AppConfigDTO | null): Method[] {
  if (!config) return [];
  const list: Method[] = [];
  if (config.mercadopago.enabled) {
    list.push({ id: "mercadopago", label: "Tarjeta, PSE o Nequi", note: config.mercadopago.sandbox ? "Mercado Pago, en modo de pruebas" : "Con Mercado Pago" });
  }
  if (config.crypto.enabled) {
    const net = config.crypto.network === "bsc-testnet" ? "red de pruebas de BNB Chain" : "BNB Chain";
    list.push({ id: "USDT", label: "USDT", note: `Desde tu wallet, en la ${net}` }, { id: "BNB", label: "BNB", note: `Desde tu wallet, en la ${net}` });
  }
  if (config.demoMode) list.push({ id: "test", label: "Pago de prueba", note: "Activa el mes al instante, sin mover dinero" });
  return list;
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

const target = (r: CheckoutRequest) => (r.subscriptionId ? { subscriptionId: r.subscriptionId } : { planId: r.planId });

/** Después de un pago confirmado, el panel debe mostrar el plan y el cupo actualizados. */
function refreshAfterPayment() {
  void refetch("/api/portfolio");
  void refetch("/api/plans");
}

function Row({ label, children, strong = false }: { label: string; children: React.ReactNode; strong?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-6 border-b border-line py-3">
      <dt className="cap">{label}</dt>
      <dd className={`num text-right ${strong ? "text-xl" : ""}`}>{children}</dd>
    </div>
  );
}

/** Antes del primer pago: datos de la empresa y términos aceptados. */
function ProfileGate({ children }: { children: React.ReactNode }) {
  const { data, error } = useProfile();
  if (!data) return error ? <ErrorNote className="mt-6">{error}</ErrorNote> : <div className="skeleton mt-6 h-24" aria-busy="true" />;
  if (!data.profile?.complete) {
    return (
      <div className="mt-8">
        <p className="mb-8 leading-relaxed text-fog">Antes de pagar, registra tu empresa. Solo te lo pedimos una vez.</p>
        <ProfileForm submitLabel="Guardar y continuar" onSaved={() => toast("Datos guardados. Ya puedes pagar.")} />
      </div>
    );
  }
  return <>{children}</>;
}

/** Diálogo de pago de un mes: resumen, datos de la empresa (si faltan), medio de pago y el pago. */
export function CheckoutDialog({ request, onClose }: { request: CheckoutRequest | null; onClose(): void }) {
  const { config } = useAppConfig();
  const methods = methodsFrom(config);
  const [chosen, setChosen] = useState<MethodId | null>(null);
  const [locked, setLocked] = useState(false);
  const method = methods.find((m) => m.id === chosen) ?? methods[0] ?? null;
  const close = () => {
    if (locked) return;
    setChosen(null);
    onClose();
  };
  const title = request ? (request.periodIndex === 1 ? `Comprar ${request.planName}` : `Pagar el mes ${request.periodIndex}`) : "Pagar";

  return (
    <Modal open={!!request} onClose={close} title={title} wide>
      {request && (
        <div>
          <dl className="border-t border-line-strong">
            <Row label="Plan">{request.planName}</Row>
            <Row label="Mes">
              {request.periodIndex} de {request.months}
            </Row>
            <Row label="Energía del mes">{formatNumber(request.kwh)} kWh</Row>
            <Row label="Pago de este mes" strong>
              {formatCop(request.amountCop)}
            </Row>
          </dl>
          <ProfileGate>
            {!config ? (
              <div className="skeleton mt-6 h-32" aria-busy="true" />
            ) : !method ? (
              <ErrorNote className="mt-6">Todavía no hay medios de pago configurados. Escríbenos y te ayudamos a pagar este mes.</ErrorNote>
            ) : (
              <>
                <fieldset className="mt-8" disabled={locked}>
                  <legend className="cap mb-1">Pagar con</legend>
                  {methods.map((m) => (
                    <label key={m.id} className="flex cursor-pointer items-center gap-4 border-b border-line py-3.5 has-[:disabled]:cursor-default has-[:disabled]:opacity-50">
                      <input type="radio" name="pay" value={m.id} checked={m.id === method.id} onChange={() => setChosen(m.id)} className="peer sr-only" />
                      <span aria-hidden="true" className="h-3.5 w-3.5 shrink-0 border border-fog peer-checked:border-ink peer-checked:bg-ink peer-checked:shadow-[inset_0_0_0_2.5px_var(--color-raise)] peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-ink" />
                      <span>{m.label}</span>
                      <span className="ml-auto text-right text-xs text-mute">{m.note}</span>
                    </label>
                  ))}
                </fieldset>
                {method.id === "mercadopago" && <MercadoPagoPay request={request} onClose={close} onBusy={setLocked} />}
                {method.id === "test" && <TestPay request={request} onClose={close} onBusy={setLocked} />}
                {(method.id === "USDT" || method.id === "BNB") && <CryptoPay key={method.id} request={request} asset={method.id} config={config} onClose={close} onBusy={setLocked} />}
              </>
            )}
          </ProfileGate>
        </div>
      )}
    </Modal>
  );
}

interface PayProps {
  request: CheckoutRequest;
  onClose(): void;
  /** Mientras un pago está en curso no se puede cambiar de medio ni cerrar el diálogo. */
  onBusy(busy: boolean): void;
}

/* ───────────── Mercado Pago: tarjeta, PSE o Nequi ───────────── */

function MercadoPagoPay({ request, onClose, onBusy }: PayProps) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const pay = async () => {
    setBusy(true);
    onBusy(true);
    setError(null);
    try {
      const o = await api<{ checkoutUrl: string }>("/api/payments/mercadopago", target(request));
      window.location.assign(o.checkoutUrl);
    } catch (e) {
      setBusy(false);
      onBusy(false);
      if (e instanceof ApiError && e.code === "perfil_incompleto") void refetch("/api/profile");
      setError((e as Error).message);
    }
  };

  return (
    <div className="mt-6">
      <p className="text-sm leading-relaxed text-fog">
        Te llevamos al pago seguro de Mercado Pago. Allí eliges tarjeta o PSE; para pagar con Nequi o Daviplata, elige PSE y luego tu billetera. Al terminar vuelves a {BRAND.name} y tu energía
        empieza a contar apenas el pago quede aprobado.
      </p>
      {error && <ErrorNote className="mt-5">{error}</ErrorNote>}
      <div className="mt-7 flex flex-wrap justify-end gap-3">
        <button type="button" className="btn btn-ghost" onClick={onClose} disabled={busy}>
          Cancelar
        </button>
        <button type="button" className="btn btn-solid" onClick={() => void pay()} disabled={busy}>
          {busy ? (
            <>
              <Loader2 size={15} className="animate-spin" /> Abriendo Mercado Pago…
            </>
          ) : (
            `Pagar ${formatCop(request.amountCop)}`
          )}
        </button>
      </div>
    </div>
  );
}

/* ───────────── Pago de prueba (solo en modo de pruebas) ───────────── */

function Done({ onClose, children }: { onClose(): void; children: React.ReactNode }) {
  return (
    <div className="mt-8 border-t border-line-strong pt-6">
      <p className="flex items-start gap-3 text-lg">
        <Check size={22} strokeWidth={1.8} className="mt-0.5 shrink-0" />
        <span>{children}</span>
      </p>
      <div className="mt-7 flex flex-wrap justify-end gap-3">
        <button type="button" className="btn btn-ghost" onClick={onClose}>
          Cerrar
        </button>
        <Link href="/panel" className="btn btn-solid" onClick={onClose}>
          Ver mi energía
        </Link>
      </div>
    </div>
  );
}

function TestPay({ request, onClose, onBusy }: PayProps) {
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const pay = async () => {
    setBusy(true);
    onBusy(true);
    setError(null);
    try {
      await api("/api/payments/test", target(request));
      refreshAfterPayment();
      setDone(true);
    } catch (e) {
      if (e instanceof ApiError && e.code === "perfil_incompleto") void refetch("/api/profile");
      setError((e as Error).message);
    } finally {
      setBusy(false);
      onBusy(false);
    }
  };

  if (done) return <Done onClose={onClose}>Mes activado. La energía de tu plan ya está contando.</Done>;
  return (
    <div className="mt-6">
      <p className="text-sm leading-relaxed text-fog">El pago de prueba confirma el mes al instante y no mueve dinero. Solo existe mientras la página está en modo de pruebas.</p>
      {error && <ErrorNote className="mt-5">{error}</ErrorNote>}
      <div className="mt-7 flex flex-wrap justify-end gap-3">
        <button type="button" className="btn btn-ghost" onClick={onClose} disabled={busy}>
          Cancelar
        </button>
        <button type="button" className="btn btn-solid" onClick={() => void pay()} disabled={busy}>
          {busy ? (
            <>
              <Loader2 size={15} className="animate-spin" /> Activando…
            </>
          ) : (
            "Confirmar pago de prueba"
          )}
        </button>
      </div>
    </div>
  );
}

/* ───────────── Cripto directo: USDT o BNB en BNB Chain ───────────── */

interface Quote {
  orderId: string;
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

const STEPS = ["Cotización exacta", "Red BNB Chain", "Envío desde tu wallet", "Confirmaciones de la red", "Mes activado"];

function countdown(ms: number) {
  const s = Math.max(0, Math.floor(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

function CryptoPay({ request, asset, config, onClose, onBusy }: PayProps & { asset: "USDT" | "BNB"; config: AppConfigDTO }) {
  const wallet = useWallet();
  const user = useUser();
  const [phase, setPhase] = useState<Phase>("inicio");
  const [quote, setQuote] = useState<Quote | null>(null);
  const now = useNow(1000);
  const [status, setStatus] = useState<CryptoState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [manualHash, setManualHash] = useState("");
  const [showManual, setShowManual] = useState(false);
  const busy = phase === "cotizando" || phase === "enviando";

  useEffect(() => {
    onBusy(busy);
    return () => onBusy(false);
  }, [busy, onBusy]);

  const reset = () => {
    setPhase("inicio");
    setQuote(null);
    setStatus(null);
    setError(null);
    setManualHash("");
    setShowManual(false);
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
          if (s.state === "confirmada") refreshAfterPayment();
        }
      } catch {
        /* se reintenta en el siguiente ciclo */
      }
    }, 3000);
    return () => clearInterval(t);
  }, [phase, quote]);

  const start = async () => {
    setError(null);
    if (wallet.status !== "connected" || !wallet.address) {
      wallet.openConnect();
      return;
    }
    setPhase("cotizando");
    try {
      await wallet.ensureChain(config.crypto.chainId);
      // La wallet firma que es tuya (no mueve fondos): así nadie puede pagar "a tu nombre" con una dirección ajena.
      const issuedAt = Date.now();
      const signature = await wallet.signMessage(buildPayerProofMessage({ userId: user.id, payer: wallet.address, issuedAt }));
      const q = await api<Quote>("/api/payments/crypto/quote", { ...target(request), asset, payer: wallet.address, walletName: wallet.name ?? "Wallet", proof: { signature, issuedAt } });
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
        if (s.state === "confirmada") refreshAfterPayment();
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
    if (!quote) return;
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
  const step = phase === "inicio" || phase === "cotizando" ? 0 : phase === "listo" || phase === "enviando" ? 2 : phase === "verificando" ? 3 : status?.state === "confirmada" ? 5 : 3;
  const explorer = quote?.explorer ?? config.crypto.explorer;
  const sentHash = status?.order.txHash ?? null;
  const done = phase === "fin" && status?.state === "confirmada";

  if (done) return <Done onClose={onClose}>Pago confirmado en la red. La energía de tu plan ya está contando.</Done>;

  return (
    <div className="mt-6">
      {wallet.status === "connected" && (
        <p className="text-sm text-fog">
          Pagas desde {wallet.name}, <span className="num">{shortAddress(wallet.address)}</span>.
        </p>
      )}

      {quote && (phase === "listo" || phase === "enviando") && (
        <div className="mt-5 border border-line-strong p-4 text-sm">
          <p className="leading-relaxed">
            Envía{" "}
            <span className="num">
              {quote.amount} {quote.asset}
            </span>{" "}
            a la billetera de {BRAND.name} en {quote.networkName}:
          </p>
          <button
            type="button"
            onClick={() => void navigator.clipboard?.writeText(quote.to).then(() => toast("Dirección copiada"))}
            className="num mt-2 inline-flex max-w-full items-center gap-2 break-all text-left text-xs text-fog hover:text-ink"
            title="Copiar la dirección"
          >
            {quote.to}
            <Copy size={12} className="shrink-0" />
          </button>
          <p className="num mt-3 text-xs text-mute">
            1 {quote.asset} = {formatCop(quote.priceCop)}. {expired ? "La cotización venció." : now ? `Vence en ${countdown(quote.expiresAt - now)}.` : "Vigente por 20 minutos."}
          </p>
        </div>
      )}

      <ol className="mt-6">
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
            <li key={s} className="flex items-start gap-4 border-b border-line py-3">
              <span className={`num flex h-6 w-6 shrink-0 items-center justify-center border text-xs ${isDone ? "border-ink bg-ink text-void" : active || current ? "border-ink text-ink" : "border-line-strong text-dim"}`}>
                {isDone ? <Check size={13} strokeWidth={2.4} /> : active ? <Loader2 size={13} className="animate-spin" /> : i + 1}
              </span>
              <div>
                <div className={isDone || active || current ? "text-ink" : "text-mute"}>{s}</div>
                {detail && <div className="num mt-0.5 text-sm text-mute">{detail}</div>}
              </div>
            </li>
          );
        })}
      </ol>

      {sentHash && (
        <a href={`${explorer}/tx/${sentHash}`} target="_blank" rel="noreferrer" className="link mt-4 inline-flex items-center gap-2 text-sm">
          Ver la transacción en BscScan <ExternalLink size={13} />
        </a>
      )}

      {phase === "fin" && status && status.state !== "confirmada" && (
        <ErrorNote className="mt-5">{status.order.note ?? (status.state === "por_reembolsar" ? "Recibimos el pago, pero no pudimos activar el mes: te lo devolveremos." : "El pago no se pudo verificar.")}</ErrorNote>
      )}
      {phase === "verificando" && <p className="mt-4 text-sm text-mute">Puedes cerrar esta ventana: cuando el pago se confirme, tu plan aparecerá en el panel.</p>}
      {error && <ErrorNote className="mt-5">{error}</ErrorNote>}

      {phase === "listo" && quote && !expired && (
        <div className="mt-5">
          <button type="button" className="link text-sm text-fog" onClick={() => setShowManual(!showManual)}>
            ¿Ya enviaste el pago desde tu wallet? Pega el hash
          </button>
          {showManual && (
            <div className="mt-3 flex items-end gap-3">
              <input value={manualHash} onChange={(e) => setManualHash(e.target.value.trim())} placeholder="0x…" aria-label="Hash de la transacción" className="field num text-sm" />
              <button type="button" className="btn btn-ghost" disabled={!/^0x[0-9a-fA-F]{64}$/.test(manualHash)} onClick={() => void afterHash(manualHash)}>
                Verificar
              </button>
            </div>
          )}
        </div>
      )}

      <div className="mt-7 flex flex-wrap justify-end gap-3">
        {!busy && phase !== "verificando" && (
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            {phase === "fin" ? "Cerrar" : "Cancelar"}
          </button>
        )}
        {phase === "verificando" && (
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            Cerrar
          </button>
        )}
        {phase === "inicio" && (
          <button type="button" className="btn btn-solid" onClick={() => void start()}>
            {wallet.status === "connected" ? "Cotizar el pago" : "Conectar wallet"}
          </button>
        )}
        {phase === "cotizando" && (
          <button type="button" className="btn btn-solid" disabled>
            <Loader2 size={15} className="animate-spin" /> Firma en tu wallet…
          </button>
        )}
        {(phase === "listo" || phase === "enviando") &&
          quote &&
          (expired ? (
            <button type="button" className="btn btn-solid" onClick={() => void start()}>
              Cotizar de nuevo
            </button>
          ) : (
            <button type="button" className="btn btn-solid" onClick={() => void send()} disabled={phase === "enviando"}>
              {phase === "enviando" ? (
                <>
                  <Loader2 size={15} className="animate-spin" /> Esperando tu wallet…
                </>
              ) : (
                <span>
                  Enviar {quote.amount} <span className="unit">{quote.asset}</span>
                </span>
              )}
            </button>
          ))}
        {phase === "error" && (
          <button type="button" className="btn btn-solid" onClick={reset}>
            Intentar de nuevo
          </button>
        )}
      </div>
    </div>
  );
}
