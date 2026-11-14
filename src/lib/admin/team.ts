import "server-only";
import { asc, eq, inArray, sql } from "drizzle-orm";
import { alertAdmin } from "@/lib/alerts";
import { db } from "@/lib/db";
import { ensureReady } from "@/lib/db/init";
import { adminMember, session, user } from "@/lib/db/schema";
import { isDeletedEmail } from "@/lib/deleted-account";
import { adminEmailAllowed, adminEmails, env } from "@/lib/env";
import { MarketError } from "@/lib/errors";
import { safeText } from "@/lib/security/text";
import { audit, type Actor } from "./audit";
import type { AdminRole } from "./roles";

/** Cuántas personas puede tener el equipo, además de los propietarios. */
export const MAX_TEAM = 25;
const EMAIL = /^[^\s@<>()",;:]+@[^\s@<>()",;:]+\.[a-z]{2,}$/i;
const noteField = safeText(80, { label: "La nota" });

const normalize = (email: string) => email.trim().toLowerCase();

/** Los propietarios: los correos de ADMIN_EMAILS. La cuenta de pruebas cuenta solo mientras el modo de pruebas siga activo. */
export function ownerEmails() {
  return adminEmails().filter((e) => adminEmailAllowed(e));
}

/** El rol de administración de un correo, o null si no administra. Se consulta en cada petición: quitar a alguien vale de inmediato. */
export async function adminRoleOf(email: string): Promise<AdminRole | null> {
  const e = normalize(email);
  if (!e || isDeletedEmail(e)) return null;
  if (ownerEmails().includes(e)) return "propietario";
  // La cuenta de pruebas solo administra como propietaria (ADMIN_EMAILS), nunca por la lista del equipo.
  if (e === env.demoEmail) return null;
  await ensureReady();
  const [row] = await db.select({ email: adminMember.email }).from(adminMember).where(eq(adminMember.email, e)).limit(1);
  return row ? "administrador" : null;
}

export interface TeamMember {
  email: string;
  role: AdminRole;
  /** El nombre de su cuenta de Google, si ya entró alguna vez */
  name: string | null;
  image: string | null;
  /** Su último ingreso a la página (con cualquier rol) */
  lastLoginAt: number | null;
  addedBy: string | null;
  addedAt: number | null;
  note: string | null;
}

/** Propietarios y equipo, con su nombre y su último ingreso. */
export async function listTeam(): Promise<TeamMember[]> {
  await ensureReady();
  const members = await db.select().from(adminMember).orderBy(asc(adminMember.addedAt));
  const owners = ownerEmails();
  const emails = [...owners, ...members.map((m) => m.email)];
  const accounts = emails.length
    ? await db
        .select({ id: user.id, email: user.email, name: user.name, image: user.image })
        .from(user)
        .where(inArray(sql`lower(${user.email})`, emails))
    : [];
  const logins = accounts.length
    ? await db
        .select({ userId: session.userId, last: sql<number>`max(${session.createdAt})` })
        .from(session)
        .where(
          inArray(
            session.userId,
            accounts.map((a) => a.id),
          ),
        )
        .groupBy(session.userId)
    : [];
  const accountOf = (email: string) => accounts.find((a) => a.email.toLowerCase() === email);
  const lastOf = (email: string) => {
    const a = accountOf(email);
    const l = a && logins.find((x) => x.userId === a.id);
    return l?.last ? Number(l.last) : null;
  };
  return [
    ...owners.map((email) => ({ email, role: "propietario" as const, name: accountOf(email)?.name ?? null, image: accountOf(email)?.image ?? null, lastLoginAt: lastOf(email), addedBy: null, addedAt: null, note: null })),
    ...members.map((m) => ({ email: m.email, role: "administrador" as const, name: accountOf(m.email)?.name ?? null, image: accountOf(m.email)?.image ?? null, lastLoginAt: lastOf(m.email), addedBy: m.addedBy, addedAt: m.addedAt, note: m.note })),
  ];
}

type Owner = Actor & { email: string };

/** Avisa a los propietarios de cualquier cambio en el equipo: si no lo esperaban, lo deshacen. */
function alertTeamChange(subject: string, line: string) {
  alertAdmin(() => ({
    kind: "equipo",
    subject,
    lines: [line, "Si no lo esperabas, revísalo en Administración › Equipo y en Actividad."],
    path: "/admin/equipo",
  }));
}

/** Un propietario le da acceso de administrador a un correo de Google. */
export async function addAdmin(actor: Owner, input: { email: string; note?: string }) {
  const email = normalize(input.email);
  if (!EMAIL.test(email) || email.length > 254) throw new MarketError("Escribe el correo de la cuenta de Google de esa persona.");
  if (email === env.demoEmail || isDeletedEmail(email)) throw new MarketError("Ese correo no puede ser administrador.");
  if (ownerEmails().includes(email)) throw new MarketError("Ese correo es propietario: ya tiene acceso completo.", 409);
  const note = noteField.parse(input.note ?? "") || null;
  await ensureReady();
  const [count] = await db.select({ n: sql<number>`count(*)` }).from(adminMember);
  if (Number(count?.n ?? 0) >= MAX_TEAM) throw new MarketError(`El equipo ya tiene ${MAX_TEAM} personas. Quita a alguien antes de agregar a otra.`, 409);
  const [row] = await db
    .insert(adminMember)
    .values({ email, note, addedBy: `${actor.name} (${actor.email})`, addedAt: Date.now() })
    .onConflictDoNothing()
    .returning();
  if (!row) throw new MarketError("Ese correo ya tiene acceso a la administración.", 409);
  await audit(actor, "agregar_admin", `Dio acceso de administrador a ${email}${note ? ` (${note})` : ""}`, { email, note });
  alertTeamChange("Nuevo administrador", `${actor.name} le dio acceso a la administración a ${email}${note ? ` (${note})` : ""}.`);
  return row;
}

/** Un propietario le quita el acceso a alguien del equipo. Vale de inmediato, aunque tenga la sesión abierta. */
export async function removeAdmin(actor: Owner, rawEmail: string) {
  const email = normalize(rawEmail);
  if (ownerEmails().includes(email)) throw new MarketError("Los propietarios se cambian en Vercel (ADMIN_EMAILS), no desde aquí.", 409);
  await ensureReady();
  const [row] = await db.delete(adminMember).where(eq(adminMember.email, email)).returning();
  if (!row) throw new MarketError("Ese correo no está en el equipo.", 404);
  await audit(actor, "quitar_admin", `Le quitó el acceso de administrador a ${email}`, { email });
  alertTeamChange("Se quitó un administrador", `${actor.name} le quitó el acceso a la administración a ${email}.`);
  return { email };
}
