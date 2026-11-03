"use client";
import { Check, Copy, Loader2 } from "lucide-react";
import { useState } from "react";
import type { PortfolioDTO } from "@/lib/portfolio";
import { postJson, refetch, useJson } from "@/lib/client/use-json";
import { formatCop, formatDateTime, formatNumber, shortAddress } from "@/lib/format";
import { useWallet } from "@/lib/wallet/context";
import { chainName } from "@/lib/wallet/types";
import { Odometer } from "@/components/ui/odometer";
import { toast } from "@/components/ui/toast";
import { Modal } from "@/components/wallet/connect-dialog";
import { Topbar } from "./shell";
import { STATUS_LABEL, txAmount, txDetail, txTitle } from "./tx-meta";
import { useLiveEarnings } from "./use-live-earnings";

function CopyHash({ hash }: { hash: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      className="num inline-flex items-center gap-1.5 text-xs text-silver-400 hover:text-silver-100"
      onClick={() => void navigator.clipboard?.writeText(hash).then(() => setCopied(true))}
      title="Copiar hash (simulado)"
    >
      {hash.length > 18 ? `${hash.slice(0, 10)}…${hash.slice(-6)}` : hash}
      {copied ? <Check size={12} /> : <Copy size={12} />}
    </button>
  );
}

function WithdrawDialog({ open, onClose, max }: { open: boolean; onClose(): void; max: number }) {
  const wallet = useWallet();
  const [amount, setAmount] = useState(100_000);
  const [phase, setPhase] = useState<"form" | "signing" | "sending" | "done">("form");
  const [hash, setHash] = useState<string | null>(null);

  const submit = async () => {
    if (!wallet.address) return;
    try {
      setPhase("signing");
      const w = await postJson<{ withdrawalId: string; message: string }>("/api/withdrawals", {
        amountCop: amount,
        walletAddress: wallet.address,
        walletName: wallet.name ?? "Wallet",
        chainId: wallet.chainId,
      });
      const signature = await wallet.signMessage(w.message);
      setPhase("sending");
      const res = await postJson<{ txHash: string }>(`/api/withdrawals/${w.withdrawalId}/confirm`, { signature });
      await new Promise((r) => setTimeout(r, 1400));
      setHash(res.txHash);
      setPhase("done");
      void refetch("/api/portfolio");
    } catch (e) {
      toast((e as Error).message, "error");
      setPhase("form");
    }
  };

  const close = () => {
    if (phase === "signing" || phase === "sending") return;
    setPhase("form");
    setHash(null);
    onClose();
  };

  return (
    <Modal open={open} onClose={close} title={phase === "done" ? "Retiro enviado" : "Retirar a tu wallet"}>
      {phase === "done" ? (
        <div>
          <p className="text-silver-300">
            Enviamos <span className="num font-semibold text-leaf-300">{formatCop(amount)}</span> en USDT a {wallet.name} ({shortAddress(wallet.address)}).
          </p>
          {hash && <p className="num mt-3 text-sm text-silver-400">Transacción {hash.slice(0, 12)}…{hash.slice(-6)} (simulada)</p>}
          <button type="button" className="btn btn-sun mt-6 w-full" onClick={close}>
            Listo
          </button>
        </div>
      ) : (
        <div>
          <label htmlFor="wd-amount" className="text-sm text-silver-400">
            Monto en pesos (disponible {formatCop(max)})
          </label>
          <input id="wd-amount" type="number" min={20000} step={10000} max={Math.floor(max)} value={amount} onChange={(e) => setAmount(Number(e.target.value))} className="field mt-2" disabled={phase !== "form"} />
          <div className="mt-2 flex gap-2">
            {[0.25, 0.5, 1].map((f) => (
              <button key={f} type="button" className="rounded-full border border-silicon-600 px-3 py-1 text-xs text-silver-300 hover:text-silver-50" onClick={() => setAmount(Math.floor(max * f))} disabled={phase !== "form"}>
                {f === 1 ? "Todo" : `${f * 100} %`}
              </button>
            ))}
          </div>
          <p className="mt-5 text-sm text-silver-400">
            Destino: <span className="num text-silver-100">{wallet.name}, {shortAddress(wallet.address)}</span>
          </p>
          <button type="button" className="btn btn-sun mt-6 w-full" disabled={phase !== "form" || amount < 20000 || amount > max} onClick={() => void submit()}>
            {phase === "signing" ? (
              <>
                <Loader2 size={16} className="animate-spin" /> Firma en tu wallet…
              </>
            ) : phase === "sending" ? (
              <>
                <Loader2 size={16} className="animate-spin" /> Enviando…
              </>
            ) : (
              "Firmar y retirar"
            )}
          </button>
          <p className="mt-3 text-center text-xs text-silver-500">La firma autoriza el retiro. En esta demo no se mueve dinero.</p>
        </div>
      )}
    </Modal>
  );
}

