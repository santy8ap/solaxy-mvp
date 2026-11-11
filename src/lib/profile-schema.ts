/**
 * Validación de los datos personales del comercializador. Isomórfico: lo usa el formulario
 * (para avisar al instante) y el servidor (que es quien decide).
 */

/** Documento personal del titular. */
export const DOC_TYPE_OPTIONS = [
  { id: "CC", label: "Cédula de ciudadanía" },
  { id: "CE", label: "Cédula de extranjería" },
  { id: "PP", label: "Pasaporte" },
] as const;

export type DocTypeId = (typeof DOC_TYPE_OPTIONS)[number]["id"];

export interface ProfileValue {
  /** Datos opcionales de compatibilidad para clientes y perfiles anteriores. */
  companyName?: string;
  nit?: string;
  /** Nombre completo del comercializador. */
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

  // No se solicitan datos de empresa. Conservamos la compatibilidad con clientes anteriores.
  const legacy: Pick<ProfileValue, "companyName" | "nit"> = {};
  const companyName = clean(input.companyName);
  if (companyName) {
    if (!/^[\p{L}\p{M}0-9 .,'&()/-]{3,120}$/u.test(companyName)) errors.companyName = "Revisa la razón social registrada.";
    else legacy.companyName = companyName;
  }
  const rawNit = clean(input.nit);
  if (rawNit) {
    const nit = parseNit(rawNit);
    if (nit.error) errors.nit = nit.error;
    else legacy.nit = nit.value;
  }

  const fullName = clean(input.fullName);
  if (!/^[\p{L}\p{M} .'-]{3,100}$/u.test(fullName)) errors.fullName = "Escribe tu nombre completo, como aparece en tu documento.";
  else if (fullName.split(" ").length < 2) errors.fullName = "Escribe tu nombre y apellido.";

  const docType = DOC_TYPE_OPTIONS.find((o) => o.id === input.docType)?.id;
  let docNumber = "";
  if (!docType) errors.docType = "Elige tu tipo de documento personal.";
  else {
    const r = parseDocNumber(docType, clean(input.docNumber));
    if (r.error) errors.docNumber = r.error;
    else docNumber = r.value ?? "";
  }

  let phone = clean(input.phone).replace(/\D/g, "");
  if (phone.length === 12 && phone.startsWith("57")) phone = phone.slice(2);
  if (!/^(3\d{9}|60\d{8})$/.test(phone)) errors.phone = "Escribe un celular o fijo de Colombia de 10 dígitos (300 123 4567).";

  const city = clean(input.city);
  if (!/^[\p{L}\p{M} .,'-]{2,60}$/u.test(city)) errors.city = "Escribe tu ciudad de residencia.";

  if (input.acceptTerms !== true) errors.acceptTerms = "Debes aceptar los Términos y la Política de Tratamiento de Datos.";

  if (Object.keys(errors).length || !docType) return { ok: false, errors };
  return { ok: true, value: { ...legacy, fullName, docType, docNumber, phone, city } };
}

/** Valida la identidad personal sin exigir ni reinterpretar datos empresariales antiguos. */
export function hasPersonalDetails(input: Omit<ProfileValue, "companyName" | "nit">) {
  const { fullName, docType, docNumber, phone, city } = input;
  return parseProfile({ fullName, docType, docNumber, phone, city, acceptTerms: true }).ok;
}
