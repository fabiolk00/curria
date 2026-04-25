## Quick Summary

Task: enrich `job_targeting` highlights with optional vacancy signals without changing ATS or hybrid behavior.

### Implemented

- Extended `detectCvHighlights(...)` / `generateCvHighlightState(...)` with optional `jobKeywords?: string[]` context.
- Kept detector payload and ATS call sites backward-compatible; when `jobKeywords` is absent or empty, the prompt stays on the existing path.
- Added vacancy-prioritization prompt copy only when `jobKeywords` is present, as a tie-breaker rather than a mandatory match rule.
- Added `extractJobKeywords(session)` to `job-targeting-pipeline.ts`, sourcing keywords from `gapAnalysis.result.missingSkills`, deduped and capped at 20.
- Passed `jobKeywords` only from the `job_targeting` highlight generation call site.
- Added tests for:
  - prompt enrichment when `jobKeywords` exists
  - no prompt enrichment regression when `jobKeywords` is omitted
  - `job_targeting` passing `jobKeywords` into highlight generation
  - empty `missingSkills` preserving normal highlight generation
- Re-enabled the existing prompt-hardening regression test after code review.

### Guardrails Preserved

- No change to ATS enhancement wiring.
- No change to highlight persistence contract.
- No change to `shouldGenerateHighlights`, validation, fallback, or rollback behavior.
- Existing `workflowMode: 'job_targeting'` highlight logs remain unchanged.

### Validation

- `npx vitest run src/lib/agent/tools/detect-cv-highlights.test.ts src/lib/resume/cv-highlight-artifact.test.ts src/lib/agent/tools/pipeline.test.ts src/lib/routes/session-comparison/decision.test.ts src/components/resume/resume-comparison-view.test.tsx`
- `npm run typecheck`

Validation passed. Existing `act(...)` warnings in `resume-comparison-view.test.tsx` remain pre-existing and non-blocking.
