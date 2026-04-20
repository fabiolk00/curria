---
phase: CURRIA-43-refactor-export-and-billing-pipeline-resilience
plan: "01"
subsystem: payments
tags: [billing, artifacts, jobs, vitest, resilience]
requires:
  - phase: 39-move-ats-targeting-and-artifact-work-into-async-processors
    provides: durable artifact generation handoff and pending generation resume semantics
  - phase: 40-integrate-status-flow-observability-and-stabilization
    provides: durable job status routing and correlated async observability
provides:
  - artifact-first billable export orchestration with degraded persistence success handling
  - safe billing fallback when generation-specific credit infrastructure drifts
  - durable artifact job completion without requiring a finalized resume_generation ref
affects: [artifact-generation, billing, async-jobs, session-generate-route]
tech-stack:
  added: []
  patterns:
    - artifact render, billing consumption, and resume-generation persistence are explicit ordered stages
    - completed durable artifact jobs may omit terminal resumeGenerationId when artifact metadata is already durable
    - generation-specific billing drift falls back to generic atomic credit consumption with structured warnings
key-files:
  created:
    - src/lib/jobs/processors/artifact-generation.test.ts
  modified:
    - src/lib/resume-generation/generate-billable-resume.ts
    - src/lib/resume-generation/generate-billable-resume.test.ts
    - src/lib/asaas/quota.ts
    - src/lib/asaas/quota.test.ts
    - src/lib/jobs/processors/artifact-generation.ts
    - src/app/api/session/[id]/generate/route.ts
    - src/app/api/session/[id]/generate/route.test.ts
    - src/lib/jobs/processors/shared.ts
    - src/lib/jobs/repository.ts
key-decisions:
  - "Treat successful artifact output as the primary export outcome and drop resumeGenerationId from the success payload when final persistence cannot be trusted."
  - "Keep the durable job contract brownfield-safe by allowing completed artifact jobs without a terminal result ref instead of introducing a new job result shape."
  - "Log render, billing, and persistence failures separately so operators can diagnose the broken stage without changing user-facing error wording."
patterns-established:
  - "Degraded export success is valid when generatedOutput is ready even if resume_generation completion bookkeeping failed."
  - "Generation billing fallback is limited to the existing generic atomic credit path when generation-specific RPC, table, type, or column drift is detected."
requirements-completed: [PIPE-RES-01, PIPE-TEST-01]
duration: 5min
completed: 2026-04-20
---

# Phase 43 Plan 01: Refactor export and billing pipeline resilience Summary

**Artifact-first export orchestration now preserves successful ATS files across degraded resume-generation persistence while billing still fails closed and logs the exact failing stage.**

## Performance

- **Duration:** 5 min
- **Started:** 2026-04-20T00:26:27Z
- **Completed:** 2026-04-20T00:31:10Z
- **Tasks:** 2
- **Files modified:** 10

## Accomplishments
- Refactored `generateBillableResume(...)` so render, billing, and persistence are explicit stages and late `resume_generations` completion failures no longer override a successful artifact result.
- Hardened durable artifact job handling and `/api/session/[id]/generate` so completed exports still return success when artifact metadata exists but `resumeGenerationId` cannot be finalized.
- Expanded generation-billing fallback proof and structured warnings so schema drift in generation-specific billing infrastructure degrades to the generic atomic credit path instead of skipping credit consumption.

## Task Commits

1. **Task 1: Split the export pipeline into explicit artifact, billing, and persistence stages** - `f784690` (`test`), `35f435a` (`feat`)
2. **Task 2: Harden degraded billing fallback and observability for brownfield drift** - `7a5ef4a` (`test`), `6820ed2` (`feat`)

## Files Created/Modified
- `src/lib/resume-generation/generate-billable-resume.ts` - Split the export path into explicit render, billing, and completion-persistence stages with degraded success handling.
- `src/lib/resume-generation/generate-billable-resume.test.ts` - Added regressions for degraded persistence, render-stage logging, and billing-stage failure handling.
- `src/lib/asaas/quota.ts` - Expanded generation-specific billing drift detection and logged safe fallback to generic credit consumption.
- `src/lib/asaas/quota.test.ts` - Added regression coverage for missing generation billing columns and structured fallback warnings.
- `src/lib/jobs/processors/artifact-generation.ts`, `src/lib/jobs/processors/artifact-generation.test.ts` - Allowed durable artifact jobs to complete when artifact output is ready even without a finalized resume generation row.
- `src/app/api/session/[id]/generate/route.ts`, `src/app/api/session/[id]/generate/route.test.ts` - Returned successful completed responses for durable artifact jobs that finished with ready output but no `resumeGenerationId`.
- `src/lib/jobs/processors/shared.ts`, `src/lib/jobs/repository.ts` - Relaxed completed-job result refs so the durable runtime can persist completed artifact jobs without inventing a terminal generation ref.

## Decisions Made

- Successful file generation is the source of truth for export success; `resumeGenerationId` is now optional in degraded-success responses instead of being backfilled from a stale pending row.
- The durable runtime keeps the existing job shapes and uses an omitted `terminalResultRef` for degraded artifact success, which avoids a broader async contract change.
- Stage-specific warnings are emitted for render, billing, persistence, and billing-fallback drift to make brownfield operator diagnosis explicit.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

- PowerShell path literals for `src/app/api/session/[id]/generate/*` required `-LiteralPath` during file reads because square brackets are treated specially by the shell.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- No-target ATS export now preserves artifact success under `resume_generations` drift in both synchronous orchestration and the durable job path.
- Billing fallback remains safe and explicit, and the focused export/billing regression suite is ready for future brownfield refactors.

---
*Phase: CURRIA-43-refactor-export-and-billing-pipeline-resilience*
*Completed: 2026-04-20*

## Self-Check: PASSED
