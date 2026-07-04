'use client';
import { Reveal } from './Reveal';

/** Hairline-bordered stat cell (portfolio hero stats strip). */
export function StatCell({
  value,
  label,
  delay = 0,
}: {
  value: string;
  label: string;
  delay?: number;
}) {
  return (
    <Reveal delay={delay} y={16} className="bg-ink">
      <div className="px-8 py-6 lg:py-7 transition-colors duration-300 hover:bg-brand-50">
        <div className="font-display text-4xl md:text-5xl text-brand">{value}</div>
        <div className="font-body text-sm text-mute-2 mt-1.5">{label}</div>
      </div>
    </Reveal>
  );
}
