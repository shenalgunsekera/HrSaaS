'use client';
import type { ButtonHTMLAttributes, AnchorHTMLAttributes, ReactNode } from 'react';
import { Magnetic } from './Magnetic';

const base =
  'inline-flex items-center justify-center font-display text-base tracking-widest uppercase transition-colors px-8 py-4';

const variants = {
  primary: `${base} bg-brand-gradient text-white shadow-brand`,
  outline: `${base} border border-brand text-brand hover:bg-brand hover:text-white`,
  ghost: `${base} text-mute-1 hover:text-brand`,
} as const;

export type ButtonVariant = keyof typeof variants;

type CommonProps = {
  variant?: ButtonVariant;
  magnetic?: boolean;
  className?: string;
  children: ReactNode;
};

export function Button({
  variant = 'primary',
  magnetic = true,
  className = '',
  children,
  ...rest
}: CommonProps & ButtonHTMLAttributes<HTMLButtonElement>) {
  const btn = (
    <button className={`${variants[variant]} ${className}`} {...rest}>
      {children}
    </button>
  );
  return magnetic ? <Magnetic>{btn}</Magnetic> : btn;
}

export function ButtonLink({
  variant = 'primary',
  magnetic = true,
  className = '',
  children,
  ...rest
}: CommonProps & AnchorHTMLAttributes<HTMLAnchorElement>) {
  const link = (
    <a className={`${variants[variant]} ${className}`} {...rest}>
      {children}
    </a>
  );
  return magnetic ? <Magnetic>{link}</Magnetic> : link;
}
