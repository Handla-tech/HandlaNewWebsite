'use client';

import { useRef } from 'react';
import { motion, useInView } from 'framer-motion';
import Link from 'next/link';
import { ArrowRight, MessageSquare, ExternalLink } from 'lucide-react';
import BlurredChatPreview from '@/components/chat/BlurredChatPreview';
import { useAuthStore } from '@/store/authStore';
import { useTranslation } from '@/hooks/useTranslation';

// ── Social links ──────────────────────────────────────────────────────────────
const SOCIALS = [
  { label: 'Facebook',  href: '#', color: '#1877F2', bg: 'rgba(24,119,242,0.08)',  hoverBorder: 'rgba(24,119,242,0.3)'  },
  { label: 'TikTok',   href: '#', color: '#ffffff', bg: 'rgba(255,255,255,0.04)', hoverBorder: 'rgba(255,255,255,0.2)' },
  { label: 'Instagram', href: '#', color: '#E1306C', bg: 'rgba(225,48,108,0.08)', hoverBorder: 'rgba(225,48,108,0.3)'  },
  { label: 'X',        href: '#', color: '#ffffff', bg: 'rgba(255,255,255,0.04)', hoverBorder: 'rgba(255,255,255,0.2)' },
  { label: 'YouTube',  href: '#', color: '#FF0000', bg: 'rgba(255,0,0,0.08)',     hoverBorder: 'rgba(255,0,0,0.3)'     },
  { label: 'LinkedIn', href: '#', color: '#0A66C2', bg: 'rgba(10,102,194,0.08)', hoverBorder: 'rgba(10,102,194,0.3)'  },
];

// ── Social icons (SVG) ────────────────────────────────────────────────────────
function SocialIcon({ label }: { label: string }) {
  switch (label) {
    case 'Facebook':
      return <svg viewBox="0 0 24 24" className="w-5 h-5 fill-current"><path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z"/></svg>;
    case 'TikTok':
      return <svg viewBox="0 0 24 24" className="w-5 h-5 fill-current"><path d="M9 12a4 4 0 1 0 4 4V4a5 5 0 0 0 5 5"/></svg>;
    case 'Instagram':
      return <svg viewBox="0 0 24 24" className="w-5 h-5 fill-none stroke-current stroke-2 stroke-linecap-round stroke-linejoin-round"><rect x="2" y="2" width="20" height="20" rx="5" ry="5"/><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"/><line x1="17.5" y1="6.5" x2="17.51" y2="6.5"/></svg>;
    case 'X':
      return <svg viewBox="0 0 24 24" className="w-5 h-5 fill-current"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>;
    case 'YouTube':
      return <svg viewBox="0 0 24 24" className="w-5 h-5 fill-current"><path d="M22.54 6.42a2.78 2.78 0 0 0-1.94-1.96C18.88 4 12 4 12 4s-6.88 0-8.6.46a2.78 2.78 0 0 0-1.94 1.96A29 29 0 0 0 1 12a29 29 0 0 0 .46 5.58A2.78 2.78 0 0 0 3.4 19.54C5.12 20 12 20 12 20s6.88 0 8.6-.46a2.78 2.78 0 0 0 1.94-1.96A29 29 0 0 0 23 12a29 29 0 0 0-.46-5.58z"/><polygon points="9.75 15.02 15.5 12 9.75 8.98 9.75 15.02" fill="#0a0a0a"/></svg>;
    case 'LinkedIn':
      return <svg viewBox="0 0 24 24" className="w-5 h-5 fill-current"><path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6zM2 9h4v12H2zM4 6a2 2 0 1 0 0-4 2 2 0 0 0 0 4z"/></svg>;
    default:
      return null;
  }
}

