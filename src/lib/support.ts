import "server-only";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { ensureReady } from "@/lib/db/init";
import { serviceSetting } from "@/lib/db/schema";
import { SupportInput, type SupportSettings } from "@/lib/support-schema";

export async function getSupport(): Promise<SupportSettings> {
  await ensureReady();
  const [row] = await db
    .select()
    .from(serviceSetting)
    .where(eq(serviceSetting.id, "support"));
  const fallback = {
    email: process.env.SUPPORT_EMAIL ?? "",
    whatsapp: process.env.SUPPORT_WHATSAPP ?? "",
  };
  let input: unknown = fallback;
  if (row) {
    try {
      input = JSON.parse(row.value);
    } catch {
      /* Un ajuste dañado no publica un contacto falso. */
    }
  }
  const parsed = SupportInput.safeParse(input);
  return {
    email: parsed.success ? parsed.data.email || null : null,
    whatsapp: parsed.success ? parsed.data.whatsapp || null : null,
    updatedAt: row?.updatedAt ?? null,
  };
}

export async function saveSupport(input: unknown): Promise<SupportSettings> {
  await ensureReady();
  const data = SupportInput.parse(input);
  const updatedAt = Date.now();
  await db
    .insert(serviceSetting)
    .values({ id: "support", value: JSON.stringify(data), updatedAt })
    .onConflictDoUpdate({
      target: serviceSetting.id,
      set: { value: JSON.stringify(data), updatedAt },
    });
  return {
    email: data.email || null,
    whatsapp: data.whatsapp || null,
    updatedAt,
  };
}
