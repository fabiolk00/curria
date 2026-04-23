---
phase: 260422-vlo-add-end-to-end-highlight-outcome-observa
reviewed: 2026-04-23T02:05:59.1369817Z
depth: standard
files_reviewed: 11
files_reviewed_list:
  - src/lib/agent/highlight-observability.ts
  - src/lib/agent/tools/detect-cv-highlights.ts
  - src/lib/agent/ats-enhancement-pipeline.ts
  - src/lib/agent/job-targeting-pipeline.ts
  - src/lib/routes/session-comparison/decision.ts
  - src/app/api/session/[id]/route.ts
  - src/lib/observability/metric-events.ts
  - src/lib/agent/tools/detect-cv-highlights.test.ts
  - src/lib/agent/tools/pipeline.test.ts
  - src/lib/routes/session-comparison/decision.test.ts
  - src/app/api/session/[id]/route.test.ts
findings:
  critical: 0
  warning: 1
  info: 1
  total: 2
status: issues_found
---

# Phase 260422-vlo: Code Review Report

**Reviewed:** 2026-04-23T02:05:59.1369817Z
**Depth:** standard
**Files Reviewed:** 11
**Status:** issues_found

## Summary

Reviewed the new highlight detection, persistence, and response telemetry across ATS enhancement, job targeting, session comparison, and the session route. The core behavior is otherwise solid: zero-highlight, filtered-out, invalid-payload, preview-locked, artifact-missing, and rollback branches are all implemented consistently in the ATS path, and the targeted test run passed (`detect-cv-highlights`, `pipeline`, `decision`, and `session/[id]/route`).

The main regression risk is in `job_targeting`: unlike ATS enhancement, it does not suppress highlight generation for unchanged optimized CVs, so no-op rewrites can be logged and surfaced as genuine empty highlight runs. There is also one lower-severity telemetry labeling issue in ATS enhancement where the omission reason is narrower than the branch it represents.

## Warnings

### WR-01: Job-targeting no-op rewrites are classified as real zero-highlight runs

**File:** `src/lib/agent/job-targeting-pipeline.ts:283-355`
**Issue:** `runJobTargetingPipeline()` generates and persists `highlightState` for every valid rewrite, with no guard for the case where `rewriteResult.optimizedCvState` is unchanged from `session.cvState`. That differs from the ATS path, which explicitly skips highlight generation when the final optimized CV matches the original (`src/lib/agent/ats-enhancement-pipeline.ts:511-523`). If a job-targeting rewrite is valid but effectively a no-op, telemetry will record `highlightDetectionInvoked: true` and likely `highlightStatePersistedReason: 'empty_valid_result'`, and downstream response surfaces will classify the session as `present_empty` instead of treating highlights as not applicable for an unchanged CV. That collapses "no change" into "true zero-highlight run" and persists an unnecessary artifact.
**Fix:**
```ts
const shouldGenerateHighlights =
  validation.valid && !cvStatesMatch(rewriteResult.optimizedCvState, session.cvState)

let nextHighlightState = shouldGenerateHighlights ? previousHighlightState : undefined
let highlightDetectionOutcome: HighlightDetectionOutcome | undefined

if (shouldGenerateHighlights) {
  nextHighlightState = await generateCvHighlightState(rewriteResult.optimizedCvState, {
    userId: session.userId,
    sessionId: session.id,
    workflowMode: 'job_targeting',
    onCompleted: (outcome) => {
      highlightDetectionOutcome = outcome
    },
  })
}
```

## Info

### IN-01: ATS omission telemetry overstates why highlight generation was skipped

**File:** `src/lib/agent/ats-enhancement-pipeline.ts:590-594`
**Issue:** `highlightStatePersistedReason: 'not_generated_for_original_fallback'` is emitted for every `!shouldGenerateHighlights` branch. That branch covers the explicit `original_cv_fallback` case, but it also covers any valid ATS rewrite that ends up unchanged without taking that recovery path. The telemetry is still present, but the reason string is narrower than the actual condition and can mislead downstream analysis of omission cases.
**Fix:** Use a broader reason such as `not_generated_for_unchanged_cv`, or branch on `validationRecoveryKind === 'original_cv_fallback'` before choosing the persisted reason.

---

_Reviewed: 2026-04-23T02:05:59.1369817Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
