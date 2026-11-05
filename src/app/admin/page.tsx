import type { Metadata } from "next";
import { AdminOverview } from "@/components/admin/overview";

export const metadata: Metadata = { title: "Resumen" };

export default function Page() {
  return <AdminOverview />;
}
