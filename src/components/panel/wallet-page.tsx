"use client";
import { useState } from "react";
import { formatCop } from "@/lib/format";
import { useProfile } from "@/components/profile/profile-form";
import { ErrorNote } from "@/components/ui/field";
import { Topbar } from "./shell";
import { TransactionHistory } from "./transaction-history";
import { usePortfolio } from "./use-portfolio";
import { WithdrawDialog } from "./withdraw-dialog";

/** Saldo, retiros e historial de pagos. */
export function WalletPage() {
  const { data, error, totals, balanceCop } = usePortfolio();
  const profile = useProfile();
  const [withdrawing, setWithdrawing] = useState(false);

  if (!data || !totals) {
    return (
      <>
        <Topbar title="Movimientos" />
        {error ? (
          <ErrorNote>{error}</ErrorNote>
        ) : (
          <div
            className="skeleton h-[380px]"
            aria-busy="true"
            aria-label="Cargando tus movimientos"
          />
        )}
      </>
    );
  }

  return (
    <>
      <Topbar
        title="Movimientos"
        subtitle="Tu saldo, tus retiros y los pagos de tus planes."
      />

      <section
        className="grid grid-cols-[minmax(0,1fr)] gap-x-14 gap-y-8 border-t border-line-strong pt-8 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)] lg:items-end"
        aria-label="Saldo"
      >
        <div>
          <p className="cap">Saldo disponible</p>
          <p className="figure mt-3 text-[clamp(3.2rem,9vw,6.5rem)]">
            {formatCop(balanceCop)}
          </p>
          <button
            type="button"
            className="btn btn-solid mt-8"
            onClick={() => setWithdrawing(true)}
            disabled={balanceCop <= 0}
          >
            Retirar
          </button>
          {balanceCop <= 0 && (
            <p className="mt-3 text-sm text-mute">
              Tu saldo crece a medida que tu energía se genera y se vende.
            </p>
          )}
        </div>
        <dl className="grid grid-cols-3 gap-6 border-t border-line pt-5 lg:border-t-0 lg:pt-0">
          {[
            ["Venta acumulada", Math.floor(totals.soldCop)],
            ["En revisión", data.reservedCop],
            ["Retirado", data.withdrawnCop],
          ].map(([label, value]) => (
            <div key={label}>
              <dt className="cap">{label}</dt>
              <dd className="num mt-2 text-lg">{formatCop(value as number)}</dd>
            </div>
          ))}
        </dl>
      </section>

      <TransactionHistory asOf={data.asOf} />

      <WithdrawDialog
        open={withdrawing}
        onClose={() => setWithdrawing(false)}
        balanceCop={balanceCop}
        profile={profile.data?.profile ?? null}
      />
    </>
  );
}
