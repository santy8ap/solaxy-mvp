import type { Metadata, Viewport } from "next";
import { Archivo } from "next/font/google";
import { BRAND } from "@/config/brand";
import { LiveConfigSync } from "@/components/live/live-config-sync";
import "./globals.css";

const archivo = Archivo({
  variable: "--font-archivo",
  subsets: ["latin", "latin-ext"],
  axes: ["wdth"],
  display: "swap",
});

export const metadata: Metadata = {
  title: { default: `${BRAND.name} · Energía para empresas`, template: `%s · ${BRAND.name}` },
  description: BRAND.description,
  applicationName: BRAND.name,
};

export const viewport: Viewport = {
  themeColor: "#080808",
  colorScheme: "dark",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="es-CO" className={`${archivo.variable} h-full`}>
      <body className="min-h-full">
        {children}
        <LiveConfigSync />
      </body>
    </html>
  );
}
