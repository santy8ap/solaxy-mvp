"use client";
import { Loader2 } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { invalidateJson, refetch } from "@/lib/client/use-json";
import { formatCop, formatNumber, shortAddress } from "@/lib/format";
import type { ProfileDTO } from "@/lib/profile";
import { useWallet } from "@/lib/wallet/context";
import { BANKS, BANK_ACCOUNT_TYPES, MIN_WITHDRAWAL_COP, parseBankDestination, type BankField } from "@/lib/withdrawal-schema";
import { ErrorNote, Field } from "@/components/ui/field";
import { Modal } from "@/components/ui/modal";
import { toast } from "@/components/ui/toast";

type Dest = "banco" | "wallet";

async function post<T>(url: string, body: unknown): Promise<T> {
  const res = await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  const json = (await res.json().catch(() => ({}))) as T & { error?: string; fields?: Partial<Record<BankField, string>> };
  if (!res.ok) throw Object.assign(new Error(json.error ?? `Error ${res.status}`), { fields: json.fields });
  return json;
}

/** "1.250.000" → 1250000. Solo dígitos: el retiro es en pesos, sin centavos. */
const parseAmount = (raw: string) => Number(raw.replace(/\D/g, "")) || 0;

/** Solicitud de retiro a la cuenta del titular o a su wallet en USDT. Siempre la revisa el equipo. */
export function WithdrawDialog({ open, onClose, balanceCop, profile }: { open: boolean; onClose(): void; balanceCop: number; profile: ProfileDTO | null }) {
  const wallet = useWallet();
  const [dest, setDest] = useState<Dest>("banco");
  const [amount, setAmount] = useState("");
  const [bank, setBank] = useState({ bank: "", accountType: "ahorros", accountNumber: "" });
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<BankField | "amount", string>>>({});
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<null | "enviando" | "firmando">(null);
  const amountCop = parseAmount(amount);

  const close = () => {
    if (busy) return;
    setError(null);
    setFieldErrors({});
    onClose();
  };
  const finish = () => {
    invalidateJson("/api/transactions");
    void refetch("/api/portfolio");
    toast("Retiro solicitado. Lo revisamos y te pagamos.");
    setAmount("");
    setBusy(null);
    onClose();
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const errs: typeof fieldErrors = {};
    if (amountCop < MIN_WITHDRAWAL_COP) errs.amount = `El retiro mínimo es de ${formatCop(MIN_WITHDRAWAL_COP)}.`;
    else if (amountCop > balanceCop) errs.amount = `Tu saldo disponible es de ${formatCop(balanceCop)}.`;
    if (dest === "banco") {
      const parsed = parseBankDestination(bank);
      if (!parsed.ok) Object.assign(errs, parsed.errors);
    }
    setFieldErrors(errs);
    if (Object.keys(errs).length) return;

    try {
      if (dest === "banco") {
        setBusy("enviando");
        await post("/api/withdrawals", { to: "banco", amountCop, ...bank });
        return finish();
      }
      if (wallet.status !== "connected" || !wallet.address) {
        wallet.openConnect();
        return;
      }
      setBusy("enviando");
      const w = await post<{ withdrawalId: string; message: string }>("/api/withdrawals", { to: "wallet", amountCop, walletAddress: wallet.address, walletName: wallet.name ?? "Wallet", chainId: wallet.chainId });
      setBusy("firmando");
      const signature = await wallet.signMessage(w.message);
      await post(`/api/withdrawals/${w.withdrawalId}/confirm`, { signature });
      finish();
    } catch (err) {
      const fields = (err as { fields?: typeof fieldErrors }).fields;
      if (fields) setFieldErrors(fields);
      setError((err as Error).message);
      setBusy(null);
    }
  };

  const needsProfile = !profile?.complete;

  return (
    <Modal open={open} onClose={close} title="Retirar" wide>
      {needsProfile ? (
        <div>
          <p className="leading-relaxed text-fog">Para retirar necesitamos tus datos personales: la cuenta debe pertenecer al titular registrado.</p>
          <div className="mt-7 flex justify-end">
            <Link href="/panel/perfil" className="btn btn-solid" onClick={onClose}>
              Completar los datos
            </Link>
          </div>
        </div>
      ) : (
        <form onSubmit={submit} noValidate className="space-y-7">
          <Field label="Cuánto quieres retirar" error={fieldErrors.amount} hint={`Disponible: ${formatCop(balanceCop)}. Mínimo: ${formatCop(MIN_WITHDRAWAL_COP)}.`}>
            {(id, aria) => (
              <div className="flex items-end gap-4">
                <div className="relative flex-1">
                  <span className="num pointer-events-none absolute bottom-[0.72rem] left-0 text-mute">$</span>
                  <input
                    id={id}
                    {...aria}
                    inputMode="numeric"
                    autoComplete="off"
                    value={amount}
                    onChange={(e) => {
                      const n = parseAmount(e.target.value);
                      setAmount(n ? formatNumber(n) : "");
                      setFieldErrors((f) => ({ ...f, amount: undefined }));
                    }}
                    placeholder="0"
                    className="field num !pl-5 text-xl"
                  />
                </div>
                <button type="button" className="link pb-3 text-sm text-fog" onClick={() => setAmount(formatNumber(balanceCop))}>
                  Todo
                </button>
              </div>
            )}
          </Field>

          <fieldset>
            <legend className="cap mb-3">A dónde</legend>
            <div className="grid grid-cols-2 border border-line-strong">
              {(
                [
                  ["banco", "Cuenta bancaria", "En pesos"],
                  ["wallet", "Wallet", "En USDT"],
                ] as const
              ).map(([id, title, note], i) => (
                <label key={id} className={`flex cursor-pointer flex-col gap-0.5 p-3.5 transition-colors has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-ink ${i ? "border-l border-line-strong" : ""} ${dest === id ? "bg-ink text-void" : "hover:bg-ink/5"}`}>
                  <input type="radio" name="dest" value={id} checked={dest === id} onChange={() => setDest(id)} className="sr-only" />
                  <span className="font-medium">{title}</span>
                  <span className={`text-xs ${dest === id ? "text-void/70" : "text-mute"}`}>{note}</span>
                </label>
              ))}
            </div>
          </fieldset>

          {dest === "banco" ? (
            <div className="grid gap-x-8 gap-y-6 sm:grid-cols-2">
              <Field label="Banco" error={fieldErrors.bank}>
                {(id, aria) => (
                  <select id={id} {...aria} value={bank.bank} onChange={(e) => setBank({ ...bank, bank: e.target.value })} className="field">
                    <option value="">Elige el banco</option>
                    {BANKS.map((b) => (
                      <option key={b} value={b}>
                        {b}
                      </option>
                    ))}
                  </select>
                )}
              </Field>
              <Field label="Tipo de cuenta" error={fieldErrors.accountType}>
                {(id, aria) => (
                  <select id={id} {...aria} value={bank.accountType} onChange={(e) => setBank({ ...bank, accountType: e.target.value })} className="field">
                    {BANK_ACCOUNT_TYPES.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.label}
                      </option>
                    ))}
                  </select>
                )}
              </Field>
              <Field label="Número de la cuenta" error={fieldErrors.accountNumber} className="sm:col-span-2" hint={profile.companyName && profile.nit ? `La cuenta debe estar a nombre de ${profile.companyName} (NIT ${profile.nit}).` : `La cuenta debe estar a nombre de ${profile.fullName} (${profile.docType} ${profile.docNumber}).`}>
                {(id, aria) => <input id={id} {...aria} inputMode="numeric" autoComplete="off" value={bank.accountNumber} onChange={(e) => setBank({ ...bank, accountNumber: e.target.value })} className="field num" />}
              </Field>
            </div>
          ) : (
            <div className="border-t border-line pt-5 text-sm leading-relaxed text-fog">
              {wallet.status === "connected" ? (
                <p>
                  Te pagamos en USDT a {wallet.name}, <span className="num text-ink">{shortAddress(wallet.address)}</span>. Tu wallet te pedirá una firma para confirmar que es tuya; la firma no mueve fondos.{" "}
                  <button type="button" className="link text-ink" onClick={() => void wallet.disconnect()}>
                    Usar otra wallet
                  </button>
                </p>
              ) : (
                <p>Conecta la wallet a la que quieres recibir el pago, en USDT. Te pedirá una firma para confirmar que es tuya.</p>
              )}
            </div>
          )}

          {error && <ErrorNote>{error}</ErrorNote>}
          <div>
            <p className="text-xs leading-relaxed text-mute">Nuestro equipo revisa cada retiro antes de pagarlo.</p>
            <div className="mt-5 flex flex-wrap justify-end gap-3">
              <button type="button" className="btn btn-ghost" onClick={close} disabled={!!busy}>
                Cancelar
              </button>
              <button type="submit" className="btn btn-solid" disabled={!!busy}>
                {busy ? (
                  <>
                    <Loader2 size={15} className="animate-spin" /> {busy === "firmando" ? "Firma en tu wallet…" : "Enviando…"}
                  </>
                ) : dest === "wallet" && wallet.status !== "connected" ? (
                  "Conectar wallet"
                ) : (
                  "Solicitar retiro"
                )}
              </button>
            </div>
          </div>
        </form>
      )}
    </Modal>
  );
}
