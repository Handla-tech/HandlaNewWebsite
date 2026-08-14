'use client';

import { useRef } from 'react';
import Link from 'next/link';
import { motion, useInView } from 'framer-motion';
import { ArrowRight } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { websiteProjectApi } from '@/lib/api';
import { useTranslation } from '@/hooks/useTranslation';
import type { WebsiteProject } from '@/types';
import ProjectCard from './ProjectCard';

// ─── Static fallback (shown when no featured projects exist yet) ──────────────
const FALLBACK: WebsiteProject[] = [
  {
    id: 'fp1',
    title: 'TechFlow SaaS Platform',
    clientName: 'TechFlow',
    summary: 'A multi-tenant SaaS platform with billing, analytics and a real-time dashboard, launched in 6 weeks.',
    description: 'A multi-tenant SaaS platform with billing, analytics and a real-time dashboard.',
    category: 'SaaS',
    imageUrl: null,
    projectUrl: null,
    tags: ['Next.js', 'NestJS', 'Stripe', 'PostgreSQL'],
    featured: true,
    sortOrder: 0,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'fp2',
    title: 'RetailPro ERP',
    clientName: 'RetailPro Arabia',
    summary: 'An enterprise ERP handling 10,000+ daily transactions across inventory, sales and accounting.',
    description: 'An enterprise ERP handling 10,000+ daily transactions.',
    category: 'ERP',
    imageUrl: null,
    projectUrl: null,
    tags: ['React', 'Node.js', 'MySQL', 'Redis'],
    featured: true,
    sortOrder: 1,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'fp3',
    title: 'HealthBridge Patient Portal',
    clientName: 'HealthBridge Clinic',
    summary: 'A bilingual (Arabic-first) patient portal with appointment booking and secure records.',
    description: 'A bilingual patient portal with appointment booking and secure records.',
    category: 'Healthcare',
    imageUrl: null,
    projectUrl: null,
    tags: ['Next.js', 'RTL', 'TypeScript'],
    featured: true,
    sortOrder: 2,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
];

export default function Projects() {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: '-80px' });
  const { t } = useTranslation();

  const { data } = useQuery({
    queryKey: ['website-projects-featured'],
    queryFn: async () => {
      try {
        // 1) Prefer featured projects.
        const featuredRes = await websiteProjectApi.getAll({ page: 1, limit: 6, featured: true });
        const featured: WebsiteProject[] = featuredRes.data?.data?.projects ?? [];
        if (featured.length > 0) return featured;

        // 2) No featured ones yet — show the most recent projects instead,
        //    so content added via the ERP still surfaces on the homepage.
        const anyRes = await websiteProjectApi.getAll({ page: 1, limit: 6 });
        const any: WebsiteProject[] = anyRes.data?.data?.projects ?? [];
        return any;
      } catch {
        return [] as WebsiteProject[];
      }
    },
    staleTime: 5 * 60_000,
  });

  // Use real data whenever the API returns any projects (featured or not).
  // The hardcoded FALLBACK only shows while loading or when the DB is empty.
  const items = (data && data.length > 0) ? data : FALLBACK;

  return (
    <section
      id="projects"
      ref={ref}
      className="relative py-24 sm:py-32 overflow-hidden"
      style={{ background: 'var(--page-bg)' }}
    >
      {/* Top separator */}
      <div
        className="absolute top-0 left-0 right-0 h-px"
        style={{ background: 'linear-gradient(90deg, transparent, var(--ov-med) 30%, var(--ov-med) 70%, transparent)' }}
      />

      {/* Ambient gold glow */}
      <div
        className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[600px] h-[400px] pointer-events-none"
        style={{ background: 'radial-gradient(circle, rgba(251,191,36,0.04) 0%, transparent 70%)' }}
      />

      <div className="relative mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">

        {/* Section header */}
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6 }}
          className="text-center mb-14"
        >
          <p className="h-label mb-3">{t('projects.label')}</p>
          <h2 className="text-3xl sm:text-4xl font-extrabold text-white mb-4">
            {t('projects.title')}
          </h2>
          <p className="mx-auto max-w-2xl text-base" style={{ color: 'var(--ink-5)' }}>
            {t('projects.subtitle')}
          </p>
        </motion.div>

        {/* Featured grid */}
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {items.slice(0, 6).map((project, i) => (
            <ProjectCard key={project.id} project={project} index={i} />
          ))}
        </div>

        {/* View all button */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.5, delay: 0.3 }}
          className="mt-12 flex justify-center"
        >
          <Link
            href="/projects"
            className="group inline-flex items-center gap-2 rounded-xl px-6 py-3 text-sm font-semibold transition-all duration-200"
            style={{
              background: 'rgba(251,191,36,0.1)',
              border: '1px solid rgba(251,191,36,0.25)',
              color: '#fbbf24',
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLElement).style.background = 'rgba(251,191,36,0.16)';
              (e.currentTarget as HTMLElement).style.boxShadow = '0 0 24px rgba(251,191,36,0.18)';
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLElement).style.background = 'rgba(251,191,36,0.1)';
              (e.currentTarget as HTMLElement).style.boxShadow = 'none';
            }}
          >
            {t('projects.viewAll')}
            <ArrowRight className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-1" />
          </Link>
        </motion.div>
      </div>
    </section>
  );
}
