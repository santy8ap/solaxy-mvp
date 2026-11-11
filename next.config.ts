import type { NextConfig } from "next";

/** Encabezados de seguridad para todas las respuestas. */
const SECURITY_HEADERS = [
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains",
  },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), browsing-topics=()",
  },
];

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  poweredByHeader: false,
  outputFileTracingIncludes: {
    "/api/receipts/*": ["./src/assets/receipt-font.ttf"],
  },
  async headers() {
    return [{ source: "/:path*", headers: SECURITY_HEADERS }];
  },
  /** Rutas de la versión anterior (compra de kW): llevan a su equivalente de ahora. */
  async redirects() {
    return [
      { source: "/planes", destination: "/#planes", permanent: true },
      { source: "/planta", destination: "/#reloj", permanent: true },
      {
        source: "/comprar/:plan",
        destination: "/comprar?plan=:plan",
        permanent: false,
      },
      {
        source: "/panel/planes",
        has: [
          {
            type: "query",
            key: "plan",
            value: "(?<chosenPlan>p(?:720|540|360|180))",
          },
        ],
        destination: "/comprar?plan=:chosenPlan",
        permanent: false,
      },
      {
        source: "/panel/mercado",
        destination: "/panel/planes",
        permanent: false,
      },
      { source: "/panel/telemetria", destination: "/panel", permanent: false },
      { source: "/panel/socios", destination: "/panel", permanent: false },
      {
        source: "/admin/usuarios",
        destination: "/admin/clientes",
        permanent: false,
      },
    ];
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
