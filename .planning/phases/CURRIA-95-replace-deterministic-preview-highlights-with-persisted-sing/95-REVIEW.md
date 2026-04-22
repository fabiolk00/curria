---
phase: 95-replace-deterministic-preview-highlights-with-persisted-sing
reviewed: 2026-04-22T21:50:00Z
depth: standard
files_reviewed: 18
files_reviewed_list:
  - src/lib/resume/cv-highlight-artifact.ts
  - src/lib/agent/tools/detect-cv-highlights.ts
  - src/lib/agent/ats-enhancement-pipeline.ts
  - src/lib/agent/job-targeting-pipeline.ts
  - src/components/resume/resume-comparison-view.tsx
  - src/components/resume/resume-comparison-page.tsx
  - src/app/api/session/[id]/route.ts
  - src/lib/routes/session-comparison/decision.ts
  - src/app/api/session/[id]/manual-edit/route.ts
  - src/types/agent.ts
  - src/types/dashboard.ts
  - src/lib/db/session-normalization.ts
  - src/lib/agent/request-orchestrator.ts
  - src/lib/agent/ats-enhancement-retry.ts
  - src/lib/agent/tools/validate-rewrite.ts
  - src/lib/agent/tools/rewrite-resume-full.ts
  - src/lib/generated-preview/locked-preview.ts
  - src/lib/agent/tools/pipeline.test.ts
findings:
  critical: 0
  warning: 3
  info: 0
  total: 3
status: issues_found
---

# Phase 95: Code Review Report

**Reviewed:** 2026-04-22T21:50:00Z
**Depth:** standard
**Files Reviewed:** 18
**Status:** issues_found

## Summary

The Phase 95 implementation largely wires persisted highlight artifacts through the ATS/job-targeting pipelines, API responses, and renderer as intended. The main problems are a real data-loss bug in highlight resolution when the detector emits duplicate `itemId`s, an ATS fallback path that can generate highlights for the unchanged original CV, and missing regression coverage around the lock/redaction and manual-edit invalidation seams.

## Warnings

### WR-01: Duplicate detector items silently discard later highlight ranges

**File:** `src/lib/resume/cv-highlight-artifact.ts:179-235`
**Issue:** `validateAndResolveHighlights()` pushes one `CvResolvedHighlight` per detector item without coalescing duplicate `itemId`s. `getHighlightRangesForItem()` then returns only the first matching entry. If the model emits the same `itemId` twice, later valid ranges are silently dropped and rendering becomes order-dependent.
**Fix:**
```ts
const grouped = new Map<string, CvHighlightRange[]>()

for (const candidate of detectionItems) {
  const item = itemMap.get(candidate.itemId)
  if (!item) continue
  const existing = grouped.get(candidate.itemId) ?? []
  grouped.set(candidate.itemId, [...existing, ...candidate.ranges])
}

// then validate/sort once per itemId before building resolved[]
```

### WR-02: ATS original-CV fallback still generates persisted highlights

**File:** `src/lib/agent/ats-enhancement-pipeline.ts:448-490`
**Issue:** When ATS recovery falls all the way back to `structuredClone(session.cvState)`, the pipeline still treats that payload as highlightable because `finalValidation.valid` becomes true again. That can persist underlines for an unchanged original CV, which violates the phase intent of generating one artifact for a successful rewritten resume payload.
**Fix:**
```ts
const shouldGenerateHighlights =
  finalValidation.valid && validationRecoveryKind !== 'original_cv_fallback'

let nextHighlightState = shouldGenerateHighlights ? await generateCvHighlightState(...) : undefined
```

### WR-03: Safety-critical highlight seams are not regression-tested

**File:** `src/app/api/session/[id]/route.test.ts:58-180`
**File:** `src/lib/routes/session-comparison/decision.test.ts:40-132`
**File:** `src/app/api/session/[id]/manual-edit/route.test.ts:424-545`
**Issue:** The changed tests exercise the new data path, but they never assert two safety boundaries the phase explicitly depends on: locked previews must omit `highlightState`, and optimized manual saves must persist `highlightState: undefined`. Those regressions would currently pass the test suite.
**Fix:** Add explicit assertions that:
```ts
expect(body.session.agentState.highlightState).toBeUndefined()
expect(decision.body.highlightState).toBeUndefined()
expect(applyToolPatchWithVersion).toHaveBeenCalledWith(
  expect.anything(),
  expect.objectContaining({
    agentState: expect.objectContaining({ highlightState: undefined }),
  }),
)
```

---

_Reviewed: 2026-04-22T21:50:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
