/**
 * Module registry + tier matrix, transcribed VERBATIM from
 * `HR_System_Feature_Sheets_v5` (page 1). The feature sheet is the single
 * source of truth — do not edit gating here without a sheet revision.
 *
 * `minTier` = lowest level at which the module is included.
 */
export const TIERS = ['L1', 'L2', 'L3', 'L4', 'L5'] as const;
export type Tier = (typeof TIERS)[number];

export interface ModuleDef {
  key: string;
  label: string;
  minTier: Tier;
}

export const MODULES = [
  // L1 — foundation
  { key: 'employee-master', label: 'Employee Master', minTier: 'L1' },
  { key: 'attendance', label: 'Attendance', minTier: 'L1' },
  { key: 'leave', label: 'Leave', minTier: 'L1' },
  { key: 'payroll', label: 'Payroll', minTier: 'L1' },
  { key: 'data-privacy', label: 'Data Privacy & Consent', minTier: 'L1' },
  { key: 'contractor-gig', label: 'Contractor & Gig Workforce', minTier: 'L1' },
  { key: 'financial-wellness', label: 'Employee Financial Wellness', minTier: 'L1' },
  { key: 'integrations', label: 'Integrations & API Marketplace', minTier: 'L1' },
  // L2
  { key: 'recruitment', label: 'Recruitment', minTier: 'L2' },
  { key: 'performance', label: 'Performance', minTier: 'L2' },
  { key: 'training', label: 'Training', minTier: 'L2' },
  { key: 'compensation', label: 'Compensation & Total Rewards', minTier: 'L2' },
  { key: 'experience-engagement', label: 'Employee Experience & Engagement', minTier: 'L2' },
  // L3
  { key: 'succession', label: 'Succession', minTier: 'L3' },
  { key: 'competency', label: 'Competency', minTier: 'L3' },
  { key: 'skills-intelligence', label: 'Skills Intelligence & Talent Marketplace', minTier: 'L3' },
  { key: 'workforce-planning', label: 'Workforce Planning & Org Design', minTier: 'L3' },
  { key: 'multi-entity-payroll', label: 'Multi-Entity / Multi-Country Payroll', minTier: 'L3' },
  // L4
  { key: 'hr-analytics', label: 'HR Analytics', minTier: 'L4' },
  // L5
  { key: 'ai-assistant', label: 'AI Assistant & Agent Orchestration', minTier: 'L5' },
] as const satisfies readonly ModuleDef[];

export type ModuleKey = (typeof MODULES)[number]['key'];
