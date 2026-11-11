import "server-only";
import { eq } from "drizzle-orm";
import { LEGAL } from "@/config/legal";
import { db } from "@/lib/db";
import { companyProfile } from "@/lib/db/schema";
import { MarketError } from "@/lib/errors";
import { hasPersonalDetails, parseProfile, type DocTypeId } from "@/lib/profile-schema";

export const TERMS_VERSION = LEGAL.version;

export interface ProfileDTO {
  companyName: string;
  nit: string;
  /** Titular del paquete: el comercializador. */
  fullName: string;
  docType: DocTypeId;
  docNumber: string;
  phone: string;
  city: string;
  termsVersion: string | null;
  termsAcceptedAt: number | null;
  /** Datos personales completos y términos vigentes aceptados: puede comprar y retirar. */
  complete: boolean;
}

function toDTO(row: typeof companyProfile.$inferSelect): ProfileDTO {
  return {
    companyName: row.companyName,
    nit: row.nit,
    fullName: row.fullName,
    docType: row.docType,
    docNumber: row.docNumber,
    phone: row.phone,
    city: row.city,
    termsVersion: row.termsVersion,
    termsAcceptedAt: row.termsAcceptedAt,
    complete: row.termsVersion === TERMS_VERSION && row.termsAcceptedAt != null && hasPersonalDetails(row),
  };
}

export async function getProfile(userId: string): Promise<ProfileDTO | null> {
  const [row] = await db.select().from(companyProfile).where(eq(companyProfile.userId, userId));
  return row ? toDTO(row) : null;
}

/** Guarda los datos personales y la aceptación de la versión vigente de los términos. */
export async function saveProfile(userId: string, input: Record<string, unknown>): Promise<ProfileDTO> {
  const parsed = parseProfile(input);
  if (!parsed.ok) {
    const first = Object.values(parsed.errors)[0] ?? "Revisa tus datos personales";
    throw new MarketError(first, 400, { fields: parsed.errors });
  }
  const now = Date.now();
  const values = { ...parsed.value, termsVersion: TERMS_VERSION, termsAcceptedAt: now, updatedAt: now };
  const [row] = await db
    .insert(companyProfile)
    // Las columnas antiguas se conservan sin migrar ni inventar una razón social o un NIT.
    .values({ userId, ...values, companyName: parsed.value.companyName ?? "", nit: parsed.value.nit ?? "", createdAt: now })
    .onConflictDoUpdate({ target: companyProfile.userId, set: values })
    .returning();
  return toDTO(row);
}

/** Antes de cualquier pago o retiro: identidad personal y términos vigentes aceptados. */
export async function requireCompleteProfile(userId: string): Promise<ProfileDTO> {
  const p = await getProfile(userId);
  if (!p?.complete) {
    throw new MarketError(
      p && p.termsVersion !== TERMS_VERSION ? "Los términos se actualizaron: revísalos y acéptalos para continuar." : "Completa tus datos personales como comercializador para continuar.",
      412,
      { code: "perfil_incompleto" },
    );
  }
  return p;
}
