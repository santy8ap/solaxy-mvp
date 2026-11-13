import type { MetadataRoute } from "next";
import { baseUrl } from "@/lib/env";

/** Qué pueden recorrer los buscadores: las páginas públicas sí; el panel, el admin, los pagos y la API, no. */
export default function robots(): MetadataRoute.Robots {
  // Las vistas previas de Vercel no se indexan: son copias de prueba.
  if (process.env.VERCEL_ENV === "preview") return { rules: { userAgent: "*", disallow: "/" } };
  const url = baseUrl();
  return {
    rules: { userAgent: "*", allow: "/", disallow: ["/admin", "/panel", "/api/", "/pagos", "/comprar", "/ingresar"] },
    sitemap: `${url}/sitemap.xml`,
  };
}
