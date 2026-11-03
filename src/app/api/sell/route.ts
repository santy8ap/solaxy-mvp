import { z } from "zod";
import { handleError, readJson } from "@/lib/api";
import { createListing, instantSell } from "@/lib/market";
import { getSessionUser, unauthorized } from "@/lib/session";

const Body = z.discriminatedUnion("mode", [
  z.object({ mode: z.literal("instant"), kw: z.number().positive() }),
  z.object({ mode: z.literal("listing"), kw: z.number().positive(), pricePerKwCop: z.number().int().positive() }),
]);

export async function POST(req: Request) {
  try {
    const user = await getSessionUser();
    if (!user) return unauthorized();
    const b = Body.parse(await readJson(req));
    const result = b.mode === "instant" ? await instantSell(user.id, b.kw) : await createListing(user.id, b.kw, b.pricePerKwCop);
    return Response.json(result, { status: 201 });
  } catch (e) {
    return handleError(e);
  }
}