export default function Contact() {
  const ref    = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: '-80px' });
  const { t }  = useTranslation();

  const { isLoggedIn, user } = useAuthStore();
  const isClient = isLoggedIn && user?.role === 'CLIENT';
  const isAdmin  = isLoggedIn && user?.role === 'ADMIN';

  const containerVariants = {
    hidden:  {},
    visible: { transition: { staggerChildren: 0.1 } },
  };
  const itemVariants = {
    hidden:  { opacity: 0, y: 24 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.55, ease: [0.22, 1, 0.36, 1] } },
  };

  return (
    <section
      id="contact"
      ref={ref}
      className="relative py-20 sm:py-24 overflow-hidden"
      style={{ background: '#080808' }}
    >
      {/* Top separator */}
      <div
        className="absolute top-0 left-0 right-0 h-px"
        style={{ background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.06) 30%, rgba(255,255,255,0.06) 70%, transparent)' }}
      />

      {/* Ambient glows */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div
          className="absolute -top-32 left-1/3 h-72 w-72 rounded-full"
          style={{ background: 'rgba(251,191,36,0.04)', filter: 'blur(80px)' }}
        />
        <div
          className="absolute bottom-0 right-1/4 h-64 w-64 rounded-full"
          style={{ background: 'rgba(96,165,250,0.03)', filter: 'blur(80px)' }}
        />
      </div>

      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">

        {/* ── Section header ────────────────────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6 }}
          className="text-center mb-10"
        >
          <p className="h-label mb-2">{t('contact.label')}</p>
          <h2 className="text-2xl sm:text-3xl font-extrabold text-white mb-3">
            {isLoggedIn ? t('contact.headlineAuth') : t('contact.headlineGuest')}
          </h2>
          <p className="text-base max-w-xl mx-auto" style={{ color: '#666' }}>
            {isLoggedIn ? t('contact.subtitleAuth') : t('contact.subtitleGuest')}
          </p>
        </motion.div>

        {/* ── Two-panel layout ──────────────────────────────────────────── */}
        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate={inView ? 'visible' : 'hidden'}
          className="grid lg:grid-cols-2 gap-5"
        >

          {/* ── Left: Chat widget ─────────────────────────────────────────── */}
          <motion.div variants={itemVariants}>
            {isLoggedIn ? (
              <motion.div
                key="authenticated-chat"
                initial={{ opacity: 0, scale: 0.97 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.4 }}
                className="rounded-2xl overflow-hidden flex flex-col"
                style={{
                  background: 'linear-gradient(145deg, #0d0d0d 0%, #0a0a0a 100%)',
                  border: '1px solid rgba(251,191,36,0.12)',
                  boxShadow: '0 0 40px rgba(251,191,36,0.04)',
                  minHeight: '280px',
                }}
              >
                {/* Gold top accent */}
                <div
                  className="h-px"
                  style={{ background: 'linear-gradient(90deg, transparent, rgba(251,191,36,0.4), transparent)' }}
                />

                <BlurredChatPreview
                  isAuthenticated={true}
                  userName={user?.name}
                />

                <div
                  className="px-5 py-5"
                  style={{
                    borderTop: '1px solid rgba(255,255,255,0.05)',
                    background: 'rgba(251,191,36,0.01)',
                  }}
                >
                  {isAdmin ? (
                    <Link
                      href="/erp"
                      className="group w-full flex items-center justify-center gap-3 px-6 py-3.5 rounded-xl font-semibold text-sm transition-all duration-200 hover:scale-[1.02]"
                      style={{
                        background: 'rgba(251,191,36,0.1)',
                        border: '1px solid rgba(251,191,36,0.25)',
                        color: '#fbbf24',
                        boxShadow: '0 0 24px rgba(251,191,36,0.08)',
                      }}
                    >
                      <MessageSquare className="w-4 h-4" />
                      {t('contact.goToAdminPanel')}
                      <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                    </Link>
                  ) : (
                    <Link
                      href="/dashboard"
                      className="group w-full flex items-center justify-center gap-3 px-6 py-3.5 rounded-xl font-semibold text-sm transition-all duration-200 hover:scale-[1.02]"
                      style={{
                        background: 'rgba(251,191,36,0.1)',
                        border: '1px solid rgba(251,191,36,0.25)',
                        color: '#fbbf24',
                        boxShadow: '0 0 24px rgba(251,191,36,0.08)',
                      }}
                    >
                      <MessageSquare className="w-4 h-4" />
                      {t('contact.goToChat')}
                      <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                    </Link>
                  )}
                  <p className="text-center text-xs mt-3" style={{ color: '#555' }}>
                    {isAdmin ? t('contact.adminSubtitle') : t('contact.clientSubtitle')}
                  </p>
                </div>
              </motion.div>
            ) : (
              <motion.div
                key="unauthenticated-chat"
                initial={{ opacity: 0, scale: 0.97 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.4 }}
              >
                <BlurredChatPreview isAuthenticated={false} />
              </motion.div>
            )}
          </motion.div>

          {/* ── Right: Social panel ──────────────────────────────────────── */}
          <motion.div
            variants={itemVariants}
            className="rounded-2xl overflow-hidden flex flex-col"
            style={{
              background: 'linear-gradient(145deg, #0d0d0d 0%, #0a0a0a 100%)',
              border: '1px solid rgba(255,255,255,0.06)',
              minHeight: '280px',
            }}
          >
            {/* Gold top accent */}
            <div
              className="h-px flex-shrink-0"
              style={{ background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.08), transparent)' }}
            />

            <div className="p-5 sm:p-6 flex flex-col flex-1">
              <div className="mb-5">
                <h3 className="text-lg font-bold text-white mb-1">{t('contact.followUs')}</h3>
                <p className="text-sm" style={{ color: '#555' }}>
                  {t('contact.followSubtitle')}
                </p>
              </div>

              {/* Social grid */}
              <div className="grid grid-cols-3 gap-2.5 flex-1">
                {SOCIALS.map(({ label, href, color, bg, hoverBorder }) => (
                  <a
                    key={label}
                    href={href}
                    className="flex flex-col items-center justify-center gap-2 rounded-xl p-3 transition-all duration-200 group"
                    style={{
                      background: bg,
                      border: '1px solid rgba(255,255,255,0.05)',
                    }}
                    onMouseEnter={(e) => {
                      (e.currentTarget as HTMLElement).style.borderColor = hoverBorder;
                      (e.currentTarget as HTMLElement).style.transform = 'scale(1.04)';
                      (e.currentTarget as HTMLElement).style.boxShadow = `0 0 16px ${color}15`;
                    }}
                    onMouseLeave={(e) => {
                      (e.currentTarget as HTMLElement).style.borderColor = 'rgba(255,255,255,0.05)';
                      (e.currentTarget as HTMLElement).style.transform = 'scale(1)';
                      (e.currentTarget as HTMLElement).style.boxShadow = 'none';
                    }}
                  >
                    <span style={{ color }} className="transition-transform duration-200">
                      <SocialIcon label={label} />
                    </span>
                    <span className="text-xs font-medium" style={{ color: '#666' }}>{label}</span>
                  </a>
                ))}
              </div>

              {/* Authenticated quick link */}
              {isLoggedIn && (
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.5 }}
                  className="mt-4 rounded-xl p-4 flex items-center gap-3"
                  style={{
                    background: 'rgba(251,191,36,0.04)',
                    border: '1px solid rgba(251,191,36,0.12)',
                  }}
                >
                  <div
                    className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                    style={{ background: 'rgba(251,191,36,0.1)' }}
                  >
                    <MessageSquare className="w-4 h-4" style={{ color: '#fbbf24' }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-white truncate">
                      {isAdmin ? t('contact.adminPanel') : t('contact.myChat')}
                    </p>
                    <p className="text-xs truncate" style={{ color: '#555' }}>
                      {isAdmin ? t('contact.manageConversations') : t('contact.continueConversation')}
                    </p>
                  </div>
                  <Link
                    href={isAdmin ? '/erp' : '/dashboard'}
                    className="flex-shrink-0 flex items-center gap-1 text-xs font-semibold transition-colors hover:opacity-80"
                    style={{ color: '#fbbf24' }}
                  >
                    {t('contact.open')}
                    <ArrowRight className="w-3 h-3" />
                  </Link>
                </motion.div>
              )}

              {!isLoggedIn && (
                <p className="text-xs mt-5" style={{ color: '#3a3a3a' }}>
                  {t('contact.communityNote')}
                </p>
              )}
            </div>
          </motion.div>

        </motion.div>
      </div>
    </section>
  );
}
