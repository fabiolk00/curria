# Quick Task 260429-zsb: Add Job Targeting Score Breakdown Card

## Completed

- Added a real Job Targeting score breakdown model derived from requirements/evidence.
- Added sidebar UI card inspired by the zip reference: clean border, compact bars, semantic green/amber/red, and critical gaps.
- Wired the score into `jobTargetingExplanation` so history/comparison responses receive it with existing data.
- Added comparison-response backfill so older Job Targeting sessions can show the score when `targetingPlan` is present.
- Updated Job Targeting layout to use a focused generated-resume column plus a 300px sidebar.
- Added tests for score calculation, UI rendering, comparison screen rendering, and pipeline persistence.

## Changed Files

- `src/lib/agent/job-targeting/score-breakdown.ts`
- `src/lib/agent/job-targeting/score-breakdown.test.ts`
- `src/components/resume/job-targeting-score-card.tsx`
- `src/components/resume/job-targeting-score-card.test.tsx`
- `src/components/resume/resume-comparison-view.tsx`
- `src/components/resume/resume-comparison-view.test.tsx`
- `src/lib/agent/job-targeting-pipeline.ts`
- `src/lib/agent/tools/pipeline.test.ts`
- `src/lib/routes/session-comparison/decision.ts`
- `src/lib/routes/session-comparison/decision.test.ts`
- `src/types/agent.ts`

## Validation

- `npm test -- src/lib/agent/job-targeting/score-breakdown.test.ts src/components/resume/job-targeting-score-card.test.tsx src/components/resume/resume-comparison-view.test.tsx src/lib/agent/tools/pipeline.test.ts src/lib/routes/session-comparison/decision.test.ts`
- `npm run typecheck`
- `npm run lint`
- `npm run audit:copy-regression`

## Notes

- `b_gVw3MKVJl8H.zip` was used only as a reference and was not copied into the product code.
