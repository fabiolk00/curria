---
phase: CURRIA-48-route-policy-extraction-and-decision-normalization
plan: "03"
subsystem: api-routes
tags: [routes, versions, compare, preview-sanitization, docs]
requires:
  - phase: 48-01
    provides: Generate-route extraction pattern
  - phase: 48-02
    provides: Preview-aware route decision pattern
provides:
  - Thin versions and compare routes with centralized preview-aware decisions
  - Route policy boundary documentation for future contributors
affects: [versions, compare, route-architecture]
key-files:
  created: [src/lib/routes/session-versions/context.ts, src/lib/routes/session-versions/decision.ts, src/lib/routes/session-versions/response.ts, src/lib/routes/session-versions/types.ts, src/lib/routes/session-versions/decision.test.ts, src/lib/routes/session-compare/context.ts, src/lib/routes/session-compare/decision.ts, src/lib/routes/session-compare/response.ts, src/lib/routes/session-compare/types.ts, src/lib/routes/session-compare/decision.test.ts, docs/architecture/route-policy-boundaries.md]
  modified: [src/app/api/session/[id]/versions/route.ts, src/app/api/session/[id]/compare/route.ts]
requirements-completed: [ROUTE-POLICY-TEST-01, ROUTE-POLICY-DOC-01]
completed: 2026-04-20
---

# Phase 48 Plan 03 Summary

- Moved versions route scope parsing and preview-aware timeline sanitization behind `src/lib/routes/session-versions/*`.
- Moved compare route ref resolution, locked-compare handling, and diff normalization behind `src/lib/routes/session-compare/*`.
- Added `docs/architecture/route-policy-boundaries.md` so future route work keeps business policy out of handlers and inside explicit decision modules.

