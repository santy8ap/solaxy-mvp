import { NextResponse, type NextRequest } from "next/server";
import { guardApiRequest } from "@/lib/security/request-guard";

/** Antes de cada petición a /api: solo desde la propia página cuando cambia datos, y cuerpos pequeños. */
export function proxy(req: NextRequest) {
  const publicUrl = process.env.BETTER_AUTH_URL?.replace(/\/$/, "");
  const r = guardApiRequest({
    method: req.method,
    pathname: req.nextUrl.pathname,
    host: req.headers.get("host"),
    origin: req.headers.get("origin"),
    secFetchSite: req.headers.get("sec-fetch-site"),
    contentLength: req.headers.get("content-length"),
    extraOrigins: publicUrl ? [publicUrl] : [],
  });
  if (!r.ok) return NextResponse.json({ error: r.error }, { status: r.status });
  return NextResponse.next();
}

export const config = { matcher: ["/api/:path*"] };
