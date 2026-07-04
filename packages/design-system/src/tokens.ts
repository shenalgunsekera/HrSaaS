/**
 * Design tokens extracted from the portfolio (D:\Shenals Portfolio).
 *
 * Two layers:
 *  1. PLATFORM tokens — fixed editorial identity (type, neutrals, spacing rhythm).
 *  2. BRAND tokens — per-tenant overridable at runtime via CSS variables
 *     (see `tenantThemeVars`). Tenants restyle within the design, never replace it.
 */

/** Fixed editorial palette (portfolio identity — not tenant-overridable). */
export const palette = {
  ink: '#FFFFFF', //   page background
  chalk: '#101016', // primary text, cool near-black
  line: '#E9E9F1', //  hairline borders / dividers
  surface: '#F7F7FB', // soft cell background
  mute1: '#4E4E60', // strong secondary text
  mute2: '#6E6E82', // secondary text
  mute3: '#9A9AAE', // faint labels
} as const;

/** Default brand (indigo) — the values tenants may override. */
export const defaultBrand = {
  brand: '#4F46E5',
  brandLight: '#818CF8',
  brandDark: '#3730A3',
  brand50: '#EEF2FF',
  brand100: '#E0E7FF',
  brand600: '#4338CA',
  /** 135deg light → brand → violet accent */
  gradientFrom: '#818CF8',
  gradientVia: '#4F46E5',
  gradientTo: '#7C3AED',
} as const;

/**
 * CSS custom property contract for per-tenant branding.
 * The app layer writes these on `:root` from the tenant's control-plane
 * theme record; every component reads only the variables.
 */
export const tenantThemeVars = {
  '--brand': defaultBrand.brand,
  '--brand-light': defaultBrand.brandLight,
  '--brand-dark': defaultBrand.brandDark,
  '--brand-50': defaultBrand.brand50,
  '--brand-100': defaultBrand.brand100,
  '--brand-600': defaultBrand.brand600,
  '--brand-gradient-from': defaultBrand.gradientFrom,
  '--brand-gradient-via': defaultBrand.gradientVia,
  '--brand-gradient-to': defaultBrand.gradientTo,
} as const;

export type TenantTheme = Partial<Record<keyof typeof tenantThemeVars, string>>;

export const typography = {
  display: '"Bebas Neue", sans-serif', //   giant condensed headlines, uppercase
  heading: '"Playfair Display", serif', //  editorial serif, often italic
  body: '"DM Sans", sans-serif', //         UI + body copy
  letterSpacing: {
    widest2: '0.3em',
    widest3: '0.5em',
  },
} as const;

export const shadows = {
  brand: '0 18px 50px -12px rgba(79,70,229,0.40)',
} as const;

export const gradients = {
  brand:
    'linear-gradient(135deg, var(--brand-gradient-from) 0%, var(--brand-gradient-via) 50%, var(--brand-gradient-to) 100%)',
  radialWash:
    'radial-gradient(1100px 520px at 78% -10%, rgba(79,70,229,0.10), transparent 60%)',
} as const;

/** Layout rhythm observed across the portfolio. */
export const layout = {
  maxWidth: '1600px',
  gridSize: '56px', // .bg-grid cell
  pagePaddingX: { base: '1.5rem', md: '3rem' },
} as const;
