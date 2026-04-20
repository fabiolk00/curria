---
phase: CURRIA-44-implement-credit-reservation-ledger-and-billing-reconciliati
plan: "02"
subsystem: payments
tags: [billing, reservations, ledger, reconciliation, jobs, nextjs, vitest]
requires:
  - phase: 44-01
    provides: reservation and ledger schema plus atomic reserve, finalize, and release wrappers
provides:
  - reservation-backed export orchestration for durable artifact generation
  - repo-native reconciliation for stuck or contradictory credit reservations
  - stage-aware billing diagnostics through existing file polling, job status, and dashboard consumers
affects: [artifact-generation, billing, reconciliation, dashboard-polling, operator-runbooks]
tech-stack:
  added: []
  patterns:
    - export billing now follows reserve -> render -> finalize or release keyed by generation intent
    - completed artifact jobs may finish with stage needs_reconciliation while preserving file availability
    - existing file polling surfaces now carry reconciliation hints without adding a new dashboard route
key-files:
  created:
    - src/lib/asaas/reconciliation.ts
    - src/lib/asaas/reconciliation.test.ts
  modified:
    - src/lib/resume-generation/generate-billable-resume.ts
    - src/lib/jobs/processors/artifact-generation.ts
    - src/app/api/session/[id]/generate/route.ts
    - src/app/api/file/[sessionId]/route.ts
    - src/hooks/use-session-documents.ts
    - src/components/dashboard/session-documents-panel.tsx
    - docs/billing/IMPLEMENTATION.md
    - docs/billing/OPS_RUNBOOK.md
key-decisions:
  - "Use the existing durable generation intent as the reservation identity so retries reuse the same hold instead of opening a parallel billing path."
  - "Keep artifact success authoritative for user access, then mark billing drift as needs_reconciliation instead of converting a ready export back into a failure."
  - "Expose reconciliation through the current file polling and job status surfaces with minimal additive metadata instead of building a new UI surface."
patterns-established:
  - "Artifact jobs can end in completed plus needs_reconciliation when billing repair is pending."
  - "Reconciliation is evidence-driven: terminal failed jobs release, completed ready artifacts finalize, ambiguous cases go to manual_review."
requirements-completed: [BILL-OBS-01, BILL-TEST-01]
duration: 18min
completed: 2026-04-20
---

# Phase 44 Plan 02: Reservation-backed export runtime, reconciliation, and billing diagnostics Summary

**Reservation-backed artifact export now reserves credits before render, repairs stuck holds through evidence-based reconciliation, and surfaces billing-stage drift through the existing polling and dashboard path.**

## Performance

- **Duration:** 18 min
- **Started:** 2026-04-20T04:31:00Z
- **Completed:** 2026-04-20T04:49:01Z
- **Tasks:** 3
- **Files modified:** 18

## Accomplishments
- Replaced the export runtime's post-render credit spend with reserve-before-render and finalize-or-release settlement keyed by the existing durable generation intent.
- Added a repo-native reconciliation routine that safely repairs reserved-but-terminal holds and leaves ambiguous evidence in `manual_review` instead of mutating silently.
- Extended `/api/file/[sessionId]`, the dashboard polling hook, and the documents panel so reconciliation and billing stage detail reach users and operators without widening the product surface.

## Task Commits

1. **Task 1: Rewire artifact export to reserve before render and finalize or release after outcome** - `d0fb890` (`feat`)
2. **Task 2: Add reconciliation support for stuck or contradictory reservation states** - `b5621f5` (`fix`)
3. **Task 3: Expose stage-aware billing diagnostics through existing status surfaces and docs** - `d03ad31` (`feat`)

