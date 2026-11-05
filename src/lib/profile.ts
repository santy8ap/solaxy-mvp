import "server-only";
import { eq } from "drizzle-orm";
import { LEGAL } from "@/config/legal";
import { db } from "@/lib/db";
import { investorProfile } from "@/lib/db/schema";
import { MarketError } from "@/lib/errors";
import { parseProfile, type DocTypeId } from "@/lib/profile-schema";

export const TERMS_VERSION = LEGAL.version;

export interface ProfileDTO {
  fullName: string;
  docType: DocTypeId;
  docNumber: string;
  phone: string;
  city: string;
  termsVersion: string | null;
  termsAcceptedAt: number | null;
  /** Datos completos y términos vigentes aceptados: puede comprar */
  complete: boolean;
}

function toDTO(row: typeof investorProfile.$inferSelect): ProfileDTO {
  return {
    fullName: row.fullName,
    docType: row.docType,
    docNumber: row.docNumber,
    phone: row.phone,
    city: row.city,
    termsVersion: row.termsVersion,
    termsAcceptedAt: row.termsAcceptedAt,
    complete: row.termsVersion === TERMS_VERSION,
  };
}

export async function getProfile(userId: string): Promise<ProfileDTO | null> {
  const [row] = await db.select().from(investorProfile).where(eq(investorProfile.userId, userId));
  return row ? toDTO(row) : null;
}

/** Guarda los datos y la aceptación de la versión vigente de los términos. */
export async function saveProfile(userId: string, input: Record<string, unknown>): Promise<ProfileDTO> {
  const parsed = parseProfile(input);
  if (!parsed.ok) {
    const first = Object.values(parsed.errors)[0] ?? "Revisa tus datos";
    throw new MarketError(first, 400, { fields: parsed.errors });
  }
  const now = Date.now();
  const values = { ...parsed.value, termsVersion: TERMS_VERSION, termsAcceptedAt: now, updatedAt: now };
  const [row] = await db
    .insert(investorProfile)
    .values({ userId, ...values, createdAt: now })
    .onConflictDoUpdate({ target: investorProfile.userId, set: values })
    .returning();
  return toDTO(row);
}

/** Antes de cualquier pago real: datos completos y términos vigentes aceptados. */
export async function requireCompleteProfile(userId: string): Promise<ProfileDTO> {
  const p = await getProfile(userId);
  if (!p?.complete) {
    throw new MarketError(
      p ? "Los términos se actualizaron: revísalos y acéptalos para continuar." : "Completa tus datos de inversionista para continuar.",
      412,
      { code: "perfil_incompleto" },
    );
  }
  return p;
}
