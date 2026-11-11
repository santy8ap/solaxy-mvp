"use client";
import { AlertTriangle, Check, Clock, RotateCcw, X } from "lucide-react";
import { motion, useReducedMotion } from "motion/react";
import Link from "next/link";
import { useEffect, useState } from "react";
import type { TxDTO } from "@/lib/portfolio";
import { formatCop, formatKw } from "@/lib/format";

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
      if (inProgress(next)) timer = setTimeout(run, pollDelay(attempt++));
    };
    timer = setTimeout(run, 0);
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [orderRef, paymentId, round]);

  return (
    <section className="panel cells w-full p-8 text-center sm:p-10" aria-live="polite">
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

function Badge({ tone, children }: { tone: "ok" | "wait" | "bad" | "warn"; children: React.ReactNode }) {
  const reduce = useReducedMotion();
  const colors = {
    ok: "bg-leaf-400/15 text-leaf-300 shadow-[0_0_60px_rgb(198_198_198/0.25)]",
    wait: "bg-sun-400/15 text-sun-300",
    bad: "bg-alert-400/15 text-alert-400",
    warn: "bg-sun-400/15 text-sun-300",
  }[tone];
  return (
    <motion.span
      initial={reduce ? false : { scale: 0.6, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ type: "spring", stiffness: 260, damping: 18 }}
      className={`mx-auto flex h-16 w-16 items-center justify-center rounded-full ${colors}`}
    >
      {children}
    </motion.span>
  );
}

function Body({ view, onRetry }: { view: View; onRetry(): void }) {
  // Mientras se espera a que Mercado Pago registre el pago, todavía no sabemos si hubo pago: se sigue mostrando "confirmando".
  const waitingForPayment = view.kind === "orden" && view.outcome === "sin_pago" && !view.gaveUp && view.order.status === "pendiente";
  if (view.kind === "cargando" || waitingForPayment) {
    return (
      <>
        <Badge tone="wait">
          <Clock size={28} className="animate-pulse" />
        </Badge>
        <h1 className="mt-6 text-2xl font-semibold text-silver-50">Confirmando tu pago…</h1>
        <p className="mt-2 text-silver-400">Estamos consultando el resultado con Mercado Pago.</p>
      </>
    );
  }
  if (view.kind === "no_encontrado" || view.kind === "error") {
    return (
      <>
        <Badge tone="warn">
          <AlertTriangle size={28} />
        </Badge>
        <h1 className="mt-6 text-2xl font-semibold text-silver-50">{view.kind === "error" ? "No pudimos consultar el pago" : "Pago no encontrado"}</h1>
        <p className="mt-2 text-silver-400">{view.message}</p>
        <div className="mt-8 flex flex-wrap justify-center gap-2">
          {view.kind === "error" && (
            <button type="button" onClick={onRetry} className="btn btn-sun">
              <RotateCcw size={16} /> Volver a consultar
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
  const kw = formatKw(o.kw ?? 0, 1);
  const ref = (
    <p className="num mt-6 text-xs text-silver-500">
      Referencia {o.id} · {formatCop(o.amountCop)}
    </p>
  );

  if (o.status === "confirmada") {
    return (
      <>
        <Badge tone="ok">
          <Check size={30} strokeWidth={2.6} />
        </Badge>
        <h1 className="display mt-6 text-[2rem] text-silver-50">¡Listo! {kw} son tuyos</h1>
        <p className="mt-2 text-silver-300">Tu pago fue aprobado y tus kW ya están generando desde este momento.</p>
        <Link href="/panel" className="btn btn-sun mt-8">
          Ver mi energía en vivo
        </Link>
        {ref}
      </>
    );
  }
  if (o.status === "pendiente" && view.outcome === "sin_pago" && view.gaveUp) {
    return (
      <>
        <Badge tone="warn">
          <AlertTriangle size={28} />
        </Badge>
        <h1 className="mt-6 text-2xl font-semibold text-silver-50">No completaste el pago</h1>
        <p className="mt-2 text-silver-400">Mercado Pago no tiene un pago para esta orden. No se hizo ningún cobro; puedes intentarlo de nuevo cuando quieras.</p>
        <div className="mt-8 flex flex-wrap justify-center gap-2">
          <Link href="/panel/mercado" className="btn btn-sun">
            Volver a comprar
          </Link>
          <button type="button" onClick={onRetry} className="btn btn-ghost">
            <RotateCcw size={16} /> Ya pagué, volver a consultar
          </button>
        </div>
        {ref}
      </>
    );
  }
  if (o.status === "pendiente" || o.status === "verificando") {
    return (
      <>
        <Badge tone="wait">
          <Clock size={28} className="animate-pulse" />
        </Badge>
        <h1 className="mt-6 text-2xl font-semibold text-silver-50">Tu pago está en proceso</h1>
        <p className="mt-2 text-silver-400">
          Algunos pagos, como PSE, tardan unos minutos. Esta página se actualiza sola; también puedes cerrarla: tus kW aparecerán en tu panel
          apenas se confirme.
        </p>
        {ref}
      </>
    );
  }
  if (o.status === "por_reembolsar" || o.status === "reembolsada") {
    return (
      <>
        <Badge tone="warn">
          <AlertTriangle size={28} />
        </Badge>
        <h1 className="mt-6 text-2xl font-semibold text-silver-50">Recibimos tu pago, pero no pudimos asignar los kW</h1>
        <p className="mt-2 text-silver-400">{o.note ?? "Te contactaremos para devolverte el dinero."}</p>
        <p className="mt-2 text-sm text-silver-500">
          {o.status === "reembolsada" ? "El reembolso ya fue registrado." : "Nuestro equipo ya lo ve en su panel y te devolverá el dinero por el mismo medio."}
        </p>
        {ref}
      </>
    );
  }
  return (
    <>
      <Badge tone="bad">
        <X size={30} />
      </Badge>
      <h1 className="mt-6 text-2xl font-semibold text-silver-50">El pago no se aprobó</h1>
      <p className="mt-2 text-silver-400">{o.note ?? "Mercado Pago no aprobó el pago. No se hizo ningún cobro."}</p>
      <Link href="/panel/mercado" className="btn btn-sun mt-8">
        Intentar de nuevo
      </Link>
      {ref}
    </>
  );
}
