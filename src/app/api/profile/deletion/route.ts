import { connection } from "next/server";
import { z } from "zod";
import { handleError, readJson } from "@/lib/api";
import { lastDeletionRequest, requestDeletion } from "@/lib/privacy";
import { TOO_MANY_ORDERS, orderLimiter } from "@/lib/security/limits";
import { getSessionUser, jsonError, unauthorized } from "@/lib/session";

const Body = z.object({ reason: z.string().max(600).optional() });

const view = (r: Awaited<ReturnType<typeof lastDeletionRequest>>) =>
  r && { id: r.id, status: r.status, reason: r.reason, createdAt: r.createdAt, dueAt: r.dueAt, resolvedAt: r.resolvedAt, resolution: r.resolution };

/** Cómo va la última solicitud de eliminación de la cuenta. */
export async function GET() {
  try {
    await connection();
    const user = await getSessionUser();
    if (!user) return unauthorized();
    return Response.json({ request: view(await lastDeletionRequest(user.id)) });
  } catch (e) {
    return handleError(e);
  }
}

/** El titular pide que se elimine su cuenta: el admin la atiende dentro del plazo legal. */
export async function POST(req: Request) {
  try {
    const user = await getSessionUser();
    if (!user) return unauthorized();
    const b = Body.parse(await readJson(req));
    if (!(await orderLimiter.hit(user.id))) return jsonError(TOO_MANY_ORDERS, 429);
    const { request, created } = await requestDeletion(user.id, b.reason);
    return Response.json({ request: view(request) }, { status: created ? 201 : 200 });
  } catch (e) {
    return handleError(e);
  }
}
