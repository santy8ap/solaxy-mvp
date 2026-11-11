import type { Metadata } from "next";
import { AdminClients } from "@/components/admin/clients";

export const metadata: Metadata = { title: "Clientes" };

export default function Page() {
  return <AdminClients />;
}
