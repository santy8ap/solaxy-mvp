import { connection } from "next/server";
import { handleError } from "@/lib/api";
import { db } from "@/lib/db";
import { ensureReady } from "@/lib/db/init";
import { isoDay } from "@/lib/portfolio";
import { localDayIndex } from "@/lib/sim";
import { plantDailyTotals } from "@/lib/telemetry/service";

export async function GET(req: Request) {
  try {
    await connection();
    const { spec } = await ensureReady();
    const days = Math.min(120, Math.max(7, Number(new URL(req.url).searchParams.get("days") ?? 30) || 30));
    const today = localDayIndex(Date.now());
    const rows = await plantDailyTotals(db, spec, today - days, today - 1);
    return Response.json({ days: rows.map((r) => ({ ...r, date: isoDay(r.day) })) });
  } catch (e) {
    return handleError(e);
  }
}
