/**
 * Central motion spec — the single source of the product's motion language,
 * extracted from the portfolio. Components must use these presets rather
 * than ad-hoc values so everything animates with one voice.
 */
import type { Transition, Variants } from 'framer-motion';

/** Signature ease: fast start, long soft landing (portfolio Reveal). */
export const easeOutSoft = [0.22, 1, 0.36, 1] as const;

export const durations = {
  fast: 0.3, //    hovers, small state changes
  reveal: 0.7, //  scroll reveals, page-level entrances
  slow: 1.2, //    large hero/watermark moves
  marquee: 30, //  full marquee loop
} as const;

/** Spring presets (portfolio Magnetic / Tilt). */
export const springs = {
  magnetic: { stiffness: 220, damping: 16 },
  tilt: { stiffness: 160, damping: 18 },
} as const;

export const revealTransition: Transition = {
  duration: durations.reveal,
  ease: easeOutSoft as unknown as Transition['ease'],
};

/** Fade + rise into view, once. `y` defaults to 28px like the portfolio. */
export const revealVariants = (y = 28): Variants => ({
  hidden: { opacity: 0, y },
  visible: { opacity: 1, y: 0, transition: revealTransition },
});

/** Stagger step used between sibling reveals (hero copy: 0.08s). */
export const staggerStep = 0.08;

export const staggerContainer: Variants = {
  hidden: {},
  visible: { transition: { staggerChildren: staggerStep } },
};

/** Viewport config for whileInView reveals. */
export const revealViewport = { once: true, margin: '-60px' } as const;

/** Endless gentle float: amp px over dur seconds (portfolio Floaty). */
export const floatAnimation = (amp = 10, dur = 6, delay = 0) => ({
  animate: { y: [0, -amp, 0] },
  transition: { duration: dur, delay, repeat: Infinity, ease: 'easeInOut' as const },
});

/** Parallax ratios used on hero layers (per 900px of scroll). */
export const parallax = {
  watermark: 130 / 900, //  drifts down slower than the page
  shapes: -70 / 900, //     decorative shapes drift up
} as const;

/** Defaults for interactive fx components. */
export const fxDefaults = {
  magneticStrength: 0.3,
  tiltMaxDeg: 6,
} as const;
