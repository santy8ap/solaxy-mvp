"use client";
import type { PortfolioDTO } from "@/lib/portfolio";
import { useJson } from "@/lib/client/use-json";
import { DataError, DataSkeleton } from "@/components/ui/data-state";
import { Topbar } from "./shell";
import { Transactions } from "./transactions";

export function MovementsPage() {
  const { data, error, reload } = useJson<PortfolioDTO>("/api/portfolio", {
    refreshMs: 30_000,
  });
  return (
    <div className="panel-view">
      <Topbar
        title="Cada movimiento, claro."
        subtitle="Consulta el estado, la fecha y el detalle de tus operaciones."
      />
      {error && (
        <DataError
          message={error}
          stale={Boolean(data)}
          onRetry={() => void reload()}
        />
      )}
      <section
        className="account-section"
        aria-label="Movimientos de tu cuenta"
      >
        <span className="eyebrow">HISTORIAL DE OPERACIONES</span>
        {data ? (
          <Transactions transactions={data.transactions} />
        ) : (
          !error && <DataSkeleton label="Cargando el historial" />
        )}
      </section>
    </div>
  );
}
