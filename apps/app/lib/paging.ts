import 'server-only';

export const PAGE_SIZE = 20;

export interface Paging {
  q: string;
  like: string;
  page: number;
  offset: number;
  pageSize: number;
}

/** Parse ?q=&page= consistently across every register. */
export function parsePaging(sp: { q?: string; page?: string }): Paging {
  const q = (sp.q ?? '').trim().slice(0, 80);
  const page = Math.max(1, Number.parseInt(sp.page ?? '1', 10) || 1);
  return { q, like: `%${q}%`, page, offset: (page - 1) * PAGE_SIZE, pageSize: PAGE_SIZE };
}

/** Trim a pageSize+1 result set and report whether a next page exists. */
export function pageSlice<T>(rows: T[], pageSize = PAGE_SIZE): { rows: T[]; hasMore: boolean } {
  return { rows: rows.slice(0, pageSize), hasMore: rows.length > pageSize };
}
