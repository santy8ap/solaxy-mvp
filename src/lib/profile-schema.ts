/**
 * Validación de los datos de la empresa. Isomórfico: lo usa el formulario
 * (para avisar al instante) y el servidor (que es quien decide).
 */

/** Documento del representante legal. */
export const DOC_TYPE_OPTIONS = [
  { id: "CC", label: "Cédula de ciudadanía" },
  { id: "CE", label: "Cédula de extranjería" },
  { id: "PP", label: "Pasaporte" },
] as const;

export type DocTypeId = (typeof DOC_TYPE_OPTIONS)[number]["id"];

export interface ProfileValue {
  /** Razón social */
  companyName: string;
  /** NIT con dígito de verificación: 900123456-8 */
  nit: string;
  /** Representante legal */
  fullName: string;
  docType: DocTypeId;
  docNumber: string;
  phone: string;
  city: string;
}

export type ProfileField = keyof ProfileValue | "acceptTerms";
export type ProfileResult = { ok: true; value: ProfileValue } | { ok: false; errors: Partial<Record<ProfileField, string>> };

const NIT_WEIGHTS = [3, 7, 13, 17, 19, 23, 29, 37, 41, 43, 47, 53, 59, 67, 71];

/** Dígito de verificación del NIT (algoritmo de la DIAN). */
export function nitCheckDigit(nit: string) {
  const digits = nit.replace(/\D/g, "").split("").reverse();
  const sum = digits.reduce((s, d, i) => s + Number(d) * NIT_WEIGHTS[i], 0);
  const r = sum % 11;
  return r > 1 ? 11 - r : r;
}

const clean = (v: unknown) => (typeof v === "string" ? v.replace(/\s+/g, " ").trim() : "");

/** Normaliza el NIT a "número-dígito". Si no trae el dígito de verificación, lo calcula. */
function parseNit(raw: string): { value?: string; error?: string } {
  const m = /^(\d{8,10})(?:-?(\d))?$/.exec(raw.replace(/[\s.]/g, ""));
  if (!m) return { error: "Escribe el NIT de la empresa: 9 dígitos y el dígito de verificación (900123456-8)." };
  const dv = nitCheckDigit(m[1]);
  if (m[2] !== undefined && Number(m[2]) !== dv) return { error: "El dígito de verificación no corresponde a ese NIT." };
  return { value: `${m[1]}-${dv}` };
}

function parseDocNumber(docType: DocTypeId, raw: string): { value?: string; error?: string } {
  const compact = raw.replace(/[\s.]/g, "").toUpperCase();
  switch (docType) {
    case "CC":
      return /^\d{5,10}$/.test(compact) ? { value: compact } : { error: "La cédula tiene entre 5 y 10 dígitos, sin letras." };
    case "CE":
      return /^[A-Z0-9]{3,15}$/.test(compact) ? { value: compact } : { error: "Escribe el número de la cédula de extranjería." };
    case "PP":
      return /^[A-Z0-9]{5,20}$/.test(compact) ? { value: compact } : { error: "El pasaporte tiene entre 5 y 20 letras o números." };
  }
}

/** Valida y normaliza. Devuelve un mensaje por campo cuando algo no está bien. */
export function parseProfile(input: Record<string, unknown>): ProfileResult {
  const errors: Partial<Record<ProfileField, string>> = {};

  const companyName = clean(input.companyName);
  if (!/^[\p{L}\p{M}0-9 .,'&()/-]{3,120}$/u.test(companyName)) errors.companyName = "Escribe la razón social de la empresa, como aparece en el RUT.";

  const nit = parseNit(clean(input.nit));
  if (nit.error) errors.nit = nit.error;

  const fullName = clean(input.fullName);
  if (!/^[\p{L}\p{M} .'-]{3,100}$/u.test(fullName)) errors.fullName = "Escribe el nombre completo del representante legal, solo con letras.";
  else if (fullName.split(" ").length < 2) errors.fullName = "Escribe el nombre y el apellido del representante legal.";

  const docType = DOC_TYPE_OPTIONS.find((o) => o.id === input.docType)?.id;
  let docNumber = "";
  if (!docType) errors.docType = "Elige el tipo de documento del representante legal.";
  else {
    const r = parseDocNumber(docType, clean(input.docNumber));
    if (r.error) errors.docNumber = r.error;
    else docNumber = r.value ?? "";
  }

  let phone = clean(input.phone).replace(/\D/g, "");
  if (phone.length === 12 && phone.startsWith("57")) phone = phone.slice(2);
  if (!/^(3\d{9}|60\d{8})$/.test(phone)) errors.phone = "Escribe un celular o fijo de Colombia de 10 dígitos (300 123 4567).";

  const city = clean(input.city);
  if (!/^[\p{L}\p{M} .,'-]{2,60}$/u.test(city)) errors.city = "Escribe la ciudad de la empresa.";

  if (input.acceptTerms !== true) errors.acceptTerms = "Debes aceptar los Términos y la Política de Tratamiento de Datos.";

  if (Object.keys(errors).length || !docType || !nit.value) return { ok: false, errors };
  return { ok: true, value: { companyName, nit: nit.value, fullName, docType, docNumber, phone, city } };
}
