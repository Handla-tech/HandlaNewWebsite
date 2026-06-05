'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const ROTATING_WORDS = [
  'Real Results',
  'True Growth',
  'Your Vision',
  'Any Scale',
  'Tomorrow',
] as const;

interface AnimatedHeadlineProps {
  staticText: string;
}

export default function AnimatedHeadline({ staticText }: AnimatedHeadlineProps) {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setIndex((prev) => (prev + 1) % ROTATING_WORDS.length);
    }, 2800);
    return () => clearInterval(timer);
  }, []);

  return (
    <h1 className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-extrabold leading-tight tracking-tight text-white">
      {/* Static part */}
      <span>{staticText} </span>

      {/* Animated rotating word */}
      <span className="relative inline-block">
        <AnimatePresence mode="wait">
          <motion.span
            key={ROTATING_WORDS[index]}
            initial={{ opacity: 0, y: 40, rotateX: -30 }}
            animate={{ opacity: 1, y: 0,  rotateX: 0  }}
            exit={{   opacity: 0, y: -30, rotateX: 20  }}
            transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
            className="inline-block gradient-text"
            style={{ transformOrigin: 'center bottom' }}
          >
            {ROTATING_WORDS[index]}
          </motion.span>
        </AnimatePresence>

        {/* Glow underline */}
        <motion.span
          layoutId="headline-underline"
          className="absolute -bottom-1 left-0 right-0 h-0.5 rounded-full bg-gradient-to-r from-electric-400 via-violet-400 to-cyan-400"
          style={{ boxShadow: '0 0 12px 2px rgba(41,168,255,0.6)' }}
        />
      </span>
    </h1>
  );
}
