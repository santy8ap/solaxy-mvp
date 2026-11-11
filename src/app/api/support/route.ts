import { handleError } from "@/lib/api";
import { connection } from "next/server";
import { getSupport } from "@/lib/support";
export async function GET() {
  try {
    await connection();
    return Response.json(await getSupport(), {
      headers: { "cache-control": "no-store" },
    });
  } catch (error) {
    return handleError(error);
  }
}
