import type { Metadata } from "next";
import { AdminActivity } from "@/components/admin/activity";

export const metadata: Metadata = { title: "Actividad" };

export default function Page() {
  return <AdminActivity />;
}
