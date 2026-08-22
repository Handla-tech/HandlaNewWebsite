import type { Metadata, Viewport } from 'next';
import { Space_Grotesk } from 'next/font/google';
import Script from 'next/script';
import './globals.css';
import { Providers } from '@/components/Providers';
import { JsonLd, organizationSchema, softwareServicesSchema } from '@/components/JsonLd';

// ─── Analytics endpoint (self-hosted tracker) ──────────────────────────────────
// NEXT_PUBLIC_API_URL already includes the `/api` prefix (e.g. http://host/api),
// so the collect endpoint is `${API_URL}/analytics/collect`.
const ANALYTICS_API =
  process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';
const ANALYTICS_ENDPOINT = `${ANALYTICS_API.replace(/\/$/, '')}/analytics/collect`;

// ─── Font ─────────────────────────────────────────────────────────────────────

const spaceGrotesk = Space_Grotesk({
  subsets: ['latin'],
  weight: ['300', '400', '500', '600', '700'],
  variable: '--font-space-grotesk',
  display: 'swap',
});

// ─── Metadata ─────────────────────────────────────────────────────────────────

// Canonical site origin — always https://handla.tech (no www, no http).
// `metadataBase` makes all relative canonical/OG URLs resolve against this host.
const SITE_URL = (process.env.NEXT_PUBLIC_APP_URL || 'https://handla.tech').replace(/\/$/, '');

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  // NOTE: No root-level `alternates.canonical` here on purpose. A canonical
  // set at the root layout is inherited by every child route, which would
  // wrongly canonicalize /projects, /products, /products/* to the homepage.
  // Each public page instead declares its OWN self-referencing canonical
  // (see src/app/page.tsx and the per-route layout.tsx files).
  title: {
    template: '%s | Handla',
    default:  'Handla — Software Services Platform',
  },
  description:
    'Handla is a professional software services marketing platform connecting clients with expert software solutions — featuring real-time chat, project management, and bilingual support.',
  keywords: [
    'software services', 'web development', 'ERP', 'CRM', 'mobile apps',
    'custom software', 'handla', 'software consulting',
  ],
  authors: [{ name: 'Handla' }],
  creator: 'Handla',
  openGraph: {
    type:        'website',
    locale:      'en_US',
    alternateLocale: ['ar_SA'],
    siteName:    'Handla',
    title:       'Handla — Software Services Platform',
    description: 'Professional software services connecting clients with expert solutions.',
  },
  twitter: {
    card:  'summary_large_image',
    title: 'Handla — Software Services Platform',
    description: 'Professional software services connecting clients with expert solutions.',
  },
  robots: {
    index:  true,
    follow: true,
  },
};

export const viewport: Viewport = {
  width:        'device-width',
  initialScale: 1,
  themeColor:   [
    { media: '(prefers-color-scheme: light)', color: '#ffffff' },
    { media: '(prefers-color-scheme: dark)',  color: '#080c18' },
  ],
};

// ─── Root Layout ─────────────────────────────────────────────────────────────

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      dir="ltr"
      // uiStore re-applies lang/dir/dark class on client after hydration
      suppressHydrationWarning
    >
      <head>
        {/* Anti-FOUC: apply persisted theme + locale before first paint so a
            light-mode user never sees a dark flash (and vice-versa). Reads the
            same `handla-ui` zustand-persist key the store uses. */}
        <Script id="handla-theme-init" strategy="beforeInteractive">
          {`(function(){try{var t='dark',l='en';var raw=localStorage.getItem('handla-ui');if(raw){var s=JSON.parse(raw);if(s&&s.state){if(s.state.theme)t=s.state.theme;if(s.state.locale)l=s.state.locale;}}var r=document.documentElement;r.classList.toggle('dark',t==='dark');r.classList.toggle('light',t==='light');r.lang=l;r.dir=l==='ar'?'rtl':'ltr';}catch(e){document.documentElement.classList.add('dark');}})();`}
        </Script>

        {/* JSON-LD structured data — Organization + Services */}
        <JsonLd data={organizationSchema} />
        <JsonLd data={softwareServicesSchema} />
      </head>
      <body className={`${spaceGrotesk.variable} font-sans antialiased`}>
        {/* ── Skip-to-content — first focusable element, visible on Tab ── */}
        <a href="#main-content" className="skip-to-content">
          Skip to main content
        </a>

        <Providers>
          {/* id="main-content" is the landmark anchor for the skip link.
              Individual page layouts wrap their <main> with this id. */}
          <div id="main-content">
            {children}
          </div>
        </Providers>

        {/* ── Self-hosted analytics tracker (auto pageviews + handla('event')) ── */}
        <Script
          src="/analytics.js"
          strategy="afterInteractive"
          data-endpoint={ANALYTICS_ENDPOINT}
          data-site="handla"
        />
      </body>
    </html>
  );
}
