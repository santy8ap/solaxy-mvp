import type { Metadata } from "next";
import { AdminAnalytics } from "@/components/admin/analytics";

export const metadata: Metadata = { title: "Análisis" };

export default function Page() {
  return <AdminAnalytics />;
}
