/**
 * The tenant factory pipeline — Phase 0: step contract + idempotent runner
 * skeleton. Real implementations (Supabase Management API, DNS/ACME, seeds)
 * land in Phases 1–2.
 *
 * Invariants:
 *  - Every step is IDEMPOTENT: safe to re-run; completed steps are skipped.
 *  - Every execution is fully logged to `provisioning_runs` in the control
 *    plane (step-by-step status), so a failed run heals on retry instead of
 *    duplicating resources.
 *  - Teardown (hard cancellation / PDPA erasure) is the reverse pipeline,
 *    equally automated. No tenant is ever onboarded or removed by hand.
 */

export const PROVISION_STEPS = [
  'create-datastore', //      new dedicated Supabase project / instance
  'run-migrations', //        all migrations to current version
  'seed-reference-data', //   SL tax tables, EPF/ETF rates, holiday calendars
  'configure-domain', //      {slug}.yourhr.app (+ custom domain if requested)
  'issue-certificate', //     ACME / managed cert, renewal monitored
  'set-entitlements', //      tier flags in the control plane
  'create-admin-user', //     tenant's first admin (own auth pool)
  'apply-theme', //           logo + brand CSS variables
  'mark-complete', //         status → active, hand back access
] as const;
export type ProvisionStep = (typeof PROVISION_STEPS)[number];

export interface StepResult {
  status: 'done' | 'failed';
  error?: string;
}

export interface StepContext {
  tenantId: string;
  runId: string;
  log: (msg: string) => void;
}

export type StepImpl = (ctx: StepContext) => Promise<StepResult>;

export interface StepStates {
  [step: string]: { status: 'pending' | 'done' | 'failed'; error?: string };
}

/**
 * Idempotent runner: executes steps in order, skipping any already 'done'
 * (loaded from the run's persisted state). Stops at the first failure so the
 * next attempt resumes exactly there.
 */
export async function runPipeline(
  steps: readonly string[],
  impls: Record<string, StepImpl>,
  prior: StepStates,
  ctx: StepContext,
  persist: (states: StepStates) => Promise<void>,
): Promise<{ ok: boolean; states: StepStates }> {
  const states: StepStates = { ...prior };
  for (const step of steps) {
    if (states[step]?.status === 'done') {
      ctx.log(`skip ${step} (already done)`);
      continue;
    }
    const impl = impls[step];
    if (!impl) {
      states[step] = { status: 'failed', error: 'no implementation' };
      await persist(states);
      return { ok: false, states };
    }
    ctx.log(`run ${step}`);
    try {
      const result = await impl(ctx);
      states[step] = result;
      await persist(states);
      if (result.status === 'failed') return { ok: false, states };
    } catch (e) {
      states[step] = { status: 'failed', error: e instanceof Error ? e.message : String(e) };
      await persist(states);
      return { ok: false, states };
    }
  }
  return { ok: true, states };
}
