---
phase: 05-deployed-agent-parity-and-evidence
plan: 03
subsystem: testing
tags: [vitest, api, observability, runtime, cli]
requires:
  - phase: 05-01
    provides: Release metadata helper and `/api/agent` provenance headers
  - phase: 05-02
    provides: Operator parity CLI and runtime parity docs
provides:
  - Regression coverage for release metadata helper fallbacks
  - Route-level proof for provenance headers on safe and SSE responses
  - Log-schema and CLI behavior coverage for parity diagnostics
affects: [phase-5-verification, operators, future agent debugging]
tech-stack:
  added: []
  patterns: [route-level provenance assertions, release-aware log-schema tests, CLI contract regression tests]
key-files:
  created:
    - src/lib/runtime/release-metadata.test.ts
    - scripts/check-agent-runtime-parity.test.ts
  modified:
    - src/app/api/agent/route.test.ts
    - src/lib/agent/streaming-loop.test.ts
key-decisions:
  - "Mock the release metadata helper in route and loop tests so provenance assertions stay deterministic and focused on the contract instead of env setup."
  - "Run the broader phase-targeted `/api/agent` suite before closeout so route model-selection and SSE seams stay covered alongside the new provenance tests."
patterns-established:
  - "Phase 5 regression contract: provenance headers, release-aware logs, and parity CLI output all need dedicated automated tests."
  - "Safe parity path proof: route tests must assert that the unauthenticated parity probe does not create sessions or increment message counts."
requirements-completed: [OPS-04, OPS-05, OPS-06]
duration: 5 min
completed: 2026-04-10
---

# Phase 5 Plan 03: Deployed Agent Parity and Evidence Summary

**Phase 5 now has committed regression proof for release metadata, `/api/agent` provenance headers, release-aware log fields, and operator parity CLI behavior.**

## Performance

- **Duration:** 5 min
- **Started:** 2026-04-10T16:33:00Z
- **Completed:** 2026-04-10T16:38:23Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments

- Added helper-level tests for Vercel commit metadata and local-dev fallback behavior.
- Extended route tests to assert provenance headers on the safe unauthenticated parity path, invalid JSON responses, and SSE success responses.
- Added loop and CLI regressions for completed-turn log fields, truncated and fallback diagnostics, and parity pass or mismatch behavior.

## Task Commits

Each task was committed atomically:

1. **Task 1: Add helper and route coverage for provenance headers** - `fa34f94` (test)
2. **Task 2: Lock the completed-turn log schema and parity CLI behavior** - `fa34f94` (test)

**Plan metadata:** recorded with the plan-summary docs commit

## Files Created/Modified

- `src/lib/runtime/release-metadata.test.ts` - Helper-level proof for release metadata normalization and fallbacks.
- `src/app/api/agent/route.test.ts` - Route-level provenance header and safe parity-path assertions.
- `src/lib/agent/streaming-loop.test.ts` - Release-aware completed-turn, truncated, and fallback log assertions.
- `scripts/check-agent-runtime-parity.test.ts` - CLI success, mismatch, and missing-header coverage.

## Decisions Made

- Kept the new tests sharply scoped to provenance, parity, and diagnostics rather than transcript UI rendering, which remains Phase 7 work.
- Used the existing route model-selection and SSE suites as part of the final phase pass so Phase 5 closes with one coherent `/api/agent` verification bundle.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

Phase 5 is complete and Phase 6 can now harden dialog continuity on top of a proven runtime provenance contract.

---
*Phase: 05-deployed-agent-parity-and-evidence*
*Completed: 2026-04-10*
