"use client";
import { Check, Copy, ExternalLink, Loader2 } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { BRAND } from "@/config/brand";
import type { AppConfigDTO } from "@/lib/app-config";
import { clearPending, savePending } from "@/lib/client/pending-crypto";
import { useAppConfig } from "@/lib/client/use-app-config";
import { invalidateJson, refetch } from "@/lib/client/use-json";
import { usePlantNow } from "@/lib/client/use-catalog";
import { formatCop, shortAddress } from "@/lib/format";
import type { TxDTO } from "@/lib/portfolio";
import { buildPayerProofMessage } from "@/lib/signing";
import { useWallet } from "@/lib/wallet/context";
import { useUser } from "@/components/panel/user-context";
import { ErrorNote } from "@/components/ui/field";
import { toast } from "@/components/ui/toast";

import type { CheckoutRequest } from "@/lib/checkout";
export type { CheckoutRequest } from "@/lib/checkout";

type MethodId = "mercadopago" | "USDT" | "BNB" | "test";
interface Method {
  id: MethodId;
  label: string;
  note: string;
}

/** ¿Mercado Pago recibe este monto, y con tarjeta? Los topes los da el servidor (lib/payments/mercadopago-limits). */
function mercadoPagoFor(config: AppConfigDTO, amountCop: number) {
  const available =
    config.mercadopago.enabled && amountCop <= config.mercadopago.pseMaxCop;
  return {
    available,
    cards: available && amountCop <= config.mercadopago.cardMaxCop,
  };
}

function methodsFrom(
  config: AppConfigDTO | null,
  amountCop: number,
): Method[] {
  if (!config) return [];
  const list: Method[] = [];
  const mp = mercadoPagoFor(config, amountCop);
  if (mp.available) {
    list.push({
      id: "mercadopago",
      label: mp.cards ? "PSE o tarjeta" : "PSE",
      note: config.mercadopago.sandbox
        ? "Mercado Pago, en modo de pruebas"
        : "Con Mercado Pago",
    });
  }
  if (config.crypto.enabled) {
    const net =
      config.crypto.network === "bsc-testnet"
        ? "red de pruebas de BNB Chain"
        : "BNB Chain";
    list.push(
      { id: "USDT", label: "USDT", note: `Desde tu wallet, en la ${net}` },
      { id: "BNB", label: "BNB", note: `Desde tu wallet, en la ${net}` },
    );
  }
  if (config.demoMode)
    list.push({
      id: "test",
      label: "Pago de prueba",
      note: "Activa el mes al instante, sin mover dinero",
    });
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
  const res = await fetch(
    url,
    body === undefined
      ? { cache: "no-store" }
      : {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(body),
        },
  );
  const json = (await res.json().catch(() => ({}))) as T & {
    error?: string;
    code?: string;
  };
  if (!res.ok)
    throw new ApiError(
      json.error ?? `Error ${res.status}`,
      res.status,
      json.code,
    );
  return json;
}

const target = (r: CheckoutRequest) => ({
  ...(r.subscriptionId
    ? { subscriptionId: r.subscriptionId }
    : { planId: r.planId }),
  expectedAmountCop: r.amountCop,
  expectedSaleCopPerKwh: r.saleCopPerKwh,
});

/** Después de un pago confirmado, el panel debe mostrar el plan y el cupo actualizados. */
function refreshAfterPayment() {
  invalidateJson("/api/transactions");
  void refetch("/api/portfolio");
  void refetch("/api/plans");
}

