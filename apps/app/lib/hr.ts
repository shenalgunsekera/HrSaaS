import 'server-only';
import type postgres from 'postgres';

/** Spawn the orchestrated onboarding journey for a new employee. */
export async function spawnOnboarding(db: ReturnType<typeof postgres>, employeeId: string) {
  const tasks: Array<[string, string]> = [
    ['Collect NIC / passport copy', 'documents'],
    ['Signed employment contract on file', 'documents'],
    ['EPF/ETF registration submitted', 'statutory'],
    ['Bank account details verified', 'payroll'],
    ['Record privacy consents', 'privacy'],
    ['Issue assets (laptop, access card…)', 'assets'],
    ['System access provisioned', 'it'],
    ['Assign buddy & induction session', 'experience'],
  ];
  for (let i = 0; i < tasks.length; i++) {
    await db`insert into lifecycle_tasks (employee_id, kind, task, category, display_order)
      values (${employeeId}, 'onboarding', ${tasks[i]![0]}, ${tasks[i]![1]}, ${i})`;
  }
}
