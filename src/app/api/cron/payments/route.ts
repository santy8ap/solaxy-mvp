import { connection } from "next/server";
import { handleError } from "@/lib/api";
import { authorizedCron } from "@/lib/jobs/auth";
import { reconcilePayments } from "@/lib/jobs/reconcile-payments";

export const maxDuration = 60;

export async function GET(request: Request) {
  await connection();
  const headers = { "Cache-Control": "private, no-store" };
  if (!authorizedCron(request.headers.get("authorization")))
    return Response.json({ error: "No autorizado" }, { status: 401, headers });
  try {
    return Response.json(await reconcilePayments(), { headers });
  } catch (error) {
    return handleError(error);
  }
}
