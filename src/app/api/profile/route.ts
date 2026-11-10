import { handleError, readJson } from "@/lib/api";
import { TERMS_VERSION, getProfile, saveProfile } from "@/lib/profile";
import { getSessionUser, jsonError, unauthorized } from "@/lib/session";

/** Datos de la empresa de la sesión actual. */
export async function GET() {
  try {
    const user = await getSessionUser();
    if (!user) return unauthorized();
    return Response.json({ profile: await getProfile(user.id), termsVersion: TERMS_VERSION, email: user.email });
  } catch (e) {
    return handleError(e);
  }
}

export async function PUT(req: Request) {
  try {
    const user = await getSessionUser();
    if (!user) return unauthorized();
    const body = await readJson(req);
    if (!body || typeof body !== "object") return jsonError("Datos inválidos");
    const profile = await saveProfile(user.id, body as Record<string, unknown>);
    return Response.json({ profile, termsVersion: TERMS_VERSION, email: user.email });
  } catch (e) {
    return handleError(e);
  }
}
