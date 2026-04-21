---
phase: 55-brownfield-route-consolidation-and-repo-topology-alignment
plan: 01
subsystem: api
tags: [nextjs, vitest, route-architecture, comparison, preview-lock]
requires:
  - phase: 48-route-policy-extraction-and-decision-normalization
    provides: route-layer context/decision/response pattern for sensitive handlers
  - phase: 49-hardening-the-route-decision-architecture
    provides: regression-first extraction rules for thin route adapters
provides:
  - typed auth and ownership boundary for the dashboard comparison route
  - extracted comparison decision seam preserving preview-aware scoring behavior
  - extracted comparison response seam preserving existing HTTP contract
affects: [dashboard-comparison, route-governance, preview-lock, compare-semantics]
tech-stack:
  added: []
  patterns: [thin-route-adapter, typed-route-context, normalized-route-decision]
key-files:
  created:
    - src/lib/routes/session-comparison/context.ts
    - src/lib/routes/session-comparison/types.ts
    - src/lib/routes/session-comparison/decision.ts
    - src/lib/routes/session-comparison/response.ts
    - src/lib/routes/session-comparison/decision.test.ts
    - src/lib/routes/session-comparison/response.test.ts
  modified:
    - src/app/api/session/[id]/compare/route.ts
    - src/app/api/session/[id]/comparison/route.ts
    - src/app/api/session/[id]/comparison/route.test.ts
key-decisions:
  - "POST /api/session/[id]/compare remains the canonical compare seam for future compare semantics."
  - "GET /api/session/[id]/comparison remains public and compatibility-only, with callers left unchanged."
  - "Preview-lock sanitization stays in the comparison decision layer before resume text or scoring is built."
patterns-established:
  - "Compatibility routes can use the same context/decision/response split without being merged into canonical route modules."
  - "Comparison response mapping only consumes normalized decision unions and does not reinterpret route semantics."
requirements-completed: [ROUTE-CONS-01, ROUTE-CONS-TEST-01]
duration: 8 min
completed: 2026-04-21
---

# Phase 55 Plan 01: Brownfield Route Consolidation And Repo Topology Alignment Summary

**Dashboard comparison now runs through dedicated context, decision, and response seams while POST `/compare` remains the canonical compare ownership path**

## Performance

- **Duration:** 8 min
- **Started:** 2026-04-21T00:43:00Z
- **Completed:** 2026-04-21T00:51:12Z
- **Tasks:** 2
- **Files modified:** 10

## Accomplishments

- Added explicit canonical-versus-compatibility ownership comments to `compare` and `comparison`.
- Extracted `GET /api/session/[id]/comparison` auth, ownership, decision, and response seams without changing its public contract.
- Added regression coverage for unauthorized, not-found, no-optimized, locked-preview, fallback scoring, and internal-error branches.

## Task Commits

Each task was committed atomically:

1. **Task 1: Freeze compare ownership and define comparison route contracts** - `282d7c7` (feat)
2. **Task 2 RED: Extract comparison semantics into decision and response seams with regression proof** - `c19248f` (test)
3. **Task 2 GREEN: Extract comparison semantics into decision and response seams with regression proof** - `db0742a` (feat)

## Files Created/Modified

- `src/app/api/session/[id]/compare/route.ts` - Declares canonical compare ownership in code comments.
- `src/app/api/session/[id]/comparison/route.ts` - Thin GET adapter over comparison context, decision, and response modules.
- `src/app/api/session/[id]/comparison/route.test.ts` - Route-level regression coverage for compatibility behavior.
- `src/lib/routes/session-comparison/context.ts` - Auth and ownership boundary using `getCurrentAppUser()` and `getSession()`.
- `src/lib/routes/session-comparison/types.ts` - Typed context and normalized decision contracts for the compatibility route.
- `src/lib/routes/session-comparison/decision.ts` - Preview-aware optimized-state selection, generation mode resolution, and scoring decisions.
- `src/lib/routes/session-comparison/response.ts` - HTTP mapping for normalized comparison decisions.
- `src/lib/routes/session-comparison/decision.test.ts` - Decision seam coverage for conflict, locked-preview, fallback scoring, and internal error.
- `src/lib/routes/session-comparison/response.test.ts` - Response seam coverage for success and conflict mapping.

## Decisions Made

- Kept `POST /compare` as the canonical architectural home for compare semantics to avoid mixing snapshot diff behavior with dashboard comparison behavior.
- Kept `GET /comparison` public and compatibility-only so dashboard consumers remain unchanged.
- Preserved helper call order so preview-locked optimized content is sanitized before resume text generation and scoring.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

- PowerShell treated `[id]` route segments as wildcard patterns during file reads; switching to `-LiteralPath` fixed the execution flow.
- A stale `.git/index.lock` blocked the first commit attempt; after confirming no active git process, the retry succeeded.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Route extraction and regression proof for the comparison lane are complete and committed.
- Phase 55 documentation and topology work can proceed independently in the remaining plan.

## Self-Check: PASSED

- Verified summary and all plan-touched route files exist.
- Verified task commits `282d7c7`, `c19248f`, and `db0742a` exist in git history.
