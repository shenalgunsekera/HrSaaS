'use client';
import { motion, useReducedMotion } from 'framer-motion';
import type { ReactNode } from 'react';

/** Gentle endless float. Wrap anything to make it drift up and down. */
export function Floaty({
  children,
  className = '',
  amp = 10,
  dur = 6,
  delay = 0,
}: {
  children: ReactNode;
  className?: string;
  amp?: number;
  dur?: number;
  delay?: number;
}) {
  const reduce = useReducedMotion();
  if (reduce) return <div className={className}>{children}</div>;
  return (
    <motion.div
      className={className}
      animate={{ y: [0, -amp, 0] }}
      transition={{ duration: dur, delay, repeat: Infinity, ease: 'easeInOut' }}
    >
      {children}
    </motion.div>
  );
}
