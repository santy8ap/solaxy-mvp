import { toNextJsHandler } from "better-auth/next-js";
import { auth } from "@/lib/auth";
import { ensureReady } from "@/lib/db/init";

const handler = toNextJsHandler(auth);

export async function GET(req: Request) {
  await ensureReady();
  return handler.GET(req);
}

export async function POST(req: Request) {
  await ensureReady();
  return handler.POST(req);
}
