'use client';

/**
 * ClientLandingSections — client-only, lazily-loaded landing sections.
 *
 * Why this file exists (Next.js 15 upgrade):
 *   Next.js 15 forbids `dynamic(() => import(...), { ssr: false })` inside a
 *   *Server* Component. The public landing page (`/[locale]/page.tsx`) is a
 *   Server Component (it runs `await params`, emits JSON-LD, etc.), so the
 *   four API-driven, client-only sections that must NOT be server-rendered
 *   (Projects, Products, Testimonials, Contact) can no longer be declared
 *   there. They are moved here, into a Client Component, which is the
 *   officially-supported pattern. Behaviour is byte-for-byte preserved:
 *   same `ssr: false`, same per-section spinner, same SectionErrorBoundary
 *   isolation, same render order.
 */

import dynamic from 'next/dynamic';
import SectionErrorBoundary from '@/components/landing/SectionErrorBoundary';

const Spinner = () => (
  <section className="py-24 flex items-center justify-center">
    <div
      className="w-8 h-8 rounded-full border-2 border-t-transparent animate-spin"
      style={{ borderColor: '#fbbf24', borderTopColor: 'transparent' }}
    />
  </section>
);

// ── Client-only sections (API-driven) — must never be server-rendered ─────────
const Projects = dynamic(() => import('@/components/landing/Projects'), {
  ssr: false,
  loading: () => <Spinner />,
});
const Products = dynamic(() => import('@/components/landing/Products'), {
  ssr: false,
  loading: () => <Spinner />,
});
const Testimonials = dynamic(() => import('@/components/landing/Testimonials'), {
  ssr: false,
  loading: () => <Spinner />,
});
const Contact = dynamic(() => import('@/components/landing/Contact'), {
  ssr: false,
  loading: () => <section className="py-24" />,
});

export default function ClientLandingSections() {
  return (
    <>
      <SectionErrorBoundary name="Projects"><Projects /></SectionErrorBoundary>
      <SectionErrorBoundary name="Products"><Products /></SectionErrorBoundary>
      <SectionErrorBoundary name="Testimonials"><Testimonials /></SectionErrorBoundary>
      <SectionErrorBoundary name="Contact"><Contact /></SectionErrorBoundary>
    </>
  );
}
