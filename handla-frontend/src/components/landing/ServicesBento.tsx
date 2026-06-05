'use client';

import { useRef } from 'react';
import { motion, useInView } from 'framer-motion';
import { Globe, BarChart3, Smartphone, Cloud, ArrowUpRight } from 'lucide-react';
import { useTranslation } from '@/hooks/useTranslation';

const containerVariants = {
  hidden:  {},
  visible: { transition: { staggerChildren: 0.1 } },
};

const cardVariants = {
  hidden:  { opacity: 0, y: 24 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.55, ease: [0.22, 1, 0.36, 1] } },
};

export default function ServicesBento() {
  const ref    = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: '-80px' });
  const { t }  = useTranslation();

  const SERVICES = [
    { icon: Globe,      title: t('services.web.title'),     desc: t('services.web.description')     },
    { icon: BarChart3,  title: t('services.erp.title'),     desc: t('services.erp.description')     },
    { icon: Smartphone, title: t('services.mobile.title'),  desc: t('services.mobile.description')  },
    { icon: Cloud,      title: t('services.hosting.title'), desc: t('services.hosting.description') },
  ];

  return (
    <section id="services" ref={ref} className="relative py-24 sm:py-32">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">

        {/* ── Section header ──────────────────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6 }}
          className="text-center mb-14"
        >
          <p className="h-label mb-3">{t('services.label')}</p>
          <h2 className="text-3xl sm:text-4xl font-extrabold text-white mb-4">
            {t('services.headline')}
          </h2>
          <p className="text-base max-w-xl mx-auto" style={{ color: '#666' }}>
            {t('services.description')}
          </p>
        </motion.div>

        {/* ── Cards grid ──────────────────────────────────────────────── */}
        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate={inView ? 'visible' : 'hidden'}
          className="grid sm:grid-cols-2 gap-4"
        >
          {SERVICES.map(({ icon: Icon, title, desc }) => (
            <motion.div
              key={title}
              variants={cardVariants}
              className="group relative rounded-2xl p-6 sm:p-8 transition-all duration-300 cursor-pointer h-card h-card-gold"
            >
              <div className="flex items-start justify-between mb-5">
                {/* Icon badge */}
                <div className="icon-badge w-11 h-11 rounded-xl">
                  <Icon className="w-5 h-5" />
                </div>
                {/* Arrow */}
                <ArrowUpRight
                  className="w-5 h-5 transition-all duration-300 group-hover:text-[#fbbf24] group-hover:translate-x-1 group-hover:-translate-y-1"
                  style={{ color: '#3a3a3a' }}
                />
              </div>

              <h3 className="text-lg font-bold text-white mb-2">{title}</h3>
              <p className="text-sm leading-relaxed" style={{ color: '#666' }}>{desc}</p>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}
