/**
 * Provisioner worker entry point.
 * Phase 1–2: attach a durable queue (e.g. pg-boss on the control-plane DB),
 * consume { tenantId, kind } jobs, and execute the matching pipeline with
 * per-step persistence to `provisioning_runs`.
 */
export { PROVISION_STEPS, runPipeline } from './pipeline';
export type { ProvisionStep, StepContext, StepImpl, StepResult, StepStates } from './pipeline';
