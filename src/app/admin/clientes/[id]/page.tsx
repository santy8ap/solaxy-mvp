import type { Metadata } from "next";
import { AdminClientDetail } from "@/components/admin/client-detail";

export const metadata: Metadata = { title: "Ficha del cliente" };

export default async function Page({ params }: PageProps<"/admin/clientes/[id]">) {
  const { id } = await params;
  return <AdminClientDetail id={id} />;
}
