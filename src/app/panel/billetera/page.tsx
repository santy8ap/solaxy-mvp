import type { Metadata } from "next";
import { WalletPage } from "@/components/panel/wallet-page";

export const metadata: Metadata = { title: "Billetera" };

export default function BilleteraPage() {
  return <WalletPage />;
}
