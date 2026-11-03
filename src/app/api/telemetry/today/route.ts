import { connection } from "next/server";
import { PLANT } from "@/config/plant";
import { livePayload, todayCurve } from "@/lib/telemetry/live";

export async function GET() {
  await connection();
  const now = Date.now();
  return Response.json({ now, curve: todayCurve(PLANT, now), live: livePayload(PLANT, now) });
}
