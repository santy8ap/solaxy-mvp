"use client";
import { ArrowUpRight, Check, Copy, Loader2, Wallet } from "lucide-react";
import { useEffect, useState } from "react";
import type { PortfolioDTO } from "@/lib/portfolio";
import { useAppConfig } from "@/lib/client/use-app-config";
import { postJson, refetch, useJson } from "@/lib/client/use-json";
import { formatCop, shortAddress } from "@/lib/format";
import { useWallet } from "@/lib/wallet/context";
import { chainName } from "@/lib/wallet/types";
import { Odometer } from "@/components/ui/odometer";
import { toast } from "@/components/ui/toast";
import { Modal } from "@/components/wallet/connect-dialog";
import { Topbar } from "./shell";
import { Transactions } from "./transactions";
import { DataError, DataSkeleton } from "@/components/ui/data-state";

function WithdrawDialog({
  open,
  onClose,
  max,
}: {
  open: boolean;
  onClose(): void;
  max: number;
}) {
  const wallet = useWallet();
  const { config } = useAppConfig();
  const demo = config?.demoMode ?? false;
  const [amount, setAmount] = useState(100_000);
  const [phase, setPhase] = useState<
    "form" | "review" | "signing" | "sending" | "waiting" | "done" | "rejected"
  >("form");
  const [hash, setHash] = useState<string | null>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [rejection, setRejection] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Mientras el administrador decide, se consulta el estado cada 2,5 s.
  useEffect(() => {
    if (phase !== "waiting" || !pendingId) return;
    const id = setInterval(async () => {
      try {
        const res = await fetch(`/api/withdrawals/${pendingId}`, {
          cache: "no-store",
        });
        const tx = (await res.json()) as {
          status: string;
          txHash: string | null;
          note: string | null;
        };
        if (tx.status === "confirmada") {
          setHash(tx.txHash);
          setPhase("done");
          void refetch("/api/portfolio");
        } else if (tx.status === "rechazada") {
          setRejection(tx.note);
          setPhase("rejected");
          void refetch("/api/portfolio");
        }
      } catch {
        /* se reintenta en el siguiente ciclo */
      }
    }, 2500);
    return () => clearInterval(id);
  }, [phase, pendingId]);

  const submit = async () => {
    if (
      !wallet.address ||
      !Number.isFinite(amount) ||
      amount < 20000 ||
      amount > max
    )
      return;
    try {
      setSubmitError(null);
      setPhase("signing");
      const w = await postJson<{ withdrawalId: string; message: string }>(
        "/api/withdrawals",
        {
          amountCop: amount,
          walletAddress: wallet.address,
          walletName: wallet.name ?? "Wallet",
          chainId: wallet.chainId,
        },
      );
      const signature = await wallet.signMessage(w.message);
      setPhase("sending");
      const res = await postJson<{ txHash: string | null; status: string }>(
        `/api/withdrawals/${w.withdrawalId}/confirm`,
        { signature },
      );
      void refetch("/api/portfolio");
      if (res.status === "por_aprobar") {
        setPendingId(w.withdrawalId);
        setPhase("waiting");
        return;
      }
      setHash(res.txHash);
      setPhase("done");
    } catch (e) {
      setSubmitError((e as Error).message || "No se pudo enviar la solicitud. Inténtalo de nuevo.");
      setPhase("form");
    }
  };

  const close = () => {
    if (phase === "signing" || phase === "sending") return;
    setPhase("form");
    setHash(null);
    setPendingId(null);
    setRejection(null);
    setSubmitError(null);
    onClose();
  };

  return (
    <Modal
      open={open}
      onClose={close}
      title={
        phase === "done"
          ? "Retiro enviado"
          : phase === "waiting"
            ? "Esperando aprobación"
            : phase === "rejected"
              ? "Retiro rechazado"
              : "Retirar a tu wallet"
      }
    >
      {phase === "waiting" ? (
        <div>
          <div className="flex items-center gap-3 rounded-none border border-dusk-400/40 bg-dusk-400/10 p-4">
            <Loader2
              size={20}
              className="shrink-0 animate-spin text-dusk-300"
            />
            <p className="text-sm text-silver-200">
              Tu firma quedó verificada. El administrador está revisando el
              retiro de{" "}
              <span className="num font-semibold">{formatCop(amount)}</span>.
              Esta ventana se actualiza sola.
            </p>
          </div>
          <p className="mt-4 text-xs text-silver-500">
            Mientras tanto, ese monto queda apartado de tu saldo. Puedes cerrar
            esta ventana: el estado también aparece en tu historial.
          </p>
          <button
            type="button"
            className="btn btn-ghost mt-6 w-full"
            onClick={close}
          >
            Cerrar
          </button>
        </div>
      ) : phase === "rejected" ? (
        <div>
          <p className="text-silver-300">
            El administrador rechazó el retiro. El saldo volvió a estar
            disponible.
          </p>
          <p className="mt-3 rounded-none border border-silicon-600/60 bg-silicon-950/40 p-3 text-sm text-silver-200">
            Motivo: {rejection ?? "sin motivo"}
          </p>
          <button
            type="button"
            className="btn btn-sun mt-6 w-full"
            onClick={close}
          >
            Entendido
          </button>
        </div>
      ) : phase === "done" ? (
        <div>
          <p className="text-silver-300">
            Enviamos{" "}
            <span className="num font-semibold text-leaf-300">
              {formatCop(amount)}
            </span>{" "}
            en USDT a {wallet.name} ({shortAddress(wallet.address)}).
          </p>
          {hash && (
            <p className="num mt-3 break-all text-sm text-silver-400">
              Referencia{" "}
              {hash.length > 24
                ? `${hash.slice(0, 12)}…${hash.slice(-6)}`
                : hash}
              {demo ? " (simulada)" : ""}
            </p>
          )}
          <button
            type="button"
            className="btn btn-sun mt-6 w-full"
            onClick={close}
          >
            Listo
          </button>
        </div>
      ) : phase === "review" ? (
        <div>
          <p className="section-note">
            Revisa el monto y el destino antes de firmar.
          </p>
          <dl className="detail-list">
            <div>
              <dt>Monto</dt>
              <dd>{formatCop(amount)} COP</dd>
            </div>
            <div>
              <dt>Wallet</dt>
              <dd>{wallet.name}</dd>
            </div>
            <div>
              <dt>Dirección</dt>
              <dd>{wallet.address}</dd>
            </div>
            <div>
              <dt>Red</dt>
              <dd>{chainName(wallet.chainId)}</dd>
            </div>
          </dl>
          <p className="table-note">
            {demo
              ? "Operación de prueba: no se mueve dinero real."
              : "Al firmar, enviarás la solicitud de retiro para su revisión."}
          </p>
          <div className="dialog-actions">
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => setPhase("form")}
            >
              Editar monto
            </button>
            <button
              type="button"
              className="btn btn-sun"
              disabled={
                !Number.isFinite(amount) || amount < 20000 || amount > max
              }
              onClick={() => void submit()}
            >
              Firmar solicitud
            </button>
          </div>
        </div>
      ) : (
        <div>
          {submitError && <p role="alert" className="checkout-notice mb-5">{submitError}</p>}
          <label htmlFor="wd-amount" className="text-sm text-silver-400">
            Monto en pesos (disponible {formatCop(max)})
          </label>
          <input
            id="wd-amount"
            type="number"
            min={20000}
            step={10000}
            max={Math.floor(max)}
            value={amount}
            onChange={(e) => setAmount(Number(e.target.value))}
            className="field mt-2"
            disabled={phase !== "form"}
          />
          <div className="mt-2 flex gap-2">
            {[0.25, 0.5, 1].map((f) => (
              <button
                key={f}
                type="button"
                className="rounded-full border border-silicon-600 px-3 py-1 text-xs text-silver-300 hover:text-silver-50"
                onClick={() => setAmount(Math.floor(max * f))}
                disabled={phase !== "form"}
              >
                {f === 1 ? "Todo" : `${f * 100} %`}
              </button>
            ))}
          </div>
          <p className="mt-5 text-sm text-silver-400">
            Destino:{" "}
            <span className="num text-silver-100">
              {wallet.name}, {shortAddress(wallet.address)}
            </span>
          </p>
          <button
            type="button"
            className="btn btn-sun mt-6 w-full"
            disabled={
              phase !== "form" ||
              !Number.isFinite(amount) ||
              amount < 20000 ||
              amount > max
            }
            onClick={() => setPhase("review")}
          >
            {phase === "signing" ? (
              <>
                <Loader2 size={16} className="animate-spin" /> Firma en tu
                wallet…
              </>
            ) : phase === "sending" ? (
              <>
                <Loader2 size={16} className="animate-spin" /> Enviando…
              </>
            ) : (
              "Revisar retiro"
            )}
          </button>
          <p className="mt-3 text-center text-xs text-silver-500">
            {demo
              ? "La firma autoriza el retiro. En modo demo no se mueve dinero."
              : "La firma prueba que la wallet es tuya. El equipo de In World Energy revisa la solicitud y te envía el dinero."}
          </p>
        </div>
      )}
    </Modal>
  );
}

