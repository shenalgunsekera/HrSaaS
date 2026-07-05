import { canUseModule } from '@hr/entitlements';
import { getTenantContext } from '../../lib/tenant';
import { withTenantDb } from '../../lib/objects';
import { ExportBar } from '../../components/ExportBar';

export const dynamic = 'force-dynamic';

const input =
  'rounded-md border border-line bg-ink px-3 py-2 font-body text-sm text-chalk placeholder:text-mute-3 focus:outline-none focus:border-brand';

/** Training (L2): catalogue, enrollments, certifications, mandatory compliance. */
export default async function TrainingPage() {
  const ctx = await getTenantContext();
  if (!ctx) return null;
  if (!canUseModule(ctx.entitlements, 'training')) {
    return (
      <main className="min-h-svh flex items-center justify-center px-6">
        <p className="font-body text-sm text-mute-2 max-w-md text-center">
          Training is available from level L2. Your company runs {ctx.tier}.
        </p>
      </main>
    );
  }

  const data = await withTenantDb(async (db) => {
    const employees = await db<{ employee_number: string; full_name: string }[]>`
      select employee_number, full_name from employees where status='active' order by employee_number`;
    const courses = await db<
      { id: string; title: string; category: string; mandatory: boolean;
        duration_hours: string | null; validity_months: number | null }[]
    >`select id, title, category, mandatory, duration_hours, validity_months
      from courses order by mandatory desc, title`;
    const enrollments = await db<
      { id: string; title: string; employee_number: string; full_name: string; status: string;
        score: number | null; expires_at: string | null; expiring: boolean }[]
    >`select en.id, c.title, e.employee_number, e.full_name, en.status, en.score,
        to_char(en.expires_at,'YYYY-MM-DD') as expires_at,
        (en.status = 'completed' and en.expires_at is not null
         and en.expires_at <= current_date + interval '60 days') as expiring
      from enrollments en
      join courses c on c.id = en.course_id
      join employees e on e.id = en.employee_id
      order by en.completed_at desc nulls first`;
    const [compliance] = await db<[{ pct: string | null }]>`
      select round(100.0 * count(*) filter (where en.status = 'completed')
             / nullif(count(*), 0), 0)::text as pct
      from employees e
      cross join courses c
      left join enrollments en on en.employee_id = e.id and en.course_id = c.id
      where e.status = 'active' and c.mandatory`;
    return { employees, courses, enrollments, compliance };
  });

  return (
    <main className="relative min-h-svh">
      <div className="relative max-w-[1600px] mx-auto px-6 md:px-10 py-10">
        <p className="font-body text-xs font-semibold tracking-wider text-brand uppercase mb-4">
          Training · {ctx.slug}
        </p>
        <div className="flex flex-wrap items-center gap-4 mb-8">
          <h1 className="text-3xl font-bold tracking-tight text-chalk">Training</h1>
          <ExportBar entity="enrollments" />
        </div>

        <div className="grid grid-cols-3 gap-px bg-line border border-line mb-8">
          {[
            { k: String(data!.courses.length), v: 'Courses in catalogue' },
            { k: data!.compliance.pct ? `${data!.compliance.pct}%` : '—', v: 'Mandatory training compliance' },
            { k: String(data!.enrollments.filter((e) => e.expiring).length), v: 'Certificates expiring ≤60 days' },
          ].map((s) => (
            <div key={s.v} className="bg-ink px-6 py-5 hover:bg-brand-50 transition-colors">
              <div className="text-2xl font-bold text-brand">{s.k}</div>
              <div className="font-body text-xs text-mute-2 mt-1">{s.v}</div>
            </div>
          ))}
        </div>

        <div className="grid lg:grid-cols-2 gap-6 mb-8">
          <form method="post" action="/api/training" className="flex flex-wrap items-end gap-3 rounded-lg border border-line bg-surface p-5">
            <input type="hidden" name="op" value="course" />
            <label className="flex flex-col gap-1 font-body text-xs font-medium text-mute-1">
              Course title
              <input name="title" required placeholder="Fire & Safety Induction" className={input} />
            </label>
            <label className="flex flex-col gap-1 font-body text-xs font-medium text-mute-1">
              Category
              <input name="category" placeholder="compliance" className={`${input} w-32`} />
            </label>
            <label className="flex flex-col gap-1 font-body text-xs font-medium text-mute-1">
              Validity (months)
              <input name="validityMonths" type="number" min={1} className={`${input} w-24`} />
            </label>
            <label className="flex items-center gap-2 font-body text-xs font-medium text-mute-1 pb-2.5">
              <input type="checkbox" name="mandatory" /> mandatory
            </label>
            <button type="submit" className="px-4 py-2.5 bg-brand text-white text-sm font-semibold rounded-md shadow-sm hover:bg-brand-600 transition-colors">
              Add course
            </button>
          </form>

          <form method="post" action="/api/training" className="flex flex-wrap items-end gap-3 rounded-lg border border-line bg-surface p-5">
            <input type="hidden" name="op" value="enroll" />
            <label className="flex flex-col gap-1 font-body text-xs font-medium text-mute-1">
              Course
              <select name="courseId" className={input}>
                {data!.courses.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}
              </select>
            </label>
            <label className="flex flex-col gap-1 font-body text-xs font-medium text-mute-1">
              Employee
              <select name="employeeNumber" className={input}>
                {data!.employees.map((e) => (
                  <option key={e.employee_number} value={e.employee_number}>{e.employee_number} · {e.full_name}</option>
                ))}
              </select>
            </label>
            <button type="submit" className="px-4 py-2.5 border border-brand text-brand text-sm font-medium rounded-md hover:bg-brand hover:text-white transition-colors">
              Enroll
            </button>
          </form>
        </div>

        <div className="rounded-lg border border-line overflow-x-auto">
          <table className="w-full font-body text-sm">
            <thead>
              <tr className="border-b border-line bg-surface text-left">
                {['Employee', 'Course', 'Status', 'Score', 'Cert expires', ''].map((h, i) => (
                  <th key={i} className="px-5 py-3 font-body text-xs font-semibold text-mute-2">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data!.enrollments.length === 0 && (
                <tr><td colSpan={6} className="px-5 py-6 font-heading italic text-mute-3">No enrollments yet.</td></tr>
              )}
              {data!.enrollments.map((en) => (
                <tr key={en.id} className="border-b border-line last:border-b-0 hover:bg-brand-50 transition-colors">
                  <td className="px-5 py-3 font-semibold">{en.full_name} <span className="text-mute-3">{en.employee_number}</span></td>
                  <td className="px-5 py-3">{en.title}</td>
                  <td className={`px-5 py-3 font-semibold ${
                    en.status === 'completed' ? 'text-brand' : en.status === 'failed' ? 'text-red-600' : 'text-amber-600'
                  }`}>{en.status}</td>
                  <td className="px-5 py-3">{en.score ?? '—'}</td>
                  <td className={`px-5 py-3 ${en.expiring ? 'text-red-600 font-semibold' : 'text-mute-2'}`}>
                    {en.expires_at ?? '—'}{en.expiring ? ' · EXPIRING' : ''}
                  </td>
                  <td className="px-5 py-3">
                    {en.status === 'enrolled' && (
                      <form method="post" action="/api/training" className="flex gap-1.5">
                        <input type="hidden" name="op" value="complete" />
                        <input type="hidden" name="enrollmentId" value={en.id} />
                        <input name="score" type="number" min={0} max={100} placeholder="score" className="w-16 rounded border border-line bg-ink px-1.5 py-1 text-xs" />
                        <button type="submit" className="px-2.5 py-1 text-xs font-medium rounded border border-brand text-brand hover:bg-brand hover:text-white">
                          assess
                        </button>
                      </form>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </main>
  );
}
