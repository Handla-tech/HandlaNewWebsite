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
            className="inline-block"
            style={{
              transformOrigin: 'center bottom',
              background: 'linear-gradient(135deg, #fbbf24 0%, #f59e0b 50%, #fbbf24 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
              textShadow: 'none',
              filter: 'drop-shadow(0 0 20px rgba(251,191,36,0.3))',
            }}
          >
            {ROTATING_WORDS[index]}
          </motion.span>
        </AnimatePresence>

        {/* Animated gold underline */}
        <motion.span
          className="absolute -bottom-1 left-0 right-0 h-0.5 rounded-full"
          style={{
            background: 'linear-gradient(90deg, rgba(251,191,36,0.2) 0%, #fbbf24 50%, rgba(251,191,36,0.2) 100%)',
            boxShadow: '0 0 10px 1px rgba(251,191,36,0.5)',
          }}
          animate={{
            scaleX: [0.8, 1, 0.8],
            opacity: [0.7, 1, 0.7],
          }}
          transition={{ duration: 2.8, repeat: Infinity, ease: 'easeInOut' }}
        />
      </span>
    </h1>
  );
}
