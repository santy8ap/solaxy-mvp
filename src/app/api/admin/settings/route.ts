import { z } from "zod";
import { requireAdminApi } from "@/lib/admin/access";
import { updatePlantSettings } from "@/lib/admin/service";
import { handleError, readJson } from "@/lib/api";
import { safeText } from "@/lib/security/text";

const Body = z.object({
  name: safeText(60, { min: 1, label: "El nombre" }),
  location: safeText(80, { min: 1, label: "La ubicación" }),
  peakKw: z.number(),
  saleCopPerKwh: z.number(),
  planPrices: z.record(z.string().max(20), z.number()),
});

export async function PUT(req: Request) {
  try {
    const admin = await requireAdminApi();
    if (admin instanceof Response) return admin;
    const b = Body.parse(await readJson(req));
    return Response.json(await updatePlantSettings({ id: admin.user.id, name: admin.user.name }, { ...b, updatedAt: null }));
  } catch (e) {
    return handleError(e);
  }
}
