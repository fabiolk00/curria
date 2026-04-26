# Phase 107 Research

## Current Highlight Flow

### Generation

- ATS calls `generateCvHighlightState(finalOptimizedCvState, { workflowMode: 'ats_enhancement' })`
- Job targeting calls `generateCvHighlightState(rewriteResult.optimizedCvState, { workflowMode: 'job_targeting', jobKeywords })`

### Shared Artifact

- `CvHighlightState` currently contains:
  - `source: 'rewritten_cv_state'`
  - `version`
  - `resolvedHighlights`
  - `generatedAt`
- There is no metadata that tells clients whether the highlight came from ATS or job targeting

### Job-targeting Gate

- `classifyHighlightGenerationGate(...)` returns:
  - `blocked_validation_failed`
  - `blocked_unchanged_cv_state`
  - `allowed`
- The actual `optimizedChanged` check is `!cvStatesMatch(rewriteResult.optimizedCvState, session.cvState)`
- This means first-run job targeting naturally reports `allowed` whenever the rewrite differs from the base CV

### Keyword Selection

- `extractJobKeywords(...)` builds ordered sources:
  1. `gapAnalysis.result.missingSkills`
  2. `targetingPlan.mustEmphasize`
  3. `targetingPlan.focusKeywords`
  4. short `targetFitAssessment.reasons`
  5. JD fragments
- It picks the first non-empty source only
- `normalizeKeywords(...)` currently deduplicates exact strings and slices to 20, but does not dedupe case-insensitively or drop very short noise tokens

### Client Exposure

- `normalizeSmartGenerationSuccess(...)` does not include `highlightState` in the direct success payload
- The compare/session surfaces read `session.agentState.highlightState` through:
  - `src/app/api/session/[id]/route.ts`
  - `src/lib/routes/session-comparison/decision.ts`
- Those readers currently expose the highlight as-is, without origin metadata

## Decision Direction

- Use Option A from the task: update the shared artifact type and have ATS persist `highlightSource: 'ats_enhancement'`
- This is additive, low-risk, and avoids a temporary optional-field limbo
- Implement the origin metadata inside the shared generator so callers only declare `workflowMode`
- Preserve legacy persisted artifacts by normalizing missing `highlightSource` from `lastRewriteMode ?? workflowMode` and defaulting `highlightGeneratedAt` from existing `generatedAt`
- Change the job-targeting unchanged gate to compare against `previousOptimizedCvState` when present; first runs still fall back to the base CV
- Keep `targetingPlanChanged` out of the gate for now: the persisted highlight artifact is anchored to rewritten text, so rerendering identical text only because keyword tie-breakers shifted would add noise without user-visible CV changes
- Keep direct smart-generation success without `highlightState`; the compare and session surfaces remain the intentional readers of the persisted artifact
