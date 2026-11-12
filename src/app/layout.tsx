import type { Metadata, Viewport } from "next";
import { Archivo, IBM_Plex_Mono } from "next/font/google";
import { BRAND } from "@/config/brand";
import { VercelAnalytics } from "@/components/analytics/vercel";
import { ThemeProvider } from "@/context/theme-context";
import { DEFAULT_THEME, themeBootScript } from "@/lib/theme";
import "./globals.css";

/** Archivo con el eje de ancho: la versión condensada (62 %) es la voz de los titulares y las cifras. */
const archivo = Archivo({
  variable: "--font-archivo",
  subsets: ["latin", "latin-ext"],
  axes: ["wdth"],
  display: "swap",
});

const plexMono = IBM_Plex_Mono({
  variable: "--font-plex-mono",
  subsets: ["latin", "latin-ext"],
  weight: ["300", "400", "500"],
  display: "swap",
});

export const metadata: Metadata = {
  title: { default: `${BRAND.name} · ${BRAND.tagline}`, template: `%s · ${BRAND.name}` },
  description: BRAND.description,
  applicationName: BRAND.name,
};

export const viewport: Viewport = {
  colorScheme: "dark light",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="es-CO"
      data-theme={DEFAULT_THEME}
      suppressHydrationWarning
      className={`${archivo.variable} ${plexMono.variable} h-full`}
    >
      <head>
        <script id="xge-theme" dangerouslySetInnerHTML={{ __html: themeBootScript }} />
      </head>
      <body className="min-h-full">
        <ThemeProvider>{children}</ThemeProvider>
        {/* Los scripts de la analítica solo existen en Vercel; fuera de allí darían 404 en cada página. */}
        {process.env.VERCEL ? <VercelAnalytics /> : null}
      </body>
    </html>
  );
}
