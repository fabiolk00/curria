# Quick Task 260429-ovc: Simplify Job Targeting Generated Resume Review Screen

## Goal

Reduce the verbosity of the generated resume comparison screen for Job Targeting while preserving the ATS Enhancement comparison flow.

## Scope

- Job Targeting:
  - Remove the original resume column from the review screen.
  - Remove the "Entenda o que mudou" rewrite-diff panel from the review screen.
  - Keep generated resume review, warning points, and target recommendations visible.
- ATS Enhancement:
  - Keep original vs optimized comparison unchanged.

## Implementation Steps

1. Gate the original resume column behind non-Job Targeting generations.
2. Remove the rewrite-diff panel rendering from the Job Targeting screen.
3. Move target recommendations into the sidebar beside the generated resume.
4. Avoid reserving an empty sidebar when there are no Job Targeting review items or recommendations.
5. Update component tests to prove Job Targeting hides the original/diff panels and ATS still shows original comparison.

## Validation

- `npm test -- src/components/resume/resume-comparison-view.test.tsx`
- `npm test -- src/lib/agent/job-targeting/recoverable-validation.test.ts src/lib/agent/tools/pipeline.test.ts src/components/resume/resume-comparison-view.test.tsx`
- `npm run typecheck`
- `npm run lint`
- `npm run audit:copy-regression`
