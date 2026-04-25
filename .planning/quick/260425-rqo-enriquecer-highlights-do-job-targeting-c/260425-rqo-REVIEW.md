# Quick Task 260425-rqo - Plan Review

## Verdict

Partial pass.

The plan clearly covered the acceptance criterion for optional `jobKeywords` in `detect-cv-highlights`, but it did not fully lock down the acceptance proof for "job-targeting-only wiring", and the shipped implementation drifted from the plan's stated keyword source.

## Findings

### 1. Optional `jobKeywords` in `detect-cv-highlights` was covered by the plan

- The plan explicitly required an optional, non-persisted detector context, preserved legacy `{ items }` payloads, and preserved default behavior when `jobKeywords` are absent: [260425-rqo-PLAN.md](</C:/CurrIA/.planning/quick/260425-rqo-enriquecer-highlights-do-job-targeting-c/260425-rqo-PLAN.md:21>), [260425-rqo-PLAN.md](</C:/CurrIA/.planning/quick/260425-rqo-enriquecer-highlights-do-job-targeting-c/260425-rqo-PLAN.md:23>), [260425-rqo-PLAN.md](</C:/CurrIA/.planning/quick/260425-rqo-enriquecer-highlights-do-job-targeting-c/260425-rqo-PLAN.md:31>), [260425-rqo-PLAN.md](</C:/CurrIA/.planning/quick/260425-rqo-enriquecer-highlights-do-job-targeting-c/260425-rqo-PLAN.md:41>), [260425-rqo-PLAN.md](</C:/CurrIA/.planning/quick/260425-rqo-enriquecer-highlights-do-job-targeting-c/260425-rqo-PLAN.md:50>).
- The implementation matches that part of the plan: `jobKeywords` is optional on the detector context, the prompt is enriched only when sanitized keywords exist, and the user payload is still `JSON.stringify({ items })`: [detect-cv-highlights.ts](</C:/CurrIA/src/lib/agent/tools/detect-cv-highlights.ts:118>), [detect-cv-highlights.ts](</C:/CurrIA/src/lib/agent/tools/detect-cv-highlights.ts:130>), [detect-cv-highlights.ts](</C:/CurrIA/src/lib/agent/tools/detect-cv-highlights.ts:281>), [detect-cv-highlights.ts](</C:/CurrIA/src/lib/agent/tools/detect-cv-highlights.ts:540>), [detect-cv-highlights.ts](</C:/CurrIA/src/lib/agent/tools/detect-cv-highlights.ts:579>).
- The tests also cover the positive and no-keywords paths at the detector boundary: [detect-cv-highlights.test.ts](</C:/CurrIA/src/lib/agent/tools/detect-cv-highlights.test.ts:121>), [detect-cv-highlights.test.ts](</C:/CurrIA/src/lib/agent/tools/detect-cv-highlights.test.ts:133>).

### 2. "Job-targeting-only wiring" was only partially covered by the plan

- The intent is present in the plan: wire signals from `runJobTargetingPipeline(...)`, keep ATS/hybrid unchanged, and keep scope limited to the job-targeting pipeline: [260425-rqo-PLAN.md](</C:/CurrIA/.planning/quick/260425-rqo-enriquecer-highlights-do-job-targeting-c/260425-rqo-PLAN.md:22>), [260425-rqo-PLAN.md](</C:/CurrIA/.planning/quick/260425-rqo-enriquecer-highlights-do-job-targeting-c/260425-rqo-PLAN.md:23>), [260425-rqo-PLAN.md](</C:/CurrIA/.planning/quick/260425-rqo-enriquecer-highlights-do-job-targeting-c/260425-rqo-PLAN.md:32>), [260425-rqo-PLAN.md](</C:/CurrIA/.planning/quick/260425-rqo-enriquecer-highlights-do-job-targeting-c/260425-rqo-PLAN.md:42>).
- The gap is that the plan never required an explicit negative regression for ATS or hybrid call sites. Its proof is "job-targeting passes keywords" rather than "non-job-targeting cannot pass keywords".
- That matters because the current detector does not gate keyword usage on `workflowMode === 'job_targeting'`; it enriches the prompt whenever `jobKeywords` is present. Isolation therefore depends on caller discipline, not on a detector-side guard: [detect-cv-highlights.ts](</C:/CurrIA/src/lib/agent/tools/detect-cv-highlights.ts:540>), [detect-cv-highlights.ts](</C:/CurrIA/src/lib/agent/tools/detect-cv-highlights.ts:575>).
- The ATS pipeline currently stays clean only because it does not pass `jobKeywords`: [ats-enhancement-pipeline.ts](</C:/CurrIA/src/lib/agent/ats-enhancement-pipeline.ts:516>). Existing ATS tests assert `workflowMode: 'ats_enhancement'`, but they use `expect.objectContaining(...)`, so they would still pass if a future change accidentally added `jobKeywords`: [pipeline.test.ts](</C:/CurrIA/src/lib/agent/tools/pipeline.test.ts:846>), [pipeline.test.ts](</C:/CurrIA/src/lib/agent/tools/pipeline.test.ts:1260>).

