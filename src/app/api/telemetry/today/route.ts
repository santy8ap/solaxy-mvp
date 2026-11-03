import { connection } from "next/server";
import { handleError } from "@/lib/api";
import { ensureReady } from "@/lib/db/init";
import { livePayload, todayCurve } from "@/lib/telemetry/live";

export async function GET() {
  try {
    await connection();
    const { spec, econ } = await ensureReady();
    const now = Date.now();
    return Response.json({ now, curve: todayCurve(spec, now, econ), live: livePayload(spec, now, econ) });
  } catch (e) {
    return handleError(e);
  }
}
