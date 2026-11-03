import { connection } from "next/server";
import { getRates } from "@/lib/rates";

export async function GET() {
  await connection();
  return Response.json(await getRates());
}
