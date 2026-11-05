import type { Metadata } from "next";
import { AdminWithdrawals } from "@/components/admin/withdrawals";

export const metadata: Metadata = { title: "Retiros" };

export default function Page() {
  return <AdminWithdrawals />;
}
