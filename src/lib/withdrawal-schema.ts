/** Retiros: reglas compartidas por el formulario y el servidor. Isomórfico. */

/** Retiro mínimo (COP). */
export const MIN_WITHDRAWAL_COP = 50_000;

export const BANKS = [
  "Bancolombia",
  "Banco de Bogotá",
  "Davivienda",
  "BBVA",
  "Banco de Occidente",
  "Banco Popular",
  "Banco AV Villas",
  "Scotiabank Colpatria",
  "Itaú",
  "Banco Caja Social",
  "Banco Agrario",
  "GNB Sudameris",
  "Banco Pichincha",
  "Banco Falabella",
  "Bancoomeva",
  "Banco W",
  "Nequi",
  "Daviplata",
] as const;

export const BANK_ACCOUNT_TYPES = [
  { id: "ahorros", label: "Cuenta de ahorros" },
  { id: "corriente", label: "Cuenta corriente" },
] as const;

export type BankAccountType = (typeof BANK_ACCOUNT_TYPES)[number]["id"];

export interface BankDestination {
  bank: string;
  accountType: BankAccountType;
  accountNumber: string;
}

export type BankField = keyof BankDestination;
export type BankResult = { ok: true; value: BankDestination } | { ok: false; errors: Partial<Record<BankField, string>> };

/** Valida y normaliza la cuenta bancaria de destino. */
export function parseBankDestination(input: Record<string, unknown>): BankResult {
  const errors: Partial<Record<BankField, string>> = {};
  const bank = BANKS.find((b) => b === input.bank);
  if (!bank) errors.bank = "Elige el banco de la cuenta.";
  const accountType = BANK_ACCOUNT_TYPES.find((t) => t.id === input.accountType)?.id;
  if (!accountType) errors.accountType = "Elige si la cuenta es de ahorros o corriente.";
  const accountNumber = typeof input.accountNumber === "string" ? input.accountNumber.replace(/[\s-]/g, "") : "";
  if (!/^\d{6,20}$/.test(accountNumber)) errors.accountNumber = "Escribe el número de la cuenta, solo con dígitos (entre 6 y 20).";
  if (!bank || !accountType || errors.accountNumber) return { ok: false, errors };
  return { ok: true, value: { bank, accountType, accountNumber } };
}

export function accountTypeLabel(id: string | null | undefined) {
  return BANK_ACCOUNT_TYPES.find((t) => t.id === id)?.label ?? "Cuenta";
}
