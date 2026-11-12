import type { Metadata } from "next";
import { AdminSettings } from "@/components/admin/settings";

export const metadata: Metadata = { title: "Configuración" };

export default function Page() {
  return <AdminSettings />;
}
