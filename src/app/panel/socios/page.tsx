import type { Metadata } from "next";
import { Partners } from "@/components/panel/partners";

export const metadata: Metadata = { title: "Socios" };

export default function SociosPage() {
  return <Partners />;
}
