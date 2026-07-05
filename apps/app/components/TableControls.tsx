/**
 * Search + pagination for registers. GET-based so results are linkable.
 * `extra` carries page-specific params (e.g. attendance month) through both
 * the search form and the pager links.
 */
export function TableControls({
  basePath,
  q,
  page,
  hasMore,
  count,
  extra = {},
  placeholder = 'Search…',
}: {
  basePath: string;
  q: string;
  page: number;
  hasMore: boolean;
  count: number;
  extra?: Record<string, string>;
  placeholder?: string;
}) {
  const params = (p: number) => {
    const sp = new URLSearchParams({ ...extra, ...(q ? { q } : {}), ...(p > 1 ? { page: String(p) } : {}) });
    const s = sp.toString();
    return s ? `${basePath}?${s}` : basePath;
  };
  return (
    <div className="flex flex-wrap items-center gap-3 mb-3 print:hidden">
      <form method="get" action={basePath} className="flex gap-2">
        {Object.entries(extra).map(([k, v]) => (
          <input key={k} type="hidden" name={k} value={v} />
        ))}
        <input
          name="q"
          defaultValue={q}
          placeholder={placeholder}
          className="rounded-md border border-line bg-ink px-3 py-1.5 font-body text-sm text-chalk placeholder:text-mute-3 focus:outline-none focus:border-brand w-64"
        />
        <button type="submit" className="px-3 py-1.5 border border-line text-mute-1 text-sm font-medium rounded-md hover:border-brand hover:text-brand transition-colors">
          Search
        </button>
        {q && (
          <a href={params(1).replace(/([?&])q=[^&]*&?/, '$1').replace(/[?&]$/, '')} className="px-2 py-1.5 text-sm text-mute-3 hover:text-brand">
            clear
          </a>
        )}
      </form>
      <span className="ml-auto flex items-center gap-2 text-xs text-mute-2">
        <span>
          page {page} · {count} row{count === 1 ? '' : 's'}{hasMore ? '+' : ''}
        </span>
        {page > 1 && (
          <a href={params(page - 1)} className="px-2.5 py-1 border border-line rounded-md hover:border-brand hover:text-brand">
            ← Prev
          </a>
        )}
        {hasMore && (
          <a href={params(page + 1)} className="px-2.5 py-1 border border-line rounded-md hover:border-brand hover:text-brand">
            Next →
          </a>
        )}
      </span>
    </div>
  );
}
