'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
import { Lock, ArrowRight, Sparkles, MessageSquare } from 'lucide-react';
import { useTranslation } from '@/hooks/useTranslation';

const MOCK_MESSAGES = [
  { id: 1, role: 'client', text: 'Hi! I need help building a custom ERP system for my logistics company.',       time: '10:32' },
  { id: 2, role: 'admin',  text: "Hi! I'd be happy to help. Could you tell me more about your current workflow?", time: '10:33' },
  { id: 3, role: 'client', text: "We manage 50 trucks and need real-time tracking, billing, and reporting.",       time: '10:34' },
  { id: 4, role: 'admin',  text: "That's a great use case for our transport ERP solution. Let me walk you through our process…", time: '10:35' },
  { id: 5, role: 'client', text: 'Sounds perfect! What would the timeline look like?',                            time: '10:36' },
] as const;

interface BlurredChatPreviewProps {
  isAuthenticated?: boolean;
  userName?: string;
}

export default function BlurredChatPreview({ isAuthenticated = false, userName }: BlurredChatPreviewProps) {
  const { t } = useTranslation();

  return (
    <div className="relative rounded-2xl overflow-hidden" style={{ background: '#111111', border: '1px solid #1e1e1e' }}>

      {/* ── Chat header ── */}
      <div className="flex items-center gap-3 px-5 py-3.5 border-b border-white/10" style={{ background: 'rgba(255,255,255,0.02)' }}>
        <div className="w-9 h-9 rounded-full bg-gradient-to-br from-[#fbbf24] to-[#f59e0b] flex items-center justify-center text-black text-sm font-bold flex-shrink-0">
          H
        </div>
        <div>
          <div className="text-sm font-semibold text-white">{t('chat.handlaSupport')}</div>
          <div className="flex items-center gap-1.5">
            <div className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
            <span className="text-xs text-gray-400">{t('chat.onlineNow')}</span>
          </div>
        </div>

        {/* Authenticated greeting badge */}
        {isAuthenticated && (
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.2 }}
            className="ml-auto flex items-center gap-1.5 px-2.5 py-1 rounded-full"
            style={{ background: 'rgba(251,191,36,0.1)', border: '1px solid rgba(251,191,36,0.25)' }}
          >
            <Sparkles className="w-3 h-3" style={{ color: '#fbbf24' }} />
            <span className="text-[10px] font-medium" style={{ color: '#fbbf24' }}>
              {userName ? `Hi, ${userName.split(' ')[0]}!` : 'Signed in'}
            </span>
          </motion.div>
        )}
      </div>

      {/* ── Messages area with blur overlay ── */}
      <div className="px-4 py-4 space-y-3 min-h-[300px] relative">
        {/* Mock messages — always rendered, blurred behind overlay */}
        {MOCK_MESSAGES.map(({ id, role, text, time }) => (
          <div key={id} className={`flex ${role === 'admin' ? 'justify-start' : 'justify-end'}`}>
            <div
              className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-sm ${
                role === 'admin'
                  ? 'bg-white/10 text-gray-200 rounded-tl-none'
                  : 'rounded-tr-none border'
              }`}
              style={role === 'client' ? {
                background: 'rgba(251,191,36,0.1)',
                borderColor: 'rgba(251,191,36,0.25)',
                color: '#fef3c7',
              } : {}}
            >
              <p>{text}</p>
              <p className="text-[10px] text-gray-500 mt-1 text-right">{time}</p>
            </div>
          </div>
        ))}

        {/* ── Blur overlay ── */}
        <div
          className="absolute inset-0 flex items-center justify-center"
          style={{ backdropFilter: 'blur(12px)', background: 'rgba(10,10,10,0.60)' }}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.92, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ delay: 0.15, duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
            className="flex flex-col items-center gap-3 text-center px-6 py-8 rounded-2xl w-[80%] max-w-[320px]"
            style={{
              background: 'rgba(20,20,20,0.95)',
              border: '1px solid rgba(255,255,255,0.07)',
              boxShadow: '0 24px 60px rgba(0,0,0,0.6)',
            }}
          >
            {/* ── NON-AUTHENTICATED ── */}
            {!isAuthenticated && (
              <>
                {/* Lock icon */}
                <div
                  className="w-14 h-14 rounded-2xl flex items-center justify-center mb-1"
                  style={{ background: 'rgba(251,191,36,0.12)', border: '1px solid rgba(251,191,36,0.2)' }}
                >
                  <Lock className="w-6 h-6" style={{ color: '#fbbf24' }} />
                </div>

                {/* Title */}
                <p className="text-white font-bold text-base leading-tight">
                  {t('chat.blurTitle')}
                </p>

                {/* Subtitle */}
                <p className="text-gray-400 text-xs max-w-[220px] leading-relaxed">
                  {t('chat.blurSubtitle')}
                </p>

                {/* Sign In — yellow filled button */}
                <Link
                  href="/auth?callbackUrl=/dashboard"
                  className="w-full flex items-center justify-center gap-2 px-5 py-3 rounded-xl text-sm font-bold transition-all duration-200 hover:brightness-110 active:scale-[0.98]"
                  style={{
                    background: '#fbbf24',
                    color: '#0a0a0a',
                  }}
                >
                  {t('chat.blurSignIn')}
                </Link>

                {/* Create Free Account — ghost/text button */}
                <Link
                  href="/auth?mode=signup"
                  className="text-sm font-semibold text-white hover:text-[#fbbf24] transition-colors"
                >
                  {t('chat.blurCreateAccount')}
                </Link>
              </>
            )}

            {/* ── AUTHENTICATED ── */}
            {isAuthenticated && (
              <>
                <p className="text-white font-bold text-base">
                  {t('chat.blurReady')}
                </p>
                <p className="text-gray-400 text-xs max-w-[220px] leading-relaxed">
                  {t('chat.blurReadySubtitle')}
                </p>
                <Link
                  href="/dashboard"
                  className="group w-full flex items-center justify-center gap-2 px-5 py-3 rounded-xl text-sm font-bold transition-all duration-200 hover:scale-[1.02]"
                  style={{
                    background: '#fbbf24',
                    color: '#0a0a0a',
                  }}
                >
                  <MessageSquare className="w-4 h-4" />
                  {t('chat.blurGoToChat')}
                  <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
                </Link>
              </>
            )}
          </motion.div>
        </div>
      </div>

      {/* ── Disabled input bar ── */}
      <div className="flex items-center gap-3 px-4 py-3 border-t border-white/10 opacity-40 pointer-events-none select-none" style={{ background: 'rgba(255,255,255,0.02)' }}>
        <div className="flex-1 bg-white/5 rounded-xl px-4 py-2.5 text-sm text-gray-500">
          {isAuthenticated ? t('chat.blurInputAuth') : t('chat.blurInputGuest')}
        </div>
        <button
          className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
          style={{ background: 'rgba(251,191,36,0.15)' }}
          disabled
        >
          <ArrowRight className="w-4 h-4" style={{ color: '#fbbf24' }} />
        </button>
      </div>
    </div>
  );
}
