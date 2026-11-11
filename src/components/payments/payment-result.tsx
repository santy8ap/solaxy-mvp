"use client";
import { AlertTriangle, Check, RotateCcw, X } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import type { TxDTO } from "@/lib/portfolio";
import { refetch } from "@/lib/client/use-json";
import { formatCop, formatNumber } from "@/lib/format";

type Outcome = "aprobada" | "fallida" | "pendiente" | "devuelta" | "sin_pago";

type View =
  | { kind: "cargando" }
  | { kind: "orden"; order: TxDTO; outcome: Outcome; gaveUp?: boolean }
  | { kind: "no_encontrado"; message: string }
  | { kind: "error"; message: string };

/** Cada cuánto se vuelve a consultar un pago en proceso (PSE puede tardar). */
const pollDelay = (attempt: number) => (attempt < 24 ? 5_000 : 15_000);
/**
 * Si Mercado Pago no tiene ningún pago para la orden, se reintenta unas veces (puede tardar en registrarlo) y luego se
 * avisa. Sin número de pago en la URL de retorno, lo normal es que la persona volvió sin pagar: se avisa antes.
 */
const noPaymentAttempts = (paymentId: string | undefined) => (paymentId ? 6 : 2);

async function fetchStatus(ref: string, paymentId: string | undefined): Promise<View> {
  try {
    const res = await fetch("/api/payments/mercadopago/sync", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ ref, paymentId }),
    });
    const json = (await res.json().catch(() => ({}))) as { order?: TxDTO; outcome?: Outcome; error?: string };
    if (res.status === 404) return { kind: "no_encontrado", message: json.error ?? "No encontramos ese pago en tu cuenta." };
    if (!res.ok || !json.order) return { kind: "error", message: json.error ?? "No pudimos consultar el pago." };
    return { kind: "orden", order: json.order, outcome: json.outcome ?? "pendiente" };
  } catch {
    return { kind: "error", message: "No pudimos conectarnos. Revisa tu internet." };
  }
}

const inProgress = (v: View) => v.kind === "orden" && (v.order.status === "pendiente" || v.order.status === "verificando");

