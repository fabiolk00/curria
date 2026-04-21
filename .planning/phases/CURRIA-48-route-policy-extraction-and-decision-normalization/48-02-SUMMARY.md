---
phase: CURRIA-48-route-policy-extraction-and-decision-normalization
plan: "02"
subsystem: api-routes
tags: [routes, file-access, smart-generation, preview-lock, policy-extraction]
requires:
  - phase: 48-01
    provides: Shared route helper shape and first route extraction pattern
provides:
  - Thin file access route with centralized artifact access decision layer
  - Thin smart-generation route with centralized request and preview-contract normalization
affects: [file-access, smart-generation, preview-lock-contract]
key-files:
  created: [src/lib/routes/file-access/context.ts, src/lib/routes/file-access/decision.ts, src/lib/routes/file-access/response.ts, src/lib/routes/file-access/types.ts, src/lib/routes/file-access/decision.test.ts, src/lib/routes/smart-generation/context.ts, src/lib/routes/smart-generation/decision.ts, src/lib/routes/smart-generation/response.ts, src/lib/routes/smart-generation/types.ts, src/lib/routes/smart-generation/decision.test.ts]
  modified: [src/app/api/file/[sessionId]/route.ts, src/app/api/profile/smart-generation/route.ts]
requirements-completed: [ROUTE-POLICY-01, ROUTE-POLICY-TEST-01]
completed: 2026-04-20
---

# Phase 48 Plan 02 Summary

- Moved file route artifact lookup, latest-job interpretation, preview lock gating, and signed-url authorization behind `src/lib/routes/file-access/*`.
- Moved smart-generation request resolution, validation gates, pipeline execution, and preview-aware response normalization behind `src/lib/routes/smart-generation/*`.
- Preserved current free-trial lock behavior, reconciliation hints, readiness validation, and response payload semantics with route regressions and focused decision tests.

