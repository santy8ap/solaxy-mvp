import type { Metadata } from "next";
import { ProfilePage } from "@/components/profile/profile-page";

export const metadata: Metadata = { title: "Empresa" };

export default function PerfilPage() {
  return <ProfilePage />;
}
