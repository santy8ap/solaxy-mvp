import { connection } from "next/server";
import { ECONOMICS } from "@/config/economics";
import { handleError } from "@/lib/api";
import { db } from "@/lib/db";
import { ensureReady } from "@/lib/db/init";
import { platformStats } from "@/lib/market";
import { plantLifetime } from "@/lib/telemetry/service";

export async function GET() {
  try {
    await connection();
    const stats = await platformStats();
    const { spec } = await ensureReady();
    const life = await plantLifetime(db, spec);
    return Response.json({
      ...stats,
      lifetimeKwh: life.cumKwh,
      co2AvoidedKg: life.cumKwh * ECONOMICS.co2KgPerKwh,
      lifetimeNetPerKwp: life.cumNetPerKwp,
    });
  } catch (e) {
    return handleError(e);
  }
}
