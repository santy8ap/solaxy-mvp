import { handleError } from "@/lib/api";
import { marketSnapshot } from "@/lib/market";
import { getSessionUser, unauthorized } from "@/lib/session";

export async function GET() {
  try {
    const user = await getSessionUser();
    if (!user) return unauthorized();
    return Response.json(await marketSnapshot(user.id));
  } catch (e) {
    return handleError(e);
  }
}
