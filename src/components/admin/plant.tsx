"use client";
import { useMemo, useState } from "react";
import { PLANS } from "@/config/plans";
import { refetch, useJson } from "@/lib/client/use-json";
import { usePlantNow } from "@/lib/client/use-catalog";
import { plantDailyKwh } from "@/lib/energy/solar-day";
import {
  formatCop,
  formatDateTime,
  formatNumber,
  formatPct,
} from "@/lib/format";
import {
  catalogFrom,
  solarFrom,
  validateSettings,
  type PlantSettings,
} from "@/lib/plant-settings";
import { SolarClock } from "@/components/solar/solar-clock";
import { ErrorNote, Field } from "@/components/ui/field";
import { toast } from "@/components/ui/toast";
import { AdminTopbar } from "./shell";
import { SupportSettingsForm } from "./support-settings";
import type { OverviewDTO } from "./types";

/** "8.000" o "8000" → 8000. Vacío o con letras → NaN, y la validación lo explica. */
function toInt(text: string) {
  const digits = text.replace(/[.\s]/g, "");
  return /^\d+$/.test(digits) ? Number(digits) : Number.NaN;
}

async function saveSettings(next: Omit<PlantSettings, "updatedAt">) {
  const res = await fetch("/api/admin/settings", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(next),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok)
    throw new Error(
      (json as { error?: string }).error ?? "No se pudo guardar.",
    );
  return json as PlantSettings;
}

