import type { Metadata } from "next";
import { AdminPlant } from "@/components/admin/plant";

export const metadata: Metadata = { title: "Planta" };

export default function Page() {
  return <AdminPlant />;
}
