import type { Metadata } from "next";
import { AdminTeam } from "@/components/admin/team";

export const metadata: Metadata = { title: "Equipo" };

export default function Page() {
  return <AdminTeam />;
}
