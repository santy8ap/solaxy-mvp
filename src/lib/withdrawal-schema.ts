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

/**
 * Nequi y Daviplata se identifican con el número de celular de la cuenta: no tienen tipo de cuenta. Se guardan como
 * «ahorros», que es como las listan los bancos para transferirles, y en pantalla se nombran «Celular».
 */
export const PHONE_WALLETS = ["Nequi", "Daviplata"] as const;
export const isPhoneWallet = (bank: string | null | undefined) => PHONE_WALLETS.some((w) => w === bank);

/** Quita espacios, puntos, guiones y paréntesis; en un celular, también el +57 o 57 de adelante. */
export function normalizeAccountNumber(bank: string, raw: string) {
  const digits = raw.replace(/[\s.()+-]/g, "");
  return isPhoneWallet(bank) && /^573\d{9}$/.test(digits) ? digits.slice(2) : digits;
}

/** El error del número de cuenta (ya normalizado), o null si está bien. */
export function accountNumberError(bank: string, digits: string) {
  if (isPhoneWallet(bank)) return /^3\d{9}$/.test(digits) ? null : `Escribe el celular de la cuenta ${bank}: 10 dígitos que empiezan por 3.`;
  return /^\d{6,20}$/.test(digits) ? null : "Escribe el número de la cuenta, solo con dígitos (entre 6 y 20).";
}

/** Qué pide el formulario según el banco elegido. */
export function accountFieldsFor(bank: string) {
  return isPhoneWallet(bank)
    ? { needsType: false, numberLabel: `Celular de ${bank}`, numberHint: `El celular con el que está registrada la cuenta ${bank}: 10 dígitos.`, inputMode: "tel" as const }
    : { needsType: true, numberLabel: "Número de cuenta", numberHint: "Solo los dígitos; los espacios y guiones se quitan al guardar.", inputMode: "numeric" as const };
}

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
  const accountType: BankAccountType | undefined = isPhoneWallet(bank) ? "ahorros" : BANK_ACCOUNT_TYPES.find((t) => t.id === input.accountType)?.id;
  if (!accountType) errors.accountType = "Elige si la cuenta es de ahorros o corriente.";
  const accountNumber = typeof input.accountNumber === "string" ? normalizeAccountNumber(bank ?? "", input.accountNumber) : "";
  const numberError = accountNumberError(bank ?? "", accountNumber);
  if (numberError) errors.accountNumber = numberError;
  if (!bank || !accountType || errors.accountNumber) return { ok: false, errors };
  return { ok: true, value: { bank, accountType, accountNumber } };
}

export function accountTypeLabel(id: string | null | undefined) {
  return BANK_ACCOUNT_TYPES.find((t) => t.id === id)?.label ?? "Cuenta";
}

/** «Cuenta de ahorros», o «Celular» en Nequi y Daviplata. */
export function accountKindLabel(bank: string | null | undefined, accountType: string | null | undefined) {
  return isPhoneWallet(bank) ? "Celular" : accountTypeLabel(accountType);
}
