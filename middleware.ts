import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/** ID de petición para trazabilidad en logs y respuestas de error. */
export function middleware(req: NextRequest) {
  const requestId = req.headers.get("x-request-id") || crypto.randomUUID();

  // Límite de cuerpo de solicitud (1 MB) para evitar abusos en POST/PUT/PATCH.
  if (["POST", "PUT", "PATCH"].includes(req.method)) {
    const contentLength = req.headers.get("content-length");
    if (contentLength && Number(contentLength) > 1_000_000) {
      return NextResponse.json({ error: "Cuerpo de solicitud demasiado grande" }, { status: 413 });
    }
  }

  const res = NextResponse.next();
  res.headers.set("x-request-id", requestId);
  return res;
}

export const config = {
  matcher: ["/api/:path*"],
};