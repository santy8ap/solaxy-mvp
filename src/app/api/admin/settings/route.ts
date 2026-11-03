import { z } from "zod";
import { requireAdminApi } from "@/lib/admin/access";
import { updatePlantSettings } from "@/lib/admin/service";
import { handleError, readJson } from "@/lib/api";

const Body = z.object({
  name: z.string().min(1).max(60),
  location: z.string().min(1).max(80),
  capacityKwp: z.number(),
  pricePerKwCop: z.number(),
  tariffDayCop: z.number(),
  tariffPeakCop: z.number(),
  commissionPct: z.number(),
  withdrawalApproval: z.boolean(),
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
