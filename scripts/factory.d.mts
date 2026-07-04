/** Type declarations for factory.mjs (consumed by apps/admin and the worker). */
export function enqueueProvision(
  cp: unknown,
  opts: {
    slug: string;
    name?: string;
    tier: string;
    brand?: string | null;
    logoUrl?: string | null;
    port?: number;
    adminEmail?: string;
  },
): Promise<{ tenantId: string; runId: string }>;

export function themeFromBrand(
  hex: string | null,
): { colors: Record<string, string> } | null;

export function defaultPort(slug: string): number;

export function executeRun(
  cp: unknown,
  cpInfo: { password: string; port: number },
  runId: string,
  log?: (msg: string) => void,
): Promise<{ ok: boolean; url: string; appPort: number }>;
