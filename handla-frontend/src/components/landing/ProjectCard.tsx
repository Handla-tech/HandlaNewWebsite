'use client';

import { motion } from 'framer-motion';
import { ArrowUpRight, FolderGit2 } from 'lucide-react';
import type { WebsiteProject } from '@/types';

/**
 * ProjectCard — shared card used by the landing "Projects" featured section
 * and the public /projects page. Purely presentational.
 */
export default function ProjectCard({
  project,
  index = 0,
}: {
  project: WebsiteProject;
  index?: number;
}) {
  const CardInner = (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-60px' }}
      transition={{ duration: 0.5, delay: Math.min(index * 0.08, 0.4) }}
      whileHover={{ y: -6 }}
      className="group relative flex h-full flex-col overflow-hidden rounded-2xl"
      style={{
        background: 'var(--surface-1)',
        border: '1px solid var(--ov-med)',
        boxShadow: 'var(--shadow-card)',
      }}
      onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.boxShadow = 'var(--shadow-md)'; }}
      onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.boxShadow = 'var(--shadow-card)'; }}
    >
      {/* Gold top accent on hover */}
      <div
        className="absolute top-0 left-0 right-0 h-px opacity-0 transition-opacity duration-300 group-hover:opacity-100"
        style={{ background: 'linear-gradient(90deg, transparent, rgba(251,191,36,0.5), transparent)' }}
      />

      {/* Cover image */}
      <div className="relative aspect-[16/10] w-full overflow-hidden" style={{ background: 'var(--ov-soft)' }}>
        {project.imageUrl ? (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            src={project.imageUrl}
            alt={project.title}
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
            loading="lazy"
            onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
          />
        ) : (
          <div
            className="relative flex h-full w-full flex-col items-center justify-center gap-2"
            style={{ background: 'linear-gradient(135deg, var(--surface-3) 0%, var(--surface-1) 100%)' }}
          >
            <div
              className="absolute inset-0 opacity-[0.4]"
              style={{
                backgroundImage:
                  'linear-gradient(var(--ov-soft) 1px, transparent 1px), linear-gradient(90deg, var(--ov-soft) 1px, transparent 1px)',
                backgroundSize: '24px 24px',
              }}
            />
            <div
              className="relative flex h-11 w-11 items-center justify-center rounded-xl"
              style={{ background: 'rgba(251,191,36,0.1)', border: '1px solid rgba(251,191,36,0.22)' }}
            >
              <FolderGit2 className="h-5 w-5" style={{ color: '#fbbf24' }} />
            </div>
            <span className="relative font-mono text-xs font-bold tracking-tight">
              <span className="text-white">&lt;Handla </span>
              <span style={{ color: '#fbbf24' }}>/</span>
              <span className="text-white">&gt;</span>
            </span>
          </div>
        )}

        {/* Category chip */}
        {project.category && (
          <span
            className="absolute left-3 top-3 rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider"
            style={{ background: 'rgba(0,0,0,0.6)', color: '#fbbf24', backdropFilter: 'blur(6px)' }}
          >
            {project.category}
          </span>
        )}

        {/* Featured badge */}
        {project.featured && (
          <span
            className="absolute right-3 top-3 rounded-full px-2.5 py-1 text-[10px] font-semibold"
            style={{ background: 'rgba(251,191,36,0.15)', color: '#fbbf24', border: '1px solid rgba(251,191,36,0.3)', backdropFilter: 'blur(6px)' }}
          >
            Featured
          </span>
        )}
      </div>

      {/* Body */}
      <div className="flex flex-1 flex-col p-5">
        <div className="flex items-start justify-between gap-2">
          <h3 className="text-base font-bold text-white group-hover:text-[#fbbf24] transition-colors">
            {project.title}
          </h3>
          {project.projectUrl && (
            <ArrowUpRight
              className="h-4 w-4 flex-shrink-0 opacity-0 transition-all duration-300 group-hover:opacity-100 group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
              style={{ color: '#fbbf24' }}
            />
          )}
        </div>

        {project.clientName && (
          <p className="mt-0.5 text-xs font-medium" style={{ color: 'var(--ink-5)' }}>
            {project.clientName}
          </p>
        )}

        <p className="mt-2 line-clamp-3 text-sm leading-relaxed" style={{ color: 'var(--ink-3)' }}>
          {project.summary || project.description}
        </p>

        {/* Tags */}
        {project.tags && project.tags.length > 0 && (
          <div className="mt-auto flex flex-wrap gap-1.5 pt-4">
            {project.tags.slice(0, 4).map((tag) => (
              <span
                key={tag}
                className="rounded-md px-2 py-0.5 text-[10px] font-medium"
                style={{ background: 'var(--ov-soft)', color: 'var(--ink-3)', border: '1px solid var(--ov-med)' }}
              >
                {tag}
              </span>
            ))}
          </div>
        )}
      </div>
    </motion.div>
  );

  // Wrap in an external link when a project URL is present.
  if (project.projectUrl) {
    return (
      <a
        href={project.projectUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="block h-full"
        aria-label={`${project.title} — open project`}
      >
        {CardInner}
      </a>
    );
  }
  return CardInner;
}