function PlantForm({
  initial,
  contractedDailyKwh,
}: {
  initial: PlantSettings;
  contractedDailyKwh: number;
}) {
  const [name, setName] = useState(initial.name);
  const [location, setLocation] = useState(initial.location);
  const [peak, setPeak] = useState(formatNumber(initial.peakKw));
  const [sale, setSale] = useState(String(initial.saleCopPerKwh));
  const [prices, setPrices] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      PLANS.map((p) => [
        p.id,
        String(initial.planPrices[p.id] ?? p.priceCopPerKwh),
      ]),
    ),
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const now = usePlantNow(30_000);

  const next = useMemo(
    () => ({
      name: name.trim(),
      location: location.trim(),
      peakKw: toInt(peak),
      saleCopPerKwh: toInt(sale),
      planPrices: Object.fromEntries(
        PLANS.map((p) => [p.id, toInt(prices[p.id] ?? "")]),
      ),
    }),
    [name, location, peak, sale, prices],
  );
  const problem = validateSettings(
    { ...next, updatedAt: null },
    { contractedDailyKwh },
  );
  const dirty =
    next.name !== initial.name ||
    next.location !== initial.location ||
    next.peakKw !== initial.peakKw ||
    next.saleCopPerKwh !== initial.saleCopPerKwh ||
    PLANS.some((p) => next.planPrices[p.id] !== initial.planPrices[p.id]);

  const peakOk = Number.isFinite(next.peakKw) && next.peakKw >= 100;
  const solar = solarFrom({ peakKw: peakOk ? next.peakKw : initial.peakKw });
  const daily = plantDailyKwh(solar);
  const saleOk = Number.isFinite(next.saleCopPerKwh) && next.saleCopPerKwh > 0;
  // La economía de cada plan con lo que hay escrito; si un precio no es un número, esa fila queda sin cifras.
  const preview = catalogFrom({
    saleCopPerKwh: saleOk ? next.saleCopPerKwh : initial.saleCopPerKwh,
    planPrices: Object.fromEntries(
      PLANS.map((p) => [
        p.id,
        Number.isFinite(next.planPrices[p.id]) ? next.planPrices[p.id] : 0,
      ]),
    ),
  });

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (problem) return;
    setBusy(true);
    setError(null);
    try {
      await saveSettings(next);
      toast("Cambios guardados.");
      await Promise.all([
        refetch("/api/admin/overview"),
        refetch("/api/plans"),
      ]);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} noValidate>
      <section
        className="grid grid-cols-[minmax(0,1fr)] gap-x-16 gap-y-10 border-t border-line-strong pt-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)]"
        aria-labelledby="plant-title"
      >
        <div>
          <h2 id="plant-title" className="text-xl font-medium">
            La planta
          </h2>
          <div className="mt-7 space-y-7">
            <Field label="Nombre">
              {(id, aria) => (
                <input
                  id={id}
                  {...aria}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  maxLength={60}
                  autoComplete="off"
                  className="field"
                />
              )}
            </Field>
            <Field label="Ubicación">
              {(id, aria) => (
                <input
                  id={id}
                  {...aria}
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  maxLength={80}
                  autoComplete="off"
                  className="field"
                />
              )}
            </Field>
            <Field
              label="Potencia máxima (kW)"
              hint={`Es el punto más alto del reloj solar. Con ${peakOk ? formatNumber(next.peakKw) : "esa potencia"} kW la planta entrega ${formatNumber(daily)} kWh al día, y ese es el cupo que se reparte entre los planes. Hoy hay ${formatNumber(contractedDailyKwh)} kWh diarios contratados.`}
            >
              {(id, aria) => (
                <input
                  id={id}
                  {...aria}
                  value={peak}
                  onChange={(e) => setPeak(e.target.value)}
                  inputMode="numeric"
                  autoComplete="off"
                  className="field num"
                />
              )}
            </Field>
          </div>
        </div>
        <div>
          <p className="cap">Así se ve el reloj solar</p>
          <SolarClock solar={solar} now={now} size="panel" className="mt-4" />
        </div>
      </section>

      <section
        className="mt-14 border-t border-line-strong pt-8"
        aria-labelledby="prices-title"
      >
        <h2 id="prices-title" className="text-xl font-medium">
          Precios
        </h2>
        <p className="mt-3 max-w-[70ch] text-sm leading-relaxed text-mute">
          Los precios nuevos valen para los planes que se compren desde ahora.
          Los planes ya contratados conservan el precio y la venta con que se
          compraron.
        </p>
        <Field
          label="Precio de venta de la energía (COP por kWh)"
          hint="A este precio se le vende la energía de todos los planes."
          className="mt-7 max-w-[340px]"
        >
          {(id, aria) => (
            <input
              id={id}
              {...aria}
              value={sale}
              onChange={(e) => setSale(e.target.value)}
              inputMode="numeric"
              autoComplete="off"
              className="field num"
            />
          )}
        </Field>

        <div
          className="mt-10 hidden grid-cols-[1.1fr_1fr_0.8fr_1.1fr_1.1fr] gap-x-6 border-b border-line-strong pb-3 md:grid"
          aria-hidden="true"
        >
          <span className="cap">Plan</span>
          <span className="cap">Precio por kWh</span>
          <span className="cap">Utilidad</span>
          <span className="cap">Pago mensual</span>
          <span className="cap">Utilidad del plan</span>
        </div>
        <ul>
          {preview.map((p) => {
            const valid =
              Number.isFinite(next.planPrices[p.id]) &&
              next.planPrices[p.id] > 0 &&
              saleOk &&
              next.planPrices[p.id] < next.saleCopPerKwh;
            return (
              <li
                key={p.id}
                className="grid grid-cols-2 gap-x-6 gap-y-4 border-b border-line py-5 md:grid-cols-[1.1fr_1fr_0.8fr_1.1fr_1.1fr] md:items-end"
              >
                <div className="col-span-2 md:col-span-1">
                  <p className="text-lg font-medium">{p.name}</p>
                  <p className="num mt-1 text-sm text-mute">
                    {formatNumber(p.totalKwh)} kWh
                  </p>
                </div>
                <div className="col-span-2 md:col-span-1">
                  <label htmlFor={`price-${p.id}`} className="cap md:sr-only">
                    Precio por kWh del {p.name}
                  </label>
                  <input
                    id={`price-${p.id}`}
                    value={prices[p.id] ?? ""}
                    onChange={(e) =>
                      setPrices((prev) => ({ ...prev, [p.id]: e.target.value }))
                    }
                    inputMode="numeric"
                    autoComplete="off"
                    aria-invalid={!valid}
                    className="field num"
                  />
                </div>
                <div>
                  <p className="cap md:hidden">Utilidad</p>
                  <p className="num mt-1 text-lg md:mt-0 md:pb-[0.7rem]">
                    {valid ? formatPct(p.profitPct, 0) : "—"}
                  </p>
                </div>
                <div>
                  <p className="cap md:hidden">Pago mensual</p>
                  <p className="num mt-1 md:mt-0 md:pb-[0.7rem]">
                    {valid ? formatCop(p.monthlyCop) : "—"}
                  </p>
                </div>
                <div className="col-span-2 md:col-span-1">
                  <p className="cap md:hidden">Utilidad del plan</p>
                  <p className="num mt-1 md:mt-0 md:pb-[0.7rem]">
                    {valid ? formatCop(p.totalProfitCop) : "—"}
                  </p>
                </div>
              </li>
            );
          })}
        </ul>
      </section>

      <div className="mt-10 flex flex-wrap items-center gap-x-8 gap-y-4">
        <button
          type="submit"
          className="btn btn-solid"
          disabled={busy || !dirty || !!problem}
        >
          {busy ? "Guardando…" : "Guardar los cambios"}
        </button>
        {dirty && problem ? (
          <p
            className="max-w-[60ch] text-sm leading-relaxed text-ink"
            role="status"
          >
            {problem}
          </p>
        ) : (
          <p className="text-sm text-mute">
            {initial.updatedAt
              ? `Última modificación: ${formatDateTime(initial.updatedAt)}.`
              : "Todavía con los valores iniciales."}
          </p>
        )}
      </div>
      {error && <ErrorNote className="mt-6">{error}</ErrorNote>}
    </form>
  );
}

export function AdminPlant() {
  const { data, error } = useJson<OverviewDTO>("/api/admin/overview", {
    refreshMs: 15_000,
  });
  return (
    <>
      <AdminTopbar
        title="Planta"
        subtitle="El reloj solar, el cupo de energía y los precios de los planes."
      />
      {!data ? (
        error ? (
          <ErrorNote>{error}</ErrorNote>
        ) : (
          <div
            className="skeleton h-[420px]"
            aria-busy="true"
            aria-label="Cargando la configuración"
          />
        )
      ) : (
        // La llave cambia cuando alguien guarda: el formulario toma los valores recién guardados sin perder lo que se esté escribiendo.
        <PlantForm
          key={data.settings.updatedAt ?? 0}
          initial={data.settings}
          contractedDailyKwh={data.contractedDailyKwh}
        />
      )}
      <SupportSettingsForm />
    </>
  );
}
