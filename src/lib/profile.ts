import "server-only";
import { eq } from "drizzle-orm";
import { LEGAL } from "@/config/legal";
import { db } from "@/lib/db";
import { companyProfile } from "@/lib/db/schema";
import { MarketError } from "@/lib/errors";
import { parseProfile, type DocTypeId } from "@/lib/profile-schema";

export const TERMS_VERSION = LEGAL.version;

export interface ProfileDTO {
  companyName: string;
  nit: string;
  /** Representante legal */
  fullName: string;
  docType: DocTypeId;
  docNumber: string;
  phone: string;
  city: string;
  termsVersion: string | null;
  termsAcceptedAt: number | null;
  /** Datos de la empresa completos y términos vigentes aceptados: puede comprar y retirar */
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
    // Los perfiles que vienen del modelo anterior no tienen razón social ni NIT: deben completarse.
    complete: row.termsVersion === TERMS_VERSION && Boolean(row.companyName && row.nit && row.fullName && row.docNumber),
  };
}

export async function getProfile(userId: string): Promise<ProfileDTO | null> {
  const [row] = await db.select().from(companyProfile).where(eq(companyProfile.userId, userId));
  return row ? toDTO(row) : null;
}

/** Guarda los datos de la empresa y la aceptación de la versión vigente de los términos. */
export async function saveProfile(userId: string, input: Record<string, unknown>): Promise<ProfileDTO> {
  const parsed = parseProfile(input);
  if (!parsed.ok) {
    const first = Object.values(parsed.errors)[0] ?? "Revisa los datos de la empresa";
    throw new MarketError(first, 400, { fields: parsed.errors });
  }
  const now = Date.now();
  const values = { ...parsed.value, termsVersion: TERMS_VERSION, termsAcceptedAt: now, updatedAt: now };
  const [row] = await db
    .insert(companyProfile)
    .values({ userId, ...values, createdAt: now })
    .onConflictDoUpdate({ target: companyProfile.userId, set: values })
    .returning();
  return toDTO(row);
}

/** Antes de cualquier pago o retiro: datos de la empresa completos y términos vigentes aceptados. */
export async function requireCompleteProfile(userId: string): Promise<ProfileDTO> {
  const p = await getProfile(userId);
  if (!p?.complete) {
    throw new MarketError(
      p?.companyName && p.nit ? "Los términos se actualizaron: revísalos y acéptalos para continuar." : "Completa los datos de tu empresa para continuar.",
      412,
      { code: "perfil_incompleto" },
    );
  }
  return p;
}
