---
phase: 04-observability-and-launch-readiness
plan: "02"
subsystem: user-facing-error-handling
tags: [documents, linkedin, dashboard, retry, copy]
requires: [04-01]
provides:
  - Actionable retryable documents-panel errors
  - Safe LinkedIn import startup and polling messages
  - Focused tests for the new user-facing failure states
affects: [phase-4-plan-03, launch-readiness, support]
tech-stack:
  added: []
  patterns:
    - Distinguish empty artifact state from temporary artifact-fetch failure
    - Translate backend import failures into safe browser-facing retry guidance
key-files:
  created:
    - src/components/dashboard/session-documents-panel.test.tsx
  modified:
    - src/hooks/use-session-documents.ts
    - src/components/dashboard/session-documents-panel.tsx
    - src/app/api/profile/extract/route.ts
    - src/app/api/profile/status/[jobId]/route.ts
    - src/components/resume/resume-builder.tsx
    - src/app/api/profile/extract/route.test.ts
    - src/app/api/profile/status/[jobId]/route.test.ts
key-decisions:
  - "Kept the file API contract unchanged and translated its failure into safer UX copy in the documents hook."
  - "Returned a compatible `errorMessage` field from the import-status route instead of exposing raw persisted backend errors."
  - "Added a retry action to the documents panel because the failure is often temporary and should not force a full page refresh."
patterns-established:
  - "Documents panel error state now renders even when there are no downloadable files yet."
  - "LinkedIn import polling prefers safe server-provided copy over hardcoded generic toasts."
requirements-completed: []
duration: 16 min
completed: 2026-04-10
---

# Phase 4 Plan 2: User-Facing Error Translation Summary

**CurrIA now distinguishes temporary launch-funnel failures from true empty states, and LinkedIn import errors are safe and actionable instead of opaque.**

## Performance

- **Duration:** 16 min
- **Completed:** 2026-04-10
- **Tasks:** 2
- **Files modified:** 8

## Accomplishments

- Fixed the documents hook so broken file fetches surface an actionable error instead of silently collapsing to “no files”.
- Added a retry affordance to the documents panel so users can recover without refreshing the whole workspace.
- Localized and hardened LinkedIn import startup and polling errors for invalid input, missing jobs, failed terminal jobs, and transient tracking failures.
- Taught the LinkedIn import UI to use the safe server-provided failure message when available.

## Files Created/Modified

- `src/hooks/use-session-documents.ts` - Stops swallowing download-url failures and translates them into safe retryable copy.
- `src/components/dashboard/session-documents-panel.tsx` - Renders the new error state and retry action.
- `src/components/dashboard/session-documents-panel.test.tsx` - Covers the visible retry path.
- `src/app/api/profile/extract/route.ts` - Returns safer localized import-start errors and keeps raw details in logs only.
- `src/app/api/profile/status/[jobId]/route.ts` - Returns safe `errorMessage` guidance for failed import jobs.
- `src/components/resume/resume-builder.tsx` - Uses the server-provided safe import failure copy during polling.
- `src/app/api/profile/extract/route.test.ts` - Updated for the new localized route copy.
- `src/app/api/profile/status/[jobId]/route.test.ts` - Updated for the new safe failure-message contract.

## Decisions Made

- Preserved the existing file and profile route shapes wherever possible, extending them compatibly instead of redesigning the client contracts.
- Kept the document-fetch UX fix inside the hook and panel rather than changing the backend response shape.
- Mapped failed LinkedIn imports to user-safe guidance about public profile visibility and retry timing instead of surfacing provider or database detail.

## Local Proof

- `npm run typecheck`
- `npm test -- src/components/dashboard/preview-panel.test.tsx src/components/dashboard/session-documents-panel.test.tsx src/components/dashboard/resume-workspace.test.tsx src/app/api/profile/extract/route.test.ts src/app/api/profile/status/[jobId]/route.test.ts`

## Next Phase Readiness

- Ready for Wave 3.
- Observability and user-facing degradation handling are now both in place, so the last step is reconciling the docs and writing the final launch handoff.

---
*Phase: 04-observability-and-launch-readiness*
*Completed: 2026-04-10*
