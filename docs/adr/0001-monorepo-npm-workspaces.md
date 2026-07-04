# ADR-0001: Monorepo via npm workspaces (no build orchestrator yet)

**Status:** Accepted · 2026-07-04

## Decision
Single monorepo with npm workspaces (`apps/*`, `packages/*`, `services/*`).
Shared logic lives only in `packages/`; no business logic duplicated between apps.
No Turborepo/Nx yet.

## Rationale
- Enforces non-negotiable #1 (one codebase) structurally.
- npm ships with Node 22; zero extra tooling to learn or break on Windows.
- With 3 apps + 6 packages, plain `--workspaces` scripts are fast enough.

## Consequences
- Revisit when CI build times or task graphs warrant it; Turborepo drops in
  without restructuring (scripts are already per-workspace).
