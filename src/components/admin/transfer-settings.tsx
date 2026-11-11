"use client";
import { useState } from "react";
import { refetch, useJson } from "@/lib/client/use-json";
import { BANKS, BANK_ACCOUNT_TYPES } from "@/lib/withdrawal-schema";
import { ErrorNote, Field } from "@/components/ui/field";
import { toast } from "@/components/ui/toast";

const SETTINGS_URL = "/api/admin/transfer-settings";

interface TransferAccount {
  bank: string;
  accountType: string;
  accountNumber: string;
  holder: string;
  holderId: string;
}

/** La cuenta de la empresa que ven los comercializadores cuando eligen pagar por transferencia. */
export function TransferSettingsForm() {
  const { data, error } = useJson<{ account: TransferAccount | null }>(SETTINGS_URL);
  return (
    <section className="mt-16 border-t border-line-strong pt-8" aria-labelledby="transfer-title">
      <h2 id="transfer-title" className="text-xl font-medium">
        Cuenta para transferencias
      </h2>
      <p className="mt-3 max-w-[68ch] text-sm leading-relaxed text-mute">
        Los comercializadores ven estos datos cuando eligen pagar por transferencia bancaria, junto con el valor exacto y una referencia. Cada transferencia la confirmas en Pagos cuando veas el dinero en el banco. Mientras no haya una cuenta guardada, esa opción no aparece.
      </p>
      {error && <ErrorNote className="mt-6">{error}</ErrorNote>}
      {data ? (
        <AccountForm key={data.account ? JSON.stringify(data.account) : "nueva"} initial={data.account} />
      ) : (
        !error && <div className="skeleton mt-6 h-40" aria-busy="true" aria-label="Cargando la cuenta para transferencias" />
      )}
    </section>
  );
}

function AccountForm({ initial }: { initial: TransferAccount | null }) {
  const [bank, setBank] = useState(initial?.bank ?? "");
  const [accountType, setAccountType] = useState(initial?.accountType ?? "corriente");
  const [accountNumber, setAccountNumber] = useState(initial?.accountNumber ?? "");
  const [holder, setHolder] = useState(initial?.holder ?? "");
  const [holderId, setHolderId] = useState(initial?.holderId ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(SETTINGS_URL, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ bank, accountType, accountNumber, holder: holder.trim(), holderId: holderId.trim() }),
      });
      const json = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(json.error ?? "No se pudo guardar.");
      toast("Cuenta para transferencias guardada.");
      await Promise.all([refetch(SETTINGS_URL), refetch("/api/config")]);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <form className="mt-7 grid max-w-[760px] gap-x-8 gap-y-6 sm:grid-cols-2" onSubmit={(e) => void submit(e)} noValidate>
      <Field label="Banco">
        {(id, aria) => (
          <select id={id} {...aria} value={bank} onChange={(e) => setBank(e.target.value)} className="field">
            <option value="" disabled>
              Elige el banco
            </option>
            {BANKS.map((b) => (
              <option key={b} value={b}>
                {b}
              </option>
            ))}
          </select>
        )}
      </Field>
      <Field label="Tipo de cuenta">
        {(id, aria) => (
          <select id={id} {...aria} value={accountType} onChange={(e) => setAccountType(e.target.value)} className="field">
            {BANK_ACCOUNT_TYPES.map((t) => (
              <option key={t.id} value={t.id}>
                {t.label}
              </option>
            ))}
          </select>
        )}
      </Field>
      <Field label="Número de cuenta" hint="Solo los dígitos; los espacios y guiones se quitan al guardar.">
        {(id, aria) => <input id={id} {...aria} value={accountNumber} onChange={(e) => setAccountNumber(e.target.value)} inputMode="numeric" maxLength={40} autoComplete="off" className="field num" />}
      </Field>
      <Field label="NIT o documento del titular">
        {(id, aria) => <input id={id} {...aria} value={holderId} onChange={(e) => setHolderId(e.target.value)} maxLength={30} autoComplete="off" className="field num" />}
      </Field>
      <Field label="Titular de la cuenta" hint="El nombre exacto con el que el banco muestra la cuenta." className="sm:col-span-2">
        {(id, aria) => <input id={id} {...aria} value={holder} onChange={(e) => setHolder(e.target.value)} maxLength={120} autoComplete="off" className="field" />}
      </Field>
      {error && <ErrorNote className="sm:col-span-2">{error}</ErrorNote>}
      <div className="sm:col-span-2">
        <button type="submit" className="btn btn-solid" disabled={busy || !bank || !accountNumber.trim() || holder.trim().length < 3 || holderId.trim().length < 5}>
          {busy ? "Guardando…" : initial ? "Guardar los cambios" : "Guardar la cuenta"}
        </button>
      </div>
    </form>
  );
}
