import type { Metadata } from "next";
import { ProfilePage } from "@/components/profile/profile-page";

export const metadata: Metadata = { title: "Mis datos" };

export default function PerfilPage() {
  return <ProfilePage />;
}
