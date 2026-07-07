import { readFileSync } from 'node:fs';
import path from 'node:path';
import postgres from 'postgres';

/**
 * Control-plane client for the admin console (server-only).
 * Production: CONTROL_PLANE_DATABASE_URL from the environment/vault.
 * Local dev fallback: the factory's _secrets/hr-control-plane.json.
 */
function url(): string {
  const fromEnv = process.env.CONTROL_PLANE_DATABASE_URL;
  if (fromEnv) return fromEnv;
  try {
    const secret = JSON.parse(
      readFileSync(
        path.join(process.cwd(), '..', '..', '_secrets', 'hr-control-plane.json'),
        'utf8',
      ),
    ) as { password: string; port: number };
    return `postgres://postgres:${secret.password}@127.0.0.1:${secret.port}/postgres`;
  } catch {
    throw new Error(
      'No control plane configured: set CONTROL_PLANE_DATABASE_URL or provision locally first.',
    );
  }
}

declare global {
  // eslint-disable-next-line no-var
  var __cp: ReturnType<typeof postgres> | undefined;
}

export function cp() {
  const u = url();
  const remote = !/localhost|127\.0\.0\.1/.test(u);
  globalThis.__cp ??= postgres(u, {
    max: 3,
    onnotice: () => {},
    ...(remote ? { ssl: 'require' as const, prepare: false } : {}),
  });
  return globalThis.__cp;
}
