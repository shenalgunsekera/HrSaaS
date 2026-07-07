/**
 * Postgres client options by target.
 * Remote (Supabase): TLS on, and `prepare: false` because the Supavisor
 * transaction pooler (port 6543) used at runtime doesn't support prepared
 * statements. Local dev containers: plain, prepared statements fine.
 */
export function pgSsl(url: string): Record<string, unknown> {
  return /localhost|127\.0\.0\.1/.test(url) ? {} : { ssl: 'require', prepare: false };
}