## Files Created/Modified
- `src/lib/resume-generation/generate-billable-resume.ts` - Switched export billing to reserve, finalize, release, and reconciliation markers.
- `src/lib/resume-generation/generate-billable-resume.test.ts` - Added regression proof for reservation-backed success, release on render failure, retry reuse, and degraded finalize handling.
- `src/lib/jobs/processors/artifact-generation.ts`, `src/lib/jobs/processors/artifact-generation.test.ts` - Propagated billing stages from export orchestration into durable artifact job outcomes.
- `src/app/api/session/[id]/generate/route.ts`, `src/app/api/session/[id]/generate/route.test.ts` - Returned billing stage detail in the existing generate response without changing the route contract shape materially.
- `src/lib/asaas/reconciliation.ts`, `src/lib/asaas/reconciliation.test.ts` - Added the evidence-driven repair routine for reserved and contradictory reservation states.
- `src/lib/db/credit-reservations.ts` - Added reconciliation-oriented reservation reads and marker updates used by runtime repair paths.
- `src/lib/jobs/runtime.test.ts` - Proved durable completion preserves a `needs_reconciliation` terminal stage.
- `src/app/api/file/[sessionId]/route.ts`, `src/app/api/file/[sessionId]/route.test.ts` - Surfaced reconciliation hints and billing stages through the current artifact polling response.
- `src/app/api/jobs/[jobId]/route.test.ts` - Locked the canonical job DTO against the new reservation-backed artifact stages.
- `src/hooks/use-session-documents.ts`, `src/hooks/use-session-documents.test.tsx` - Threaded reconciliation metadata through the existing polling hook.
- `src/components/dashboard/session-documents-panel.tsx`, `src/components/dashboard/session-documents-panel.test.tsx` - Kept the PDF available while showing a reconciliation notice for ready-but-not-fully-settled exports.
- `src/types/dashboard.ts` - Extended the polling types with reconciliation metadata.
- `docs/billing/IMPLEMENTATION.md`, `docs/billing/OPS_RUNBOOK.md` - Documented the reservation lifecycle, reconciliation logic, SQL checks, and operator repair flow.

## Decisions Made

- Reused the durable generation intent as the billing idempotency key instead of inventing a second reservation identity.
- Treated ready artifacts as user-visible success even when billing finalization drifts, then surfaced the drift through `needs_reconciliation`.
- Kept stage transparency on the existing generate, file, job, hook, and documents-panel path so brownfield consumers stay aligned.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Added reservation reconciliation read/write helpers in the credit reservation repository**
- **Found during:** Task 2
- **Issue:** The new reconciliation routine needed a safe way to enumerate unresolved reservations and mark `pending` or `manual_review` outcomes; the Phase 44-01 repository only exposed single-intent reserve/finalize/release helpers.
- **Fix:** Added reconciliation-specific list and marker helpers to `src/lib/db/credit-reservations.ts`.
- **Files modified:** `src/lib/db/credit-reservations.ts`
- **Verification:** `npx vitest run src/lib/asaas/reconciliation.test.ts src/lib/jobs/runtime.test.ts`
- **Committed in:** `b5621f5`

**2. [Rule 2 - Missing Critical] Propagated reconciliation metadata through the existing dashboard polling types and consumers**
- **Found during:** Task 3
- **Issue:** Backend reconciliation detail would have been invisible to the current polling hook and documents panel, which would undermine the plan's observability requirement.
- **Fix:** Extended `DownloadUrlsResponse` and `ArtifactStatusSummary`, then wired the hook and panel to show a reconciliation notice while keeping the artifact accessible.
- **Files modified:** `src/types/dashboard.ts`, `src/hooks/use-session-documents.ts`, `src/components/dashboard/session-documents-panel.tsx`
- **Verification:** `npx vitest run "src/app/api/file/[sessionId]/route.test.ts" "src/app/api/jobs/[jobId]/route.test.ts" src/hooks/use-session-documents.test.tsx src/components/dashboard/session-documents-panel.test.tsx src/lib/resume-generation/generate-billable-resume.test.ts src/lib/asaas/reconciliation.test.ts`
- **Committed in:** `d03ad31`

---

**Total deviations:** 2 auto-fixed (1 blocking, 1 missing critical)
**Impact on plan:** Both fixes were required to make reconciliation repairable and visible through the brownfield-safe status surfaces. No scope expansion beyond correctness and observability.

## Issues Encountered

- PowerShell rejected `&&` when chaining the Task 3 vitest and typecheck commands, so verification had to run as separate commands.
- Reconciliation markers touched the real Supabase admin client during test execution until the new repository helper was mocked in `generate-billable-resume.test.ts`.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Export billing is now reservation-backed end to end, with explicit repair semantics for finalize and release drift.
- Existing polling consumers and operator docs are aligned with the new billing-stage vocabulary.
- Milestone closeout can now verify the shipped reservation model instead of relying on ad hoc billing interpretation.

## Self-Check: PASSED