export function WalletPage() {
  const {
    data: p,
    error,
    reload,
  } = useJson<PortfolioDTO>("/api/portfolio", { refreshMs: 30_000 });
  const wallet = useWallet();
  const [withdrawOpen, setWithdrawOpen] = useState(false);
  const liveBalance = p?.balanceCop ?? 0;
  const connected = wallet.status === "connected";
  return (
    <div className="panel-view">
      <Topbar
        title="Tu billetera, en orden."
        subtitle="Saldo, solicitudes y movimientos en un solo lugar."
      />
      {error && (
        <DataError
          message={error}
          stale={Boolean(p)}
          onRetry={() => void reload()}
        />
      )}
      <div className="wallet-layout">
        <section
          className="wallet-balance-card"
          aria-labelledby="wallet-balance-title"
        >
          <span className="eyebrow">IN WORLD ENERGY / DISPONIBLE</span>
          <h2 id="wallet-balance-title">TU SALDO.</h2>
          <div className="balance-number">
            {p ? (
              <Odometer
                value={liveBalance}
                decimals={2}
                prefix="$ "
                className="mono"
              />
            ) : (
              <span>$ —</span>
            )}
          </div>
          <p className="wallet-currency">PESOS COLOMBIANOS · COP</p>
          <div className="wallet-balance-breakdown">
            <div>
              <span>Ingresos estimados</span>
              <strong>{p ? formatCop(p.earnedCop) : "—"}</strong>
            </div>
            <div>
              <span>Ventas registradas</span>
              <strong>{p ? formatCop(p.saleProceedsCop) : "—"}</strong>
            </div>
            <div>
              <span>Reservado para revisión</span>
              <strong>{p ? formatCop(p.reservedCop) : "—"}</strong>
            </div>
          </div>
          <button
            type="button"
            className="btn btn-sun"
            disabled={!p || Boolean(error) || p.balanceCop < 20000}
            onClick={() =>
              connected ? setWithdrawOpen(true) : wallet.openConnect()
            }
          >
            {connected ? "Solicitar un retiro" : "Conectar wallet para retirar"}
            <ArrowUpRight size={16} />
          </button>
          <p className="section-note">
            Solicitud mínima: $ 20.000 COP. Cada retiro requiere tu firma y la
            revisión de la plataforma.
          </p>
        </section>
        <section
          className="wallet-connection-card"
          aria-labelledby="wallet-connection-title"
        >
          <div className="account-section-heading">
            <div>
              <span className="eyebrow">TU CONEXIÓN</span>
              <h2 id="wallet-connection-title">
                {connected ? wallet.name : "Conecta tu wallet."}
              </h2>
            </div>
            <Wallet size={24} />
          </div>
          {connected ? (
            <>
              <span className="payment-status">
                <Check size={13} /> Wallet conectada
              </span>
              <dl className="detail-list">
                <div>
                  <dt>Dirección</dt>
                  <dd>{wallet.address}</dd>
                </div>
                <div>
                  <dt>Red</dt>
                  <dd>{chainName(wallet.chainId)}</dd>
                </div>
                <div>
                  <dt>Saldo externo</dt>
                  <dd>{wallet.balance ?? "No disponible"}</dd>
                </div>
              </dl>
              <div className="wallet-connection-actions">
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={async () => {
                    try {
                      await navigator.clipboard.writeText(wallet.address ?? "");
                      toast("Dirección copiada.");
                    } catch {
                      toast("No se pudo copiar la dirección.", "error");
                    }
                  }}
                >
                  <Copy size={14} /> Copiar dirección
                </button>
                <button
                  type="button"
                  className="text-link"
                  onClick={() => void wallet.disconnect()}
                >
                  Desconectar <ArrowUpRight size={14} />
                </button>
              </div>
            </>
          ) : (
            <div className="wallet-connect-empty">
              <div className="wallet-orbit" aria-hidden="true">
                <Wallet size={35} />
              </div>
              <h3>Elige cómo conectarte.</h3>
              <p>
                Conecta una wallet compatible para consultar su dirección y
                gestionar tus solicitudes de retiro.
              </p>
              <button
                type="button"
                className="btn btn-ghost"
                onClick={wallet.openConnect}
                disabled={wallet.status === "connecting"}
              >
                {wallet.status === "connecting"
                  ? "Conectando…"
                  : "Conectar wallet"}
                <ArrowUpRight size={16} />
              </button>
            </div>
          )}
        </section>
      </div>
      <section
        className="account-section wallet-history"
        aria-labelledby="wallet-history-title"
      >
        <div className="account-section-heading">
          <div>
            <span className="eyebrow">EL REGISTRO DE TU CUENTA</span>
            <h2 id="wallet-history-title">Cada operación tiene su historia.</h2>
          </div>
        </div>
        {p ? (
          <Transactions transactions={p.transactions} />
        ) : (
          !error && <DataSkeleton label="Cargando movimientos" />
        )}
      </section>
      <WithdrawDialog
        open={withdrawOpen}
        onClose={() => setWithdrawOpen(false)}
        max={liveBalance}
      />
    </div>
  );
}
