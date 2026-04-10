---
phase: 03-billing-settlement-validation
plan: "01"
subsystem: billing-validation
tags: [asaas, staging, webhook, psql, tooling, docs]
requires: []
provides:
  - Committed staging replay helper for named billing scenarios
  - Committed staging billing snapshot helper for evidence capture
  - Aligned staging setup and billing runbook docs for Phase 3
affects: [phase-3-plan-02, phase-3-plan-03, staging-validation, billing-ops]
tech-stack:
  added: []
  patterns:
    - Env-file-driven staging replay helper with dry-run support
    - psql-backed JSON snapshot helper for billing evidence
key-files:
  created:
    - scripts/replay-staging-asaas.ts
    - scripts/check-staging-billing-state.ts
  modified:
    - scripts/verify-staging.sh
    - scripts/README.md
    - docs/staging/SETUP_GUIDE.md
    - docs/staging/VALIDATION_PLAN.md
    - docs/billing/OPS_RUNBOOK.md
key-decisions:
  - "Used fetch plus an env-file loader for webhook replay so the helper stays repo-local and does not depend on curl semantics outside the bash preflight."
  - "Used psql-backed JSON snapshots instead of introducing a new database client dependency just for staging evidence capture."
  - "Kept the externalReference drift explicit in docs and helper flags instead of silently choosing one shape before staging proves it."
patterns-established:
  - "Phase 3 operator flow starts with bash scripts/verify-staging.sh, then npx tsx helper commands for replay and snapshots."
  - "Replay commands can emit either curria:v1:c:<checkout> or curria:v1:u:<user>:c:<checkout> so staging can validate the current contract."
requirements-completed: []
duration: 39 min
completed: 2026-04-10
---

# Phase 3 Plan 1: Staging Billing Toolkit Summary

**CurrIA now has committed staging replay and billing snapshot tooling, plus aligned operator docs for the settlement-validation wave.**

## Performance

- **Duration:** 39 min
- **Started:** 2026-04-10T05:18:00Z
- **Completed:** 2026-04-10T05:57:00Z
- **Tasks:** 2
- **Files modified:** 8

## Accomplishments

- Added a named-scenario replay helper for Asaas webhook validation with dry-run and artifact output support.
- Added a billing snapshot helper that captures `billing_checkouts`, `credit_accounts`, `user_quotas`, and `processed_events` through `psql`.
- Aligned the staging setup guide, validation plan, scripts README, and billing ops runbook around the same Phase 3 operator flow.
- Hardened `scripts/verify-staging.sh` with explicit shell-tool checks before any live staging attempt.

## Files Created/Modified

- `scripts/replay-staging-asaas.ts` - Named replay helper for the seven committed Phase 3 scenarios.
- `scripts/check-staging-billing-state.ts` - `psql`-backed JSON snapshot helper for billing evidence capture.
- `scripts/verify-staging.sh` - Adds required shell-tool checks and points operators to the committed Phase 3 helpers after preflight.
- `scripts/README.md` - Documents the new replay and snapshot helpers plus their proof commands.
- `docs/staging/SETUP_GUIDE.md` - Adds workstation prerequisites, helper-command validation, and a concrete evidence workflow.
- `docs/staging/VALIDATION_PLAN.md` - Adds helper commands, scenario command templates, and an explicit note about the current `externalReference` contract drift.
- `docs/billing/OPS_RUNBOOK.md` - Routes operators through the committed helper flow before ad hoc SQL or manual replay.

## Decisions Made

- Used `npx tsx` in operator-facing docs because direct `tsx` is not reliably present on PowerShell PATH in this environment.
- Left billing logic unchanged in Wave 1 and treated the checkout `externalReference` mismatch as a staging-validation question, not a speculative code fix.
- Kept the snapshot helper dependency-free by shelling out to `psql`, which matches the existing staging preflight contract.

## Deviations from Plan

- No code-scope deviation. The implementation stayed within the Wave 1 files and goals.
- Verification used `npx tsx` instead of bare `tsx` because that is what works portably in this environment.

## Issues Encountered

- This workstation does not expose `tsx` directly on PATH from PowerShell, so docs and verification commands were normalized to `npx tsx`.
- Live staging prerequisites are still absent here (`bash`, `.env.staging`, and `psql`), which blocks Wave 2 even though the Wave 1 tooling is complete.

## Local Proof

- `npm run typecheck`
- `npm test -- src/lib/asaas/event-handlers.test.ts src/app/api/webhook/asaas/route.test.ts src/lib/asaas/credit-grants.test.ts src/lib/asaas/quota.test.ts src/app/api/checkout/route.test.ts`
- `npx tsx scripts/replay-staging-asaas.ts --list-scenarios`
- `npx tsx scripts/check-staging-billing-state.ts --help`

## User Setup Required

External services and staging access are still required before live execution:

- create `.env.staging` from `.env.staging.example`
- run from Bash (WSL, Git Bash, or similar) with `psql` and a real `curl` binary available
- provide staging API and database access plus Asaas sandbox credentials

## Next Phase Readiness

- Ready for Wave 2 from a machine that has staging access and the required shell tools.
- The replay helper and snapshot helper are committed, documented, and locally verifiable.
- Live validation is still blocked in this environment until `.env.staging`, Bash, and `psql` are available.

---
*Phase: 03-billing-settlement-validation*
*Completed: 2026-04-10*
