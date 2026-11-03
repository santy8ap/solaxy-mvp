import type { Metadata } from "next";
import { Overview } from "@/components/panel/overview";

export const metadata: Metadata = { title: "Resumen" };

export default function PanelPage() {
  return <Overview />;
}