### 3. The implementation drifted from the plan's stated source of truth

- The plan says the keyword list must come from `targetingPlan.mustEmphasize`, with fallback to `targetingPlan.focusKeywords`: [260425-rqo-PLAN.md](</C:/CurrIA/.planning/quick/260425-rqo-enriquecer-highlights-do-job-targeting-c/260425-rqo-PLAN.md:12>), [260425-rqo-PLAN.md](</C:/CurrIA/.planning/quick/260425-rqo-enriquecer-highlights-do-job-targeting-c/260425-rqo-PLAN.md:22>), [260425-rqo-PLAN.md](</C:/CurrIA/.planning/quick/260425-rqo-enriquecer-highlights-do-job-targeting-c/260425-rqo-PLAN.md:63>).
- The shipped code does something different: it derives `jobKeywords` from `session.agentState.gapAnalysis?.result?.missingSkills`: [job-targeting-pipeline.ts](</C:/CurrIA/src/lib/agent/job-targeting-pipeline.ts:78>), [job-targeting-pipeline.ts](</C:/CurrIA/src/lib/agent/job-targeting-pipeline.ts:317>), [job-targeting-pipeline.ts](</C:/CurrIA/src/lib/agent/job-targeting-pipeline.ts:330>).
- The new pipeline tests lock in that drift by asserting gap-derived keywords and an empty `missingSkills` fallback, rather than the planned `mustEmphasize -> focusKeywords` derivation: [pipeline.test.ts](</C:/CurrIA/src/lib/agent/tools/pipeline.test.ts:1482>), [pipeline.test.ts](</C:/CurrIA/src/lib/agent/tools/pipeline.test.ts:1594>).

### 4. The plan's verify step was narrower than the module's own documented gate

- The plan verifies only two files: [260425-rqo-PLAN.md](</C:/CurrIA/.planning/quick/260425-rqo-enriquecer-highlights-do-job-targeting-c/260425-rqo-PLAN.md:26>), [260425-rqo-PLAN.md](</C:/CurrIA/.planning/quick/260425-rqo-enriquecer-highlights-do-job-targeting-c/260425-rqo-PLAN.md:45>), [260425-rqo-PLAN.md](</C:/CurrIA/.planning/quick/260425-rqo-enriquecer-highlights-do-job-targeting-c/260425-rqo-PLAN.md:55>).
- The test file itself documents a wider five-file gate for this highlight stack: [pipeline.test.ts](</C:/CurrIA/src/lib/agent/tools/pipeline.test.ts:1>).
- This did not cause a failure here, but it means the plan's acceptance proof was weaker than the local test contract already expected.

## Conclusion

- Optional `jobKeywords` in `detect-cv-highlights`: yes, the plan covered this acceptance criterion.
- Job-targeting-only wiring: only partially. The plan stated the intent, but it did not fully prove isolation outside `job_targeting`, and the implementation no longer matches the plan's stated keyword source.

## Verification

- `npx vitest run src/lib/agent/tools/detect-cv-highlights.test.ts src/lib/agent/tools/pipeline.test.ts` -> passed
- `npx vitest run src/lib/agent/tools/detect-cv-highlights.test.ts src/lib/resume/cv-highlight-artifact.test.ts src/lib/agent/tools/pipeline.test.ts src/lib/routes/session-comparison/decision.test.ts src/components/resume/resume-comparison-view.test.tsx` -> passed
- Residual note: the wider run emitted existing `act(...)` warnings in `resume-comparison-view.test.tsx`, but no failures
