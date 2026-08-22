import type { Metadata, Viewport } from 'next';
import { Space_Grotesk } from 'next/font/google';
import Script from 'next/script';
import { headers } from 'next/headers';
import './globals.css';
import { Providers } from '@/components/Providers';
import { toLocale, dirFor, type Locale } from '@/i18n/config';
// NOTE: Organization / WebSite / Services JSON-LD moved to the homepage
// (src/app/page.tsx) so those site-level entities are declared once on the
// home document rather than on every route.

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
    // Site-wide default social image (1200×630). Individual pages override
    // both the text and, where they have real artwork, the image. Resolved
    // against `metadataBase`.
    images: [
      { url: '/og-image.png', width: 1200, height: 630, alt: 'Handla' },
    ],
  },
  twitter: {
    card:  'summary_large_image',
    title: 'Handla — Software Services Platform',
    description: 'Professional software services connecting clients with expert solutions.',
    images: ['/og-image.png'],
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

/**
 * Derive the document locale from the request path (injected by middleware as
 * `x-pathname`). Public SEO pages live under /en/… or /ar/…, so the FIRST
 * segment determines <html lang/dir> at SERVER render time — Arabic pages ship
 * `lang="ar" dir="rtl"` in the initial HTML, before any JS runs.
 *
 * Non-localized routes (/, /auth, /dashboard, /erp, /profile) resolve to the
 * default locale (en / ltr); `/` is 308-redirected to `/en` by next.config.
 */
function localeFromPath(pathname: string): Locale {
  const seg = pathname.split('/').filter(Boolean)[0];
  return toLocale(seg);
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = headers().get('x-pathname') || '/';
  const locale   = localeFromPath(pathname);
  const dir      = dirFor(locale);

  return (
    <html
      lang={locale}
      dir={dir}
      // Theme (dark/light) is still applied client-side from persisted uiStore
      // via the anti-FOUC script below; suppress the resulting className diff.
      suppressHydrationWarning
    >
      <head>
        {/* Anti-FOUC: apply the persisted THEME (dark/light) before first paint
            so a light-mode user never sees a dark flash. Locale is NOT touched
            here anymore — lang/dir are already correct in the server HTML from
            the URL locale above, so this only manages the theme class. */}
        <Script id="handla-theme-init" strategy="beforeInteractive">
          {`(function(){try{var t='dark';var raw=localStorage.getItem('handla-ui');if(raw){var s=JSON.parse(raw);if(s&&s.state&&s.state.theme)t=s.state.theme;}var r=document.documentElement;r.classList.toggle('dark',t==='dark');r.classList.toggle('light',t==='light');}catch(e){document.documentElement.classList.add('dark');}})();`}
        </Script>

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
