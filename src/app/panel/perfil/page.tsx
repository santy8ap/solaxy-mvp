import type { Metadata } from "next";
import { ProfilePage } from "@/components/profile/profile-page";

export const metadata: Metadata = { title: "Comercializador" };

export default function PerfilPage() {
  return <ProfilePage />;
}
