'use client';
import { motion } from 'framer-motion';
import type { ReactNode } from 'react';
import { durations, easeOutSoft, revealViewport } from '../motion';

/** Subtle scroll-reveal: fades + rises into view once. */
export function Reveal({
  children,
  delay = 0,
  y = 28,
  className = '',
}: {
  children: ReactNode;
  delay?: number;
  y?: number;
  className?: string;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={revealViewport}
      transition={{ duration: durations.reveal, delay, ease: [...easeOutSoft] }}
      className={className}
    >
      {children}
    </motion.div>
  );
}
