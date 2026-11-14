import type { MetadataRoute } from "next";
import { BRAND } from "@/config/brand";

/**
 * Nombre e íconos cuando alguien guarda la página en la pantalla de inicio del celular. Se abre en el navegador
 * (display «browser»): así el ingreso con Google y la sesión funcionan igual que en la web.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: BRAND.name,
    short_name: BRAND.name,
    description: BRAND.description,
    lang: "es-CO",
    start_url: "/panel",
    scope: "/",
    display: "browser",
    background_color: "#050505",
    theme_color: "#050505",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