export function PaymentResult({ orderRef, paymentId }: { orderRef: string; paymentId?: string }) {
  const [view, setView] = useState<View>(orderRef ? { kind: "cargando" } : { kind: "no_encontrado", message: "Falta la referencia de la orden." });
  const [round, setRound] = useState(0);

  useEffect(() => {
    if (!orderRef) return;
    let cancelled = false;
    let attempt = 0;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const run = async () => {
      const next = await fetchStatus(orderRef, paymentId);
      if (cancelled) return;
      if (next.kind === "orden" && next.outcome === "sin_pago" && attempt >= noPaymentAttempts(paymentId)) {
        setView({ ...next, gaveUp: true });
        return;
      }
      setView(next);
      if (next.kind === "orden" && next.order.status === "confirmada") {
        void refetch("/api/portfolio");
        void refetch("/api/plans");
      }
      if (inProgress(next)) timer = setTimeout(run, pollDelay(attempt++));
    };
    timer = setTimeout(run, 0);
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [orderRef, paymentId, round]);

  return (
    <section className="w-full" aria-live="polite">
      <Body
        view={view}
        onRetry={() => {
          setView({ kind: "cargando" });
          setRound((r) => r + 1);
        }}
      />
    </section>
  );
}

/** El símbolo del resultado: un anillo (el eclipse de la marca) con lo que pasó adentro. */
function Mark({ tone, children }: { tone: "ok" | "wait" | "bad"; children?: React.ReactNode }) {
  return (
    <span
      className={`flex h-16 w-16 items-center justify-center rounded-full ${tone === "ok" ? "bg-ink text-void" : tone === "wait" ? "border border-dashed border-fog motion-safe:animate-[spin_9s_linear_infinite]" : "border border-ink"}`}
      aria-hidden="true"
    >
      {children}
    </span>
  );
}

function Body({ view, onRetry }: { view: View; onRetry(): void }) {
  // Mientras se espera a que Mercado Pago registre el pago, todavía no sabemos si hubo pago: se sigue mostrando "confirmando".
  const waitingForPayment = view.kind === "orden" && view.outcome === "sin_pago" && !view.gaveUp && view.order.status === "pendiente";
  if (view.kind === "cargando" || waitingForPayment) {
    return (
      <>
        <Mark tone="wait" />
        <h1 className="display mt-8 text-[clamp(2.75rem,8vw,4.5rem)]">Confirmando tu pago</h1>
        <p className="mt-5 max-w-[46ch] leading-relaxed text-fog">Estamos consultando el resultado con Mercado Pago.</p>
      </>
    );
  }
  if (view.kind === "no_encontrado" || view.kind === "error") {
    return (
      <>
        <Mark tone="bad">
          <AlertTriangle size={26} strokeWidth={1.5} />
        </Mark>
        <h1 className="display mt-8 text-[clamp(2.75rem,8vw,4.5rem)]">{view.kind === "error" ? "No pudimos consultar el pago" : "Pago no encontrado"}</h1>
        <p className="mt-5 max-w-[46ch] leading-relaxed text-fog">{view.message}</p>
        <div className="mt-9 flex flex-wrap gap-3">
          {view.kind === "error" && (
            <button type="button" onClick={onRetry} className="btn btn-solid">
              <RotateCcw size={15} /> Volver a consultar
            </button>
          )}
          <Link href="/panel/billetera" className="btn btn-ghost">
            Ver mis movimientos
          </Link>
        </div>
      </>
    );
  }

  const o = view.order;
  const ref = (
    <p className="num mt-10 border-t border-line pt-4 text-xs text-mute">
      Referencia {o.id}, {formatCop(o.amountCop)}
    </p>
  );

  if (o.status === "confirmada") {
    return (
      <>
        <Mark tone="ok">
          <Check size={30} strokeWidth={2} />
        </Mark>
        <h1 className="display mt-8 text-[clamp(2.75rem,8vw,4.5rem)]">Pago confirmado</h1>
        <p className="mt-5 max-w-[46ch] leading-relaxed text-fog">
          {o.periodIndex ? `El mes ${o.periodIndex} de tu plan ya está activo` : "Tu plan ya está activo"}
          {o.kwh ? `: ${formatNumber(o.kwh)} kWh en los próximos 30 días.` : "."} Tu energía cuenta desde este momento.
        </p>
        <Link href="/panel" className="btn btn-solid mt-9">
          Ver mi energía
        </Link>
        {ref}
      </>
    );
  }
  if (o.status === "pendiente" && view.outcome === "sin_pago" && view.gaveUp) {
    return (
      <>
        <Mark tone="bad">
          <X size={28} strokeWidth={1.5} />
        </Mark>
        <h1 className="display mt-8 text-[clamp(2.75rem,8vw,4.5rem)]">No completaste el pago</h1>
        <p className="mt-5 max-w-[46ch] leading-relaxed text-fog">Mercado Pago no tiene un pago para esta orden. No se hizo ningún cobro; puedes intentarlo de nuevo cuando quieras.</p>
        <div className="mt-9 flex flex-wrap gap-3">
          <Link href="/panel/planes" className="btn btn-solid">
            Volver a los planes
          </Link>
          <button type="button" onClick={onRetry} className="btn btn-ghost">
            <RotateCcw size={15} /> Ya pagué, volver a consultar
          </button>
        </div>
        {ref}
      </>
    );
  }
  if (o.status === "pendiente" || o.status === "verificando") {
    return (
      <>
        <Mark tone="wait" />
        <h1 className="display mt-8 text-[clamp(2.75rem,8vw,4.5rem)]">Tu pago está en proceso</h1>
        <p className="mt-5 max-w-[46ch] leading-relaxed text-fog">
          Algunos pagos, como PSE, tardan unos minutos. Esta página se actualiza sola; también puedes cerrarla: tu plan aparecerá en el panel apenas se confirme.
        </p>
        {ref}
      </>
    );
  }
  if (o.status === "por_reembolsar" || o.status === "reembolsada") {
    return (
      <>
        <Mark tone="bad">
          <AlertTriangle size={26} strokeWidth={1.5} />
        </Mark>
        <h1 className="display mt-8 text-[clamp(2.5rem,7vw,4rem)]">Recibimos tu pago, pero no pudimos activar el mes</h1>
        <p className="mt-5 max-w-[46ch] leading-relaxed text-fog">{o.note ?? "Te contactaremos para devolverte el dinero."}</p>
        <p className="mt-3 max-w-[46ch] text-sm leading-relaxed text-mute">
          {o.status === "reembolsada" ? "El reembolso ya fue registrado." : "Nuestro equipo ya lo ve en su panel y te devolverá el dinero por el mismo medio."}
        </p>
        {ref}
      </>
    );
  }
  return (
    <>
      <Mark tone="bad">
        <X size={28} strokeWidth={1.5} />
      </Mark>
      <h1 className="display mt-8 text-[clamp(2.75rem,8vw,4.5rem)]">El pago no se aprobó</h1>
      <p className="mt-5 max-w-[46ch] leading-relaxed text-fog">{o.note ?? "Mercado Pago no aprobó el pago. No se hizo ningún cobro."}</p>
      <Link href="/panel/planes" className="btn btn-solid mt-9">
        Intentar de nuevo
      </Link>
      {ref}
    </>
  );
}
