# Quick Task 260502-nby: Shadow Runner + Playwright E2E

**Date:** 2026-05-02
**Status:** Completed

## Goal

Automate production-readiness validation for `JobCompatibilityAssessment` using a hybrid model:

- batch/API runner for 500+ real or anonymized cases;
- Playwright only for representative end-to-end confidence;
- persisted/exported shadow comparison metrics;
- automatic cutover report with objective `CUTOVER_READY` verdict.

## Ordered Execution

1. Add source-of-truth approval guard.
2. Add shadow case/result contracts.
3. Add shadow comparison persistence table/helper.
4. Add batch runner CLI with JSONL input/output, limit and concurrency.
5. Expand analyzer to emit JSON and Markdown cutover reports.
6. Add optional anonymized real-case export script.
7. Add unit/integration tests for runner, analyzer, persistence guard and source-of-truth guard.
8. Add Playwright representative suite that avoids 500-browser execution.
9. Run targeted tests, typecheck, full test suite and Playwright suite where feasible.

## Verification

- Runner tests must prove multi-case processing, limit handling and per-case error isolation.
- Analyzer tests must prove p95 and cutover failure conditions.
- Feature flag tests must prove source-of-truth is blocked unless approved.
- Playwright must verify shadow UI behavior, feedback flow, artifact continuity and guard behavior with mocked network.

## Results

- `npx vitest run scripts/job-targeting/run-shadow-batch.test.ts scripts/job-targeting/analyze-shadow-divergence.test.ts src/lib/agent/job-targeting/__tests__/feature-flags.test.ts src/lib/agent/tools/pipeline.test.ts src/lib/db/schema-guardrails.test.ts src/app/api/job-targeting/feedback/route.test.ts` passed.
- `npm run typecheck` passed.
- `npm test` passed.
- `$env:E2E_PORT='3132'; npx playwright test tests/e2e/job-targeting-shadow.spec.ts --project=chromium` passed.
