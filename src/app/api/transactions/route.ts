import { handleError } from "@/lib/api";
import { historyFilters } from "@/lib/history-filters";
import { getSessionUser, unauthorized } from "@/lib/session";
import { listTransactions } from "@/lib/transactions";

export async function GET(req: Request) {
  try {
    const user = await getSessionUser();
    if (!user) return unauthorized();
    return Response.json(
      await listTransactions(
        user.id,
        historyFilters(new URL(req.url).searchParams),
      ),
      { headers: { "cache-control": "private, no-store" } },
    );
  } catch (error) {
    return handleError(error);
  }
}
