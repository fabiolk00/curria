---
phase: 06-dialog-continuity-and-model-routing-hardening
plan: 01
subsystem: agent
tags: [openai, dialog, recovery, continuity, vitest]
requires:
  - phase: 05-01
    provides: Release-aware agent logging and fallback diagnostics
provides:
  - Rewrite-aware dialog fallback selection
  - Latest-intent preservation for terse requests like `reescreva`
  - Better replacement of stale bootstrap text during degraded recovery
affects: [phase-6-plan-03, agent-loop, route-sse]
tech-stack:
  added: []
  patterns: [rewrite-intent classifier, vacancy-priority continuity fallback, visible-text replacement during degraded recovery]
key-files:
  created: []
  modified:
    - src/lib/agent/agent-loop.ts
    - src/lib/agent/streaming-loop.test.ts
    - src/app/api/agent/route.sse.test.ts
key-decisions:
  - "Treat terse imperatives such as `reescreva` as explicit rewrite intent instead of letting them fall back to generic saved-target messaging."
  - "When a stale bootstrap fragment is less useful than a later concrete rewrite continuation, replace it instead of concatenating both texts."
patterns-established:
  - "Dialog continuity fallback: latest vacancy still wins, but terse rewrite intent now maps to a concrete rewrite-oriented continuation."
  - "Best visible text preservation: degraded recovery can replace stale bootstrap fragments with a more useful continuation."
requirements-completed: [AGNT-01, AGNT-03]
duration: 14 min
completed: 2026-04-10
---

# Phase 6 Plan 01: Dialog Continuity and Model Routing Hardening Summary

**Dialog follow-ups now preserve rewrite intent instead of degrading back into stale vacancy bootstrap text.**

## Performance

- **Duration:** 14 min
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments

- Added rewrite-intent classification so terse requests like `reescreva` map to a concrete rewrite continuation.
- Kept the latest pasted vacancy higher priority than saved target-job context during degraded dialog recovery.
- Improved degraded recovery so a better rewrite continuation can replace stale bootstrap-like partial text instead of being appended to it.
- Added route and loop regressions for rewrite-specific fallback behavior.

## Task Commits

Each task was committed atomically:

1. **Task 1: Preserve latest rewrite intent in dialog recovery and fallback selection** - `ef61f4c` (fix)
2. **Task 2: Preserve the best visible text through repeated degradation** - `ef61f4c` (fix)

**Plan metadata:** recorded with the plan-summary docs commit

## Files Created/Modified

- `src/lib/agent/agent-loop.ts` - Rewrite-aware dialog fallback selection and better degraded recovery merging.
- `src/lib/agent/streaming-loop.test.ts` - Loop-level proof for rewrite fallback behavior and useful-text preservation.
- `src/app/api/agent/route.sse.test.ts` - Real route SSE proof for terse `reescreva` fallback behavior.

## Decisions Made

- Kept `pode fazer` on the existing continuation fallback kind while giving explicit rewrite requests their own rewrite-oriented path.
- Limited this plan to backend continuity behavior and route-level SSE proof, leaving frontend transcript assembly to Phase 7.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

One new regression originally targeted the wrong seam by letting length recovery append two continuations. The loop was tightened so a better rewrite continuation can replace stale bootstrap-like text during degraded recovery.

## User Setup Required

None.

## Next Phase Readiness

Plan 02 can now lock the model-routing contract without the continuity fixes fighting a stale fallback path.

---
*Phase: 06-dialog-continuity-and-model-routing-hardening*
*Completed: 2026-04-10*
