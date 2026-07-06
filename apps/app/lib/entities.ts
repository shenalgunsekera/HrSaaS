import 'server-only';
import type postgres from 'postgres';

/**
 * Entity registry — single whitelist driving CSV export (/api/export/[entity]),
 * branded printable reports (/reports/[entity]), and generic mutations
 * (/api/crud/[entity]). Nothing outside this registry is exportable or
 * mutable through the generic layer.
 *
 * `updatable` lists the ONLY columns the generic update may touch; statutory
 * and money-bearing history (payslips, settlements, runs) is never deletable.
 */
export interface EntityDef {
  label: string;
  moduleKey: string;
  query: string; // SELECT producing export/report rows (ordered, aliased)
  table?: string; // physical table for generic mutations
  updatable?: string[];
  deletable?: boolean;
}

export const ENTITIES: Record<string, EntityDef> = {
  employees: {
    label: 'Employee Register',
    moduleKey: 'employee-master',
    query: `select employee_number, full_name, email, department, designation,
      to_char(date_joined,'YYYY-MM-DD') as date_joined, employment_status,
      basic_salary, salary_grade, epf_number, etf_number, status
      from employees order by employee_number`,
    table: 'employees',
    updatable: ['full_name', 'email', 'department', 'designation', 'basic_salary', 'epf_number', 'etf_number'],
    deletable: false, // lifecycle = offboard; erasure via PDPA DSR
  },
  attendance: {
    label: 'Attendance Register',
    moduleKey: 'attendance',
    query: `select e.employee_number, e.full_name, to_char(a.day,'YYYY-MM-DD') as day,
      a.status, a.clock_in, a.clock_out, a.source
      from attendance_records a join employees e on e.id = a.employee_id
      order by a.day desc, e.employee_number limit 1000`,
    table: 'attendance_records',
    deletable: true,
  },
  leave: {
    label: 'Leave Register',
    moduleKey: 'leave',
    query: `select e.employee_number, e.full_name, l.leave_type,
      to_char(l.start_date,'YYYY-MM-DD') as start_date,
      to_char(l.end_date,'YYYY-MM-DD') as end_date, l.days, l.status, l.reason
      from leave_requests l join employees e on e.id = l.employee_id
      order by l.created_at desc limit 1000`,
    table: 'leave_requests',
    deletable: true, // pending/rejected housekeeping; approved history stays via UI policy
  },
  payslips: {
    label: 'Payslip Register',
    moduleKey: 'payroll',
    query: `select r.period, e.employee_number, e.full_name, p.gross, p.no_pay_days,
      p.no_pay_deduction, p.epf_employee, p.epf_employer, p.etf_employer, p.apit, p.net
      from payslips p join payroll_runs r on r.id = p.run_id
      join employees e on e.id = p.employee_id
      order by r.period desc, e.employee_number`,
    deletable: false,
  },
  contractors: {
    label: 'Contractor Register',
    moduleKey: 'contractor-gig',
    query: `select contractor_number, full_name, contractor_type, engagement_basis, rate,
      agency, to_char(contract_start,'YYYY-MM-DD') as contract_start,
      to_char(contract_end,'YYYY-MM-DD') as contract_end, status
      from contractors order by contractor_number`,
    table: 'contractors',
    updatable: ['full_name', 'rate', 'agency', 'status'],
    deletable: true,
  },
  advances: {
    label: 'Advances & Loans Register',
    moduleKey: 'financial-wellness',
    query: `select e.employee_number, e.full_name, a.kind, a.principal,
      a.monthly_installment, a.outstanding, a.status, a.reason
      from advances a join employees e on e.id = a.employee_id
      order by a.requested_at desc`,
    deletable: false,
  },
  consents: {
    label: 'Consent Register',
    moduleKey: 'data-privacy',
    query: `select e.employee_number, e.full_name, c.purpose,
      to_char(c.granted_at,'YYYY-MM-DD') as granted_at,
      to_char(c.withdrawn_at,'YYYY-MM-DD') as withdrawn_at
      from consents c join employees e on e.id = c.employee_id
      order by e.employee_number, c.purpose`,
    deletable: false,
  },
  dsrs: {
    label: 'Data-Subject Requests',
    moduleKey: 'data-privacy',
    query: `select e.employee_number, e.full_name, d.kind, d.status,
      to_char(d.created_at,'YYYY-MM-DD') as filed,
      to_char(d.due_at,'YYYY-MM-DD') as due,
      to_char(d.resolved_at,'YYYY-MM-DD') as resolved, d.resolution
      from data_subject_requests d join employees e on e.id = d.employee_id
      order by d.created_at desc`,
    deletable: false,
  },
  goals: {
    label: 'Goals Register',
    moduleKey: 'performance',
    query: `select e.employee_number, e.full_name, g.title, g.weight, g.progress,
      g.status, to_char(g.target_date,'YYYY-MM-DD') as target_date
      from goals g join employees e on e.id = g.employee_id
      order by e.employee_number`,
    table: 'goals',
    updatable: ['title', 'weight', 'progress', 'status'],
    deletable: true,
  },
  reviews: {
    label: 'Performance Reviews',
    moduleKey: 'performance',
    query: `select e.employee_number, e.full_name, r.period, r.self_rating,
      r.manager_rating, r.final_rating, r.status
      from performance_reviews r join employees e on e.id = r.employee_id
      order by r.period desc, e.employee_number`,
    deletable: false,
  },
  courses: {
    label: 'Course Catalogue',
    moduleKey: 'training',
    query: `select title, category, mandatory, duration_hours, validity_months from courses order by title`,
    table: 'courses',
    updatable: ['title', 'category', 'mandatory', 'validity_months'],
    deletable: true,
  },
  enrollments: {
    label: 'Training Enrollments',
    moduleKey: 'training',
    query: `select e.employee_number, e.full_name, c.title, en.status, en.score,
      to_char(en.completed_at,'YYYY-MM-DD') as completed,
      to_char(en.expires_at,'YYYY-MM-DD') as cert_expires
      from enrollments en join courses c on c.id = en.course_id
      join employees e on e.id = en.employee_id
      order by en.completed_at desc nulls first`,
    table: 'enrollments',
    deletable: true,
  },
  vacancies: {
    label: 'Vacancies',
    moduleKey: 'recruitment',
    query: `select title, department, employment_type, headcount, status,
      to_char(created_at,'YYYY-MM-DD') as opened from vacancies order by created_at desc`,
    table: 'vacancies',
    updatable: ['title', 'department', 'headcount', 'status'],
    deletable: true,
  },
  candidates: {
    label: 'Candidate Pipeline',
    moduleKey: 'recruitment',
    query: `select v.title as vacancy, c.full_name, c.email, c.phone, c.source, c.status
      from candidates c join vacancies v on v.id = c.vacancy_id
      order by v.title, c.created_at`,
    table: 'candidates',
    deletable: true,
  },
  bands: {
    label: 'Salary Bands',
    moduleKey: 'compensation',
    query: `select grade, band_min, band_mid, band_max from salary_bands order by band_mid`,
    deletable: false, // referenced by employees.salary_grade
  },
  settlements: {
    label: 'Final Settlements',
    moduleKey: 'employee-master',
    query: `select e.employee_number, e.full_name, to_char(s.last_day,'YYYY-MM-DD') as last_day,
      s.reason, s.completed_years, s.last_basic, s.gratuity
      from final_settlements s join employees e on e.id = s.employee_id
      order by s.created_at desc`,
    deletable: false,
  },
  'competency-gaps': {
    label: 'Competency Gap Analysis',
    moduleKey: 'competency',
    query: `select e.employee_number, e.full_name, e.designation, c.name as competency,
      c.category, r.required_level as required, a.level as actual,
      (r.required_level - coalesce(a.level, 0)) as gap
      from employees e
      join competency_requirements r on r.designation = e.designation
      join competencies c on c.id = r.competency_id
      left join competency_assessments a on a.competency_id = c.id and a.employee_id = e.id
      where e.status = 'active'
      order by gap desc, e.employee_number`,
    deletable: false,
  },
  surveys: {
    label: 'Pulse Surveys',
    moduleKey: 'experience-engagement',
    query: `select s.question, s.anonymous, to_char(s.created_at,'YYYY-MM-DD') as launched,
      to_char(s.closed_at,'YYYY-MM-DD') as closed, count(r.id)::int as responses,
      count(r.id) filter (where r.score >= 9)::int as promoters,
      count(r.id) filter (where r.score <= 6)::int as detractors
      from surveys s left join survey_responses r on r.survey_id = s.id
      group by s.id order by s.created_at desc`,
    deletable: false,
  },
};

export function toCsv(rows: Record<string, unknown>[]): string {
  if (rows.length === 0) return '';
  const cols = Object.keys(rows[0]!);
  const esc = (v: unknown) =>
    v == null ? '' : `"${String(v).replace(/"/g, '""')}"`;
  return [
    cols.join(','),
    ...rows.map((r) => cols.map((c) => esc(r[c])).join(',')),
  ].join('\r\n');
}

export async function runEntityQuery(
  db: ReturnType<typeof postgres>,
  def: EntityDef,
): Promise<Record<string, unknown>[]> {
  return (await db.unsafe(def.query)) as unknown as Record<string, unknown>[];
}
