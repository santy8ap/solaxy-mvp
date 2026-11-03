import { handleError } from "@/lib/api";
import { getPortfolio } from "@/lib/portfolio";
import { getSessionUser, unauthorized } from "@/lib/session";

export async function GET() {
  try {
    const user = await getSessionUser();
    if (!user) return unauthorized();
    return Response.json(await getPortfolio(user.id));
  } catch (e) {
    return handleError(e);
  }
}
