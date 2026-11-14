import type { Metadata } from "next";
import { BRAND } from "@/config/brand";
import { AdminOverview } from "@/components/admin/overview";

// La plantilla «%s · Admin …» del layout solo aplica a las páginas hijas, no a esta (mismo segmento).
export const metadata: Metadata = { title: { absolute: `Resumen · Admin ${BRAND.name}` } };

export default function Page() {
  return <AdminOverview />;
}
