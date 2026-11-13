import "server-only";
import { writeTransaction } from "@/lib/db/transaction";
import { adminAudit, type AdminAction } from "@/lib/db/schema";
import { newId } from "@/lib/ids";

export interface Actor {
  id: string;
  name: string;
}

/**
 * Deja constancia en la bitácora. Va en una transacción de escritura para esperar su turno: si otra escritura
 * (por ejemplo, un doble clic que confirma el mismo pago) tiene la base ocupada, la constancia no se pierde.
 * No se llama dentro de otra transacción de escritura.
 */
export async function audit(actor: Actor, action: AdminAction, summary: string, detail?: unknown, targetUserId?: string) {
  await writeTransaction((session) =>
    session.insert(adminAudit).values({
      id: newId("aud-"),
      actorUserId: actor.id,
      actorName: actor.name,
      action,
      targetUserId: targetUserId ?? null,
      summary,
      detail: detail === undefined ? null : JSON.stringify(detail),
      createdAt: Date.now(),
    }),
  );
}