/** Medios de pago compartidos por el recorrido de compra. La confirmación viene del servidor. */
export function CheckoutPayment({
  request,
  onClose,
  onConfirmed,
  onBusy,
}: PayProps) {
  const { config } = useAppConfig();
  const methods = methodsFrom(config, request.amountCop);
  // Mercado Pago está configurado pero no recibe un pago tan grande: se dice por qué no aparece.
  const overMercadoPago =
    !!config &&
    config.mercadopago.enabled &&
    !mercadoPagoFor(config, request.amountCop).available;
  const [chosen, setChosen] = useState<MethodId | null>(null);
  const [locked, setLocked] = useState(false);
  const method = methods.find((m) => m.id === chosen) ?? methods[0] ?? null;
  const lock = useCallback(
    (value: boolean) => {
      setLocked(value);
      onBusy(value);
    },
    [onBusy],
  );
  if (!config)
    return (
      <div
        className="skeleton mt-6 h-32"
        aria-busy="true"
        aria-label="Cargando medios de pago"
      />
    );
  if (!method)
    return (
      <ErrorNote className="mt-6">
        No hay medios de pago disponibles en este momento.{" "}
        <Link href="/ayuda" className="link">
          Visita el centro de ayuda
        </Link>
        .
      </ErrorNote>
    );
  const props = { request, onClose, onBusy: lock, onConfirmed };
  return (
    <div>
      <fieldset className="mt-7" disabled={locked}>
        <legend className="cap mb-2">Pagar con</legend>
        {methods.map((m) => (
          <label
            key={m.id}
            className="flex cursor-pointer items-start gap-4 border-b border-line py-5 has-[:disabled]:cursor-default has-[:disabled]:opacity-50"
          >
            <input
              type="radio"
              name="pay"
              value={m.id}
              checked={m.id === method.id}
              onChange={() => setChosen(m.id)}
              className="peer sr-only"
            />
            <span
              aria-hidden="true"
              className="mt-1 h-3.5 w-3.5 shrink-0 border border-fog peer-checked:border-ink peer-checked:bg-ink peer-checked:shadow-[inset_0_0_0_2.5px_var(--color-void)] peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-ink"
            />
            <span className="min-w-0">
              <span className="block font-medium">{m.label}</span>
              <span className="mt-1 block text-sm text-mute">{m.note}</span>
            </span>
          </label>
        ))}
      </fieldset>
      {overMercadoPago && (
        <p className="mt-4 text-sm leading-relaxed text-mute">
          Mercado Pago recibe hasta {formatCop(config.mercadopago.pseMaxCop)}{" "}
          por pago: este mes págalo con cripto, o escríbenos para pagarlo por
          transferencia bancaria.
        </p>
      )}
      {method.id === "mercadopago" && (
        <MercadoPagoPay
          {...props}
          cards={mercadoPagoFor(config, request.amountCop).cards}
          cardMaxCop={config.mercadopago.cardMaxCop}
        />
      )}
      {method.id === "test" && <TestPay {...props} />}
      {(method.id === "USDT" || method.id === "BNB") && (
        <CryptoPay
          key={method.id}
          {...props}
          asset={method.id}
          config={config}
        />
      )}
      <div className="mt-7 flex flex-wrap justify-between gap-4 border-t border-line pt-5 text-sm text-mute">
        <Link href="/ayuda" className="link text-ink">
          Ayuda con el pago
        </Link>
        <button
          type="button"
          className="link"
          onClick={() => window.location.reload()}
          disabled={locked}
        >
          Actualizar resumen y precios
        </button>
      </div>
    </div>
  );
}

interface PayProps {
  request: CheckoutRequest;
  onClose(): void;
  /** Mientras un pago está en curso no se puede cambiar de medio ni cerrar el diálogo. */
  onBusy(busy: boolean): void;
  onConfirmed?(order: TxDTO): void;
}

/* ───────────── Mercado Pago: PSE o tarjeta ───────────── */

