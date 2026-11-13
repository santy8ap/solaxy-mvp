import { handleError, readJson } from "@/lib/api";
import { TERMS_VERSION, getProfile, saveProfile } from "@/lib/profile";
import { TOO_MANY_PROFILE_CHANGES, profileLimiter } from "@/lib/security/limits";
import { getSessionUser, jsonError, unauthorized } from "@/lib/session";

/** Datos personales del comercializador de la sesión actual. */
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
    if (!(await profileLimiter.hit(user.id))) return jsonError(TOO_MANY_PROFILE_CHANGES, 429);
    const profile = await saveProfile(user.id, body as Record<string, unknown>);
    return Response.json({ profile, termsVersion: TERMS_VERSION, email: user.email });
  } catch (e) {
    return handleError(e);
  }
}
