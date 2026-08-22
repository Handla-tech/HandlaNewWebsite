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
