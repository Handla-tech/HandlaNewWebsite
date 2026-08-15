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

  // ─── i18n routing ──────────────────────────────────────────────────────────
  i18n: {
    locales: ['en', 'ar'],
    defaultLocale: 'en',
    localeDetection: false,
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
