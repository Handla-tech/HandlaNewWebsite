import type { Metadata, Viewport } from 'next';
import { Space_Grotesk } from 'next/font/google';
import './globals.css';
import { Providers } from '@/components/Providers';
import { JsonLd, organizationSchema, softwareServicesSchema } from '@/components/JsonLd';

// ─── Font ─────────────────────────────────────────────────────────────────────

const spaceGrotesk = Space_Grotesk({
  subsets: ['latin'],
  weight: ['300', '400', '500', '600', '700'],
  variable: '--font-space-grotesk',
  display: 'swap',
});

// ─── Metadata ─────────────────────────────────────────────────────────────────

export const metadata: Metadata = {
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
      </body>
    </html>
  );
}