export function WalletPage() {
  const { data: p } = useJson<PortfolioDTO>("/api/portfolio", { refreshMs: 30_000 });
  const wallet = useWallet();
  const earn = useLiveEarnings(p);
  const [withdrawOpen, setWithdrawOpen] = useState(false);
  const liveBalance = p ? p.balanceCop + ((earn?.earned ?? p.earnedCop) - p.earnedCop) : 0;

  return (
    <>
      <Topbar title="Billetera" subtitle="Tu wallet conectada, tu saldo en Solaxy y todos tus movimientos." />
      <div className="grid gap-5 lg:grid-cols-2">
        <section className="panel cells p-6 sm:p-8" aria-labelledby="balance-title">
          <h2 id="balance-title" className="text-sm text-silver-400">
            Saldo disponible en Solaxy
          </h2>
          <div className="mt-3 text-[clamp(2rem,4vw,3.2rem)]">
            <Odometer value={liveBalance} decimals={2} prefix={"$ "} className="display text-silver-50" />
          </div>
          <p className="mt-3 text-sm text-silver-400">
            Ganancias {p ? formatCop(earn?.earned ?? p.earnedCop) : "—"} + ventas {p ? formatCop(p.saleProceedsCop) : "—"} − retiros {p ? formatCop(p.withdrawnCop) : "—"}
          </p>
          <button
            type="button"
            className="btn btn-sun mt-7"
            disabled={!p}
            onClick={() => (wallet.status === "connected" ? setWithdrawOpen(true) : wallet.openConnect())}
          >
            {wallet.status === "connected" ? "Retirar a mi wallet" : "Conectar wallet para retirar"}
          </button>
        </section>

        <section className="panel p-6 sm:p-8" aria-labelledby="w-title">
          <h2 id="w-title" className="text-sm text-silver-400">
            Wallet conectada
          </h2>
          {wallet.status === "connected" ? (
            <div className="mt-4">
              <div className="text-xl font-semibold text-silver-50">{wallet.name}</div>
              <dl className="mt-4 space-y-2.5 text-sm">
                <div className="flex justify-between gap-4">
                  <dt className="text-silver-400">Dirección</dt>
                  <dd className="num break-all text-right text-silver-100">{wallet.address}</dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-silver-400">Red</dt>
                  <dd className="text-silver-100">{chainName(wallet.chainId)}</dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-silver-400">Saldo en la wallet</dt>
                  <dd className="num text-silver-100">{wallet.balance ?? "no disponible"}</dd>
                </div>
              </dl>
              <button type="button" className="btn btn-ghost mt-6 !py-2.5 text-sm" onClick={() => void wallet.disconnect()}>
                Desconectar
              </button>
            </div>
          ) : (
            <div className="mt-4">
              <p className="text-silver-300">Conecta Trust Wallet, MetaMask o la wallet de demostración para comprar y retirar.</p>
              <button type="button" className="btn btn-sun mt-6" onClick={wallet.openConnect}>
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
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="text-silver-400">
              <tr className="border-b border-silicon-600/50">
                <th className="py-3 font-normal">Movimiento</th>
                <th className="py-3 font-normal">Fecha</th>
                <th className="py-3 font-normal">Estado</th>
                <th className="py-3 font-normal">Hash</th>
                <th className="py-3 text-right font-normal">Monto</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-silicon-600/40">
              {(p?.transactions ?? []).map((t) => {
                const amt = txAmount(t);
                return (
                  <tr key={t.id}>
                    <td className="py-3.5">
                      <div className="text-silver-50">{txTitle(t)}</div>
                      <div className="text-xs text-silver-500">{txDetail(t)}</div>
                    </td>
                    <td className="num py-3.5 text-silver-300">{formatDateTime(t.createdAt)}</td>
                    <td className="py-3.5">
                      <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs ${t.status === "confirmada" ? "bg-leaf-400/12 text-leaf-300" : "bg-silicon-700 text-silver-300"}`}>
                        {t.status === "confirmada" && <Check size={12} />}
                        {STATUS_LABEL[t.status] ?? t.status}
                      </span>
                    </td>
                    <td className="py-3.5">{t.txHash ? <CopyHash hash={t.txHash} /> : <span className="text-silver-500">—</span>}</td>
                    <td className={`num py-3.5 text-right font-semibold ${amt.tone}`}>{amt.text}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {p && p.transactions.length === 0 && <p className="py-8 text-center text-silver-400">Todavía no hay movimientos.</p>}
        </div>
        <p className="mt-4 text-xs text-silver-500">Los hashes son simulados en este MVP. {p ? `${formatNumber(p.transactions.length)} movimientos.` : ""}</p>
      </section>

      <WithdrawDialog open={withdrawOpen} onClose={() => setWithdrawOpen(false)} max={liveBalance} />
    </>
  );
}
