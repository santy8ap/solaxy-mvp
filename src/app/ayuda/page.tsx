import type { Metadata } from "next";
import { PublicFrame } from "@/components/public/public-frame";
import { HelpCenter } from "@/components/help/help-center";
export const metadata: Metadata = {
  title: "Centro de ayuda",
  description:
    "Respuestas sobre planes de energía, movimientos, pagos y conceptos de energía en In World Energy.",
};
export default function Page() {
  return (
    <PublicFrame active="ayuda">
      <HelpCenter />
    </PublicFrame>
  );
}
