import type { MetadataRoute } from "next";
import { LEGAL } from "@/config/legal";
import { baseUrl } from "@/lib/env";

/** Las páginas públicas, para los buscadores. */
export default function sitemap(): MetadataRoute.Sitemap {
  const url = baseUrl();
  return [
    { url, changeFrequency: "weekly", priority: 1 },
    { url: `${url}/ayuda`, changeFrequency: "monthly", priority: 0.6 },
    { url: `${url}/terminos`, lastModified: LEGAL.version, changeFrequency: "yearly", priority: 0.3 },
    { url: `${url}/privacidad`, lastModified: LEGAL.version, changeFrequency: "yearly", priority: 0.3 },
  ];
}
