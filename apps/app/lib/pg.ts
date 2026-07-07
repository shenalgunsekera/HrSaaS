/** SSL for remote Postgres (Supabase); disabled for local dev containers. */
export function pgSsl(url: string): { ssl: 'require' } | Record<string, never> {
  return /localhost|127\.0\.0\.1/.test(url) ? {} : { ssl: 'require' };
}
