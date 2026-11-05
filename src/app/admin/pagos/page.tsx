import type { Metadata } from "next";
import { AdminPayments } from "@/components/admin/payments";

export const metadata: Metadata = { title: "Pagos" };

export default function Page() {
  return <AdminPayments />;
}
