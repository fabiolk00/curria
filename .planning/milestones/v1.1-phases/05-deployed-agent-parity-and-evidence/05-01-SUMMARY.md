---
phase: 05-deployed-agent-parity-and-evidence
plan: 01
subsystem: api
tags: [nextjs, sse, observability, runtime, openai]
requires: []
provides:
  - Shared safe release metadata for the agent runtime
  - Provenance headers on `/api/agent` success and non-stream failure responses
  - Request-correlated route and loop logs with release identity
affects: [phase-5-plan-02, phase-5-plan-03, ops, observability]
tech-stack:
  added: []
  patterns: [shared runtime provenance helper, route-level provenance headers, request-correlated release logging]
key-files:
  created:
    - src/lib/runtime/release-metadata.ts
  modified:
    - src/app/api/agent/route.ts
    - src/lib/agent/agent-loop.ts
key-decisions:
  - "Expose the provenance contract on both safe JSON responses and SSE responses so parity checks can inspect `/api/agent` without entering the tool loop."
  - "Derive release identity only from trusted server metadata (`VERCEL_GIT_COMMIT_SHA`, `VERCEL_GIT_COMMIT_REF`, `VERCEL_ENV`) with a deterministic `local-dev` fallback."
patterns-established:
  - "Runtime provenance helper: route headers and structured logs must read from the same helper instead of duplicating env parsing."
  - "Agent response contract: `/api/agent` non-stream and stream responses carry the same provenance headers for operator debugging."
requirements-completed: [OPS-04, OPS-05]
duration: 10 min
completed: 2026-04-10
---

# Phase 5 Plan 01: Deployed Agent Parity and Evidence Summary

**Safe agent release provenance now ships through `/api/agent` headers and request-correlated logs for both early failures and SSE success paths.**

## Performance

- **Duration:** 10 min
- **Started:** 2026-04-10T16:17:00Z
- **Completed:** 2026-04-10T16:27:05Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments

- Added a canonical runtime provenance helper that resolves a safe release identity, source, and resolved model contract.
- Stamped `/api/agent` responses with `X-Agent-Release`, `X-Agent-Release-Source`, `X-Agent-Resolved-Agent-Model`, and `X-Agent-Resolved-Dialog-Model`.
- Extended route and loop logs so request-level and completed-turn diagnostics carry the same release identity alongside existing model and recovery fields.

## Task Commits

Each task was committed atomically:

1. **Task 1: Create a canonical safe release-metadata helper** - `fb82a61` (feat)
2. **Task 2: Attach provenance to `/api/agent` responses and request-correlated logs** - `fb82a61` (feat)

**Plan metadata:** recorded with the plan-summary docs commit

## Files Created/Modified

- `src/lib/runtime/release-metadata.ts` - Canonical safe server-derived agent release metadata.
- `src/app/api/agent/route.ts` - Provenance headers and release-aware request lifecycle responses.
- `src/lib/agent/agent-loop.ts` - Release-aware completed-turn, fallback, and stream completion logs.

## Decisions Made

- Used the existing unauthenticated and validation-fail response paths as safe provenance surfaces so later parity checks can avoid session creation and credit use.
- Kept the provenance payload flat and scalar-only to match the structured-log contract and avoid leaking env blobs or secrets.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

Plan 02 can now build the non-mutating parity CLI against a committed header contract.

---
*Phase: 05-deployed-agent-parity-and-evidence*
*Completed: 2026-04-10*
