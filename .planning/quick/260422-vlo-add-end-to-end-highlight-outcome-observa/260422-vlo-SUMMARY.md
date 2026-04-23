# Quick Task Summary - 260422-vlo

## Goal

Add end-to-end observability for silent zero-highlight ATS enhancement and job-targeting runs without changing highlight selection or rendering semantics.

## What Changed

- Added detector lifecycle telemetry in `src/lib/agent/tools/detect-cv-highlights.ts`:
  - `agent.highlight_detection.started`
  - `agent.highlight_detection.completed`
  - normalized `resultKind` across `valid_non_empty`, `valid_empty`, `all_filtered_out`, `invalid_payload`, `thrown_error`, and `not_invoked`
  - raw-model vs validated counts
  - outcome counter `architecture.highlight_detection.outcome`
- Added shared highlight response/renderability classification in `src/lib/agent/highlight-observability.ts`:
  - omission outcomes
  - `present_empty`
  - `present_non_empty`
  - `present_non_renderable`
  - visible-span counting to detect renderer mismatch at the response boundary
- Added persistence and rollback observability in:
  - `src/lib/agent/ats-enhancement-pipeline.ts`
  - `src/lib/agent/job-targeting-pipeline.ts`
  - `agent.highlight_state.persisted` now distinguishes generated, filtered-out, invalid-payload, thrown-error, unchanged-state skip, original-fallback skip, validation-failed, and persist-version rollback paths
- Added response-surface observability in:
  - `src/lib/routes/session-comparison/decision.ts`
  - `src/app/api/session/[id]/route.ts`
  - response logs now distinguish locked omission, missing artifact, empty-present artifact, visible artifact, and non-renderable artifact
- Registered the new counter name in `src/lib/observability/metric-events.ts`

## Review Fixes

- Aligned `job_targeting` with the ATS unchanged-state guard so no-op rewrites do not get mislabeled as real zero-highlight outcomes.
- Narrowed the ATS skip reason so `not_generated_for_original_fallback` is only used for the actual fallback path; unchanged valid resumes now log `not_generated_for_unchanged_cv_state`.

## Verification

- `npx vitest run src/lib/agent/tools/detect-cv-highlights.test.ts src/lib/agent/tools/pipeline.test.ts src/lib/routes/session-comparison/decision.test.ts src/app/api/session/[id]/route.test.ts src/components/resume/resume-comparison-view.test.tsx`
- `npm run typecheck`

## Result

Silent zero-highlight runs are now diagnosable without guessing across detector invocation, model-empty results, filter-drop cases, invalid payloads, thrown errors, persistence/rollback, response omission, and renderability mismatch.
