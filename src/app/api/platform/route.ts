import { connection } from "next/server";
import { ECONOMICS } from "@/config/economics";
import { PLANT } from "@/config/plant";
import { handleError } from "@/lib/api";
import { db } from "@/lib/db";
import { platformStats } from "@/lib/market";
import { plantLifetime } from "@/lib/telemetry/service";

export async function GET() {
  try {
    await connection();
    const stats = await platformStats();
    const life = await plantLifetime(db, PLANT);
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
