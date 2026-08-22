'use client';

import { useRef } from 'react';
import Link from 'next/link';
import { motion, useInView } from 'framer-motion';
import { ArrowRight, ArrowUpRight, FolderGit2 } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { websiteProjectApi } from '@/lib/api';
import { useTranslation } from '@/hooks/useTranslation';
import { useLocalizedHref } from '@/hooks/useLocalizedHref';
import type { WebsiteProject } from '@/types';
import ProjectCard from './ProjectCard';

// ── Branded placeholder visual (used when a project has no image) ────────────
function BrandedVisual({ label }: { label?: string | null }) {
  return (
    <div
      className="relative flex h-full w-full items-center justify-center overflow-hidden"
      style={{ background: 'linear-gradient(135deg, var(--surface-3) 0%, var(--surface-1) 100%)' }}
    >
      {/* Subtle grid */}
      <div
        className="absolute inset-0 opacity-[0.4]"
        style={{
          backgroundImage:
            'linear-gradient(var(--ov-soft) 1px, transparent 1px), linear-gradient(90deg, var(--ov-soft) 1px, transparent 1px)',
          backgroundSize: '32px 32px',
        }}
      />
      <div
        className="absolute -top-16 left-1/2 h-56 w-56 -translate-x-1/2 rounded-full pointer-events-none"
        style={{ background: 'radial-gradient(circle, rgba(251,191,36,0.10) 0%, transparent 70%)' }}
      />
      <div className="relative flex flex-col items-center gap-3">
        <div
          className="flex h-14 w-14 items-center justify-center rounded-2xl"
          style={{ background: 'rgba(251,191,36,0.1)', border: '1px solid rgba(251,191,36,0.22)' }}
        >
          <FolderGit2 className="h-6 w-6" style={{ color: '#fbbf24' }} />
        </div>
        <span className="font-mono text-sm font-bold tracking-tight">
          <span className="text-white">&lt;Handla </span>
          <span style={{ color: '#fbbf24' }}>/</span>
          <span className="text-white">&gt;</span>
        </span>
        {label && (
          <span className="text-xs font-medium" style={{ color: 'var(--ink-5)' }}>{label}</span>
        )}
      </div>
    </div>
  );
}

// ── Featured project — large side-by-side layout for a single project ────────
function FeaturedProject({ project }: { project: WebsiteProject }) {
  const body = (
    <div
      className="group grid overflow-hidden rounded-2xl lg:grid-cols-2 h-card h-card-interactive"
      style={{ boxShadow: 'var(--shadow-md)' }}
    >
      {/* Visual */}
      <div className="relative min-h-[240px] overflow-hidden lg:min-h-[380px]">
        {project.imageUrl ? (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            src={project.imageUrl}
            alt={project.title}
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
            loading="lazy"
          />
        ) : (
          <BrandedVisual label={project.category} />
        )}
        {project.category && (
          <span
            className="absolute left-4 top-4 rounded-full px-3 py-1 text-[10px] font-semibold uppercase tracking-wider"
            style={{ background: 'rgba(0,0,0,0.55)', color: '#fbbf24', backdropFilter: 'blur(6px)' }}
          >
            {project.category}
          </span>
        )}
      </div>

      {/* Info */}
      <div className="flex flex-col justify-center gap-4 p-7 sm:p-9">
        {project.clientName && (
          <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--ink-5)' }}>
            {project.clientName}
          </span>
        )}
        <h3 className="text-2xl font-extrabold leading-tight text-white sm:text-3xl">
          {project.title}
        </h3>
        <p className="text-base leading-relaxed" style={{ color: 'var(--ink-3)' }}>
          {project.summary || project.description}
        </p>

        {project.tags && project.tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5 pt-1">
            {project.tags.slice(0, 5).map((tag) => (
              <span
                key={tag}
                className="rounded-md px-2.5 py-1 text-xs font-medium"
                style={{ background: 'var(--ov-soft)', color: 'var(--ink-3)', border: '1px solid var(--ov-med)' }}
              >
                {tag}
              </span>
            ))}
          </div>
        )}

        <div
          className="mt-2 inline-flex items-center gap-1.5 text-sm font-semibold transition-colors"
          style={{ color: '#fbbf24' }}
        >
          View Project
          <ArrowUpRight className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
        </div>
      </div>
    </div>
  );

  if (project.projectUrl) {
    return (
      <a href={project.projectUrl} target="_blank" rel="noopener noreferrer" aria-label={`${project.title} — open project`}>
        {body}
      </a>
    );
  }
  return body;
}

// NOTE: No hardcoded fallback projects. The homepage projects section renders
// ONLY genuine, admin-managed records from the Website Projects API/DB. When the
// API is empty the section shows a truthful empty state — we never substitute
// fabricated portfolio entries.

export default function Projects() {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: '-80px' });
  const { t } = useTranslation();
  const lh = useLocalizedHref();

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

  // Genuine, admin-managed Website Projects only.
  // Empty API -> truthful empty state (handled below); never fabricated cards.
  const items = (data && data.length > 0) ? data : [];

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
          <h2 className="h-heading mb-4">
            {t('projects.title')}
          </h2>
          <p className="h-intro mx-auto max-w-2xl">
            {t('projects.subtitle')}
          </p>
        </motion.div>

        {/* Layout adapts to project count:
            1 → large featured layout · 2 → two-up · 3+ → responsive grid. */}
        {items.length === 1 ? (
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={inView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.6, delay: 0.1 }}
          >
            <FeaturedProject project={items[0]} />
          </motion.div>
        ) : (
          <div
            className={`grid gap-6 ${
              items.length === 2 ? 'sm:grid-cols-2' : 'sm:grid-cols-2 lg:grid-cols-3'
            }`}
          >
            {items.slice(0, 6).map((project, i) => (
              <ProjectCard key={project.id} project={project} index={i} />
            ))}
          </div>
        )}

        {/* View all button */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.5, delay: 0.3 }}
          className="mt-12 flex justify-center"
        >
          <Link
            href={lh('/projects')}
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