function MercadoPagoPay({
  request,
  onClose,
  onBusy,
  cards,
  cardMaxCop,
}: PayProps & { cards: boolean; cardMaxCop: number }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const pay = async () => {
    setBusy(true);
    onBusy(true);
    setError(null);
    try {
      const o = await api<{ checkoutUrl: string }>(
        "/api/payments/mercadopago",
        target(request),
      );
      window.location.assign(o.checkoutUrl);
    } catch (e) {
      setBusy(false);
      onBusy(false);
      if (e instanceof ApiError && e.code === "perfil_incompleto")
        void refetch("/api/profile");
      setError((e as Error).message);
    }
  };

  return (
    <div className="mt-6">
      <p className="text-sm leading-relaxed text-fog">
        {cards
          ? "Te llevamos al pago seguro de Mercado Pago. Allí eliges PSE o tarjeta; Nequi y Daviplata aparecen dentro de PSE, con sus propios topes."
          : `Te llevamos al pago seguro de Mercado Pago, donde pagas por PSE desde una cuenta bancaria a tu nombre: Mercado Pago recibe tarjetas solo hasta ${formatCop(cardMaxCop)}. Antes, confirma con tu banco que tengas habilitado un pago de ${formatCop(request.amountCop)} por PSE.`}{" "}
        Al terminar vuelves a {BRAND.name} y tu energía empieza a contar apenas
        el pago quede aprobado.
      </p>
      {error && <ErrorNote className="mt-5">{error}</ErrorNote>}
      <div className="mt-7 flex flex-wrap justify-end gap-3">
        <button
          type="button"
          className="btn btn-ghost"
          onClick={onClose}
          disabled={busy}
        >
          Cancelar
        </button>
        <button
          type="button"
          className="btn btn-solid"
          onClick={() => void pay()}
          disabled={busy}
        >
          {busy ? (
            <>
              <Loader2 size={15} className="animate-spin" /> Abriendo Mercado
              Pago…
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

function Done({
  onClose,
  children,
}: {
  onClose(): void;
  children: React.ReactNode;
}) {
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

function TestPay({ request, onClose, onBusy, onConfirmed }: PayProps) {
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const pay = async () => {
    setBusy(true);
    onBusy(true);
    setError(null);
    try {
      const result = await api<{ order: TxDTO }>(
        "/api/payments/test",
        target(request),
      );
      refreshAfterPayment();
      setDone(true);
      onConfirmed?.(result.order);
    } catch (e) {
      if (e instanceof ApiError && e.code === "perfil_incompleto")
        void refetch("/api/profile");
      setError((e as Error).message);
    } finally {
      setBusy(false);
      onBusy(false);
    }
  };

  if (done)
    return (
      <Done onClose={onClose}>
        Mes activado. La energía de tu plan ya está contando.
      </Done>
    );
  return (
    <div className="mt-6">
      <p className="text-sm leading-relaxed text-fog">
        El pago de prueba confirma el mes al instante y no mueve dinero. Solo
        existe mientras la página está en modo de pruebas.
      </p>
      {error && <ErrorNote className="mt-5">{error}</ErrorNote>}
      <div className="mt-7 flex flex-wrap justify-end gap-3">
        <button
          type="button"
          className="btn btn-ghost"
          onClick={onClose}
          disabled={busy}
        >
          Cancelar
        </button>
        <button
          type="button"
          className="btn btn-solid"
          onClick={() => void pay()}
          disabled={busy}
        >
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
  state:
    | "pendiente"
    | "esperando"
    | "confirmada"
    | "fallida"
    | "por_reembolsar"
    | "cerrada";
  confirmations: number;
  needed: number;
}

type Phase =
  | "inicio"
  | "cotizando"
  | "listo"
  | "enviando"
  | "verificando"
  | "fin"
  | "error";

const STEPS = [
  "Cotización exacta",
  "Red BNB Chain",
  "Envío desde tu wallet",
  "Confirmaciones de la red",
  "Mes activado",
];

function countdown(ms: number) {
  const s = Math.max(0, Math.floor(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

function CryptoPay({
  request,
  asset,
  config,
  onClose,
  onBusy,
  onConfirmed,
}: PayProps & { asset: "USDT" | "BNB"; config: AppConfigDTO }) {
  const wallet = useWallet();
  const user = useUser();
  const [phase, setPhase] = useState<Phase>("inicio");
  const [quote, setQuote] = useState<Quote | null>(null);
  const now = usePlantNow(1000);
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
        const s = await api<CryptoState>(
          `/api/payments/crypto/${quote.orderId}`,
        );
        setStatus(s);
        if (s.state !== "esperando" && s.state !== "pendiente") {
          setPhase("fin");
          clearPending(quote.orderId);
          if (s.state === "confirmada") {
            refreshAfterPayment();
            onConfirmed?.(s.order);
          }
        }
      } catch {
        /* se reintenta en el siguiente ciclo */
      }
    }, 3000);
    return () => clearInterval(t);
  }, [phase, quote, onConfirmed]);

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
      const signature = await wallet.signMessage(
        buildPayerProofMessage({
          userId: user.id,
          payer: wallet.address,
          issuedAt,
        }),
      );
      const q = await api<Quote>("/api/payments/crypto/quote", {
        ...target(request),
        asset,
        payer: wallet.address,
        walletName: wallet.name ?? "Wallet",
        proof: { signature, issuedAt },
      });
      setQuote(q);
      setPhase("listo");
    } catch (e) {
      if (e instanceof ApiError && e.code === "perfil_incompleto")
        void refetch("/api/profile");
      setError((e as Error).message);
      setPhase("inicio");
    }
  };

  const afterHash = async (hash: string) => {
    if (!quote) return;
    savePending(quote.orderId, hash);
    setPhase("verificando");
    try {
      const s = await api<CryptoState>("/api/payments/crypto/submit", {
        orderId: quote.orderId,
        txHash: hash,
      });
      setStatus(s);
      if (s.state !== "esperando" && s.state !== "pendiente") {
        clearPending(quote.orderId);
        setPhase("fin");
        if (s.state === "confirmada") {
          refreshAfterPayment();
          onConfirmed?.(s.order);
        }
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
          ? {
              kind: "token",
              contract: quote.tokenContract,
              recipient: quote.to,
              amount: BigInt(quote.amountBaseUnits),
            }
          : {
              kind: "native",
              to: quote.to,
              value: BigInt(quote.amountBaseUnits),
            },
      );
      await afterHash(hash);
    } catch (e) {
      setError((e as Error).message);
      setPhase("listo");
    }
  };

  const expired = quote && now ? now > quote.expiresAt : false;
  const step =
    phase === "inicio" || phase === "cotizando"
      ? 0
      : phase === "listo" || phase === "enviando"
        ? 2
        : phase === "verificando"
          ? 3
          : status?.state === "confirmada"
            ? 5
            : 3;
  const explorer = quote?.explorer ?? config.crypto.explorer;
  const sentHash = status?.order.txHash ?? null;
  const done = phase === "fin" && status?.state === "confirmada";

  if (done)
    return (
      <Done onClose={onClose}>
        Pago confirmado en la red. La energía de tu plan ya está contando.
      </Done>
    );

  return (
    <div className="mt-6">
      {wallet.status === "connected" && (
        <p className="text-sm text-fog">
          Pagas desde {wallet.name},{" "}
          <span className="num">{shortAddress(wallet.address)}</span>.
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
            onClick={() =>
              void navigator.clipboard
                ?.writeText(quote.to)
                .then(() => toast("Dirección copiada"))
            }
            className="num mt-2 inline-flex max-w-full items-center gap-2 break-all text-left text-xs text-fog hover:text-ink"
            title="Copiar la dirección"
          >
            {quote.to}
            <Copy size={12} className="shrink-0" />
          </button>
          <p className="num mt-3 text-xs text-mute">
            1 {quote.asset} = {formatCop(quote.priceCop)}.{" "}
            {expired
              ? "La cotización venció."
              : now
                ? `Vence en ${countdown(quote.expiresAt - now)}.`
                : "Vigente por 20 minutos."}
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
            <li
              key={s}
              className="flex items-start gap-4 border-b border-line py-3"
            >
              <span
                className={`num flex h-6 w-6 shrink-0 items-center justify-center border text-xs ${isDone ? "border-ink bg-ink text-void" : active || current ? "border-ink text-ink" : "border-line-strong text-dim"}`}
              >
                {isDone ? (
                  <Check size={13} strokeWidth={2.4} />
                ) : active ? (
                  <Loader2 size={13} className="animate-spin" />
                ) : (
                  i + 1
                )}
              </span>
              <div>
                <div
                  className={
                    isDone || active || current ? "text-ink" : "text-mute"
                  }
                >
                  {s}
                </div>
                {detail && (
                  <div className="num mt-0.5 text-sm text-mute">{detail}</div>
                )}
              </div>
            </li>
          );
        })}
      </ol>

      {sentHash && (
        <a
          href={`${explorer}/tx/${sentHash}`}
          target="_blank"
          rel="noreferrer"
          className="link mt-4 inline-flex items-center gap-2 text-sm"
        >
          Ver la transacción en BscScan <ExternalLink size={13} />
        </a>
      )}

      {phase === "fin" && status && status.state !== "confirmada" && (
        <ErrorNote className="mt-5">
          {status.order.note ??
            (status.state === "por_reembolsar"
              ? "Recibimos el pago, pero no pudimos activar el mes: te lo devolveremos."
              : "El pago no se pudo verificar.")}
        </ErrorNote>
      )}
      {phase === "verificando" && (
        <p className="mt-4 text-sm text-mute">
          Puedes cerrar esta ventana: cuando el pago se confirme, tu plan
          aparecerá en el panel.
        </p>
      )}
      {error && <ErrorNote className="mt-5">{error}</ErrorNote>}

      {phase === "listo" && quote && !expired && (
        <div className="mt-5">
          <button
            type="button"
            className="link text-sm text-fog"
            onClick={() => setShowManual(!showManual)}
          >
            ¿Ya enviaste el pago desde tu wallet? Pega el hash
          </button>
          {showManual && (
            <div className="mt-3 flex items-end gap-3">
              <input
                value={manualHash}
                onChange={(e) => setManualHash(e.target.value.trim())}
                placeholder="0x…"
                aria-label="Hash de la transacción"
                className="field num text-sm"
              />
              <button
                type="button"
                className="btn btn-ghost"
                disabled={!/^0x[0-9a-fA-F]{64}$/.test(manualHash)}
                onClick={() => void afterHash(manualHash)}
              >
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
          <button
            type="button"
            className="btn btn-solid"
            onClick={() => void start()}
          >
            {wallet.status === "connected"
              ? "Cotizar el pago"
              : "Conectar wallet"}
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
            <button
              type="button"
              className="btn btn-solid"
              onClick={() => void start()}
            >
              Cotizar de nuevo
            </button>
          ) : (
            <button
              type="button"
              className="btn btn-solid"
              onClick={() => void send()}
              disabled={phase === "enviando"}
            >
              {phase === "enviando" ? (
                <>
                  <Loader2 size={15} className="animate-spin" /> Esperando tu
                  wallet…
                </>
              ) : (
                <span>
                  Enviar {quote.amount}{" "}
                  <span className="unit">{quote.asset}</span>
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
