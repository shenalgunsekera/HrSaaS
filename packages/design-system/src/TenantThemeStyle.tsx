import { tenantThemeVars, type TenantTheme } from './tokens';

/**
 * Server component: emits the tenant's brand overrides as :root CSS variables.
 * Render once in the app layout with the theme loaded from the control plane.
 * Unset keys fall back to the design-system defaults in theme.css.
 */
export function TenantThemeStyle({ theme }: { theme: TenantTheme | null | undefined }) {
  if (!theme) return null;
  const decls = Object.entries(theme)
    .filter(([k, v]) => k in tenantThemeVars && typeof v === 'string')
    .map(([k, v]) => `${k}: ${v};`)
    .join(' ');
  if (!decls) return null;
  return <style>{`:root { ${decls} }`}</style>;
}
