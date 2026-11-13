import "server-only";
import { and, eq, inArray, sql } from "drizzle-orm";
import { LEGAL } from "@/config/legal";
import { audit } from "@/lib/admin/audit";
import { alertAdmin } from "@/lib/alerts";
import { db } from "@/lib/db";
import { companyProfile, ledgerTx } from "@/lib/db/schema";
import { MarketError } from "@/lib/errors";
import { hasPersonalDetails, parseProfile, type DocTypeId } from "@/lib/profile-schema";

export const TERMS_VERSION = LEGAL.version;

export interface ProfileDTO {
  companyName: string;
  nit: string;
  /** Titular del plan: el comercializador. */
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

type Identity = Pick<typeof companyProfile.$inferSelect, "fullName" | "docType" | "docNumber">;
const identityOf = (p: Identity) => ({ fullName: p.fullName, docType: p.docType, docNumber: p.docNumber });
const describe = (p: Identity) => `${p.fullName} (${p.docType} ${p.docNumber})`;

/**
 * Si la cuenta ya movió dinero y cambia quién es el titular (nombre o documento), queda constancia en la
 * bitácora y se avisa al admin: los retiros se pagan a una cuenta a nombre del titular, así que un cambio
 * de identidad justo antes de un retiro es una señal que conviene ver. El celular y la ciudad no cuentan.
 */
async function recordIdentityChange(userId: string, before: Identity, after: Identity) {
  const [moved] = await db
    .select({ n: sql<number>`count(*)` })
    .from(ledgerTx)
    .where(and(eq(ledgerTx.userId, userId), inArray(ledgerTx.status, ["confirmada", "verificando", "por_aprobar", "por_reembolsar", "reembolsada"])));
  if (!Number(moved?.n ?? 0)) return;
  const summary = `Cambió los datos del titular: de ${describe(before)} a ${describe(after)}.`;
  await audit({ id: userId, name: after.fullName }, "cambio_titular", summary, { antes: identityOf(before), despues: identityOf(after) }, userId);
  alertAdmin(async () => ({
    kind: "datos",
    subject: "Un comercializador cambió su nombre o su documento",
    lines: [
      `${before.fullName} cambió los datos del titular de su cuenta: ahora figura ${after.fullName}.`,
      "Los retiros se pagan a una cuenta a nombre del titular. Si no esperabas este cambio, revisa la cuenta en Clientes antes de pagarle un retiro. El antes y el después quedaron en Actividad.",
    ],
    path: "/admin/actividad",
  }));
}

/** Guarda los datos personales y la aceptación de la versión vigente de los términos. */
export async function saveProfile(userId: string, input: Record<string, unknown>): Promise<ProfileDTO> {
  const parsed = parseProfile(input);
  if (!parsed.ok) {
    const first = Object.values(parsed.errors)[0] ?? "Revisa tus datos personales";
    throw new MarketError(first, 400, { fields: parsed.errors });
  }
  const [before] = await db.select().from(companyProfile).where(eq(companyProfile.userId, userId));
  const now = Date.now();
  const values = { ...parsed.value, termsVersion: TERMS_VERSION, termsAcceptedAt: now, updatedAt: now };
  const [row] = await db
    .insert(companyProfile)
    // Las columnas antiguas se conservan sin migrar ni inventar una razón social o un NIT.
    .values({ userId, ...values, companyName: parsed.value.companyName ?? "", nit: parsed.value.nit ?? "", createdAt: now })
    .onConflictDoUpdate({ target: companyProfile.userId, set: values })
    .returning();
  if (before && hasPersonalDetails(before) && JSON.stringify(identityOf(before)) !== JSON.stringify(identityOf(row))) await recordIdentityChange(userId, before, row);
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
