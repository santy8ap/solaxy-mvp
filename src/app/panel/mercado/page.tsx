import type { Metadata } from "next";
import { Market } from "@/components/market/market";

export const metadata: Metadata = { title: "Mercado" };

export default function MarketPage() {
  return <Market />;
}
