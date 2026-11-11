import type { Metadata } from "next";
import { WalletPage } from "@/components/panel/wallet-page";

export const metadata: Metadata = { title: "Movimientos" };

export default function BilleteraPage() {
  return <WalletPage />;
}
