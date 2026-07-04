'use client';
import type { ReactNode } from 'react';
import { Tilt } from './Tilt';

/** Hairline editorial card. `tilt` adds the portfolio's cursor-follow 3D. */
export function Card({
  children,
  tilt = false,
  className = '',
}: {
  children: ReactNode;
  tilt?: boolean;
  className?: string;
}) {
  const inner = (
    <div className={`border border-line bg-ink ${className}`}>{children}</div>
  );
  return tilt ? <Tilt>{inner}</Tilt> : inner;
}
