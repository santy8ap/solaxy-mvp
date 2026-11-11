"use client";
import { Loader2 } from "lucide-react";
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
      toast((e as Error).message, "error");
      setPhase("form");
    }
  };

  const close = () => {
    if (phase === "signing" || phase === "sending") return;
    setPhase("form");
    setHash(null);
    setPendingId(null);
    setRejection(null);
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
  const { config } = useAppConfig();
  const demo = config?.demoMode ?? false;
  const {
    data: p,
    error,
    reload,
  } = useJson<PortfolioDTO>("/api/portfolio", { refreshMs: 30_000 });
  const wallet = useWallet();
  const [withdrawOpen, setWithdrawOpen] = useState(false);
  const liveBalance = p?.balanceCop ?? 0;

  return (
    <>
      <Topbar
        title="Billetera"
        subtitle="Tu wallet conectada, tu saldo en In World Energy y todos tus movimientos."
      />
      {error && (
        <DataError
          message={error}
          stale={Boolean(p)}
          onRetry={() => void reload()}
        />
      )}
      <div className="grid gap-5 lg:grid-cols-2">
        <section
          className="panel cells p-6 sm:p-8"
          aria-labelledby="balance-title"
        >
          <h2 id="balance-title" className="text-sm text-silver-400">
            Saldo disponible en In World Energy
          </h2>
          <div className="mt-3 text-[clamp(1.6rem,6.4vw,3.2rem)]">
            {p ? (
              <Odometer
                value={liveBalance}
                decimals={2}
                prefix={"$ "}
                className="display text-silver-50"
              />
            ) : (
              <span aria-label="Cargando saldo">$ —</span>
            )}
          </div>
          <p className="mt-3 text-sm text-silver-400">
            Ganancias {p ? formatCop(p.earnedCop) : "—"} + ventas{" "}
            {p ? formatCop(p.saleProceedsCop) : "—"} − retiros{" "}
            {p ? formatCop(p.withdrawnCop) : "—"}
            {p && p.reservedCop > 0
              ? ` − en aprobación ${formatCop(p.reservedCop)}`
              : ""}
          </p>
          <button
            type="button"
            className="btn btn-sun mt-7"
            disabled={!p || Boolean(error) || p.balanceCop < 20000}
            onClick={() =>
              wallet.status === "connected"
                ? setWithdrawOpen(true)
                : wallet.openConnect()
            }
          >
            {wallet.status === "connected"
              ? "Retirar a mi wallet"
              : "Conectar wallet para retirar"}
          </button>
        </section>

        <section className="panel p-6 sm:p-8" aria-labelledby="w-title">
          <h2 id="w-title" className="text-sm text-silver-400">
            Wallet conectada
          </h2>
          {wallet.status === "connected" ? (
            <div className="mt-4">
              <div className="text-xl font-semibold text-silver-50">
                {wallet.name}
              </div>
              <dl className="mt-4 space-y-2.5 text-sm">
                <div className="flex justify-between gap-4">
                  <dt className="text-silver-400">Dirección</dt>
                  <dd className="num break-all text-right text-silver-100">
                    {wallet.address}
                  </dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-silver-400">Red</dt>
                  <dd className="text-silver-100">
                    {chainName(wallet.chainId)}
                  </dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-silver-400">Saldo en la wallet</dt>
                  <dd className="num text-silver-100">
                    {wallet.balance ?? "no disponible"}
                  </dd>
                </div>
              </dl>
              <button
                type="button"
                className="btn btn-ghost mt-6 !py-2.5 text-sm"
                onClick={() => void wallet.disconnect()}
              >
                Desconectar
              </button>
            </div>
          ) : (
            <div className="mt-4">
              <p className="text-silver-300">
                {demo
                  ? "Conecta Trust Wallet, MetaMask o la wallet de demostración para comprar y retirar."
                  : "Conecta Trust Wallet o MetaMask para pagar con cripto y recibir tus retiros."}
              </p>
              <button
                type="button"
                className="btn btn-sun mt-6"
                onClick={wallet.openConnect}
              >
                Conectar wallet
              </button>
            </div>
          )}
        </section>
      </div>

      <section className="panel mt-5 p-5 sm:p-7" aria-labelledby="hist-title">
        <h2 id="hist-title" className="text-lg font-semibold text-silver-50">
          Historial
        </h2>
        {p ? (
          <Transactions transactions={p.transactions} />
        ) : (
          <DataSkeleton label="Cargando movimientos" />
        )}
      </section>

      <WithdrawDialog
        open={withdrawOpen}
        onClose={() => setWithdrawOpen(false)}
        max={liveBalance}
      />
    </>
  );
}
