import type { Metadata } from "next";
import { MovementsPage } from "@/components/panel/movements-page";
export const metadata: Metadata = { title: "Movimientos" };
export default function Page() {
  return <MovementsPage />;
}
