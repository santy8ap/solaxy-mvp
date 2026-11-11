import type { Metadata } from "next";
import { PublicFrame } from "@/components/public/public-frame";
import { PlantSheet } from "@/components/public/plant-sheet";
export const metadata: Metadata = {
  title: "La planta",
  description:
    "Explora los componentes y la ficha registrada del sistema solar de In World Energy.",
};
export default function Page() {
  return (
    <PublicFrame active="planta">
      <PlantSheet />
    </PublicFrame>
  );
}
