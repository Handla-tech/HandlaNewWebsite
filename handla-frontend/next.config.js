// ─── Security headers (FE-01) ────────────────────────────────────────────────
// The NestJS API sets helmet headers on API responses, but the HTML documents
// served by Next.js previously carried NO security headers. This block adds a
// defence-in-depth header set to every Next-served response.
//
// CSP notes / why it is shaped this way (must not break the running app):
//   • script-src needs 'unsafe-inline' because the root layout ships an inline
//     anti-FOUC theme <Script strategy="beforeInteractive"> and Next injects
//     its own inline bootstrap scripts. A strict nonce CSP is not compatible
//     with `output: 'standalone'` + beforeInteractive inline scripts without a
//     larger refactor; this is tracked as a future hardening item.
//   • style-src needs 'unsafe-inline' for framer-motion's injected styles and
//     Next's inlined critical CSS.
//   • connect-src must include the API + WebSocket origins (from env) plus ws:
//     /wss: so axios + socket.io can reach the backend.
//   • img-src allows the S3 upload bucket(s) and data:/blob: (avatars, QR).
//   • frame-ancestors 'none' + X-Frame-Options DENY block clickjacking.
const API_ORIGIN = (() => {
  try { return new URL(process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api').origin; }
  catch { return 'http://localhost:3001'; }
})();
const SOCKET_ORIGIN = (() => {
  try { return new URL(process.env.NEXT_PUBLIC_SOCKET_URL || 'http://localhost:3001').origin; }
  catch { return 'http://localhost:3001'; }
})();

const CSP = [
  "default-src 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  "frame-ancestors 'none'",
  "form-action 'self'",
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline'",
  "font-src 'self' data:",
  "img-src 'self' data: blob: https://*.amazonaws.com",
  `connect-src 'self' ${API_ORIGIN} ${SOCKET_ORIGIN} ws: wss:`,
  "manifest-src 'self'",
  "worker-src 'self' blob:",
  "upgrade-insecure-requests",
].join('; ');

const SECURITY_HEADERS = [
  { key: 'Content-Security-Policy', value: CSP },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), interest-cohort=()' },
  { key: 'X-DNS-Prefetch-Control', value: 'off' },
  // HSTS: only meaningful over HTTPS. Traefik terminates TLS in prod; setting it
  // here is harmless on http (browsers ignore HSTS on plain http) and ensures
  // the header is present even if the proxy config drifts.
  { key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains; preload' },
];

/** @type {import('next').NextConfig} */
const nextConfig = {
  // ─── Standalone output (self-contained server for Docker) ──────────────────
  // Produces .next/standalone with a minimal node server + traced deps, so the
  // production image does not need the full node_modules tree.
  output: 'standalone',

  // ─── Image domains ─────────────────────────────────────────────────────────
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**.amazonaws.com',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'handla-uploads.s3.*.amazonaws.com',
        pathname: '/**',
      },
    ],
  },

  // ─── Expose public env vars to the browser ─────────────────────────────────
  env: {
    NEXT_PUBLIC_API_URL:
      process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api',
    NEXT_PUBLIC_SOCKET_URL:
      process.env.NEXT_PUBLIC_SOCKET_URL || 'http://localhost:3001',
    NEXT_PUBLIC_APP_URL:
      process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
  },

  // ─── Legacy → localized permanent redirects (308) ──────────────────────────
  // Public SEO pages now live under /[locale]/… (en|ar). Old non-localized
  // public URLs are permanently redirected to their English equivalent with a
  // 308 (method + body preserving). These run server-side BEFORE routing, so
  // they never create a redirect *chain* (each old URL maps directly to its
  // final /en/… destination). '/' → '/en' is deterministic: no browser-language
  // or IP-based locale detection.
  //
  // Private routes (/auth, /dashboard, /erp, /profile, …) are intentionally NOT
  // redirected — they stay on their current non-localized paths.
  async redirects() {
    return [
      { source: '/',                   destination: '/en',                   permanent: true },
      { source: '/products',           destination: '/en/products',          permanent: true },
      { source: '/products/manarah',   destination: '/en/products/manarah',  permanent: true },
      { source: '/products/madar',     destination: '/en/products/madar',    permanent: true },
      { source: '/products/matjary',   destination: '/en/products/matjary',  permanent: true },
      { source: '/projects',           destination: '/en/projects',          permanent: true },

      // ─── Service-catalog corrections (single-hop 308, no chains) ───────────
      // The canonical Handla catalog is 8 real services. Two slugs from the SEO
      // migration are no longer canonical and permanently redirect to the
      // closest real service page. Each source maps DIRECTLY to its final
      // localized destination (no redirect chain), for both the localized
      // (/en, /ar) and the legacy non-localized forms.
      //
      // "Custom Software" is NOT a standalone service — its content was folded
      // into ERP & CRM Systems, so it redirects to /services/erp-crm.
      { source: '/en/services/custom-software', destination: '/en/services/erp-crm', permanent: true },
      { source: '/ar/services/custom-software', destination: '/ar/services/erp-crm', permanent: true },
      { source: '/services/custom-software',    destination: '/en/services/erp-crm', permanent: true },
      // "mobile-app-development" was renamed to the canonical "mobile-applications".
      { source: '/en/services/mobile-app-development', destination: '/en/services/mobile-applications', permanent: true },
      { source: '/ar/services/mobile-app-development', destination: '/ar/services/mobile-applications', permanent: true },
      { source: '/services/mobile-app-development',    destination: '/en/services/mobile-applications', permanent: true },
    ];
  },

  // ─── Security headers (FE-01) — applied to every route ─────────────────────
  async headers() {
    return [
      {
        source: '/:path*',
        headers: SECURITY_HEADERS,
      },
    ];
  },

  // ─── Webpack / transpile ────────────────────────────────────────────────────
  transpilePackages: [],

  // ─── Webpack overrides ──────────────────────────────────────────────────────
  webpack: (config, { isServer }) => {
    if (!isServer) {
      // socket.io-client / engine.io-client reference the Node.js 'ws' package
      // at the top level even in browser builds. Alias it to a no-op so the
      // browser bundle does not fail trying to resolve a Node-only module.
      config.resolve.alias = {
        ...config.resolve.alias,
        ws: false,
      };
    }
    return config;
  },

  // ─── Production optimizations ──────────────────────────────────────────────
  compress: true,
  poweredByHeader: false,
  reactStrictMode: true,
};

module.exports = nextConfig;
