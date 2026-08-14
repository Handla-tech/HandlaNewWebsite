import dynamic from 'next/dynamic';
import Navbar       from '@/components/landing/Navbar';
import Hero          from '@/components/landing/Hero';
import About         from '@/components/landing/About';
import ServicesBento from '@/components/landing/ServicesBento';
import Process       from '@/components/landing/Process';
import Footer        from '@/components/landing/Footer';

// ── Client-only sections ──────────────────────────────────────────────────────
//  Testimonials — uses useQuery (requires QueryClientProvider context)
//  Contact      — uses client state (message input, social interaction)

const Projects = dynamic(
  () => import('@/components/landing/Projects'),
  {
    ssr: false,
    loading: () => (
      <section className="py-24 flex items-center justify-center">
        <div
          className="w-8 h-8 rounded-full border-2 border-t-transparent animate-spin"
          style={{ borderColor: '#fbbf24', borderTopColor: 'transparent' }}
        />
      </section>
    ),
  },
);

const Products = dynamic(
  () => import('@/components/landing/Products'),
  {
    ssr: false,
    loading: () => (
      <section className="py-24 flex items-center justify-center">
        <div
          className="w-8 h-8 rounded-full border-2 border-t-transparent animate-spin"
          style={{ borderColor: '#fbbf24', borderTopColor: 'transparent' }}
        />
      </section>
    ),
  },
);

const Testimonials = dynamic(
  () => import('@/components/landing/Testimonials'),
  {
    ssr: false,
    loading: () => (
      <section className="py-24 flex items-center justify-center">
        <div
          className="w-8 h-8 rounded-full border-2 border-t-transparent animate-spin"
          style={{ borderColor: '#fbbf24', borderTopColor: 'transparent' }}
        />
      </section>
    ),
  },
);

const Contact = dynamic(
  () => import('@/components/landing/Contact'),
  { ssr: false, loading: () => <section className="py-24" /> },
);

// ─── Page ──────────────────────────────────────────────────────────────────────
export default function LandingPage() {
  return (
    <div className="min-h-screen" style={{ backgroundColor: '#0a0a0a', color: '#fff' }}>
      {/* ── Navigation ───────────────────────────────────────────────── */}
      <Navbar />

      {/* ── Main content ─────────────────────────────────────────────── */}
      <main>
        {/* 1. Hero — animated headline, 2-col layout, dashboard illustration */}
        <Hero />

        {/* 2. About — stats bar + company story */}
        <About />

        {/* 3. Services — 4 service cards */}
        <ServicesBento />

        {/* 4. Process — 4-step Discover → Design → Build → Launch */}
        <Process />

        {/* 5. Projects — featured website portfolio + "View all projects" (client-only, API fetch) */}
        <Projects />

        {/* 6. Products — ready-made products showcase, ERP-driven (client-only, API fetch) */}
        <Products />

        {/* 7. Testimonials — client stories carousel (client-only, API fetch) */}
        <Testimonials />

        {/* 8. Contact — live chat widget + social media links */}
        <Contact />
      </main>

      {/* ── Footer ───────────────────────────────────────────────────── */}
      <Footer />
    </div>
  );
}
