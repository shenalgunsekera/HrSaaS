import { getTenantContext } from '../../lib/tenant';
import { withTenantDb } from '../../lib/objects';

export const dynamic = 'force-dynamic';

interface TaskRow {
  id: string;
  employee_number: string;
  full_name: string;
  emp_status: string;
  kind: string;
  task: string;
  category: string;
  done: boolean;
}

/** Onboarding & offboarding journeys — checklists spawn with hire/exit. */
export default async function LifecyclePage() {
  const ctx = await getTenantContext();
  if (!ctx) return null;
  const tasks =
    (await withTenantDb((db) =>
      db<TaskRow[]>`
        select t.id, e.employee_number, e.full_name, e.status as emp_status,
               t.kind, t.task, t.category, t.done
        from lifecycle_tasks t join employees e on e.id = t.employee_id
        order by e.employee_number, t.kind, t.display_order`,
    )) ?? [];

  const byEmployee = new Map<string, TaskRow[]>();
  for (const t of tasks) {
    const k = `${t.employee_number} · ${t.full_name} (${t.kind})`;
    byEmployee.set(k, [...(byEmployee.get(k) ?? []), t]);
  }

  return (
    <main className="relative min-h-svh">
      <div className="relative max-w-[1600px] mx-auto px-6 md:px-10 py-10">
        <p className="font-body text-xs font-semibold tracking-wider text-brand uppercase mb-4">
          Onboarding &amp; Offboarding · {ctx.slug}
        </p>
        <h1 className="text-3xl font-bold tracking-tight text-chalk mb-8">Lifecycle</h1>

        {byEmployee.size === 0 && (
          <p className="font-heading italic text-mute-3">
            Journeys appear here automatically when employees are hired or offboarded.
          </p>
        )}
        <div className="grid lg:grid-cols-2 gap-6">
          {[...byEmployee.entries()].map(([header, list]) => {
            const doneCount = list.filter((t) => t.done).length;
            return (
              <section key={header} className="rounded-lg border border-line bg-ink">
                <header className="px-5 py-3.5 border-b border-line flex items-center gap-3">
                  <span className="text-sm font-semibold text-chalk">{header}</span>
                  <span className={`ml-auto text-xs font-semibold ${doneCount === list.length ? 'text-brand' : 'text-mute-2'}`}>
                    {doneCount}/{list.length} complete
                  </span>
                </header>
                <ul>
                  {list.map((t) => (
                    <li key={t.id} className="flex items-center gap-3 px-5 py-2.5 border-b border-line last:border-b-0 hover:bg-brand-50 transition-colors">
                      <form method="post" action={`/api/lifecycle/${t.id}/toggle`}>
                        <button
                          type="submit"
                          aria-label={t.done ? 'mark incomplete' : 'mark complete'}
                          className={`h-5 w-5 rounded border text-[11px] leading-none font-bold ${
                            t.done ? 'bg-brand border-brand text-white' : 'border-line text-transparent hover:border-brand'
                          }`}
                        >
                          ✓
                        </button>
                      </form>
                      <span className={`font-body text-sm ${t.done ? 'text-mute-3 line-through' : 'text-chalk'}`}>
                        {t.task}
                      </span>
                      <span className="ml-auto font-body text-[11px] text-mute-3">{t.category}</span>
                    </li>
                  ))}
                </ul>
              </section>
            );
          })}
        </div>
      </div>
    </main>
  );
}
