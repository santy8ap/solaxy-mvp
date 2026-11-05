import type { Metadata } from "next";
import { AdminUsers } from "@/components/admin/users";

export const metadata: Metadata = { title: "Usuarios" };

export default function Page() {
  return <AdminUsers />;
}
