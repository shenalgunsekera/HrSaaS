import { readFileSync } from 'node:fs';
import path from 'node:path';
import postgres from 'postgres';

/**
 * Control-plane client for the marketing site — LEAD WRITES ONLY (prospects
 * table). Production uses a restricted connection role; local dev falls back
 * to the factory secret.
 */
function url(): string {
  const fromEnv = process.env.CONTROL_PLANE_DATABASE_URL;
  if (fromEnv) return fromEnv;
  const secret = JSON.parse(
    readFileSync(path.join(process.cwd(), '..', '..', '_secrets', 'hr-control-plane.json'), 'utf8'),
  ) as { password: string; port: number };
  return `postgres://postgres:${secret.password}@127.0.0.1:${secret.port}/postgres`;
}

declare global {
  // eslint-disable-next-line no-var
  var __mcp: ReturnType<typeof postgres> | undefined;
}

export function cp() {
  globalThis.__mcp ??= postgres(url(), { max: 2, onnotice: () => {} });
  return globalThis.__mcp;
}
