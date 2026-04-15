## Summary

Wave 10-02 added the deterministic rewrite stack for target-job adaptation.

Implemented:
- `buildTargetingPlan(...)` as an auditable intermediate artifact from `cvState + targetJobDescription + gapAnalysis`
- bounded retry and payload-shaping helpers for target-job execution
- `rewriteResumeFull(..., mode: 'job_targeting')` covering summary, experience, skills, education, and certifications
- stronger validation to reject fake target-role alignment and invented closure of real gaps
- pipeline coverage proving the target-job rewrite completes and persists only after factual validation

Validation:
- `pnpm tsc --noEmit`
- `pnpm vitest run src/lib/agent/tools/pipeline.test.ts`
