import type { Metadata } from "next";
import { NotificationsPage } from "@/components/panel/notifications";
export const metadata: Metadata = { title: "Avisos" };
export default function Page() {
  return <NotificationsPage />;
}
