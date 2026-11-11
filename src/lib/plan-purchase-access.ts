import "server-only";

import { notFound, redirect } from "next/navigation";
import { ENERGY_PLANS } from "@/config/energy-plans";
import { signInHref } from "@/lib/navigation";
import { getSessionUser } from "@/lib/session";

/** Check the real session on every purchase request, including direct URLs. */
export async function requirePlanBuyer(planId: string) {
  const plan = ENERGY_PLANS.find((option) => option.id === planId);
  if (!plan) notFound();

  const user = await getSessionUser();
  if (!user) redirect(signInHref(`/comprar/${plan.id}`));

  return { plan, user };
}
