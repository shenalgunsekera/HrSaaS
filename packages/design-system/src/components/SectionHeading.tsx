'use client';
import type { ReactNode } from 'react';
import { Reveal } from './Reveal';

/**
 * Editorial section heading: kicker in tracked uppercase brand,
 * giant Bebas display line, optional Playfair-italic standfirst.
 */
export function SectionHeading({
  kicker,
  title,
  standfirst,
  className = '',
}: {
  kicker?: string;
  title: ReactNode;
  standfirst?: ReactNode;
  className?: string;
}) {
  return (
    <div className={className}>
      {kicker && (
        <Reveal>
          <p className="font-body text-xs tracking-widest3 text-brand uppercase mb-6">
            {kicker}
          </p>
        </Reveal>
      )}
      <Reveal delay={0.08}>
        <h2
          className="font-display text-chalk leading-[0.92]"
          style={{ fontSize: 'clamp(40px, 6vw, 88px)' }}
        >
          {title}
        </h2>
      </Reveal>
      {standfirst && (
        <Reveal delay={0.16}>
          <p className="font-heading italic text-lg md:text-2xl text-mute-1 mt-7 max-w-xl leading-relaxed">
            {standfirst}
          </p>
        </Reveal>
      )}
    </div>
  );
}
