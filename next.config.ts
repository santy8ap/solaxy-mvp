import type { NextConfig } from "next";

const isDev = process.env.NODE_ENV === "development";
/** Fuera de Vercel: pruebas locales con Mercado Pago y cadena falsos en localhost, sin https. */
const onVercel = Boolean(process.env.VERCEL);

/**
 * Política de contenido (CSP): solo se ejecutan scripts servidos por la propia página, no se pueden
 * incrustar objetos ni la página en otro sitio, y los formularios solo envían a la propia página.
 * Sin nonces: las páginas se prerenderizan (cacheComponents), y Next.js no admite nonces ahí
 * (node_modules/next/dist/docs/01-app/02-guides/content-security-policy.md). Por eso los scripts en
 * línea de Next.js siguen permitidos; React escapa todo el texto que se muestra.
 * connect-src admite https y wss: WalletConnect (Trust Wallet por QR) usa varios servidores propios.
 */
const CSP = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  // Las fotos de perfil de Google (lh3.googleusercontent.com y similares).
  "img-src 'self' data: blob: https://*.googleusercontent.com",
  "font-src 'self' data:",
  `connect-src 'self' https: wss:${onVercel ? "" : " http://localhost:* ws://localhost:*"}`,
  "frame-src 'self' https://verify.walletconnect.com https://verify.walletconnect.org",
  "worker-src 'self' blob:",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  ...(onVercel ? ["upgrade-insecure-requests"] : []),
].join("; ");

/** Encabezados de seguridad para todas las respuestas. */
const SECURITY_HEADERS = [
  { key: "Content-Security-Policy", value: CSP },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin-allow-popups" },
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
    // Las páginas privadas y la API no se indexan en buscadores.
    const noIndex = [{ key: "X-Robots-Tag", value: "noindex, nofollow" }];
    return [
      { source: "/:path*", headers: SECURITY_HEADERS },
      ...["/admin/:path*", "/admin", "/panel/:path*", "/panel", "/api/:path*", "/pagos/:path*", "/comprar"].map((source) => ({ source, headers: noIndex })),
    ];
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
